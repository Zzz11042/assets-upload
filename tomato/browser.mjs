// Persistent headed Chromium for Fanqie Novels writer platform.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const USER_DIR = '/home/zzz/Documents/deepseek-harness/default-workspace/tomato/profile';

const op = process.argv[2];
const url = process.argv[3];

const browser = await chromium.launchPersistentContext(USER_DIR, {
  executablePath: CHROME,
  headless: false,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
});
const page = browser.pages()[0] ?? await browser.newPage();

if (op === 'goto') {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
}

// Screenshot for QR scanning
await page.screenshot({ path: '/home/zzz/Documents/deepseek-harness/default-workspace/tomato/shot.png' });
fs.writeFileSync('/home/zzz/Documents/deepseek-harness/default-workspace/tomato/state.json', JSON.stringify({
  url: page.url(),
  title: await page.title(),
}, null, 2));

await browser.close();
console.log('ok');
