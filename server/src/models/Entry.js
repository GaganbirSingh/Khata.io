const mongoose = require('mongoose');

// One line in the khata. Money is stored in paise (integers) to avoid
// floating point rounding errors.
const entrySchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: { type: String, enum: ['udhaar', 'jama', 'nakad'], required: true }, // nakad = paid on the spot
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      max: 10000000, // ₹1,00,000 per entry
      validate: { validator: Number.isInteger, message: 'Amount must be whole paise' },
    },
    items: { type: String, trim: true, maxlength: 120, default: '' },
    source: { type: String, enum: ['manual', 'voice', 'scan', 'payment'], default: 'manual' },
    // Set only for payment entries. Unique so a payment can never be counted twice.
    paymentRef: { type: String },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

entrySchema.index(
  { paymentRef: 1 },
  { unique: true, partialFilterExpression: { paymentRef: { $type: 'string' } } }
);
entrySchema.index({ shop: 1, date: -1 });

entrySchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    customerId: this.customer.toString(),
    type: this.type,
    amount: this.amountPaise / 100,
    items: this.items,
    source: this.source,
    date: this.date,
  };
};

module.exports = mongoose.model('Entry', entrySchema);
