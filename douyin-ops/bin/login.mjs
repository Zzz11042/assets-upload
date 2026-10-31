#!/usr/bin/env node
/**
 * Douyin login for douyin-ops.
 * Opens a persistent Chromium profile at https://creator.douyin.com and waits
 * for the user to log in (phone+SMS or QR scan). Screenshots the login page
 * every few seconds so the Lead can show the QR code to the user, and detects
 * success by the absence of the QR/login modal.
 *
 * Usage: node bin/login.mjs [--timeout-ms 600000]
 * Exits 0 when logged in, 1 on timeout/failure.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const PROFILE = process.env.DY_PROFILE || path.join(ROOT, 'profiles', 'default');
const CHROME = process.env.DY_CHROME || '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const LOGDIR = path.join(ROOT, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });

const timeoutMs = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--timeout-ms')) || 10 * 60 * 1000;
const deadline = Date.now() + timeoutMs;

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: false,
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// Basic stealth: hide webdriver flag, spoof normal UA
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

async function shot(name) {
  try {
    await page.screenshot({ path: path.join(LOGDIR, name) });
    console.log(`[login] screenshot: ${name}`);
  } catch {}
}

console.log('[login] opening creator.douyin.com ...');
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch((e) => console.log('[login] goto:', e.message));
await shot('login_01.png');

function isLoggedOut(pageEl) {
  return pageEl.locator('text=扫码登录').count() > 0 || pageEl.locator('[class*="qrcode"]').count() > 0;
}

let lastShot = 0;
while (Date.now() < deadline) {
  await page.bringToFront().catch(() => {});
  const url = page.url();
  // Logged-in signals: we're on the creator home and the phone/qrcode login card is gone
  const hasLoginCard = await page.locator('text=短信登录').count().catch(() => 0);
  const hasQr = await page.locator('img[class*="qrcode"], [class*="qr-code"], [class*="QrCode"]').count().catch(() => 0);
  const loggedIn = url.includes('creator.douyin.com') && hasLoginCard === 0 && hasQr === 0;
  const now = Date.now();
  if (loggedIn || now - lastShot > 8000) {
    lastShot = now;
    await shot(`login_${String(Math.floor(now / 1000)).slice(-4)}.png`);
  }
  if (loggedIn) {
    console.log('[login] LOGGED IN, url=' + url);
    // Persist cookies/storage state for headless reuse
    const state = await ctx.storageState({ path: path.join(ROOT, 'state', 'storage.json') });
    console.log('[login] storage saved: ' + state.length + ' bytes');
    break;
  }
  await new Promise((r) => setTimeout(r, 3000));
}

await ctx.close().catch(() => {});
if (Date.now() >= deadline) {
  console.log('[login] TIMEOUT');
  process.exit(1);
}
process.exit(0);
