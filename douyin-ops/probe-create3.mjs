import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// Use CDP to get the full response body
const client = await ctx.newCDPSession(page);

let createRespFull = null;
page.on('response', async (res) => {
  if (res.url().includes('create_v2')) {
    // Use CDP to get the full body
    try {
      const body = await res.body();
      createRespFull = { status: res.status(), body: body.toString().slice(0, 2000) };
    } catch (e) {
      createRespFull = { status: res.status(), body: '(failed to read: ' + e.message + ')' };
    }
  }
});

await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}
await page.locator('input[type="file"]').first().setInputFiles('videos/test.mp4', { timeout: 30000 });
await page.waitForTimeout(40000);

const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
if ((await t.count()) > 0) await t.fill('AI 自动运营 Day1');
const ed = page.locator('[contenteditable="true"]').first();
if ((await ed.count()) > 0) {
  await ed.click();
  await page.keyboard.type('第一条自动化视频 #测试 #自动化', { delay: 40 });
}
await page.waitForTimeout(2000);

console.log('clicking 发布...');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter(b => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

// Wait for response
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(3000);
  if (createRespFull) break;
}

console.log('\n=== CREATE_V2 FULL RESPONSE ===');
console.log(JSON.stringify(createRespFull, null, 2));

// Also check if there are any error toasts or modals after
await page.waitForTimeout(3000);
const postState = await page.evaluate(() => {
  const modals = [...document.querySelectorAll('[class*="modal"], [class*="dialog"], [role="dialog"]')].map(m => m.textContent.trim().slice(0, 100));
  const toasts = [...document.querySelectorAll('[class*="toast"], [class*="message"]')].map(m => m.textContent.trim().slice(0, 100));
  return { modals, toasts, bodyTail: document.body.innerText.slice(-500) };
});
console.log('\n=== POST-CLICK STATE ===');
console.log(JSON.stringify(postState, null, 2));

await ctx.close();
