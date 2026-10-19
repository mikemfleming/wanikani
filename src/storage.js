const TOKEN_KEY = 'kanji-observatory:token:v1';
export function savedToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function storeToken(token, remember) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    return '';
  } catch { return 'Browser storage is unavailable. Your token will stay in memory until this page closes.'; }
}
export function forgetToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}
let database;
function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('kanji-observatory-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('cache');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
// The token is never saved to IndexedDB. Keys use its SHA-256 fingerprint.
export const cache = {
  async get(key) { const database = await db(); return new Promise((resolve, reject) => { const request = database.transaction('cache').objectStore('cache').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); },
  async set(key, value) { const database = await db(); return new Promise((resolve, reject) => { const tx = database.transaction('cache', 'readwrite'); tx.objectStore('cache').put(value, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); },
  async clear(prefix) { const database = await db(); return new Promise((resolve, reject) => { const tx = database.transaction('cache', 'readwrite'); const store = tx.objectStore('cache'); const request = store.openCursor(); request.onsuccess = () => { const cursor = request.result; if (cursor) { if (String(cursor.key).startsWith(prefix)) cursor.delete(); cursor.continue(); } }; tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); },
};
