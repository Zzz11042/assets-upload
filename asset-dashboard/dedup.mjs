#!/usr/bin/env node
/**
 * dedup.mjs — 资产去重分析引擎（report-only：只列候选，不移动/不删除任何文件）
 *
 * 两种用法：
 *   1) server.mjs 的 /api/dedup 端点（跨扫描根实时分析）
 *   2) 独立 CLI：node dedup.mjs --roots "E:\a,D:\b" [--depth 6] [--out report.json] [--md report.md]
 *
 * 算法：
 *   - 遍历各根（与 local-scan 相同的 SKIP / 隐藏目录规则），收集图片文件（png/jpg/jpeg/webp/gif）
 *   - 先按「大小+扩展名」分组（廉价预筛），仅对同组 ≥2 文件计算 sha1（流式，省 IO）
 *   - exact groups：字节完全相同的重复（安全去重候选，可省 (n-1)×size）
 *   - sameName groups：同名基（忽略大小写、去扩展名）跨 ≥2 个根 → 跨格式嫌疑（如 png 母版 vs 游戏内 webp），需视觉确认
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const DEDUP_IMG = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const SKIP = new Set(["node_modules", ".git", "__pycache__", ".cache", "dist", "build", "profiles", "logs", "vault"]);

/** 收集根目录下的图片文件（深度限制 + SKIP 规则）；roots 不存在的直接跳过 */
export function collectImageFiles(roots, { depth = 6, includeHidden = false } = {}) {
  const out = [];
  const walk = (abs, d, rootName) => {
    if (d > depth) return;
    let names;
    try { names = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      if (!includeHidden && e.name.startsWith(".")) continue;
      if (SKIP.has(e.name)) continue;
      const full = path.join(abs, e.name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full, d + 1, rootName);
      else {
        const ext = path.extname(e.name).toLowerCase();
        if (DEDUP_IMG.includes(ext)) out.push({ path: full, root: rootName, size: st.size, ext, name: e.name });
      }
    }
  };
  for (const r of roots || []) {
    const abs = path.resolve(r);
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (!st.isDirectory()) continue;
    walk(abs, 0, path.basename(abs) || abs);
  }
  return out;
}

function sha1File(p) {
  const h = crypto.createHash("sha1");
  const stream = fs.createReadStream(p);
  return new Promise((resolve, reject) => {
    stream.on("data", c => h.update(c));
    stream.on("end", () => resolve(h.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * 跨根去重分析。
 * @param {string[]} roots 绝对路径根目录
 * @param {object} [opts] { depth=6, includeHidden=false, maxExactGroups=500, maxSameNameGroups=300, filesPerGroup=20 }
 */
export async function runDedup(roots, opts = {}) {
  const depth = Math.min(Number(opts.depth) || 6, 8);
  const maxExactGroups = Number(opts.maxExactGroups) || 500;
  const maxSameNameGroups = Number(opts.maxSameNameGroups) || 300;
  const filesPerGroup = Number(opts.filesPerGroup) || 20;
  const files = collectImageFiles(roots, { depth, includeHidden: !!opts.includeHidden });

  // 1) 按「大小:扩展名」预筛：字节相同 ⇒ 大小必然相同
  const bySize = new Map();
  for (const f of files) {
    const k = f.size + ":" + f.ext;
    if (!bySize.has(k)) bySize.set(k, []);
    bySize.get(k).push(f);
  }
  // 2) 仅对候选组（≥2 文件）计算 sha1（流式读，缓存按路径去重）
  const hashCache = new Map();
  for (const g of bySize.values()) {
    if (g.length < 2) continue;
    for (const f of g) {
      if (!hashCache.has(f.path)) hashCache.set(f.path, await sha1File(f.path));
    }
  }
  // 3) 按「sha1:扩展名」聚成精确重复组（同根嵌套导致同一路径出现两次时先按路径去重）
  const byHash = new Map();
  for (const g of bySize.values()) {
    if (g.length < 2) continue;
    for (const f of g) {
      const hk = hashCache.get(f.path) + ":" + f.ext;
      if (!byHash.has(hk)) byHash.set(hk, []);
      const arr = byHash.get(hk);
      if (!arr.some(x => x.path === f.path)) arr.push(f);
    }
  }
  const exactGroups = [...byHash.values()]
    .filter(g => g.length >= 2)
    .map(g => ({
      sha1: hashCache.get(g[0].path).slice(0, 16),
      ext: g[0].ext,
      sizeBytes: g[0].size,
      sizeMB: Math.round(g[0].size / 104857.6) / 10,
      files: g.slice(0, filesPerGroup).map(x => ({ path: x.path, root: x.root })),
      count: g.length,
      wasteMB: Math.round(g[0].size * (g.length - 1) / 104857.6) / 10,
    }))
    .sort((a, b) => b.wasteMB - a.wasteMB)
    .slice(0, maxExactGroups);

  // 4) 同名基（去扩展名、小写）跨根嫌疑：同一美术文件不同格式的拷贝（需视觉确认）
  const byName = new Map();
  for (const f of files) {
    const nk = f.name.replace(/\.[^.]+$/, "").toLowerCase();
    if (!byName.has(nk)) byName.set(nk, []);
    const arr = byName.get(nk);
    if (!arr.some(x => x.path === f.path)) arr.push(f);
  }
  const sameNameGroups = [...byName.values()]
    .filter(g => g.length >= 2 && new Set(g.map(x => x.root)).size >= 2)
    .map(g => ({
      name: g[0].name.replace(/\.[^.]+$/, "").toLowerCase(),
      count: g.length,
      files: g.slice(0, filesPerGroup).map(x => ({ root: x.root, ext: x.ext, sizeMB: Math.round(x.size / 104857.6) / 10, path: x.path })),
      note: "同名基跨根：可能为同一素材的不同格式拷贝（png 母版 vs webp 游戏内等），非字节相同，需视觉确认",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxSameNameGroups);

  return {
    report_only: true,
    note: "仅报告候选：不移动/不删除任何文件；精确组为字节级重复（安全），同名组需视觉确认",
    roots: (roots || []).map(r => path.basename(path.resolve(r)) || r),
    roots_abs: (roots || []).map(r => path.resolve(r)),
    depth,
    scanned_at: new Date().toISOString(),
    summary: {
      filesScanned: files.length,
      totalImageMB: Math.round(files.reduce((s, f) => s + f.size, 0) / 104857.6) / 10,
      exactGroupCount: exactGroups.length,
      exactDupFiles: exactGroups.reduce((s, g) => s + (g.count - 1), 0),
      potentialSavingsMB: Math.round(exactGroups.reduce((s, g) => s + g.wasteMB, 0) * 10) / 10,
      sameNameGroupCount: sameNameGroups.length,
    },
    exactGroups,
    sameNameGroups,
  };
}

function renderMd(r) {
  const s = r.summary || {};
  const L = [];
  L.push("# 资产去重分析报告", "");
  L.push("- 生成于 " + r.scanned_at + "（asset-dashboard dedup.mjs，report-only）");
  L.push("- 扫描根：" + (r.roots_abs || r.roots || []).join("、"));
  L.push("");
  L.push("## 摘要", "");
  L.push("| 指标 | 数值 |");
  L.push("|---|---|");
  L.push("| 图片文件总数 | " + s.filesScanned + "（" + s.totalImageMB + " MB） |");
  L.push("| 字节相同重复组 | " + s.exactGroupCount + "（重复文件 " + s.exactDupFiles + "） |");
  L.push("| 理论可回收空间 | " + s.potentialSavingsMB + " MB |");
  L.push("| 同名跨格式嫌疑组 | " + s.sameNameGroupCount + " |");
  L.push("");
  L.push("## 字节相同重复（精确组，按可回收空间排序）");
  L.push("");
  for (const g of r.exactGroups || []) {
    L.push("### " + g.ext + " × " + g.count + "（单文件 " + g.sizeMB + " MB，可回收 " + g.wasteMB + " MB）`" + g.sha1 + "`");
    for (const f of g.files) L.push("- " + f.path);
    L.push("");
  }
  L.push("## 同名跨格式嫌疑（需视觉确认）");
  L.push("");
  for (const g of (r.sameNameGroups || []).slice(0, 50)) {
    L.push("- **" + g.name + "** × " + g.count + "：" + g.files.map(f => f.root + "·" + f.ext + "(" + f.sizeMB + "MB)").join("；"));
  }
  L.push("");
  L.push("> 处置建议：精确组保留一份（优先留 art-assets git 仓内副本），同名组人工视觉确认后合并。本工具不执行任何移动/删除。");
  return L.join("\n");
}

// 独立 CLI：node dedup.mjs --roots "a,b" [--depth 6] [--out report.json] [--md report.md]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i >= 0 ? process.argv[i + 1] : d; };
  const roots = (arg("roots", "")).split(",").map(s => s.trim()).filter(Boolean).map(r => path.resolve(r));
  if (!roots.length) {
    console.error("用法: node dedup.mjs --roots \"E:\\a,D:\\b\" [--depth 6] [--out dedup-report.json] [--md dedup-report.md]");
    process.exit(1);
  }
  const t0 = Date.now();
  const r = await runDedup(roots, { depth: Number(arg("depth", "6")) || 6 });
  const jsonOut = arg("out", "dedup-report.json");
  const mdOut = arg("md", "");
  fs.writeFileSync(jsonOut, JSON.stringify(r, null, 1));
  if (mdOut) fs.writeFileSync(mdOut, renderMd(r));
  const s = r.summary;
  console.log("dedup 完成（" + Math.round((Date.now() - t0) / 1000) + "s）：图片 " + s.filesScanned + "（" + s.totalImageMB + "MB），精确重复 " + s.exactGroupCount + " 组 / " + s.exactDupFiles + " 文件，可回收 " + s.potentialSavingsMB + "MB，同名嫌疑 " + s.sameNameGroupCount + " 组");
  console.log("JSON: " + jsonOut + (mdOut ? " | MD: " + mdOut : ""));
}
