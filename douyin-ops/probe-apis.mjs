import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
const apiCalls = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('creator.douyin.com') && (u.includes('/aweme/') || u.includes('/web/api/') || u.includes('/ies/'))) {
    apiCalls.push({ method: req.method(), url: u.replace('https://creator.douyin.com', '').slice(0, 150), postData: req.postData()?.slice(0, 150) });
  }
});
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const cont = page.locator('text="继续编辑"').first();
if ((await cont.count()) > 0) {
  await cont.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(8000);
}
// wait 30 more seconds to capture all API calls
await page.waitForTimeout(20000);
console.log('TOTAL API CALLS:', apiCalls.length);
// dedupe
const uniq = [...new Map(apiCalls.map(c => [c.url, c])).values()];
for (const c of uniq.slice(0, 60)) {
  console.log(`${c.method} ${c.url}`);
  if (c.postData) console.log(`   body: ${c.postData}`);
}
await ctx.close();
