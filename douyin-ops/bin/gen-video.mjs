#!/usr/bin/env node
/**
 * Video generation pipeline — creates Douyin-ready vertical videos (9:16)
 * using ffmpeg. Supports:
 *   1. Talking-head style: text slides + background + optional voiceover
 *   2. Slideshow: image sequence with captions
 *   3. Screen-record style: animated text over gradient
 *
 * Usage: node bin/gen-video.mjs <output.mp4> --text "标题" [--sub "副标题"] [--style slideshow|text|gradient]
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const outFile = path.resolve(args.find((a) => !a.startsWith('--')));
const opt = (flag, dflt = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const text = opt('--text', '抖音自动运营 Day1');
const sub = opt('--sub', 'AI 帮你发视频、回评论');
const style = opt('--style', 'gradient');
const duration = Number(opt('--duration', '15'));

console.log(`[gen-video] style=${style} text="${text}" sub="${sub}" dur=${duration}s`);

fs.mkdirSync(path.dirname(outFile), { recursive: true });

// All videos: 1080x1920 (9:16 vertical), 30fps, H.264 + AAC
const W = 1080, H = 1920, FPS = 30;

function run(cmd) {
  console.log('[gen-video]', cmd.slice(0, 120));
  execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
}

if (style === 'gradient') {
  // Animated gradient background with large centered text
  // Use a solid dark bg with a subtle gradient, and text overlay
  const titleFile = path.join(ROOT, 'state', 'title.txt');
  fs.writeFileSync(titleFile, text);
  const subFile = path.join(ROOT, 'state', 'sub.txt');
  fs.writeFileSync(subFile, sub || ' ');

  // Generate a 1080x1920 gradient video with text (no audio — avoids decoder issues)
  run(`ffmpeg -y -f lavfi -i "gradients=size=${W}x${H}:duration=${duration}:nb_colors=2:c0=0x1a1a2e:c1=0x16213e:speed=0.05" ` +
    `-vf "drawtext=textfile='${titleFile}':fontsize=88:fontcolor=white:borderw=3:bordercolor=0x000000:x=(w-text_w)/2:y=h*0.42,` +
    `drawtext=textfile='${subFile}':fontsize=52:fontcolor=0xaaaaaa:x=(w-text_w)/2:y=h*0.55,` +
    `drawtext=text='@抖音号 74277034968':fontsize=36:fontcolor=0x888888:x=(w-text_w)/2:y=h*0.7" ` +
    `-t ${duration} -r ${FPS} -c:v libx264 -pix_fmt yuv420p -an ${outFile} 2>&1 | tail -3`);

} else if (style === 'slideshow') {
  // Create 3-4 colored frames with text, each 3s, concat
  const tmpDir = path.join(ROOT, 'state', 'slides');
  fs.mkdirSync(tmpDir, { recursive: true });
  const colors = ['0x0f3460', '0x16213e', '0x1a1a2e', '0x533486'];
  const slides = [
    { bg: colors[0], text: text },
    { bg: colors[1], text: sub || ' ' },
    { bg: colors[2], text: '关注我 看更多' },
  ];
  const files = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const frame = path.join(tmpDir, `s${i}.png`);
    const txtFile = path.join(tmpDir, `s${i}.txt`);
    fs.writeFileSync(txtFile, s.text);
    run(`ffmpeg -y -f lavfi -i "color=c=${s.bg}:size=${W}x${H}:duration=1" -frames:v 1 -vf "drawtext=textfile='${txtFile}':fontsize=80:fontcolor=white:borderw=3:x=(w-text_w)/2:y=h/2" ${frame} 2>&1 | tail -1`);
    const clip = path.join(tmpDir, `s${i}.mp4`);
    run(`ffmpeg -y -loop 1 -i ${frame} -f lavfi -i anullsrc=r=44100:cl=stereo -shortest -t 3 -r ${FPS} -c:v libx264 -pix_fmt yuv420p -c:a aac ${clip} 2>&1 | tail -1`);
    files.push(clip);
  }
  const listFile = path.join(tmpDir, 'list.txt');
  fs.writeFileSync(listFile, files.map((f) => `file '${f}'`).join('\n'));
  run(`ffmpeg -y -f concat -safe 0 -i ${listFile} -c:v libx264 -pix_fmt yuv420p -c:a aac ${outFile} 2>&1 | tail -3`);

} else {
  // Default: simple test pattern with text
  run(`ffmpeg -y -f lavfi -i "testsrc=duration=${duration}:size=${W}x${H}:rate=${FPS}" ` +
    `-vf "drawtext=text='${text}':fontsize=72:fontcolor=white:borderw=3:x=(w-text_w)/2:y=h/2" ` +
    `-t ${duration} -c:v libx264 -pix_fmt yuv420p -c:a aac -f lavfi -i anullsrc=r=44100:cl=stereo -shortest ${outFile} 2>&1 | tail -3`);
}

// Verify output
if (fs.existsSync(outFile)) {
  const stat = fs.statSync(outFile);
  const ffprobe = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams ${outFile}`).toString();
  const info = JSON.parse(ffprobe);
  const vStream = info.streams.find((s) => s.codec_type === 'video');
  console.log(`[gen-video] OK: ${outFile} (${(stat.size / 1024).toFixed(0)}KB, ${vStream?.duration || duration}s, ${vStream?.width}x${vStream?.height})`);
} else {
  console.error('[gen-video] FAILED: output not found');
  process.exit(1);
}
