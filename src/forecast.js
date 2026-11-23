export const day = 86400000;
export function snapshot(data, now = new Date()) {
  const visible = data.subjects.filter(s => s.object === 'kanji' && !s.data.hidden_at);
  const assignments = new Map(data.assignments.filter(a => !a.data.hidden).map(a => [a.data.subject_id, a.data]));
  return { date: now.toISOString().slice(0, 10), account: data.user.id, level: data.user.level,
    capturedAt: now.toISOString(),
    lessonsCompleted: data.assignments.filter(a => !a.data.hidden && a.data.started_at).length,
    passed: visible.filter(s => assignments.get(s.id)?.passed_at).length,
    levels: Array.from({length: 60}, (_, i) => {
      const kanji = visible.filter(s => s.data.level === i + 1);
      return { level: i + 1, total: kanji.length, passed: kanji.filter(s => assignments.get(s.id)?.passed_at).length };
    }) };
}
export function record(history, entry) {
  // A level reset or reduced passed count starts a new series.
  let entries = history.filter(s => s.account === entry.account && s.date <= entry.date).sort((a,b) => a.date.localeCompare(b.date));
  const previous = entries.filter(s => s.date < entry.date).at(-1);
  if (previous && (previous.level > entry.level || previous.passed > entry.passed)) entries = [];
  return [...entries.filter(s => s.date !== entry.date), entry].slice(-366);
}
export function forecast(history) {
  const latest = history.at(-1);
  if (!latest) return { rate: null, milestones: [] };
  const recent = history.filter(s => s.account === latest.account && Date.parse(s.date) >= Date.parse(latest.date) - 28 * day);
  const first = recent[0];
  const elapsed = (Date.parse(latest.date) - Date.parse(first.date)) / day;
  const rate = elapsed > 0 ? Math.max(0, latest.passed - first.passed) / elapsed : null;
  let remaining = 0;
  const milestones = latest.levels.filter(l => l.level >= latest.level && l.level < 60 && l.total > 0).map(l => {
    remaining += Math.max(0, Math.ceil(l.total * .9) - l.passed);
    return { level: l.level + 1, remaining, date: rate > 0 ? new Date(Date.parse(latest.date) + Math.ceil(remaining / rate) * day).toISOString().slice(0,10) : null };
  });
  return { rate, elapsed, milestones };
}
