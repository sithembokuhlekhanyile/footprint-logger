const express = require('express');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { isDay, todayLocal, addDays } = require('../services/dates');
const stats = require('../services/stats');
const { buildInsights } = require('../services/insights');

const router = express.Router();
router.use(requireAuth);

// The browser sends its own date so "today" matches the user's time zone.
function resolveToday(req) {
  return isDay(req.query.today) ? req.query.today : todayLocal();
}

async function loadUserActivities(userId) {
  const docs = await Activity.find({ user: userId }).sort({ day: -1 });
  return docs.map((d) => d.toPublic());
}

// Average emissions per active user over the last 7 days, across everyone.
async function communityAverage(today) {
  const from = addDays(today, -6);
  const [result] = await Activity.aggregate([
    { $match: { day: { $gte: from, $lte: today } } },
    { $group: { _id: '$user', total: { $sum: '$co2' } } },
    { $group: { _id: null, average: { $avg: '$total' }, users: { $sum: 1 } } }
  ]);
  if (!result) return { average: null, users: 0, from, to: today };
  return { average: stats.round(result.average), users: result.users, from, to: today };
}

router.get('/', async (req, res) => {
  const today = resolveToday(req);
  const list = await loadUserActivities(req.userId);
  const last7 = stats.inRange(list, addDays(today, -6), today);
  const community = await communityAverage(today);
  const mine = stats.sum(last7);

  res.json({
    today,
    totals: {
      allTime: stats.sum(list),
      last7Days: mine,
      today: stats.sum(list.filter((a) => a.day === today)),
      entries: list.length
    },
    byCategory: stats.totalsByCategory(list),
    byCategoryLast7Days: stats.totalsByCategory(last7),
    daily: stats.dailySeries(list, today, 14),
    weekly: stats.weeklySummaries(list, today, 6),
    streak: stats.streak(list, today),
    community: {
      ...community,
      you: mine,
      differencePercent: community.average ? Math.round(((mine - community.average) / community.average) * 100) : null
    }
  });
});

router.get('/insights', async (req, res) => {
  const today = resolveToday(req);
  const user = await User.findById(req.userId);
  const list = await loadUserActivities(req.userId);
  res.json(buildInsights(list, today, user ? user.weeklyReductionPercent : 10));
});

module.exports = router;
