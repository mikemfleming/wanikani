import React from 'react';

const labelDate = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, {month:'short', day:'numeric', timeZone:'UTC'});

export default function ProgressChart({history}) {
  if (!history.length) return null;
  const width = 800, height = 300;
  const plot = {left:58, right:24, top:25, bottom:48};
  const innerWidth = width - plot.left - plot.right;
  const innerHeight = height - plot.top - plot.bottom;
  const start = Date.parse(history[0].date), end = Date.parse(history.at(-1).date);
  const maximum = Math.max(1, ...history.map(s => s.passed));
  // Round the vertical scale to whole kanji, always starting at zero.
  const step = Math.max(1, Math.ceil(maximum / 4));
  const ceiling = step * 4;
  const x = s => plot.left + (end === start ? innerWidth / 2 : (Date.parse(s.date) - start) / (end - start) * innerWidth);
  const y = s => plot.top + innerHeight * (1 - s.passed / ceiling);
  const points = history.map(s => `${x(s)},${y(s)}`).join(' ');
  const ticks = [...new Set([0, Math.floor((history.length - 1) / 2), history.length - 1])];
  return <section aria-labelledby="progress-chart-heading">
    <div className="section-title"><h3 id="progress-chart-heading">Kanji reached Guru over time</h3><span>All recorded dates · UTC</span></div>
    <figure className="progress-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-title chart-description">
        <title id="chart-title">Total kanji reached Guru by date</title>
        <desc id="chart-description">{history.length === 1 ? `One snapshot: ${history[0].passed} kanji on ${labelDate(history[0].date)}. A line will appear after the next recorded date.` : `${history.length} snapshots, from ${history[0].passed} kanji on ${labelDate(history[0].date)} to ${history.at(-1).passed} on ${labelDate(history.at(-1).date)}. Exact recent counts are listed below in Daily snapshots.`}</desc>
        {Array.from({length:5}, (_, i) => {
          const value = step * i;
          const top = plot.top + innerHeight * (1 - value / ceiling);
          return <g key={value}><line className="chart-grid" x1={plot.left} x2={width-plot.right} y1={top} y2={top}/><text className="chart-label" x={plot.left-12} y={top+4} textAnchor="end">{value}</text></g>;
        })}
        {ticks.map(i => <text key={history[i].date} className="chart-label" x={x(history[i])} y={height-17} textAnchor="middle">{labelDate(history[i].date)}</text>)}
        {history.length > 1 && <polyline className="chart-line" points={points}/>}
        {history.map(s => <circle key={s.date} className="chart-point" cx={x(s)} cy={y(s)} r={history.length > 60 ? 2.5 : 4} tabIndex="0" aria-label={`${s.date}: ${s.passed} kanji reached Guru`}><title>{`${s.date}: ${s.passed} kanji reached Guru`}</title></circle>)}
      </svg>
      <figcaption>{history.length === 1 ? 'Your first recorded count. The line will grow with each daily snapshot.' : 'Each point is a daily snapshot. Gaps between checks are connected; no extra snapshots are created.'}</figcaption>
    </figure>
  </section>;
}
