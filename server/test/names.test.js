const test = require('node:test');
const assert = require('node:assert/strict');
const { nameKey, matchCustomer } = require('../src/utils/names');
const { pseudonymise } = require('../src/services/ai/gemini');
const { toPaise } = require('../src/utils/money');

const customers = ['Ramesh Kumar', 'Rajesh Gupta', 'Sunita Devi', 'Harpreet Singh', 'Harpreet Kaur'].map((n, i) => ({
  _id: String(i),
  name: n,
  nameKey: nameKey(n),
}));

test('nameKey strips honorifics and punctuation', () => {
  assert.equal(nameKey('  Ramesh ji!! '), 'ramesh');
  assert.equal(nameKey('Sunita Devi'), 'sunita devi');
});

test('matches first name to a single customer', () => {
  assert.equal(matchCustomer('Ramesh', customers).match.name, 'Ramesh Kumar');
  assert.equal(matchCustomer('sunita', customers).match.name, 'Sunita Devi');
});

test('asks when a first name matches two customers', () => {
  const r = matchCustomer('Harpreet', customers);
  assert.equal(r.match, null);
  assert.equal(r.candidates.length, 2);
});

test('offers close spellings but never auto-picks them', () => {
  const r = matchCustomer('Rames', customers);
  assert.equal(r.match, null);
  assert.ok(r.candidates.some((c) => c.name === 'Ramesh Kumar'));
});

test('unknown names have no match', () => {
  const r = matchCustomer('Zoya', customers);
  assert.equal(r.match, null);
  assert.equal(r.candidates.length, 0);
});

test('pseudonymise hides known names before AI', () => {
  const { text, map } = pseudonymise('Ramesh ne 250 diye aur Sunita Devi ne 100', customers);
  assert.ok(!/ramesh|sunita/i.test(text), text);
  assert.equal(map.size, 2);
});

test('toPaise converts safely', () => {
  assert.equal(toPaise(250), 25000);
  assert.equal(toPaise('1,250.50'), 125050);
  assert.equal(toPaise(0.1 + 0.2), 30);
  assert.equal(toPaise(0), null);
  assert.equal(toPaise(-5), null);
  assert.equal(toPaise(100001), null);
  assert.equal(toPaise('abc'), null);
});
