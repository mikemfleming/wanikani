import test from 'node:test';
import assert from 'node:assert/strict';
import {axis,increase} from '../src/chart-data.js';
test('Guru axis fits recorded range with whole-number ticks',()=>{
 const scale=axis([89,91,97]);assert.ok(scale.min>0);assert.ok(scale.min<=89);assert.ok(scale.max>=97);assert.ok(scale.max-scale.min<=20);assert.ok(scale.ticks.every(Number.isInteger));
});
test('constant and empty series still have a usable range; review axis starts at zero',()=>{
 for(const values of [[],[0],[91,91]]){const s=axis(values);assert.ok(s.max>s.min);assert.ok(s.ticks.every(Number.isFinite))}
 assert.equal(axis([20,50],true).min,0);
});
test('missing historical fields and decreases have no inferred positive increase',()=>{
 assert.equal(increase([{}, {lessonsCompleted:100}],1,'lessonsCompleted'),null);
 assert.equal(increase([{lessonsCompleted:100},{lessonsCompleted:10}],1,'lessonsCompleted'),null);
 assert.equal(increase([{passed:89},{passed:91}],1,'passed'),2);
});
test('level markers exclude the starting baseline and repeated levels, and preserve skipped-level observations',async()=>{
 const {levelUps}=await import('../src/chart-data.js');
 assert.deepEqual(levelUps([]),[]);
 const history=[{level:4},{level:4},{level:5},{level:5},{level:7}];
 assert.deepEqual(levelUps(history).map(m=>[m.index,m.snapshot.level]),[[2,5],[4,7]]);
 assert.deepEqual(levelUps([{level:5},{level:4}]),[]);
});
