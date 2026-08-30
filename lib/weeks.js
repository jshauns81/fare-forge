const DAY_MS = 24 * 60 * 60 * 1000;

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_ABBR = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Monday-of-week for a date, as a UTC-anchored YYYY-MM-DD string.
export function weekStartOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return toISODate(d);
}

export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(iso) {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function isValidWeekStart(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
  const d = parseISODate(iso);
  return !Number.isNaN(d.getTime()) && (d.getUTCDay() + 6) % 7 === 0;
}

export function shiftWeek(weekStart, weeks) {
  const d = parseISODate(weekStart);
  return toISODate(new Date(d.getTime() + weeks * 7 * DAY_MS));
}

export function dayDate(weekStart, day) {
  return new Date(parseISODate(weekStart).getTime() + day * DAY_MS);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "March 2 – 8" or "Aug 31 – Sep 6" across a month boundary.
export function weekLabel(weekStart) {
  const start = parseISODate(weekStart);
  const end = dayDate(weekStart, 6);
  const sm = MONTHS[start.getUTCMonth()];
  const em = MONTHS[end.getUTCMonth()];
  if (sm === em) return `${sm} ${start.getUTCDate()} – ${end.getUTCDate()}`;
  return `${sm.slice(0, 3)} ${start.getUTCDate()} – ${em.slice(0, 3)} ${end.getUTCDate()}`;
}

export function isCurrentWeek(weekStart) {
  return weekStart === weekStartOf();
}
