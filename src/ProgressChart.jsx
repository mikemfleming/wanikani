import React, {useId, useState} from 'react';
import {axis, increase, levelUps} from './chart-data.js';
import {snapshotTime, snapshotKey, snapshotLabel} from './forecast.js';
const labelDate = s => s.capturedAt ? new Date(s.capturedAt).toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',timeZone:'America/Chicago'}) : s.date;
const valid = value => Number.isFinite(value);

function LineChart({history, title, series, note, zero=false}) {
  const id=useId();
  const [active,setActive]=useState(null);
  const markers=levelUps(history);
  const width=800,height=340,left=64,right=series.length>2?122:series.length>1?76:32,top=markers.length?82:38,bottom=52;
  const innerWidth=width-left-right, innerHeight=height-top-bottom;
  const start=snapshotTime(history[0]),end=snapshotTime(history.at(-1));
  const x=s=>left+(end===start?innerWidth/2:(snapshotTime(s)-start)/(end-start)*innerWidth);
  const scales=series.map(s=>axis(history.map(h=>h[s.key]),zero));
  const y=(s,i)=>top+innerHeight*(1-(s[series[i].key]-scales[i].min)/(scales[i].max-scales[i].min));
  const ticks=[...new Set([0,Math.floor((history.length-1)/2),history.length-1])];
  const lines=series.map((s,i)=>{
    const segments=[];let segment=[];
    history.forEach(h=>{if(valid(h[s.key]))segment.push(`${x(h)},${y(h,i)}`);else if(segment.length){segments.push(segment);segment=[]}});
    if(segment.length)segments.push(segment);
    return segments;
  });
  const detail=(s,index)=>{
    const h=history[index];if(!valid(h[s.key]))return `${s.label}: not recorded`;
    const delta=increase(history,index,s.key);
    return `${s.label}: ${h[s.key].toLocaleString()}${delta===null?'':` (+${delta} since previous snapshot)`}`;
  };
  return <section aria-labelledby={`${id}-heading`}>
   <div className="section-title"><h3 id={`${id}-heading`}>{title}</h3><span>Recorded times · Central</span></div>
   <figure className="progress-chart">
    <div className="chart-legend">{series.map((s,i)=><span key={s.key}><i className={`chart-key chart-series-${i}`}/>{s.label}{series.length>1?` (${i===0?'left':`right ${i}`})`:''}</span>)}</div>
    <div className="chart-level-note">Starting level: {history[0].level}{markers.length>0?' · Dashed markers show the first snapshot at a higher level.':''}</div>
    <svg viewBox={`0 0 ${width} ${height}`} aria-labelledby={`${id}-title`}>
     <title id={`${id}-title`}>{title}. Hover, focus, or tap a point for exact counts.</title>
     {scales[0].ticks.map(value=>{const yy=top+innerHeight*(1-(value-scales[0].min)/(scales[0].max-scales[0].min));return <g key={value}><line className="chart-grid" x1={left} x2={width-right} y1={yy} y2={yy}/><text className="chart-label" x={left-12} y={yy+4} textAnchor="end">{value}</text></g>})}
     {series.slice(1).map((s,k)=>scales[k+1].ticks.map(value=>{const yy=top+innerHeight*(1-(value-scales[k+1].min)/(scales[k+1].max-scales[k+1].min));return <text key={`${s.key}-${value}`} className={`chart-label chart-axis-secondary chart-axis-series-${k+1}`} x={width-right+10+k*42} y={yy+4}>{value}</text>}))}
     {ticks.map(i=><text key={snapshotKey(history[i])} className="chart-label" x={x(history[i])} y={height-19} textAnchor="middle">{labelDate(history[i])}</text>)}
     {markers.map(({snapshot,index},i)=>{
      const position=x(snapshot);
      const close=i>0&&position-x(markers[i-1].snapshot)<90;
      const labelY=top-14-(close?(i%3)*20:0);
      return <g key={snapshotKey(snapshot)} className="chart-level-marker">
       <title>{`Level ${snapshot.level} first observed ${snapshotLabel(snapshot)}. Actual level-up occurred since the previous snapshot.`}</title>
       <line x1={position} x2={position} y1={labelY+5} y2={height-bottom}/>
       <text x={position} y={labelY} textAnchor={position>width-right-50?'end':'start'}>Level {snapshot.level}</text>
      </g>;
     })}
     {series.map((s,j)=><g key={s.key} className={`chart-series-${j}`}>
      {lines[j].map((points,i)=>points.length>1&&<polyline key={i} className={`chart-line ${j>0?'chart-secondary':''} chart-series-line-${j}`} points={points.join(' ')}/>)}
      {history.map((h,i)=>valid(h[s.key])&&<g key={snapshotKey(h)}>
       <circle className={`chart-point ${j>0?'chart-secondary':''} chart-series-point-${j}`} cx={x(h)} cy={y(h,j)} r="4"/>
       <circle className={`chart-hit chart-series-hit-${j}`} cx={x(h)} cy={y(h,j)} r="12" tabIndex="0" role="button" aria-label={`${snapshotLabel(h)}. Level ${h.level}. ${detail(s,i)}`} onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)} onClick={()=>setActive(i)} onKeyDown={e=>{if(e.key==='Escape')setActive(null);if(e.key==='Enter'||e.key===' '){e.preventDefault();setActive(i)}}}><title>{`${snapshotLabel(h)}. Level ${h.level}: ${detail(s,i)}`}</title></circle>
      </g>)}
     </g>)}
     {active!==null&&<g className="chart-tooltip" pointerEvents="none" transform={`translate(${Math.min(width-365,Math.max(left,x(history[active])-170))},${top+8})`}>
      <rect width="330" height={57+series.length*23} rx="4"/>
      <text x="12" y="21" fontWeight="700">{snapshotLabel(history[active])}</text>
      <text x="12" y="44">Level {history[active].level}</text>
      {series.map((s,i)=><text key={s.key} x="12" y={67+i*23}>{s.label}: {valid(history[active][s.key])?history[active][s.key].toLocaleString():'Not recorded'}</text>)}
     </g>}
    </svg>
    <figcaption>{note}</figcaption>
   </figure>
  </section>;
}
export default function ProgressChart({history}) {
 if(!history.length)return null;
 const hasLessons=history.some(s=>valid(s.lessonsCompleted));
 const hasReviews=history.some(s=>valid(s.reviewsCompleted));
 return <>
  <LineChart history={history} title="Kanji reached Guru, lessons & reviews completed" series={[{key:'passed',label:'Kanji reached Guru'},{key:'lessonsCompleted',label:'Lessons completed'},{key:'reviewsCompleted',label:'Reviews completed'}]} note={`Cumulative totals. Each line uses its own labeled axis. Reviews count meaning and reading answers, including incorrect answers; one review item can count as two answers. Lessons include radicals, kanji, and vocabulary. Level-up markers show when a new level was first observed, not its exact unlock time.${hasLessons?'':' Lesson tracking begins with the next daily workflow run.'}${hasReviews?'':' Review tracking begins with the next daily workflow run; older totals cannot be reconstructed.'}`}/>
 </>;
}
