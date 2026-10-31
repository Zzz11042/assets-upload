#!/usr/bin/env node
/**
 * Douyin video publish v4 — precise, with progress-waiting and safe button
 * selection. Single shot: upload → fill → publish → verify.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const args = process.argv.slice(2);
const videoFile = path.resolve(args.find((a) => !a.startsWith('--')));
const opt = (flag, dflt = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const title = opt('--title');
const desc = opt('--desc');
const tags = opt('--tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);

console.log(`[v4] file=${path.basename(videoFile)} title="${title}" desc="${desc}" tags=${tags.join(',')}`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', `v4_${name}.png`), fullPage: true });
    console.log(`[v4] shot logs/v4_${name}.png`);
  } catch {}
}

// 1. Open upload page
console.log('[v4] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon any leftover draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[v4] abandoning old draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload file
const fileInput = page.locator('input[type="file"]').first();
console.log('[v4] setting file...');
await fileInput.setInputFiles(videoFile, { timeout: 30000 });

// 4. Wait for upload to finish: watch for "isUploading false" log OR for the
//    发布 button to become enabled. Poll page DOM for progress text disappearance.
console.log('[v4] waiting for upload to finish (max 180s)...');
let uploadDone = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const progressEl = document.querySelector('[class*="progress"], [class*="percent"], [class*="uploading"]');
    const progressText = progressEl ? progressEl.textContent.trim() : '';
    const uploadBtn = [...document.querySelectorAll('button')].find(b => /发布/.test(b.textContent) && !/暂存|离开|作品发布/.test(b.closest('[class*="nav"]')?.textContent || ''));
    return { progressText, hasBtn: !!uploadBtn, bodyProgress: /上传中|%\s*$/.test(document.body.innerText.slice(-200)) };
  });
  if (state.hasBtn && !state.bodyProgress) {
    uploadDone = true;
    console.log(`[v4] upload done after ${(i + 1) * 3}s`);
    break;
  }
  if (i % 10 === 9) console.log(`[v4] ... still uploading (${(i + 1) * 3}s) progress="${state.progressText}"`);
}
if (!uploadDone) console.log('[v4] WARN: upload not confirmed complete, proceeding anyway');
await shot('01_upload_done');

// 5. Fill title (作品描述 input, max 30 chars)
if (title) {
  const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
  if ((await t.count()) > 0) {
    await t.fill(title.slice(0, 30));
    console.log('[v4] title filled');
  }
}

// 6. Fill description — it's a contenteditable div, not a textarea
const body = [desc, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join(' ');
if (body) {
  // Find the description editor (div with contenteditable or the one showing "0 / 1000")
  const editor = page.locator('[contenteditable="true"]').first();
  if ((await editor.count()) > 0) {
    await editor.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.keyboard.type(body, { delay: 50 });
    console.log('[v4] desc typed:', body.slice(0, 60));
  } else {
    // Fallback: textarea
    const ta = page.locator('textarea').first();
    if ((await ta.count()) > 0) await ta.fill(body).catch(() => {});
  }
}

// 7. Wait for cover generation to finish (optional, 30s)
console.log('[v4] waiting for cover...');
const coverReady = await page
  .locator('text="Ai智能推荐封面"')
  .first()
  .waitFor({ timeout: 30000 })
  .then(() => true)
  .catch(() => false);
console.log('[v4] coverReady:', coverReady);

await page.waitForTimeout(1500);
await shot('02_filled');

// 8. Click the publish button — use a scoped locator to avoid the side-nav "作品发布"
const pubBtn = page.locator('main button:has-text("发布"), [class*="content"] button:has-text("发 布"), [class*="content"] button:has-text("发布")').last();
const btnCount = await pubBtn.count();
console.log('[v4] publish btn count:', btnCount);
if (btnCount === 0) {
  // Fallback: the last button on the page with text 发布
  await page.locator('button:has-text("发布")').last().click({ timeout: 10000 }).catch((e) => console.log('[v4] fallback click err:', e.message));
} else {
  await pubBtn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await pubBtn.click({ timeout: 10000 }).catch((e) => console.log('[v4] click err:', e.message));
}

// 9. Watch for success: toast "发布成功" or navigation to content-manage.
console.log('[v4] watching for success...');
const success = await page
  .locator('text="发布成功", text="已发布", [class*="success-toast"], [class*="toast"][class*="success"]')
  .first()
  .waitFor({ timeout: 90_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);

await page.waitForTimeout(4000);
await shot('03_after_publish');
const finalText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[v4] SUCCESS=', success, 'url=', page.url());
console.log('[v4] body:', finalText);

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
