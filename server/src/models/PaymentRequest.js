const mongoose = require('mongoose');

// A private link a customer can open to see what they owe and pay.
// The token is random and unguessable; it expires.
const paymentRequestSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
