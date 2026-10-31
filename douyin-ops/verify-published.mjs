import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// Navigate to content management and capture the API response
const responses = [];
page.on('response', async (res) => {
  if (res.url().includes('content/manage') || res.url().includes('aweme') || res.url().includes('post/list')) {
    try {
      const body = await res.text();
      responses.push({ url: res.url().slice(0, 100), body: body.slice(0, 500) });
    } catch {}
  }
});

await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

// Read the visible content
const bodyText = await page.evaluate(() => document.body.innerText);
console.log('MANAGE PAGE TEXT:', bodyText.slice(0, 800));

// Check API responses for video list
console.log('\n--- API responses ---');
for (const r of responses) {
  if (r.body.includes('video') || r.body.includes('item') || r.body.includes('post')) {
    console.log(r.url, '=>', r.body.slice(0, 300));
  }
}

// Look for the specific video we published
const hasVideo = bodyText.includes('AI 自动运营') || bodyText.includes('测试') || bodyText.includes('v0200fg');
console.log('\nHAS PUBLISHED VIDEO:', hasVideo);

await page.screenshot({ path: 'logs/verify_mgmt.png', fullPage: true });
await ctx.close();
