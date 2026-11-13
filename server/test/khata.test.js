const test = require('node:test');
const assert = require('node:assert/strict');
const { settle, udhaarStatus, applySpotPayment } = require('../src/utils/khata');

const d = (day) => new Date(Date.UTC(2026, 8, day));
const E = (id, type, rupees, day) => ({ id, type, amountPaise: rupees * 100, date: d(day) });

test('jama pays the oldest udhaar first', () => {
  const r = settle([E('a', 'udhaar', 1500, 1), E('b', 'udhaar', 300, 20), E('c', 'jama', 500, 25)]);
  assert.equal(r.balancePaise, 130000);
  assert.deepEqual(r.oldestDueAt, d(1), 'the old udhaar is still the oldest unpaid');
  assert.deepEqual(udhaarStatus({ id: 'a', amountPaise: 150000 }, r.paid), { status: 'part', paidPaise: 50000 });
  assert.deepEqual(udhaarStatus({ id: 'b', amountPaise: 30000 }, r.paid), { status: 'due', paidPaise: 0 });
});

test('nakad never touches the khata', () => {
  const r = settle([E('a', 'udhaar', 1500, 1), E('n', 'nakad', 1500, 30)]);
  assert.equal(r.balancePaise, 150000);
  assert.deepEqual(r.oldestDueAt, d(1));
});

test('paying the old udhaar fully moves "oldest due" to the next one', () => {
  const r = settle([E('a', 'udhaar', 1500, 1), E('b', 'udhaar', 300, 20), E('c', 'jama', 1500, 25)]);
  assert.equal(r.balancePaise, 30000);
  assert.deepEqual(r.oldestDueAt, d(20));
  assert.equal(udhaarStatus({ id: 'a', amountPaise: 150000 }, r.paid).status, 'paid');
});

test('advance payment is used by later udhaar', () => {
  const r = settle([E('c', 'jama', 500, 1), E('a', 'udhaar', 300, 2), E('b', 'udhaar', 400, 3)]);
  assert.equal(r.balancePaise, 20000);
  assert.equal(udhaarStatus({ id: 'a', amountPaise: 30000 }, r.paid).status, 'paid');
  assert.deepEqual(udhaarStatus({ id: 'b', amountPaise: 40000 }, r.paid), { status: 'part', paidPaise: 20000 });
  assert.deepEqual(r.oldestDueAt, d(3));
});

test('same-day order is respected by creation time', () => {
  const day = d(5);
  const r = settle([
    { id: 'j', type: 'jama', amountPaise: 100, date: day, createdAt: new Date(2) },
    { id: 'u', type: 'udhaar', amountPaise: 100, date: day, createdAt: new Date(1) },
  ]);
  assert.equal(r.balancePaise, 0);
  assert.equal(udhaarStatus({ id: 'u', amountPaise: 100 }, r.paid).status, 'paid');
});

test('buy 1500 and pay 1500 in one note = paid on the spot', () => {
  const r = applySpotPayment([
    { type: 'udhaar', amount: 1500, items: 'saman', sure: true },
    { type: 'jama', amount: 1500, items: '', sure: true },
  ]);
  assert.deepEqual(r.entries.map((e) => [e.type, e.amount]), [['nakad', 1500]]);
  assert.deepEqual(r.spot, { paidNow: 1500, toOldBaaki: 0, newUdhaar: 0 });
});

test('pay more than today\'s goods: extra goes to old baaki', () => {
  const r = applySpotPayment([
    { type: 'udhaar', amount: 250, items: 'atta' },
    { type: 'jama', amount: 500, items: '' },
  ]);
  assert.deepEqual(r.entries.map((e) => [e.type, e.amount]), [['nakad', 250], ['jama', 250]]);
});

test('pay less than today\'s goods: the rest becomes new udhaar', () => {
  const r = applySpotPayment([
    { type: 'udhaar', amount: 500, items: 'ghee' },
    { type: 'jama', amount: 200, items: '' },
  ]);
  assert.deepEqual(r.entries.map((e) => [e.type, e.amount, e.items]), [['nakad', 200, 'ghee'], ['udhaar', 300, 'ghee (baaki)']]);
});

test('only a purchase, or only a payment, is left unchanged', () => {
  const buy = [{ type: 'udhaar', amount: 90, items: 'anda' }];
  assert.equal(applySpotPayment(buy).spot, null);
  assert.deepEqual(applySpotPayment(buy).entries, buy);
  const pay = [{ type: 'jama', amount: 90, items: '' }];
  assert.equal(applySpotPayment(pay).spot, null);
});

test('paise are exact', () => {
  const r = applySpotPayment([
    { type: 'udhaar', amount: 0.1, items: '' },
    { type: 'udhaar', amount: 0.2, items: '' },
    { type: 'jama', amount: 0.5, items: '' },
  ]);
  assert.deepEqual(r.entries.map((e) => [e.type, e.amount]), [['nakad', 0.3], ['jama', 0.2]]);
});
