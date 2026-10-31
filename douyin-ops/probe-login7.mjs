import { chromium } from 'playwright-core';

// Use a SEPARATE profile so we don't fight the running login-sms browser.
const ctx = await chromium.launchPersistentContext('/tmp/dy-probe-profile', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

// Find and click 手机登录 tab (if not already there)
const tabs = await page.evaluate(() => {
  const c = document.querySelector('[class*="douyin-login-container"]');
  if (!c) return [];
  // Grab all elements with short text that look like tab labels
  return [...c.querySelectorAll('span, div, a')]
    .filter(e => e.children.length === 0 && e.textContent.trim().length > 0 && e.textContent.trim().length < 12)
    .map(e => e.textContent.trim())
    .slice(0, 30);
});
console.log('CARD LABELS:', JSON.stringify(tabs));

// Try to find and click "手机登录"
const phoneTab = page.locator('[class*="douyin-login-container"] :text("手机登录")').first();
const phoneTabCount = await phoneTab.count();
console.log('手机登录 count:', phoneTabCount);
if (phoneTabCount > 0) {
  await phoneTab.click({ timeout: 5000 }).catch((e) => console.log('click err:', e.message));
  await page.waitForTimeout(3000);
}

// Check inputs after clicking
const inputs = await page.evaluate(() => {
  return [...document.querySelectorAll('[class*="douyin-login-container"] input, [class*="douyin-login-container"] [contenteditable]')]
    .map(i => ({ tag: i.tagName, type: i.type || '', ph: i.placeholder || '' }));
});
console.log('INPUTS AFTER:', JSON.stringify(inputs));

// Dump all text
const allText = await page.evaluate(() => {
  const c = document.querySelector('[class*="douyin-login-container"]');
  return c ? c.innerText : '(none)';
});
console.log('CARD TEXT AFTER:', JSON.stringify(allText));

await ctx.close();
