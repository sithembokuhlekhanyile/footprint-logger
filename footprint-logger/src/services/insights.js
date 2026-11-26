// Insight engine: finds the highest-emission categories and activities,
// produces personalised tips with estimated savings, and tracks progress
// toward a weekly reduction goal.

const { byKey, CATEGORIES } = require('../../public/js/factors');
const { addDays, weekStart, daysBetween } = require('./dates');
const { round, sum, totalsByCategory, inRange, topActivities } = require('./stats');

// Each rule describes a realistic swap: replace `share` of the logged
// quantity with a lower-emission alternative.
const RULES = {
  car_petrol: { swapTo: 'bus', share: 0.3, text: 'Swap about a third of your petrol car kilometres for the bus, a lift club or a train.' },
  car_diesel: { swapTo: 'bus', share: 0.3, text: 'Share lifts or use public transport for a third of your diesel car trips.' },
  car_electric: { swapTo: 'cycling_walking', share: 0.2, text: 'Walk or cycle for your shortest electric car trips.' },
  motorbike: { swapTo: 'bus', share: 0.3, text: 'Use public transport for some of your regular motorbike routes.' },
  bus: { swapTo: 'cycling_walking', share: 0.15, text: 'Walk or cycle for short bus hops under 3 km.' },
  flight_short: { swapTo: 'train', share: 0.5, text: 'Replace one domestic flight with a train or long-distance bus, or hold the meeting online.' },
  beef_meal: { swapTo: 'chicken_meal', share: 0.5, text: 'Replace half of your beef meals with chicken, fish or beans.' },
  lamb_meal: { swapTo: 'chicken_meal', share: 0.5, text: 'Swap half of your lamb meals for poultry or a plant-based dish.' },
  pork_meal: { swapTo: 'vegetarian_meal', share: 0.4, text: 'Try a meat-free day to replace a few pork meals.' },
  chicken_meal: { swapTo: 'vegan_meal', share: 0.3, text: 'Make a third of your chicken meals plant-based, for example lentil curry or bean chilli.' },
  fish_meal: { swapTo: 'vegan_meal', share: 0.3, text: 'Swap some fish meals for plant-based protein.' },
  cheese: { swapTo: 'vegan_meal', share: 0.3, text: 'Cut back on cheese portions or try plant-based alternatives.' },
  dairy_milk: { swapTo: 'vegan_meal', share: 0.5, text: 'Try oat or soy milk for half of your glasses of milk.' },
  electricity: { reduce: 0.15, text: 'Cut electricity use by about 15%: switch off standby devices, use LED bulbs and set the geyser to 55 to 60 °C.' },
  hot_shower: { reduce: 0.3, text: 'Shorten showers by a few minutes or fit a low-flow shower head.' },
  tumble_dryer: { reduce: 0.6, text: 'Line-dry clothes instead of using the tumble dryer for most loads.' },
  air_conditioning: { reduce: 0.3, text: 'Set the air conditioner one or two degrees warmer and close curtains during the hottest hours.' },
  gas_heating: { reduce: 0.2, text: 'Use lids on pots and heat only the rooms you are using.' },
  lpg: { reduce: 0.2, text: 'Use a pressure cooker or lids to cut gas cooking time.' }
};

const CATEGORY_TIPS = {
  transport: 'Combine errands into one trip and keep tyres properly inflated to use less fuel.',
  food: 'Plan meals around vegetables, beans and grains, and buy only what you will eat to avoid waste.',
  energy: 'Switch appliances off at the wall and run full loads in the washing machine.'
};

function savingFor(item) {
  const rule = RULES[item.activityKey];
  if (!rule) return null;
  const from = byKey[item.activityKey];
  let saving = 0;
  if (rule.swapTo) {
    const to = byKey[rule.swapTo];
    saving = item.quantity * rule.share * (from.factor - to.factor);
  } else {
    saving = item.co2 * rule.reduce;
  }
  return { text: rule.text, saving: round(Math.max(0, saving)) };
}

function buildTips(items, highestCategory) {
  const tips = [];
  topActivities(items, 5).forEach((act) => {
    const s = savingFor(act);
    if (s && s.saving > 0) {
      tips.push({ category: act.category, activity: act.label, text: s.text, estimatedSavingKg: s.saving });
    }
  });
  tips.sort((a, b) => b.estimatedSavingKg - a.estimatedSavingKg);
  if (highestCategory && !tips.some((t) => t.category === highestCategory)) {
    tips.push({ category: highestCategory, activity: null, text: CATEGORY_TIPS[highestCategory], estimatedSavingKg: null });
  }
  if (tips.length === 0) {
    Object.keys(CATEGORY_TIPS).forEach((c) => tips.push({ category: c, activity: null, text: CATEGORY_TIPS[c], estimatedSavingKg: null }));
  }
  return tips.slice(0, 4);
}

function highest(totals) {
  const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const all = entries.reduce((acc, [, v]) => acc + v, 0);
  return entries.map(([category, total]) => ({
    category,
    label: CATEGORIES[category] ? CATEGORIES[category].label : category,
    total: round(total),
    share: Math.round((total / all) * 100)
  }));
}

function goalStatus(list, today, reductionPercent) {
  const thisStart = weekStart(today);
  const lastStart = addDays(thisStart, -7);
  const lastWeek = inRange(list, lastStart, addDays(lastStart, 6));
  const thisWeek = inRange(list, thisStart, today);
  const daysElapsed = daysBetween(thisStart, today) + 1;
  const current = sum(thisWeek);

  if (lastWeek.length === 0) {
    return {
      reductionPercent,
      hasBaseline: false,
      current,
      daysElapsed,
      message: 'Keep logging this week. Your total becomes the baseline for next week\'s reduction goal.'
    };
  }

  const baseline = sum(lastWeek);
  const target = round(baseline * (1 - reductionPercent / 100));
  const expectedSoFar = round(target * (daysElapsed / 7));
  let status = 'on_track';
  if (current > target) status = 'over';
  else if (current > expectedSoFar) status = 'at_risk';

  const messages = {
    on_track: 'You are on track to beat this week\'s goal.',
    at_risk: 'You are ahead of the pace for this week. Lighter days from here will keep you under target.',
    over: 'This week has gone past the target. Use the tips below to bring next week down.'
  };

  return {
    reductionPercent,
    hasBaseline: true,
    baseline,
    target,
    current,
    remaining: round(Math.max(0, target - current)),
    expectedSoFar,
    daysElapsed,
    usedPercent: target > 0 ? Math.round((current / target) * 100) : 100,
    status,
    message: messages[status]
  };
}

// Goal results for completed weeks, so users can see progress over time.
function goalHistory(list, today, reductionPercent, weeks = 4) {
  const thisStart = weekStart(today);
  const out = [];
  for (let i = weeks; i >= 1; i--) {
    const start = addDays(thisStart, -7 * i);
    const prevStart = addDays(start, -7);
    const week = inRange(list, start, addDays(start, 6));
    const prev = inRange(list, prevStart, addDays(prevStart, 6));
    if (!week.length || !prev.length) continue;
    const target = round(sum(prev) * (1 - reductionPercent / 100));
    const total = sum(week);
    out.push({ weekStart: start, total, target, met: total <= target, changePercent: Math.round(((total - sum(prev)) / sum(prev)) * 100) });
  }
  return out;
}

function buildInsights(list, today, reductionPercent = 10) {
  const thisStart = weekStart(today);
  const recent = inRange(list, addDays(today, -6), today);
  const scope = recent.length ? recent : list;
  const ranking = highest(totalsByCategory(scope));
  const highestCategory = ranking ? ranking[0].category : null;
  const tips = buildTips(scope, highestCategory);
  const goal = goalStatus(list, today, reductionPercent);

  let weeklyGoal = null;
  if (tips.length && tips[0].estimatedSavingKg) {
    weeklyGoal = `This week: ${tips[0].text.charAt(0).toLowerCase() + tips[0].text.slice(1)} That could save about ${tips[0].estimatedSavingKg} kg CO2e.`;
  } else if (highestCategory) {
    weeklyGoal = `This week: focus on ${CATEGORIES[highestCategory].label.toLowerCase()}, your highest-emission category.`;
  }

  return {
    period: recent.length ? 'last7days' : 'allTime',
    weekStart: thisStart,
    categoryRanking: ranking || [],
    highestCategory,
    topActivities: topActivities(scope, 3),
    tips,
    weeklyGoal,
    goal,
    goalHistory: goalHistory(list, today, reductionPercent)
  };
}

module.exports = { buildInsights, goalStatus, goalHistory, buildTips, RULES };
