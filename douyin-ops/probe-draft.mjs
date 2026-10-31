import { chromium } from 'playwright-core';
import path from 'node:path';

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

// The 发布 button might be a custom div, not <button>. Dump ALL clickable elements
const clickables = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, [role="button"], div[class*="btn"], div[class*="button"], span[class*="btn"], [class*="semi-button"], [class*="master-button"]')];
  return els.map((e, i) => ({
    i,
    tag: e.tagName,
    text: e.textContent.trim().slice(0, 40),
    cls: (e.className || '').toString().slice(0, 80),
    rect: JSON.parse(JSON.stringify(e.getBoundingClientRect())),
  })).filter((e) => e.text && e.rect.width > 0);
});
console.log('CLICKABLES:', JSON.stringify(clickables, null, 1));

// Also look for the 发布 button by text, including nested
const pubByText = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  let node;
  while ((node = walker.nextNode())) {
    if (/^\s*发\s*布\s*$/.test(node.textContent)) {
      const el = node.parentElement;
      const r = el.getBoundingClientRect();
      hits.push({ text: node.textContent, tag: el.tagName, cls: (el.className||'').toString().slice(0,80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return hits;
});
console.log('PUBLISH BY TEXT:', JSON.stringify(pubByText, null, 1));

await page.screenshot({ path: 'logs/draft_diag.png', fullPage: true });
await ctx.close();
