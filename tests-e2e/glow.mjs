import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const B = process.argv[2] || 'http://localhost:4000';
const H = process.argv[3] === '#';
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args.filter((a) => a !== '--single-process'), '--no-sandbox'], headless: true, protocolTimeout: 60000 });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.setViewport({ width: 1280, height: 900 });
const url = (x) => (H ? `${B}#${x}` : B + x);
const glowAt = async (path) => {
  await p.goto(url(path), { waitUntil: 'networkidle0' });
  if (H) await p.reload({ waitUntil: 'networkidle0' });
  await p.mouse.move(300, 300);
  await p.mouse.move(700, 450, { steps: 8 });
  await new Promise((r) => setTimeout(r, 700));
  return p.evaluate(() => {
    const g = document.querySelector('.dori-glow');
    const strings = document.querySelector('canvas.dori-field');
    return { glow: g ? `${getComputedStyle(g).opacity} ${getComputedStyle(g).transform}` : 'none', canvas: Boolean(strings) };
  });
};
console.log('landing', JSON.stringify(await glowAt('/')));
await p.evaluate(() => fetch('/api/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptTerms: true, ageConfirmed: true }) }));
console.log('app    ', JSON.stringify(await glowAt('/app')));
console.log('errors', errs);
await b.close();
