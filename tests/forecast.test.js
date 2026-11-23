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
test('snapshots track lessons across all subject types including radicals',()=>{
 const data={user:{id:1,level:1},subjects:[],assignments:[{data:{subject_id:1,started_at:'2026-11-01',subject_type:'kanji'}},{data:{subject_id:2,started_at:'2026-11-01',subject_type:'radical'}},{data:{subject_id:3,started_at:null}},{data:{subject_id:4,started_at:'2026-11-01',hidden:true}}],statistics:[{data:{meaning_correct:10,meaning_incorrect:5,reading_correct:10}},{data:{meaning_correct:4}},{data:{meaning_correct:50,hidden:true}}]};
 const s=snapshot(data,new Date('2026-11-02T12:00:00Z'));assert.equal(s.lessonsCompleted,2);assert.equal(s.capturedAt,'2026-11-02T12:00:00.000Z');
});
test('retains midnight and noon Central checks on the same UTC day, and uses half-day elapsed pace',()=>{
 const first={...entry('2026-11-23',2),capturedAt:'2026-11-23T06:00:00.000Z'};
 const second={...entry('2026-11-23',4),capturedAt:'2026-11-23T18:00:00.000Z'};
 const h=record([first],second);
 assert.equal(h.length,2);assert.equal(forecast(h).rate,4);assert.equal(forecast(h).elapsed,.5);
 assert.equal(record(h,second).length,2);
});
test('keeps date-only legacy history alongside timestamped checks',()=>{
 const old=entry('2026-11-22',2);
 const next={...entry('2026-11-23',4),capturedAt:'2026-11-23T06:00:00.000Z'};
 assert.equal(record([old],next).length,2);
});
