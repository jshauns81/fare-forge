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
  if (Number.isNaN(d.getTime())) return false;
  // Round-trip so an impossible date that Date.UTC normalizes onto a Monday
  // ("2026-02-30" → Mar 2) can't become a plan key that never renders.
  return toISODate(d) === iso && (d.getUTCDay() + 6) % 7 === 0;
}

export function shiftWeek(weekStart, weeks) {
  const d = parseISODate(weekStart);
  return toISODate(new Date(d.getTime() + weeks * 7 * DAY_MS));
}

export function dayDate(weekStart, day) {
  return new Date(parseISODate(weekStart).getTime() + day * DAY_MS);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "March 2 – 8", or "Aug 31 – Sep 6" across a month boundary; spanWeeks=2
// stretches the range over the fortnight ("March 2 – 15").
export function spanLabel(weekStart, spanWeeks = 1) {
  const start = parseISODate(weekStart);
  const end = dayDate(shiftWeek(weekStart, spanWeeks - 1), 6);
  const sm = MONTHS[start.getUTCMonth()];
  const em = MONTHS[end.getUTCMonth()];
  if (sm === em) return `${sm} ${start.getUTCDate()} – ${end.getUTCDate()}`;
  return `${sm.slice(0, 3)} ${start.getUTCDate()} – ${em.slice(0, 3)} ${end.getUTCDate()}`;
}

export function weekLabel(weekStart) {
  return spanLabel(weekStart, 1);
}

export function isCurrentWeek(weekStart) {
  return weekStart === weekStartOf();
}

// "This week" / "Next week" / "Last week", or null for anything further out.
export function relativeWeekName(weekStart, ref = new Date()) {
  const cur = weekStartOf(ref);
  if (weekStart === cur) return 'This week';
  if (weekStart === shiftWeek(cur, 1)) return 'Next week';
  if (weekStart === shiftWeek(cur, -1)) return 'Last week';
  return null;
}
