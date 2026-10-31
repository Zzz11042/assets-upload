#!/usr/bin/env node
/**
 * publish-qr3 — robust QR-scan publish:
 *  - re-triggers the security dialog each time a fresh QR is needed
 *  - saves the QR to logs/qr_code.png (base64, 512x512)
 *  - every 45s, if the QR hasn't been scanned yet, refreshes it (re-clicks
 *    获取验证码/使用原设备扫码 path) to keep a live code on screen
 *  - exits 0 when the post publishes, 6 on timeout
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
const maxMin = Number(opt('--max-min', '15'));

console.log(`[qr3] file=${path.basename(videoFile)} maxMin=${maxMin}`);

const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'profiles', 'default'), {
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

async function fillAndPublish() {
  console.log('[qr3] goto upload...');
  await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const abandon = page.locator('text="放弃"').first();
  if ((await abandon.count()) > 0) {
    await abandon.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(4000);
  }

  console.log('[qr3] setting file...');
  await page.locator('input[type="file"]').first().setInputFiles(videoFile, { timeout: 30000 });
  await page.locator('text="基础信息"').first().waitFor({ timeout: 120_000, state: 'visible' }).catch(() => {});

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

  console.log('[qr3] clicking 发布...');
  await page.evaluate(() => {
    const cands = [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
      const x = b.textContent.trim();
      return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
    });
    cands[cands.length - 1].click();
  });
}

async function waitDialog() {
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const found = await page.evaluate(() => /接收短信验证码|使用原设备扫码/.test(document.body.innerText));
    if (found) {
      console.log(`[qr3] dialog appeared at ${i * 2}s`);
      return true;
    }
  }
  return false;
}

async function showQr() {
  // Click 使用原设备扫码 to switch to QR mode
  const qrBtn = page.locator('text="使用原设备扫码"').first();
  if ((await qrBtn.count()) > 0) {
    await qrBtn.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(5000);
  }
  const qrData = await page.evaluate(() => {
    const img = document.querySelector('.uc-ui-verify_qr-verify_main_qr-img');
    return img ? { src: img.src, w: img.width } : null;
  });
  if (qrData?.src?.startsWith('data:image')) {
    fs.writeFileSync(path.join(ROOT, 'logs', 'qr_code.png'), Buffer.from(qrData.src.split(',')[1], 'base64'));
    console.log(`[qr3] QR refreshed → logs/qr_code.png`);
    return true;
  }
  console.log('[qr3] no QR image found');
  return false;
}

// Drive the flow
await fillAndPublish();
if (!(await waitDialog())) {
  console.log('[qr3] no dialog appeared — may have published directly or form failed');
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('[qr3] body:', txt);
  await ctx.close().catch(() => {});
  process.exit(7);
}

await showQr();

const deadline = Date.now() + maxMin * 60 * 1000;
let lastRefresh = Date.now();
let success = false;

while (Date.now() < deadline && !success) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => ({
    inManage: location.href.includes('/content/manage'),
    toast: /发布成功|已发布|作品审核中/.test(document.body.innerText),
    dialogStill: /接收短信验证码|使用原设备扫码/.test(document.body.innerText),
  }));

  if (s.inManage || s.toast) {
    success = true;
    console.log('[qr3] SUCCESS');
    break;
  }

  // Refresh the QR every 45s (QR codes expire ~60s)
  if (s.dialogStill && Date.now() - lastRefresh > 45_000) {
    lastRefresh = Date.now();
    await showQr();
  }
}

await page.screenshot({ path: path.join(ROOT, 'logs', 'qr3_final.png'), fullPage: true }).catch(() => {});
console.log('[qr3] SUCCESS=', success, 'url=', page.url());

if (success) {
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('[qr3] content manage:', list);
}

await ctx.storageState({ path: path.join(ROOT, 'state', 'storage.json') }).catch(() => {});
await ctx.close().catch(() => {});
process.exit(success ? 0 : 6);
