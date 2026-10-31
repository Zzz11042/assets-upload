#!/usr/bin/env node
/**
 * Douyin operations poller — runs status + comment replies on a schedule.
 * Designed to be launched as a long-running background process:
 *   node bin/poll.mjs [--interval-min 30] [--max-replies 3]
 *
 * Each cycle:
 *   1. Run status.mjs (writes state/status.json)
 *   2. Run reply-comments.mjs --max N (replies to new comments)
 *   3. Log a summary line to logs/poll.log
 *
 * The browser profile is locked by Chromium's singleton, so only one
 * poll cycle can use it at a time. This script is the single owner.
 */
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const intervalMin = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--interval-min')) || 30;
const maxReplies = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--max-replies')) || 3;

const LOG = path.join(ROOT, 'logs', 'poll.log');
fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function runScript(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(ROOT, 'bin', script), ...args], {
      cwd: ROOT,
      env: { ...process.env },
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

log(`poller started: interval=${intervalMin}min maxReplies=${maxReplies}`);

while (true) {
  const t0 = Date.now();
  try {
    const status = await runScript('status.mjs');
    const statusOk = status.code === 0;
    log(`status: ${statusOk ? 'OK' : 'ERR'} (code=${status.code})`);

    const reply = await runScript('reply-comments.mjs', ['--max', String(maxReplies)]);
    log(`reply: ${reply.code === 0 ? 'OK' : 'ERR'} (code=${reply.code})`);
    if (reply.stderr) log(`reply stderr: ${reply.stderr.slice(0, 200)}`);

    const elapsed = Math.round((Date.now() - t0) / 1000);
    log(`cycle complete in ${elapsed}s; sleeping ${intervalMin}min`);
  } catch (e) {
    log(`cycle error: ${e.message}`);
  }

  await new Promise((r) => setTimeout(r, intervalMin * 60 * 1000));
}
