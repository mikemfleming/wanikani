import React, {useState, useEffect, useRef} from 'react';
import {ArrowUpRight, Clock, Target, CheckCircle2, CalendarDays, RefreshCw} from 'lucide-react';
import {DEFAULT_SETTINGS, dailyCapacity, sessionCapacity, completedOn, forecast, readPlan, updatePlan, validSettings, measuredPace} from './recovery.js';

export default function RecoveryPlanner({client, user, refreshSignal}) {
  const [plan,setPlan]=useState(null),[draft,setDraft]=useState(DEFAULT_SETTINGS),[source,setSource]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[report,setReport]=useState({reviews:'',minutes:''}),[now,setNow]=useState(Date.now());
  const [logging,setLogging]=useState(false);
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
      if((current.active?.id||null)!==(active?.id||null))throw Error('This session changed in another tab. Check progress first.');
      const sessions=[...current.sessions,{...(current.active||{id:crypto.randomUUID(),startedAt:completedAt,target:null}),completedAt,reviews,minutes}].slice(-100), pace=measuredPace(sessions);
      return {...current,active:null,sessions,settings:pace?{...current.settings,reviewsPerMinute:pace}:current.settings};
    },'Reviews logged.');
    if(saved){setReport({reviews:'',minutes:''});setLogging(false)}
  }
  if(!plan||!source)return <section className="panel recovery-loading"><CalendarDays size={26}/><h2>Building your recovery plan</h2><p>Checking scheduled reviews, your logged work, and your saved preferences.</p>{error&&<p role="alert">{error}</p>}<button className="refresh" aria-label="Check review progress" onClick={sync} disabled={busy}>{busy?'Loading…':'Try again'}</button></section>;
  const nextTarget=Math.min(model.perSession,model.remainingToday,model.initialBacklog), recent=plan.sessions.slice(-5).reverse();
  return <div className="recovery">
    {error&&<div className="error" role="alert">{error}</div>}
    <section className="panel session-panel quick-session">
      <div className="quick-stats"><span><strong>{done}</strong> / {model.dailyTarget} logged today</span><span><strong>{model.initialBacklog}</strong> due</span></div>
      <progress aria-label="Daily review progress" max={model.dailyTarget} value={Math.min(done,model.dailyTarget)}/>
      <div className="section-head"><h2>{active||logging?'Log your reviews':model.remainingToday===0?'Today’s target complete':nextTarget?'Your next session':'All caught up'}</h2><button className="refresh" aria-label="Check review progress" onClick={sync} disabled={busy}><RefreshCw size={16}/></button></div>
      {active||logging?<>
        {active&&<p className="quick-caption">Session target: {active.target} reviews</p>}
        <form onSubmit={finishSession} className="session-report">
          <div className="report-fields"><label>Reviews completed<input type="number" inputMode="numeric" autoFocus required min="0" max="1000" step="1" value={report.reviews} onChange={e=>setReport({...report,reviews:e.target.value})}/></label><label>Focused minutes<input type="number" inputMode="decimal" required min="0.5" max="240" step="0.5" value={report.minutes} onChange={e=>setReport({...report,minutes:e.target.value})}/></label></div>
          <button className="primary-action" disabled={busy}>{busy?'Saving…':'Save reviews'}</button>
        </form>
        {active?<div className="quick-links"><a href="https://www.wanikani.com/review" target="_blank" rel="noreferrer">Open WaniKani ↗</a><button className="text-action" disabled={busy} onClick={()=>save(current=>{if(current.active?.id!==active.id)throw Error('Session changed in another tab. Check progress.');return {...current,active:null}},'Session dismissed.')}>Dismiss session</button></div>:<button className="text-action" onClick={()=>setLogging(false)}>Cancel</button>}
      </>:<>
        <div className="session-target"><strong>{nextTarget}</strong><span>reviews · ~{Math.ceil(nextTarget/plan.settings.reviewsPerMinute)} min</span></div>
        <button className="primary-action" onClick={()=>setLogging(true)} disabled={busy}>Log reviews</button>
        <button className="text-action" disabled={busy||!nextTarget} onClick={startSession}>Start a session <ArrowUpRight size={14}/></button>
      </>}
      {notice&&<p className="quick-notice" role="status">{notice==='Reviews logged.'?notice:''}</p>}
    </section>
    <div className="recovery-columns quick-options">
      <details className="panel preferences-panel"><summary><span><strong>Plan preferences</strong><small>{plan.settings.dailyMinutes} min / day · {plan.settings.sessionsPerDay} sessions</small></span><span className="preferences-toggle" aria-hidden="true">Adjust +</span></summary><form className="plan-settings" onSubmit={saveSettings}>
        {[['dailyMinutes','Daily time budget','minutes',5,120,1],['sessionsPerDay','Sessions per day','sessions',1,6,1],['maxSessionReviews','Maximum session size','reviews',1,100,1],['reviewsPerMinute','Estimated pace','reviews / minute',0.25,10,0.01],['repeatAllowance','Repeat-review allowance','extra reviews / day',0,200,1]].map(([key,label,unit,min,max,step])=><label className="setting-row" key={key}><span>{label}<small>{unit}</small></span><input aria-label={label} type="number" required min={min} max={max} step={step} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
        <p className="settings-help">The session size is limited by both your time budget and maximum reviews. A tight time budget may leave fewer session slots. Pace adapts to the last five reported sessions after you’ve logged at least two.</p><button className="primary-action" disabled={busy}>Save preferences</button></form></details>
    </div>
    <details className="panel forecast-panel compact-details"><summary>Seven-day forecast<span aria-hidden="true">+</span></summary><p>Recalculated from your current queue. Missed targets don’t become tomorrow’s debt.</p>
      {user.current_vacation_started_at&&<div className="forecast-warning">Vacation mode is active. Scheduled dates may be frozen; treat this forecast as provisional until you return.</div>}
      <div className="forecast-table-wrap"><table className="forecast-table"><thead><tr><th scope="col">Day</th><th scope="col">Scheduled arrivals</th><th scope="col">Repeat allowance</th><th scope="col">Planned reviews</th><th scope="col">Backlog afterward</th></tr></thead><tbody>{model.rows.map((row,i)=><tr key={row.day}><th scope="row">{i===0?'Today':new Date(row.date).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})}</th><td data-label="Scheduled arrivals">+{row.arrivals}</td><td data-label="Repeat allowance">+{row.repeats}</td><td data-label="Planned reviews">{row.planned}</td><td data-label="Backlog afterward"><span className="backlog-value">{row.backlog}</span><span className="forecast-bar" style={{width:Math.round(row.backlog/Math.max(1,...model.rows.map(r=>r.backlog),model.initialBacklog)*60)}}/></td></tr>)}</tbody></table></div>
      <div className="forecast-assumptions"><strong>This is a planning estimate, not a finish-date promise.</strong><p>Scheduled arrivals come from assignments’ current next-review dates. They do not predict later repeats after you answer. The repeat allowance adds {plan.settings.repeatAllowance} estimated reviews per full day (prorated today) to leave room for those returns. Adjust it as you learn your workload. New lessons, mistakes, and review order can change the result; check progress after each session. Today’s planned reviews show the remaining target.</p>{model.rows.at(-1).backlog>=model.initialBacklog&&model.initialBacklog>0&&<p className="forecast-warning">With these assumptions, the backlog may not shrink this week. If it feels manageable, add a little time or a small extra session; otherwise keep this rhythm and reassess after a few days.</p>}</div>
    </details>
    <details className="panel session-history compact-details"><summary>Recent sessions<span aria-hidden="true">+</span></summary>{recent.length?<ul>{recent.map(s=><li key={s.id}><span>{new Date(s.completedAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span><strong>{s.reviews} reviews</strong><span>{s.minutes} focused min</span><button className="text-action" disabled={busy} aria-label={`Remove session from ${new Date(s.completedAt).toLocaleString()}`} onClick={()=>save(current=>({...current,sessions:current.sessions.filter(item=>item.id!==s.id)}),'Session removed from your local log.')}>Remove</button></li>)}</ul>:<p className="empty">Your first session is a fresh start. No streak to protect.</p>}<p className="sync-detail">Daily progress includes only sessions you log here, grouped by this device’s local calendar day. Reviews done elsewhere are not automatically counted: WaniKani no longer provides review history. Preferences and logs are kept per token and removed when you disconnect and clear data.</p></details>
    <details className="panel compact-details"><summary>How this works<span aria-hidden="true">+</span></summary><p>Log reviews completed on WaniKani here; review history is not supplied by the API. Focused minutes help calibrate your pace after two sessions. The session target is a suggestion: stop earlier if needed.</p><p>While reducing a backlog, consider pausing lessons. Missed days add no penalty. Your daily rhythm is {model.sessionSlots} sessions of up to {model.perSession} reviews within {plan.settings.dailyMinutes} minutes.</p><p className="sync-detail">Assignments checked {new Date(source.assignmentsAt).toLocaleString()}. Cached for one minute. {notice}</p></details>
  </div>;
}
