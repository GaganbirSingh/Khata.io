// Shared test setup. Each test file runs in its own process, so env vars set
// here (before the app is required) apply only to that file.
const crypto = require('node:crypto');

function setupEnv(extra = {}) {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI =
    process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/uk_test_${crypto.randomBytes(4).toString('hex')}`;
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
  process.env.APP_URL = 'http://localhost:5173';
  process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
  delete process.env.GEMINI_API_KEY;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  Object.assign(process.env, extra);
}

async function connect() {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.db.dropDatabase();
  await mongoose.syncIndexes();
  return mongoose;
}

async function disconnect() {
  const mongoose = require('mongoose');
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
}

let counter = 0;
async function newShop(app, overrides = {}) {
  const request = require('supertest');
  const agent = request.agent(app);
  counter += 1;
  const body = {
    email: `shop${counter}_${Date.now()}@example.com`,
    password: 'correct-horse-battery',
    shopName: `Test Store ${counter}`,
    shopType: 'kirana',
    language: 'hi',
    acceptTerms: true,
    ageConfirmed: true,
    ...overrides,
  };
  const res = await agent.post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user, credentials: body };
}

module.exports = { setupEnv, connect, disconnect, newShop };
