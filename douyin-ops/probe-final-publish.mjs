import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// Capture all POST requests (publish will be a POST)
const posts = [];
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('creator.douyin.com')) {
    posts.push({ url: req.url().slice(0, 140), body: req.postData()?.slice(0, 200) });
  }
});
// Capture console logs with "isUploading" or "publish" or "success"
let stateLog = null;
page.on('console', (m) => {
  const t = m.text();
  if (/isUploading|publish|success|发布/.test(t)) stateLog = t.slice(0, 200);
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

// Wait for 检测 to finish (up to 60s)
console.log('waiting for 检测 to complete...');
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/检测中\s*(\d+)%/);
    return { detecting: !!m, pct: m ? parseInt(m[1]) : null };
  });
  if (!s.detecting || s.pct === 100) {
    console.log(`检测 done at ${(i+1)*3}s`, s);
    break;
  }
}

// Fill title + desc
const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
if ((await t.count()) > 0) await t.fill('AI 自动运营 Day1');
const ed = page.locator('[contenteditable="true"]').first();
if ((await ed.count()) > 0) {
  await ed.click();
  await page.keyboard.type('第一条自动化视频 #测试 #自动化', { delay: 40 });
}
await page.waitForTimeout(2000);

// Click publish
console.log('clicking 发布...');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter(b => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

// Watch for success or redirect for 120s
console.log('watching for success/redirect (120s)...');
let result = 'timeout';
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => ({
    url: location.href,
    inManage: location.href.includes('/content/manage'),
    text: document.body.innerText.slice(0, 400),
  }));
  if (s.inManage) { result = 'redirect-to-manage'; break; }
  if (/发布成功|已发布|作品审核中|已提交/.test(s.text)) { result = 'toast'; break; }
  if (i === 39) result = 'timeout';
}
console.log('RESULT:', result, 'url=', page.url());
console.log('last stateLog:', stateLog);
console.log('POST requests during publish:');
for (const p of posts.filter(p => /publish|create|post\/|commit|aweme\/v1\/(post|video)/.test(p.url))) {
  console.log(' ', p.url, p.body?.slice(0,100));
}

// Verify in content management
console.log('--- verifying in content management ---');
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const mgmtText = await page.evaluate(() => document.body.innerText.slice(0, 800));
console.log(mgmtText);
await page.screenshot({ path: 'logs/final_mgmt.png', fullPage: true });
await ctx.close();
