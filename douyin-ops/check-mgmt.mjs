import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const text = await page.evaluate(() => document.body.innerText);
console.log('MANAGE PAGE:', text.slice(0, 800));
// Look for video cards
const cards = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[class*="work-item"], [class*="video-card"], [class*="content-item"], [class*="post-item"]')];
  return els.map(e => e.textContent.trim().slice(0, 100));
});
console.log('CARDS:', JSON.stringify(cards, null, 2));
await page.screenshot({ path: 'logs/mgmt_check.png', fullPage: true });
await ctx.close();
