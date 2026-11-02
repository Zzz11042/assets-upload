#!/usr/bin/env node
/**
 * 资产标签索引生成器（一次性/增量）：扫描本地资产库，生成可机读标签文件
 * asset-dashboard/knowledge/asset-tags.json（格式见 asset-tags.schema.json）。
 *
 * 用法：node gen-asset-tags.mjs [--force]
 *   - 默认增量（按 source mtime 跳过未变项）；--force 全量重建。
 * 生成的每条记录 type=asset/pattern/algo，tags 扁平可检索；
 * 同类功能（如各方案的合成升阶/波次/回收）被归并为 pattern，算法字段 algo.name 相同即视为同一功能。
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const WS = path.resolve(__dirname, "..");
const FORGE = path.join(WS, "game-forge");
const TOMATO = path.join(WS, "tomato");
const OUT = path.join(__dirname, "knowledge", "asset-tags.json");

function readJson(p, fb = null) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; } }
function flat(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join("、");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function now() { return new Date().toISOString(); }
function base() {
  return {
    _schema: "asset-dashboard/asset-tags@1",
    generated_at: now(),
    counts: { asset: 0, pattern: 0, algo: 0 },
    entries: [],
  };
}

// 1) 游戏知识 → pattern（方案条目，tags 直接机读）
function scanPlans(doc, entries) {
  const plans = readJson(path.join(FORGE, "knowledge/plans.json"), []);
  plans.forEach(p => {
    const tags = String(p.tags || "").split(/\s+/).filter(Boolean).concat([p.genre || ""]);
    entries.push({
      id: "plan:" + p.id, type: "pattern", domain: "game", kind: "plan",
      title: p.name, source: "game-forge/knowledge/plans.json#" + p.id,
      tags: [...new Set(tags)],
      core_loop: p.core_loop, mechanics: p.mechanics || [], numbers: p.numbers || {},
      monetization: p.monetization, mvp_scope: p.mvp_scope,
      borrow_from: p.borrow_from, reusable: true, created: p.generated_at || now(), origin: "local",
    });
  });
  // 方案里的关键数值机制 → 合并为 algo（同类功能同名合并）
  const algoMap = {};
  plans.forEach(p => {
    (p.mechanics || []).forEach(m => {
      const name = String(m).split(/[（(]/)[0].trim().slice(0, 12);
      const k = "algo:" + name;
      if (!algoMap[name]) algoMap[name] = {
        id: k, type: "algo", domain: "game", kind: "algorithm",
        title: name, source: "game-forge/knowledge/plans.json",
        tags: [name, "game"],
        algo: { name, purpose: String(m), inputs: ["配置"], outputs: ["行为"], variants: [], reuse_in: ["game"] },
        variants_of: [], refs: [], reusable: true, created: now(), origin: "local",
      };
      algoMap[name].refs.push("plan:" + p.id);
      algoMap[name].variants_of.push(p.name);
    });
  });
  Object.values(algoMap).forEach(a => entries.push(a));
}

// 2) 游戏库 → asset（相似游戏，借鉴字段可机读）
function scanGames(doc, entries) {
  const games = readJson(path.join(FORGE, "knowledge/games.json"), []);
  games.forEach(g => {
    entries.push({
      id: "game:" + g.id, type: "asset", domain: "game", kind: "game",
      title: g.name, source: "game-forge/knowledge/games.json#" + g.id,
      tags: String(g.tags || "").split(/\s+/).filter(Boolean).concat([g.genre || "", g.theme || ""]),
      mechanics: g.mechanics, borrow: g.borrow, art_style: g.art_style, reusable: true,
      refs: [], created: g.generated_at || now(), origin: "local",
    });
  });
}

// 3) 风格库 → pattern（含 palette 机读）
function scanStyles(doc, entries) {
  const styles = readJson(path.join(FORGE, "knowledge/styles.json"), []);
  const sl = Array.isArray(styles) ? styles : Object.values(styles);
  sl.forEach(s => {
    entries.push({
      id: "style:" + s.id, type: "pattern", domain: "game", kind: "style",
      title: s.name, source: "game-forge/knowledge/styles.json#" + s.id,
      tags: String(s.tags || "").split(/\s+/).filter(Boolean).concat([s.mood || ""]),
      palette: s.palette, style_prompt: s.style_prompt, reference: s.reference,
      reusable: true, refs: [], created: s.generated_at || now(), origin: "local",
    });
  });
}

// 4) 小说/书 → pattern（style-dna / 伏笔账本 提取标签）
function scanNovels(doc, entries) {
  const booksDir = path.join(TOMATO, "books");
  const books = fs.existsSync(booksDir) ? fs.readdirSync(booksDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : [];
  books.forEach(b => {
    const st = readJson(path.join(booksDir, b, "state.json"), {});
    const dnaP = path.join(booksDir, b, "style-dna.md");
    const dna = fs.existsSync(dnaP) ? fs.readFileSync(dnaP, "utf8") : "";
    // 提取：视角人称/句法/节奏 段落做轻量标签
    const tags = [];
    if (/第三人称/.test(dna)) tags.push("第三人称");
    if (/吐槽/.test(dna)) tags.push("吐槽流");
    if (/职场/.test(dna)) tags.push("职场梗");
    if (/末世/.test(dna)) tags.push("末世");
    if (/重生/.test(dna)) tags.push("重生");
    const m = dna.match(/单章\s*(\d+)-(\d+)\s*字/);
    if (m) tags.push("章" + m[1] + "-" + m[2] + "字");
    entries.push({
      id: "novel:" + b, type: "pattern", domain: "novel", kind: "state",
      title: st.book || b, source: "tomato/books/" + b,
      tags: [...new Set(tags.concat([b]))],
      next_chapter: st.next_chapter, foreshadow_open: st.foreshadow_open || [],
      reusable: true, refs: [], created: now(), origin: "local",
    });
    if (dna) {
      entries.push({
        id: "novel:" + b + ":style_dna", type: "pattern", domain: "novel", kind: "style",
        title: (st.book || b) + " 风格DNA", source: "tomato/books/" + b + "/style-dna.md",
        tags: ["风格DNA", ...tags.slice(0, 4)],
        excerpt: dna.slice(0, 400), reusable: true, refs: ["novel:" + b], created: now(), origin: "local",
      });
    }
  });
  // 长篇 novel_projects
  const np = fs.existsSync(path.join(FORGE, "novel_projects")) ? fs.readdirSync(path.join(FORGE, "novel_projects")) : [];
  np.forEach(d => {
    const st = readJson(path.join(FORGE, "novel_projects", d, "state.json"), {});
    entries.push({
      id: "novelproj:" + d, type: "asset", domain: "novel", kind: "state",
      title: st.idea || d, source: "game-forge/novel_projects/" + d,
      tags: [st.card?.platform || "", st.card?.length || "", st.card?.hero || ""].filter(Boolean),
      chapters: st.chapters_done, reusable: true, refs: [], created: now(), origin: "local",
    });
  });
}

// 5.5) 游戏 out/ 生成产物 → asset（构建产物，标签来自项目名 + 设计文件）
function scanGameOut(doc, entries) {
  const outDir = path.join(FORGE, "out");
  if (!fs.existsSync(outDir)) return;
  fs.readdirSync(outDir, { withFileTypes: true }).forEach(e => {
    if (!e.isDirectory()) return;
    const d = e.name;
    // 从 设计.md / FLOW_MANIFEST 提取标签
    let tags = [];
    const maniP = path.join(outDir, d, "FLOW_MANIFEST.json");
    const mani = readJson(maniP, null);
    if (mani) {
      tags.push("已生成game.html", "含art_manifest");
      const styleName = (mani.style && mani.style.name) || (mani.style_id ? "风格:" + mani.style_id : "");
      if (styleName) tags.push(styleName);
    }
    const designP = path.join(outDir, d + "_设计.md");
    if (fs.existsSync(designP)) {
      const t = fs.readFileSync(designP, "utf8");
      const gm = t.match(/"genre"\s*:\s*"([^"]+)"/);
      if (gm) tags.push(gm[1]);
      const sm = t.match(/"style_id"\s*:\s*"([^"]+)"/);
      if (sm) tags.push("风格:" + sm[1]);
      if (/数值注入|numbers/.test(t)) tags.push("含数值注入");
    }
    entries.push({
      id: "gameout:" + d, type: "asset", domain: "game", kind: "game-build",
      title: d, source: "game-forge/out/" + d,
      tags: [...new Set(tags.concat([d]))],
      reusable: true, refs: [], created: now(), origin: "local",
    });
  });
}

// 5) 短剧/视频项目 → asset（卡片机读 + 分镜）
function scanVideo(doc, entries) {
  const projs = fs.existsSync(path.join(FORGE, "projects")) ? fs.readdirSync(path.join(FORGE, "projects")) : [];
  projs.forEach(d => {
    const p = readJson(path.join(FORGE, "projects", d, "project.json"), null);
    if (!p) return;
    const cs = (p.characters && p.characters.characters) || [];
    entries.push({
      id: "video:" + d, type: "asset", domain: "video", kind: "script",
      title: p.card?.title || d, source: "game-forge/projects/" + d,
      tags: [p.card?.content_type || "", p.card?.duration_sec + "s", p.card?.aspect || "", p.card?.visual_style || "", ...cs.map(c => c.name)].filter(Boolean),
      card: p.card, shots: p.shots ? p.shots.length : 0, reusable: true,
      refs: [], created: p.card?.generated_at || now(), origin: "local",
    });
  });
}

// 6) 外部参考资产（inbox 目录里的外来文件）→ 解析入库
function scanExternal(doc, entries) {
  const inbox = path.join(FORGE, "inbox");
  if (!fs.existsSync(inbox)) return;
  fs.readdirSync(inbox, { withFileTypes: true }).forEach(e => {
    if (!e.isFile()) return;
    const fp = path.join(inbox, e.name);
    const ext = path.extname(e.name).toLowerCase();
    let tags = [e.name.toLowerCase()];
    if ([".md", ".txt"].includes(ext)) {
      const t = fs.readFileSync(fp, "utf8");
      const m = t.match(/^#\s*(.+)$/m);
      if (m) tags.push(m[1].trim().slice(0, 30));
      if (/数值|波次/.test(t)) tags.push("数值");
      if (/机制|玩法/.test(t)) tags.push("机制");
      entries.push({
        id: "external:inbox/" + e.name, type: "asset", domain: "cross", kind: "doc",
        title: e.name, source: "game-forge/inbox/" + e.name, tags: [...new Set(tags)],
        note: "外来参考资产（inbox），解析后可与本地资产重组复用", reusable: true, refs: [],
        created: now(), origin: "external",
      });
    }
  });
}

const doc = base();
scanPlans(doc, doc.entries);
scanGames(doc, doc.entries);
scanStyles(doc, doc.entries);
scanNovels(doc, doc.entries);
scanGameOut(doc, doc.entries);
scanVideo(doc, doc.entries);
scanExternal(doc, doc.entries);
doc.counts = {
  asset: doc.entries.filter(e => e.type === "asset").length,
  pattern: doc.entries.filter(e => e.type === "pattern").length,
  algo: doc.entries.filter(e => e.type === "algo").length,
};
doc.generated_at = now();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
// 知识库保护：本机若缺少 game-forge/tomato 数据源，不得用空快照冲掉已提交的 asset-tags.json
const oldDoc = readJson(OUT, null);
if (!fs.existsSync(FORGE) && !fs.existsSync(TOMATO) && oldDoc && (oldDoc.entries || []).length > 0) {
  console.log("本地数据源缺失（game-forge/tomato 不存在），保留现有 asset-tags.json（" + oldDoc.entries.length + " 条），跳过本次重建。");
  process.exit(0);
}
// 数据源存在时重建：保留上一版解析出的 external 条目（避免 --force/刷新 丢失 inbox 参考资产）
if (oldDoc) {
  for (const e of oldDoc.entries || []) if (e.origin === "external" && !doc.entries.some(n => n.id === e.id)) doc.entries.push(e);
}
const force = process.argv.includes("--force");
if (!force) {
  const old = readJson(OUT, null);
  if (old && old.generated_at === doc.generated_at.slice(0, 10)) {
    console.log("asset-tags.json 已是最新（同日），跳过；--force 可强制重建。");
    process.exit(0);
  }
}
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
console.log("asset-tags.json 生成完成:", doc.counts, "共", doc.entries.length, "条");
