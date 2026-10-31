import { chromium } from 'playwright-core';
import fs from 'node:fs';
const storage = JSON.parse(fs.readFileSync('./state/storage.json', 'utf8'));
const ctx = await chromium.launchPersistentContext('/tmp/dy-reply-profile', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
await ctx.addCookies(storage.cookies || []);
const page = ctx.pages()[0] || (await ctx.newPage());

let commentApi = null;
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('comment') && !u.includes('static')) {
    try {
      const body = await res.json();
      commentApi = { url: u.replace('https://creator.douyin.com', ''), status: res.status(), data: body };
      console.log(`[reply-probe] captured: ${commentApi.url.slice(0, 80)}`);
    } catch {}
  }
});

// Visit the interact page (comment management)
await page.goto('https://creator.douyin.com/creator-micro/interact', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

// Try to click the "评论" tab
const tabs = page.locator('[class*="tab"], [role="tab"]');
const nTabs = await tabs.count();
console.log('[reply-probe] tabs:', nTabs);
for (let i = 0; i < nTabs; i++) {
  const label = (await tabs.nth(i).innerText().catch(() => '')).trim();
  if (label.includes('评论')) {
    await tabs.nth(i).click().catch(() => {});
    console.log(`[reply-probe] clicked tab "${label}"`);
    await page.waitForTimeout(5000);
    break;
  }
}

const pageText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[reply-probe] page:', pageText.slice(0, 300));

if (commentApi) {
  const items = commentApi.data?.items || commentApi.data?.data?.items || commentApi.data?.comments || [];
  console.log(`[reply-probe] API comments: ${items.length}`);
  for (const c of items.slice(0, 5)) {
    console.log(`  comment=${(c.text || c.content || '').slice(0, 40)} id=${c.id_str || c.id} user=${c.user?.nickname || c.author?.nickname}`);
  }
  fs.writeFileSync('./state/comments.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    api: commentApi.url,
    commentCount: items.length,
    sample: items.slice(0, 10).map((c) => ({
      id: c.id_str || c.id,
      text: c.text || c.content,
      user: c.user?.nickname || c.author?.nickname,
      videoId: c.aweme_id || c.item_id,
    })),
  }, null, 2));
  console.log('[reply-probe] saved to state/comments.json');
} else {
  console.log('[reply-probe] no comment API — account likely has 0 comments (new account, no published videos yet)');
}

await ctx.close();
