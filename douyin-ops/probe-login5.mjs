import { chromium } from 'playwright-core';
import fs from 'node:fs';

// Attach to the RUNNING headful browser via CDP.
// The login-sms.mjs persistent context is not exposed over CDP, so instead:
// we inspect what the login page currently shows by reading the page's state
// through the shared persistent profile (can't — it's locked by the running chrome).
//
// Fallback: just dump the login-card text from a fresh throwaway profile.
const ctx = await chromium.launchPersistentContext('/tmp/dy-probe-profile', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(7000);
const cardText = await page.evaluate(() => {
  const c = document.querySelector('[class*="douyin-login-container"]');
  return c ? c.innerText : '(no container)';
});
console.log('LOGIN CARD TEXT:\n' + cardText);
await ctx.close();
