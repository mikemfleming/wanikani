import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,record,forecast} from '../src/forecast.js';
const entry=(date,passed,level=1)=>({date,account:1,passed,level,levels:[{level:1,total:10,passed:Math.min(passed,10)},{level:2,total:20,passed:0}]});
test('counts passed kanji including demoted items, excluding hidden subjects and vocabulary',()=>{
 const data={user:{id:1,level:1},subjects:[1,2,3,4].map(id=>({id,object:id===4?'vocabulary':'kanji',data:{level:1,hidden_at:id===3?'hidden':null}})),assignments:[1,2,3,4].map(id=>({data:{subject_id:id,passed_at:'2026-01-01',srs_stage:id===1?3:9}}))};
 assert.equal(snapshot(data).passed,2);
});
test('one snapshot does not invent a date',()=>assert.equal(forecast([entry('2026-01-01',2)]).milestones[0].date,null));
test('uses elapsed days and sums per-level thresholds',()=>{
 const p=forecast([entry('2026-01-01',2),entry('2026-01-08',9)]);
 assert.equal(p.rate,1);assert.equal(p.milestones[0].date,'2026-01-08');assert.equal(p.milestones[1].remaining,18);assert.equal(p.milestones[1].date,'2026-01-26');
});
test('same day replaces the count; resets discard the previous pace',()=>{
 assert.equal(record([entry('2026-01-01',1)],entry('2026-01-01',2)).length,1);
 assert.equal(record([entry('2026-01-01',10,2)],entry('2026-01-02',2)).length,1);
});
test('zero growth has no dates and level 60 has no future milestones',()=>{
 assert.equal(forecast([entry('2026-01-01',2),entry('2026-01-02',2)]).milestones[0].date,null);
 assert.deepEqual(forecast([entry('2026-01-01',2,60)]).milestones,[]);
});
