const path = require('path');
const express = require('express');
const cors = require('cors');
const factors = require('../public/js/factors');

const authRoutes = require('./routes/auth');
const activityRoutes = require('./routes/activities');
const dashboardRoutes = require('./routes/dashboard');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/factors', (req, res) => res.json({ categories: factors.CATEGORIES, activities: factors.ACTIVITIES }));
  app.use('/api/auth', authRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist')));
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  // Central error handler so a failure never leaks a stack trace to users.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

module.exports = { createApp };
