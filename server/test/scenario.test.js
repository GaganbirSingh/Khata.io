// The exact case from the shopkeeper: ₹1,500 old udhaar is pending. The
// customer buys ₹1,500 of goods today and pays ₹1,500. That money is for
// today's goods, so the old ₹1,500 must still be pending and still overdue.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setupEnv, connect, disconnect, newShop } = require('./helpers');

setupEnv();
const { createApp } = require('../src/app');
const app = createApp();

test.before(connect);
test.after(disconnect);

const forty = () => new Date(Date.now() - 40 * 86400000).toISOString();

test('buying and paying ₹1,500 today keeps the old ₹1,500 pending', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Anil Yadav' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 1500, items: 'Gas advance', date: forty() });

  const parsed = await agent.post('/api/ai/parse').send({ text: 'Anil ne 1500 ka saman liya, 1500 de diye' });
  assert.equal(parsed.body.customer.id, c.id);
  assert.equal(parsed.body.customer.balance, 1500, 'old baaki is shown so the shopkeeper can see it stays');
  assert.deepEqual(parsed.body.entries.map((e) => [e.type, e.amount]), [['nakad', 1500]]);

  const saved = await agent.post('/api/entries/bulk').send({
    entries: parsed.body.entries.map((e) => ({ customerId: c.id, type: e.type, amount: e.amount, items: e.items })),
  });
  assert.equal(saved.status, 201);

  const detail = (await agent.get(`/api/customers/${c.id}`)).body;
  assert.equal(detail.customer.balance, 1500, 'old udhaar still pending');
  const old = detail.entries.find((e) => e.type === 'udhaar');
  assert.equal(old.status, 'due');
  assert.equal(detail.entries.find((e) => e.type === 'nakad').amount, 1500);

  const overdue = (await agent.get('/api/customers?filter=overdue')).body.customers;
  assert.deepEqual(overdue.map((x) => x.id), [c.id], 'still overdue: buying something new does not reset the clock');

  const rep = (await agent.get('/api/reports?days=7')).body;
  assert.equal(rep.collected, 0, 'nakad is not a khata collection');
  assert.equal(rep.cashSales, 1500);
  assert.equal(rep.udhaarGiven, 0);
  assert.equal(rep.oldestPending[0].daysPending, 40);

  const dash = (await agent.get('/api/dashboard')).body;
  assert.equal(dash.today.received, 0);
  assert.equal(dash.today.cashSales, 1500);
  assert.equal(dash.outstanding, 1500);
  assert.equal(dash.overdue[0].id, c.id);
});

test('a real khata payment pays the old udhaar first and clears overdue when done', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Mohit Verma' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 1500, date: forty() });
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 200 });

  await agent.post('/api/entries').send({ customerId: c.id, type: 'jama', amount: 500 });
  let detail = (await agent.get(`/api/customers/${c.id}`)).body;
  let [newer, older] = detail.entries.filter((e) => e.type === 'udhaar');
  assert.equal(older.status, 'part');
  assert.equal(older.paidAmount, 500);
  assert.equal(newer.status, 'due');
  assert.equal((await agent.get('/api/customers?filter=overdue')).body.customers.length, 1);

  await agent.post('/api/entries').send({ customerId: c.id, type: 'jama', amount: 1000 });
  detail = (await agent.get(`/api/customers/${c.id}`)).body;
  [newer, older] = detail.entries.filter((e) => e.type === 'udhaar');
  assert.equal(older.status, 'paid');
  assert.equal(newer.status, 'due');
  assert.equal(detail.customer.balance, 200);
  assert.equal((await agent.get('/api/customers?filter=overdue')).body.customers.length, 0);
});

test('deleting an entry re-settles everything', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Delete Test' })).body.customer;
  await agent.post('/api/entries').send({ customerId: c.id, type: 'udhaar', amount: 300, date: forty() });
  const pay = (await agent.post('/api/entries').send({ customerId: c.id, type: 'jama', amount: 300 })).body.entry;
  assert.equal((await agent.get('/api/customers?filter=overdue')).body.customers.length, 0);
  await agent.delete(`/api/entries/${pay.id}`);
  const detail = (await agent.get(`/api/customers/${c.id}`)).body;
  assert.equal(detail.customer.balance, 300);
  assert.equal(detail.entries[0].status, 'due');
  assert.equal((await agent.get('/api/customers?filter=overdue')).body.customers.length, 1);
});

test('nakad can be added by hand and does not change the balance', async () => {
  const { agent } = await newShop(app);
  const c = (await agent.post('/api/customers').send({ name: 'Cash Buyer' })).body.customer;
  const r = await agent.post('/api/entries').send({ customerId: c.id, type: 'nakad', amount: 99, items: 'Chai' });
  assert.equal(r.status, 201);
  assert.equal(r.body.customer.balance, 0);
});
