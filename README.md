# Footprint Logger

A web platform that helps people track the daily activities behind their carbon emissions, see running totals and weekly summaries, find their highest-emission habits and get practical tips to reduce them.

Built with Node.js, Express, MongoDB (Mongoose), vanilla JavaScript and Chart.js.

## Features

**Activity logging**
- Choose from 24 preset activities across transport, food and energy, each with an assigned CO2e factor, or enter a custom activity with your own value
- Live CO2e preview, running total and today's total
- Doughnut chart by category and bar chart by activity
- Filter the log by category
- Guest mode stores entries in `localStorage`; entries move into the account automatically on sign-up or login

**User accounts and dashboard**
- Registration and login with bcrypt-hashed passwords and JWT authentication
- Activity logs stored per user in MongoDB
- Dashboard with today, last 7 days, all-time totals and a logging streak
- 14-day daily chart, category breakdown and six weekly summaries with week-on-week change
- Comparison with the community average (average emissions per active user over the last 7 days)

**Insight engine**
- Ranks categories and individual activities by emissions
- Personalised tips with an estimated weekly saving, based on the user's own logged quantities
- A suggested weekly focus
- Weekly reduction goal (5 to 25% below last week) with a pace marker, status and a history of goals met

## Getting started

Requirements: Node.js 18 or later and MongoDB (local or MongoDB Atlas).

```bash
git clone https://github.com/sithembokuhlekhanyile/footprint-logger.git
cd footprint-logger
npm install
cp .env.example .env      # then set MONGODB_URI and a long random JWT_SECRET
npm start                 # http://localhost:3000
```

Use `npm run dev` for auto-reload while developing.

To try the interface without MongoDB, run `npm run demo`. It starts the app on an in-memory store with sample data (log in with `demo@example.com` / `password123`). Demo data is lost when it stops.

## Tests

```bash
npm test
```

The suite covers the date, statistics and insight logic, input validation, and the API routes (authentication, per-user data isolation, filtering, deletion, guest import, dashboard figures and goal updates). API tests use an in-memory stand-in for MongoDB, so they run without a database.

## API

All routes except registration, login and the factor list require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in and receive a token |
| GET | `/api/auth/me` | Current user |
| PATCH | `/api/auth/me` | Update weekly reduction goal (`weeklyReductionPercent`) |
| GET | `/api/factors` | Activity catalogue and emission factors |
| GET | `/api/activities?category=&from=&to=` | List the user's activities |
| POST | `/api/activities` | Log an activity |
| POST | `/api/activities/import` | Import guest entries |
| DELETE | `/api/activities/:id` | Delete an activity |
| GET | `/api/dashboard?today=YYYY-MM-DD` | Totals, charts data, weekly summaries, streak, community average |
| GET | `/api/dashboard/insights?today=YYYY-MM-DD` | Rankings, tips, weekly focus and goal progress |

## Project structure

```
public/            Front end (HTML, CSS, JS)
  js/factors.js    Emission factor catalogue shared by browser and server
  js/guest.js      Guest logger (localStorage)
  js/dashboard.js  Signed-in dashboard
src/
  app.js           Express app
  server.js        Database connection and startup
  models/          User and Activity schemas
  routes/          auth, activities, dashboard
  services/        dates, stats, insights, validation
test/              node:test suites and in-memory test helpers
```

## Notes on the data

Emission factors are rounded, indicative values in kg CO2e per unit, drawn from commonly published averages. Grid electricity uses 0.95 kg per kWh, close to South Africa's coal-heavy grid. They are intended to build awareness, not for formal carbon accounting.

## Licence

MIT
