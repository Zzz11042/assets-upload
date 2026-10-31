#!/usr/bin/env node
/**
 * Douyin account + content status v2 — fetches metrics via API capture.
 *
 * Usage: node bin/status.mjs [--json]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const jsonOut = process.argv.includes('--json');

const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'profiles', 'default'), {
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

let userInfo = null;
let postItems = null;
let analytics = null;
let interactData = null;

page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('creator.douyin.com') && !u.includes('douyin.com')) return;
  try {
    const body = await res.json();
    if (u.includes('/creator/user/info/') || u.includes('/pc/user/info/')) userInfo = body;
    if (u.includes('post/list') || u.includes('item_list') || u.includes('content/list') || u.includes('work/list')) postItems = body;
    if (u.includes('analytics') || u.includes('data/overview') || u.includes('index/config') || u.includes('interact')) analytics = body;
    if (u.includes('comment') || u.includes('interact')) interactData = body;
  } catch {}
});

// 1. Home (loads user info)
console.log('[status-v2] loading home...');
await page.goto('https://creator.douyin.com/creator-micro/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

// 2. Interact center
console.log('[status-v2] loading interact...');
await page.goto('https://creator.douyin.com/creator-micro/interact', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

// 3. Content management
console.log('[status-v2] loading content management...');
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

// 4. Read DOM for account stats
const domStats = await page.evaluate(() => {
  const text = document.body.innerText;
  const extract = (label) => {
    const m = text.match(new RegExp(label + '[^\\d]*(\\d+)'));
    return m ? parseInt(m[1]) : null;
  };
  return {
    followers: extract('粉丝'),
    following: extract('关注'),
    likes: extract('获赞'),
    hasContent: !text.includes('没有更多作品'),
  };
});

// Build the status object
const status = {
  timestamp: new Date().toISOString(),
  account: userInfo
    ? {
        uid: userInfo.uid,
        nickname: userInfo.douyin_user_verify_info?.nick_name || userInfo.nick_name,
        uniqueId: userInfo.douyin_user_verify_info?.douyin_unique_id,
        followers: userInfo.douyin_user_verify_info?.follower_count,
        following: userInfo.douyin_user_verify_info?.following_count,
        totalLikes: userInfo.douyin_user_verify_info?.total_favorited,
      }
    : domStats,
  domStats,
  postCount: postItems?.items?.length || postItems?.data?.items?.length || null,
  posts: (postItems?.items || postItems?.data?.items || [])
    .slice(0, 20)
    .map((p) => ({
      id: p.id_str || p.aweme_id || p.id,
      caption: p.desc || p.text,
      status: p.status,
      playCount: p.statistics?.play_count,
      likeCount: p.statistics?.digg_count,
      commentCount: p.statistics?.comment_count,
      shareCount: p.statistics?.share_count,
      createTime: p.create_time,
    })),
  interact: interactData ? Object.keys(interactData).slice(0, 10) : null,
};

fs.writeFileSync(path.join(ROOT, 'state', 'status.json'), JSON.stringify(status, null, 2));
console.log('[status-v2] written to state/status.json');

if (jsonOut) {
  console.log(JSON.stringify(status, null, 2));
} else {
  console.log(`\nAccount: ${status.account.nickname || '?'} (id=${status.account.uid || '?'})`);
  console.log(`Followers: ${status.account.followers ?? '?'} | Following: ${status.account.following ?? '?'} | Likes: ${status.account.totalLikes ?? '?'}`);
  console.log(`Posts: ${status.postCount ?? status.posts?.length ?? '?'}`);
  for (const p of status.posts || []) {
    console.log(`  ${p.id?.slice(0, 12)}: ${p.caption?.slice(0, 40)} [plays=${p.playCount}, likes=${p.likeCount}, comments=${p.commentCount}]`);
  }
}

await ctx.close().catch(() => {});
process.exit(0);
