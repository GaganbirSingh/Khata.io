const mongoose = require('mongoose');

// A shop's customer. Name is required; phone is optional and only used to
// open WhatsApp. No address, ID numbers or other details are stored.
const customerSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    nameKey: { type: String, required: true },
    phone: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    // Running balance in paise. Positive = customer owes the shop.
    balancePaise: { type: Number, default: 0 },
    lastEntryAt: { type: Date },
    // Date of the oldest udhaar that is not yet fully paid (oldest-first settlement).
    oldestDueAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customerSchema.index({ shop: 1, nameKey: 1 });

customerSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    phone: this.phone || null,
    balance: this.balancePaise / 100,
    lastEntryAt: this.lastEntryAt || null,
    oldestDueAt: this.oldestDueAt || null,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Customer', customerSchema);
