// Gemini and Razorpay are replaced with fakes here: the real services need
// keys and network access. These tests check how the app uses them.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupEnv, connect, disconnect, newShop } = require('./helpers');

setupEnv({
  GEMINI_API_KEY: 'test-key',
  GEMINI_TIER: 'free',
  RAZORPAY_KEY_ID: 'rzp_test_dummy',
  RAZORPAY_KEY_SECRET: 'dummy-secret',
  RAZORPAY_WEBHOOK_SECRET: 'whsec_dummy',
});
const request = require('supertest');
const gemini = require('../src/services/ai/gemini');
const { createApp } = require('../src/app');
const Payment = require('../src/models/Payment');

const app = createApp();
const sent = [];
let nextAnswer = '{}';
gemini.setClientFactory(() => ({
  models: {
    generateContent: async (args) => {
      sent.push(args);
      const answer = typeof nextAnswer === 'function' ? nextAnswer(args) : nextAnswer;
      return { text: answer };
    },
  },
}));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

test.before(connect);
test.after(disconnect);

test('config refuses live Razorpay keys', () => {
  const { execFileSync } = require('node:child_process');
  assert.throws(() =>
    execFileSync(process.execPath, ['-e', "require('./src/config')"], {
      cwd: require('node:path').join(__dirname, '..'),
      env: { ...process.env, RAZORPAY_KEY_ID: 'rzp_live_abc' },
      stdio: 'pipe',
    })
  );
});

test('confident local parses never call Gemini', async () => {
  const { agent } = await newShop(app);
  await agent.post('/api/customers').send({ name: 'Ramesh Kumar' });
  sent.length = 0;
  const res = await agent.post('/api/ai/parse').send({ text: 'Ramesh ne 250 ka atta liya' });
  assert.equal(res.body.engine, 'local');
  assert.equal(sent.length, 0);
});

test('unclear text goes to Gemini with known names replaced', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Ramesh Kumar' })).body.customer;
  sent.length = 0;
  nextAnswer = JSON.stringify({ customerName: 'CUSTOMER_1', entries: [{ type: 'udhaar', amount: 640, items: 'ration', sure: true }] });
  const res = await agent.post('/api/ai/parse').send({ text: 'Ramesh Kumar 640 ration' });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  const prompt = JSON.stringify(sent[0].contents);
  assert.doesNotMatch(prompt, /Ramesh/i, 'customer name must not be sent to AI');
  assert.match(prompt, /CUSTOMER_1/);
  assert.equal(res.body.engine, 'gemini');
  assert.equal(res.body.customer.id, c.id);
  assert.equal(res.body.entries[0].amount, 640);
});

test('bad AI answers fall back safely', async () => {
  const { agent } = await newShop(app);
  nextAnswer = 'not json at all';
  const res = await agent.post('/api/ai/parse').send({ text: 'Zoya 300' });
  assert.equal(res.status, 200);
  assert.equal(res.body.engine, 'local');
  assert.equal(res.body.needsCheck, true);

  nextAnswer = JSON.stringify({ customerName: 'Zoya', entries: [{ type: 'udhaar', amount: 99999999, items: 'x', sure: true }] });
  const res2 = await agent.post('/api/ai/parse').send({ text: 'Zoya 300' });
  assert.ok(res2.body.entries.every((e) => e.amount <= 100000), 'absurd AI amounts are dropped');
});

test('free tier: scanning needs a sample-data confirmation and a real image', async () => {
  const { agent } = await newShop(app);
  let res = await agent.post('/api/ai/scan').attach('photo', PNG, 'page.png');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /sample data/);
  res = await agent.post('/api/ai/scan').field('sampleDataOnly', 'true').attach('photo', Buffer.from('<svg></svg>'), 'page.png');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /JPG, PNG or WEBP/);
  res = await agent.post('/api/ai/scan').field('sampleDataOnly', 'true').attach('photo', Buffer.alloc(6 * 1024 * 1024), 'big.jpg');
  assert.equal(res.status, 413);
});

test('scan returns entries to review, flags unsure lines, saves nothing', async () => {
  const { agent } = await newShop(app);
  await agent.post('/api/customers').send({ name: 'Sunita Devi' });
  await agent.post('/api/customers').send({ name: 'Harpreet Singh' });
  await agent.post('/api/customers').send({ name: 'Harpreet Kaur' });
  nextAnswer = JSON.stringify({
    entries: [
      { customerName: 'Sunita', items: 'ghee', amount: 800, type: 'udhaar', confidence: 0.95 },
      { customerName: 'Harpreet', items: 'atta', amount: 450, type: 'udhaar', confidence: 0.9 },
      { customerName: 'Rmsh', items: 'tel', amount: 120, type: 'udhaar', confidence: 0.4 },
      { customerName: 'Total', items: '', amount: -5, type: 'udhaar', confidence: 0.9 },
    ],
  });
  const res = await agent.post('/api/ai/scan').field('sampleDataOnly', 'true').attach('photo', PNG, 'page.png');
  assert.equal(res.status, 200);
  assert.equal(res.body.entries.length, 3);
  const [sunita, harpreet, unclear] = res.body.entries;
  assert.equal(sunita.needsCheck, false);
  assert.ok(sunita.customer.id);
  assert.equal(harpreet.needsCheck, true);
  assert.equal(harpreet.customer.candidates.length, 2);
  assert.equal(unclear.needsCheck, true);
  const list = (await agent.get('/api/customers')).body.customers;
  assert.ok(list.every((c) => c.balance === 0), 'scan must not save entries');
  const part = sent[sent.length - 1].contents[0].parts[1];
  assert.equal(part.inlineData.mimeType, 'image/png');
});

test('AI reminders contain no customer data and unsafe ones are replaced', async () => {
  const { agent } = await newShop(app, { shopName: 'Verma Store' });
  const c = (await agent.post('/api/customers').send({ name: 'Imran Qureshi' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 300 });

  sent.length = 0;
  nextAnswer = JSON.stringify({ message: 'Hi {NAME}, {SHOP} here. {AMOUNT} is pending. Pay here: {LINK}' });
  let res = await agent.post('/api/ai/reminder').send({ customerId: c.id, language: 'en', tone: 'friendly' });
  assert.equal(res.body.engine, 'gemini');
  assert.equal(res.body.message, `Hi Imran, Verma Store here. ₹300 is pending. Pay here: ${res.body.payUrl}`);
  const prompt = JSON.stringify(sent[0]);
  assert.doesNotMatch(prompt, /Imran|Verma|300/);

  nextAnswer = JSON.stringify({ message: '{NAME} pay {AMOUNT} to {SHOP} now or we file a police case. {LINK}' });
  res = await agent.post('/api/ai/reminder').send({ customerId: c.id, language: 'en', tone: 'firm' });
  assert.equal(res.body.engine, 'template');
  assert.doesNotMatch(res.body.message, /police/i);

  nextAnswer = JSON.stringify({ message: 'Hello {NAME}, please pay.' });
  res = await agent.post('/api/ai/reminder').send({ customerId: c.id, language: 'en', tone: 'polite' });
  assert.equal(res.body.engine, 'template', 'missing placeholders fall back to template');
});

function sign(body) {
  return crypto.createHmac('sha256', 'whsec_dummy').update(body).digest('hex');
}

test('Razorpay: link creation sends no customer contact details', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Link Person', phone: '9876543210' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 500 });
  const token = (await agent.post('/api/ai/reminder').send({ customerId: c.id, language: 'en', tone: 'polite' })).body.payUrl.split('/pay/')[1];

  const realFetch = global.fetch;
  let captured;
  global.fetch = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body), headers: opts.headers };
    return new Response(JSON.stringify({ id: 'plink_test123', short_url: 'https://rzp.io/i/test' }), { status: 200 });
  };
  try {
    const res = await request(app).post(`/api/pay/${token}/start`).send({ amount: 500 });
    assert.equal(res.status, 201);
    assert.equal(res.body.url, 'https://rzp.io/i/test');
  } finally {
    global.fetch = realFetch;
  }
  assert.equal(captured.url, 'https://api.razorpay.com/v1/payment_links');
  assert.equal(captured.body.amount, 50000);
  assert.equal(captured.body.currency, 'INR');
  assert.equal(captured.body.customer, undefined);
  assert.deepEqual(captured.body.notify, { sms: false, email: false });
  assert.doesNotMatch(JSON.stringify(captured.body), /9876543210/);

  const demo = await request(app).post(`/api/pay/${token}/demo-complete`).send({ paymentId: '507f1f77bcf86cd799439011' });
  assert.equal(demo.status, 404, 'fake payments are impossible when real payments are on');
});

test('Razorpay webhooks: signature checked, duplicates ignored', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Hook Person' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 900 });
  const token = (await agent.post('/api/ai/reminder').send({ customerId: c.id, language: 'en', tone: 'polite' })).body.payUrl.split('/pay/')[1];
  const realFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ id: 'plink_hook1', short_url: 'https://rzp.io/i/h' }), { status: 200 });
  let paymentId;
  try {
    paymentId = (await request(app).post(`/api/pay/${token}/start`).send({ amount: 900 })).body.paymentId;
  } finally {
    global.fetch = realFetch;
  }

  const event = {
    event: 'payment_link.paid',
    payload: {
      payment_link: { entity: { id: 'plink_hook1', amount_paid: 90000, status: 'paid' } },
      payment: { entity: { id: 'pay_abc123', amount: 90000 } },
    },
  };
  const body = JSON.stringify(event);

  const forged = await request(app)
    .post('/api/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', 'deadbeef')
    .send(body);
  assert.equal(forged.status, 400);

  const send = (eventId) =>
    request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('Origin', 'https://api.razorpay.com')
      .set('x-razorpay-signature', sign(body))
      .set('x-razorpay-event-id', eventId)
      .send(body);

  const first = await send('evt_1');
  assert.equal(first.status, 200);
  assert.equal(first.body.recorded, true);
  const retry = await send('evt_1');
  assert.equal(retry.body.ignored, 'duplicate');
  const sameMoneyNewEvent = await send('evt_2');
  assert.equal(sameMoneyNewEvent.body.ignored, 'duplicate');

  const detail = await agent.get(`/api/customers/${c.id}`);
  assert.equal(detail.body.customer.balance, 0);
  assert.equal(detail.body.entries.filter((e) => e.source === 'payment').length, 1);
  assert.equal((await Payment.findById(paymentId)).status, 'paid');
});
