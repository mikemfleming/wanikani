import React, {useId, useState} from 'react';
import {axis, increase} from './chart-data.js';
const labelDate = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, {month:'short', day:'numeric', timeZone:'UTC'});
const valid = value => Number.isFinite(value);

function LineChart({history, title, series, note, zero=false}) {
  const id=useId();
  const [active,setActive]=useState(null);
  const width=800,height=340,left=64,right=series.length>1?76:32,top=38,bottom=52;
  const innerWidth=width-left-right, innerHeight=height-top-bottom;
  const start=Date.parse(history[0].date),end=Date.parse(history.at(-1).date);
  const x=s=>left+(end===start?innerWidth/2:(Date.parse(s.date)-start)/(end-start)*innerWidth);
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
   <div className="section-title"><h3 id={`${id}-heading`}>{title}</h3><span>Recorded dates · UTC</span></div>
   <figure className="progress-chart">
    <div className="chart-legend">{series.map((s,i)=><span key={s.key}><i className={`chart-key chart-series-${i}`}/>{s.label}{series.length>1?` (${i===0?'left':'right'} axis)`:''}</span>)}</div>
    <svg viewBox={`0 0 ${width} ${height}`} aria-labelledby={`${id}-title`}>
     <title id={`${id}-title`}>{title}. Hover, focus, or tap a point for exact counts.</title>
     {scales[0].ticks.map(value=>{const yy=top+innerHeight*(1-(value-scales[0].min)/(scales[0].max-scales[0].min));return <g key={value}><line className="chart-grid" x1={left} x2={width-right} y1={yy} y2={yy}/><text className="chart-label" x={left-12} y={yy+4} textAnchor="end">{value}</text></g>})}
     {series.length>1&&scales[1].ticks.map(value=>{const yy=top+innerHeight*(1-(value-scales[1].min)/(scales[1].max-scales[1].min));return <text key={value} className="chart-label chart-axis-secondary" x={width-right+12} y={yy+4}>{value}</text>})}
     {ticks.map(i=><text key={history[i].date} className="chart-label" x={x(history[i])} y={height-19} textAnchor="middle">{labelDate(history[i].date)}</text>)}
     {series.map((s,j)=><g key={s.key} className={`chart-series-${j}`}>
      {lines[j].map((points,i)=>points.length>1&&<polyline key={i} className={`chart-line ${j===1?'chart-secondary':''}`} points={points.join(' ')}/>)}
      {history.map((h,i)=>valid(h[s.key])&&<g key={h.date}>
       <circle className={`chart-point ${j===1?'chart-secondary':''}`} cx={x(h)} cy={y(h,j)} r="4"/>
       <circle className="chart-hit" cx={x(h)} cy={y(h,j)} r="12" tabIndex="0" role="button" aria-label={`${h.date}. ${detail(s,i)}`} onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)} onClick={()=>setActive(i)} onKeyDown={e=>{if(e.key==='Escape')setActive(null);if(e.key==='Enter'||e.key===' '){e.preventDefault();setActive(i)}}}><title>{`${h.date}: ${detail(s,i)}`}</title></circle>
      </g>)}
     </g>)}
     {active!==null&&<g className="chart-tooltip" pointerEvents="none" transform={`translate(${Math.min(width-365,Math.max(left,x(history[active])-170))},${top+8})`}>
      <rect width="330" height={34+series.length*23} rx="4"/>
      <text x="12" y="21" fontWeight="700">{history[active].date}</text>
      {series.map((s,i)=><text key={s.key} x="12" y={44+i*23}>{s.label}: {valid(history[active][s.key])?history[active][s.key].toLocaleString():'Not recorded'}</text>)}
     </g>}
    </svg>
    <figcaption>{note}</figcaption>
   </figure>
  </section>;
}
export default function ProgressChart({history}) {
 if(!history.length)return null;
 const hasLessons=history.some(s=>valid(s.lessonsCompleted));
 return <>
  <LineChart history={history} title="Kanji reached Guru & lessons completed" series={[{key:'passed',label:'Kanji reached Guru'},{key:'lessonsCompleted',label:'Lessons completed'}]} note={`Cumulative totals. Each axis fits its own recorded range; compare changes using the labeled axes. Lessons include radicals, kanji, and vocabulary.${hasLessons?'':' Lesson tracking begins with the next daily workflow run.'}`}/>
 </>;
}
