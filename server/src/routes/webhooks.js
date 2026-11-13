const express = require('express');
const { handleWebhook } = require('../services/payments');

const router = express.Router();

// Raw body is required: the signature is calculated over the exact bytes.
router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Invalid body' });
  const result = await handleWebhook({
    rawBody: req.body,
    signature: req.get('x-razorpay-signature'),
    eventId: req.get('x-razorpay-event-id'),
  });
  res.json({ ok: true, ...result });
});

module.exports = router;
