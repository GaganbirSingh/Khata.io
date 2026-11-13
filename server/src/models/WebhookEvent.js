const mongoose = require('mongoose');

// Remembers which webhook events were already handled, so a retried
// delivery is ignored instead of crediting the customer twice.
const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
