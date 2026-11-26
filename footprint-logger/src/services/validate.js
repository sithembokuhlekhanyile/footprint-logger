const { byKey, CATEGORIES, calculate } = require('../../public/js/factors');
const { isDay, todayLocal } = require('./dates');

// Turns raw request input into a clean activity record, or returns an error.
// Catalogue activities have their CO2 calculated on the server so clients
// cannot submit inconsistent values. Custom activities supply their own CO2.
function parseActivity(input) {
  const body = input || {};
  const day = body.day || todayLocal();
  if (!isDay(day)) return { error: 'Date must be a valid YYYY-MM-DD value.' };

  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : '';

  if (body.activityKey) {
    const def = byKey[body.activityKey];
    if (!def) return { error: 'Unknown activity.' };
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
      return { error: 'Quantity must be a positive number.' };
    }
    return {
      value: {
        activityKey: def.key,
        label: def.label,
        category: def.category,
        quantity: Math.round(quantity * 100) / 100,
        unit: def.unit,
        co2: calculate(def.key, quantity),
        day,
        note
      }
    };
  }

  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return { error: 'Choose an activity or enter a name for a custom one.' };
  if (!CATEGORIES[body.category]) return { error: 'Category must be transport, food or energy.' };
  const co2 = Number(body.co2);
  if (!Number.isFinite(co2) || co2 < 0 || co2 > 10000) return { error: 'CO2 must be a number between 0 and 10000 kg.' };
  const quantity = body.quantity === undefined || body.quantity === '' ? 1 : Number(body.quantity);

  return {
    value: {
      activityKey: null,
      label: label.slice(0, 80),
      category: body.category,
      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 1,
      unit: typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim().slice(0, 20) : 'item',
      co2: Math.round(co2 * 100) / 100,
      day,
      note
    }
  };
}

module.exports = { parseActivity };
