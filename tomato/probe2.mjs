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
const api = [];
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('/api/author')) {
    try {
      api.push({ url: u, status: res.status(), body: (await res.text()).slice(0, 500) });
    } catch {}
  }
});
await page.goto('https://fanqienovel.com/writer/zone/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const out = {
  url: page.url(),
  title: await page.title(),
  text: await page.evaluate(() => document.body.innerText.slice(0, 3000)),
};
fs.writeFileSync('probe2.json', JSON.stringify(out, null, 2));
fs.writeFileSync('author_api.json', JSON.stringify(api, null, 2));
await ctx.close();
console.log('done');
