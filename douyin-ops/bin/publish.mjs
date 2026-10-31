#!/usr/bin/env node
/**
 * Douyin video publish (headless, persistent profile).
 *
 * Usage:
 *   node bin/publish.mjs <videoFile> [--title "标题"] [--desc "正文"] [--tags a,b,c]
 *
 * Flow:
 *  1. Open https://creator.douyin.com/creator-micro/content/upload
 *  2. Upload the local video via the file input.
 *  3. Fill title + description + tags if provided.
 *  4. Click the 发布 button.
 *  5. Watch for success toast / navigation; screenshot at each step.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const args = process.argv.slice(2);
const videoFile = args.find((a) => !a.startsWith('--'));
if (!videoFile || !fs.existsSync(videoFile)) {
  console.error('usage: publish.mjs <videoFile> [--title t] [--desc d] [--tags a,b,c]');
  process.exit(2);
}
const opt = (flag, dflt = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const title = opt('--title');
const desc = opt('--desc');
const tags = opt('--tags').split(',').map((s) => s.trim()).filter(Boolean);

console.log(`[publish] file=${videoFile} title="${title}" desc="${desc.slice(0, 40)}" tags=${tags.join(',')}`);

const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'profiles', 'default'), {
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
  locale: 'zh-CN',
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

async function shot(name) {
  try {
    await page.screenshot({ path: path.join(ROOT, 'logs', `pub_${name}.png`), fullPage: false });
    console.log(`[publish] screenshot logs/pub_${name}.png`);
  } catch {}
}

console.log('[publish] opening upload page ...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
await shot('01_upload_page');

// Find the file input (may be hidden)
const fileInput = page.locator('input[type="file"]').first();
console.log('[publish] file input count:', await fileInput.count());
if ((await fileInput.count()) === 0) {
  // Some layouts use a drop-zone; set the file on the nearest [accept*="video"]
  const drop = page.locator('[accept*="video"], input[accept*="video"]').first();
  if ((await drop.count()) > 0) await drop.setInputFiles(videoFile);
  else {
    console.error('[publish] ERR: no file input found — see logs/pub_01_upload_page.png');
    process.exit(3);
  }
} else {
  await fileInput.setInputFiles(path.resolve(videoFile), { timeout: 30000 });
}
console.log('[publish] file set, waiting for upload progress...');
await page.waitForTimeout(10000);
await shot('02_after_upload');

// Fill title
if (title) {
  const tInput = page.locator('input[placeholder*="标题"], input[placeholder*="作品"]').first();
  if ((await tInput.count()) > 0) await tInput.fill(title).catch(() => {});
  else console.log('[publish] WARN: title input not found');
}
// Fill description / 正文
if (desc || tags.length) {
  const body = await desc
    ? page.locator('textarea[placeholder*="正文"], textarea[placeholder*="描述"], [contenteditable]').first()
    : null;
  const fullText = [desc, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n');
  const descEl = page.locator('textarea, [contenteditable="true"]').first();
  if (fullText && (await descEl.count()) > 0) {
    await descEl.click().catch(() => {});
    await page.keyboard.type(fullText, { delay: 60 });
  }
}
await page.waitForTimeout(1500);
await shot('03_filled');

// Click 发布
const publishBtn = page.locator('button:has-text("发 布"), button:has-text("发布"), [class*="publish"] button').first();
console.log('[publish] publish btn count:', await publishBtn.count());
await publishBtn.click({ timeout: 10000 }).catch((e) => console.log('[publish] publish click err:', e.message));
console.log('[publish] waiting for result ...');
await page.waitForTimeout(15000);
await shot('04_after_publish');

const finalInfo = await page.evaluate(() => {
  const toast = document.querySelector('[class*="toast"], [class*="success"], [role="alert"]');
  return {
    url: location.href,
    toast: toast ? toast.textContent.trim().slice(0, 120) : '',
    bodyHead: document.body.innerText.slice(0, 300),
  };
});
console.log('[publish] final:', JSON.stringify(finalInfo, null, 2));
await ctx.close().catch(() => {});
process.exit(0);
