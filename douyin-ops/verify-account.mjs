import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/creator-micro/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
// Read account info from the DOM
const info = await page.evaluate(() => {
  const t = document.body.innerText;
  const lines = t.split('\n').slice(0, 30);
  return { lines, url: location.href };
});
console.log('ACCOUNT PAGE:');
info.lines.forEach((l) => console.log(' ', l));
// Also fetch the user info API directly to get nickname
const userResp = await page.evaluate(async () => {
  const r = await fetch('/aweme/v1/creator/user/info/', { method: 'GET', credentials: 'include' });
  return await r.json();
});
console.log('\nUSER INFO API:', JSON.stringify(userResp).slice(0, 500));
await ctx.close();
