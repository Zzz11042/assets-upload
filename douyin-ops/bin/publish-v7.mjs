#!/usr/bin/env node
/**
 * Douyin video publish v7 — single-session flow.
 *  1. Open upload page, abandon any draft
 *  2. Upload file, WAIT for cover to finish generating (progress gone)
 *  3. Fill title + description
 *  4. Click publish (scoped to form)
 *  5. Stay on the post page, watch for redirect to content-manage
 *
 * Key difference from v6: does NOT reload; waits for the actual upload
 * progress bar to disappear before clicking publish.
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

console.log(`[v7] file=${path.basename(videoFile)}`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', `v7_${name}.png`), fullPage: true });
    console.log(`[v7] shot logs/v7_${name}.png`);
  } catch {}
}

// 1. Open upload
console.log('[v7] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon old draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[v7] abandoning draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload
const fileInput = page.locator('input[type="file"]').first();
console.log('[v7] setting file...');
await fileInput.setInputFiles(videoFile, { timeout: 30000 });

// 4. Wait for upload to finish. The form transitions from the upload zone to
//    "基础信息" + "作品描述". Watch for the 基础信息 text to appear AND
//    progress text to disappear.
console.log('[v7] waiting for form (max 180s)...');
let formReady = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      hasBaseInfo: t.includes('基础信息'),
      hasProgress: /上传中/.test(t),
      hasPreview: t.includes('预览视频'),
    };
  });
  if (s.hasBaseInfo && s.hasPreview && !s.hasProgress) {
    formReady = true;
    console.log(`[v7] form ready after ${(i + 1) * 3}s`);
    break;
  }
  if (i % 10 === 9) console.log(`[v7] ... ${(i + 1) * 3}s`, JSON.stringify(s));
}
if (!formReady) {
  console.log('[v7] form not ready after 180s; proceeding anyway');
}
await shot('01_form');

// 5. Fill title (max 30 chars)
if (title) {
  const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
  if ((await t.count()) > 0) {
    await t.fill(title.slice(0, 30));
    console.log('[v7] title filled');
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
    console.log('[v7] desc typed:', body.slice(0, 60));
  }
}
await page.waitForTimeout(2000);
await shot('02_filled');

// 7. Click publish — scoped to form, NOT side nav.
console.log('[v7] clicking publish...');
const clicked = await page.evaluate(() => {
  // Find the publish button: last button whose trimmed text is exactly "发布"
  // or "发 布" AND is inside the main content (not the header/menu).
  const candidates = [...document.querySelectorAll('button, [role="button"]')]
    .filter((b) => {
      const t = b.textContent.trim();
      return (t === '发布' || t === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
    });
  const btn = candidates[candidates.length - 1]; // last one = form bottom
  if (!btn) return { ok: false, reason: 'no button' };
  btn.scrollIntoView({ block: 'center' });
  btn.click();
  return { ok: true, cls: (btn.className || '').toString().slice(0, 60) };
});
console.log('[v7] click result:', JSON.stringify(clicked));

// 8. Watch for success: page redirects to /content/manage OR a "发布成功" toast.
console.log('[v7] watching for redirect/success (120s)...');
const t0 = Date.now();
let success = false;
while (Date.now() - t0 < 120_000) {
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      url: location.href,
      inManage: location.href.includes('/content/manage'),
      toast: /发布成功|已发布|作品审核中/.test(t),
      onPostPage: location.href.includes('/content/post/'),
    };
  });
  if (state.inManage || state.toast) {
    success = true;
    console.log(`[v7] SUCCESS after ${Math.round((Date.now() - t0) / 1000)}s:`, state.url);
    break;
  }
  if (state.onPostPage && Date.now() - t0 > 60_000) {
    console.log('[v7] still on post page at 60s; body tail:', (state.url || '').slice(0, 100));
  }
}

await page.waitForTimeout(3000);
await shot('03_after');
const finalText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log('[v7] SUCCESS=', success, 'url=', page.url());
console.log('[v7] body:', finalText);

// 9. If success, verify in content management
if (success) {
  console.log('[v7] verifying in content management...');
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log('[v7] content manage:', list);
  await shot('04_content_manage');
}

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
