const express = require('express');
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const { startOfDayIST, daysAgo } = require('../utils/time');

const router = express.Router();

router.get('/', async (req, res) => {
  const shop = req.user._id;
  const today = startOfDayIST();
  const [todayTotals, outstanding, customerCount, recent, topPending, overdue] = await Promise.all([
    Entry.aggregate([
      { $match: { shop, date: { $gte: today } } },
      { $group: { _id: '$type', total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]),
    Customer.aggregate([
      { $match: { shop, balancePaise: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$balancePaise' }, count: { $sum: 1 } } },
    ]),
    Customer.countDocuments({ shop }),
    Entry.find({ shop }).sort({ date: -1 }).limit(12).populate('customer', 'name'),
    Customer.find({ shop, balancePaise: { $gt: 0 } }).sort({ balancePaise: -1 }).limit(5),
    // Customers whose oldest unpaid udhaar is 30+ days old.
    Customer.find({ shop, balancePaise: { $gt: 0 }, oldestDueAt: { $lt: daysAgo(30) } }).sort({ oldestDueAt: 1 }).limit(8),
  ]);
  const t = Object.fromEntries(todayTotals.map((r) => [r._id, r]));
  res.json({
    shopName: req.user.shopName,
    today: {
      received: (t.jama?.total || 0) / 100, // paid towards khata
      cashSales: (t.nakad?.total || 0) / 100, // goods paid for on the spot
      udhaarGiven: (t.udhaar?.total || 0) / 100,
      entries: (t.jama?.count || 0) + (t.udhaar?.count || 0) + (t.nakad?.count || 0),
    },
    outstanding: (outstanding[0]?.total || 0) / 100,
    customersWithDue: outstanding[0]?.count || 0,
    customerCount,
    recent: recent.map((e) => ({ ...e.toPublic(), customerName: e.customer?.name || 'Deleted customer' })),
    topPending: topPending.map((c) => c.toPublic()),
    overdue: overdue.map((c) => ({
      ...c.toPublic(),
      daysPending: Math.floor((Date.now() - c.oldestDueAt.getTime()) / (24 * 3600 * 1000)),
    })),
  });
});

module.exports = router;
