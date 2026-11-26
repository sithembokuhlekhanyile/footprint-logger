process.env.JWT_SECRET = 'test-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fakeDb = require('./helpers/fakeDb');

fakeDb.install();
const { createApp } = require('../src/app');
const app = createApp();
const TODAY = '2026-11-26';

async function signUp(name, email) {
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'password123' });
  assert.equal(res.status, 201);
  return res.body.token;
}

test.beforeEach(() => fakeDb.reset());

test('registration validates input and rejects duplicates', async () => {
  let res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: 'password123' });
  assert.equal(res.status, 400);
  res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'a@x.com', password: 'short' });
  assert.equal(res.status, 400);
  await signUp('Thandi', 'Thandi@Example.com');
  res = await request(app).post('/api/auth/register').send({ name: 'T', email: 'thandi@example.com', password: 'password123' });
  assert.equal(res.status, 409);
  assert.equal(fakeDb.stores.users[0].email, 'thandi@example.com');
  assert.notEqual(fakeDb.stores.users[0].passwordHash, 'password123');
});

test('login returns a token and protected routes need it', async () => {
  await signUp('Thandi', 'thandi@example.com');
  let res = await request(app).post('/api/auth/login').send({ email: 'thandi@example.com', password: 'wrongpass' });
  assert.equal(res.status, 401);
  res = await request(app).post('/api/auth/login').send({ email: 'thandi@example.com', password: 'password123' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + res.body.token);
  assert.equal(me.body.user.name, 'Thandi');
  assert.equal((await request(app).get('/api/activities')).status, 401);
  assert.equal((await request(app).get('/api/activities').set('Authorization', 'Bearer nonsense')).status, 401);
});

test('activities are stored per user, filtered and deleted', async () => {
  const a = await signUp('A', 'a@example.com');
  const b = await signUp('B', 'b@example.com');
  const auth = (t) => ({ Authorization: 'Bearer ' + t });

  let res = await request(app).post('/api/activities').set(auth(a)).send({ activityKey: 'beef_meal', quantity: 2, day: TODAY });
  assert.equal(res.status, 201);
  assert.equal(res.body.activity.co2, 15.4);
  const beefId = res.body.activity.id;
  await request(app).post('/api/activities').set(auth(a)).send({ activityKey: 'car_petrol', quantity: 30, day: TODAY });
  await request(app).post('/api/activities').set(auth(a)).send({ label: 'Charcoal braai', category: 'food', co2: 4, day: '2026-11-25' });
  await request(app).post('/api/activities').set(auth(b)).send({ activityKey: 'electricity', quantity: 10, day: TODAY });
  res = await request(app).post('/api/activities').set(auth(a)).send({ activityKey: 'bus', quantity: 0 });
  assert.equal(res.status, 400);

  res = await request(app).get('/api/activities').set(auth(a));
  assert.equal(res.body.activities.length, 3);
  res = await request(app).get('/api/activities?category=food').set(auth(a));
  assert.equal(res.body.activities.length, 2);
  res = await request(app).get('/api/activities?from=2026-11-26&to=2026-11-26').set(auth(a));
  assert.equal(res.body.activities.length, 2);

  // B cannot delete A's entry.
  assert.equal((await request(app).delete('/api/activities/' + beefId).set(auth(b))).status, 404);
  assert.equal((await request(app).delete('/api/activities/' + beefId).set(auth(a))).status, 204);
  assert.equal((await request(app).delete('/api/activities/not-an-id').set(auth(a))).status, 404);
  res = await request(app).get('/api/activities').set(auth(a));
  assert.equal(res.body.activities.length, 2);
});

test('guest entries can be imported after sign-up', async () => {
  const t = await signUp('A', 'a@example.com');
  const res = await request(app).post('/api/activities/import').set('Authorization', 'Bearer ' + t).send({
    activities: [
      { activityKey: 'train', quantity: 50, day: '2026-11-24', co2: 999 },
      { label: 'Custom', category: 'energy', co2: 2, day: '2026-11-25' },
      { activityKey: 'unknown', quantity: 1 }
    ]
  });
  assert.equal(res.body.imported, 2);
  assert.equal(res.body.skipped, 1);
  const train = fakeDb.stores.activities.find((x) => x.activityKey === 'train');
  assert.equal(train.co2, 2); // recalculated on the server, not trusted from the client
});

test('dashboard returns totals, streak, weekly summaries and community average', async () => {
  const a = await signUp('A', 'a@example.com');
  const b = await signUp('B', 'b@example.com');
  const post = (t, body) => request(app).post('/api/activities').set('Authorization', 'Bearer ' + t).send(body);
  await post(a, { activityKey: 'car_petrol', quantity: 100, day: '2026-11-24' }); // 19
  await post(a, { activityKey: 'beef_meal', quantity: 1, day: '2026-11-25' }); // 7.7
  await post(a, { activityKey: 'electricity', quantity: 10, day: TODAY }); // 9.5
  await post(a, { activityKey: 'electricity', quantity: 20, day: '2026-11-17' }); // last week, 19
  await post(b, { activityKey: 'bus', quantity: 100, day: TODAY }); // 10

  const res = await request(app).get('/api/dashboard?today=' + TODAY).set('Authorization', 'Bearer ' + a);
  assert.equal(res.status, 200);
  const d = res.body;
  assert.equal(d.totals.allTime, 55.2);
  assert.equal(d.totals.last7Days, 36.2);
  assert.equal(d.totals.today, 9.5);
  assert.equal(d.streak.current, 3);
  assert.equal(d.weekly.length, 6);
  assert.equal(d.weekly[5].total, 36.2);
  assert.equal(d.weekly[4].total, 19);
  assert.equal(d.daily.length, 14);
  assert.equal(d.community.users, 2);
  assert.equal(d.community.average, 23.1);
  assert.equal(d.community.differencePercent, 57);

  const ins = await request(app).get('/api/dashboard/insights?today=' + TODAY).set('Authorization', 'Bearer ' + a);
  assert.equal(ins.body.highestCategory, 'transport');
  assert.equal(ins.body.goal.baseline, 19);
  assert.equal(ins.body.goal.status, 'over');
  assert.ok(ins.body.tips.length > 0);
});

test('weekly reduction goal can be updated', async () => {
  const t = await signUp('A', 'a@example.com');
  let res = await request(app).patch('/api/auth/me').set('Authorization', 'Bearer ' + t).send({ weeklyReductionPercent: 80 });
  assert.equal(res.status, 400);
  res = await request(app).patch('/api/auth/me').set('Authorization', 'Bearer ' + t).send({ weeklyReductionPercent: 20 });
  assert.equal(res.body.user.weeklyReductionPercent, 20);
  const ins = await request(app).get('/api/dashboard/insights?today=' + TODAY).set('Authorization', 'Bearer ' + t);
  assert.equal(ins.body.goal.reductionPercent, 20);
});

test('static pages and factor catalogue are served', async () => {
  assert.equal((await request(app).get('/')).status, 200);
  assert.equal((await request(app).get('/dashboard')).status, 200);
  assert.equal((await request(app).get('/login')).status, 200);
  const f = await request(app).get('/api/factors');
  assert.ok(f.body.activities.length >= 20);
  assert.equal((await request(app).get('/api/nothing')).status, 404);
});
