#!/usr/bin/env node
/**
 * Douyin video publish v6 — full flow: upload → fill → publish, with a
 * reliable publish-button locator and strict success detection.
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

console.log(`[v6] file=${path.basename(videoFile)} title="${title}" desc="${desc}" tags=${tags.join(',')}`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', `v6_${name}.png`), fullPage: true });
    console.log(`[v6] shot logs/v6_${name}.png`);
  } catch {}
}

// 1. Open upload page
console.log('[v6] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon any leftover draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[v6] abandoning old draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload file
const fileInput = page.locator('input[type="file"]').first();
console.log('[v6] setting file...');
await fileInput.setInputFiles(videoFile, { timeout: 30000 });

// 4. Wait for upload to finish: watch for 发布 button to be enabled AND progress text gone.
console.log('[v6] waiting for upload (max 180s)...');
let uploadDone = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    // Find the publish button in the FORM (not the side nav).
    const allBtns = [...document.querySelectorAll('button, [role="button"]')];
    const pubBtn = allBtns.find((b) => {
      const t = b.textContent.trim();
      return (t === '发布' || t === '发 布') && !b.closest('[class*="nav"], [class*="menu"], [class*="header"]');
    });
    const progress = /上传中/.test(document.body.innerText);
    return { hasPubBtn: !!pubBtn, progress, disabled: pubBtn?.disabled };
  });
  if (s.hasPubBtn && !s.progress && !s.disabled) {
    uploadDone = true;
    console.log(`[v6] upload done after ${(i + 1) * 3}s`);
    break;
  }
  if (i % 10 === 9) console.log(`[v6] ... ${(i + 1) * 3}s pubBtn=${s.hasPubBtn} progress=${s.progress} disabled=${s.disabled}`);
}
if (!uploadDone) console.log('[v6] WARN: upload not confirmed, proceeding anyway');
await shot('01_upload');

// 5. Fill title (max 30 chars)
if (title) {
  const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
  if ((await t.count()) > 0) {
    await t.fill(title.slice(0, 30));
    console.log('[v6] title filled');
  }
}

// 6. Fill description in contenteditable
const body = [desc, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join(' ');
if (body) {
  const editor = page.locator('[contenteditable="true"]').first();
  if ((await editor.count()) > 0) {
    await editor.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.keyboard.type(body, { delay: 50 });
    console.log('[v6] desc typed:', body.slice(0, 60));
  }
}

// 7. Wait for cover (optional, 30s)
await page.waitForTimeout(5000);
await shot('02_filled');

// 8. Click the publish button (scoped to form, not nav)
console.log('[v6] clicking publish...');
const clicked = await page.evaluate(() => {
  const allBtns = [...document.querySelectorAll('button, [role="button"]')];
  const pubBtn = allBtns.find((b) => {
    const t = b.textContent.trim();
    return (t === '发布' || t === '发 布') && !b.closest('[class*="nav"], [class*="menu"], [class*="header"]');
  });
  if (!pubBtn) return false;
  pubBtn.scrollIntoView({ block: 'center' });
  pubBtn.click();
  return true;
});
console.log('[v6] clicked:', clicked);

// 9. Watch for success: URL change to content-manage OR "发布成功" toast.
console.log('[v6] watching for success (90s)...');
const success = await page
  .waitForURL((u) => u.href.includes('/content/manage') || u.href.includes('/content/upload'), { timeout: 90_000 })
  .then(async () => {
    // Check for a success indicator
    const toast = await page.locator('text="发布成功", text="已发布", [class*="success"]').first().count();
    return toast > 0;
  })
  .catch(() => false);

await page.waitForTimeout(4000);
await shot('03_after');
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[v6] SUCCESS=', success, 'url=', page.url());
console.log('[v6] body:', bodyText);

// 10. Verify in content management
if (success) {
  console.log('[v6] verifying in content management...');
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log('[v6] content manage:', list);
  await shot('04_content_manage');
}

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
