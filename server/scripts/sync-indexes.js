// Run once after deploying (and after changing a model's indexes):
//   MONGODB_URI="..." JWT_SECRET="..." node server/scripts/sync-indexes.js
// The unique indexes matter: they stop a payment from being recorded twice.
const mongoose = require('mongoose');
const config = require('../src/config');

(async () => {
  require('../src/app').createApp(); // loads every model through the routes
  await mongoose.connect(config.mongoUri);
  await mongoose.syncIndexes();
  console.log('Indexes are up to date');
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
