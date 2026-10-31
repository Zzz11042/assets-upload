#!/usr/bin/env node
/**
 * Douyin video publish v2 — robust, step-by-step with screenshot + DOM dump
 * at every stage so failures are diagnosable.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const args = process.argv.slice(2);
const videoFile = args.find((a) => !a.startsWith('--'));
if (!videoFile || !fs.existsSync(path.resolve(videoFile))) {
  console.error('usage: publish.mjs <videoFile> [--title t] [--desc d] [--tags a,b,c]');
  process.exit(2);
}
const opt = (flag, dflt = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const title = opt('--title');
const desc = opt('--desc');
const tags = opt('--tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);

const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'profiles', 'default'), {
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

async function shot(name) {
  try {
    await page.screenshot({ path: path.join(ROOT, 'logs', `v2_${name}.png`), fullPage: true });
    console.log(`[v2] shot logs/v2_${name}.png`);
  } catch {}
}
async function dump(label) {
  const info = await page.evaluate(() => {
    const text = document.body.innerText;
    return { url: location.href, textHead: text.slice(0, 500) };
  });
  console.log(`[v2] --- ${label} ---\nURL: ${info.url}\n${info.textHead}`);
}

// 1. Open upload page
console.log('[v2] open upload page');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Dismiss the "上次未发布的视频" dialog if present
const cont = page.locator('text="继续编辑"').first();
if ((await cont.count()) > 0) {
  console.log('[v2] dismissing leftover-draft dialog');
  await cont.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

// 3. Find the file input — there may be multiple (video + cover image)
const fileInputs = page.locator('input[type="file"]');
console.log('[v2] file inputs:', await fileInputs.count());
const first = fileInputs.first();
await first.setInputFiles(path.resolve(videoFile));
console.log('[v2] file set. Waiting for upload...');

// 4. Wait for upload to finish: watch for a percentage element disappearing
//    or a "开始编辑" / title input appearing. Timeout 120s for small files.
const uploadDone = await page
  .locator('text="开始编辑", input[placeholder*="标题"], input[placeholder*="作品"], button:has-text("发 布")')
  .first()
  .waitFor({ timeout: 120_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);
console.log('[v2] uploadDone:', uploadDone);
await shot('upload');
await dump('after upload');

if (!uploadDone) {
  console.log('[v2] UPLOAD DID NOT FINISH — aborting');
  await ctx.close();
  process.exit(3);
}

// 5. Fill title
if (title) {
  const t = page.locator('input[placeholder*="标题"], input[placeholder*="作品"]').first();
  if ((await t.count()) > 0) {
    await t.fill(title);
    console.log('[v2] title filled');
  } else console.log('[v2] WARN title input not found');
}
// 6. Fill description + tags
const body = [desc, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join(' ');
if (body) {
  const d = page.locator('textarea, [contenteditable="true"]').first();
  if ((await d.count()) > 0) {
    await d.click({ timeout: 5000 }).catch(() => {});
    await page.keyboard.type(body, { delay: 50 });
    console.log('[v2] desc typed:', body.slice(0, 60));
  }
}
await page.waitForTimeout(1000);
await shot('filled');

// 7. Click 发布
const pub = page.locator('button:has-text("发 布"), button:has-text("发布")').first();
console.log('[v2] publish btn:', await pub.count());
await pub.click({ timeout: 10000 });
console.log('[v2] clicked publish, watching for success...');

// 8. Watch for success toast / redirect to content-manage
const success = await page
  .locator('text="发布成功", text="已发布", [class*="success"], [class*="toast"]')
  .first()
  .waitFor({ timeout: 60_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);
await page.waitForTimeout(3000);
await shot('after_publish');
await dump('after publish');

console.log('[v2] SUCCESS_SIGNAL:', success, 'url=', page.url());
await ctx.close().catch(() => {});
process.exit(0);
