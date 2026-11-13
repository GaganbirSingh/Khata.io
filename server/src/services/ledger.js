const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Customer = require('../models/Customer');
const { settle } = require('../utils/khata');

// Recalculates a customer's balance and oldest unpaid udhaar from all their
// entries (oldest-first settlement, see utils/khata.js). Called after every
// change so the stored numbers can never drift from the ledger.
async function recomputeCustomer(customerId) {
  const id = new mongoose.Types.ObjectId(String(customerId));
  const entries = await Entry.find({ customer: id }, { type: 1, amountPaise: 1, date: 1, createdAt: 1 }).lean();
  const result = settle(entries.map((e) => ({ ...e, id: e._id })));
  const lastEntryAt = entries.reduce((m, e) => (!m || e.date > m ? e.date : m), null);
  await Customer.updateOne(
    { _id: id },
    { $set: { balancePaise: result.balancePaise, oldestDueAt: result.oldestDueAt, lastEntryAt } }
  );
  return result;
}

// Adds one entry and updates the customer.
async function addEntry({ shopId, customerId, type, amountPaise, items = '', source = 'manual', date, paymentRef }) {
  const customer = await Customer.findOne({ _id: customerId, shop: shopId });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  const entry = await Entry.create({
    shop: shopId,
    customer: customer._id,
    type,
    amountPaise,
    items,
    source,
    date: date || new Date(),
    paymentRef,
  });
  try {
    await recomputeCustomer(customer._id);
  } catch (e) {
    await Entry.deleteOne({ _id: entry._id });
    throw e;
  }
  return entry;
}

async function deleteEntry({ shopId, entryId }) {
  const entry = await Entry.findOne({ _id: entryId, shop: shopId });
  if (!entry) {
    const err = new Error('Entry not found');
    err.status = 404;
    throw err;
  }
  if (entry.source === 'payment') {
    const err = new Error('Payments received online cannot be deleted');
    err.status = 400;
    throw err;
  }
  await Entry.deleteOne({ _id: entry._id });
  await recomputeCustomer(entry.customer);
  return entry;
}

// Kept for tests and the demo seed: returns the recalculated balance.
async function recomputeBalance(customerId) {
  return (await recomputeCustomer(customerId)).balancePaise;
}

module.exports = { addEntry, deleteEntry, recomputeBalance, recomputeCustomer };
