import React, {useState, useEffect, useRef} from 'react';
import {ArrowUpRight, Clock, Target, CheckCircle2, CalendarDays, RefreshCw} from 'lucide-react';
import {DEFAULT_SETTINGS, dailyCapacity, sessionCapacity, completedOn, forecast, readPlan, updatePlan, validSettings, measuredPace} from './recovery.js';

export default function RecoveryPlanner({client, user, refreshSignal}) {
  const [plan,setPlan]=useState(null),[draft,setDraft]=useState(DEFAULT_SETTINGS),[source,setSource]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[report,setReport]=useState({reviews:'',minutes:''}),[now,setNow]=useState(Date.now());
  const mounted=useRef(false), working=useRef(false);
  async function sync(){
    if(working.current)return;
    working.current=true;setBusy(true);setError('');setNotice('');
    try{
      const [saved,data]=await Promise.all([readPlan(client),client.recovery()]);
      if(!mounted.current)return;
      setPlan(saved);setDraft(saved.settings);setSource(data);setNow(Date.now());
      setNotice(Date.now()-data.assignmentsAt < 5000 ? 'Progress checked with WaniKani.' : 'Using the recent browser cache. Another API check is available one minute after the last check.');
    }catch(e){if(mounted.current&&!client.signal.aborted)setError(e.message)}
    finally{working.current=false;if(mounted.current)setBusy(false)}
  }
  useEffect(()=>{mounted.current=true;sync();const timer=setInterval(()=>setNow(Date.now()),30000);return()=>{mounted.current=false;clearInterval(timer)}},[client,refreshSignal]);
  async function save(update, message){
    if(working.current)return;
    working.current=true;setBusy(true);setError('');setNotice('');
    try{const next=await updatePlan(client,update);if(mounted.current){setPlan(next);setDraft(next.settings);setNow(Date.now());setNotice(message)}return next}catch(e){if(mounted.current)setError(`Could not save your plan. ${e.message}`)}finally{working.current=false;if(mounted.current)setBusy(false)}
  }
  function saveSettings(e){e.preventDefault();try{const settings=validSettings(draft);save(current=>({...current,settings}),'Plan saved. Your new budget applies from today; missed days do not add extra work.')}catch(e){setError(e.message)}}
  const done = plan ? completedOn(plan.sessions,now) : 0;
  const model = source&&plan ? forecast(source.assignments,plan.settings,done,now) : null;
  const active=plan?.active;
  function startSession(){
    const startedAt=new Date().toISOString();
    save(current=>{
      if(current.active)throw Error('A session is already active in another tab. Check progress to load it.');
      const capacity=sessionCapacity(current.settings), target=Math.min(capacity,Math.max(0,dailyCapacity(current.settings)-completedOn(current.sessions,Date.now())),model.initialBacklog);
      if(!target)throw Error('No session is needed right now. Check progress for the latest queue.');
      return {...current,active:{id:crypto.randomUUID(),startedAt,target}};
    },'Session ready. Open WaniKani, work up to your target, then return here.');
  }
  async function finishSession(e){
    e.preventDefault();const reviews=Number(report.reviews),minutes=Number(report.minutes);
    if(!Number.isInteger(reviews)||reviews<0||reviews>1000||!Number.isFinite(minutes)||minutes<0.5||minutes>240){setError('Enter 0–1,000 completed reviews and 0.5–240 focused minutes.');return}
    const completedAt=new Date().toISOString();
    const saved=await save(current=>{
      if(!current.active||current.active.id!==active.id)throw Error('This session changed in another tab. Check progress first.');
      const sessions=[...current.sessions,{...current.active,completedAt,reviews,minutes}].slice(-100), pace=measuredPace(sessions);
      return {...current,active:null,sessions,settings:pace?{...current.settings,reviewsPerMinute:pace}:current.settings};
    },'Session logged. Your session counts toward today. Check progress after a minute to pick up changes to the WaniKani queue.');
    if(saved)setReport({reviews:'',minutes:''});
  }
  if(!plan||!source)return <section className="panel recovery-loading"><CalendarDays size={26}/><h2>Building your recovery plan</h2><p>Checking scheduled reviews, your logged work, and your saved preferences.</p>{error&&<p role="alert">{error}</p>}<button className="refresh" onClick={sync} disabled={busy}>{busy?'Loading…':'Try again'}</button></section>;
  const nextTarget=Math.min(model.perSession,model.remainingToday,model.initialBacklog), recent=plan.sessions.slice(-5).reverse();
  return <div className="recovery">
    {error&&<div className="error" role="alert">{error}</div>}
    <section className="recovery-hero"><div><span className="eyebrow">ONE SMALL SESSION AT A TIME</span><h2>{active?'Your session is in progress.':model.remainingToday===0?'You’ve met today’s target.':model.initialBacklog===0?'You’re caught up for now.':`Just ${nextTarget} reviews to start.`}</h2><p>{active?`Aim for ${active.target} reviews, then take a break. You can stop earlier.`:'A sustainable daily budget, with room to breathe. Tomorrow starts fresh.'}</p></div><span className="recovery-mark" aria-hidden="true">少しずつ</span></section>
    <div className="recovery-metrics">
      <div className="metric"><div className="metric-top">Currently due<Clock size={18}/></div><strong>{model.initialBacklog}</strong><small>From your latest assignment snapshot</small></div>
      <div className="metric"><div className="metric-top">Logged today<CheckCircle2 size={18}/></div><strong>{done}<span className="metric-denominator"> / {model.dailyTarget}</span></strong><small>Reviews from sessions you reported here</small><progress aria-label="Daily review progress" max={model.dailyTarget} value={Math.min(done,model.dailyTarget)}/></div>
      <div className="metric"><div className="metric-top">Your daily rhythm<Target size={18}/></div><strong>{model.sessionSlots}<span className="metric-denominator"> × up to {model.perSession}</span></strong><small>Within {plan.settings.dailyMinutes} focused minutes a day</small></div>
    </div>
    <div className="recovery-columns">
      <section className="panel session-panel"><div className="section-head"><div><h2>{active?'Finish when you’re ready':'Your next small step'}</h2><p>{active?`Started ${new Date(active.startedAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`:'A session target, not a queue you have to finish.'}</p></div><Clock size={18}/></div>
        {active?<><div className="session-target"><strong>{active.target}</strong><span>review target</span></div><a className="dark-button" href="https://www.wanikani.com/review" target="_blank" rel="noreferrer">Open WaniKani <ArrowUpRight size={16}/></a><p className="session-instructions">WaniKani controls its own queue. Stop at your target or earlier, then return here.</p><form onSubmit={finishSession} className="session-report"><p>Report what you finished and your focused time to calibrate the pace estimate. Your reported review count is also added to today’s progress here; WaniKani does not provide individual review history.</p><div className="report-fields"><label>Reviews completed<input type="number" required min="0" max="1000" step="1" value={report.reviews} onChange={e=>setReport({...report,reviews:e.target.value})}/></label><label>Focused minutes<input type="number" required min="0.5" max="240" step="0.5" value={report.minutes} onChange={e=>setReport({...report,minutes:e.target.value})}/></label></div><button className="primary-action" disabled={busy}>Finish & save session</button></form><button className="text-action" disabled={busy} onClick={()=>save(current=>{if(current.active?.id!==active.id)throw Error('Session changed in another tab. Check progress.');return {...current,active:null}},'Session dismissed. This session was not logged. Any reviews you completed remain saved in WaniKani.')}>Dismiss session without a log</button></>:<><div className="session-target"><strong>{nextTarget}</strong><span>{nextTarget?'reviews next session':'reviews needed now'}</span></div><p>Up to {Math.round(plan.settings.dailyMinutes/model.sessionSlots*10)/10} minutes per session. There’s no catch-up penalty for missing a day.</p><button className="primary-action" disabled={busy||!nextTarget} onClick={startSession}>Start a session <ArrowUpRight size={16}/></button><button className="text-action" onClick={sync} disabled={busy}>{busy?'Checking…':'Check progress with WaniKani'}</button>{model.initialBacklog>0&&<p className="lesson-note">While reducing the backlog, consider pausing new lessons. The plan assumes you aren’t adding lessons.</p>}</>}
        <p className="sync-detail">Assignments checked {new Date(source.assignmentsAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}. Cached for 1 minute. {notice&&<span role="status">{notice}</span>}</p>
      </section>
      <section className="panel"><div className="section-head"><div><h2>Make room for real life</h2><p>Adjust the plan to a pace you can keep.</p></div><CalendarDays size={18}/></div><form className="plan-settings" onSubmit={saveSettings}>
        {[['dailyMinutes','Daily time budget','minutes',5,120,1],['sessionsPerDay','Sessions per day','sessions',1,6,1],['maxSessionReviews','Maximum session size','reviews',1,100,1],['reviewsPerMinute','Estimated pace','reviews / minute',0.25,10,0.01],['repeatAllowance','Repeat-review allowance','extra reviews / day',0,200,1]].map(([key,label,unit,min,max,step])=><label className="setting-row" key={key}><span>{label}<small>{unit}</small></span><input aria-label={label} type="number" required min={min} max={max} step={step} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
        <p className="settings-help">The session size is limited by both your time budget and maximum reviews. A tight time budget may leave fewer session slots. Pace adapts to the last five reported sessions after you’ve logged at least two.</p><button className="primary-action" disabled={busy}>Save preferences</button></form></section>
    </div>
    <section className="panel forecast-panel"><div className="section-head"><div><h2>Your next seven days</h2><p>Recalculated from your current queue. Missed targets don’t become tomorrow’s debt.</p></div><button className="refresh" onClick={sync} disabled={busy}><RefreshCw size={14}/>{busy?'Checking…':'Check progress'}</button></div>
      {user.current_vacation_started_at&&<div className="forecast-warning">Vacation mode is active. Scheduled dates may be frozen; treat this forecast as provisional until you return.</div>}
      <div className="forecast-table-wrap"><table className="forecast-table"><thead><tr><th>Day</th><th>Scheduled arrivals</th><th>Repeat allowance</th><th>Planned reviews</th><th>Backlog afterward</th></tr></thead><tbody>{model.rows.map((row,i)=><tr key={row.day}><th>{i===0?'Today':new Date(row.date).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})}</th><td>+{row.arrivals}</td><td>+{row.repeats}</td><td>{row.planned}</td><td><span className="backlog-value">{row.backlog}</span><span className="forecast-bar" style={{width:Math.round(row.backlog/Math.max(1,...model.rows.map(r=>r.backlog),model.initialBacklog)*60)}}/></td></tr>)}</tbody></table></div>
      <div className="forecast-assumptions"><strong>This is a planning estimate, not a finish-date promise.</strong><p>Scheduled arrivals come from assignments’ current next-review dates. They do not predict later repeats after you answer. The repeat allowance adds {plan.settings.repeatAllowance} estimated reviews per full day (prorated today) to leave room for those returns. Adjust it as you learn your workload. New lessons, mistakes, and review order can change the result; check progress after each session. Today’s planned reviews show the remaining target.</p>{model.rows.at(-1).backlog>=model.initialBacklog&&model.initialBacklog>0&&<p className="forecast-warning">With these assumptions, the backlog may not shrink this week. If it feels manageable, add a little time or a small extra session; otherwise keep this rhythm and reassess after a few days.</p>}</div>
    </section>
    <section className="panel session-history"><div className="section-head"><div><h2>Small wins, recorded</h2><p>Your last five reported sessions, saved in this browser.</p></div></div>{recent.length?<ul>{recent.map(s=><li key={s.id}><span>{new Date(s.completedAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span><strong>{s.reviews} reviews</strong><span>{s.minutes} focused min</span><button className="text-action" disabled={busy} aria-label={`Remove session from ${new Date(s.completedAt).toLocaleString()}`} onClick={()=>save(current=>({...current,sessions:current.sessions.filter(item=>item.id!==s.id)}),'Session removed from your local log.')}>Remove</button></li>)}</ul>:<p className="empty">Your first session is a fresh start. No streak to protect.</p>}<p className="sync-detail">Daily progress includes only sessions you log here, grouped by this device’s local calendar day. Reviews done elsewhere are not automatically counted: WaniKani no longer provides review history. Preferences and logs are kept per token and removed when you disconnect and clear data.</p></section>
  </div>;
}
