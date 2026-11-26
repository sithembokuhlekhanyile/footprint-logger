const express = require('express');
const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const { requireAuth } = require('../middleware/auth');
const { parseActivity } = require('../services/validate');
const { isDay } = require('../services/dates');

const router = express.Router();
router.use(requireAuth);

// GET /api/activities?category=food&from=2026-11-01&to=2026-11-30
router.get('/', async (req, res) => {
  const query = { user: req.userId };
  const { category, from, to } = req.query;
  if (category && category !== 'all') query.category = category;
  if ((from && isDay(from)) || (to && isDay(to))) {
    query.day = {};
    if (from && isDay(from)) query.day.$gte = from;
    if (to && isDay(to)) query.day.$lte = to;
  }
  const docs = await Activity.find(query).sort({ day: -1, createdAt: -1 }).limit(1000);
  res.json({ activities: docs.map((d) => d.toPublic()) });
});

router.post('/', async (req, res) => {
  const { value, error } = parseActivity(req.body);
  if (error) return res.status(400).json({ error });
  const doc = await Activity.create({ ...value, user: req.userId });
  return res.status(201).json({ activity: doc.toPublic() });
});

// Moves activities logged as a guest (localStorage) into the account.
router.post('/import', async (req, res) => {
  const list = Array.isArray((req.body || {}).activities) ? req.body.activities.slice(0, 500) : [];
  const clean = [];
  list.forEach((item) => {
    const { value } = parseActivity(item);
    if (value) clean.push({ ...value, user: req.userId });
  });
  if (clean.length) await Activity.insertMany(clean);
  res.status(201).json({ imported: clean.length, skipped: list.length - clean.length });
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Activity not found.' });
  const result = await Activity.deleteOne({ _id: req.params.id, user: req.userId });
  if (!result.deletedCount) return res.status(404).json({ error: 'Activity not found.' });
  return res.status(204).end();
});

module.exports = router;
