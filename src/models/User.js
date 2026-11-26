const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    weeklyReductionPercent: { type: Number, default: 10, min: 1, max: 50 }
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    weeklyReductionPercent: this.weeklyReductionPercent,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
