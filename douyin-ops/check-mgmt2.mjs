import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(15000); // longer wait for data to load
const text = await page.evaluate(() => document.body.innerText);
console.log('MANAGE:', text.slice(0, 1000));
await page.screenshot({ path: 'logs/mgmt2.png', fullPage: true });
// Also check drafts
console.log('--- checking drafts ---');
await page.goto('https://creator.douyin.com/creator-micro/content/manage?type=draft', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(8000);
const d = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('DRAFTS:', d);
await ctx.close();
