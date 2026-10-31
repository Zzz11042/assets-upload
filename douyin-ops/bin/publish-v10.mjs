#!/usr/bin/env node
/**
 * publish-v10 — same flow as v9 but immediately after the SMS dialog appears,
 * waits up to 30s for state/smscode.txt, then fills the code input
 * (input[type="number"][placeholder="请输入验证码"] inside .second-verify-mask)
 * and clicks the verify button. If the code isn't ready, it keeps waiting up
 * to the --wait-min flag (default 30 minutes).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const CODE_FILE = path.join(ROOT, 'state', 'smscode.txt');

const args = process.argv.slice(2);
const videoFile = path.resolve(args.find((a) => !a.startsWith('--')));
const opt = (flag, dflt = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const title = opt('--title');
const desc = opt('--desc');
const tags = opt('--tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
const waitMin = Number(opt('--wait-min', '30'));

console.log(`[v10] file=${path.basename(videoFile)} title="${title}" waitMin=${waitMin}`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', `v10_${name}.png`), fullPage: true });
    console.log(`[v10] shot logs/v10_${name}.png`);
  } catch {}
}

// 1. Open upload
console.log('[v10] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon old draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[v10] abandoning old draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload
const fileInput = page.locator('input[type="file"]').first();
console.log('[v10] setting file...');
await fileInput.setInputFiles(videoFile, { timeout: 30000 });

// 4. Wait for form
const formReady = await page
  .locator('text="基础信息"')
  .first()
  .waitFor({ timeout: 120_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);
console.log('[v10] formReady:', formReady);

// 5. Fill title + description
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
await page.waitForTimeout(2000);
await shot('01_filled');

// 6. Click publish
console.log('[v10] clicking 发布...');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

// 7. Wait for the SMS dialog
console.log('[v10] waiting for SMS dialog...');
let dialogFound = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  dialogFound = await page.evaluate(() => /接收短信验证码/.test(document.body.innerText));
  if (dialogFound) {
    console.log(`[v10] SMS dialog appeared at ${i * 2}s`);
    break;
  }
}

if (dialogFound) {
  // Click 获取验证码 to trigger the SMS
  const getBtn = page.locator('text="获取验证码"').first();
  const clickedGet = await getBtn.click({ timeout: 5000 }).then(() => true).catch(() => false);
  console.log('[v10] clicked 获取验证码:', clickedGet);
  await page.waitForTimeout(3000);
  await shot('02_sms_dialog');

  // Poll for the code
  let code = null;
  const codeDeadline = Date.now() + waitMin * 60 * 1000;
  let lastHeartbeat = 0;
  while (!code && Date.now() < codeDeadline) {
    if (fs.existsSync(CODE_FILE)) {
      const val = fs.readFileSync(CODE_FILE, 'utf8').trim();
      if (/^\d{4,8}$/.test(val)) {
        code = val;
        fs.rmSync(CODE_FILE, { force: true });
        console.log(`[v10] read code ${code} from ${CODE_FILE}`);
      }
    }
    const now = Date.now();
    if (now - lastHeartbeat > 60_000) {
      lastHeartbeat = now;
      console.log(`[v10] heartbeat: waiting for SMS code... (${Math.round((now - (codeDeadline - waitMin * 60 * 1000)) / 1000)}s elapsed, deadline in ${Math.round((codeDeadline - now) / 1000)}s)`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (code) {
    // The dialog's code input: input[type="number"][placeholder="请输入验证码"] inside .second-verify-mask
    console.log('[v10] entering code...');
    const codeInput = page.locator('.second-verify-mask input, [class*="uc-ui-verify"] input, input[placeholder="请输入验证码"]').first();
    const nInput = await codeInput.count();
    console.log('[v10] code input found:', nInput > 0);
    if (nInput > 0) {
      await codeInput.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      for (const ch of code) {
        await page.keyboard.press(ch, { delay: 100 });
      }
      console.log(`[v10] typed ${code.length} chars via keyboard`);
    }
    await page.waitForTimeout(500);
    await shot('03_code_entered');

    // Find and click the verify button (usually "验证" or "确认")
    console.log('[v10] clicking 验证...');
    const verifyBtn = page.locator('text="验证", text="确认", [class*="uc-ui-verify"] button, .second-verify-mask button').last();
    await verifyBtn.click({ timeout: 5000 }).catch(async (e) => {
      console.log('[v10] 验证 click err:', e.message);
      // fallback: press Enter in the code input
      const ci2 = page.locator('.second-verify-mask input, [class*="uc-ui-verify"] input, input[placeholder="请输入验证码"]').first();
      await ci2.press('Enter').catch(() => {});
    });
    await page.waitForTimeout(15000);
    await shot('04_after_verify');
  } else {
    console.log(`[v10] TIMEOUT waiting for SMS code (${waitMin} min)`);
    await ctx.close().catch(() => {});
    process.exit(5);
  }
} else {
  console.log('[v10] no SMS dialog — checking if it published directly...');
}

// 8. Watch for success
console.log('[v10] watching for success (120s)...');
let success = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => ({
    url: location.href,
    inManage: location.href.includes('/content/manage'),
    toast: /发布成功|已发布|作品审核中|已提交/.test(document.body.innerText),
  }));
  if (s.inManage || s.toast) {
    success = true;
    console.log(`[v10] SUCCESS at ${i * 3}s: ${s.url}`);
    break;
  }
}

await page.waitForTimeout(3000);
await shot('05_after_publish');
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[v10] SUCCESS=', success, 'url=', page.url());
console.log('[v10] body:', bodyText);

// 9. Verify in content management
if (success) {
  console.log('[v10] verifying in content management...');
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('[v10] content manage:', list);
  await shot('06_content_manage');
}

// 10. Save storage state
await ctx.storageState({ path: path.join(ROOT, 'state', 'storage.json') }).catch(() => {});

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
