#!/usr/bin/env node
/**
 * Douyin phone+SMS login — v2.
 *
 * Usage: node bin/login-sms.mjs <phone> [--code <digits>]
 *
 * Flow:
 *  1. Open creator.douyin.com (persistent profile, headful on local X).
 *  2. The login card shows 手机登录 by default with two tel inputs:
 *       [请输入手机号] and [请输入验证码]
 *     If the "扫码登录" tab is active, click "手机登录" first.
 *  3. Fill phone, click the "获取验证码" link (right of the code input).
 *  4. Poll state/smscode.txt (or --code) for the 6-digit SMS code.
 *  5. Fill code input, press Enter.
 *  6. Detect success by: absence of both [请输入验证码] input AND
 *     absence of "扫码登录" span. On success, save storage state.
 *
 * The browser is left running 8s after success/failure so a captcha can be
 * solved manually if one appeared.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const PROFILE = path.join(ROOT, 'profiles', 'default');
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const CODE_FILE = process.env.DY_CODE_FILE || path.join(ROOT, 'state', 'smscode.txt');

const args = process.argv.slice(2);
const phoneIdx = args.findIndex((a, i) => !a.startsWith('--') && a !== args[i - 1]);
const phone = phoneIdx >= 0 ? args[phoneIdx] : null;
const codeArg = args.includes('--code') ? args[args.indexOf('--code') + 1] : undefined;

if (!phone) {
  console.error('usage: login-sms.mjs <phone> [--code <digits>]');
  process.exit(2);
}
console.log(`[login-sms] phone=${phone} codeArg=${codeArg ? 'yes' : 'no'}`);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: false,
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
  args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--no-first-run'],
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
const page = ctx.pages()[0] || (await ctx.newPage());

async function shot(name) {
  try {
    await page.screenshot({ path: path.join(ROOT, 'logs', name) });
    console.log(`[login-sms] screenshot logs/${name}`);
  } catch {}
}

// Make sure we're on the 手机登录 tab.
console.log('[login-sms] opening creator.douyin.com ...');
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(7000);

// If 扫码登录 is visible as a tab label, the card may be in QR mode — click 手机登录.
const phoneTab = page.locator('[class*="douyin-login-container"] :text("手机登录"), [class*="douyin-login-container"] :text("短信登录")').first();
if ((await phoneTab.count()) > 0) {
  await phoneTab.click({ timeout: 4000 }).catch(() => {});
  console.log('[login-sms] clicked 手机登录 tab');
  await page.waitForTimeout(2000);
}

const phoneInput = page.locator('input[placeholder="请输入手机号"]').first();
const codeInput = page.locator('input[placeholder="请输入验证码"]').first();
console.log('[login-sms] phone input found:', await phoneInput.count() > 0, '| code input found:', await codeInput.count() > 0);

await phoneInput.fill(phone, { timeout: 10_000 }).catch((e) => console.log('[login-sms] fill phone err:', e.message));
await page.waitForTimeout(800);

// Check agreement checkbox if present
const checkbox = page.locator('[class*="douyin-login-container"] input[type="checkbox"]').first();
if ((await checkbox.count()) > 0) {
  const checked = await checkbox.isChecked().catch(() => true);
  if (!checked) await checkbox.click().catch(() => {});
}

// Find and click the "获取验证码" / "收不到验证码" trigger.
// In the DOM dump the button list was empty — it's likely a <div> or <span>.
const codeBtn = page
  .locator('[class*="douyin-login-container"] :text("获取验证码"), [class*="douyin-login-container"] :text("收不到验证码"), [class*="douyin-login-container"] :text("验证码")')
  .last();
await codeBtn.click({ timeout: 8000 }).catch((e) => console.log('[login-sms] code-btn click err:', e.message));
await page.waitForTimeout(3000);
await shot('sms2_01_after_req.png');
console.log(`[login-sms] code requested. Waiting for ${CODE_FILE} (or --code) for 20 minutes...`);

// Poll for the code
let code = codeArg || null;
const deadline = Date.now() + 20 * 60 * 1000;
let lastLog = 0;
while (!code && Date.now() < deadline) {
  if (fs.existsSync(CODE_FILE)) {
    const val = fs.readFileSync(CODE_FILE, 'utf8').trim();
    if (/^\d{4,8}$/.test(val)) {
      code = val;
      fs.rmSync(CODE_FILE, { force: true });
      console.log(`[login-sms] read code ${code} from ${CODE_FILE}`);
    }
  }
  const now = Date.now();
  if (now - lastLog > 60_000) {
    lastLog = now;
    console.log('[login-sms] still waiting for SMS code...');
    await shot(`sms2_wait_${String(now).slice(-4)}.png`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}

if (code) {
  await codeInput.fill(code, { timeout: 5000 }).catch((e) => console.log('[login-sms] code fill err:', e.message));
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter').catch(() => {});
  await shot('sms2_02_code_entered.png');
  console.log('[login-sms] code entered; waiting up to 90s for success signal...');

  const succDeadline = Date.now() + 90_000;
  let success = false;
  while (Date.now() < succDeadline) {
    await page.waitForTimeout(3000);
    const codeInputGone = (await page.locator('input[placeholder="请输入验证码"]').count()) === 0;
    const qrGone = (await page.locator('[class*="douyin-login-container"] :text("扫码登录")').count()) === 0;
    const containerGone = (await page.locator('[class*="douyin-login-container"]').count()) === 0;
    if ((codeInputGone && containerGone) || (containerGone && qrGone)) {
      success = true;
      break;
    }
    // If the captcha appeared, flag it
    const captcha = await page.locator('iframe[src*="rc-verifycenter"], [class*="captcha"], [class*="verify"]').count().catch(() => 0);
    if (captcha > 0) {
      console.log('[login-sms] CAPTCHA detected — solve manually in the X window, or I will be notified.');
    }
  }

  if (success) {
    await page.waitForTimeout(3000);
    const st = await ctx.storageState({ path: path.join(ROOT, 'state', 'storage.json') });
    console.log(`[login-sms] LOGIN SUCCESS. storage=${st.length}B url=${page.url()}`);
    await shot('sms2_03_success.png');
    await new Promise((r) => setTimeout(r, 2000));
    await ctx.close().catch(() => {});
    process.exit(0);
  } else {
    console.log('[login-sms] LOGIN NOT CONFIRMED. url=' + page.url());
    await shot('sms2_04_not_success.png');
    console.log('[login-sms] browser left open 10s in case a captcha needs manual handling');
    await new Promise((r) => setTimeout(r, 10_000));
    await ctx.close().catch(() => {});
    process.exit(4);
  }
} else {
  console.log('[login-sms] TIMEOUT waiting for code');
  await ctx.close().catch(() => {});
  process.exit(1);
}
