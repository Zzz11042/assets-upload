#!/usr/bin/env node
/**
 * Douyin comment reply v3 — uses the comment notice API directly.
 *
 * Endpoints discovered:
 *   GET /aweme/v1/creator/notice/comment/?aid=2906&app_name=aweme_creator_platform&device_platform=web
 *       → { "comments": [...], "status_code": 0 }
 *   POST /aweme/v1/comment/reply/ (or similar) to post a reply
 *
 * Since the account has 0 videos published, the comment list will be empty
 * until the first video goes live. This script is safe to run on any cadence
 * — it just no-ops when there's nothing to reply to.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/home/zzz/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const dryRun = process.argv.includes('--dry-run');
const maxIdx = process.argv.indexOf('--max');
const maxN = maxIdx >= 0 ? parseInt(process.argv[maxIdx + 1]) : 5;

console.log(`[reply-v3] dryRun=${dryRun} max=${maxN}`);

const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'profiles', 'default'), {
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

// Navigate to a douyin.com origin so relative fetch() works
await page.goto('https://creator.douyin.com/creator-micro/interact', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

// Call the comment notice API
console.log('[reply-v3] fetching comment notice API...');
const result = await page.evaluate(async () => {
  const r = await fetch(
    '/aweme/v1/creator/notice/comment/?aid=2906&app_name=aweme_creator_platform&device_platform=web',
    { method: 'GET', credentials: 'include' }
  );
  return await r.json();
}).catch((e) => {
  console.log('[reply-v3] fetch err:', e.message);
  return null;
});

if (!result) {
  console.log('[reply-v3] API call failed, exiting');
  await ctx.close();
  process.exit(1);
}

const comments = result.comments || [];
console.log(`[reply-v3] status_code=${result.status_code} comments=${comments.length}`);

// Save state
fs.writeFileSync(
  path.join(ROOT, 'state', 'comments.json'),
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      statusCode: result.status_code,
      commentCount: comments.length,
      sample: comments.slice(0, 20).map((c) => ({
        id: c.id_str || c.id,
        text: c.text || c.content,
        user: c.user?.nickname || c.author?.nickname,
        videoId: c.aweme_id || c.item_id,
        replyCount: c.reply_count,
      })),
    },
    null, 2
  )
);
console.log('[reply-v3] saved to state/comments.json');

// Reply to comments
if (comments.length > 0 && !dryRun) {
  const toReply = comments.slice(0, maxN);
  for (const c of toReply) {
    const replyText = generateReply(c.text || c.content || '');
    console.log(`[reply-v3] replying to "${(c.text || c.content || '').slice(0, 40)}" with: "${replyText}"`);
    // POST the reply via the API
    const replyResult = await page.evaluate(
      async ({ commentId, videoId, text }) => {
        const r = await fetch('/aweme/v1/comment/reply/', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment_id: commentId,
            aweme_id: videoId,
            text,
          }),
        });
        return await r.json();
      },
      { commentId: c.id_str || c.id, videoId: c.aweme_id || c.item_id, text: replyText }
    ).catch((e) => ({ error: e.message }));
    console.log(`[reply-v3] reply result:`, JSON.stringify(replyResult).slice(0, 200));
    // Human-like delay between replies
    await new Promise((r) => setTimeout(r, 3000 + Math.random() * 5000));
  }
} else if (dryRun && comments.length > 0) {
  for (const c of comments.slice(0, maxN)) {
    console.log(`[reply-v3] DRY-RUN would reply to "${(c.text || c.content || '').slice(0, 40)}": "${generateReply(c.text || c.content || '')}"`);
  }
}

await ctx.close().catch(() => {});
process.exit(0);

function generateReply(commentText) {
  const text = (commentText || '').toLowerCase();
  if (text.includes('好') || text.includes('棒') || text.includes('牛') || text.includes('赞') || text.includes('👍')) {
    return '谢谢支持！我会继续努力的~';
  }
  if (text.includes('怎么') || text.includes('如何') || text.includes('什么') || text.includes('为什么') || text.includes('?') || text.includes('？')) {
    return '好问题！可以看看我之前的视频，或者私信问我~';
  }
  if (text.includes('关注') || text.includes('关注了') || text.includes('粉')) {
    return '感谢关注！不迷路的话点个赞支持一下~';
  }
  if (text.includes('视频') || text.includes('内容') || text.includes('更新')) {
    return '谢谢喜欢！后续会出更多相关内容~';
  }
  if (text.includes('自动化') || text.includes('ai') || text.includes('AI')) {
    return '对！我这边全是 AI 自动化在运营，感兴趣的话可以看看我的主页~';
  }
  return '谢谢你的评论！我会认真对待每一条反馈~';
}
