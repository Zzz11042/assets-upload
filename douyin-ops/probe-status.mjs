import { chromium } from 'playwright-core';
import fs from 'node:fs';
const storage = JSON.parse(fs.readFileSync('./state/storage.json', 'utf8'));
const ctx = await chromium.launchPersistentContext('/tmp/dy-status-profile', {
  executablePath: '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
await ctx.addCookies(storage.cookies || []);
const page = ctx.pages()[0] || (await ctx.newPage());

let userInfo = null, postItems = null, interactData = null;
page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('creator.douyin.com')) return;
  try {
    const body = await res.json();
    if (u.includes('/creator/user/info/') || u.includes('/pc/user/info/')) userInfo = body;
    if (u.includes('post/list') || u.includes('item_list') || u.includes('work/list') || u.includes('content/list')) postItems = body;
    if (u.includes('comment') || u.includes('interact')) interactData = body;
  } catch {}
});

await page.goto('https://creator.douyin.com/creator-micro/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

const status = {
  timestamp: new Date().toISOString(),
  account: userInfo ? {
    uid: userInfo.uid,
    nickname: userInfo.douyin_user_verify_info?.nick_name,
    uniqueId: userInfo.douyin_user_verify_info?.douyin_unique_id,
    followers: userInfo.douyin_user_verify_info?.follower_count,
    following: userInfo.douyin_user_verify_info?.following_count,
    totalLikes: userInfo.douyin_user_verify_info?.total_favorited,
  } : null,
  postCount: postItems?.items?.length || postItems?.data?.items?.length || 0,
  posts: (postItems?.items || postItems?.data?.items || []).slice(0, 20).map((p) => ({
    id: p.id_str || p.aweme_id,
    caption: p.desc || p.text,
    playCount: p.statistics?.play_count,
    likeCount: p.statistics?.digg_count,
    commentCount: p.statistics?.comment_count,
    createTime: p.create_time,
  })),
  interactKeys: interactData ? Object.keys(interactData).slice(0, 10) : null,
};

fs.writeFileSync('./state/status.json', JSON.stringify(status, null, 2));
console.log('ACCOUNT:', JSON.stringify(status.account));
console.log('POSTS:', status.postCount);
(status.posts || []).forEach((p) => console.log(`  ${p.id?.slice(0, 12)}: ${p.caption?.slice(0, 40)} [plays=${p.playCount}, likes=${p.likeCount}, comments=${p.commentCount}]`));
console.log('INTERACT:', status.interactKeys);
await ctx.close();
