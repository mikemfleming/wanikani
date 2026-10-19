export const DEFAULT_SETTINGS = { dailyMinutes: 20, sessionsPerDay: 2, maxSessionReviews: 20, reviewsPerMinute: 2, repeatAllowance: 10 };
export const PLAN_KEY = 'recovery-plan:v1';
export function dayStart(value = Date.now(), offset = 0) {
  const date = new Date(value); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + offset); return date;
}
export function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validSettings(input) {
  const bounds = {dailyMinutes:[5,120], sessionsPerDay:[1,6], maxSessionReviews:[1,100], reviewsPerMinute:[0.25,10], repeatAllowance:[0,200]};
  const result = {};
  for (const [key,[min,max]] of Object.entries(bounds)) {
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < min || value > max || (key !== 'reviewsPerMinute' && !Number.isInteger(value))) throw new Error(`Check ${key.replace(/([A-Z])/g,' $1').toLowerCase()}: enter ${min}–${max}.`);
    result[key] = value;
  }
  return result;
}
export function newPlan() { return {settings:{...DEFAULT_SETTINGS}, sessions:[], active:null}; }
export function normalizePlan(value) {
  if (!value) return newPlan();
  try {
    return { settings:validSettings(value.settings), sessions:Array.isArray(value.sessions) ? value.sessions.filter(s=>s.id && Number.isInteger(s.reviews) && s.reviews >= 0 && s.reviews <= 1000 && Number.isFinite(s.minutes) && s.minutes > 0 && Number.isFinite(Date.parse(s.completedAt))).slice(-100) : [], active:value.active && Number.isFinite(Date.parse(value.active.startedAt)) && value.active.target > 0 ? value.active : null };
  } catch { return newPlan(); }
}
export function sessionCapacity(settings) {
  return Math.max(1, Math.min(settings.maxSessionReviews, Math.floor(settings.dailyMinutes / settings.sessionsPerDay * settings.reviewsPerMinute)));
}
export function measuredPace(sessions) {
  const recent = sessions.filter(s=>s.reviews>0 && s.minutes>0).slice(-5);
  if (recent.length<2) return null;
  return Math.min(10,Math.max(0.25, Math.round(recent.reduce((sum,s)=>sum+s.reviews,0)/recent.reduce((sum,s)=>sum+s.minutes,0)*100)/100));
}
export function completedOn(sessions, value = Date.now()) {
  const start = dayStart(value).getTime(), end = dayStart(value,1).getTime();
  return [...new Map(sessions.map(s=>[s.id,s])).values()].filter(s=>{const at=Date.parse(s.completedAt);return at>=start&&at<end&&at<=Number(new Date(value));}).reduce((sum,s)=>sum+s.reviews,0);
}
export function dailyCapacity(settings) {
  return Math.min(sessionCapacity(settings)*settings.sessionsPerDay, Math.floor(settings.dailyMinutes*settings.reviewsPerMinute));
}
export function reviewQueue(assignments) {
  return assignments.filter(a=>!a.data.hidden && a.data.srs_stage>=1 && a.data.srs_stage<9 && a.data.available_at && Number.isFinite(Date.parse(a.data.available_at)));
}
export function forecast(assignments, settings, completedToday = 0, now = Date.now()) {
  const queue = reviewQueue(assignments);
  let backlog = queue.filter(a=>Date.parse(a.data.available_at)<=now).length;
  const initialBacklog = backlog, perSession = sessionCapacity(settings), dailyTarget = dailyCapacity(settings);
  const rows = [];
  let hasStudyWork = initialBacklog > 0 || completedToday > 0;
  for(let i=0;i<7;i++) {
    const start = i===0 ? now : dayStart(now,i).getTime(), end=dayStart(now,i+1).getTime();
    const arrivals=queue.filter(a=>{const at=Date.parse(a.data.available_at);return at>now&&at>=start&&at<end;}).length;
    const repeats = queue.length && (hasStudyWork || arrivals > 0) ? Math.ceil(settings.repeatAllowance * (i===0 ? (end-now)/(end-dayStart(now).getTime()) : 1)) : 0;
    const capacity = i===0 ? Math.max(0,dailyTarget-completedToday) : dailyTarget;
    const planned = Math.min(capacity,backlog+arrivals+repeats);
    if (planned > 0) hasStudyWork = true;
    const opening = backlog;
    backlog = Math.max(0,backlog+arrivals+repeats-planned);
    rows.push({day:dayKey(dayStart(now,i)),date:dayStart(now,i).toISOString(),opening,arrivals,repeats,planned,backlog});
  }
  return {initialBacklog,perSession,dailyTarget,sessionSlots:Math.ceil(dailyTarget/perSession),remainingToday:Math.max(0,dailyTarget-completedToday),rows};
}
export async function readPlan(client) {
  return normalizePlan(await client.cache.get(`${client.account}:${PLAN_KEY}`));
}
export async function updatePlan(client, update) {
  return client.lock(`ko:plan:${client.account}`,async()=>{
    client.signal.throwIfAborted();
    const next = normalizePlan(await update(await readPlan(client)));
    client.signal.throwIfAborted();
    await client.cache.set(`${client.account}:${PLAN_KEY}`,next);
    return next;
  });
}
