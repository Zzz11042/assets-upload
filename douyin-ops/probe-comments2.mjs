import { chromium } from 'playwright-core';
import fs from 'node:fs';
const ROOT = process.cwd();
const storage = JSON.parse(fs.readFileSync('./state/storage.json', 'utf8'));
// Launch with a temp profile but import cookies
const ctx = await chromium.launchPersistentContext('/tmp/dy-comment-profile', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
await ctx.addCookies(storage.cookies || []);
const page = ctx.pages()[0] || (await ctx.newPage());

const apiCalls = [];
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('douyin') && (u.includes('comment') || u.includes('interact') || u.includes('notice') || u.includes('message'))) {
    try { const body = await res.text(); apiCalls.push({ url: u.slice(0, 130), status: res.status(), body: body.slice(0, 400) }); } catch {}
  }
});

for (const url of [
  'https://creator.douyin.com/creator-micro/interact',
  'https://creator.douyin.com/creator-micro/notice',
]) {
  console.log(`\n=== ${url} ===`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto err:', e.message));
  await page.waitForTimeout(8000);
  console.log('BODY:', await page.evaluate(() => document.body.innerText.slice(0, 500)));
}
console.log('\n=== API CALLS ===');
for (const c of apiCalls.slice(0, 15)) console.log(`${c.status} ${c.url}\n  ${c.body.slice(0, 200)}`);
await ctx.close();
