import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXE = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const UD = path.join(DIR, 'profile');
fs.mkdirSync(UD, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false,
  args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({ userDataDir: UD, viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
await page.goto('https://fanqienovel.com/main/writer/create', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

let lastId = 0;
while (true) {
  await page.waitForTimeout(1000);
  let cmd = null;
  try { cmd = JSON.parse(fs.readFileSync(DIR + '/cmd.json', 'utf8')); } catch {}
  if (!cmd || cmd.id === lastId) continue;
  lastId = cmd.id;
  const res = { cmdId: cmd.id };
  try {
    switch (cmd.op) {
      case 'goto':
        await page.goto(cmd.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (cmd.wait) await page.waitForTimeout(cmd.wait);
        res.url = page.url();
        break;
      case 'eval':
        res.result = await page.evaluate(cmd.expr);
        break;
      case 'fill':
        await page.fill(cmd.selector, cmd.value, { timeout: 20000 });
        res.ok = true;
        break;
      case 'click':
        await page.click(cmd.selector, { timeout: 20000 });
        await page.waitForTimeout(2000);
        res.after_url = page.url();
        break;
      case 'mclick':
        await page.mouse.click(cmd.x, cmd.y);
        await page.waitForTimeout(cmd.wait || 2500);
        res.after_url = page.url();
        break;
      case 'screenshot':
        await page.screenshot({ path: DIR + '/shot.png' });
        res.file = DIR + '/shot.png';
        break;
      case 'status':
        res.url = page.url();
        res.text = await page.evaluate(() => document.body.innerText.slice(0, 2000));
        break;
      default:
        res.error = 'unknown op ' + cmd.op;
    }
    fs.writeFileSync(DIR + '/out.json', JSON.stringify(res, null, 1));
  } catch (e) {
    res.error = e.message.slice(0, 300);
    fs.writeFileSync(DIR + '/out.json', JSON.stringify(res, null, 1));
  }
}
