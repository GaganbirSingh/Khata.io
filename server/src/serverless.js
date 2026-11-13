// Entry for serverless hosts (Vercel). The same Express app as src/index.js,
// but without app.listen and without the hourly setInterval, because a
// serverless function only runs while it is answering a request.
const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { runCleanup } = require('./services/accountData');

let app;
let connecting;
let lastCleanup = 0;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

// One connection per warm instance, reused across requests.
function connect() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connecting) {
    connecting = mongoose
      .connect(config.mongoUri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
      .catch((err) => {
        connecting = null; // try again on the next request
        throw err;
      });
  }
  return connecting;
}

// Deletes expired demo shops and inactive accounts at most once an hour per
// instance, so the retention promises hold even between the daily cron runs.
async function cleanupIfDue() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_EVERY_MS) return;
  lastCleanup = now;
  try {
    await runCleanup();
  } catch (err) {
    console.error('Cleanup failed', err);
  }
}

module.exports = async function handler(req, res) {
  try {
    await connect();
  } catch (err) {
    console.error('Database connection failed', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ error: 'The server is starting up. Please try again in a moment.' }));
  }
  await cleanupIfDue();
  if (!app) app = createApp();
  return app(req, res);
};
