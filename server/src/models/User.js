const mongoose = require('mongoose');

const SHOP_TYPES = ['kirana', 'medical', 'dairy', 'hardware', 'other'];
const LANGUAGES = ['hi', 'pa', 'en'];
const TONES = ['polite', 'friendly', 'firm'];

// Only what the app needs: no owner name, address, phone or date of birth.
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    shopName: { type: String, required: true, trim: true, maxlength: 80 },
    shopType: { type: String, enum: SHOP_TYPES, default: 'kirana' },
    language: { type: String, enum: LANGUAGES, default: 'hi' },
    defaultTone: { type: String, enum: TONES, default: 'polite' },
    isDemo: { type: Boolean, default: false },
    demoExpiresAt: { type: Date },
    consent: {
      termsVersion: { type: String, required: true },
      privacyVersion: { type: String, required: true },
      ageConfirmed: { type: Boolean, required: true },
      acceptedAt: { type: Date, required: true },
    },
    lastActiveAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    email: this.isDemo ? null : this.email,
    shopName: this.shopName,
    shopType: this.shopType,
    language: this.language,
    defaultTone: this.defaultTone,
    isDemo: this.isDemo,
    demoExpiresAt: this.demoExpiresAt || null,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.SHOP_TYPES = SHOP_TYPES;
module.exports.LANGUAGES = LANGUAGES;
module.exports.TONES = TONES;
