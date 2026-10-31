#!/usr/bin/env node
/**
 * Douyin video publish v9 — handles the SMS security verification dialog
 * that appears on publish. Polls state/smscode.txt for the 6-digit code
 * and fills it into the dialog.
 *
 * Usage: node bin/publish-v9.mjs <video> [--title t] [--desc d] [--tags a,b,c]
 *        DIALOG CODE: write the SMS code to state/smscode.txt before running,
 *        or pass --code <digits> (the code is used for the security dialog,
 *        NOT the login flow).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const CODE_FILE = process.env.DY_CODE_FILE || path.join(ROOT, 'state', 'smscode.txt');

const args = process.argv.slice(2);
const videoFile = path.resolve(args.find((a) => !a.startsWith('--') && !/^\d{4,8}$/.test(a)));
const opt = (flag, dflt = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const title = opt('--title');
const desc = opt('--desc');
const tags = opt('--tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
const codeArg = opt('--code');

console.log(`[v9] file=${path.basename(videoFile)} title="${title}" codeArg=${codeArg || '(poll file)'}`);

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
    await page.screenshot({ path: path.join(ROOT, 'logs', `v9_${name}.png`), fullPage: true });
    console.log(`[v9] shot logs/v9_${name}.png`);
  } catch {}
}

// 1. Open upload
console.log('[v9] goto upload...');
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 2. Abandon old draft
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('[v9] abandoning old draft');
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 3. Upload
const fileInput = page.locator('input[type="file"]').first();
console.log('[v9] setting file...');
await fileInput.setInputFiles(videoFile, { timeout: 30000 });

// 4. Wait for form
const formReady = await page
  .locator('text="基础信息"')
  .first()
  .waitFor({ timeout: 120_000, state: 'visible' })
  .then(() => true)
  .catch(() => false);
console.log('[v9] formReady:', formReady);

// 5. Fill title + desc
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
console.log('[v9] clicking 发布...');
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
    const x = b.textContent.trim();
    return (x === '发布' || x === '发 布') && !b.closest('[class*="header"], [class*="menu"], [class*="nav"]');
  });
  cands[cands.length - 1].click();
});

// 7. Handle SMS security dialog: wait for it to appear, then poll for the code.
console.log('[v9] watching for SMS dialog...');
let dialogFound = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  const dialog = await page.evaluate(() => {
    const t = document.body.innerText;
    if (t.includes('接收短信验证码') || t.includes('请输入当前手机号') || t.includes('获取验证码')) {
      return { found: true, snippet: t.match(/.{0,80}获取验证码/g)?.map((s) => s.trim()) || [] };
    }
    return { found: false };
  });
  if (dialog.found) {
    dialogFound = true;
    console.log('[v9] SMS dialog appeared at', (i + 1) * 2, 's');
    break;
  }
  if (i % 5 === 4) console.log(`[v9] ... ${(i + 1) * 2}s, waiting for dialog`);
}

if (dialogFound) {
  // Click "获取验证码" to trigger the SMS
  console.log('[v9] clicking 获取验证码...');
  const getBtn = page.locator('text="获取验证码"').first();
  const clickedGet = await getBtn.click({ timeout: 5000 }).then(() => true).catch((e) => {
    console.log('[v9] 获取验证码 click err:', e.message);
    return false;
  });
  console.log('[v9] clicked 获取验证码:', clickedGet);
  await page.waitForTimeout(3000);
  // Verify the dialog now shows a "60s resend" countdown or similar
  const dialogState = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      hasResend: /重新获取|秒后重发|s后重发/.test(t),
      snippet: t.match(/.{0,60}(重新获取|获取验证码|收不到).{0,40}/g)?.slice(0, 3),
    };
  });
  console.log('[v9] dialog state after click:', JSON.stringify(dialogState));
  await shot('02_sms_dialog');

  // Poll for the code — long window so the user can read the SMS.
  let code = codeArg || null;
  const codeDeadline = Date.now() + 60 * 60 * 1000; // 60 minutes
  let lastHeartbeat = 0;
  while (!code && Date.now() < codeDeadline) {
    if (fs.existsSync(CODE_FILE)) {
      const val = fs.readFileSync(CODE_FILE, 'utf8').trim();
      if (/^\d{4,8}$/.test(val)) {
        code = val;
        fs.rmSync(CODE_FILE, { force: true });
        console.log(`[v9] read code ${code} from ${CODE_FILE}`);
      }
    }
    const now = Date.now();
    if (now - lastHeartbeat > 60_000) {
      lastHeartbeat = now;
      console.log(`[v9] heartbeat: waiting for SMS code... (${Math.round((now - (codeDeadline - 3600_000)) / 1000)}s elapsed, deadline in ${Math.round((codeDeadline - now) / 1000)}s)`);
      await shot('sms_waiting').catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (code) {
    console.log('[v9] entering code into dialog...');
    // The SMS dialog uses a single input field that auto-focuses when the
    // dialog appears. Click it explicitly, then type the code character by
    // character (typing is more human-like and avoids fill() edge cases
    // with single-char box inputs).
    const codeInput = page
      .locator('input[type="text"]:visible, input[type="tel"]:visible, input[placeholder*="验证码"]:visible')
      .last();
    const nInput = await codeInput.count();
    console.log('[v9] code input candidates:', nInput);
    if (nInput > 0) {
      await codeInput.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      for (const ch of code) {
        await page.keyboard.press(ch, { delay: 80 });
      }
      console.log(`[v9] typed ${code.length} chars via keyboard`);
    } else {
      // No explicit input — the dialog may accept the code on the focused
      // element. Just type it.
      await page.keyboard.type(code, { delay: 100 });
      console.log(`[v9] typed ${code.length} chars into focused element`);
    }
    await page.waitForTimeout(500);
    await shot('03_code_entered');

    // Click 验证
    console.log('[v9] clicking 验证...');
    const verifyBtn = page.locator('text="验证"').last();
    await verifyBtn.click({ timeout: 5000 }).catch((e) => {
      console.log('[v9] 验证 click err:', e.message);
    });
    await page.waitForTimeout(12000);
    await shot('04_after_verify');
  } else {
    console.log('[v9] TIMEOUT waiting for SMS code (20 min)');
    await ctx.close();
    process.exit(5);
  }
} else {
  // No dialog — maybe it published directly
  console.log('[v9] no SMS dialog; checking for success...');
}

// 8. Watch for success
console.log('[v9] watching for success (90s)...');
let success = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => ({
    url: location.href,
    inManage: location.href.includes('/content/manage'),
    toast: /发布成功|已发布|作品审核中|已提交/.test(document.body.innerText),
  }));
  if (s.inManage || s.toast) {
    success = true;
    console.log(`[v9] SUCCESS at ${i * 3}s: ${s.url}`);
    break;
  }
}

await page.waitForTimeout(3000);
await shot('04_after_publish');
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('[v9] SUCCESS=', success, 'url=', page.url());
console.log('[v9] body:', bodyText);

// 9. Verify in content management
if (success) {
  console.log('[v9] verifying in content management...');
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const list = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('[v9] content manage:', list);
  await shot('05_content_manage');
}

await ctx.close().catch(() => {});
process.exit(success ? 0 : 4);
