const mongoose = require('mongoose');

// One payment attempt from the customer payment page.
const paymentSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentRequest', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    amountPaise: { type: Number, required: true, min: 100 },
    provider: { type: String, enum: ['demo', 'razorpay'], required: true },
    providerLinkId: { type: String },
    providerPaymentId: { type: String },
    status: { type: String, enum: ['created', 'paid'], default: 'created' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index(
  { providerLinkId: 1 },
  { unique: true, partialFilterExpression: { providerLinkId: { $type: 'string' } } }
);

module.exports = mongoose.model('Payment', paymentSchema);
