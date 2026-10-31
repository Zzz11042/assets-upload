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
  if (/api|graphql/i.test(u)) {
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('json')) api.push({ url: u, status: res.status() });
    } catch {}
  }
});
await page.goto('https://fanqienovel.com/main/writer', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const out = {
  url: page.url(),
  title: await page.title(),
  text: await page.evaluate(() => document.body.innerText.slice(0, 3000)),
  links: await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href + ' | ' + (a.innerText||'').trim().slice(0,30)).filter(s => s.length > 6).slice(0, 60)),
};
fs.writeFileSync('probe.json', JSON.stringify(out, null, 2));
fs.writeFileSync('api.json', JSON.stringify(api, null, 2));
await ctx.close();
console.log('done');
