// Date helpers that work on plain 'YYYY-MM-DD' day strings so that
// grouping by day and week never depends on the server's time zone.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDay(value) {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toDay(date) {
  return date.toISOString().slice(0, 10);
}

function todayLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return toDay(local);
}

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

// Weeks start on Monday.
function weekStart(day) {
  const d = new Date(day + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

module.exports = { isDay, toDay, todayLocal, addDays, weekStart, daysBetween };
