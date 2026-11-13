const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Customer = require('../models/Customer');
const Reminder = require('../models/Reminder');
const { validate } = require('../middleware/validate');
const { whatsappLink, getOrCreatePaymentRequest, payUrl } = require('../services/reminders');

const router = express.Router();

// Logs a reminder and returns a WhatsApp link. WhatsApp opens with the
// message ready; nothing is sent until the shopkeeper presses Send there.
router.post(
  '/',
  validate(
    z.object({
      customerId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid customer'),
      language: z.enum(['hi', 'pa', 'en']),
      tone: z.enum(['polite', 'friendly', 'firm']),
      message: z.string().trim().min(10, 'Message is too short').max(1000, 'Message is too long'),
    })
  ),
  async (req, res) => {
    const customer = await Customer.findOne({ _id: req.valid.customerId, shop: req.user._id });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.balancePaise <= 0) return res.status(400).json({ error: 'This customer has nothing pending' });
    const request = await getOrCreatePaymentRequest(req.user._id, customer._id);
    let { message } = req.valid;
    const link = payUrl(request.token);
    if (!message.includes(link)) message = `${message}\n${link}`;
    const reminder = await Reminder.create({
      shop: req.user._id,
      customer: customer._id,
      language: req.valid.language,
      tone: req.valid.tone,
      message,
      amountPaise: customer.balancePaise,
    });
    res.status(201).json({ id: reminder._id.toString(), whatsappUrl: whatsappLink(customer.phone, message) });
  }
);

router.get('/', async (req, res) => {
  const reminders = await Reminder.find({ shop: req.user._id }).sort({ createdAt: -1 }).limit(50).populate('customer', 'name balancePaise');
  res.json({
    reminders: reminders.map((r) => ({
      id: r._id.toString(),
      customerId: r.customer?._id?.toString() || null,
      customerName: r.customer?.name || 'Deleted customer',
      amount: r.amountPaise / 100,
      currentBalance: r.customer ? r.customer.balancePaise / 100 : null,
      language: r.language,
      tone: r.tone,
      createdAt: r.createdAt,
    })),
  });
});

module.exports = router;
