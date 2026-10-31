import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(7000);
// Click "短信登录" / "手机登录" if present
let hit = '';
for (const label of ['手机登录', '短信登录', '手机号登录']) {
  const t = page.locator(`[class*="douyin-login-container"] :text("${label}")`).first();
  if ((await t.count()) > 0) {
    await t.click({ timeout: 4000 }).catch(() => {});
    hit = label;
    break;
  }
}
console.log('clicked:', hit || '(none — tabs shown below)');
await page.waitForTimeout(2500);
// Enumerate all tab-like elements
const tabs = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[class*="douyin-login-container"] [class*="tab"], [class*="douyin-login-container"] [class*="Tab"]')];
  return els.map(e => ({ text: e.textContent.trim().slice(0, 20), cls: e.className.slice(0, 70) }));
});
console.log('tabs:', JSON.stringify(tabs));
const inputs = await page.evaluate(() => {
  return [...document.querySelectorAll('[class*="douyin-login-container"] input')].map(i => ({ type: i.type, ph: i.placeholder }));
});
console.log('inputs:', JSON.stringify(inputs));
const btns = await page.evaluate(() => {
  return [...document.querySelectorAll('[class*="douyin-login-container"] button, [class*="douyin-login-container"] [class*="btn"]')].map(b => b.textContent.trim().slice(0, 24)).filter(Boolean);
});
console.log('buttons:', JSON.stringify(btns));
await page.screenshot({ path: 'logs/sms_probe3.png' });
await ctx.close();
