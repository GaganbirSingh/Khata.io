const test = require('node:test');
const assert = require('node:assert/strict');
const { setupEnv, connect, disconnect, newShop } = require('./helpers');

setupEnv();
const request = require('supertest');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Customer = require('../src/models/Customer');
const Entry = require('../src/models/Entry');
const PaymentRequest = require('../src/models/PaymentRequest');
const { recomputeBalance } = require('../src/services/ledger');
const { runCleanup } = require('../src/services/accountData');

const app = createApp();
const ORIGIN = 'http://localhost:5173';

test.before(connect);
test.after(disconnect);

test('register requires consent and age confirmation', async () => {
  const base = { email: 'a@example.com', password: 'longenough1', shopName: 'A Store' };
  let res = await request(app).post('/api/auth/register').send({ ...base, ageConfirmed: true });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Terms/);
  res = await request(app).post('/api/auth/register').send({ ...base, acceptTerms: true });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /18/);
  res = await request(app).post('/api/auth/register').send({ ...base, acceptTerms: true, ageConfirmed: true });
  assert.equal(res.status, 201);
  const user = await User.findOne({ email: 'a@example.com' });
  assert.equal(user.consent.ageConfirmed, true);
  assert.ok(user.consent.termsVersion && user.consent.acceptedAt);
  assert.notEqual(user.passwordHash, 'longenough1');
  assert.equal(res.body.user.passwordHash, undefined);
});

test('session cookie is httpOnly and SameSite', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'cookie@example.com', password: 'longenough1', shopName: 'C Store', acceptTerms: true, ageConfirmed: true });
  const cookie = res.headers['set-cookie'].join(';');
  assert.match(cookie, /uk_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('login gives one generic error for wrong email or password', async () => {
  const { credentials } = await newShop(app);
  const wrongPw = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'nope-nope' });
  const noUser = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'nope-nope' });
  assert.equal(wrongPw.status, 401);
  assert.equal(noUser.status, 401);
  assert.equal(wrongPw.body.error, noUser.body.error);
  const ok = await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password });
  assert.equal(ok.status, 200);
});

test('protected routes need a session', async () => {
  for (const path of ['/api/dashboard', '/api/customers', '/api/reports', '/api/account/export']) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, path);
  }
});

test('requests from other websites are blocked (CSRF)', async () => {
  const { agent } = await newShop(app);
  const bad = await agent.post('/api/customers').set('Origin', 'https://evil.example').send({ name: 'X' });
  assert.equal(bad.status, 403);
  const good = await agent.post('/api/customers').set('Origin', ORIGIN).send({ name: 'X' });
  assert.equal(good.status, 201);
});

test('security headers are set', async () => {
  const res = await request(app).get('/api/health');
  assert.match(res.headers['content-security-policy'], /default-src 'self'/);
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('customers: create, validate phone, prevent duplicates', async () => {
  const { agent } = await newShop(app);
  let res = await agent.post('/api/customers').send({ name: 'Ramesh Kumar', phone: '+91 98765 43210' });
  assert.equal(res.status, 201);
  assert.equal(res.body.customer.phone, '9876543210');
  res = await agent.post('/api/customers').send({ name: 'ramesh  kumar' });
  assert.equal(res.status, 409);
  res = await agent.post('/api/customers').send({ name: 'Bad Phone', phone: '12345' });
  assert.equal(res.status, 400);
  res = await agent.post('/api/customers').send({ name: 'No Phone' });
  assert.equal(res.status, 201);
  assert.equal(res.body.customer.phone, null);
});

test('a shop can never see another shop\'s data', async () => {
  const a = await newShop(app);
  const b = await newShop(app);
  const c = (await a.agent.post('/api/customers').send({ name: 'Private Person' })).body.customer;
  const e = (await a.agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 100 })).body.entry;
  assert.equal((await b.agent.get(`/api/customers/${c.id}`)).status, 404);
  assert.equal((await b.agent.patch(`/api/customers/${c.id}`).send({ name: 'Hacked' })).status, 404);
  assert.equal((await b.agent.delete(`/api/customers/${c.id}`)).status, 404);
  assert.equal((await b.agent.delete(`/api/entries/${e.id}`)).status, 404);
  assert.equal((await b.agent.post('/api/entries').send({ customerId: c.id, type: 'jama', amount: 100 })).status, 404);
  assert.equal((await b.agent.get('/api/customers')).body.customers.length, 0);
  assert.equal((await b.agent.post('/api/ai/reminder').send({ customerId: c.id, language: 'hi', tone: 'polite' })).status, 404);
});

test('operator injection in ids and queries is rejected', async () => {
  const { agent } = await newShop(app);
  const res = await agent.post('/api/entries').send({ customerId: { $ne: null }, type: 'udhaar', amount: 10 });
  assert.equal(res.status, 400);
  const login = await request(app).post('/api/auth/login').send({ email: { $ne: '' }, password: { $ne: '' } });
  assert.equal(login.status, 400);
});

test('entries update balances exactly, in paise', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Balance Test' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 0.1, items: 'a' });
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 0.2, items: 'b' });
  let res = await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: '1,250.50' });
  assert.equal(res.status, 201);
  res = await agent.post('/api/entries').send({ customerId: c.id, type: 'jama', amount: 500 });
  assert.equal(res.body.customer.balance, 750.8);
  const db = await Customer.findById(c.id);
  assert.equal(db.balancePaise, 75080);
  assert.equal(await recomputeBalance(c.id), 75080);

  const bad = await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: -5 });
  assert.equal(bad.status, 400);
  const tooBig = await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 100001 });
  assert.equal(tooBig.status, 400);
  const future = await agent
    .post('/api/entries')
    .send({ customerId: c.id, type: 'udhaar', amount: 5, date: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(future.status, 400);
});

test('deleting an entry reverses the balance', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Undo Test' })).body.customer;
  const e = (await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 300 })).body.entry;
  const res = await agent.delete(`/api/entries/${e.id}`);
  assert.equal(res.body.customer.balance, 0);
});

test('bulk save creates new customers once and links entries', async () => {
  const { agent } = await newShop(app);
  const existing = (await agent.post('/api/customers').send({ name: 'Old Customer' })).body.customer;
  const res = await agent.post('/api/entries/bulk').send({
    entries: [
      { newCustomerName: 'Naya Grahak', type: 'udhaar', amount: 100, source: 'scan' },
      { newCustomerName: 'naya grahak', type: 'udhaar', amount: 50, source: 'scan' },
      { customerId: existing.id, type: 'jama', amount: 20, source: 'scan' },
    ],
  });
  assert.equal(res.status, 201);
  const list = (await agent.get('/api/customers')).body.customers;
  const naya = list.filter((c) => c.name.toLowerCase() === 'naya grahak');
  assert.equal(naya.length, 1);
  assert.equal(naya[0].balance, 150);
  assert.equal(list.find((c) => c.id === existing.id).balance, -20);
});

test('bulk save rejects the whole batch if any entry is invalid', async () => {
  const { agent } = await newShop(app);
  const res = await agent.post('/api/entries/bulk').send({
    entries: [
      { newCustomerName: 'Should Not Exist', type: 'udhaar', amount: 100 },
      { newCustomerName: 'Bad', type: 'udhaar', amount: 0 },
    ],
  });
  assert.equal(res.status, 400);
  assert.equal((await agent.get('/api/customers')).body.customers.length, 0);
});

test('AI parse works offline with the local reader', async () => {
  const { agent } = await newShop(app);
  await agent.post('/api/customers').send({ name: 'Ramesh Kumar' });
  const before = await Entry.countDocuments({});
  const res = await agent.post('/api/ai/parse').send({ text: 'Ramesh ne 250 ka atta liya, 500 de diye' });
  assert.equal(res.status, 200);
  assert.equal(res.body.engine, 'local');
  assert.equal(res.body.customer.name, 'Ramesh Kumar');
  assert.ok(res.body.customer.id);
  // ₹250 of today's ₹500 pays for the atta on the spot; ₹250 goes to old baaki.
  assert.deepEqual(res.body.entries.map((e) => [e.type, e.amount]), [['nakad', 250], ['jama', 250]]);
  assert.deepEqual(res.body.rawEntries.map((e) => [e.type, e.amount]), [['udhaar', 250], ['jama', 500]]);
  assert.deepEqual(res.body.spot, { paidNow: 250, toOldBaaki: 250, newUdhaar: 0 });
  // Parsing never saves anything by itself; the shopkeeper must confirm.
  assert.equal(await Entry.countDocuments({}), before);
});

test('scan explains that AI must be configured', async () => {
  const { agent } = await newShop(app);
  const res = await agent.post('/api/ai/scan').attach('photo', Buffer.from('not an image'), 'x.jpg');
  assert.equal(res.status, 503);
});

test('reminders: template message, pay link, WhatsApp link, no auto-send', async () => {
  const { agent, user } = await newShop(app, { shopName: 'Gupta Kirana' });
  const withPhone = (await agent.post('/api/customers').send({ name: 'Sunita Devi', phone: '9876543210' })).body.customer;
  const noPhone = (await agent.post('/api/customers').send({ name: 'Imran Q' })).body.customer;
  await agent.post('/api/entries').send({ customerId: withPhone.id, type: 'udhaar', amount: 1250 });
  await agent.post('/api/entries').send({ customerId: noPhone.id, type: 'udhaar', amount: 90 });

  const preview = await agent.post('/api/ai/reminder').send({ customerId: withPhone.id, language: 'hi', tone: 'firm' });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.engine, 'template');
  assert.match(preview.body.message, /Sunita/);
  assert.match(preview.body.message, /₹1,250/);
  assert.match(preview.body.message, /Gupta Kirana/);
  assert.ok(preview.body.message.includes(preview.body.payUrl));
  assert.doesNotMatch(preview.body.message, /police|legal|penalty|interest/i);

  const sent = await agent
    .post('/api/reminders')
    .send({ customerId: withPhone.id, language: 'hi', tone: 'firm', message: 'Edited by shopkeeper, please pay' });
  assert.equal(sent.status, 201);
  assert.ok(sent.body.whatsappUrl.startsWith('https://wa.me/919876543210?text='));
  const decoded = decodeURIComponent(sent.body.whatsappUrl.split('text=')[1]);
  assert.ok(decoded.includes(preview.body.payUrl), 'pay link is always added');

  const p2 = await agent.post('/api/ai/reminder').send({ customerId: noPhone.id, language: 'en', tone: 'polite' });
  const s2 = await agent.post('/api/reminders').send({ customerId: noPhone.id, language: 'en', tone: 'polite', message: p2.body.message });
  assert.ok(s2.body.whatsappUrl.startsWith('https://wa.me/?text='));

  const history = await agent.get('/api/reminders');
  assert.equal(history.body.reminders.length, 2);
  assert.ok(user.id);
});

test('all 9 reminder templates are respectful and complete', async () => {
  const { TEMPLATES, PLACEHOLDERS } = { ...require('../src/services/reminders'), ...require('../src/services/ai/gemini') };
  for (const lang of Object.keys(TEMPLATES)) {
    for (const tone of Object.keys(TEMPLATES[lang])) {
      const t = TEMPLATES[lang][tone];
      for (const p of PLACEHOLDERS) assert.equal(t.split(p).length, 2, `${lang}/${tone} ${p}`);
      assert.doesNotMatch(t, /police|court|legal|penalty|interest|fine\b/i);
    }
  }
});

async function shopWithDue(amount = 1000) {
  const s = await newShop(app, { shopName: 'Pay Test Store' });
  const c = (await s.agent.post('/api/customers').send({ name: 'Payer Person' })).body.customer;
  await s.agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount });
  const preview = await s.agent.post('/api/ai/reminder').send({ customerId: c.id, language: 'en', tone: 'polite' });
  const token = preview.body.payUrl.split('/pay/')[1];
  return { ...s, customer: c, token };
}

test('pay page shows only what the customer needs', async () => {
  const { token } = await shopWithDue(1000);
  const res = await request(app).get(`/api/pay/${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.customerFirstName, 'Payer');
  assert.equal(res.body.amountDue, 1000);
  assert.equal(res.body.shopName, 'Pay Test Store');
  assert.equal(res.body.paymentMode, 'demo');
  const keys = Object.keys(res.body).sort();
  assert.deepEqual(keys, ['amountDue', 'customerFirstName', 'entries', 'expiresAt', 'isDemo', 'paymentMode', 'shopName']);
  assert.equal((await request(app).get('/api/pay/not-a-real-token-123456')).status, 404);
});

test('demo payment is recorded exactly once', async () => {
  const { token, agent, customer } = await shopWithDue(1000);
  const tooMuch = await request(app).post(`/api/pay/${token}/start`).send({ amount: 1001 });
  assert.equal(tooMuch.status, 400);
  const start = await request(app).post(`/api/pay/${token}/start`).send({ amount: 400 });
  assert.equal(start.status, 201);
  assert.equal(start.body.mode, 'demo');
  const [first, second] = await Promise.all([
    request(app).post(`/api/pay/${token}/demo-complete`).send({ paymentId: start.body.paymentId }),
    request(app).post(`/api/pay/${token}/demo-complete`).send({ paymentId: start.body.paymentId }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const third = await request(app).post(`/api/pay/${token}/demo-complete`).send({ paymentId: start.body.paymentId });
  assert.equal(third.body.amountDue, 600);
  const detail = await agent.get(`/api/customers/${customer.id}`);
  assert.equal(detail.body.customer.balance, 600);
  assert.equal(detail.body.entries.filter((e) => e.source === 'payment').length, 1);
  const status = await request(app).get(`/api/pay/${token}/status/${start.body.paymentId}`);
  assert.equal(status.body.status, 'paid');

  const payEntry = detail.body.entries.find((e) => e.source === 'payment');
  const del = await agent.delete(`/api/entries/${payEntry.id}`);
  assert.equal(del.status, 400, 'online payments cannot be deleted');
});

test('expired pay links stop working', async () => {
  const { token } = await shopWithDue(100);
  await PaymentRequest.updateOne({ token }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await request(app).get(`/api/pay/${token}`)).status, 404);
});

test('dashboard and reports add up', async () => {
  const { agent } = await newShop(app);
  const a = (await agent.post('/api/customers').send({ name: 'Report A' })).body.customer;
  const b = (await agent.post('/api/customers').send({ name: 'Report B' })).body.customer;
  await agent.post('/api/entries').send({ customerId: a.id, type: 'udhaar', amount: 1000 });
  await agent.post('/api/entries').send({ customerId: a.id, type: 'jama', amount: 400 });
  await agent.post('/api/entries').send({ customerId: b.id, type: 'udhaar', amount: 250 });
  const dash = await agent.get('/api/dashboard');
  assert.equal(dash.body.today.received, 400);
  assert.equal(dash.body.today.udhaarGiven, 1250);
  assert.equal(dash.body.outstanding, 850);
  assert.equal(dash.body.customersWithDue, 2);
  const rep = await agent.get('/api/reports?days=30');
  assert.equal(rep.body.udhaarGiven, 1250);
  assert.equal(rep.body.collected, 400);
  assert.equal(rep.body.collectionRate, 32);
  assert.equal(rep.body.outstanding, 850);
  assert.equal(rep.body.series.length, 6);
  const thisMonth = rep.body.series[5];
  assert.equal(thisMonth.udhaar, 1250);
  assert.equal(thisMonth.jama, 400);
});

test('customer filters', async () => {
  const { agent } = await newShop(app);
  const a = (await agent.post('/api/customers').send({ name: 'Due One' })).body.customer;
  const b = (await agent.post('/api/customers').send({ name: 'Clear One' })).body.customer;
  const old = (await agent.post('/api/customers').send({ name: 'Old One' })).body.customer;
  await agent.post('/api/entries').send({ customerId: a.id, type: 'udhaar', amount: 10 });
  await agent.post('/api/entries').send({ customerId: old.id, type: 'udhaar', amount: 10, date: new Date(Date.now() - 40 * 86400000).toISOString() });
  assert.equal((await agent.get('/api/customers?filter=due')).body.customers.length, 2);
  assert.equal((await agent.get('/api/customers?filter=cleared')).body.customers[0].id, b.id);
  const overdue = (await agent.get('/api/customers?filter=overdue')).body.customers;
  assert.deepEqual(overdue.map((c) => c.id), [old.id]);
  assert.equal((await agent.get('/api/customers?q=due')).body.customers[0].id, a.id);
});

test('demo account has fictional data, no phone numbers, and expires', async () => {
  const agent = request.agent(app);
  const noConsent = await agent.post('/api/auth/demo').send({});
  assert.equal(noConsent.status, 400);
  const res = await agent.post('/api/auth/demo').send({ acceptTerms: true, ageConfirmed: true });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.isDemo, true);
  assert.equal(res.body.user.email, null);
  const customers = (await agent.get('/api/customers')).body.customers;
  assert.ok(customers.length >= 6);
  assert.ok(customers.every((c) => c.phone === null), 'demo customers must not have phone numbers');
  for (const c of customers) {
    assert.equal(await recomputeBalance(c.id), Math.round(c.balance * 100));
  }
  const dash = await agent.get('/api/dashboard');
  assert.ok(dash.body.recent.length > 0);
});

test('export returns all data; delete removes everything', async () => {
  const { agent, credentials, user } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Export Me' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 75 });
  const exp = await agent.get('/api/account/export');
  assert.equal(exp.status, 200);
  assert.match(exp.headers['content-disposition'], /attachment/);
  assert.equal(exp.body.customers.length, 1);
  assert.equal(exp.body.entries.length, 1);
  assert.equal(exp.body.account.email, credentials.email);
  assert.equal(exp.body.account.passwordHash, undefined);

  const wrong = await agent.delete('/api/account').send({ password: 'wrong-password' });
  assert.equal(wrong.status, 400);
  const del = await agent.delete('/api/account').send({ password: credentials.password });
  assert.equal(del.status, 200);
  assert.equal(await User.countDocuments({ _id: user.id }), 0);
  assert.equal(await Customer.countDocuments({ shop: user.id }), 0);
  assert.equal(await Entry.countDocuments({ shop: user.id }), 0);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('cleanup deletes expired demos and inactive accounts only', async () => {
  const active = await newShop(app);
  const inactive = await newShop(app);
  await User.updateOne({ _id: inactive.user.id }, { $set: { lastActiveAt: new Date(Date.now() - 31 * 86400000) } });
  const demoAgent = request.agent(app);
  const demo = (await demoAgent.post('/api/auth/demo').send({ acceptTerms: true, ageConfirmed: true })).body.user;
  await User.updateOne({ _id: demo.id }, { $set: { demoExpiresAt: new Date(Date.now() - 1000) } });
  await runCleanup();
  assert.equal(await User.countDocuments({ _id: active.user.id }), 1);
  assert.equal(await User.countDocuments({ _id: inactive.user.id }), 0);
  assert.equal(await User.countDocuments({ _id: demo.id }), 0);
  assert.equal(await Customer.countDocuments({ shop: demo.id }), 0);
  assert.equal((await demoAgent.get('/api/dashboard')).status, 401);
});

test('settings update and password change', async () => {
  const { agent, credentials } = await newShop(app);
  const res = await agent.patch('/api/account').send({ shopName: 'New Name', language: 'pa', defaultTone: 'friendly' });
  assert.equal(res.body.user.shopName, 'New Name');
  assert.equal(res.body.user.language, 'pa');
  const bad = await agent.patch('/api/account').send({ language: 'fr' });
  assert.equal(bad.status, 400);
  const pw = await agent.post('/api/account/password').send({ current: credentials.password, next: 'brand-new-password' });
  assert.equal(pw.status, 200);
  const login = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'brand-new-password' });
  assert.equal(login.status, 200);
});

test('meta exposes legal details and feature modes', async () => {
  const res = await request(app).get('/api/meta');
  assert.equal(res.body.ai.enabled, false);
  assert.equal(res.body.payments.mode, 'demo');
  assert.ok(res.body.legal.termsVersion);
  assert.equal(res.body.retentionDays, 30);
});

test('unknown API routes and bad ids return 404 without stack traces', async () => {
  const { agent } = await newShop(app);
  const res = await agent.get('/api/customers/not-an-id');
  assert.equal(res.status, 404);
  assert.equal(res.body.stack, undefined);
  assert.equal((await request(app).get('/api/nope')).status, 404);
});
