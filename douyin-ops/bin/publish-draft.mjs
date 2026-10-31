#!/usr/bin/env node
/**
 * Publish the existing draft (or a freshly uploaded one) by clicking 发布.
 */
import { chromium } from 'playwright-core';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'profiles', 'default'), {
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

console.log('[publish-draft] opening upload page...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

// Dismiss draft-continue dialog if it appears
const cont = page.locator('text="继续编辑"').first();
if ((await cont.count()) > 0) {
  console.log('[publish-draft] continuing leftover draft');
  await cont.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}
await page.screenshot({ path: path.join(ROOT, 'logs', 'draft_01.png') });

// Now the post page should be at /content/post/video — find 发布 button.
// It's a big button, often labelled "发布" or "发 布" or a two-button split "发布暂存 / 离开".
const btns = await page.evaluate(() => {
  return [...document.querySelectorAll('button')]
    .map((b) => ({ text: b.textContent.trim().slice(0, 30), cls: b.className.slice(0, 60) }))
    .filter((b) => b.text);
});
console.log('[publish-draft] buttons:', JSON.stringify(btns));

// Click the main 发布 button (usually the last big one, or the one with "发布" but not "暂存")
const publishBtn = page.locator('button:has-text("发布")').filter({ hasNotText: /暂存|离开/ }).first();
console.log('[publish-draft] publish btn count:', await publishBtn.count());
await publishBtn.click({ timeout: 10000 }).catch((e) => console.log('[publish-draft] click err:', e.message));

console.log('[publish-draft] clicked; watching for success (60s)...');
const success = await page
  .locator('text="发布成功", text="已发布", [class*="success-toast"], [class*="success"]')
  .first()
  .waitFor({ timeout: 60_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);

await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(ROOT, 'logs', 'draft_02_after.png') });
const finalText = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('[publish-draft] success=', success, 'url=', page.url());
console.log('[publish-draft] body:', finalText);

await ctx.close().catch(() => {});
process.exit(0);
