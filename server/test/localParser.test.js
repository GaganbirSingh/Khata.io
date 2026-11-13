const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLocal } = require('../src/services/ai/localParser');

const cases = [
  ['Ramesh ne 250 ka atta liya, 500 de diye', 'Ramesh', [['udhaar', 250, 'atta'], ['jama', 500, '']]],
  ['Sunita se 800 mile', 'Sunita', [['jama', 800, '']]],
  ['Imran ko 300 ka saaman diya', 'Imran', [['udhaar', 300, 'saaman']]],
  ['Kavita ji ne ₹1,250 ka doodh, bread liya', 'Kavita', [['udhaar', 1250, 'doodh, bread']]],
  ['Rajesh Kumar ne 120 ka atta, tel liya aur 50 jama kiye', 'Rajesh Kumar', [['udhaar', 120, 'atta, tel'], ['jama', 50, '']]],
  ['Ramesh took atta for 250 and paid 500', 'Ramesh', [['udhaar', 250, 'atta'], ['jama', 500, '']]],
  ['Ramesh paid 200', 'Ramesh', [['jama', 200, '']]],
  ['Mohit ne 99.50 ka anda liya', 'Mohit', [['udhaar', 99.5, 'anda']]],
];

for (const [text, name, expected] of cases) {
  test(`parses: ${text}`, () => {
    const r = parseLocal(text);
    assert.equal(r.customerName, name);
    assert.deepEqual(
      r.entries.map((e) => [e.type, e.amount, e.items]),
      expected
    );
    assert.equal(r.needsCheck, false);
  });
}

test('flags unsure entries for checking', () => {
  const r = parseLocal('Harpreet 640');
  assert.equal(r.customerName, 'Harpreet');
  assert.equal(r.entries[0].sure, false);
  assert.equal(r.needsCheck, true);
});

test('flags missing name and missing amount', () => {
  assert.ok(parseLocal('500 de diye').warnings.includes('no_name'));
  assert.ok(parseLocal('Ramesh ne atta liya').warnings.includes('no_amount'));
});

test('does not guess non-Latin script', () => {
  const r = parseLocal('रमेश ने 250 का आटा लिया');
  assert.equal(r.entries.length, 0);
  assert.ok(r.warnings.includes('script_not_supported'));
});

test('rejects amounts over the limit', () => {
  const r = parseLocal('Ramesh ne 500000 ka saman liya');
  assert.equal(r.entries.length, 0);
  assert.equal(r.needsCheck, true);
});
