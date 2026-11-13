const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { runCleanup } = require('./services/accountData');

async function main() {
  await mongoose.connect(config.mongoUri);
  await mongoose.syncIndexes();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Khata.io API on port ${config.port} (AI: ${config.ai.enabled ? config.gemini.tier : 'off'}, payments: ${config.payments.mode})`);
  });

  const cleanup = async () => {
    try {
      const removed = await runCleanup();
      if (removed) console.log(`Cleanup removed ${removed} expired account(s)`);
    } catch (err) {
      console.error('Cleanup failed', err);
    }
  };
  cleanup();
  setInterval(cleanup, 60 * 60 * 1000).unref();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
