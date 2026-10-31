import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  const c = document.querySelector('[class*="douyin-login-container"]');
  const avatar = document.querySelector('[class*="avatar"], img[class*="avatar"], [class*="user-info"]');
  return {
    url: location.href,
    loginCardPresent: !!c,
    cardText: c ? c.innerText.slice(0, 300) : '(no card)',
    hasAvatar: !!avatar,
    bodyHead: document.body ? document.body.innerText.slice(0, 200) : '(no body)',
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'logs/verify_login.png' });
// save storage state for headless reuse
const st = await ctx.storageState({ path: 'state/storage.json' });
console.log('storage saved, bytes:', JSON.stringify(st).length);
await ctx.close();
