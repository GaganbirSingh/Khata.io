// Browser-only copy of the Khata.io API, used for the live demo build.
// It answers the same /api routes with the same JSON shapes as the Express
// server, keeps data in memory (and in this browser's localStorage), and
// reuses the server's own parser, name matching and reminder templates.
import { parseLocal } from '../../../server/src/services/ai/localParser.js';
import { nameKey, matchCustomer } from '../../../server/src/utils/names.js';
import { toPaise, formatRupees } from '../../../server/src/utils/money.js';
import { TEMPLATES } from '../../../server/src/services/reminderTemplates.js';
import { SAMPLE } from '../../../server/src/services/demoData.js';
import { settle, udhaarStatus, applySpotPayment } from '../../../server/src/utils/khata.js';

const KEY = 'uk_demo_db_v2';
const DAY = 24 * 3600 * 1000;
const IST = 5.5 * 3600 * 1000;
const VERSION = '2026-10-03';

const id = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
const token = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function empty() {
  return { users: [], customers: [], entries: [], reminders: [], requests: [], payments: [], session: null };
}

let db = empty();
try {
  const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
  if (saved && Array.isArray(saved.users)) db = saved;
} catch {
  db = empty();
}
function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage blocked: the demo still works until the page is closed */
  }
}

class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}
const err = (status, message, field) => {
  throw new HttpError(status, message, field);
};

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- shapes (identical to the server's toPublic) ----------
const pubUser = (u) => ({
  id: u.id, email: u.isDemo ? null : u.email, shopName: u.shopName, shopType: u.shopType, language: u.language,
  defaultTone: u.defaultTone, isDemo: u.isDemo, demoExpiresAt: u.demoExpiresAt || null, createdAt: u.createdAt,
});
const pubCustomer = (c) => ({ id: c.id, name: c.name, phone: c.phone || null, balance: c.balancePaise / 100, lastEntryAt: c.lastEntryAt || null, oldestDueAt: c.oldestDueAt || null, createdAt: c.createdAt });
const pubEntry = (e) => ({ id: e.id, customerId: e.customer, type: e.type, amount: e.amountPaise / 100, items: e.items, source: e.source, date: e.date });

function currentUser() {
  const u = db.users.find((x) => x.id === db.session);
  if (!u || (u.isDemo && new Date(u.demoExpiresAt) < new Date())) err(401, 'Please log in');
  return u;
}
const shopCustomers = (u) => db.customers.filter((c) => c.shop === u.id);
function findCustomer(u, cid) {
  const c = db.customers.find((x) => x.id === cid && x.shop === u.id);
  if (!c) err(404, 'Customer not found');
  return c;
}

function recompute(c) {
  const list = db.entries.filter((e) => e.customer === c.id);
  const r = settle(list);
  c.balancePaise = r.balancePaise;
  c.oldestDueAt = r.oldestDueAt ? new Date(r.oldestDueAt).toISOString() : null;
  c.lastEntryAt = list.reduce((m, e) => (!m || e.date > m ? e.date : m), null);
  return r;
}

function addEntry(u, c, { type, amountPaise, items = '', source = 'manual', date, paymentRef }) {
  if (paymentRef && db.entries.some((e) => e.paymentRef === paymentRef)) return null;
  const e = { id: id(), shop: u.id, customer: c.id, type, amountPaise, items, source, date: (date ? new Date(date) : new Date()).toISOString(), createdAt: new Date().toISOString(), paymentRef };
  db.entries.push(e);
  recompute(c);
  return e;
}

function seed(u) {
  const now = Date.now();
  for (const s of SAMPLE) {
    const c = { id: id(), shop: u.id, name: s.name, nameKey: nameKey(s.name), balancePaise: 0, createdAt: new Date().toISOString() };
    db.customers.push(c);
    s.lines.forEach(([daysAgo, type, rupees, items], i) => {
      addEntry(u, c, { type, amountPaise: rupees * 100, items, date: new Date(now - daysAgo * DAY - (i + 1) * 37 * 60000) });
    });
  }
}

function deleteShop(u) {
  for (const k of ['customers', 'entries', 'reminders', 'requests', 'payments']) db[k] = db[k].filter((x) => x.shop !== u.id);
  db.users = db.users.filter((x) => x.id !== u.id);
  if (db.session === u.id) db.session = null;
}

function startOfDayIST() {
  const ist = new Date(Date.now() + IST);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST);
}

function amountFrom(v) {
  const p = toPaise(v);
  if (p === null) err(400, 'Enter an amount between ₹0.01 and ₹1,00,000', 'amount');
  return p;
}

function cleanPhone(v) {
  const p = String(v || '').trim().replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  if (p && !/^[6-9]\d{9}$/.test(p)) err(400, 'Enter a 10-digit Indian mobile number', 'phone');
  return p;
}

function describeMatch(name, customers) {
  if (!name) return { id: null, name: null, isNew: false, candidates: [] };
  const { match, candidates } = matchCustomer(name, customers);
  if (match) return { id: match.id, name: match.name, balance: match.balancePaise / 100, isNew: false, candidates: [] };
  return { id: null, name, isNew: candidates.length === 0, candidates: candidates.map((c) => ({ id: c.id, name: c.name, balance: c.balancePaise / 100 })) };
}

function payUrlFor(t) {
  return `${window.location.origin}${window.location.pathname}#/pay/${t}`;
}

function getRequest(u, c) {
  const now = Date.now();
  const r = db.requests
    .filter((x) => x.shop === u.id && x.customer === c.id && new Date(x.expiresAt) > now)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (r && new Date(r.expiresAt) - now > 7 * DAY) return r;
  const n = { id: id(), token: token(), shop: u.id, customer: c.id, createdAt: new Date().toISOString(), expiresAt: new Date(now + 30 * DAY).toISOString() };
  db.requests.push(n);
  return n;
}

function loadRequest(t) {
  const r = db.requests.find((x) => x.token === t && new Date(x.expiresAt) > new Date());
  const c = r && db.customers.find((x) => x.id === r.customer);
  const shop = r && db.users.find((x) => x.id === r.shop);
  if (!r || !c || !shop) err(404, 'This payment link has expired or does not exist. Please ask the shop for a new one.');
  return { r, c, shop };
}

function resolveEntries(u, list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 40) err(400, 'Invalid input');
  const checked = list.map((e) => {
    if (!['udhaar', 'jama', 'nakad'].includes(e.type)) err(400, 'Invalid input');
    if (Boolean(e.customerId) === Boolean(e.newCustomerName && String(e.newCustomerName).trim())) err(400, 'Choose a customer', 'customerId');
    if (e.customerId) findCustomer(u, e.customerId);
    if (e.newCustomerName && !nameKey(e.newCustomerName)) err(400, 'Enter a customer name');
    return { ...e, amountPaise: amountFrom(e.amount), items: String(e.items || '').trim().slice(0, 120) };
  });
  return checked.map((e) => {
    let c;
    if (e.customerId) c = findCustomer(u, e.customerId);
    else {
      const k = nameKey(e.newCustomerName);
      c = db.customers.find((x) => x.shop === u.id && x.nameKey === k);
      if (!c) {
        c = { id: id(), shop: u.id, name: String(e.newCustomerName).trim().slice(0, 60), nameKey: k, balancePaise: 0, createdAt: new Date().toISOString() };
        db.customers.push(c);
      }
    }
    return { c, e };
  });
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler });

route('GET', '/meta', () => ({
  ai: { enabled: false, tier: 'free' },
  payments: { mode: 'demo' },
  retentionDays: 30,
  demoHours: 24,
  legal: { operatorName: 'Gaganbir Singh', contactEmail: 'gsingh1_be23@thapar.edu', grievanceOfficer: 'Gaganbir Singh', city: 'Patiala, India', termsVersion: VERSION, privacyVersion: VERSION },
}));

route('GET', '/auth/me', () => ({ user: pubUser(currentUser()) }));

route('POST', '/auth/register', async ({ body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) err(400, 'Enter a valid email', 'email');
  if (String(body.password || '').length < 8) err(400, 'Password must be at least 8 characters', 'password');
  if (String(body.shopName || '').trim().length < 2) err(400, 'Enter your shop name', 'shopName');
  if (body.acceptTerms !== true) err(400, 'Please accept the Terms and Privacy Policy');
  if (body.ageConfirmed !== true) err(400, 'You must be 18 or older to use this app');
  if (db.users.some((x) => x.email === email)) err(409, 'An account with this email already exists', 'email');
  const u = {
    id: id(), email, passwordHash: await hash(body.password), shopName: body.shopName.trim().slice(0, 80), shopType: body.shopType || 'kirana',
    language: body.language || 'hi', defaultTone: 'polite', isDemo: false, createdAt: new Date().toISOString(),
    consent: { termsVersion: VERSION, privacyVersion: VERSION, ageConfirmed: true, acceptedAt: new Date().toISOString() },
  };
  db.users.push(u);
  db.session = u.id;
  return [201, { user: pubUser(u) }];
});

route('POST', '/auth/login', async ({ body }) => {
  const u = db.users.find((x) => x.email === String(body.email || '').trim().toLowerCase() && !x.isDemo);
  if (!u || u.passwordHash !== (await hash(String(body.password || '')))) err(401, 'Email or password is wrong');
  db.session = u.id;
  return { user: pubUser(u) };
});

route('POST', '/auth/logout', () => {
  db.session = null;
  return { ok: true };
});

route('POST', '/auth/demo', ({ body }) => {
  if (body.acceptTerms !== true) err(400, 'Please accept the Terms and Privacy Policy');
  if (body.ageConfirmed !== true) err(400, 'You must be 18 or older to use this app');
  const u = {
    id: id(), email: `demo-${id()}@demo.invalid`, shopName: 'Sharma General Store (demo)', shopType: 'kirana', language: 'hi',
    defaultTone: 'polite', isDemo: true, demoExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), createdAt: new Date().toISOString(),
    consent: { termsVersion: VERSION, privacyVersion: VERSION, ageConfirmed: true, acceptedAt: new Date().toISOString() },
  };
  db.users.push(u);
  seed(u);
  db.session = u.id;
  return [201, { user: pubUser(u) }];
});

route('GET', '/dashboard', () => {
  const u = currentUser();
  const today = startOfDayIST().toISOString();
  const mine = db.entries.filter((e) => e.shop === u.id);
  const todays = mine.filter((e) => e.date >= today);
  const sum = (list, t) => list.filter((e) => e.type === t).reduce((s, e) => s + e.amountPaise, 0);
  const owing = shopCustomers(u).filter((c) => c.balancePaise > 0);
  const recent = [...mine].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  return {
    shopName: u.shopName,
    today: { received: sum(todays, 'jama') / 100, cashSales: sum(todays, 'nakad') / 100, udhaarGiven: sum(todays, 'udhaar') / 100, entries: todays.length },
    outstanding: owing.reduce((s, c) => s + c.balancePaise, 0) / 100,
    customersWithDue: owing.length,
    customerCount: shopCustomers(u).length,
    recent: recent.map((e) => ({ ...pubEntry(e), customerName: db.customers.find((c) => c.id === e.customer)?.name || 'Deleted customer' })),
    topPending: [...owing].sort((a, b) => b.balancePaise - a.balancePaise).slice(0, 5).map(pubCustomer),
    overdue: owing
      .filter((c) => c.oldestDueAt && Date.now() - new Date(c.oldestDueAt) > 30 * DAY)
      .sort((a, b) => (a.oldestDueAt < b.oldestDueAt ? -1 : 1))
      .slice(0, 8)
      .map((c) => ({ ...pubCustomer(c), daysPending: Math.floor((Date.now() - new Date(c.oldestDueAt)) / DAY) })),
  };
});

route('GET', '/customers', ({ query }) => {
  const u = currentUser();
  const filter = query.get('filter');
  const cutoff = new Date(Date.now() - 30 * DAY).toISOString();
  let list = shopCustomers(u);
  if (filter === 'due') list = list.filter((c) => c.balancePaise > 0);
  if (filter === 'cleared') list = list.filter((c) => c.balancePaise <= 0);
  if (filter === 'overdue') list = list.filter((c) => c.balancePaise > 0 && c.oldestDueAt && c.oldestDueAt < cutoff);
  const q = nameKey(query.get('q') || '');
  if (q) list = list.filter((c) => c.nameKey.includes(q));
  list.sort((a, b) => b.balancePaise - a.balancePaise || a.name.localeCompare(b.name));
  return {
    customers: list.map((c) => ({
      ...pubCustomer(c),
      status: c.balancePaise <= 0 ? 'cleared' : c.oldestDueAt && c.oldestDueAt < cutoff ? 'overdue' : 'due',
    })),
  };
});

route('POST', '/customers', ({ body }) => {
  const u = currentUser();
  const name = String(body.name || '').trim().slice(0, 60);
  const k = nameKey(name);
  if (!k) err(400, 'Enter a name', 'name');
  const phone = cleanPhone(body.phone);
  if (shopCustomers(u).some((c) => c.nameKey === k)) err(409, 'A customer with this name already exists. Add a surname to tell them apart.', 'name');
  const c = { id: id(), shop: u.id, name, nameKey: k, phone: phone || undefined, balancePaise: 0, createdAt: new Date().toISOString() };
  db.customers.push(c);
  return [201, { customer: pubCustomer(c) }];
});

route('GET', '/customers/:id', ({ params }) => {
  const u = currentUser();
  const c = findCustomer(u, params.id);
  const entries = db.entries.filter((e) => e.customer === c.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const paid = settle(entries).paid;
  const reminders = db.reminders.filter((r) => r.customer === c.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 10);
  return {
    customer: pubCustomer(c),
    entries: entries.map((e) => {
      if (e.type !== 'udhaar') return pubEntry(e);
      const st = udhaarStatus(e, paid);
      return { ...pubEntry(e), status: st.status, paidAmount: st.paidPaise / 100 };
    }),
    reminders: reminders.map((r) => ({ id: r.id, createdAt: r.createdAt, amount: r.amountPaise / 100, language: r.language })),
  };
});

route('PATCH', '/customers/:id', ({ params, body }) => {
  const u = currentUser();
  const c = findCustomer(u, params.id);
  if (body.name !== undefined) {
    const k = nameKey(body.name);
    if (!k) err(400, 'Enter a name', 'name');
    if (k !== c.nameKey && shopCustomers(u).some((x) => x.nameKey === k)) err(409, 'Another customer already has this name', 'name');
    c.name = String(body.name).trim().slice(0, 60);
    c.nameKey = k;
  }
  if (body.phone !== undefined) c.phone = cleanPhone(body.phone) || undefined;
  return { customer: pubCustomer(c) };
});

route('DELETE', '/customers/:id', ({ params }) => {
  const u = currentUser();
  const c = findCustomer(u, params.id);
  for (const k of ['entries', 'reminders', 'requests', 'payments']) db[k] = db[k].filter((x) => x.customer !== c.id);
  db.customers = db.customers.filter((x) => x.id !== c.id);
  return { ok: true };
});

route('POST', '/entries', ({ body }) => {
  const u = currentUser();
  if (body.date && new Date(body.date) > new Date(Date.now() + 60000)) err(400, 'Date cannot be in the future', 'date');
  const [{ c, e }] = resolveEntries(u, [body]);
  const entry = addEntry(u, c, { type: e.type, amountPaise: e.amountPaise, items: e.items, source: e.source || 'manual', date: e.date });
  return [201, { entry: pubEntry(entry), customer: pubCustomer(c) }];
});

route('POST', '/entries/bulk', ({ body }) => {
  const u = currentUser();
  const pairs = resolveEntries(u, body.entries);
  const saved = pairs.map(({ c, e }) => pubEntry(addEntry(u, c, { type: e.type, amountPaise: e.amountPaise, items: e.items, source: e.source || 'manual' })));
  return [201, { entries: saved }];
});

route('DELETE', '/entries/:id', ({ params }) => {
  const u = currentUser();
  const e = db.entries.find((x) => x.id === params.id && x.shop === u.id);
  if (!e) err(404, 'Entry not found');
  if (e.source === 'payment') err(400, 'Payments received online cannot be deleted');
  db.entries = db.entries.filter((x) => x.id !== e.id);
  const c = db.customers.find((x) => x.id === e.customer);
  if (c) recompute(c);
  return { ok: true, customer: c ? pubCustomer(c) : null };
});

route('POST', '/ai/parse', ({ body }) => {
  const u = currentUser();
  const text = String(body.text || '').trim();
  if (!text) err(400, 'Type or say an entry');
  const local = parseLocal(text.slice(0, 500));
  const entries = local.entries
    .filter((e) => e.amount > 0 && e.amount <= 100000)
    .slice(0, 10)
    .map((e) => ({ type: e.type, amount: Math.round(e.amount * 100) / 100, items: e.items, sure: e.sure !== false }));
  const customer = describeMatch(local.customerName, shopCustomers(u));
  const note = local.warnings.includes('script_not_supported') ? 'Please type in English letters (like "Ramesh ne 250 ka atta liya").' : null;
  const { entries: split, spot } = applySpotPayment(entries);
  return { engine: 'local', customer, entries: split, rawEntries: entries, spot, needsCheck: split.length === 0 || split.some((e) => !e.sure) || !customer.id, note };
});

route('POST', '/ai/scan', () => {
  currentUser();
  err(503, 'Khata scanning needs the Gemini API key to be set up.');
});

route('POST', '/ai/reminder', ({ body }) => {
  const u = currentUser();
  const c = findCustomer(u, body.customerId);
  if (c.balancePaise <= 0) err(400, 'This customer has nothing pending');
  const template = TEMPLATES[body.language]?.[body.tone];
  if (!template) err(400, 'Invalid input');
  const link = payUrlFor(getRequest(u, c).token);
  const message = template
    .replace('{NAME}', c.name.split(' ')[0])
    .replace('{SHOP}', u.shopName.replace(/\s*\(demo\)$/i, ''))
    .replace('{AMOUNT}', formatRupees(c.balancePaise))
    .replace('{LINK}', link);
  return { engine: 'template', message, payUrl: link, amount: c.balancePaise / 100 };
});

route('POST', '/reminders', ({ body }) => {
  const u = currentUser();
  const c = findCustomer(u, body.customerId);
  if (c.balancePaise <= 0) err(400, 'This customer has nothing pending');
  let message = String(body.message || '').trim();
  if (message.length < 10) err(400, 'Message is too short');
  if (message.length > 1000) err(400, 'Message is too long');
  const link = payUrlFor(getRequest(u, c).token);
  if (!message.includes(link)) message = `${message}\n${link}`;
  const r = { id: id(), shop: u.id, customer: c.id, language: body.language, tone: body.tone, message, amountPaise: c.balancePaise, createdAt: new Date().toISOString() };
  db.reminders.push(r);
  const text = encodeURIComponent(message);
  return [201, { id: r.id, whatsappUrl: c.phone ? `https://wa.me/91${c.phone}?text=${text}` : `https://wa.me/?text=${text}` }];
});

route('GET', '/reminders', () => {
  const u = currentUser();
  const list = db.reminders.filter((r) => r.shop === u.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 50);
  return {
    reminders: list.map((r) => {
      const c = db.customers.find((x) => x.id === r.customer);
      return {
        id: r.id, customerId: c?.id || null, customerName: c?.name || 'Deleted customer', amount: r.amountPaise / 100,
        currentBalance: c ? c.balancePaise / 100 : null, language: r.language, tone: r.tone, createdAt: r.createdAt,
      };
    }),
  };
});

route('GET', '/reports', ({ query }) => {
  const u = currentUser();
  const days = [7, 30, 90, 180].includes(Number(query.get('days'))) ? Number(query.get('days')) : 30;
  const since = new Date(Date.now() - days * DAY).toISOString();
  const mine = db.entries.filter((e) => e.shop === u.id);
  const sum = (list, t) => list.filter((e) => e.type === t).reduce((s, e) => s + e.amountPaise, 0);
  const period = mine.filter((e) => e.date >= since);
  const udhaarGiven = sum(period, 'udhaar') / 100;
  const collected = sum(period, 'jama') / 100;
  const cashSales = sum(period, 'nakad') / 100;
  const ist = new Date(Date.now() + IST);
  const monthOf = (d) => {
    const x = new Date(new Date(d).getTime() + IST);
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const series = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - i, 1));
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const inMonth = mine.filter((e) => monthOf(e.date) === m);
    series.push({ month: m, udhaar: sum(inMonth, 'udhaar') / 100, jama: sum(inMonth, 'jama') / 100 });
  }
  const owing = shopCustomers(u).filter((c) => c.balancePaise > 0);
  const pending = owing
    .map((c) => {
      const jama = mine.filter((e) => e.customer === c.id && e.type === 'jama').map((e) => e.date).sort();
      const from = c.oldestDueAt || c.lastEntryAt || c.createdAt;
      return {
        id: c.id, name: c.name, balance: c.balancePaise / 100, oldestDueAt: c.oldestDueAt,
        daysPending: Math.floor((Date.now() - new Date(from)) / DAY), lastPaymentAt: jama.length ? jama[jama.length - 1] : null,
      };
    })
    .sort((a, b) => b.daysPending - a.daysPending);
  const outstanding = owing.reduce((s, c) => s + c.balancePaise, 0) / 100;
  const old30 = pending.filter((c) => c.daysPending >= 30).length;
  const insights = [];
  if (pending.length) insights.push(`${pending.length} customer${pending.length === 1 ? '' : 's'} owe a total of ₹${outstanding.toLocaleString('en-IN')}.`);
  if (old30) insights.push(`${old30} of them ha${old30 === 1 ? 's' : 've'} udhaar older than 30 days that is still unpaid.`);
  if (udhaarGiven > 0) insights.push(`In the last ${days} days you gave ₹${udhaarGiven.toLocaleString('en-IN')} udhaar and collected ₹${collected.toLocaleString('en-IN')} towards khata.`);
  if (cashSales > 0) insights.push(`₹${cashSales.toLocaleString('en-IN')} of goods were paid for on the spot (nakad). These don't change anyone's baaki.`);
  return {
    days, udhaarGiven, collected, cashSales, collectionRate: udhaarGiven > 0 ? Math.round((collected / udhaarGiven) * 100) : null,
    outstanding, series, oldestPending: pending.slice(0, 10), insights,
  };
});

route('PATCH', '/account', ({ body }) => {
  const u = currentUser();
  if (body.shopName !== undefined) {
    if (String(body.shopName).trim().length < 2) err(400, 'Enter your shop name');
    u.shopName = String(body.shopName).trim().slice(0, 80);
  }
  for (const k of ['shopType', 'language', 'defaultTone']) if (body[k] !== undefined) u[k] = body[k];
  return { user: pubUser(u) };
});

route('POST', '/account/password', async ({ body }) => {
  const u = currentUser();
  if (u.isDemo) err(400, 'Demo accounts do not have a password');
  if (u.passwordHash !== (await hash(String(body.current || '')))) err(400, 'Current password is wrong', 'current');
  if (String(body.next || '').length < 8) err(400, 'New password must be at least 8 characters');
  u.passwordHash = await hash(body.next);
  return { ok: true };
});

route('GET', '/account/export', () => {
  const u = currentUser();
  return {
    exportedAt: new Date().toISOString(),
    account: { ...pubUser(u), email: u.email, consent: u.consent },
    customers: shopCustomers(u).map(pubCustomer),
    entries: db.entries.filter((e) => e.shop === u.id).map(pubEntry),
    reminders: db.reminders
      .filter((r) => r.shop === u.id)
      .map((r) => ({ customerId: r.customer, language: r.language, tone: r.tone, message: r.message, amount: r.amountPaise / 100, createdAt: r.createdAt })),
  };
});

route('DELETE', '/account', async ({ body }) => {
  const u = currentUser();
  if (!u.isDemo && u.passwordHash !== (await hash(String(body.password || '')))) err(400, 'Password is wrong', 'password');
  deleteShop(u);
  return { ok: true };
});

route('GET', '/pay/:token', ({ params }) => {
  const { r, c, shop } = loadRequest(params.token);
  const entries = db.entries.filter((e) => e.customer === c.id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  return {
    shopName: shop.shopName.replace(/\s*\(demo\)$/i, ''), isDemo: true, customerFirstName: c.name.split(' ')[0],
    amountDue: Math.max(0, c.balancePaise) / 100,
    entries: entries.map((e) => ({ date: e.date, items: e.items, type: e.type, amount: e.amountPaise / 100 })),
    paymentMode: 'demo', expiresAt: r.expiresAt,
  };
});

route('POST', '/pay/:token/start', ({ params, body }) => {
  const { r, c } = loadRequest(params.token);
  const p = toPaise(body.amount);
  if (p === null || p < 100) err(400, 'Enter at least ₹1');
  if (p > c.balancePaise) err(400, 'Amount is more than what is due');
  const pay = { id: id(), request: r.id, shop: r.shop, customer: c.id, amountPaise: p, provider: 'demo', status: 'created' };
  db.payments.push(pay);
  return [201, { mode: 'demo', paymentId: pay.id }];
});

route('POST', '/pay/:token/demo-complete', ({ params, body }) => {
  const { r, c, shop } = loadRequest(params.token);
  const pay = db.payments.find((x) => x.id === body.paymentId && x.request === r.id);
  if (!pay) err(404, 'Payment not found');
  addEntry(shop, c, { type: 'jama', amountPaise: pay.amountPaise, items: 'Demo UPI payment', source: 'payment', paymentRef: `demo:${pay.id}` });
  pay.status = 'paid';
  return { status: 'paid', amountPaid: pay.amountPaise / 100, amountDue: Math.max(0, c.balancePaise) / 100 };
});

route('GET', '/pay/:token/status/:paymentId', ({ params }) => {
  const { r } = loadRequest(params.token);
  const pay = db.payments.find((x) => x.id === params.paymentId && x.request === r.id);
  if (!pay) err(404, 'Payment not found');
  return { status: pay.status, amount: pay.amountPaise / 100 };
});

// ---------- fetch interception ----------
const realFetch = window.fetch.bind(window);
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('/api/')) return realFetch(input, init);
  const u = new URL(url, window.location.origin);
  const path = u.pathname.slice(4);
  const method = (init.method || 'GET').toUpperCase();
  let body = {};
  if (typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      return json(400, { error: 'Invalid request' });
    }
  }
  await new Promise((r) => setTimeout(r, 120)); // feel like a network call
  for (const rt of routes) {
    if (rt.method !== method) continue;
    const m = path.match(rt.re);
    if (!m) continue;
    try {
      const out = await rt.handler({ params: m.groups || {}, body: body || {}, query: u.searchParams });
      if (method !== 'GET') save();
      return Array.isArray(out) ? json(out[0], out[1]) : json(200, out);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message, field: e.field });
      console.error(e);
      return json(500, { error: 'Something went wrong. Please try again.' });
    }
  }
  return json(404, { error: 'Not found' });
};

window.__UK_DEMO__ = true;
