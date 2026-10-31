#!/usr/bin/env node
/**
 * Publish a draft by clicking the real 发布 button (scoped to the form area,
 * not the side nav). The draft must already be saved on the post page.
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

async function shot(name) {
  try {
    await page.screenshot({ path: path.join(ROOT, 'logs', `v5_${name}.png`), fullPage: true });
    console.log(`[v5] shot logs/v5_${name}.png`);
  } catch {}
}

console.log('[v5] open upload (restores draft)...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// Continue the draft if the dialog appears
const cont = page.locator('text="继续编辑"').first();
if ((await cont.count()) > 0) {
  console.log('[v5] continuing draft');
  await cont.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

// Enumerate ALL buttons to find the real publish one
const btns = await page.evaluate(() => {
  return [...document.querySelectorAll('button, [role="button"]')]
    .map((b, i) => ({ i, text: b.textContent.trim().slice(0, 30), cls: (b.className || '').toString().slice(0, 60), disabled: b.disabled }))
    .filter((b) => b.text);
});
console.log('[v5] buttons:', JSON.stringify(btns, null, 2));

// The publish button is the LAST button whose text is exactly "发布" or "发 布"
// and which is NOT inside the side nav.
const pubCandidates = page.locator('button:has-text("发 布"), button:has-text("发布")');
const n = await pubCandidates.count();
console.log('[v5] publish candidates:', n);

// Click the LAST one (the big bottom one, not the side-nav entry)
let clicked = false;
for (let i = n - 1; i >= 0; i--) {
  const b = pubCandidates.nth(i);
  const txt = (await b.textContent().catch(() => '')).trim();
  if (txt === '发布' || txt === '发 布') {
    console.log(`[v5] clicking candidate ${i}: "${txt}"`);
    await b.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await b.click({ timeout: 10000 }).catch((e) => console.log('[v5] click err:', e.message));
    clicked = true;
    break;
  }
}
if (!clicked) {
  console.log('[v5] no exact "发布" button found; trying any 发布');
  await pubCandidates.last().click({ timeout: 10000 }).catch((e) => console.log('[v5] err:', e.message));
}

// Watch for success
console.log('[v5] watching for success (90s)...');
const success = await page
  .locator('text="发布成功", text="已发布", text="作品审核中", [class*="toast-success"]')
  .first()
  .waitFor({ timeout: 90_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);

await page.waitForTimeout(4000);
await shot('01_after');
const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log('[v5] SUCCESS=', success, 'url=', page.url());
console.log('[v5] body:', body);

// Verify via content management
if (success) {
  console.log('[v5] verifying in content management...');
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('[v5] content manage:', list);
  await shot('02_content_manage');
}

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
