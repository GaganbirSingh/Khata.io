// Khata rules, shared by the server and the browser demo.
//
// Entry types
//   udhaar  goods or money given on credit: the customer owes more
//   jama    money paid towards the khata: the customer owes less
//   nakad   goods bought and paid for on the spot: recorded for history,
//           but it does not touch the khata balance or old baaki
//
// Settlement
//   Jama pays off the OLDEST open udhaar first. So if Ramesh has ₹1,500
//   pending from last month and pays ₹500 today, last month's udhaar drops to
//   ₹1,000 and is still the oldest thing he owes. A customer stays overdue
//   until their old udhaar is actually paid, not just because they bought
//   something new.

const TYPES = ['udhaar', 'jama', 'nakad'];

function effect(type, amountPaise) {
  if (type === 'udhaar') return amountPaise;
  if (type === 'jama') return -amountPaise;
  return 0;
}

function sortKey(e) {
  const d = new Date(e.date).getTime();
  const c = e.createdAt ? new Date(e.createdAt).getTime() : 0;
  return [d, c];
}

// entries: [{ id, type, amountPaise, date, createdAt? }]
// Returns the balance, the date of the oldest unpaid udhaar, and for every
// udhaar entry how much of it has been paid off.
function settle(entries) {
  const list = [...entries]
    .filter((e) => e.type === 'udhaar' || e.type === 'jama')
    .sort((a, b) => {
      const [ad, ac] = sortKey(a);
      const [bd, bc] = sortKey(b);
      return ad - bd || ac - bc;
    });

  const open = []; // { id, remaining, date }
  const paid = new Map(); // udhaar id -> paise paid off
  let credit = 0; // advance paid beyond what was owed

  for (const e of list) {
    const id = String(e.id);
    if (e.type === 'udhaar') {
      paid.set(id, 0);
      let remaining = e.amountPaise;
      if (credit > 0) {
        const use = Math.min(credit, remaining);
        credit -= use;
        remaining -= use;
        paid.set(id, use);
      }
      if (remaining > 0) open.push({ id, remaining, date: e.date });
    } else {
      let money = e.amountPaise;
      while (money > 0 && open.length) {
        const first = open[0];
        const use = Math.min(money, first.remaining);
        first.remaining -= use;
        money -= use;
        paid.set(first.id, paid.get(first.id) + use);
        if (first.remaining === 0) open.shift();
      }
      credit += money;
    }
  }

  const owed = open.reduce((s, o) => s + o.remaining, 0);
  return {
    balancePaise: owed - credit,
    oldestDueAt: open.length ? new Date(open[0].date) : null,
    paid, // Map: udhaar id -> paise already paid off
    open,
  };
}

// Status of one udhaar entry after settlement, for the ledger.
function udhaarStatus(entry, paidMap) {
  const p = paidMap.get(String(entry.id)) || 0;
  if (p >= entry.amountPaise) return { status: 'paid', paidPaise: entry.amountPaise };
  if (p > 0) return { status: 'part', paidPaise: p };
  return { status: 'due', paidPaise: 0 };
}

// When one note has both a purchase and a payment, the payment covers
// today's goods first ("paid on the spot"). Only money beyond that goes to
// old baaki, and only goods beyond that become new udhaar.
//   buy 1500, pay 1500 -> nakad 1500 (old baaki untouched)
//   buy 250,  pay 500  -> nakad 250 + jama 250
//   buy 500,  pay 200  -> nakad 200 + udhaar 300
// Amounts are in rupees here (as typed); results are rounded to paise.
function applySpotPayment(entries) {
  const buys = entries.filter((e) => e.type === 'udhaar');
  const pays = entries.filter((e) => e.type === 'jama');
  const totalBuy = Math.round(buys.reduce((s, e) => s + Number(e.amount), 0) * 100);
  const totalPay = Math.round(pays.reduce((s, e) => s + Number(e.amount), 0) * 100);
  if (!totalBuy || !totalPay) return { entries, spot: null };

  const spot = Math.min(totalBuy, totalPay);
  const items = buys.map((e) => e.items).filter(Boolean).join(', ').slice(0, 120);
  const sure = entries.every((e) => e.sure !== false);
  const out = [{ type: 'nakad', amount: spot / 100, items, sure }];
  if (totalBuy > spot) out.push({ type: 'udhaar', amount: (totalBuy - spot) / 100, items: items ? `${items} (baaki)`.slice(0, 120) : '', sure });
  if (totalPay > spot) out.push({ type: 'jama', amount: (totalPay - spot) / 100, items: 'Purane baaki mein', sure });
  return {
    entries: out,
    spot: { paidNow: spot / 100, toOldBaaki: Math.max(0, totalPay - spot) / 100, newUdhaar: Math.max(0, totalBuy - spot) / 100 },
  };
}

module.exports = { TYPES, effect, settle, udhaarStatus, applySpotPayment };
