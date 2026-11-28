export const day = 86400000;
export const snapshotTime = s => Date.parse(s.capturedAt || s.date);
export const snapshotKey = s => s.capturedAt || s.date;
export function snapshotLabel(s) {
  if (!s.capturedAt) return `${s.date} (time unavailable)`;
  return new Date(s.capturedAt).toLocaleString('en-US', {timeZone:'America/Chicago', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short'});
}
export function snapshot(data, now = new Date()) {
  const visible = data.subjects.filter(s => s.object === 'kanji' && !s.data.hidden_at);
  const assignments = new Map(data.assignments.filter(a => !a.data.hidden).map(a => [a.data.subject_id, a.data]));
  return { date: now.toISOString().slice(0, 10), account: data.user.id, level: data.user.level,
    capturedAt: now.toISOString(),
    lessonsCompleted: data.assignments.filter(a => !a.data.hidden && a.data.started_at).length,
    // Review statistics expose per-subject answer counts, not a review-event history.
    // Count each meaning/reading prompt once, whether it was right or wrong.
    reviewsCompleted: (data.statistics || []).reduce((total, item) => total +
      ['meaning_correct', 'meaning_incorrect', 'reading_correct', 'reading_incorrect']
        .reduce((sum, key) => sum + (Number(item.data[key]) || 0), 0), 0),
    passed: visible.filter(s => assignments.get(s.id)?.passed_at).length,
    levels: Array.from({length: 60}, (_, i) => {
      const kanji = visible.filter(s => s.data.level === i + 1);
      return { level: i + 1, total: kanji.length, passed: kanji.filter(s => assignments.get(s.id)?.passed_at).length };
    }) };
}
export function record(history, entry) {
  // Keep each timestamped check, including multiple checks on the same date.
  const now = snapshotTime(entry);
  let entries = history.filter(s => s.account === entry.account && snapshotTime(s) <= now && snapshotTime(s) >= now - 366 * day).sort((a,b) => snapshotTime(a)-snapshotTime(b));
  const previous = entries.filter(s => snapshotKey(s) !== snapshotKey(entry)).at(-1);
  if (previous && (previous.level > entry.level || previous.passed > entry.passed)) entries = [];
  return [...entries.filter(s => snapshotKey(s) !== snapshotKey(entry)), entry].slice(-1500);
}
export function forecast(history) {
  const latest = history.at(-1);
  if (!latest) return { rate: null, milestones: [] };
  const recent = history.filter(s => s.account === latest.account && snapshotTime(s) >= snapshotTime(latest) - 28 * day);
  const first = recent[0];
  const elapsed = (snapshotTime(latest) - snapshotTime(first)) / day;
  const rate = elapsed > 0 ? Math.max(0, latest.passed - first.passed) / elapsed : null;
  let remaining = 0;
  const milestones = latest.levels.filter(l => l.level >= latest.level && l.level < 60 && l.total > 0).map(l => {
    remaining += Math.max(0, Math.ceil(l.total * .9) - l.passed);
    return { level: l.level + 1, remaining, date: rate > 0 ? new Date(snapshotTime(latest) + Math.ceil(remaining / rate) * day).toISOString().slice(0,10) : null };
  });
  return { rate, elapsed, milestones };
}
