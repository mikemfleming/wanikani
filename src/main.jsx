import React, {useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {forecast, snapshotTime, snapshotKey, snapshotLabel} from './forecast.js';
import ProgressChart from './ProgressChart.jsx';
import './style.css';
import './themes.css';
const requestedTheme = new URLSearchParams(window.location.search).get('theme');
const theme = ['tokyo', 'blog'].includes(requestedTheme) ? requestedTheme : 'default';
document.documentElement.dataset.theme = theme;
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
    if(!Array.isArray(rows)||rows.some(s=>!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||(s.capturedAt!==undefined&&!Number.isFinite(Date.parse(s.capturedAt)))||!Number.isInteger(s.level)||!Number.isFinite(s.passed)||!Array.isArray(s.levels))) throw new Error('The published snapshot file is invalid.');
    setHistory(rows.toSorted((a,b)=>snapshotTime(a)-snapshotTime(b)));
   }catch(e){if(!controller.signal.aborted)setError(e.message)}finally{if(!controller.signal.aborted)setBusy(false)}
  }
  load();
  return()=>controller.abort();
 },[]);
 const latest=history.at(-1), prediction=forecast(history), current=latest?.levels.find(l=>l.level===latest.level), target=current?Math.ceil(current.total*.9):0;
 return <main><header>
 {theme==='blog'&&<span className="mf-mark" aria-hidden="true">MF</span>}
 <a className="brand" href={theme==='default'?'.':`?theme=${theme}`}>{theme==='tokyo'&&<span className="transit-symbol" aria-hidden="true"><svg viewBox="0 0 40 48" width="40" height="48" fill="currentColor"><rect x="5" y="2" width="30" height="36" rx="7"/><rect x="10" y="10" width="20" height="13" rx="2" fill="#ffd000"/><rect x="15" y="5" width="10" height="2" fill="#ffd000"/><circle cx="12" cy="30" r="3" fill="#ffd000"/><circle cx="28" cy="30" r="3" fill="#ffd000"/><path d="M11 36h5l-6 10H5zm13 0h5l6 10h-5z"/></svg></span>}{theme==='default'?'kanji / horizon':'Kanji Horizon'}{theme==='tokyo'&&<small lang="ja">漢字の旅</small>}</a>
 <span className="update-label">Updated twice daily</span>
 {theme==='blog'&&<nav className="blog-nav" aria-label="Page sections"><a href="#progress">Progress</a><a href="#levels">Levels</a><a href="#snapshots">Snapshots</a></nav>}
 </header>
 <div className="heading"><div><p className="eyebrow">YOUR WANIKANI TIMELINE</p><h1>A little closer, every day.</h1></div></div>
 {latest&&<><section className="hero" id="progress"><div>{theme==='tokyo'&&<div className="station-journey" aria-label={`Current level ${latest.level}${latest.level<60?`, next level ${latest.level+1}`:''}`}><span className="station-badge"><small>K</small>{String(latest.level).padStart(2,'0')}</span>{latest.level<60&&<><span className="journey-arrow" aria-hidden="true">→</span><span className="station-badge"><small>K</small>{String(latest.level+1).padStart(2,'0')}</span></>}</div>}<p className="eyebrow">{latest.level===60?'LEVEL 60 REACHED':`NEXT UP · LEVEL ${latest.level+1}`}</p><h2>{latest.level===60?'You made it.':date(prediction.milestones[0]?.date)}</h2><p>{prediction.rate===null?'Waiting for at least two snapshots at different times within the past 28 days to estimate your pace.':prediction.rate===0?'No new Guru kanji in the recorded window. Dates will appear once your count increases.':`At your recent pace of ${prediction.rate.toFixed(1)} new Guru kanji per day.`}</p></div><div className="count"><strong>{latest.passed}</strong><span>kanji reached Guru</span></div></section>
 {current&&<section className="progress"><div><h3>Level {latest.level} progress</h3><span>{current.passed} / {target} kanji to pass this level</span></div><progress max={target||1} value={Math.min(current.passed,target)}/><p>{Math.max(0,target-current.passed)} more current-level kanji to reach the 90% threshold.</p></section>}
 <ProgressChart history={history}/>
 <section id="levels"><div className="section-title"><h3>Levels ahead</h3><span>Estimated at your recent pace</span></div>{prediction.milestones.length?<div className="milestones">{prediction.milestones.slice(0,6).map((m,i)=><article key={m.level}><span className="level">{theme==='tokyo'&&<small>K</small>}{String(m.level).padStart(2,'0')}</span><div><h3>Level {m.level}</h3><p>{m.remaining} more kanji across the intervening levels</p></div><strong>{m.date?date(m.date):'—'}</strong>{i===0&&<span className="next">NEXT</span>}</article>)}</div>:<p>No further levels to forecast.</p>}</section>
 <section id="snapshots"><div className="section-title"><h3>Snapshots</h3><span>{history.length} recorded checks</span></div><div className="history">{history.slice(-14).reverse().map((s,i,rows)=><div key={snapshotKey(s)}><span>{snapshotLabel(s)}</span><strong>{s.passed} kanji</strong><span>{rows[i+1]?`${s.passed-rows[i+1].passed>=0?'+':''}${s.passed-rows[i+1].passed} since previous check`:'First recorded count'}</span></div>)}</div></section>
 <footer>Last checked {snapshotLabel(latest)} · Pace uses up to 28 days of snapshots.<p>These are pace estimates, not guaranteed unlock dates. Each level requires 90% of its own kanji to reach Guru. Radical unlocks, review timing, and lesson choices can change your actual date. Kanji stay counted after reaching Guru, even if they later fall back to Apprentice.</p><p>Progress is collected by the daily workflow. This page only displays published snapshots.</p></footer></>}
 {!busy&&!error&&!latest&&<p>No daily snapshots have been published yet.</p>}{busy&&<p role="status">Loading published snapshots…</p>}{error&&<p className="error" role="alert">{error}</p>}</main>
}
createRoot(document.getElementById('root')).render(<App/>);
