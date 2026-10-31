import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
const cookies = await ctx.cookies();
console.log('cookieNames:', cookies.map((c) => c.name).join(', '));
console.log('cookieCount:', cookies.length);
const domInfo = await page.evaluate(() => {
  const text = document.body ? document.body.innerText.slice(0, 800) : '(no body)';
  const imgs = [...document.querySelectorAll('img')].map((i) => (i.src || i.alt || '').split('/').pop().slice(0, 60)).filter(Boolean).slice(0, 30);
  const buttons = [...document.querySelectorAll('button,[class*="login"],[class*="qrcode"],[class*="Qrcode"],[class*="verify"]')].map((b) => (b.className || b.tagName || '').toString().slice(0, 90)).filter(Boolean).slice(0, 20);
  return { text, imgs, buttons };
}).catch((e) => ({ err: e.message }));
console.log(JSON.stringify(domInfo, null, 2));
await ctx.close();
