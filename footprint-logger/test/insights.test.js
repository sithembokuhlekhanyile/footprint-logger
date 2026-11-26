const test = require('node:test');
const assert = require('node:assert/strict');
const { weekStart, addDays, isDay } = require('../src/services/dates');
const stats = require('../src/services/stats');
const { buildInsights } = require('../src/services/insights');
const { parseActivity } = require('../src/services/validate');

const entry = (day, category, co2, extra = {}) => ({ day, category, co2, label: extra.label || category, activityKey: extra.activityKey || null, quantity: extra.quantity || 1, unit: 'km' });

test('date helpers use Monday-based weeks', () => {
  assert.equal(weekStart('2026-11-26'), '2026-11-23'); // Thursday -> Monday
  assert.equal(weekStart('2026-11-23'), '2026-11-23');
  assert.equal(weekStart('2026-11-29'), '2026-11-23'); // Sunday
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(isDay('2026-02-30'), false);
  assert.equal(isDay('2026-11-26'), true);
});

test('totals, daily series and weekly summaries', () => {
  const list = [entry('2026-11-26', 'food', 7.7), entry('2026-11-26', 'transport', 3.8), entry('2026-11-20', 'energy', 9.5)];
  assert.equal(stats.sum(list), 21);
  assert.deepEqual(stats.totalsByCategory(list), { transport: 3.8, food: 7.7, energy: 9.5 });
  const daily = stats.dailySeries(list, '2026-11-26', 7);
  assert.equal(daily.length, 7);
  assert.equal(daily[6].total, 11.5);
  const weekly = stats.weeklySummaries(list, '2026-11-26', 2);
  assert.equal(weekly[0].weekStart, '2026-11-16');
  assert.equal(weekly[0].total, 9.5);
  assert.equal(weekly[1].total, 11.5);
});

test('streak counts consecutive days and survives until end of today', () => {
  const list = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25'].map((d) => entry(d, 'food', 1));
  const s = stats.streak(list, '2026-11-26');
  assert.equal(s.current, 4);
  assert.equal(s.loggedToday, false);
  assert.equal(stats.streak(list, '2026-11-28').current, 0);
  assert.equal(stats.streak(list.concat(entry('2026-11-01', 'food', 1)), '2026-11-25').longest, 4);
});

test('insight engine ranks categories and suggests tips with savings', () => {
  const list = [
    entry('2026-11-24', 'food', 23.1, { activityKey: 'beef_meal', label: 'Beef meal', quantity: 3 }),
    entry('2026-11-25', 'transport', 7.6, { activityKey: 'car_petrol', label: 'Car travel (petrol)', quantity: 40 }),
    entry('2026-11-25', 'energy', 4.75, { activityKey: 'electricity', label: 'Grid electricity', quantity: 5 })
  ];
  const ins = buildInsights(list, '2026-11-26', 10);
  assert.equal(ins.highestCategory, 'food');
  assert.equal(ins.categoryRanking[0].share, 65);
  assert.equal(ins.tips[0].activity, 'Beef meal');
  // 3 meals * 50% * (7.7 - 1.4) = 9.45 kg
  assert.equal(ins.tips[0].estimatedSavingKg, 9.45);
  assert.match(ins.weeklyGoal, /9.45 kg/);
  assert.equal(ins.goal.hasBaseline, false);
});

test('weekly goal compares this week with last week', () => {
  const list = [
    entry('2026-11-17', 'food', 50), // last week
    entry('2026-11-23', 'food', 10), // this week, Monday
    entry('2026-11-25', 'transport', 10)
  ];
  const ins = buildInsights(list, '2026-11-26', 10);
  assert.equal(ins.goal.baseline, 50);
  assert.equal(ins.goal.target, 45);
  assert.equal(ins.goal.current, 20);
  assert.equal(ins.goal.remaining, 25);
  assert.equal(ins.goal.status, 'on_track'); // expected by Thursday: 45 * 4/7 = 25.71

  const over = buildInsights(list.concat(entry('2026-11-26', 'energy', 30)), '2026-11-26', 10);
  assert.equal(over.goal.status, 'over');

  const history = buildInsights(list, '2026-12-01', 10).goalHistory;
  assert.equal(history.length, 1);
  assert.equal(history[0].met, true);
  assert.equal(history[0].changePercent, -60);
});

test('validation calculates CO2 on the server for catalogue activities', () => {
  const ok = parseActivity({ activityKey: 'car_petrol', quantity: 20, day: '2026-11-26', co2: 9999 });
  assert.equal(ok.value.co2, 3.8);
  assert.equal(ok.value.category, 'transport');
  assert.ok(parseActivity({ activityKey: 'nope', quantity: 1 }).error);
  assert.ok(parseActivity({ activityKey: 'bus', quantity: -1 }).error);
  assert.ok(parseActivity({ label: 'Braai', category: 'food', co2: 'x' }).error);
  assert.ok(parseActivity({ label: 'Braai', category: 'other', co2: 3 }).error);
  const custom = parseActivity({ label: 'Charcoal braai', category: 'food', co2: 6.456, day: '2026-11-26' });
  assert.equal(custom.value.co2, 6.46);
  assert.equal(custom.value.activityKey, null);
});
