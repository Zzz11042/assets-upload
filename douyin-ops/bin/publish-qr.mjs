#!/usr/bin/env node
/**
 * publish-qr — drive the publish flow up to the security dialog, then switch to
 * "使用原设备扫码" (QR scan on original device). Screenshots the QR every few
 * seconds to logs/qr_<ts>.png so the Lead can show it to the user. Watches for
 * dialog dismissal / redirect to detect successful scan.
 *
 * Usage: node bin/publish-qr.mjs <video> [--title t] [--desc d] [--tags a,b,c]
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

console.log(`[qr] file=${path.basename(videoFile)} title="${title}"`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', name), fullPage: true });
    console.log(`[qr] shot logs/${name}`);
  } catch {}
}

// 1. Open upload
console.log('[qr] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon old draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[qr] abandoning old draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload
console.log('[qr] setting file...');
await page.locator('input[type="file"]').first().setInputFiles(videoFile, { timeout: 30000 });
const formReady = await page
  .locator('text="基础信息"')
  .first()
  .waitFor({ timeout: 120_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);
console.log('[qr] formReady:', formReady);

// 4. Fill
if (title) {
  const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
  if ((await t.count()) > 0) await t.fill(title.slice(0, 30), { timeout: 5000 }).catch(() => {});
}
const body = [desc, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join(' ');
if (body) {
  const ed = page.locator('[contenteditable="true"]').first();
  if ((await ed.count()) > 0) {
    await ed.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.type(body, { delay: 50 });
  }
}
await page.waitForTimeout(1500);

// 5. Click publish
console.log('[qr] clicking 发布...');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

// 6. Wait for the security dialog
console.log('[qr] waiting for security dialog...');
let dialogFound = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  dialogFound = await page.evaluate(() => /接收短信验证码/.test(document.body.innerText));
  if (dialogFound) {
    console.log(`[qr] dialog appeared at ${i * 2}s`);
    break;
  }
}
if (!dialogFound) {
  console.log('[qr] no dialog — maybe published directly or failed');
  await shot('qr_no_dialog.png');
}

// 7. Click "使用原设备扫码" (QR scan on original device)
console.log('[qr] clicking 使用原设备扫码...');
const qrBtn = page.locator('text="使用原设备扫码"').first();
const nQr = await qrBtn.count();
console.log('[qr] qrBtn count:', nQr);
if (nQr > 0) {
  await qrBtn.click({ timeout: 8000 }).catch((e) => console.log('[qr] qr click err:', e.message));
}
await page.waitForTimeout(5000);

// 8. Find the QR code element and screenshot it repeatedly until dialog closes
console.log('[qr] looking for QR element...');
const qrInfo = await page.evaluate(() => {
  // QR candidates: img/canvas inside the verify mask or a new panel
  const mask = document.querySelector('.second-verify-mask');
  const scope = mask || document;
  const imgs = [...scope.querySelectorAll('img, canvas, [class*="qrcode"], [class*="qr-code"], [class*="scan"]')]
    .map((el) => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), w: el.width || 0, h: el.height || 0, src: (el.src || '').slice(0, 80) }))
    .filter((e) => e.w > 50 || /qr/i.test(e.cls));
  const bodyText = document.body.innerText;
  return {
    qrElements: imgs.slice(0, 10),
    hasQrText: /扫码|扫一扫|二维码/.test(bodyText),
    dialogGone: !/接收短信验证码/.test(bodyText),
    bodyHead: bodyText.slice(0, 300),
  };
});
console.log('[qr] state:', JSON.stringify(qrInfo, null, 1));

// Crop-screenshot the QR region if found, otherwise full-page
const deadline = Date.now() + 5 * 60 * 1000;
let lastShot = 0;
let scanned = false;
while (Date.now() < deadline && !scanned) {
  await page.waitForTimeout(5000);
  const now = Date.now();
  if (now - lastShot > 15000) {
    lastShot = now;
    await shot(`qr_${String(now).slice(-4)}.png`);
  }
  const s = await page.evaluate(() => {
    const t = document.body.innerText;
    const mask = document.querySelector('.second-verify-mask');
    return {
      dialogGone: !/接收短信验证码|使用原设备扫码/.test(t) || !mask,
      inManage: location.href.includes('/content/manage'),
      toast: /发布成功|已发布|作品审核中/.test(t),
      snippet: t.slice(0, 200),
    };
  });
  if (s.inManage || s.toast) {
    scanned = true;
    console.log(`[qr] SCAN SUCCESS at ${Math.round((now - (deadline - 300000)) / 1000)}s`);
    break;
  }
  if (s.dialogGone && !s.inManage && !s.toast) {
    console.log('[qr] dialog dismissed (maybe failed/cancelled); snippet:', s.snippet.slice(0, 100));
  }
}

await page.waitForTimeout(3000);
await shot('qr_final.png');
const finalText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[qr] SUCCESS=', scanned, 'url=', page.url());
console.log('[qr] body:', finalText);

// Verify in content management
if (scanned) {
  console.log('[qr] verifying in content management...');
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('[qr] content manage:', list);
  await shot('qr_content_manage.png');
}

await ctx.storageState({ path: path.join(ROOT, 'state', 'storage.json') }).catch(() => {});
await ctx.close().catch(() => {});
process.exit(scanned ? 0 : 6);
