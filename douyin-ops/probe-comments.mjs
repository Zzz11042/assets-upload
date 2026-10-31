import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// Capture API calls related to comments, messages, and content list
const apiCalls = [];
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('creator.douyin.com') && (u.includes('comment') || u.includes('message') || u.includes('post/list') || u.includes('item_list') || u.includes('content/list') || u.includes('fan') || u.includes('like'))) {
    try {
      const body = await res.text();
      apiCalls.push({ url: u.replace('https://creator.douyin.com','').slice(0, 120), body: body.slice(0, 300) });
    } catch {}
  }
});

// Visit the comment/message section of the creator portal
console.log('--- visiting message center ---');
await page.goto('https://creator.douyin.com/creator-micro/message', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('message page err:', e.message));
await page.waitForTimeout(10000);
console.log('message page body:', await page.evaluate(() => document.body.innerText.slice(0, 400)));

// Also try the comment reply URL patterns
for (const url of [
  'https://creator.douyin.com/creator-micro/comment',
  'https://creator.douyin.com/creator-micro/interact',
]) {
  console.log(`\n--- visiting ${url} ---`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('err:', e.message));
  await page.waitForTimeout(8000);
  console.log('body:', await page.evaluate(() => document.body.innerText.slice(0, 400)));
}

// Also check content management for the post list API
console.log('\n--- visiting content/manage ---');
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

console.log('\n=== API CALLS ===');
for (const c of apiCalls.slice(0, 20)) {
  console.log(c.url, '=>', c.body.slice(0, 200));
}
await ctx.close();
