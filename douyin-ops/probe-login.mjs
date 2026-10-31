import { chromium } from 'playwright-core';

const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: false,
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
  args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--no-first-run'],
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
const page = ctx.pages()[0] || (await ctx.newPage());

console.log('[probe] opening creator.douyin.com ...');
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// Find the login card and enumerate tabs/buttons inside it
const loginCard = page.locator('[class*="login-card"]').first();
const cardHtml = (await loginCard.innerHTML().catch(() => '')) || '';
console.log('[probe] login card html (1200 chars):');
console.log(cardHtml.slice(0, 1200));

// Tabs inside the card
const tabs = page.locator('[class*="login-card"] [class*="tab-"], [class*="login-card"] .tab');
const nTabs = await tabs.count();
console.log('[probe] tab count:', nTabs);
for (let i = 0; i < nTabs; i++) {
  const label = await tabs.nth(i).innerText().catch(() => '?');
  console.log(`[probe] tab[${i}]: "${label}"`);
}

// Screenshots
await page.screenshot({ path: 'logs/probe_01.png' });
// Click second tab if exists (短信登录 / phone login)
if (nTabs >= 2) {
  await tabs.nth(1).click().catch((e) => console.log('[probe] click tab1:', e.message));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'logs/probe_02_phone_tab.png' });
  // Look for phone input + get-code button
  const inputs = await page.locator('[class*="login-card"] input, [class*="douyin-login-container"] input').all();
  for (const inp of inputs) {
    const type = await inp.getAttribute('type').catch(() => null);
    const ph = await inp.getAttribute('placeholder').catch(() => null);
    console.log('[probe] input:', type, ph);
  }
}
console.log('[probe] DONE — page left open. Now check the GUI / X screen.');
await ctx.close().catch(() => {});
process.exit(0);
