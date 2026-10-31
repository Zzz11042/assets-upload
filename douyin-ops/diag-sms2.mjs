import { chromium } from 'playwright-core';
import path from 'node:path';
const ROOT = process.cwd();
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: CHROME, headless: true, args: ['--no-sandbox'], locale: 'zh-CN',
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

const apiCalls = [];
page.on('request', (req) => {
  if (req.method() === 'POST') {
    apiCalls.push({ method: 'POST', url: req.url().slice(0, 140), body: req.postData()?.slice(0, 250) });
  }
});
page.on('response', async (res) => {
  const u = res.url();
  if (res.request().method() === 'POST' || u.includes('verify') || u.includes('security') || u.includes('sms')) {
    try {
      const body = await res.text();
      apiCalls.push({ status: res.status(), url: u.slice(0, 140), resp: body.slice(0, 400) });
    } catch {}
  }
});

await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) { await abandon.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(4000); }
await page.locator('input[type="file"]').first().setInputFiles('videos/ai-ops-day1.mp4', { timeout: 30000 });
await page.waitForTimeout(40000);
const t = page.locator('input[placeholder*="作品"], input[placeholder*="标题"]').first();
if ((await t.count()) > 0) await t.fill('AI 自动运营 Day1');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '发布' && !b.closest('[class*="header"],[class*="menu"],[class*="nav"]'));
  cands[cands.length - 1]?.click();
});
await page.waitForTimeout(6000);

// Confirm dialog
const hasDialog = await page.evaluate(() => /接收短信验证码/.test(document.body.innerText));
console.log('dialog present:', hasDialog);
if (hasDialog) {
  // Read the dialog's exact text
  const dlgText = await page.evaluate(() => document.body.innerText.match(/.{0,400}接收短信验证码.{0,400}/s)?.[0] || '(no match)');
  console.log('DIALOG TEXT:', dlgText.replace(/\n/g, ' | ').slice(0, 500));
  // Dump all buttons inside the dialog
  const dlgButtons = await page.evaluate(() => {
    const mask = document.querySelector('.second-verify-mask');
    if (!mask) return [];
    return [...mask.querySelectorAll('button, [class*="btn"], a')]
      .map((b) => ({ text: b.textContent.trim().slice(0, 30), cls: (b.className || '').toString().slice(0, 60) }))
      .filter((b) => b.text);
  });
  console.log('DIALOG BUTTONS:', JSON.stringify(dlgButtons, null, 1));

  // Click 获取验证码 and capture what happens
  console.log('clicking 获取验证码...');
  await page.locator('text="获取验证码"').first().click({ timeout: 5000 }).catch((e) => console.log('click err:', e.message));
  await page.waitForTimeout(8000);

  // Post-click state
  const post = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      countdown: t.match(/(\d+)\s*秒/)?.[0] || null,
      errorLines: t.match(/[^\n]*(失败|错误|频繁|无法|收不到|已发送)[^\n]*/g)?.slice(0, 5) || [],
      dlgSnippet: t.match(/.{0,200}(获取验证码|重新获取|收不到)[^\n]*/g)?.slice(0, 4) || [],
    };
  });
  console.log('POST-CLICK:', JSON.stringify(post, null, 1));
}

console.log('\n=== CAPTURED API CALLS (POST + verify/security) ===');
for (const c of apiCalls.slice(-20)) {
  if (c.resp) console.log(`${c.status} ${c.url}\n  ${c.resp}\n`);
  else console.log(`${c.method} ${c.url}\n  ${c.body}\n`);
}
await ctx.close();
