import { chromium } from 'playwright-core';

async function probe(profile, label) {
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log(label, 'goto err:', e.message));
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => {
    const c = document.querySelector('[class*="douyin-login-container"]');
    const phoneInput = document.querySelector('input[placeholder="请输入手机号"]');
    return {
      url: location.href,
      hasContainer: !!c,
      hasPhoneInput: !!phoneInput,
      cardText: c ? c.innerText.slice(0, 400) : '(none)',
      bodyText: document.body ? document.body.innerText.slice(0, 300) : '(no body)',
    };
  });
  console.log('=====', label, '=====');
  console.log(JSON.stringify(info, null, 2));
  await ctx.close();
}

await probe('/tmp/dy-probe-profile', 'throwaway-profile');
console.log('\nNow checking running browser state via CDP pipe...');
// The running headful browser is NOT exposed via CDP (persistent context via pipe).
// But we can try: read the process's open state via /proc — not useful.
// Instead, check what the running login-sms process would see by reading its last screenshot timestamp.
