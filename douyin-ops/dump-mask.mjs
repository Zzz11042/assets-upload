import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true, args: ['--no-sandbox'], locale: 'zh-CN',
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) { await abandon.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(4000); }
await page.locator('input[type="file"]').first().setInputFiles('videos/ai-ops-day1.mp4', { timeout: 30000 });
await page.waitForTimeout(40000);
const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
if ((await t.count()) > 0) await t.fill('AI 自动运营 Day1');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '发布' && !b.closest('[class*="header"],[class*="menu"],[class*="nav"]'));
  cands[cands.length - 1]?.click();
});
await page.waitForTimeout(6000);
// Dump the mask structure
const dump = await page.evaluate(() => {
  const mask = document.querySelector('.second-verify-mask');
  if (!mask) return { err: 'no mask' };
  // All elements with text 验证/确认/取消/获取
  const hits = [];
  const walk = (el) => {
    for (const c of el.querySelectorAll('*')) {
      const txt = (c.textContent || '').trim();
      if (/^(验证|确认|取消|获取验证码|重新获取|收不到)/.test(txt) && c.children.length <= 2) {
        const r = c.getBoundingClientRect();
        hits.push({ tag: c.tagName, txt: txt.slice(0, 20), cls: (c.className || '').toString().slice(0, 60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
  };
  walk(mask);
  const allText = mask.innerText;
  return { hits: hits.slice(0, 20), allText: allText.slice(0, 400) };
});
console.log(JSON.stringify(dump, null, 2));
await ctx.close();
