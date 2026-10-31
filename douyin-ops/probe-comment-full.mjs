import { chromium } from 'playwright-core';
import fs from 'node:fs';
const storage = JSON.parse(fs.readFileSync('./state/storage.json', 'utf8'));
const ctx = await chromium.launchPersistentContext('/tmp/dy-comment-full', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
await ctx.addCookies(storage.cookies || []);
const page = ctx.pages()[0] || (await ctx.newPage());

// The comment notice API — try the full URL pattern from the probe
// /aweme/v1/creator/notice/comment/
const result = await page.evaluate(async () => {
  const r = await fetch('/aweme/v1/creator/notice/comment/?aid=2906&app_name=aweme_creator_platform&device_platform=web', {
    method: 'GET', credentials: 'include',
  });
  return await r.json();
});
console.log('COMMENT NOTICE API:', JSON.stringify(result, null, 2).slice(0, 600));

// Also try the reply API pattern (what we'll use to post replies)
// /aweme/v1/comment/reply/ or /aweme/v1/comment/create/
// The typical Douyin comment reply endpoint is POST /aweme/v1/comment/reply/
// Let's check what the interact page's JS bundle references
const bundles = await page.evaluate(async () => {
  // Find the JS bundle URLs
  return [...document.querySelectorAll('script[src]')].map(s => s.src).filter(s => s.includes('creator') || s.includes('bytedance')).slice(0, 5);
});
console.log('BUNDLES:', bundles);

await ctx.close();
