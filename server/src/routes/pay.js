const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const PaymentRequest = require('../models/PaymentRequest');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const User = require('../models/User');
const { validate } = require('../middleware/validate');
const { startPayment, recordPayment } = require('../services/payments');
const { toPaise } = require('../utils/money');

// Public pages a customer opens from a reminder. Shows only what they need:
// shop name, their first name, amount due and their last few entries.
const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: config.isTest ? 1000 : 30, standardHeaders: 'draft-7', legacyHeaders: false });
router.use(limiter);

async function loadRequest(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const request = await PaymentRequest.findOne({ token, expiresAt: { $gt: new Date() } });
  if (!request) return null;
  const [customer, shop] = await Promise.all([Customer.findById(request.customer), User.findById(request.shop)]);
  if (!customer || !shop) return null;
  return { request, customer, shop };
}

const notFound = { error: 'This payment link has expired or does not exist. Please ask the shop for a new one.' };

router.get('/:token', async (req, res) => {
  const found = await loadRequest(req.params.token);
  if (!found) return res.status(404).json(notFound);
  const { customer, shop, request } = found;
  const entries = await Entry.find({ customer: customer._id }).sort({ date: -1 }).limit(5);
  res.set('Cache-Control', 'no-store');
  res.json({
    shopName: shop.shopName.replace(/\s*\(demo\)$/i, ''),
    isDemo: shop.isDemo || config.payments.mode === 'demo',
    customerFirstName: customer.name.split(' ')[0],
    amountDue: Math.max(0, customer.balancePaise) / 100,
    entries: entries.map((e) => ({ date: e.date, items: e.items, type: e.type, amount: e.amountPaise / 100 })),
    paymentMode: config.payments.mode,
    expiresAt: request.expiresAt,
  });
});

router.post(
  '/:token/start',
  validate(z.object({ amount: z.union([z.number(), z.string()]) })),
  async (req, res) => {
    const found = await loadRequest(req.params.token);
    if (!found) return res.status(404).json(notFound);
    const amountPaise = toPaise(req.valid.amount);
    if (amountPaise === null || amountPaise < 100) return res.status(400).json({ error: 'Enter at least ₹1' });
    if (amountPaise > found.customer.balancePaise) {
      return res.status(400).json({ error: 'Amount is more than what is due' });
    }
    const result = await startPayment({ request: found.request, shopName: found.shop.shopName, amountPaise });
    res.status(201).json(result);
  }
);

// Demo mode only: completes a pretend payment. No real money moves.
router.post(
  '/:token/demo-complete',
  validate(z.object({ paymentId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid payment') })),
  async (req, res) => {
    if (config.payments.mode !== 'demo') return res.status(404).json({ error: 'Not found' });
    const found = await loadRequest(req.params.token);
    if (!found) return res.status(404).json(notFound);
    const payment = await Payment.findOne({ _id: req.valid.paymentId, request: found.request._id, provider: 'demo' });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    await recordPayment(payment, `demo_${payment._id}`);
    const customer = await Customer.findById(found.customer._id);
    res.json({ status: 'paid', amountPaid: payment.amountPaise / 100, amountDue: Math.max(0, customer.balancePaise) / 100 });
  }
);

router.get('/:token/status/:paymentId', async (req, res) => {
  const found = await loadRequest(req.params.token);
  if (!found || !mongoose.isValidObjectId(req.params.paymentId)) return res.status(404).json(notFound);
  const payment = await Payment.findOne({ _id: req.params.paymentId, request: found.request._id });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json({ status: payment.status, amount: payment.amountPaise / 100 });
});

module.exports = router;
