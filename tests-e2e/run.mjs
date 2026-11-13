// End-to-end + accessibility check of the running app (http://localhost:4000).
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4000';
const OUT = path.resolve('shots');
fs.mkdirSync(OUT, { recursive: true });
const AXE = path.resolve('node_modules/axe-core/axe.min.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { axe: {}, failures: [], hosts: new Set(), consoleErrors: [], notes: [] };
const fail = (m) => {
  results.failures.push(m);
  console.log('FAIL:', m);
};
const ok = (m) => console.log('ok:', m);

const browser = await puppeteer.launch({
  protocolTimeout: 60000,
  executablePath: await chromium.executablePath(),
  args: [...chromium.args.filter((a) => a !== '--single-process'), '--no-sandbox'],
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
});

function watch(page, label) {
  page.setBypassCSP(true); // only so the axe checker script can be injected
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['data:', 'blob:'].includes(u.protocol)) results.hosts.add(u.host);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`${label}: ${m.text()}`);
  });
  page.on('pageerror', (e) => results.consoleErrors.push(`${label}: ${e.message}`));
}

async function axe(page, name) {
  await sleep(450); // let open/close animations finish
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + n.failureSummary.split('\n').slice(0, 2).join(' ')) }));
  });
  results.axe[name] = r;
  if (r.length) fail(`axe ${name}: ${r.map((v) => `${v.id}(${v.impact})\n      ${v.nodes.join('\n      ')}`).join('; ')}`);
  else ok(`axe clean: ${name}`);
}

async function noHScroll(page, name) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) fail(`horizontal scroll on ${name} (${over}px)`);
}

async function shot(page, name, full = true) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
}

async function clickText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await h.evaluate((el) => el.textContent.trim());
    if (t.includes(text)) {
      await h.click();
      return true;
    }
  }
  throw new Error(`no ${selector} with text ${text}`);
}

const page = await browser.newPage();
// Screenshots can't settle while canvas animations run in this sandbox, so the run
// uses the reduced-motion setting (which the site supports).
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: process.env.SCHEME || 'light' }]);
watch(page, 'shop');

// ---------- Landing ----------
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await shot(page, '01-landing');
await axe(page, 'landing');
await page.keyboard.press('Tab');
const firstFocus = await page.evaluate(() => document.activeElement.textContent.trim());
firstFocus === 'Skip to content' ? ok('skip link is first') : fail(`first tab stop is "${firstFocus}"`);

// Demo dialog: consent required
await clickText(page, 'button', 'Try the demo shop');
await page.waitForSelector('[role=dialog]');
await axe(page, 'demo-dialog');
await clickText(page, '[role=dialog] button', 'Open demo shop');
await sleep(200);
const errs = await page.$$eval('[role=dialog] .error', (e) => e.map((x) => x.textContent));
errs.length === 2 ? ok('demo needs both consents') : fail(`consent errors shown: ${errs.length}`);
const preticked = await page.$$eval('[role=dialog] input[type=checkbox]', (e) => e.some((x) => x.checked));
preticked ? fail('a consent box was pre-ticked') : ok('no pre-ticked boxes');
await page.keyboard.press('Escape');
await sleep(150);
const dialogGone = !(await page.$('[role=dialog]'));
const focusBack = await page.evaluate(() => document.activeElement.textContent.trim());
dialogGone && focusBack.includes('Try the demo') ? ok('Escape closes dialog and returns focus') : fail(`escape/focus: gone=${dialogGone} focus=${focusBack}`);
await clickText(page, 'button', 'Try the demo shop');
await page.waitForSelector('[role=dialog]');
await page.click('#ageConfirmed');
await page.click('#acceptTerms');
await clickText(page, '[role=dialog] button', 'Open demo shop');
await page.waitForFunction(() => location.pathname === '/app', { timeout: 5000 }).catch(() => {});
page.url().endsWith('/app') ? ok('demo opens galla') : fail('demo did not open /app');

// ---------- Galla ----------
await page.waitForSelector('.parchi');
await sleep(700);
await shot(page, '02-galla');
await axe(page, 'galla');
const cookieNotice = await page.$('.cookie-notice');
if (cookieNotice) await clickText(page, '.cookie-notice button', 'Got it');

// Command sheet by keyboard
await page.focus('.dock-seal');
await page.keyboard.press('Enter');
await page.waitForSelector('#command-input');
const focused = await page.evaluate(() => document.activeElement.id);
focused === 'command-input' ? ok('command input focused on open') : fail(`focus in sheet: ${focused}`);
await axe(page, 'command-sheet');
// focus trap
for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
const inside = await page.evaluate(() => !!document.activeElement.closest('[role=dialog]'));
inside ? ok('focus stays inside dialog') : fail('focus escaped dialog');
await page.click('#command-input', { clickCount: 3 });
await page.type('#command-input', 'Ramesh ne 250 ka atta liya, 500 de diye');
await page.keyboard.press('Enter');
await page.waitForSelector('.understood');
await shot(page, '03-command-understood', false);
await axe(page, 'command-result');
const chipName = await page.$eval('.understood .chip-pink', (e) => e.textContent).catch(() => null);
chipName === 'Ramesh Kumar' ? ok('matched Ramesh Kumar') : fail(`customer chip: ${chipName}`);
const amounts = await page.$$eval('.understood input[id^=amt-]', (e) => e.map((x) => x.value));
JSON.stringify(amounts) === '["250","250"]' ? ok('amounts parsed') : fail(`amounts ${amounts}`);
const before = await page.evaluate(async () => (await (await fetch('/api/customers')).json()).customers.find((c) => c.name === 'Ramesh Kumar').balance);
await clickText(page, '.understood button', 'Sahi hai');
await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
const after = await page.evaluate(async () => (await (await fetch('/api/customers')).json()).customers.find((c) => c.name === 'Ramesh Kumar').balance);
after === before - 250 ? ok(`balance ${before} -> ${after}`) : fail(`balance ${before} -> ${after}, expected -250`);
await sleep(500);
await shot(page, '04-galla-after');

// ---------- Customers ----------
await page.goto(BASE + '/app/grahak', { waitUntil: 'networkidle0' });
await shot(page, '05-customers');
await axe(page, 'customers');
await clickText(page, 'button', 'Add customer');
await page.waitForSelector('#cust-name');
await page.type('#cust-name', 'Test Grahak');
await page.type('#cust-phone', '12345');
await clickText(page, '[role=dialog] button', 'Add customer');
await sleep(400);
const phoneErr = await page.$eval('#cust-phone-hint .error', (e) => e.textContent).catch(() => null);
phoneErr ? ok('bad phone rejected with message') : fail('no phone error');
await page.focus('#cust-phone');
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.press('Backspace');
await clickText(page, '[role=dialog] button', 'Add customer');
await page.waitForFunction(() => /\/app\/grahak\/[a-f0-9]{24}$/.test(location.pathname), { timeout: 5000 }).catch(async () => {
  await shot(page, 'debug-add-customer', false);
  console.log('dialog text:', await page.$eval('[role=dialog]', (e) => e.innerText).catch(() => 'no dialog'));
});
/\/app\/grahak\/[a-f0-9]{24}$/.test(page.url()) ? ok('new customer page opened') : fail(`after add: ${page.url()}`);

// ---------- Ledger ----------
const rameshId = await page.evaluate(async () => (await (await fetch('/api/customers')).json()).customers.find((c) => c.name === 'Ramesh Kumar').id);
await page.goto(`${BASE}/app/grahak/${rameshId}`, { waitUntil: 'networkidle0' });
await shot(page, '06-ledger');
await axe(page, 'ledger');
const topRunning = await page.$eval('.ruled tbody tr td:nth-child(4)', (e) => e.textContent);
const shownBal = await page.$eval('.book-page .money', (e) => e.textContent);
ok(`ledger top running "${topRunning}", balance "${shownBal}"`);
if (!shownBal.includes(topRunning.replace(' adv.', ''))) fail('running balance does not match balance');

// ---------- Reminders ----------
await page.goto(`${BASE}/app/yaad?customer=${rameshId}`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.querySelector('#message')?.value.length > 20);
await shot(page, '07-reminders');
await axe(page, 'reminders');
const msg = await page.$eval('#message', (e) => e.value);
const payUrl = (msg.match(/http:\/\/localhost:4000\/pay\/[A-Za-z0-9_-]+/) || [])[0];
payUrl ? ok('reminder has pay link') : fail(`no pay link in: ${msg}`);
const popupPromise = new Promise((res) => browser.once('targetcreated', (t) => res(t)));
await clickText(page, 'a', 'Open in WhatsApp');
const target = await popupPromise;
await sleep(1500);
const popupUrl = target.url();
popupUrl.startsWith('https://wa.me/?text=') ? ok(`whatsapp tab: ${popupUrl.slice(0, 40)}`) : fail(`popup url ${popupUrl}`);
const popupPage = await target.page();
await popupPage?.close().catch(() => {});

// ---------- Pay page (customer view, phone size, separate browser context) ----------
const ctx = await browser.createBrowserContext();
const cust = await ctx.newPage();
await cust.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: process.env.SCHEME || 'light' }]);
watch(cust, 'customer');
await cust.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await cust.goto(payUrl, { waitUntil: 'networkidle0' });
await shot(cust, '08-pay');
await axe(cust, 'pay');
await noHScroll(cust, 'pay');
const due = await cust.$eval('.pay-amount', (e) => e.textContent);
await cust.click('#pay-part');
await cust.type('#part-amount', '200');
await clickText(cust, 'button', 'with UPI');
await cust.waitForSelector('[role=dialog]');
await axe(cust, 'pay-demo-dialog');
await clickText(cust, '[role=dialog] button', 'Complete demo payment');
await cust.waitForSelector('.success-mark');
await sleep(600);
await shot(cust, '09-paid');
const paidText = await cust.$eval('main h1', (e) => e.textContent);
paidText.includes('₹200') ? ok(`paid page: ${paidText}, due before ${due}`) : fail(`paid page ${paidText}`);
await ctx.close();
const afterPay = await page.evaluate(async (id) => (await (await fetch('/api/customers/' + id)).json()).customer.balance, rameshId);
afterPay === after - 200 ? ok(`balance after pay ${afterPay}`) : fail(`balance after pay ${afterPay}, expected ${after - 200}`);

// ---------- Other app pages ----------
for (const [p, name] of [['/app/hisaab', 'reports'], ['/app/scan', 'scan'], ['/app/settings', 'settings']]) {
  await page.goto(BASE + p, { waitUntil: 'networkidle0' });
  await sleep(300);
  await shot(page, `10-${name}`);
  await axe(page, name);
}

// ---------- Mobile + 200% zoom (1280 / 2 = 640 CSS px) ----------
for (const [w, label] of [[390, 'mobile'], [640, 'zoom200']]) {
  await page.setViewport({ width: w, height: 800 });
  for (const p of ['/app', '/app/grahak', `/app/grahak/${rameshId}`, '/app/yaad', '/app/hisaab', '/app/settings']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle0' });
    await noHScroll(page, `${label} ${p}`);
  }
  await page.goto(BASE + '/app', { waitUntil: 'networkidle0' });
  await sleep(500);
  await shot(page, `11-${label}-galla`, false);
  await page.goto(`${BASE}/app/grahak/${rameshId}`, { waitUntil: 'networkidle0' });
  await shot(page, `12-${label}-ledger`);
}
await page.setViewport({ width: 1280, height: 900 });

// ---------- Public pages ----------
for (const p of ['privacy', 'terms', 'cookies', 'refunds', 'accessibility', 'welcome', 'login', 'signup', 'nope']) {
  await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle0' });
  await axe(page, p);
  await noHScroll(page, p);
}
await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle0' });
await shot(page, '13-signup');

// ---------- Delete demo account ----------
await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle0' });
await clickText(page, 'button', 'Delete my account');
await page.waitForSelector('[role=dialog]');
await clickText(page, '[role=dialog] button', 'Delete everything');
await page.waitForFunction(() => location.pathname === '/', { timeout: 5000 }).catch(() => {});
const me = await page.evaluate(async () => (await fetch('/api/auth/me')).status);
me === 401 ? ok('account deleted, logged out') : fail(`after delete /me = ${me}`);

await browser.close();
const hosts = [...results.hosts];
const foreign = hosts.filter((h) => h !== 'localhost:4000' && !h.startsWith('wa.me'));
foreign.length ? fail(`third-party requests: ${foreign.join(', ')}`) : ok(`only first-party requests (${hosts.join(', ')})`);
// 400s come from the deliberate bad-phone test above; 401s from logged-out checks.
const realConsole = results.consoleErrors.filter((e) => !/status of (400|401)/.test(e));
if (realConsole.length) fail(`console errors: ${realConsole.join(' | ')}`);
fs.writeFileSync('results.json', JSON.stringify({ ...results, hosts }, null, 2));
console.log(`\n${results.failures.length} failure(s)`);
