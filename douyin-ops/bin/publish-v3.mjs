#!/usr/bin/env node
/**
 * Douyin video publish v3 — single-shot: upload file → fill form → click 发布.
 * No reliance on draft restoration; dismisses dialogs as needed.
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

console.log(`[v3] file=${videoFile} title="${title}" desc="${desc}" tags=${tags.join(',')}`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', `v3_${name}.png`), fullPage: true });
    console.log(`[v3] shot logs/v3_${name}.png`);
  } catch {}
}

// 1. Open upload page
console.log('[v3] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. If "继续编辑" dialog appears, click 放弃 to clear the old draft first
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[v3] abandoning old draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload the file
const fileInput = page.locator('input[type="file"]').first();
console.log('[v3] file inputs:', await page.locator('input[type="file"]').count());
await fileInput.setInputFiles(videoFile, { timeout: 30000 });
console.log('[v3] file set; waiting for form to appear...');

// 4. Wait for the post form (title input or 发布 button) — upload must finish first.
//    Watch for a progress element to disappear, or the title input to appear.
const formReady = await page
  .locator('input[placeholder*="标题"], input[placeholder*="作品"], textarea[placeholder*="正文"], textarea[placeholder*="描述"]')
  .first()
  .waitFor({ timeout: 180_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);
console.log('[v3] formReady:', formReady);
await shot('02_form');

if (!formReady) {
  console.log('[v3] ABORT: upload/form did not appear in 180s');
  await ctx.close();
  process.exit(3);
}

// 5. Fill title
if (title) {
  const t = page.locator('input[placeholder*="标题"], input[placeholder*="作品"]').first();
  await t.fill(title, { timeout: 8000 }).catch((e) => console.log('[v3] title err:', e.message));
  console.log('[v3] title filled');
}

// 6. Fill description + hashtags
const body = [desc, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join(' ');
if (body) {
  const d = page.locator('textarea').first();
  if ((await d.count()) > 0) {
    await d.click({ timeout: 5000 }).catch(() => {});
    await d.fill(''); // clear any auto-filled content
    await page.keyboard.type(body, { delay: 60 });
    console.log('[v3] desc typed');
  }
}

await page.waitForTimeout(2000);
await shot('03_filled');

// 7. Scroll to the 发布 button and click it
const pub = page.locator('button:has-text("发 布"), button:has-text("发布")').first();
console.log('[v3] publish btn count:', await pub.count());
await pub.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
await pub.click({ timeout: 10000 }).catch((e) => console.log('[v3] click err:', e.message));

// 8. Watch for success (60s). On success the page often redirects to content management
//    or shows a toast "发布成功".
const success = await page
  .locator('text="发布成功", text="已发布", [class*="toast-success"], [class*="success"]')
  .first()
  .waitFor({ timeout: 60_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);

await page.waitForTimeout(3000);
await shot('04_after_publish');
const finalText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log('[v3] SUCCESS=', success, 'url=', page.url());
console.log('[v3] body head:', finalText);

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
