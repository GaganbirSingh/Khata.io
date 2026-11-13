const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const { validate } = require('../middleware/validate');
const { addEntry, deleteEntry } = require('../services/ledger');
const { toPaise } = require('../utils/money');
const { nameKey } = require('../utils/names');

const router = express.Router();

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const entryInput = z
  .object({
    customerId: objectId.optional(),
    newCustomerName: z.string().trim().min(1).max(60).optional(),
    type: z.enum(['udhaar', 'jama', 'nakad']),
    amount: z.union([z.number(), z.string()]).transform((v, ctx) => {
      const paise = toPaise(v);
      if (paise === null) {
        ctx.addIssue({ code: 'custom', message: 'Enter an amount between ₹0.01 and ₹1,00,000' });
        return z.NEVER;
      }
      return paise;
    }),
    items: z.string().trim().max(120).optional().default(''),
    source: z.enum(['manual', 'voice', 'scan']).optional().default('manual'),
    date: z.coerce.date().optional(),
  })
  .refine((e) => Boolean(e.customerId) !== Boolean(e.newCustomerName), {
    message: 'Choose a customer',
    path: ['customerId'],
  })
  .refine((e) => !e.date || (e.date <= new Date(Date.now() + 60 * 1000) && e.date > new Date('2000-01-01')), {
    message: 'Date cannot be in the future',
    path: ['date'],
  });

// Resolves customerId / newCustomerName for a list of entries, creating new
// customers only after every entry has been checked.
async function resolveCustomers(shopId, entries) {
  const ids = [...new Set(entries.filter((e) => e.customerId).map((e) => e.customerId))];
  const found = await Customer.find({ _id: { $in: ids }, shop: shopId }, { _id: 1 });
  if (found.length !== ids.length) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  const newNames = new Map();
  for (const e of entries) {
    if (!e.newCustomerName) continue;
    const key = nameKey(e.newCustomerName);
    if (!key) {
      const err = new Error('Enter a customer name');
      err.status = 400;
      throw err;
    }
    if (!newNames.has(key)) newNames.set(key, e.newCustomerName);
  }
  const resolved = new Map();
  for (const [key, displayName] of newNames) {
    const existing = await Customer.findOne({ shop: shopId, nameKey: key });
    resolved.set(key, existing || (await Customer.create({ shop: shopId, name: displayName, nameKey: key })));
  }
  return entries.map((e) => (e.customerId ? e.customerId : resolved.get(nameKey(e.newCustomerName))._id));
}

router.post('/', validate(entryInput), async (req, res) => {
  const [customerId] = await resolveCustomers(req.user._id, [req.valid]);
  const entry = await addEntry({ shopId: req.user._id, customerId, ...pick(req.valid) });
  const customer = await Customer.findById(customerId);
  res.status(201).json({ entry: entry.toPublic(), customer: customer.toPublic() });
});

router.post('/bulk', validate(z.object({ entries: z.array(entryInput).min(1).max(40) })), async (req, res) => {
  const customerIds = await resolveCustomers(req.user._id, req.valid.entries);
  const saved = [];
  for (let i = 0; i < req.valid.entries.length; i += 1) {
    const entry = await addEntry({ shopId: req.user._id, customerId: customerIds[i], ...pick(req.valid.entries[i]) });
    saved.push(entry.toPublic());
  }
  res.status(201).json({ entries: saved });
});

router.get('/recent', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const entries = await Entry.find({ shop: req.user._id }).sort({ date: -1 }).limit(limit).populate('customer', 'name');
  res.json({
    entries: entries.map((e) => ({ ...e.toPublic(), customerId: e.customer?._id?.toString(), customerName: e.customer?.name || 'Deleted customer' })),
  });
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Entry not found' });
  const entry = await deleteEntry({ shopId: req.user._id, entryId: req.params.id });
  const customer = await Customer.findById(entry.customer);
  res.json({ ok: true, customer: customer ? customer.toPublic() : null });
});

function pick(e) {
  return { type: e.type, amountPaise: e.amount, items: e.items, source: e.source, date: e.date };
}

module.exports = router;
