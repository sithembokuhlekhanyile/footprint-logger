// In-memory stand-in for MongoDB used by the API tests. It keeps real
// Mongoose documents (so schema validation and toPublic() still run) and
// replaces only the query methods the routes call.
const User = require('../../src/models/User');
const Activity = require('../../src/models/Activity');

const stores = { users: [], activities: [] };

function matches(doc, query) {
  return Object.entries(query).every(([key, cond]) => {
    const value = key === '_id' ? doc._id.toString() : doc[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond.toHexString)) {
      if (cond.$gte !== undefined && !(value >= cond.$gte)) return false;
      if (cond.$lte !== undefined && !(value <= cond.$lte)) return false;
      return true;
    }
    return String(value) === String(cond);
  });
}

function chain(results) {
  let list = results.slice();
  const q = {
    sort(spec) {
      const keys = Object.entries(spec);
      list.sort((a, b) => {
        for (const [k, dir] of keys) {
          if (a[k] < b[k]) return -1 * dir;
          if (a[k] > b[k]) return 1 * dir;
        }
        return 0;
      });
      return q;
    },
    limit(n) { list = list.slice(0, n); return q; },
    then(resolve, reject) { return Promise.resolve(list).then(resolve, reject); }
  };
  return q;
}

function install() {
  const make = (Model, store) => {
    Model.create = async (data) => {
      const doc = new Model(data);
      await doc.validate();
      doc.createdAt = new Date(Date.now() + store.length);
      store.push(doc);
      return doc;
    };
    Model.insertMany = async (list) => Promise.all(list.map((d) => Model.create(d)));
    Model.findOne = async (query) => store.find((d) => matches(d, query)) || null;
    Model.findById = async (id) => store.find((d) => d._id.toString() === String(id)) || null;
    Model.find = (query) => chain(store.filter((d) => matches(d, query)));
    Model.deleteOne = async (query) => {
      const i = store.findIndex((d) => matches(d, query));
      if (i === -1) return { deletedCount: 0 };
      store.splice(i, 1);
      return { deletedCount: 1 };
    };
    Model.prototype.save = async function save() {
      await this.validate();
      return this;
    };
  };
  make(User, stores.users);
  make(Activity, stores.activities);

  // Supports the community-average pipeline used by the dashboard route.
  Activity.aggregate = async (pipeline) => {
    const match = pipeline[0].$match;
    const rows = stores.activities.filter((d) => matches(d, match));
    const perUser = {};
    rows.forEach((r) => { perUser[r.user] = (perUser[r.user] || 0) + r.co2; });
    const totals = Object.values(perUser);
    if (!totals.length) return [];
    return [{ _id: null, average: totals.reduce((a, b) => a + b, 0) / totals.length, users: totals.length }];
  };
}

function reset() {
  stores.users.length = 0;
  stores.activities.length = 0;
}

module.exports = { install, reset, stores };
