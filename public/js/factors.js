/*
 * Emission factor catalogue shared by the browser and the server.
 * Values are kilograms of CO2-equivalent per unit and are rounded,
 * indicative figures intended for awareness rather than formal reporting.
 */
(function (root) {
  const CATEGORIES = {
    transport: { label: 'Transport', color: '#2f7d6d' },
    food: { label: 'Food', color: '#e0a43a' },
    energy: { label: 'Energy', color: '#4a6fa5' }
  };

  const ACTIVITIES = [
    // Transport (per km)
    { key: 'car_petrol', category: 'transport', label: 'Car travel (petrol)', unit: 'km', factor: 0.19 },
    { key: 'car_diesel', category: 'transport', label: 'Car travel (diesel)', unit: 'km', factor: 0.17 },
    { key: 'car_electric', category: 'transport', label: 'Car travel (electric)', unit: 'km', factor: 0.08 },
    { key: 'motorbike', category: 'transport', label: 'Motorbike', unit: 'km', factor: 0.11 },
    { key: 'bus', category: 'transport', label: 'Bus or minibus taxi', unit: 'km', factor: 0.10 },
    { key: 'train', category: 'transport', label: 'Train', unit: 'km', factor: 0.04 },
    { key: 'flight_short', category: 'transport', label: 'Domestic flight', unit: 'km', factor: 0.25 },
    { key: 'cycling_walking', category: 'transport', label: 'Cycling or walking', unit: 'km', factor: 0 },

    // Food (per serving or item)
    { key: 'beef_meal', category: 'food', label: 'Beef meal', unit: 'serving', factor: 7.7 },
    { key: 'lamb_meal', category: 'food', label: 'Lamb meal', unit: 'serving', factor: 5.8 },
    { key: 'pork_meal', category: 'food', label: 'Pork meal', unit: 'serving', factor: 1.8 },
    { key: 'chicken_meal', category: 'food', label: 'Chicken meal', unit: 'serving', factor: 1.4 },
    { key: 'fish_meal', category: 'food', label: 'Fish meal', unit: 'serving', factor: 1.3 },
    { key: 'vegetarian_meal', category: 'food', label: 'Vegetarian meal', unit: 'serving', factor: 0.9 },
    { key: 'vegan_meal', category: 'food', label: 'Plant-based meal', unit: 'serving', factor: 0.6 },
    { key: 'dairy_milk', category: 'food', label: 'Glass of dairy milk', unit: 'glass', factor: 0.6 },
    { key: 'cheese', category: 'food', label: 'Cheese (100 g)', unit: 'portion', factor: 2.4 },
    { key: 'coffee', category: 'food', label: 'Cup of coffee', unit: 'cup', factor: 0.3 },

    // Energy
    { key: 'electricity', category: 'energy', label: 'Grid electricity', unit: 'kWh', factor: 0.95 },
    { key: 'gas_heating', category: 'energy', label: 'Gas heating or cooking', unit: 'kWh', factor: 0.18 },
    { key: 'lpg', category: 'energy', label: 'LPG cylinder gas', unit: 'kg', factor: 3.0 },
    { key: 'hot_shower', category: 'energy', label: 'Hot shower (electric geyser)', unit: 'minutes', factor: 0.2 },
    { key: 'tumble_dryer', category: 'energy', label: 'Tumble dryer cycle', unit: 'cycle', factor: 2.3 },
    { key: 'air_conditioning', category: 'energy', label: 'Air conditioning', unit: 'hours', factor: 1.4 }
  ];

  const byKey = {};
  ACTIVITIES.forEach((a) => { byKey[a.key] = a; });

  const api = {
    CATEGORIES,
    ACTIVITIES,
    byKey,
    calculate(key, quantity) {
      const a = byKey[key];
      if (!a) return null;
      return Math.round(a.factor * Number(quantity) * 100) / 100;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FOOTPRINT = api;
})(typeof window !== 'undefined' ? window : this);
