export function axis(values, zero = false) {
  const valid = values.filter(Number.isFinite);
  const min = valid.length ? Math.min(...valid) : 0;
  const max = valid.length ? Math.max(...valid) : 1;
  const padding = Math.max(1, (max - min) * .12);
  const lower = zero ? 0 : Math.max(0, min - padding);
  const upper = Math.max(lower + 4, max + padding);
  const raw = (upper - lower) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(n => n * power).find(n => n >= raw && n >= 1) || 1;
  const bottom = Math.floor(lower / step) * step;
  const top = Math.ceil(upper / step) * step;
  return {min:bottom, max:top, ticks:Array.from({length:Math.round((top-bottom)/step)+1},(_,i)=>bottom+i*step)};
}
export function increase(history, index, key) {
  const current = history[index]?.[key], previous = history[index-1]?.[key];
  return Number.isFinite(current) && Number.isFinite(previous) && current >= previous ? current - previous : null;
}
