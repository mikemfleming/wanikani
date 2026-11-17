import React, {useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {forecast} from './forecast.js';
import ProgressChart from './ProgressChart.jsx';
import './style.css';
const date = value => value ? new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'Building your forecast';
function App(){
 const [history,setHistory]=useState([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try {
    const response=await fetch(`${import.meta.env.BASE_URL}progress.json`,{cache:'no-store',signal:controller.signal});
    if(!response.ok) throw new Error(response.status===404?'No daily snapshots have been published yet. Run the Daily kanji snapshot workflow to collect the first one.':'Could not load the published snapshots. Please reload to try again.');
    const rows=await response.json();
    if(!Array.isArray(rows)||rows.some(s=>!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isInteger(s.level)||!Number.isFinite(s.passed)||!Array.isArray(s.levels))) throw new Error('The published snapshot file is invalid.');
    setHistory(rows.toSorted((a,b)=>a.date.localeCompare(b.date)));
   }catch(e){if(!controller.signal.aborted)setError(e.message)}finally{if(!controller.signal.aborted)setBusy(false)}
  }
  load();
  return()=>controller.abort();
 },[]);
 const latest=history.at(-1), prediction=forecast(history), current=latest?.levels.find(l=>l.level===latest.level), target=current?Math.ceil(current.total*.9):0;
 return <main><header><a className="brand" href=".">kanji / horizon</a><span>Updated daily</span></header>
 <div className="heading"><div><p className="eyebrow">YOUR WANIKANI TIMELINE</p><h1>A little closer, every day.</h1></div></div>
 {latest&&<><section className="hero"><div><p className="eyebrow">{latest.level===60?'LEVEL 60 REACHED':`NEXT UP · LEVEL ${latest.level+1}`}</p><h2>{latest.level===60?'You made it.':date(prediction.milestones[0]?.date)}</h2><p>{prediction.rate===null?'Waiting for daily snapshots on at least two dates within the past 28 days to estimate your pace.':prediction.rate===0?'No new Guru kanji in the recorded window. Dates will appear once your count increases.':`At your recent pace of ${prediction.rate.toFixed(1)} new Guru kanji per day.`}</p></div><div className="count"><strong>{latest.passed}</strong><span>kanji reached Guru</span></div></section>
 {current&&<section className="progress"><div><h3>Level {latest.level} progress</h3><span>{current.passed} / {target} kanji to pass this level</span></div><progress max={target||1} value={Math.min(current.passed,target)}/><p>{Math.max(0,target-current.passed)} more current-level kanji to reach the 90% threshold.</p></section>}
 <ProgressChart history={history}/>
 <section><div className="section-title"><h3>Levels ahead</h3><span>Estimated at your recent pace</span></div>{prediction.milestones.length?<div className="milestones">{prediction.milestones.slice(0,6).map((m,i)=><article key={m.level}><span className="level">{String(m.level).padStart(2,'0')}</span><div><h3>Level {m.level}</h3><p>{m.remaining} more kanji across the intervening levels</p></div><strong>{m.date?date(m.date):'—'}</strong>{i===0&&<span className="next">NEXT</span>}</article>)}</div>:<p>No further levels to forecast.</p>}</section>
 <section><div className="section-title"><h3>Daily snapshots</h3><span>{history.length} recorded days</span></div><div className="history">{history.slice(-14).reverse().map((s,i,rows)=><div key={s.date}><span>{date(s.date)}</span><strong>{s.passed} kanji</strong><span>{rows[i+1]?`${s.passed-rows[i+1].passed>=0?'+':''}${s.passed-rows[i+1].passed} since previous check`:'First recorded count'}</span></div>)}</div></section>
 <footer>Last checked {date(latest.date)} · Pace uses up to 28 days of snapshots.<p>These are pace estimates, not guaranteed unlock dates. Each level requires 90% of its own kanji to reach Guru. Radical unlocks, review timing, and lesson choices can change your actual date. Kanji stay counted after reaching Guru, even if they later fall back to Apprentice.</p><p>Progress is collected by the daily workflow. This page only displays published snapshots.</p></footer></>}
 {!busy&&!error&&!latest&&<p>No daily snapshots have been published yet.</p>}{busy&&<p role="status">Loading published snapshots…</p>}{error&&<p className="error" role="alert">{error}</p>}</main>
}
createRoot(document.getElementById('root')).render(<App/>);
