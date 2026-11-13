import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:8099/test.html';
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args.filter((a) => a !== '--single-process'), '--no-sandbox'],
  headless: true,
  protocolTimeout: 60000,
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (c, m) => (c ? console.log('ok:', m) : (fails.push(m), console.log('FAIL:', m)));
async function click(sel, text) {
  for (const h of await page.$$(sel)) if ((await h.evaluate((e) => e.textContent)).includes(text)) return h.evaluate((e) => e.click());
  throw new Error(`no ${sel} ${text}`);
}

await page.goto(BASE, { waitUntil: 'networkidle0' });
check(await page.$('.lp-hero h1'), 'landing renders');
await click('button', 'Try the demo shop');
await page.waitForSelector('#ageConfirmed');
await page.click('#ageConfirmed');
await page.click('#acceptTerms');
await click('[role=dialog] button', 'Open demo shop');
await page.waitForSelector('.dock-seal');
check(page.url().endsWith('#/app'), 'demo opens galla');
const fontOk = await page.evaluate(() => document.fonts.check('16px Kalam'));
check(fontOk, 'Kalam font loaded');

await page.click('.dock-seal');
await page.waitForSelector('#command-input');
check(!(await page.$('[aria-label="Speak the entry"]')), 'mic hidden in demo');
await page.type('#command-input', 'Ramesh ne 250 ka atta liya, 500 de diye');
await page.keyboard.press('Enter');
await page.waitForSelector('.understood');
const chip = await page.$eval('.understood .chip-pink', (e) => e.textContent);
check(chip === 'Ramesh Kumar', `parser matched ${chip}`);
await click('.understood button', 'Sahi hai');
await page.waitForFunction(() => !document.querySelector('[role=dialog]'));

await page.goto(BASE + '#/app/grahak', { waitUntil: 'networkidle0' });
await sleep(400);
const names = await page.$$eval('.index-list .nm', (e) => e.map((x) => x.textContent));
check(names.length === 8, `customers listed: ${names.length}`);
const ramesh = await page.evaluate(async () => (await (await fetch('/api/customers')).json()).customers.find((c) => c.name === 'Ramesh Kumar'));
check(ramesh.balance === 1000, `Ramesh balance ${ramesh.balance}`);

await page.goto(`${BASE}#/app/yaad?customer=${ramesh.id}`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.querySelector('#message')?.value.length > 20);
const href = await page.$eval('a.btn-primary[href^="https://wa.me"]', (a) => a.href);
check(href.startsWith('https://wa.me/?text='), 'WhatsApp link ready');
const msg = await page.$eval('#message', (e) => e.value);
check(msg.includes('#/pay/'), 'message has pay link');
await click('a', 'see the payment page');
await page.waitForSelector('.pay-amount');
const due = await page.$eval('.pay-amount', (e) => e.textContent);
check(due === '₹1,000', `pay page due ${due}`);
await page.click('#pay-part');
await page.type('#part-amount', '300');
await click('button', 'with UPI');
await page.waitForSelector('[role=dialog]');
await click('[role=dialog] button', 'Complete demo payment');
await page.waitForSelector('.success-mark');
const after = await page.evaluate(async (id) => (await (await fetch('/api/customers/' + id)).json()).customer.balance, ramesh.id);
check(after === 700, `balance after payment ${after}`);

for (const r of ['hisaab', 'scan', 'settings']) {
  await page.goto(`${BASE}#/app/${r}`, { waitUntil: 'networkidle0' });
  await sleep(300);
  check(await page.$('main h1'), `${r} renders`);
}
await click('button', 'Download my data');
await page.waitForSelector('#export-json');
const exp = JSON.parse(await page.$eval('#export-json', (e) => e.value));
check(exp.customers.length === 8 && exp.entries.length > 10, 'export shows data');
await page.keyboard.press('Escape');

await page.reload({ waitUntil: 'networkidle0' });
await sleep(300);
check(await page.$('main h1'), 'still logged in after reload (saved in this browser)');
await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
await page.goto(`${BASE}#/welcome`, { waitUntil: "networkidle0" });
await page.reload({ waitUntil: "networkidle0" });
check((await page.$('.auth-welcome')) && !(await page.$('.auth-card')) && (await page.$('canvas.dori-field')), 'welcome card shows alone');
await click('a', 'Log in');
await page.waitForSelector('.auth-card #email');
check(!(await page.$('.auth-welcome')) && (await page.$$('.parchu')).length === 1, 'Log in swaps to the form card');
await page.click('.ac-back');
await page.waitForSelector('.auth-welcome');
await click('a', 'Create my shop');
await page.waitForSelector('.auth-card #shopName');
check(true, 'Create my shop swaps to the sign-up card');
await page.goto(`${BASE}#/privacy`, { waitUntil: 'networkidle0' });
check((await page.$eval('main h1', (e) => e.textContent)) === 'Privacy policy', 'privacy page');
await page.setViewport({ width: 390, height: 800 });
await page.goto(`${BASE}#/app`, { waitUntil: 'networkidle0' });
await sleep(500);
await page.screenshot({ path: 'live-mobile.png' });
const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check(over <= 1, 'no horizontal scroll on phone');
check(errors.length === 0, `no script errors ${errors.join(' | ')}`);
await browser.close();
console.log(`${fails.length} failure(s)`);
