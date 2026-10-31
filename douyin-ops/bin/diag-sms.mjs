#!/usr/bin/env node
/**
 * Diagnose the SMS security dialog in depth:
 *  - dump the dialog's full DOM structure and text
 *  - test clicking "获取验证码" and capture network responses (security SMS send API)
 *  - look for error messages / rate limits
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

// Capture all security-related API calls
const apiCalls = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('security') || u.includes('verify') || u.includes('sms') || u.includes('message') || u.includes('auth')) {
    apiCalls.push({ method: req.method(), url: u.slice(0, 140), body: req.postData()?.slice(0, 200) });
  }
});
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('security') || u.includes('verify') || u.includes('sms') || u.includes('captcha') || u.includes('ticket')) {
    try {
      const body = await res.text();
      apiCalls.push({ status: res.status(), url: u.slice(0, 140), resp: body.slice(0, 300) });
    } catch {}
  }
});

console.log('[diag] opening upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// Abandon old draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// Upload
console.log('[diag] uploading...');
await page.locator('input[type="file"]').first().setInputFiles('videos/ai-ops-day1.mp4', { timeout: 30000 });
await page.waitForTimeout(40000);

// Fill title
const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
if ((await t.count()) > 0) await t.fill('AI 自动运营 Day1');
const ed = page.locator('[contenteditable="true"]').first();
if ((await ed.count()) > 0) {
  await ed.click();
  await page.keyboard.type('第一条自动化视频', { delay: 40 });
}
await page.waitForTimeout(2000);

// Click publish
console.log('[diag] clicking 发布...');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

// Wait for the dialog
console.log('[diag] waiting for SMS dialog...');
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(2000);
  const has = await page.evaluate(() => /接收短信验证码|请输入当前手机号/.test(document.body.innerText));
  if (has) {
    console.log(`[diag] dialog appeared at ${i * 2}s`);
    break;
  }
}

// Dump the dialog DOM in detail
console.log('\n=== DIALOG DOM DUMP ===');
const dialogDump = await page.evaluate(() => {
  // Find the element containing the SMS text
  const all = [...document.querySelectorAll('div, section, dialog, [role="dialog"]')];
  const dialogEl = all.find((e) => /接收短信验证码|请输入当前手机号/.test(e.textContent) && e.textContent.length < 800);
  if (!dialogEl) return { err: 'dialog element not found' };
  // Walk the dialog
  const walk = (el, depth = 0) => {
    const out = {
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 80),
      text: el.children.length === 0 ? el.textContent.trim().slice(0, 80) : '',
      inputs: [...el.querySelectorAll('input')].map((i) => ({ type: i.type, ph: i.placeholder, val: i.value?.slice(0, 20), max: i.maxLength })),
      buttons: [...el.querySelectorAll('button, [role="button"], a')].map((b) => b.textContent.trim().slice(0, 30)).filter(Boolean),
      children: [],
    };
    if (depth < 6) for (const c of el.children) out.children.push(walk(c, depth + 1));
    return out;
  };
  return walk(dialogEl);
});
console.log(JSON.stringify(dialogDump, null, 1).slice(0, 3000));

// Full text of the dialog area
const dialogText = await page.evaluate(() => document.body.innerText.match(/.{0,300}接收短信验证码.{0,300}/s)?.[0] || '(not found)');
console.log('\n=== DIALOG TEXT ===\n' + dialogText);

// Now click "获取验证码" and watch what happens
console.log('\n=== CLICKING 获取验证码 ===');
const getBtn = page.locator('text="获取验证码"').first();
console.log('getBtn count:', await getBtn.count());
await getBtn.click({ timeout: 5000 }).catch((e) => console.log('click err:', e.message));
await page.waitForTimeout(8000);

// Dump post-click state: countdown, error messages
const postState = await page.evaluate(() => {
  const t = document.body.innerText;
  return {
    resendCountdown: t.match(/\d+\s*秒后(重发|重新获取|再试)/)?.[0] || null,
    errorMsg: t.match(/.{0,60}(失败|错误|频繁|限制|验证不正确|验证码错误|手机.{0,20}无法|收不到).{0,60}/g)?.slice(0, 5) || [],
    snippet: t.match(/.{0,100}(获取验证码|重新获取|收不到).{0,100}/g)?.slice(0, 5) || [],
  };
});
console.log('POST-CLICK:', JSON.stringify(postState, null, 2));

// Check API calls
console.log('\n=== SECURITY/SMS API CALLS ===');
for (const c of apiCalls) {
  if (c.resp) console.log(`${c.status} ${c.url}\n  ${c.resp}`);
  else console.log(`${c.method} ${c.url} body=${c.body}`);
}

await page.screenshot({ path: path.join(ROOT, 'logs', 'diag_sms.png'), fullPage: true });
console.log('\n[diag] screenshot logs/diag_sms.png');
await ctx.close();
