import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
// Capture isUploading logs
let isUploadingLog = null;
page.on('console', (m) => {
  if (m.text().includes('isUploading')) isUploadingLog = m.text();
});
await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const abandon = page.locator('text="放弃"').first();
if ((await abandon.count()) > 0) {
  await abandon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}
console.log('setting file...');
await page.locator('input[type="file"]').first().setInputFiles('videos/test.mp4', { timeout: 30000 });
// Poll isUploading state and progress percentage
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const t = document.body.innerText;
    // Look for percentage text near upload area
    const progMatch = t.match(/(\d+1?0?0?)(%|\.?\d+)%?/);
    // Look for progress bar elements
    const bars = [...document.querySelectorAll('[class*="progress"], [class*="percent"], [class*="bar"]')]
      .map(e => ({ cls: e.className.toString().slice(0, 40), text: e.textContent.trim().slice(0, 30) }))
      .filter(b => b.text || /progress|bar/i.test(b.cls));
    const hasUploadZone = t.includes('点击上传');
    const hasForm = t.includes('基础信息');
    return { hasUploadZone, hasForm, bars: bars.slice(0, 5), isUploadingLog: window.__isUploading || null };
  });
  console.log(`t+${(i + 1) * 3}s:`, JSON.stringify(s), 'isUploading log:', isUploadingLog);
  isUploadingLog = null;
  if (!s.hasForm && s.hasUploadZone === false) break;
}
// Check if there's a visible progress indicator with a percentage
const progText = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /\d{1,3}%/.test(e.textContent));
  return els.map(e => e.textContent.trim().slice(0, 40)).slice(0, 10);
});
console.log('PERCENT TEXTS:', JSON.stringify(progText));
await page.screenshot({ path: 'logs/upload_prog.png', fullPage: true });
await ctx.close();
