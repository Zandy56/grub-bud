// Real-browser test of how a phone picks up a new version: the app reloads into
// it when it comes back on screen (but not mid-edit), and Settings > "Get latest
// version" works. Runs on a temporary copy of the app, publishing fake newer
// versions into it. Run: npm run test:update   (set CHROME=/path/to/chrome if needed)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const project = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const chrome = process.env.CHROME
  || ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('Chrome not found. Set CHROME=/path/to/chrome');
  process.exit(1);
}
const app = fs.mkdtempSync(path.join(os.tmpdir(), 'grub-bud-update-'));
for (const entry of ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'assets']) {
  fs.cpSync(path.join(project, entry), path.join(app, entry), { recursive: true });
}
const startVersion = fs.readFileSync(path.join(project, 'js/version.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(app, rel);
  if (!file.startsWith(app) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const release = (v) => {
  for (const [rel, re, rep] of [
    ['js/version.js', /VERSION = '[^']+'/, `VERSION = '${v}'`],
    ['sw.js', /VERSION = '[^']+'/, `VERSION = '${v}'`],
  ]) {
    const p = path.join(app, rel);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(re, rep));
  }
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); };

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const t0 = Date.now();
page.on('dialog', async (d) => { console.log(`  DIALOG (${d.type()}): ${d.message()}`); await d.dismiss(); });
page.on('load', () => console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] FULL PAGE LOAD`));
const step = (name) => console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] -- ${name}`);
await page.goto(url, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 10000 });
// Something saved on the phone, to check it survives updates.
await page.evaluate(() => localStorage.setItem('meal-planner:v1', JSON.stringify({ version: 2, recipes: [{ id: 'mine', name: 'Her Lasagna', ingredients: [] }] })));
await page.reload({ waitUntil: 'networkidle0' });
const shownVersion = async () => {
  await page.evaluate(() => document.querySelector('[data-action="open-settings"]').click());
  await pause(200);
  const v = await page.evaluate(() => document.querySelector('#app-version')?.textContent);
  await page.evaluate(() => history.back());
  await pause(200);
  return v;
};
check(await shownVersion() === startVersion, `starts on ${startVersion}`);

// 1. Automatic: a new version is published while the app sits in the background;
// when it comes back on screen it checks, installs, and reloads into it.
release('v98');
await page.evaluate(() => { window.__old = true; });
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForFunction(() => !window.__old, { timeout: 15000 }).catch(() => {});
await pause(500);
check(await page.evaluate(() => !window.__old), 'coming back on screen with a new version available reloads the app');
check(await shownVersion() === 'v98', 'and it is now running the new version (v98)');

// 1b. Not in the middle of an edit: with a sheet open, it waits.
release('v99');
await page.evaluate(() => { window.__old = true; document.querySelector('[data-action="open-settings"]').click(); });
await pause(200);
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await pause(4000);
check(await page.evaluate(() => window.__old === true && !!document.querySelector('#app-version')), 'with a sheet open it does not reload mid-edit');
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForFunction(() => !window.__old, { timeout: 10000 }).catch(() => {});
await pause(500);
check(await page.evaluate(() => !window.__old), 'it reloads once the app is put away');
check(await shownVersion() === 'v99', 'and then runs the new version (v99)');

// 2. The button.
step('button test starts');
await page.evaluate(() => document.querySelector('[data-action="open-settings"]').click());
await pause(200);
await page.evaluate(() => document.querySelector('[data-action="update-app"]').click());
await pause(800);
check(/latest version \(v99\)/.test(await page.evaluate(() => document.querySelector('#toast')?.textContent || '')), 'button says you have the latest when you do');
await page.evaluate(() => history.back());
await pause(200);
step('releasing v100');
release('v100');
await page.evaluate(() => { window.__old = true; document.querySelector('[data-action="open-settings"]').click(); });
await pause(200);
// The click reloads the page, which can cut this call short; that's expected.
await page.evaluate(() => document.querySelector('[data-action="update-app"]').click()).catch(() => {});
await page.waitForFunction(() => !window.__old, { timeout: 15000 }).catch(() => {});
await pause(800);
check(await page.evaluate(() => !window.__old), 'Get latest version reloads when there is a newer one');
check(await shownVersion() === 'v100', 'and runs it (v100)');

// 3. Data survives updates.
check(await page.evaluate(() => JSON.parse(localStorage.getItem('meal-planner:v1')).recipes.some((r) => r.name === 'Her Lasagna')), 'saved data is still there after updating');

await browser.close();
server.close();
fs.rmSync(app, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
