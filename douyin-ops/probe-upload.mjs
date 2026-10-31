import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
page.on('console', (m) => { if (m.type() === 'log') console.log('[page log]', m.text().slice(0,200)); });
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// Dismiss draft dialog by clicking 放弃
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  console.log('clicking 放弃...');
  await abandon.click();
  await page.waitForTimeout(4000);
}

// Enumerate file inputs
const inputs = page.locator('input[type="file"]');
console.log('file inputs:', await inputs.count());
for (let i = 0; i < await inputs.count(); i++) {
  const acc = await inputs.nth(i).getAttribute('accept');
  const multi = await inputs.nth(i).getAttribute('multiple');
  console.log(`input[${i}] accept=${acc} multiple=${multi} disabled=${await inputs.nth(i).isDisabled().catch(()=>'?')}`);
}

// Track network: any upload requests?
const uploadEvents = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('upload') || u.includes('douyin') || u.includes('byte') || u.includes('tos')) {
    uploadEvents.push({ method: req.method(), url: u.slice(0, 120) });
  }
});
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('upload') || u.includes('publish') || u.includes('post')) {
    const body = await res.text().catch(() => '(binary)');
    console.log(`[resp] ${res.status()} ${u.slice(0,100)} => ${body.slice(0,200)}`);
  }
});

// Set the file
console.log('setting file...');
await inputs.first().setInputFiles('videos/test.mp4');
console.log('file set, watching 30s...');
await page.waitForTimeout(30000);
console.log('upload events:', JSON.stringify(uploadEvents.slice(-15)));

// Dump the DOM state: look for progress bars, video cards
const state = await page.evaluate(() => {
  const text = document.body.innerText;
  const hasProgress = /上传中|%/.test(text);
  const hasTitleInput = !!document.querySelector('input[placeholder*="标题"], input[placeholder*="作品"]');
  const hasTextarea = !!document.querySelector('textarea');
  const hasPublishBtn = [...document.querySelectorAll('button')].some(b => b.textContent.includes('发布'));
  return { hasProgress, hasTitleInput, hasTextarea, hasPublishBtn, textHead: text.slice(0, 300) };
});
console.log('state after 30s:', JSON.stringify(state, null, 2));
await page.screenshot({ path: 'logs/upload_probe.png', fullPage: true });
await ctx.close();
