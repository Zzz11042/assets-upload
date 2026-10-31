import { chromium } from 'playwright-core';
import fs from 'node:fs';
const storage = JSON.parse(fs.readFileSync('./state/storage.json', 'utf8'));
const ctx = await chromium.launchPersistentContext('/tmp/dy-data-profile', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
await ctx.addCookies(storage.cookies || []);
const page = ctx.pages()[0] || (await ctx.newPage());

// Capture API responses with URLs
const apiCalls = [];
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('creator.douyin.com') && !u.includes('static') && !u.includes('.js') && !u.includes('.css')) {
    try { const body = await res.text(); apiCalls.push({ url: u.replace('https://creator.douyin.com','').slice(0, 120), status: res.status(), body: body.slice(0, 300) }); } catch {}
  }
});

// 1. Data center
console.log('=== /creator-micro/data ===');
await page.goto('https://creator.douyin.com/creator-micro/data', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('err:', e.message));
await page.waitForTimeout(8000);
console.log('BODY:', await page.evaluate(() => document.body.innerText.slice(0, 600)));

// 2. Interaction center
console.log('\n=== /creator-micro/interact ===');
await page.goto('https://creator.douyin.com/creator-micro/interact', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('err:', e.message));
await page.waitForTimeout(8000);
console.log('BODY:', await page.evaluate(() => document.body.innerText.slice(0, 600)));

// 3. Message center
console.log('\n=== /creator-micro/message ===');
await page.goto('https://creator.douyin.com/creator-micro/message', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('err:', e.message));
await page.waitForTimeout(8000);
console.log('BODY:', await page.evaluate(() => document.body.innerText.slice(0, 600)));

// 4. Content management with post list
console.log('\n=== /creator-micro/content/manage ===');
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('err:', e.message));
await page.waitForTimeout(10000);
console.log('BODY:', await page.evaluate(() => document.body.innerText.slice(0, 400)));

// Dump all interesting API calls
console.log('\n=== INTERESTING API CALLS ===');
for (const c of apiCalls) {
  if (!/static|\.js|\.css|\.png|\.svg|\.woff|fast_detect|cover\/gen|limit_app_groups|user_message|oversea|user\/info|banner|starlight|mcn|ai_creation|relation_account|exclusive|token|anchor/.test(c.url)) {
    console.log(`${c.status} ${c.url}\n  ${c.body.slice(0, 200)}\n`);
  }
}
await ctx.close();
