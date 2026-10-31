import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('./profiles/default', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

const info = await page.evaluate(() => {
  const container = document.querySelector('[class*="douyin-login-container"]');
  if (!container) return { err: 'no container' };
  const walk = (el, depth = 0) => {
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === 'string' ? el.className.slice(0, 80) : '';
    const text = el.children.length === 0 ? (el.textContent || '').trim().slice(0, 30) : '';
    const out = { tag, cls, text, children: [] };
    for (const c of el.children) out.children.push(walk(c, depth + 1));
    return out;
  };
  // truncate deep structure
  const top = walk(container);
  return JSON.stringify(top).slice(0, 4000);
});
console.log(info);

// iframes?
const frames = page.frames();
console.log('FRAMES:', frames.map(f => f.url()).join(' | '));
for (const f of frames) {
  if (f === page.mainFrame()) continue;
  const inner = await f.evaluate(() => document.body ? document.body.innerText.slice(0, 500) : '(empty)').catch(() => '(error)');
  console.log('FRAME', f.url(), '=>', inner);
}
await ctx.close();
