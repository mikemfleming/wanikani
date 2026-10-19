import test from 'node:test';
import assert from 'node:assert/strict';
import { WaniKaniClient, API_BASE, REQUEST_INTERVAL, TTL, safeUrl, retryDelay } from '../src/api.js';
function harness(responder) {
  let time = 1000000;
  const entries = new Map(), cacheEntries = new Map(), calls = [];
  const client = new WaniKaniClient('test-token', 'account-a', {
    now: () => time,
    sleep: async (delay, signal) => { signal?.throwIfAborted(); time += delay; },
    storage: { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) },
    cache: { get: async key => cacheEntries.get(key), set: async (key, value) => cacheEntries.set(key, value), clear: async prefix => { for (const key of cacheEntries.keys()) if (key.startsWith(prefix)) cacheEntries.delete(key); } },
    lock: async (_, fn) => fn(),
    fetcher: async (url, options) => { calls.push({ url, options, time }); return responder(url, calls.length); },
  });
  return { client, calls, entries, cacheEntries, advance: ms => { time += ms; } };
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers});
const resource = url => new URL(url).pathname.split('/').at(-1);
function dashboardResponse(url) {
  const name = resource(url);
  return json(name === 'user' ? {data:{level:3}} : name === 'summary' ? {data:{reviews:[],lessons:[]}} : {data:[],pages:{next_url:null}});
}
test('all requests are GET, omit cookies, and are spaced under half the documented limit', async () => {
  const h = harness(() => json({data:{}}));
  for(let i=0;i<65;i++) await h.client.request('user');
  for(let i=1;i<h.calls.length;i++) assert.ok(h.calls[i].time-h.calls[i-1].time>=REQUEST_INTERVAL);
  for(const call of h.calls){assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');assert.equal(call.options.headers.Authorization,'Bearer test-token');}
});
test('fresh dashboard cache and concurrent refresh avoid additional requests', async () => {
  const h = harness(dashboardResponse);
  const [a,b]=await Promise.all([h.client.dashboard(),h.client.dashboard()]);
  assert.deepEqual(a,b);assert.equal(h.calls.length,6);
  await h.client.dashboard();assert.equal(h.calls.length,6);
  h.advance(TTL.summary+1);await h.client.dashboard();
  assert.equal(h.calls.length,7);assert.equal(resource(h.calls.at(-1).url),'summary');
});
test('persistent cache is reused by a second client and isolated by account', async () => {
  const h=harness(dashboardResponse);await h.client.dashboard();
  const second=new WaniKaniClient('test-token','account-a',{fetcher:h.client.fetcher,cache:h.client.cache,storage:h.client.storage,now:h.client.now,sleep:h.client.sleep,lock:h.client.lock});
  await second.dashboard();assert.equal(h.calls.length,6);
  const other=new WaniKaniClient('other-token','account-b',{fetcher:h.client.fetcher,cache:h.client.cache,storage:h.client.storage,now:h.client.now,sleep:h.client.sleep,lock:h.client.lock});
  await other.dashboard();assert.equal(h.calls.length,12);
});
test('collections follow pagination and never cache partial failures', async () => {
  const h=harness((url,n)=>n===1?json({data:[{id:1}],pages:{next_url:API_BASE+'assignments?page_after_id=1'}}):json({data:[{id:2}],pages:{next_url:null}}));
  assert.deepEqual((await h.client.resource('assignments',true)).value,[{id:1},{id:2}]);
  const broken=harness((url,n)=>n===1?json({data:[{id:1}],pages:{next_url:API_BASE+'assignments?page_after_id=1'}}):json({},503));
  await assert.rejects(()=>broken.client.resource('assignments',true),/503/);assert.equal(broken.cacheEntries.size,0);
});
test('rejects foreign pagination before sending credentials', async()=>{
  const h=harness(()=>json({data:[],pages:{next_url:'https://evil.example/v2/subjects'}}));
  await assert.rejects(()=>h.client.resource('subjects',true),/Unsafe/);assert.equal(h.calls.length,1);
  for(const url of ['https://evil.example/v2/user','http://api.wanikani.com/v2/user','https://api.wanikani.com/other','https://name@api.wanikani.com/v2/user'])assert.throws(()=>safeUrl(url));
});
test('429 honors cooldown and retries with bounded attempts', async()=>{
  const h=harness((url,n)=>n===1?json({},429,{'Retry-After':'120'}):json({data:{}}));
  await h.client.request('user');assert.ok(h.calls[1].time-h.calls[0].time>=120000);
  const limited=harness(()=>json({},429));
  await assert.rejects(()=>limited.client.request('user'),/still rate limiting/);assert.equal(limited.calls.length,4);
  assert.ok(Number(limited.entries.get('ko:next:account-a'))>limited.calls.at(-1).time);
});
test('successful response with exhausted rate budget schedules cooldown', async()=>{
  const h=harness(()=>json({data:{}},200,{'RateLimit-Remaining':'0'}));
  await h.client.request('user');await h.client.request('user');assert.ok(h.calls[1].time-h.calls[0].time>=61000);
});
test('invalid auth does not retry, expired caches are not silently shown as current',async()=>{
  const h=harness(()=>json({},401));
  await assert.rejects(()=>h.client.resource('user'),/rejected/);assert.equal(h.calls.length,1);assert.equal(h.cacheEntries.size,0);
});
test('disconnect aborts requests and clears only the current account study cache',async()=>{
  const h=harness(dashboardResponse);await h.client.dashboard();h.cacheEntries.set('other:subjects',{value:[]});
  await h.client.clear();assert.deepEqual([...h.cacheEntries.keys()],['other:subjects']);
  await assert.rejects(()=>h.client.request('user'));assert.equal(h.calls.length,6);
});
test('cooldown defaults safely when headers are absent or malformed',()=>{
  assert.equal(retryDelay(new Headers(),100000),61000);
  assert.equal(retryDelay(new Headers({'RateLimit-Reset':'invalid','Retry-After':'invalid'}),100000),61000);
});
test('default fetch wrapper preserves browser global receiver',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=function(){assert.equal(this,globalThis);return Promise.resolve(json({data:{}}));};
    const h=harness(dashboardResponse);
    const client=new WaniKaniClient('token','binding-test',{cache:h.client.cache,storage:h.client.storage,now:h.client.now,sleep:h.client.sleep,lock:h.client.lock});
    await client.request('user');
  }finally{globalThis.fetch=original;}
});
test('shared locks serialize two clients and recheck their persistent cache',async()=>{
  const tails=new Map();
  const lock=(name,fn)=>{
    const previous=tails.get(name)||Promise.resolve();
    const next=previous.catch(()=>{}).then(fn);tails.set(name,next);return next;
  };
  const h=harness(dashboardResponse);h.client.lock=lock;
  const second=new WaniKaniClient('token','account-a',{fetcher:h.client.fetcher,cache:h.client.cache,storage:h.client.storage,now:h.client.now,sleep:h.client.sleep,lock});
  await Promise.all([h.client.dashboard(),second.dashboard()]);assert.equal(h.calls.length,6);
});

test('planner reuses fresh assignment data, checks after one minute and never calls deprecated reviews',async()=>{
  const h=harness(dashboardResponse);await h.client.dashboard();
  const [a,b]=await Promise.all([h.client.recovery(),h.client.recovery()]);assert.deepEqual(a,b);assert.equal(h.calls.length,6);
  h.advance(60001);await h.client.recovery();assert.equal(h.calls.length,7);assert.equal(resource(h.calls.at(-1).url),'assignments');
  await h.client.recovery();assert.equal(h.calls.length,7);assert.ok(h.calls.every(c=>resource(c.url)!=='reviews'));
});
