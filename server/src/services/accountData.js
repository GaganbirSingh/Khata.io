const config = require('../config');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const Reminder = require('../models/Reminder');
const PaymentRequest = require('../models/PaymentRequest');
const Payment = require('../models/Payment');

// Permanently removes a shop and everything linked to it.
async function deleteShopData(shopId) {
  await Promise.all([
    Entry.deleteMany({ shop: shopId }),
    Reminder.deleteMany({ shop: shopId }),
    PaymentRequest.deleteMany({ shop: shopId }),
    Payment.deleteMany({ shop: shopId }),
  ]);
  await Customer.deleteMany({ shop: shopId });
  await User.deleteOne({ _id: shopId });
}

// Everything we hold about a shop, for the "Download my data" button.
async function exportShopData(shopId) {
  const [user, customers, entries, reminders] = await Promise.all([
    User.findById(shopId),
    Customer.find({ shop: shopId }).sort({ name: 1 }),
    Entry.find({ shop: shopId }).sort({ date: 1 }),
    Reminder.find({ shop: shopId }).sort({ createdAt: 1 }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: user
      ? { ...user.toPublic(), email: user.email, consent: user.consent, lastActiveAt: user.lastActiveAt }
      : null,
    customers: customers.map((c) => c.toPublic()),
    entries: entries.map((e) => e.toPublic()),
    reminders: reminders.map((r) => ({
      customerId: r.customer.toString(),
      language: r.language,
      tone: r.tone,
      message: r.message,
      amount: r.amountPaise / 100,
      createdAt: r.createdAt,
    })),
  };
}

// Deletes expired demo accounts and accounts inactive for longer than the
// retention period stated in the privacy policy.
async function runCleanup(now = new Date()) {
  const cutoff = new Date(now.getTime() - config.retentionDays * 24 * 3600 * 1000);
  const stale = await User.find(
    { $or: [{ isDemo: true, demoExpiresAt: { $lt: now } }, { lastActiveAt: { $lt: cutoff } }] },
    { _id: 1 }
  ).limit(500);
  for (const u of stale) await deleteShopData(u._id);
  return stale.length;
}

module.exports = { deleteShopData, exportShopData, runCleanup };
