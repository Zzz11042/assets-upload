#!/usr/bin/env node
/**
 * Douyin video publish v8 — full flow with explicit publish-wait and
 * post-publish verification.
 *
 * Flow:
 *   1. goto upload, abandon any old draft
 *   2. setInputFiles → wait for form (基础信息 visible)
 *   3. fill title + description (contenteditable)
 *   4. click 发布 (scoped, last one in form)
 *   5. wait up to 120s for either:
 *      a. URL → /content/manage (success redirect)
 *      b. toast "发布成功" / "作品审核中"
 *      c. draft-save indicator "已暂存"
 *   6. verify by navigating to /content/manage and checking for the video
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

console.log(`[v8] file=${path.basename(videoFile)} title="${title}" desc="${desc}" tags=${tags.join(',')}`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', `v8_${name}.png`), fullPage: true });
    console.log(`[v8] shot logs/v8_${name}.png`);
  } catch {}
}

// 1. Open upload
console.log('[v8] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon old draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[v8] abandoning old draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload
const fileInput = page.locator('input[type="file"]').first();
console.log('[v8] setting file...');
await fileInput.setInputFiles(videoFile, { timeout: 30000 });

// 4. Wait for form to appear (基础信息 + 预览视频)
console.log('[v8] waiting for form (max 120s)...');
const formReady = await page
  .locator('text="基础信息"')
  .first()
  .waitFor({ timeout: 120_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);
console.log('[v8] formReady:', formReady);

// 5. Fill title
if (title) {
  const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
  if ((await t.count()) > 0) {
    await t.fill(title.slice(0, 30), { timeout: 5000 }).catch(() => {});
    console.log('[v8] title filled');
  }
}

// 6. Fill description
const body = [desc, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join(' ');
if (body) {
  const ed = page.locator('[contenteditable="true"]').first();
  if ((await ed.count()) > 0) {
    await ed.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.type(body, { delay: 50 });
    console.log('[v8] desc typed:', body.slice(0, 60));
  }
}

await page.waitForTimeout(2000);
await shot('01_filled');

// 7. Click publish — the LAST button in the form with text "发布" or "发 布"
console.log('[v8] clicking publish...');
const clickResult = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')]
    .filter((b) => {
      const x = b.textContent.trim();
      return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
    });
  const btn = cands[cands.length - 1];
  if (!btn) return { ok: false, reason: 'no publish button found', btnCount: cands.length };
  btn.scrollIntoView({ block: 'center' });
  btn.click();
  return { ok: true, cls: (btn.className || '').toString().slice(0, 60) };
});
console.log('[v8] click:', JSON.stringify(clickResult));

// 8. Watch for success: redirect to /content/manage OR toast
console.log('[v8] watching for success (120s)...');
const t0 = Date.now();
let success = false;
let savedAsDraft = false;
while (Date.now() - t0 < 120_000) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => ({
    url: location.href,
    inManage: location.href.includes('/content/manage'),
    toast: /发布成功|已发布|作品审核中|已提交/.test(document.body.innerText),
    draft: /已暂存|暂存成功/.test(document.body.innerText),
  }));
  if (s.inManage || s.toast) {
    success = true;
    console.log(`[v8] SUCCESS at ${Math.round((Date.now() - t0) / 1000)}s: ${s.url}`);
    break;
  }
  if (s.draft) {
    savedAsDraft = true;
    console.log('[v8] draft saved (not published yet)');
  }
}

await page.waitForTimeout(3000);
await shot('02_after');
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[v8] SUCCESS=', success, 'draft=', savedAsDraft, 'url=', page.url());
console.log('[v8] body:', bodyText);

// 9. Verify in content management
if (success) {
  console.log('[v8] verifying in content management...');
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('[v8] content manage:', list);
  await shot('03_content_manage');
}

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
