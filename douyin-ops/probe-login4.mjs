import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(7000);
// Dump the full login-card innerText (labels, links, placeholder hints)
const cardText = await page.evaluate(() => {
  const c = document.querySelector('[class*="douyin-login-container"]');
  return c ? c.innerText : '(no container)';
});
console.log('LOGIN CARD TEXT:\n' + cardText);
// All clickable-looking elements with their text
const clickables = await page.evaluate(() => {
  return [...document.querySelectorAll('[class*="douyin-login-container"] a, [class*="douyin-login-container"] div[class*="button"], [class*="douyin-login-container"] span[class*="button"], [class*="douyin-login-container"] [role="button"]')]
    .map(e => e.textContent.trim().slice(0, 40)).filter(Boolean).slice(0, 30);
});
console.log('CLICKABLES:', JSON.stringify(clickables));
await ctx.close();
