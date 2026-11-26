const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Key from the emission factor catalogue, or null for a custom entry.
    activityKey: { type: String, default: null },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true, enum: ['transport', 'food', 'energy'] },
    quantity: { type: Number, default: 1, min: 0 },
    unit: { type: String, default: 'item' },
    co2: { type: Number, required: true, min: 0 }, // kg CO2e
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
    note: { type: String, trim: true, maxlength: 200 }
  },
  { timestamps: true }
);

activitySchema.index({ user: 1, day: -1 });
activitySchema.index({ day: 1 });

activitySchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    activityKey: this.activityKey,
    label: this.label,
    category: this.category,
    quantity: this.quantity,
    unit: this.unit,
    co2: this.co2,
    day: this.day,
    note: this.note || '',
    createdAt: this.createdAt
  };
};

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
