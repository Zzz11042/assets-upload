import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

let createReq = null;
let createRespBody = null;
let createRespStatus = null;
page.on('request', (req) => {
  if (req.url().includes('create_v2')) {
    createReq = { url: req.url().slice(0, 200), body: req.postData()?.slice(0, 500) };
  }
});
page.on('response', async (res) => {
  if (res.url().includes('create_v2')) {
    createRespStatus = res.status();
    createRespBody = await res.text().catch(() => '(error)');
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

// Wait for create_v2 response
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(3000);
  if (createRespBody !== null) {
    console.log(`create_v2 done at ${(i+1)*3}s`);
    break;
  }
}

console.log('\n=== CREATE_V2 ===');
console.log('REQ:', createReq?.url, createReq?.body?.slice(0, 200));
console.log('STATUS:', createRespStatus);
console.log('RESP:', createRespBody?.slice(0, 800));

// Check if the page now shows a success toast or redirect
await page.waitForTimeout(3000);
const state = await page.evaluate(() => ({
  url: location.href,
  hasSuccess: /发布成功|已发布|作品审核中|已提交/.test(document.body.innerText),
  bodyHead: document.body.innerText.slice(0, 300),
}));
console.log('\n=== STATE ===');
console.log(JSON.stringify(state, null, 2));

// Now navigate to content management to verify
console.log('\n=== CHECKING CONTENT MANAGEMENT ===');
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);
const mgmt = await page.evaluate(() => document.body.innerText);
console.log(mgmt.slice(0, 800));

await ctx.close();
