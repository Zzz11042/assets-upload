import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(7000);
const cont = page.locator('text="继续编辑"').first();
console.log('draft dialog present:', await cont.count() > 0);
if ((await cont.count()) > 0) {
  await cont.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(10000);
}
console.log('URL:', page.url());
const state = await page.evaluate(() => {
  const text = document.body.innerText;
  const hasDesc = text.includes('第一条自动化视频');
  const hasBaseInfo = text.includes('基础信息');
  const hasPreview = text.includes('预览视频');
  return { hasDesc, hasBaseInfo, hasPreview, textHead: text.slice(0, 200) };
});
console.log(JSON.stringify(state, null, 2));
await page.screenshot({ path: 'logs/post2_diag.png', fullPage: true });
await ctx.close();
