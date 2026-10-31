import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  // look for video cards / list
  const cards = [...document.querySelectorAll('[class*="video"], [class*="content-item"], [class*="work"]')].slice(0, 10);
  const text = document.body.innerText.slice(0, 800);
  return { cardCount: cards.length, bodyHead: text };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'logs/check_content.png' });
await ctx.close();
