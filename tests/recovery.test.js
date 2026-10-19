import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS, dayStart, dayKey, validSettings, newPlan, normalizePlan, sessionCapacity, dailyCapacity, completedOn, forecast, measuredPace, updatePlan, readPlan} from '../src/recovery.js';
const now = new Date(2026,9,18,12).getTime();
const assignment = (id,at,extra={})=>({id,data:{available_at:new Date(at).toISOString(),srs_stage:5,hidden:false,...extra}});
const queue = n=>Array.from({length:n},(_,i)=>assignment(i,now-86400000));
const log = (id,reviews,minutes,at=now-1000)=>({id,reviews,minutes,completedAt:new Date(at).toISOString()});
test('230 overdue reviews become two sessions of 20 and scheduled arrivals remain included',()=>{
  const model=forecast([...queue(230),...Array.from({length:15},(_,i)=>assignment(300+i,now+3600000))],DEFAULT_SETTINGS,0,now);
  assert.equal(model.initialBacklog,230);assert.equal(model.perSession,20);assert.equal(model.dailyTarget,40);assert.equal(model.rows.length,7);
  assert.equal(model.rows[0].arrivals,15);assert.equal(model.rows[0].repeats,5);assert.equal(model.rows[0].planned,40);assert.equal(model.rows[0].backlog,210);
});
test('known arrivals at midnight go into the next local calendar day',()=>{
  const model=forecast([assignment(1,dayStart(now,1).getTime())],{...DEFAULT_SETTINGS,repeatAllowance:0},0,now);
  assert.equal(model.rows[0].arrivals,0);assert.equal(model.rows[1].arrivals,1);assert.equal(model.rows.reduce((n,r)=>n+r.arrivals,0),1);
});
test('future arrivals do not erase logged progress, and yesterday adds no target debt',()=>{
  const sessions=[log('yesterday',10,5,dayStart(now).getTime()-1),log('today',20,10)];
  const done=completedOn(sessions,now);assert.equal(done,20);
  const model=forecast([...queue(230),assignment(300,now+3600000)],DEFAULT_SETTINGS,done,now);
  assert.equal(model.remainingToday,20);assert.equal(model.rows[0].planned,20);assert.equal(model.rows[1].planned,40);
});
test('locked, burned, hidden and null-date items are excluded from review workload',()=>{
  const model=forecast([assignment(1,now),assignment(2,now,{srs_stage:0}),assignment(3,now,{srs_stage:9}),assignment(4,now,{hidden:true}),{id:5,data:{srs_stage:4,available_at:null}}],DEFAULT_SETTINGS,0,now);
  assert.equal(model.initialBacklog,1);
});
test('empty queue has no manufactured repeat reviews or negative backlogs',()=>{
  const model=forecast([],DEFAULT_SETTINGS,100,now);assert.equal(model.remainingToday,0);
  for(const row of model.rows){assert.equal(row.backlog,0);assert.equal(row.repeats,0);assert.equal(row.planned,0);}
});
test('tight budgets and caps keep estimated capacity inside the daily time budget',()=>{
  const settings={...DEFAULT_SETTINGS,dailyMinutes:5,sessionsPerDay:6,reviewsPerMinute:0.25};
  assert.equal(sessionCapacity(settings),1);assert.equal(dailyCapacity(settings),1);assert.equal(forecast(queue(230),settings,0,now).sessionSlots,1);
  assert.equal(sessionCapacity({...DEFAULT_SETTINGS,maxSessionReviews:7}),7);
});
test('pace uses at least two positive sessions, weighted by minutes, and ignores zero-work logs',()=>{
  assert.equal(measuredPace([log('a',20,10)]),null);
  assert.equal(measuredPace([log('a',20,10),log('b',10,10),log('c',0,5)]),1.5);
  assert.equal(measuredPace([log('a',100,1),log('b',100,1)]),10);
});
test('daily completion uses local day boundaries, deduplicates session IDs, and excludes future logs',()=>{
  const start=dayStart(now).getTime();
  assert.equal(completedOn([log('a',20,10,start),log('a',20,10,start),log('b',10,10,start-1),log('c',50,10,now+1000)],now),20);
  assert.notEqual(dayKey(dayStart(now)),dayKey(dayStart(now,1)));
});
test('settings reject invalid numbers, fractional counts and out-of-range values',()=>{
  for(const change of [{dailyMinutes:0},{sessionsPerDay:2.5},{reviewsPerMinute:NaN},{repeatAllowance:-1},{maxSessionReviews:1000}])assert.throws(()=>validSettings({...DEFAULT_SETTINGS,...change}));
  assert.deepEqual(validSettings(DEFAULT_SETTINGS),DEFAULT_SETTINGS);assert.deepEqual(normalizePlan({settings:{}}),newPlan());
});
test('account-scoped session persistence supports active-session recovery and serial changes',async()=>{
  const values=new Map(), tails=new Map();
  const client={account:'one',signal:new AbortController().signal,cache:{get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)},lock:(name,fn)=>{const task=(tails.get(name)||Promise.resolve()).then(fn);tails.set(name,task.catch(()=>{}));return task;}};
  await updatePlan(client,current=>({...current,active:{id:'active',target:20,startedAt:new Date(now).toISOString()}}));
  assert.equal((await readPlan(client)).active.id,'active');
  await Promise.all([updatePlan(client,c=>({...c,sessions:[...c.sessions,log('a',20,10)]})),updatePlan(client,c=>({...c,sessions:[...c.sessions,log('b',10,5)]}))]);
  assert.equal((await readPlan(client)).sessions.length,2);
  assert.equal((await readPlan({...client,account:'two'})).sessions.length,0);
});
test('failed persistence does not pretend a session was saved',async()=>{
  const client={account:'one',signal:new AbortController().signal,cache:{get:async()=>undefined,set:async()=>{throw Error('quota')}},lock:async(_,fn)=>fn()};
  await assert.rejects(()=>updatePlan(client,p=>p),/quota/);
});

test('no repeat allowance is invented when all reviews are beyond the forecast horizon',()=>{
  const model=forecast([assignment(1,dayStart(now,30).getTime())],DEFAULT_SETTINGS,0,now);
  for(const row of model.rows){assert.equal(row.arrivals,0);assert.equal(row.repeats,0);assert.equal(row.planned,0);}
});
