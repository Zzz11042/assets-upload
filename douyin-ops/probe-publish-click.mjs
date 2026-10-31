import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
const responses = [];
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('publish') || u.includes('post') || u.includes('create') || u.includes('commit') || u.includes('aweme/v1')) {
    const body = await res.text().catch(() => '(binary)');
    responses.push({ status: res.status(), url: u.slice(0, 140), body: body.slice(0, 300) });
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
// Wait for form + cover
await page.waitForTimeout(45000);
console.log('filling + clicking publish...');
const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
if ((await t.count()) > 0) await t.fill('AI 自动运营 Day1');
const ed = page.locator('[contenteditable="true"]').first();
if ((await ed.count()) > 0) {
  await ed.click();
  await page.keyboard.type('第一条自动化视频 #测试 #自动化', { delay: 40 });
}
// Click publish
const clicked = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter(b => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  const btn = cands[cands.length - 1];
  if (!btn) return false;
  btn.scrollIntoView({ block: 'center' });
  btn.click();
  return true;
});
console.log('clicked:', clicked);
await page.waitForTimeout(20000);
console.log('--- publish-related responses ---');
for (const r of responses) {
  if (!/auth|upload\/auth|fast_detect|cover\/gen|poll/.test(r.url)) {
    console.log(`${r.status} ${r.url}`);
    console.log(`   ${r.body}`);
  }
}
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log('URL:', page.url());
console.log('BODY:', bodyText);
await page.screenshot({ path: 'logs/pubclick.png', fullPage: true });
await ctx.close();
