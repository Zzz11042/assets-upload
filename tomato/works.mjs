import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const USER_DIR = '/home/zzz/Documents/deepseek-harness/default-workspace/tomato/profile';

const ctx = await chromium.launchPersistentContext(USER_DIR, {
  executablePath: CHROME, headless: false,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  viewport: { width: 1440, height: 900 }, locale: 'zh-CN',
});
const page = ctx.pages()[0] ?? await ctx.newPage();
await page.goto('https://fanqienovel.com/main/writer/works', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

// capture API responses for works list
const out = { url: page.url(), title: await page.title() };
try {
  const text = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  out.text = text;
} catch {}
fs.writeFileSync('works.json', JSON.stringify(out, null, 2));
await page.screenshot({ path: 'works.png' });
await ctx.close();
console.log('done');
