import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const cont = page.locator('text="继续编辑"').first();
if ((await cont.count()) > 0) {
  await cont.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(8000);
}
console.log('URL:', page.url());
// Dump the bottom 1500 chars of body text (where the publish section is)
const tail = await page.evaluate(() => document.body.innerText.slice(-1500));
console.log('BODY TAIL:', JSON.stringify(tail));
// Find all elements containing 发布 with their geometry
const pub = await page.evaluate(() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let el;
  while ((el = walker.nextNode())) {
    const txt = (el.textContent || '').trim();
    if ((txt === '发布' || txt === '发 布' || txt === '发布暂存' || txt === '快速填写') && el.children.length <= 3) {
      const r = el.getBoundingClientRect();
      out.push({ tag: el.tagName, text: txt.slice(0, 20), cls: (el.className || '').toString().slice(0, 60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return out;
});
console.log('PUBLISH ELEMENTS:', JSON.stringify(pub, null, 1));
await ctx.close();
