const express = require('express');
const { z } = require('zod');
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const Reminder = require('../models/Reminder');
const PaymentRequest = require('../models/PaymentRequest');
const Payment = require('../models/Payment');
const { validate } = require('../middleware/validate');
const { nameKey } = require('../utils/names');
const { daysAgo } = require('../utils/time');
const { settle, udhaarStatus } = require('../utils/khata');

const router = express.Router();

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, ''))
  .refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), 'Enter a 10-digit Indian mobile number');
const name = z.string().trim().min(1, 'Enter a name').max(60);

router.get('/', async (req, res) => {
  const filter = ['due', 'cleared', 'overdue'].includes(req.query.filter) ? req.query.filter : 'all';
  const q = typeof req.query.q === 'string' ? nameKey(req.query.q).slice(0, 40) : '';
  const query = { shop: req.user._id };
  if (filter === 'due') query.balancePaise = { $gt: 0 };
  if (filter === 'cleared') query.balancePaise = { $lte: 0 };
  if (filter === 'overdue') {
    query.balancePaise = { $gt: 0 };
    // Overdue = the oldest unpaid udhaar is more than 30 days old,
    // even if the customer has bought or paid something since.
    query.oldestDueAt = { $lt: daysAgo(30) };
  }
  let customers = await Customer.find(query).sort({ balancePaise: -1, name: 1 }).limit(500);
  if (q) customers = customers.filter((c) => c.nameKey.includes(q));
  const overdueCutoff = daysAgo(30);
  res.json({
    customers: customers.map((c) => ({
      ...c.toPublic(),
      status: c.balancePaise <= 0 ? 'cleared' : c.oldestDueAt && c.oldestDueAt < overdueCutoff ? 'overdue' : 'due',
    })),
  });
});

router.post('/', validate(z.object({ name, phone: phone.optional().default('') })), async (req, res) => {
  const key = nameKey(req.valid.name);
  if (!key) return res.status(400).json({ error: 'Enter a name', field: 'name' });
  if (await Customer.exists({ shop: req.user._id, nameKey: key })) {
    return res.status(409).json({ error: 'A customer with this name already exists. Add a surname to tell them apart.', field: 'name' });
  }
  const customer = await Customer.create({
    shop: req.user._id,
    name: req.valid.name,
    nameKey: key,
    phone: req.valid.phone || undefined,
  });
  res.status(201).json({ customer: customer.toPublic() });
});

router.get('/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, shop: req.user._id });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const [entries, reminders] = await Promise.all([
    Entry.find({ customer: customer._id, shop: req.user._id }).sort({ date: -1 }).limit(500),
    Reminder.find({ customer: customer._id, shop: req.user._id }).sort({ createdAt: -1 }).limit(10),
  ]);
  // Settle over ALL entries (not just the ones shown) so statuses are exact.
  const all = await Entry.find({ customer: customer._id }, { type: 1, amountPaise: 1, date: 1, createdAt: 1 }).lean();
  const paidMap = settle(all.map((e) => ({ ...e, id: e._id }))).paid;
  res.json({
    customer: customer.toPublic(),
    entries: entries.map((e) => {
      const pub = e.toPublic();
      if (e.type !== 'udhaar') return pub;
      const st = udhaarStatus({ id: e._id, amountPaise: e.amountPaise }, paidMap);
      return { ...pub, status: st.status, paidAmount: st.paidPaise / 100 };
    }),
    reminders: reminders.map((r) => ({ id: r._id.toString(), createdAt: r.createdAt, amount: r.amountPaise / 100, language: r.language })),
  });
});

router.patch('/:id', validate(z.object({ name: name.optional(), phone: phone.optional() })), async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, shop: req.user._id });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (req.valid.name !== undefined) {
    const key = nameKey(req.valid.name);
    if (!key) return res.status(400).json({ error: 'Enter a name', field: 'name' });
    if (key !== customer.nameKey && (await Customer.exists({ shop: req.user._id, nameKey: key }))) {
      return res.status(409).json({ error: 'Another customer already has this name', field: 'name' });
    }
    customer.name = req.valid.name;
    customer.nameKey = key;
  }
  if (req.valid.phone !== undefined) customer.phone = req.valid.phone || undefined;
  await customer.save();
  res.json({ customer: customer.toPublic() });
});

router.delete('/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, shop: req.user._id });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  await Promise.all([
    Entry.deleteMany({ customer: customer._id, shop: req.user._id }),
    Reminder.deleteMany({ customer: customer._id, shop: req.user._id }),
    PaymentRequest.deleteMany({ customer: customer._id, shop: req.user._id }),
    Payment.deleteMany({ customer: customer._id, shop: req.user._id }),
  ]);
  await Customer.deleteOne({ _id: customer._id });
  res.json({ ok: true });
});

module.exports = router;
