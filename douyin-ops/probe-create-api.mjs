import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// Capture the full create_v2 request + response
let createReq = null;
let createResp = null;
page.on('request', (req) => {
  if (req.url().includes('create_v2')) createReq = { url: req.url(), method: req.method(), body: req.postData() };
});
page.on('response', async (res) => {
  if (res.url().includes('create_v2')) {
    const body = await res.text().catch(() => '(error)');
    createResp = { status: res.status(), url: res.url().slice(0, 100), body: body.slice(0, 1000) };
  }
});

await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}
console.log('setting file...');
await page.locator('input[type="file"]').first().setInputFiles('videos/test.mp4', { timeout: 30000 });
await page.waitForTimeout(40000);

// Fill + click
const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
if ((await t.count()) > 0) await t.fill('AI 自动运营 Day1');
const ed = page.locator('[contenteditable="true"]').first();
if ((await ed.count()) > 0) {
  await ed.click();
  await page.keyboard.type('第一条自动化视频 #测试 #自动化', { delay: 40 });
}
await page.waitForTimeout(2000);

// Check if there's a modal blocking the publish click
const modalText = await page.evaluate(() => {
  const modals = [...document.querySelectorAll('[class*="modal"], [class*="dialog"], [class*="drawer"], [class*="overlay"], [role="dialog"]')];
  return modals.map(m => m.textContent.trim().slice(0, 100)).filter(Boolean);
});
console.log('MODALS:', JSON.stringify(modalText, null, 2));

// Click publish
console.log('clicking 发布...');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter(b => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

await page.waitForTimeout(15000);
console.log('\n=== CREATE_V2 REQUEST ===');
if (createReq) {
  console.log('URL:', createReq.url?.slice(0, 200));
  console.log('BODY:', createReq.body?.slice(0, 2000));
} else console.log('(no create_v2 request captured)');

console.log('\n=== CREATE_V2 RESPONSE ===');
if (createResp) {
  console.log('STATUS:', createResp.status);
  console.log('BODY:', createResp.body);
} else console.log('(no create_v2 response yet)');

// Check what the page shows now
const bodyNow = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log('\n=== PAGE NOW ===');
console.log(bodyNow);

// Try to dismiss any modal and click again
const modal2 = await page.evaluate(() => {
  const modals = [...document.querySelectorAll('[class*="modal"], [class*="dialog"], [role="dialog"]')];
  return modals.map(m => ({ text: m.textContent.trim().slice(0, 80), visible: m.offsetHeight > 0 }));
});
console.log('\nMODALS NOW:', JSON.stringify(modal2, null, 2));

await ctx.close();
