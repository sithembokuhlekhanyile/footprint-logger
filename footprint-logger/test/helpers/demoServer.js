// Runs the app on the in-memory store with sample data, for UI checks
// when MongoDB is not available. Usage: node test/helpers/demoServer.js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'demo-secret';
const bcrypt = require('bcryptjs');
const fakeDb = require('./fakeDb');
fakeDb.install();
const User = require('../../src/models/User');
const Activity = require('../../src/models/Activity');
const { createApp } = require('../../src/app');
const { calculate, byKey } = require('../../public/js/factors');
const { addDays, todayLocal } = require('../../src/services/dates');

async function seed() {
  const hash = await bcrypt.hash('password123', 10);
  const demo = await User.create({ name: 'Demo User', email: 'demo@example.com', passwordHash: hash });
  const others = await Promise.all(['Ayanda', 'Lerato', 'Pieter'].map((n) => User.create({ name: n, email: n.toLowerCase() + '@example.com', passwordHash: hash })));
  const today = todayLocal();
  const plan = [
    ['car_petrol', 32], ['beef_meal', 1], ['electricity', 9], ['chicken_meal', 1], ['hot_shower', 8], ['coffee', 2]
  ];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    for (const [key, q] of plan) {
      if ((i + key.length) % 4 === 0) continue;
      const qty = i >= 7 ? q * 1.2 : q;
      const d = byKey[key];
      await Activity.create({ user: demo._id, activityKey: key, label: d.label, category: d.category, quantity: qty, unit: d.unit, co2: calculate(key, qty), day });
    }
    for (const o of others) {
      await Activity.create({ user: o._id, activityKey: 'bus', label: 'Bus or minibus taxi', category: 'transport', quantity: 20, unit: 'km', co2: 2, day });
      await Activity.create({ user: o._id, activityKey: 'electricity', label: 'Grid electricity', category: 'energy', quantity: 6, unit: 'kWh', co2: 5.7, day });
    }
  }
}

seed().then(() => {
  const port = process.env.PORT || 3456;
  createApp().listen(port, () => console.log('Demo running on http://localhost:' + port + ' (demo@example.com / password123)'));
});
