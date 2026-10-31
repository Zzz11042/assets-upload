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
  if (u.includes('fanqienovel.com/api/')) {
    try { api.push({ url: u.slice(0, 150), status: res.status(), body: (await res.text()).slice(0, 800) }); } catch {}
  }
});
// go to writer home (no works suffix)
await page.goto('https://fanqienovel.com/main/writer', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const out = {
  url: page.url(),
  title: await page.title(),
  text: await page.evaluate(() => document.body.innerText.slice(0, 2000)),
  links: await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href + ' | ' + (a.innerText||'').trim().slice(0,30)).filter(s => s.length > 6 && !s.includes('licence')).slice(0, 50)),
};
fs.writeFileSync('probe3.json', JSON.stringify(out, null, 2));
fs.writeFileSync('api2.json', JSON.stringify(api, null, 2));
await ctx.close();
console.log('done');
