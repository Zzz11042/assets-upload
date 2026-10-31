#!/usr/bin/env node
/**
 * Scheduled publisher — pulls items from state/queue.json and publishes
 * them one at a time with human-like spacing. Designed to run as a
 * long-lived background process:
 *
 *   node bin/schedule-publish.mjs [--min-gap-min 120] [--max-per-run 2]
 *
 * Each item in queue.json:
 *   { "file": "videos/x.mp4", "title": "...", "desc": "...", "tags": "a,b", "publishAt": "2026-10-23T12:00:00+06:00" }
 * Items without publishAt are published in order, respecting min-gap.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const QUEUE = path.join(ROOT, 'state', 'queue.json');
const LOG = path.join(ROOT, 'logs', 'schedule.log');
const minGapMin = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--min-gap-min')) || 120;
const maxPerRun = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--max-per-run')) || 2;

fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function loadQueue() {
  if (!fs.existsSync(QUEUE)) return [];
  return JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
}

function saveQueue(items) {
  fs.writeFileSync(QUEUE, JSON.stringify(items, null, 2));
}

function runPublish(item) {
  return new Promise((resolve) => {
    const args = [path.join(ROOT, 'bin', 'publish-v9.mjs'), item.file];
    if (item.title) args.push('--title', item.title);
    if (item.desc) args.push('--desc', item.desc);
    if (item.tags) args.push('--tags', item.tags);
    const child = spawn('node', args, { cwd: ROOT });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      log(`publish ${item.file} (title="${item.title}"): code=${code}`);
      if (out) log(`  out: ${out.slice(-400)}`);
      if (err) log(`  err: ${err.slice(-200)}`);
      resolve(code === 0);
    });
  });
}

log(`scheduler started: minGap=${minGapMin}min maxPerRun=${maxPerRun}`);

while (true) {
  const queue = loadQueue();
  const pending = queue.filter((i) => !i.publishedAt);
  if (pending.length === 0) {
    log('queue empty, sleeping 10min');
    await new Promise((r) => setTimeout(r, 10 * 60 * 1000));
    continue;
  }

  // Respect publishAt if present
  const now = Date.now();
  const due = pending.filter((i) => !i.publishAt || new Date(i.publishAt).getTime() <= now);
  const toPublish = due.slice(0, maxPerRun);

  for (let i = 0; i < toPublish.length; i++) {
    const item = toPublish[i];
    if (i > 0) {
      // Human-like gap: minGapMin ± 15% jitter
      const gapMs = minGapMin * 60_000 * (0.85 + Math.random() * 0.3);
      log(`waiting ${Math.round(gapMs / 60000)}min before next publish`);
      await new Promise((r) => setTimeout(r, gapMs));
    }
    const ok = await runPublish(item);
    if (ok) {
      item.publishedAt = new Date().toISOString();
      item.publishedBy = 'scheduler';
      const q2 = loadQueue();
      const idx = q2.findIndex((x) => x.file === item.file && !x.publishedAt);
      if (idx >= 0) {
        q2[idx] = item;
        saveQueue(q2);
      }
      log(`published OK: ${item.file}`);
    } else {
      log(`publish FAILED: ${item.file} — retrying in 30min`);
      await new Promise((r) => setTimeout(r, 30 * 60 * 1000));
    }
  }
}
