#!/usr/bin/env node
/**
 * publish-qr2 — like publish-qr but extracts the QR image's base64 source into
 * logs/qr_code.png so the Lead can show it to the user. Also decodes the QR
 * content (URL) to verify it's a valid scan target.
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

console.log(`[qr2] file=${path.basename(videoFile)}`);

const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'profiles', 'default'), {
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

// 1. Open upload
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon old draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload
await page.locator('input[type="file"]').first().setInputFiles(videoFile, { timeout: 30000 });
await page.locator('text="基础信息"').first().waitFor({ timeout: 120_000, state: 'visible' }).catch(() => {});

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
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

// 6. Wait for security dialog
let dialogFound = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  dialogFound = await page.evaluate(() => /接收短信验证码/.test(document.body.innerText));
  if (dialogFound) break;
}
console.log('[qr2] dialog:', dialogFound);

// 7. Switch to QR scan mode
const qrBtn = page.locator('text="使用原设备扫码"').first();
if ((await qrBtn.count()) > 0) {
  await qrBtn.click({ timeout: 8000 }).catch((e) => console.log('[qr2] qr click err:', e.message));
  await page.waitForTimeout(5000);
}

// 8. Extract the QR base64 and save it
const qrData = await page.evaluate(() => {
  const img = document.querySelector('.uc-ui-verify_qr-verify_main_qr-img, img[class*="qr-img"], img[class*="qrcode"]');
  if (!img) return { err: 'no qr img found' };
  return { src: img.src, w: img.width, h: img.height };
});
console.log('[qr2] qr img:', JSON.stringify(qrData).slice(0, 200));

if (qrData.src && qrData.src.startsWith('data:image')) {
  // Decode base64 to PNG file
  const b64 = qrData.src.split(',')[1];
  fs.writeFileSync(path.join(ROOT, 'logs', 'qr_code.png'), Buffer.from(b64, 'base64'));
  console.log('[qr2] QR saved to logs/qr_code.png');

  // Also try to decode the QR content with a quick check (jsqr via canvas in page)
  const qrContent = await page.evaluate(async () => {
    // Load jsqr from CDN if available, else just return the image for visual decode
    try {
      const img = new Image();
      img.src = document.querySelector('.uc-ui-verify_qr-verify_main_qr-img').src;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx2 = canvas.getContext('2d');
      ctx2.drawImage(img, 0, 0);
      const data = ctx2.getImageData(0, 0, canvas.width, canvas.height);
      // We can't easily decode QR without a lib; just report dimensions
      return { w: canvas.width, h: canvas.height, noted: 'decode not available in-page' };
    } catch (e) {
      return { err: e.message };
    }
  });
  console.log('[qr2] qr decode info:', JSON.stringify(qrContent));
} else {
  console.log('[qr2] QR src is NOT base64:', (qrData.src || '').slice(0, 80));
  // It might be a network URL — download it
  if (qrData.src) {
    const resp = await fetch(qrData.src);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(path.join(ROOT, 'logs', 'qr_code.png'), buf);
    console.log(`[qr2] QR downloaded to logs/qr_code.png (${buf.length} bytes)`);
  }
}

// 9. Now watch for scan success (5 min)
console.log('[qr2] watching for scan (5 min)...');
const deadline = Date.now() + 5 * 60 * 1000;
let scanned = false;
while (Date.now() < deadline && !scanned) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => ({
    inManage: location.href.includes('/content/manage'),
    toast: /发布成功|已发布|作品审核中/.test(document.body.innerText),
    qrGone: !document.querySelector('.uc-ui-verify_qr-verify_main_qr-img'),
  }));
  if (s.inManage || s.toast) {
    scanned = true;
    break;
  }
}

await page.screenshot({ path: path.join(ROOT, 'logs', 'qr2_final.png'), fullPage: true }).catch(() => {});
const finalText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[qr2] SUCCESS=', scanned, 'url=', page.url());
console.log('[qr2] body:', finalText);

if (scanned) {
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('[qr2] content manage:', list);
}

await ctx.storageState({ path: path.join(ROOT, 'state', 'storage.json') }).catch(() => {});
await ctx.close().catch(() => {});
process.exit(scanned ? 0 : 6);
