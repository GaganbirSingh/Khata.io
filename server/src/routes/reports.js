const express = require('express');
const Entry = require('../models/Entry');
const Customer = require('../models/Customer');
const { daysAgo, IST_OFFSET_MS } = require('../utils/time');

const router = express.Router();
const DAY = 24 * 3600 * 1000;

// Every number and "insight" here is calculated from the shop's own entries.
// Nothing is estimated or invented. Nakad (paid on the spot) is shown on its
// own and never counted as udhaar given or as khata collections.
router.get('/', async (req, res) => {
  const shop = req.user._id;
  const days = [7, 30, 90, 180].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = daysAgo(days);

  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const sixMonthsStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 5, 1) - IST_OFFSET_MS);

  const [period, monthly, customers, lastJama] = await Promise.all([
    Entry.aggregate([
      { $match: { shop, date: { $gte: since } } },
      { $group: { _id: '$type', total: { $sum: '$amountPaise' } } },
    ]),
    Entry.aggregate([
      { $match: { shop, date: { $gte: sixMonthsStart }, type: { $in: ['udhaar', 'jama'] } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Asia/Kolkata' } }, type: '$type' },
          total: { $sum: '$amountPaise' },
        },
      },
    ]),
    Customer.find({ shop, balancePaise: { $gt: 0 } }),
    Entry.aggregate([
      { $match: { shop, type: 'jama' } },
      { $group: { _id: '$customer', last: { $max: '$date' } } },
    ]),
  ]);

  const p = Object.fromEntries(period.map((r) => [r._id, r.total]));
  const udhaarGiven = (p.udhaar || 0) / 100;
  const collected = (p.jama || 0) / 100;
  const cashSales = (p.nakad || 0) / 100;

  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const series = months.map((m) => {
    const u = monthly.find((r) => r._id.month === m && r._id.type === 'udhaar');
    const j = monthly.find((r) => r._id.month === m && r._id.type === 'jama');
    return { month: m, udhaar: (u?.total || 0) / 100, jama: (j?.total || 0) / 100 };
  });

  const lastPaid = new Map(lastJama.map((r) => [r._id.toString(), r.last]));
  const pending = customers
    .map((c) => {
      const since = c.oldestDueAt || c.lastEntryAt || c.createdAt;
      return {
        id: c._id.toString(),
        name: c.name,
        balance: c.balancePaise / 100,
        oldestDueAt: c.oldestDueAt,
        daysPending: Math.floor((now - since) / DAY),
        lastPaymentAt: lastPaid.get(c._id.toString()) || null,
      };
    })
    .sort((a, b) => b.daysPending - a.daysPending);

  const outstanding = customers.reduce((s, c) => s + c.balancePaise, 0) / 100;
  const old30 = pending.filter((c) => c.daysPending >= 30).length;
  const insights = [];
  if (pending.length) {
    insights.push(`${pending.length} customer${pending.length === 1 ? '' : 's'} owe a total of ₹${outstanding.toLocaleString('en-IN')}.`);
  }
  if (old30) {
    insights.push(`${old30} of them ha${old30 === 1 ? 's' : 've'} udhaar older than 30 days that is still unpaid.`);
  }
  if (udhaarGiven > 0) {
    insights.push(`In the last ${days} days you gave ₹${udhaarGiven.toLocaleString('en-IN')} udhaar and collected ₹${collected.toLocaleString('en-IN')} towards khata.`);
  }
  if (cashSales > 0) {
    insights.push(`₹${cashSales.toLocaleString('en-IN')} of goods were paid for on the spot (nakad). These don't change anyone's baaki.`);
  }

  res.json({
    days,
    udhaarGiven,
    collected,
    cashSales,
    collectionRate: udhaarGiven > 0 ? Math.round((collected / udhaarGiven) * 100) : null,
    outstanding,
    series,
    oldestPending: pending.slice(0, 10),
    insights,
  });
});

module.exports = router;
