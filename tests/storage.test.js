import test from 'node:test';
import assert from 'node:assert/strict';
import { savedToken, storeToken, forgetToken } from '../src/storage.js';
const makeStorage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
test('token defaults to session storage, remembering is opt-in, disconnect removes both',()=>{
  const originalLocal=globalThis.localStorage, originalSession=globalThis.sessionStorage;
  globalThis.localStorage=makeStorage();globalThis.sessionStorage=makeStorage();
  try{
    assert.equal(savedToken(),'');assert.equal(storeToken('session-token',false),'');assert.equal(savedToken(),'session-token');
    const key='kanji-observatory:token:v1';assert.equal(localStorage.getItem(key),null);assert.equal(sessionStorage.getItem(key),'session-token');
    storeToken('remembered-token',true);assert.equal(sessionStorage.getItem(key),null);assert.equal(localStorage.getItem(key),'remembered-token');
    forgetToken();assert.equal(savedToken(),'');
  }finally{globalThis.localStorage=originalLocal;globalThis.sessionStorage=originalSession;}
});
test('blocked token storage reports memory-only mode',()=>{
  const originalLocal=globalThis.localStorage, originalSession=globalThis.sessionStorage;
  const blocked={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')},removeItem:()=>{throw Error('blocked')}};
  globalThis.localStorage=blocked;globalThis.sessionStorage=blocked;
  try{assert.equal(savedToken(),'');assert.match(storeToken('token',false),/memory/);assert.doesNotThrow(forgetToken);}finally{globalThis.localStorage=originalLocal;globalThis.sessionStorage=originalSession;}
});
