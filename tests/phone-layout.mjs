// Opens every screen at iPhone size in real Chrome and fails if anything is
// wider than the screen (which makes the page scroll sideways on a phone).
// Run: npm run test:phone   (set CHROME=/path/to/chrome if it isn't found)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const chrome = process.env.CHROME
  || ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('Chrome not found. Set CHROME=/path/to/chrome');
  process.exit(1);
}

// Tiny static server for the app files.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const PHONES = [
  { name: 'small phone', width: 360, height: 740 },
  { name: 'iPhone', width: 390, height: 844 },
];

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
let failures = 0;

for (const phone of PHONES) {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: phone.width, height: phone.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  const tap = async (sel) => {
    await page.$eval(sel, (el) => el.click());
    await new Promise((r) => setTimeout(r, 150));
  };
  const check = async (screen) => {
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const culprit = [...document.querySelectorAll('body *')].find((el) => el.getBoundingClientRect().right > vw + 1);
      return {
        vw,
        scroll: document.documentElement.scrollWidth,
        culprit: culprit && `${culprit.tagName.toLowerCase()}.${String(culprit.className).trim().replace(/\s+/g, '.')}`,
      };
    });
    const ok = r.scroll <= r.vw && !r.culprit;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${phone.name} (${phone.width}px) · ${screen}${ok ? '' : ` — page is ${r.scroll}px wide; first too-wide element: ${r.culprit}`}`);
  };

  await check('Recipes');
  await tap('#tabbar [data-tab="plan"]');
  await page.$eval('.plan-input', (el) => { el.value = 'A really long dinner name that goes on and on and on'; });
  const clearShown = await page.$eval('[data-action="clear-plan"]', (el) => el.offsetParent !== null);
  if (clearShown) failures++;
  console.log(`${clearShown ? 'FAIL' : 'PASS'}  ${phone.name} (${phone.width}px) · Clear button hidden on an empty plan`);
  await check('Meal Plan');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/plan-${phone.width}.png`, fullPage: true });
  await tap('#tabbar [data-tab="recipes"]');
  await tap('.recipe-card [data-action="toggle-week"]');
  await tap('#tabbar [data-tab="week"]');
  await check('This Week');
  await tap('.item .tag');
  await tap('[data-action="add-new-store-row"]');
  await check('price screen');
  await tap('[data-action="close-sheet"]');
  await tap('#tabbar [data-tab="else"]');
  await check('What Else?');
  await tap('#tabbar [data-tab="recipes"]');
  await tap('[data-action="new-recipe"]');
  await check('recipe editor');
  await tap('[data-action="close-sheet"]');
  await tap('[data-action="open-settings"]');
  await check('Settings');
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
