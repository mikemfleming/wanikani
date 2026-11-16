import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {WaniKaniClient} from '../src/api.js';
import {snapshot, record} from '../src/forecast.js';
const token = process.env.WANIKANI_API_TOKEN;
if (!token) throw new Error('Set WANIKANI_API_TOKEN to a read-only WaniKani token.');
const output = resolve(process.env.WANIKANI_PROGRESS_FILE || 'public/progress.json');
const memory = new Map();
const client = new WaniKaniClient(token, 'daily-script', {
  cache: {get: async () => undefined, set: async () => {}},
  storage: {getItem: key => memory.get(key), setItem: (key,value) => memory.set(key,value)},
  lock: async (_name, fn) => fn(),
});
let history=[];
try { history=JSON.parse(await readFile(output,'utf8')); }
catch(error) { if(error.code !== 'ENOENT') throw error; }
if(!Array.isArray(history)) throw new Error('Snapshot file must contain an array.');
const data = await client.forecast();
if(history.some(s => s.account !== data.user.id)) throw new Error('Snapshot file belongs to a different account. Choose another output file.');
const next=record(history,snapshot(data));
await mkdir(dirname(output),{recursive:true});
await writeFile(output+'.tmp',JSON.stringify(next,null,2)+'\n',{mode:0o600});
await rename(output+'.tmp',output);
console.log(`Saved ${next.at(-1).date}: ${next.at(-1).passed} kanji reached Guru.`);
