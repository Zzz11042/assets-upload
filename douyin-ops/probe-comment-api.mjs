import { chromium } from 'playwright-core';
import fs from 'node:fs';
const storage = JSON.parse(fs.readFileSync('./state/storage.json', 'utf8'));
const ctx = await chromium.launchPersistentContext('/tmp/dy-comment-api-profile', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
await ctx.addCookies(storage.cookies || []);
const page = ctx.pages()[0] || (await ctx.newPage());

// Capture all comment-related API calls with their request details
const apiCalls = [];
page.on('request', (req) => {
  if (req.url().includes('comment') && !req.url().includes('static')) {
    apiCalls.push({ method: req.method(), url: req.url().replace('https://creator.douyin.com','').slice(0, 140), body: req.postData()?.slice(0, 200) });
  }
});
page.on('response', async (res) => {
  if (res.url().includes('comment') && !res.url().includes('static')) {
    const body = await res.text().catch(() => '(binary)');
    apiCalls.push({ status: res.status(), url: res.url().replace('https://creator.douyin.com','').slice(0, 140), resp: body.slice(0, 300) });
  }
});

await page.goto('https://creator.douyin.com/creator-micro/interact', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

console.log('=== COMMENT API CALLS ===');
for (const c of apiCalls) {
  console.log(JSON.stringify(c));
}

// Try to call the comment list API directly for this account
// The API endpoint pattern: /aweme/v1/creator/notice/comment/ or /aweme/v1/comment/list/
const directCalls = [
  '/aweme/v1/creator/notice/comment/?aid=2906&app_name=aweme_creator_platform&device_platform=web',
];
for (const url of directCalls) {
  console.log(`\n--- Direct call: ${url.slice(0, 60)} ---`);
  const result = await page.evaluate(async (u) => {
    const r = await fetch(u, { method: 'GET', credentials: 'include' });
    return await r.text();
  }, 'https://creator.douyin.com' + url);
  console.log(result.slice(0, 400));
}

await ctx.close();
