const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const { nameKey } = require('../utils/names');
const { recomputeCustomer } = require('./ledger');

const { SAMPLE } = require('./demoData');

async function seedDemoShop(shopId, now = new Date()) {
  for (const s of SAMPLE) {
    const customer = await Customer.create({ shop: shopId, name: s.name, nameKey: nameKey(s.name) });
    const docs = s.lines.map(([daysAgo, type, rupees, items], i) => {
      const date = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000 - (i + 1) * 37 * 60 * 1000);
      return { shop: shopId, customer: customer._id, type, amountPaise: rupees * 100, items, source: 'manual', date };
    });
    await Entry.insertMany(docs);
    await recomputeCustomer(customer._id);
  }
}

module.exports = { seedDemoShop };
