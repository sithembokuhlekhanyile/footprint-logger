const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Please enter your name.' });
  if (!email || !EMAIL_RE.test(String(email))) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const normalised = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalised });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ name: String(name).trim(), email: normalised, passwordHash });
  return res.status(201).json({ token: signToken(user._id.toString()), user: user.toPublic() });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  const ok = user && (await bcrypt.compare(String(password), user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });
  return res.json({ token: signToken(user._id.toString()), user: user.toPublic() });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  return res.json({ user: user.toPublic() });
});

// Update the weekly reduction goal (percentage below last week's total).
router.patch('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  const pct = Number((req.body || {}).weeklyReductionPercent);
  if (!Number.isFinite(pct) || pct < 1 || pct > 50) {
    return res.status(400).json({ error: 'Weekly reduction goal must be between 1% and 50%.' });
  }
  user.weeklyReductionPercent = Math.round(pct);
  await user.save();
  return res.json({ user: user.toPublic() });
});

module.exports = router;
