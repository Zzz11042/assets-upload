import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const USER_DIR = '/home/zzz/Documents/deepseek-harness/default-workspace/tomato/profile';
const deadline = Date.now() + 10 * 60 * 1000; // 10 min

const ctx = await chromium.launchPersistentContext(USER_DIR, {
  executablePath: CHROME, headless: false,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  viewport: { width: 1440, height: 900 }, locale: 'zh-CN',
});
const page = ctx.pages()[0] ?? await ctx.newPage();
if (page.url() === 'about:blank') {
  await page.goto('https://fanqienovel.com/main/writer/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
}

let logged = false;
while (Date.now() < deadline) {
  // Navigate to a post-login page to check session
  try {
    await page.goto('https://fanqienovel.com/main/writer/works', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    const u = page.url();
    if (!/login/i.test(u)) {
      logged = true;
      break;
    }
  } catch {}
  await page.waitForTimeout(8000);
}

fs.writeFileSync('state.json', JSON.stringify({ url: page.url(), title: await page.title(), logged }, null, 2));
await ctx.close();
console.log(logged ? 'LOGGED IN' : 'TIMEOUT: not logged in');
