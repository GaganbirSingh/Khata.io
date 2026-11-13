import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const [,, BASE, hash = ''] = process.argv; // hash = '#' for the demo build
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args.filter((a) => a !== '--single-process'), '--no-sandbox'], headless: true, protocolTimeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (c, m) => (c ? console.log('ok:', m) : (fails.push(m), console.log('FAIL:', m)));
const path = (p) => (hash ? `${BASE}#${p}` : `${BASE}${p}`);
const where = (p) => p.evaluate(() => (location.hash ? location.hash.slice(1) : location.pathname));

for (const [w, h] of [[1140, 820], [1280, 900], [390, 844]]) {
  const p = await b.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: w, height: h });
  await p.goto(path('/'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => fetch('/api/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptTerms: true, ageConfirmed: true }) }));
  await p.goto(path('/app'), { waitUntil: 'networkidle0' });
  if (hash) await p.reload({ waitUntil: 'networkidle0' });
  await p.waitForSelector('.shop-menu > button');
  await p.click('.shop-menu > button'); // real mouse click
  await p.waitForSelector('.menu');
  // every menu item must be the top element at its own centre (nothing covering it)
  const covered = await p.evaluate(() =>
    [...document.querySelectorAll('.menu a, .menu button')].filter((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !el.contains(top);
    }).map((el) => el.textContent.trim())
  );
  check(covered.length === 0, `${w}px: menu items not covered (${covered.join(', ') || 'none'})`);
  const items = await p.$$('.menu button');
  const logoutBtn = items.find ? items[items.length - 1] : null;
  await logoutBtn.click(); // real mouse click on "Log out"
  await p.waitForFunction(() => (location.hash ? location.hash.slice(1) : location.pathname) === '/', { timeout: 5000 }).catch(() => {});
  const at = await where(p);
  check(at === '/', `${w}px: Log out from the menu goes to home (at ${at})`);
  const me = await p.evaluate(() => fetch('/api/auth/me').then((r) => r.status));
  check(me === 401, `${w}px: session ended`);

  // second way: Settings page button
  await p.evaluate(() => fetch('/api/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptTerms: true, ageConfirmed: true }) }));
  await p.goto('about:blank');
  await p.goto(path('/app/settings'), { waitUntil: 'networkidle0' });
  const btns = await p.$$('button.btn');
  let clicked = false;
  for (const bt of btns) {
    if ((await bt.evaluate((e) => e.textContent.trim())) === 'Log out') {
      await bt.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await sleep(200);
      await bt.click();
      clicked = true;
      break;
    }
  }
  await p.waitForFunction(() => (location.hash ? location.hash.slice(1) : location.pathname) === '/', { timeout: 5000 }).catch(() => {});
  const st = await p.evaluate(() => fetch('/api/auth/me').then((r) => r.status));
  const at2 = await where(p);
  check(clicked && st === 401 && at2 === '/', `${w}px: Log out from Settings works and goes home (clicked=${clicked} status=${st} at=${at2})`);
  await p.close();
}
await b.close();
console.log(`${fails.length} failure(s)`);
