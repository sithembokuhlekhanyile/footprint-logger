const { addDays, weekStart } = require('./dates');
const { CATEGORIES } = require('../../public/js/factors');

const round = (n) => Math.round(n * 100) / 100;

function sum(list) {
  return round(list.reduce((acc, a) => acc + a.co2, 0));
}

function totalsByCategory(list) {
  const totals = {};
  Object.keys(CATEGORIES).forEach((c) => { totals[c] = 0; });
  list.forEach((a) => { totals[a.category] = (totals[a.category] || 0) + a.co2; });
  Object.keys(totals).forEach((c) => { totals[c] = round(totals[c]); });
  return totals;
}

function inRange(list, from, to) {
  return list.filter((a) => a.day >= from && a.day <= to);
}

// Emissions per day for the `days` days ending on `today`.
function dailySeries(list, today, days = 7) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, total: sum(list.filter((a) => a.day === day)) });
  }
  return out;
}

// Monday-based weekly totals for the last `weeks` weeks, oldest first.
function weeklySummaries(list, today, weeks = 6) {
  const current = weekStart(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const end = addDays(start, 6);
    const items = inRange(list, start, end);
    const activeDays = new Set(items.map((a) => a.day)).size;
    out.push({
      weekStart: start,
      weekEnd: end,
      total: sum(items),
      entries: items.length,
      activeDays,
      byCategory: totalsByCategory(items)
    });
  }
  return out;
}

// Consecutive days with at least one log. A streak stays alive until the
// end of today, so a run that ended yesterday still counts.
function streak(list, today) {
  const days = new Set(list.map((a) => a.day));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  sorted.forEach((d) => {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  });

  return { current, longest, loggedToday: days.has(today) };
}

function topActivities(list, limit = 3) {
  const map = {};
  list.forEach((a) => {
    const k = a.activityKey || 'custom:' + a.label;
    if (!map[k]) map[k] = { activityKey: a.activityKey, label: a.label, category: a.category, co2: 0, quantity: 0, unit: a.unit, entries: 0 };
    map[k].co2 += a.co2;
    map[k].quantity += a.quantity || 0;
    map[k].entries++;
  });
  return Object.values(map)
    .map((x) => ({ ...x, co2: round(x.co2), quantity: round(x.quantity) }))
    .sort((a, b) => b.co2 - a.co2)
    .slice(0, limit);
}

module.exports = { round, sum, totalsByCategory, inRange, dailySeries, weeklySummaries, streak, topActivities };
