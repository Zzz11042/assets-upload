// Long-lived interactive browser session for Fanqie Novels writer platform.
// Protocol:
//  - opens headed browser at writer login page
//  - polls until the user logs in (QR or SMS)
//  - on login: dumps user/account info + any author API responses to out.json
//  - afterwards: watches cmd.json for operations: {id, op, ...}
//      op: "goto" {url}, "text" {} (dump DOM text+links), "api" {url, body?, method?}
//      results are written to out.json as {cmdId, ...}; cmd.json is cleared after processing
//  - appends every fanqienovel.com/api/author response to api_log.json
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const DIR = '/home/zzz/Documents/deepseek-harness/default-workspace/tomato';
const USER_DIR = DIR + '/profile';

const ctx = await chromium.launchPersistentContext(USER_DIR, {
  executablePath: CHROME, headless: false,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  viewport: { width: 1440, height: 900 }, locale: 'zh-CN',
});
const page = ctx.pages()[0] ?? await ctx.newPage();

fs.rmSync(DIR + '/cmd.json', { force: true });
fs.rmSync(DIR + '/out.json', { force: true });
fs.writeFileSync(DIR + '/api_log.json', '[]');

page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('fanqienovel.com/api/author')) {
    try {
      const log = JSON.parse(fs.readFileSync(DIR + '/api_log.json', 'utf8') || '[]');
      log.push({ url: u.slice(0, 300), status: res.status(), body: (await res.text()).slice(0, 2000) });
      fs.writeFileSync(DIR + '/api_log.json', JSON.stringify(log.slice(-40), null, 1));
    } catch {}
  }
});

function logline(s) { process.stdout.write(s + '\n'); fs.appendFileSync(DIR + '/server.log', s + '\n'); }

// 1) go to writer root
logline('waiting_for_login: goto /main/writer');
await page.goto('https://fanqienovel.com/main/writer', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

// 2) poll until logged in
const deadline = Date.now() + 30 * 60 * 1000;
let logged = false;
while (Date.now() < deadline) {
  await page.goto('https://fanqienovel.com/main/writer', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  if (!/writer\/login/i.test(page.url())) { logged = true; break; }
  await page.waitForTimeout(6000);
}
if (!logged) { logline('login_timeout'); process.exit(2); }
logline('login_detected url=' + page.url());

// 3) dump who we are + account info
async function inpageFetch(path) {
  return page.evaluate(async (p) => {
    try {
      const r = await fetch(p, { credentials: 'include' });
      const t = await r.text();
      return { status: r.status, body: t.slice(0, 5000) };
    } catch (e) { return { error: String(e) }; }
  }, path);
}
const acc = await inpageFetch('/api/author/account/info/v0/?aid=2503&app_name=muye_novel');
const out = { logged: true, url: page.url(), title: await page.title(), account: acc, page_text: await page.evaluate(() => document.body.innerText.slice(0, 3000)) };
fs.writeFileSync(DIR + '/out.json', JSON.stringify(out, null, 1));
logline('user_dump_done');

// 4) command loop
let lastId = 0;
while (true) {
  await page.waitForTimeout(2000);
  let cmd = null;
  try { cmd = JSON.parse(fs.readFileSync(DIR + '/cmd.json', 'utf8')); } catch {}
  if (!cmd || cmd.id === lastId) continue;
  lastId = cmd.id;
  const res = { cmdId: cmd.id };
  try {
    if (cmd.op === 'goto') {
      await page.goto(cmd.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);
      res.url = page.url(); res.title = await page.title();
      res.text = await page.evaluate(() => document.body.innerText.slice(0, 6000));
      if (cmd.links) res.links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href + ' | ' + (a.innerText || '').trim().slice(0, 40)).filter(s => s.length > 8).slice(0, 80));
      if (cmd.screenshot) await page.screenshot({ path: DIR + '/shot.png' });
    } else if (cmd.op === 'api') {
      res.result = await inpageFetch(cmd.url);
      if (cmd.body) {
        // generic POST with csrf if present
        res.post = await page.evaluate(async ({ p, body }) => {
          const csrf = document.cookie.match(/X-Secsdk-Csrf-Token=([^;]+)/);
          const h = {};
          if (csrf) h['X-Secsdk-Csrf-Token'] = csrf[1];
          const r = await fetch(p, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
          const t = await r.text();
          return { status: r.status, body: t.slice(0, 8000) };
        }, { p: cmd.url, body: cmd.body });
      }
    } else if (cmd.op === 'click') {
      await page.click(cmd.selector, { timeout: 15000 });
      await page.waitForTimeout(3000);
      res.after_url = page.url();
      res.text = await page.evaluate(() => document.body.innerText.slice(0, 4000));
    } else if (cmd.op === 'type') {
      await page.fill(cmd.selector, cmd.value, { timeout: 15000 });
      res.ok = true;
    } else {
      res.error = 'unknown op ' + cmd.op;
    }
  } catch (e) { res.error = String(e).slice(0, 500); }
  fs.writeFileSync(DIR + '/out.json', JSON.stringify(res, null, 1));
  logline('cmd_' + cmd.id + '_done: ' + (res.error ? res.error : 'ok'));
}
