import { cache as browserCache } from './storage.js';
export const API_BASE = 'https://api.wanikani.com/v2/';
export const REQUEST_INTERVAL = 2100; // At most 29 starts in any rolling minute.
export const TTL = { user: 300000, summary: 60000, assignments: 300000, review_statistics: 900000, level_progressions: 3600000, subjects: 86400000 };
export function safeUrl(endpoint) {
  const url = new URL(endpoint, API_BASE);
  if (url.origin !== new URL(API_BASE).origin || !url.pathname.startsWith('/v2/') || url.username || url.password) throw new Error('Unsafe API URL rejected.');
  return url.href;
}
export function retryDelay(headers, now) {
  const retry = headers.get('Retry-After');
  const seconds = retry === null ? NaN : Number(retry);
  const reset = Number(headers.get('RateLimit-Reset')) * 1000 || 0;
  return Math.max(61000, Number.isFinite(seconds) ? seconds * 1000 : (Date.parse(retry) || 0) - now, reset - now + 1000);
}
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
async function fingerprint(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
// Dependencies are injectable so rate limits, pagination and caches can be tested without live API calls.
export class WaniKaniClient {
  constructor(token, account, { fetcher = (...args) => globalThis.fetch(...args), cache = browserCache, storage = globalThis.localStorage, lock = (name, fn) => navigator.locks.request(name, fn), now = Date.now, sleep = wait, onStatus = () => {} } = {}) {
    Object.assign(this, { token, account, fetcher, cache, storage, lock, now, sleep, onStatus });
    this.controller = new AbortController();
    this.signal = this.controller.signal;
  }
  abort() { this.controller.abort(); }
  async request(endpoint) {
    const url = safeUrl(endpoint);
    return this.lock(`ko:rate:${this.account}`, async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        this.signal.throwIfAborted();
        const key = `ko:next:${this.account}`;
        let next;
        try { next = Number(this.storage.getItem(key)) || 0; } catch { throw new Error('Enable browser storage to coordinate API requests safely across tabs.'); }
        const delay = Math.max(0, next - this.now());
        if (delay) await this.sleep(delay, this.signal);
        this.signal.throwIfAborted();
        this.storage.setItem(key, String(this.now() + REQUEST_INTERVAL));
        let response;
        try {
          const timeout = AbortSignal.timeout(30000);
          response = await this.fetcher(url, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Authorization: `Bearer ${this.token}`, 'Wanikani-Revision': '20170710' }, signal: AbortSignal.any([this.signal, timeout]) });
        } catch (error) {
          this.signal.throwIfAborted();
          throw new Error(error.name === 'TimeoutError' ? 'WaniKani took too long to respond. Please try again.' : 'Could not reach WaniKani. Check your connection and try again.');
        }
        if (response.status === 429) {
          const delay = retryDelay(response.headers, this.now());
          this.storage.setItem(key, String(this.now() + delay));
          this.onStatus('WaniKani is rate limiting requests. Waiting before retrying…');
          if (attempt === 3) throw new Error('WaniKani is still rate limiting requests. Please try again later.');
          continue;
        }
        if (response.headers.get('RateLimit-Remaining') === '0') {
          const reset = Number(response.headers.get('RateLimit-Reset')) * 1000 || 0;
          this.storage.setItem(key, String(Math.max(this.now() + 61000, reset + 1000)));
        }
        if (!response.ok) {
          const error = new Error(response.status === 401 || response.status === 403 ? 'WaniKani rejected this token. Check that it is valid; no write permissions are needed.' : `WaniKani returned HTTP ${response.status}. Please try again.`);
          error.status = response.status;
          throw error;
        }
        return response.json();
      }
    });
  }
  async resource(endpoint, collection = false, maxAge) {
    const resource = endpoint.split('?')[0];
    const key = `${this.account}:${endpoint}`;
    let cached;
    try { cached = await this.cache.get(key); } catch { this.onStatus('Persistent cache is unavailable. Requests are still paced safely.'); }
    if (cached && this.now() - cached.time < (maxAge ?? TTL[resource])) return cached;
    this.onStatus(`Syncing ${resource.replaceAll('_', ' ')}…`);
    let url = endpoint, items = [], value;
    const visited = new Set();
    do {
      this.signal.throwIfAborted();
      const validated = safeUrl(url);
      if (visited.has(validated)) throw new Error('WaniKani returned a repeated pagination URL.');
      visited.add(validated);
      const json = await this.request(validated);
      if (collection) {
        if (!Array.isArray(json.data)) throw new Error('Unexpected WaniKani collection response.');
        items.push(...json.data);
      } else value = json.data;
      url = collection ? json.pages?.next_url : null;
    } while (url);
    const result = { value: collection ? items : value, time: this.now() };
    this.signal.throwIfAborted();
    try { await this.cache.set(key, result); } catch { this.onStatus('Persistent cache is unavailable. Requests are still paced safely.'); }
    return result;
  }
  dashboard() {
    if (this.pending) return this.pending;
    this.pending = this.lock(`ko:sync:${this.account}`, async () => {
      this.signal.throwIfAborted();
      const user = await this.resource('user');
      const summary = await this.resource('summary');
      const assignments = await this.resource('assignments', true);
      const statistics = await this.resource('review_statistics', true);
      const progressions = await this.resource('level_progressions', true);
      const subjects = await this.resource(`subjects?levels=${Array.from({ length: user.value.level }, (_, i) => i + 1).join(',')}`, true);
      return { user: user.value, summary: summary.value, assignments: assignments.value, statistics: statistics.value, progressions: progressions.value, subjects: subjects.value, fetchedAt: new Date(Math.min(user.time, summary.time, assignments.time, statistics.time, progressions.time, subjects.time)).toISOString() };
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
  recovery() {
    if (this.recoveryPending) return this.recoveryPending;
    this.recoveryPending = this.lock(`ko:sync:${this.account}`, async () => {
      this.signal.throwIfAborted();
      // Planner checks have a one-minute freshness window, without bypassing pacing.
      const assignments = await this.resource('assignments', true, 60000);
      return { assignments: assignments.value, assignmentsAt: assignments.time };
    }).finally(() => { this.recoveryPending = null; });
    return this.recoveryPending;
  }
  async clear() {
    this.abort();
    await this.lock(`ko:sync:${this.account}`, () => this.lock(`ko:plan:${this.account}`, () => this.cache.clear(`${this.account}:`)));
  }
}
export async function createClient(token, onStatus) {
  if (!globalThis.navigator?.locks) throw new Error('This app needs a browser with Web Locks support on HTTPS (or localhost). Please use a current browser.');
  return new WaniKaniClient(token, await fingerprint(token), { onStatus });
}
