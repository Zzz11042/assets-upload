#!/usr/bin/env node
/**
 * asset-dashboard — 网页可视化入口（资产管理 + 方案生成 + 设置）
 * 读本地 JSON 资产库（game-forge vault/knowledge + novel/drama projects + tomato books），
 * 提供 /api/* + 静态 SPA。零 npm 依赖（仅标准库）。
 *
 * 用法: node server.mjs  → http://127.0.0.1:7800
 * 可选环境变量（网页「设置」视图写入 settings.json 后可覆盖）:
 *   PORT (默认 7800)
 *   AGNES_API_BASE / AGNES_API_KEY / AGNES_MODEL —— 网页设置页配置 LLM（OpenAI 兼容端点）
 *
 * 配置文件: ./settings.json（由网页「设置」视图写入，重启后生效）
 *   { "apiBase": "https://apihub.agnes-ai.com/v1", "apiKey": "sk-...", "model": "agnes-3.0-flash" }
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execSync } from "node:child_process";
import { runDedup } from "./dedup.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const WS = path.resolve(__dirname, ".."); // default-workspace
const FORGE = path.join(WS, "game-forge");
const TOMATO = path.join(WS, "tomato");
const SETTINGS_FILE = path.join(__dirname, "settings.json");
const SCAN_ROOTS_FILE = path.join(__dirname, "scan-roots.json");

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}
function listDir(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter(e => !e.name.startsWith(".")).map(e => e.name); } catch { return []; }
}
// 合并 env + settings.json（settings.json 优先）
function llmCfg() {
  const s = readJson(SETTINGS_FILE, {}) || {};
  return {
    apiBase: (s.apiBase || process.env.AGNES_API_BASE || "").replace(/\/+$/, ""),
    apiKey: s.apiKey || process.env.AGNES_API_KEY || "",
    model: s.model || process.env.AGNES_MODEL || "agnes-3.0-flash",
  };
}
function saveSettings(cfg) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...readJson(SETTINGS_FILE, {}), ...cfg }, null, 2));
}

// 扫描根持久化：/api/local-scan 或 /api/dedup 不带 roots 参数时，默认用 scan-roots.json
function savedScanRoots() {
  const d = readJson(SCAN_ROOTS_FILE, null);
  const r = (d && Array.isArray(d.roots) ? d.roots : []).map(x => String(x).trim()).filter(Boolean);
  return [...new Set(r.map(p => path.resolve(p)))];
}
// 公开部署白名单（SCAN_ROOTS_ALLOWED 环境变量）：限制可扫描的根
function allowRoots() {
  return (process.env.SCAN_ROOTS_ALLOWED || "").split(",").map(s => s.trim()).filter(Boolean).map(a => path.resolve(a));
}
function filterAllowed(roots) {
  const allowR = allowRoots();
  if (!allowR.length) return roots;
  const f = (roots || []).filter(r => allowR.some(a => r === a || r.startsWith(a + path.sep)));
  return f.length ? f : allowR.slice();
}
// 数据源可用性：本仓库仅保留 asset-dashboard，game-forge/tomato 可能缺失（相关端点按设计返回空，但需显式暴露缺失）
function sourceStatus() {
  const forge = fs.existsSync(FORGE);
  const tomato = fs.existsSync(TOMATO);
  const missing = [];
  if (!forge) missing.push("game-forge");
  if (!tomato) missing.push("tomato");
  return { ws: WS, game_forge: forge, tomato, missing };
}

// 调用 OpenAI 兼容 chat completions（带 90s 超时 + max_tokens 上限 + 429 退避重试，避免无限转圈）
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 90000);
async function llmChat(messages, maxTokens = 1200) {
  const c = llmCfg();
  if (!c.apiBase || !c.apiKey) throw new Error("LLM 未配置（请在「设置」填写 API Base + Key）");
  const attempt = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(c.apiBase + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + c.apiKey },
        body: JSON.stringify({ model: c.model, messages, temperature: 0.7, max_tokens: maxTokens }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") throw new Error("LLM 超时（" + LLM_TIMEOUT_MS / 1000 + "s 未返回，已回退本地）");
      throw e;
    } finally {
      clearTimeout(timer);
    }
    const j = await r.json();
    if (!r.ok) throw new Error("LLM " + r.status + ": " + JSON.stringify(j).slice(0, 200));
    return j.choices?.[0]?.message?.content || "";
  };
  // 429/5xx 退避重试：1s → 2s → 4s（共 4 次尝试），其余错误不重试
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e;
      const m = String(e.message).match(/^LLM (\d{3})/);
      const retryable = m && (m[1] === "429" || m[1] === "500" || m[1] === "502" || m[1] === "503");
      if (!retryable) break;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1024 * 1024); // 默认 1MB，防大请求撑爆内存
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "", size = 0;
    req.on("data", c => { size += c.length; if (size <= MAX_BODY_BYTES) d += c; });
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) return reject(new Error("payload too large (max " + MAX_BODY_BYTES + " bytes)"));
      try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

// ============ Codex agent 接入层 ============
// 外部 agent（Codex/DSH）接入闭环：
//   1) GET  /api/agent/manifest  能力发现（端点注册表 / 资产库 / 数据源 / 认证）
//   2) POST /api/agent/plan      需求 → 可执行方案（机读 plan：matched_assets + execution.tasks）
//   3) agent 在本地按 plan.execution.tasks 执行（T2I 生图 / 去重清理 / 功能实现）
//   4) POST /api/record + /api/tags/parse 回传结果并把新资产登记进知识库
// 认证：AGENT_TOKEN（env 或 settings.json.agentToken）启用后，/api/agent/* 需带 x-agent-token 头
// 本机工具路径：agent-local.json（gitignored，按部署机器覆盖）；缺失时用内置默认值并标 assumed
function agentAuthCfg() {
  const s = readJson(SETTINGS_FILE, {}) || {};
  const token = String(s.agentToken || process.env.AGENT_TOKEN || "").trim();
  return { token, mode: token ? "token" : "open", source: s.agentToken ? "settings.json" : (process.env.AGENT_TOKEN ? "env" : null) };
}
function agentAuthOk(req, res) {
  const cfg = agentAuthCfg();
  if (cfg.mode !== "token") return true;
  const got = String(req.headers["x-agent-token"] || "");
  const lenOk = got.length === cfg.token.length; // 定长比较，降低时序侧信道
  if (lenOk && got === cfg.token) return true;
  res.writeHead(401, { "content-type": "application/json", "www-authenticate": 'X-Agent-Token' });
  res.end(JSON.stringify({ ok: false, error: "agent token required (AGENT_TOKEN 已启用)", auth: cfg.mode, source: cfg.source }));
  return false;
}
function agentLocalTools() {
  const defaults = {
    t2i_tool: "E:/agent-work/creator/tools/agnes_image.py",
    t2i_retry: "E:/agent-work/creator/tools/agnes_image_retry.py",
    t2i_key: "E:/agent-work/creator/agnes.json",
    chroma_tool: "E:/codex/2026-10-07/new-chat-2/work/chroma.py",
    art_repo: "E:/codex/art-assets",
    batch_dir: "E:/agent-work/game-art/_gen",
    raw_dir: "E:/agent-work/game-art/_gen/raw",
  };
  const local = readJson(path.join(__dirname, "agent-local.json"), null);
  if (!local || typeof local !== "object") return { ...defaults, tools_source: "default", assumed: true, note: "agent-local.json 缺失：使用内置默认本机路径（assumed），在部署机创建该文件可覆盖" };
  const merged = { ...defaults, ...local };
  const missingKeys = Object.keys(defaults).filter(k => !merged[k]);
  return { ...merged, tools_source: "agent-local.json", assumed: false, missingKeys };
}
const ART_CATEGORIES = [
  { key: "monster", dir: "monsters", label: "怪物/角色/Boss", re: /monster|boss|敌人|怪物|角色|英雄|立绘|英雄|立絵/i },
  { key: "effect", dir: "effects", label: "攻击效果/VFX 关键帧", re: /vfx|fx|效果|攻击|技能|粒子/i },
  { key: "ui", dir: "ui", label: "UI 卡片/面板/图标", re: /ui|界面|卡片|面板|图标|icon|hud/i },
  { key: "scene", dir: "scenes", label: "场景/背景", re: /scene|场景|背景|地图|地图背景/i },
  { key: "prop", dir: "props", label: "道具/物件", re: /prop|道具|物件|装备|武器/i },
];
function categorizeArt(reqText) {
  const t = String(reqText || "").toLowerCase();
  for (const c of ART_CATEGORIES) if (c.re.test(t)) return c;
  return { key: "asset", dir: "ui", label: "未识别类别（默认 ui，可手工指定）", guessed: true };
}
function inferAgentDomain(text) {
  const t = String(text || "").toLowerCase();
  if (/小说|网文|章节|连载|爽文|重生|末世|玄幻|大纲|伏笔|番茄|起点/.test(t)) return "novel";
  if (/短剧|视频|剧本|分镜|镜头|台词|旁白|成片/.test(t)) return "video";
  if (/游戏|关卡|波次|塔防|挂机|战斗|数值|道具|玩法/.test(t)) return "game";
  return "cross";
}
function artRequirementText(text) {
  const t = String(text || "").toLowerCase();
  return ART_CATEGORIES.some(c => c.re.test(t));
}
// 本机是否存在该游戏的素材目录（art-assets 分类目录或扫描根内同名目录）
function localGameDirs(game) {
  const g = String(game || "").toLowerCase();
  if (!g) return { game: game, art_dir: null, dirs_found: [] };
  const found = [];
  const artRepo = agentLocalTools().art_repo;
  for (const c of ART_CATEGORIES) {
    const p = path.join(artRepo, c.dir, g);
    if (fs.existsSync(p)) found.push(p);
  }
  for (const r of savedScanRoots()) {
    const p = path.join(r, g);
    if (fs.existsSync(p) && !found.includes(p)) found.push(p);
  }
  const target = found[0] || (fs.existsSync(artRepo) ? path.join(artRepo, categorizeArt(g).dir, g) : null);
  return { game, art_dir: target, dirs_found: found };
}
// 按需求文本生成 T2I prompt 模板（遵循本机美术生图规则：透明素材绿幕母版 + chroma key）
function artPromptTemplates(game, category, reqText) {
  const ctx = String(reqText || "").slice(0, 120).trim() || "（未提供细节，按 ASSUMPTION 补全：像素/水墨风关键帧）";
  return {
    _note: "模板由 asset-dashboard 按本机美术生图规则生成；ASSUMPTION=风格/数量/尺寸需由 agent 确认后补全",
    green_chroma: "isolated on a solid #00B140 green screen background, no character, no text, no watermark",
    portrait: "game character portrait, dark fantasy cel-shading, dramatic lighting, bust framing, clean silhouette, no text, no watermark",
    samples: [
      {
        tag: game + "_" + category.key + "_01",
        out: "E:/codex/art-assets/" + categorizeArt(category.key).dir + "/" + game + "/" + game + "_" + category.key + "_01.png",
        chroma: category.key !== "ui",
        seed: 1000 + Math.floor(Math.random() * 8999),
        prompt: "game asset: " + ctx + ". style: dark sumi ink cel anime, high contrast. " + (category.key !== "ui" ? "isolated on a solid #00B140 green screen background, no text, no watermark" : "flat vector UI card, clean lines, dark background panel, no watermark"),
      },
    ],
  };
}

const API = {
  // 健康检查（部署监控 / uptime 探针）
  "/api/health": () => {
    const c = llmCfg();
    return { ok: true, uptime_s: Math.round(process.uptime()), llmOnline: !!(c.apiBase && c.apiKey), model: c.model, node: process.version };
  },
  // 三领域要素定义（游戏读 knowledge/elements.json，小说/短剧读 domains.json）
  "/api/domains": () => readJson(path.join(__dirname, "knowledge/domains.json"), { domains: {} }),
  // 某领域的要素序列：{domain} → elements 数组
  "/api/domainElements": (q) => {
    const domain = q.get("domain") || "game";
    const doms = readJson(path.join(__dirname, "knowledge/domains.json"), { domains: {} }).domains || {};
    const def = doms[domain];
    if (!def) return { domain, elements: [] };
    let els;
    if (domain === "game") {
      els = (readJson(path.join(FORGE, "knowledge/elements.json"), { elements: [] }).elements || []).filter(x => x.key !== "similar_game");
    } else {
      els = def.elements || [];
    }
    return { domain, label: def.label, elements: els, local_sources: def.local_sources || [], agent_hint: def.agent_hint || "" };
  },
  "/api/overview": () => {
    const vault = readJson(path.join(FORGE, "vault/INDEX.json"), []);
    const games = readJson(path.join(FORGE, "knowledge/games.json"), []);
    const plans = readJson(path.join(FORGE, "knowledge/plans.json"), []);
    const styles = readJson(path.join(FORGE, "knowledge/styles.json"), []);
    const dramaProjects = listDir(path.join(FORGE, "projects"));
    const novelProjects = listDir(path.join(FORGE, "novel_projects"));
    const tomatoBooks = listDir(path.join(TOMATO, "books")).filter(b => fs.existsSync(path.join(TOMATO, "books", b, "state.json")));
    const c = llmCfg();
    return {
      vault: { items: vault.length, byCategory: vault.reduce((m, v) => (m[v.category] = (m[v.category] || 0) + 1, m), {}) },
      knowledge: { games: games.length, plans: Array.isArray(plans) ? plans.length : Object.keys(plans).length, styles: Array.isArray(styles) ? styles.length : Object.keys(styles).length },
      dramaProjects,
      novelProjects,
      tomatoBooks,
      llmOnline: !!(c.apiBase && c.apiKey),
      llmModel: c.model,
      sources: sourceStatus(),
    };
  },
  "/api/vault": () => readJson(path.join(FORGE, "vault/INDEX.json"), []),
  // 数据源可用性：game-forge/tomato 缺失时相关端点按设计为空；此端点供前端显式提示（不再静默）
  "/api/sources": () => sourceStatus(),
  "/api/knowledge/games": () => readJson(path.join(FORGE, "knowledge/games.json"), []),
  "/api/knowledge/plans": () => readJson(path.join(FORGE, "knowledge/plans.json"), []),
  "/api/knowledge/styles": () => readJson(path.join(FORGE, "knowledge/styles.json"), []),
  "/api/knowledge/elements": () => readJson(path.join(FORGE, "knowledge/elements.json"), []),
  "/api/books": () => {
    const out = {};
    for (const b of listDir(path.join(TOMATO, "books"))) {
      const s = readJson(path.join(TOMATO, "books", b, "state.json"));
      if (s) out[b] = s;
    }
    return out;
  },
  "/api/projects/drama": () => {
    const out = {};
    for (const p of listDir(path.join(FORGE, "projects"))) {
      const j = readJson(path.join(FORGE, "projects", p, "project.json"));
      if (j) out[p] = { idea: j.idea, status: j.status, created: j.created, shots: (j.shots || []).length, keyframes: (j.keyframes || []).length, videos: (j.videos || []).length };
    }
    return out;
  },
  "/api/projects/novel": () => {
    const out = {};
    for (const p of listDir(path.join(FORGE, "novel_projects"))) {
      const s = readJson(path.join(FORGE, "novel_projects", p, "state.json"));
      if (s) out[p] = s;
    }
    return out;
  },
  // 设置：GET 读 / POST 写
  "/api/settings": async (q, req, res) => {
    if (req.method === "POST") {
      const body = await readBody(req);
      const cur = readJson(SETTINGS_FILE, {}) || {};
      const apiBase = body.apiBase !== undefined ? String(body.apiBase || "").trim() : String(cur.apiBase || "");
      if (apiBase && !/^https?:\/\//i.test(apiBase)) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "apiBase 必须为空或以 http:// / https:// 开头" }));
      }
      const next = {
        apiBase,
        apiKey: body.apiKey !== undefined ? body.apiKey : cur.apiKey,
        model: body.model ?? cur.model ?? "agnes-3.0-flash",
      };
      saveSettings(next);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ ok: true, saved: { apiBase: next.apiBase, model: next.model, hasKey: !!next.apiKey } }));
    }
    // GET：脱敏返回（不回传完整 key）
    const cur = readJson(SETTINGS_FILE, {}) || {};
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({
      apiBase: cur.apiBase || process.env.AGNES_API_BASE || "",
      model: cur.model || process.env.AGNES_MODEL || "agnes-3.0-flash",
      hasKey: !!(cur.apiKey || process.env.AGNES_API_KEY),
      keyTail: (cur.apiKey || process.env.AGNES_API_KEY || "").slice(-4),
      source: cur.apiKey || cur.apiBase ? "settings.json" : "env",
    }));
  },
  // 方案生成：优先 LLM，未配置/失败回退本地
  "/api/generate": async (q) => {
    const kw = (q.get("idea") || "").trim();
    const plans = readJson(path.join(FORGE, "knowledge/plans.json"), []);
    const pool = Array.isArray(plans) ? plans : Object.values(plans);
    const kwLow = kw.toLowerCase();
    const tokens = kwLow.split(/\s+/).filter(Boolean);
    const local = pool.map(p => {
      const hay = JSON.stringify(p).toLowerCase();
      const hit = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0) + (kw && hay.includes(kwLow) ? 2 : 0);
      return { plan: p, hit };
    }).sort((a, b) => b.hit - a.hit).slice(0, 3).map(x => x.plan);

    const c = llmCfg();
    if (c.apiBase && c.apiKey && kw) {
      try {
        const msgs = [
          { role: "system", content: "你是游戏/短剧/小说创意策划。给一句话思路，输出 3 个差异化方案。每个方案含 name/genre/one_liner/core_loop/mechanics(2-3条)/monetization/mvp_scope。每个字段 1 句话，简洁。只输出 JSON 数组。" },
          { role: "user", content: "思路：" + kw + "\n参考已有方案池：" + JSON.stringify(local.map(p => p.name || p.id)) },
        ];
        const txt = await llmChat(msgs, 800);
        const m = txt.match(/\[[\s\S]*\]/);
        const arr = m ? JSON.parse(m[0]) : JSON.parse(txt);
        return { mode: "llm", idea: kw, model: c.model, candidates: Array.isArray(arr) ? arr.slice(0, 3) : [arr] };
      } catch (e) {
        return { mode: "local-fallback", idea: kw, llmError: String(e.message || e), candidates: local };
      }
    }
    return { mode: "local-fallback", idea: kw, candidates: local };
  },
  // 分步向导：某要素的本地 3 候选（LLM 不可用时的回退）+ LLM 在线时按领域生成候选（附 1 句解释）
  "/api/steps": async (q) => {
    const key = q.get("key") || "";
    const ctx = q.get("ctx") || ""; // 已选定的前置要素 JSON 串
    const domain = q.get("domain") || "game";
    const elsApi = API["/api/domainElements"];
    const dinfo = elsApi({ get: (k) => k === "domain" ? domain : null });
    const els = dinfo.elements || [];
    const el = els.find(x => x.key === key) || els[0];
    if (!el) return { key, name: key, kind: "text", local: [], explain: "" };
    const plans = readJson(path.join(FORGE, "knowledge/plans.json"), []);
    const games = readJson(path.join(FORGE, "knowledge/games.json"), []);
    const styles = readJson(path.join(FORGE, "knowledge/styles.json"), []);
    const styleList = Array.isArray(styles) ? styles : Object.values(styles);
    let local = [];
    const grab = (v) => (v == null ? "" : Array.isArray(v) ? v.join("、") : (typeof v === "object" ? JSON.stringify(v) : String(v))).trim();
    if (domain === "game") {
      if (el.key === "idea") local = games.slice(0, 3).map(g => "《" + g.name + "》" + grab(g.genre) + "：" + grab(g.mechanics || g.one_liner)).filter(Boolean);
      else if (el.key === "similar_game") local = games.slice(0, 3).map(g => g.name + "（" + grab(g.genre) + "）：" + grab(g.borrow)).filter(Boolean);
      else if (el.key === "genre") local = [...new Set([...plans.map(p => p.genre), ...games.map(g => g.genre)])].filter(Boolean).slice(0, 3);
      else if (el.key === "core_loop") local = plans.slice(0, 3).map(p => grab(p.core_loop)).filter(Boolean);
      else if (el.key === "numbers") local = plans.slice(0, 3).map(p => grab(p.numbers)).filter(Boolean);
      else if (el.key === "mvp_scope") local = plans.slice(0, 3).map(p => grab(p.mvp_scope)).filter(Boolean);
      else if (el.key === "monetization") local = plans.slice(0, 3).map(p => grab(p.monetization)).filter(Boolean);
      else if (el.key === "style" || el.key === "art_style" || el.key === "美工风格") local = styleList.slice(0, 3).map(s => s.name + "：" + grab(s.art_style) + "（" + grab(s.mood) + "）").filter(Boolean);
      else if (el.key === "mechanics" || el.key === "pillars") local = plans.slice(0, 3).map(p => grab(p.mechanics)).filter(Boolean);
      else local = plans.slice(0, 3).map(p => grab(p[el.key]) || (p.name ? (p.name + "：" + grab(p.one_liner)) : "")).filter(Boolean);
    } else if (domain === "novel") {
      // 本地书素材：风格 DNA / 节奏 / 钩子
      const snip = (p) => { try { const t = fs.readFileSync(path.join(WS, p), "utf8"); const lines = t.split("\n").filter(l => l.trim()); return lines.slice(0, 6).join(" ").slice(0, 160); } catch { return ""; } };
      const dna1 = snip("tomato/books/dianxiao/style-dna.md");
      const dna2 = snip("tomato/books/moshu30/style-dna.md");
      const st = readJson(path.join(WS, "tomato/books/72/state.json"), {}) || {};
      const novelP = readJson(path.join(FORGE, "novel_projects/都市重生爽文-996程序员猝死后回到2019-带/state.json"), {}) || {};
      const map = {
        genre: ["都市重生(番茄日更4000字)", "末世求生(职场梗×生存)", "悬疑慢热(长线伏笔)"],
        platform: ["番茄·爽文快节奏", "起点·稳健体系流", "晋江·女频细腻"],
        tone: ["爽主打(每章兑现1爽点)", "燃压交替(压抑≤2章必爆)", "泪点克制(20章≤1泪)"],
        protagonist: ["周然:嘴上怂心里精,职场管理流,口癖「编制」「末位淘汰」", "忠义/皮特:先算账再动手,吐槽锚点=上辈子后勤处长", "自定义主角(身份+金手指+缺陷)"],
        hook: ["第1章开场冲突直接进(0-300字入冲突)", "重生回档+金手指展示", "强钩章末150字(钩子与上章不同式)"],
        pacing: ["单章2000-2500字+日更", "压抑章≤2+第2章末必爆", "高潮每5章一次+爽点密度≥1/章"],
        style_dna: [dna1 ? "学习 dianxiao：" + dna1.slice(0, 100) : "dianxiao 风格DNA(视角/句法/节奏)", dna2 ? "学习 moshu30：" + dna2.slice(0, 100) : "moshu30 风格DNA(打卡机意象/职场梗)", "混合多书DNA(按平台调)"],
        arc: ["3卷×10万:开局立势→中期升级→终局翻盘", "按事件弧切(每弧1大冲突)", "卷末钩+伏笔引爆"],
        foreshadow: ["埋设/引爆成对(账本追踪)", "长线3条+短线每卷2条", "延迟回报(≥20章后兑现)"],
        word_count: ["20万(60章,完结)", "30万(120章,里程碑80/120)", "50万+(长线连载)"],
        mvp: ["首更3章(立世界观+主角+钩)", "首更5章(加1次小高潮)", "先出完整大纲+前3章再开更"],
      };
      local = (map[el.key] || []).slice(0, 3);
    } else if (domain === "video") {
      // 短剧/视频本地项目
      const projs = (function () {
        const out = [];
        listDir(path.join(FORGE, "projects")).forEach(d => {
          const p = readJson(path.join(FORGE, "projects", d, "project.json"), null);
          if (p && p.card) out.push({ name: d, card: p.card, chars: p.characters });
        });
        return out;
      })();
      const grabCard = (i) => projs[i] ? (projs[i].card.title || projs[i].name) + "（" + grab(projs[i].card.duration_sec) + "s " + grab(projs[i].card.aspect) + " " + grab(projs[i].card.visual_style) + "）" : "";
      const map = {
        content_type: projs.map(p => p.card.content_type || p.name).filter(Boolean).slice(0, 3),
        hook: projs.map(p => "前3秒:" + (p.card.synopsis || p.name)).filter(Boolean).slice(0, 3),
        shots: ["自动4-6镜(快切)", "6-10镜(有留白反转)", "12镜+(长叙事)"],
        characters: projs.map(p => { const cs = (p.characters && p.characters.characters) || []; return cs.length ? cs.slice(0, 3).map(c => c.name).join("、") : "自定义角色"; }).filter(Boolean).slice(0, 3),
        dialogue: ["短密有回镖(一句顶三句)", "官腔反差(嘴上滑心里精)", "冷幽默+留白"],
        visual_style: projs.map(p => p.card.visual_style || "").filter(Boolean).slice(0, 3).concat(["像素复古", "电影感写实"]).slice(0, 3),
        duration: ["6s(强钩+单反转)", "15s(3镜叙事)", "30s/60s(完整小剧)"],
        audio: ["节奏BGM+钩子点音效", "反转点留白0.5s", "冷幽默配轻快"],
        cta: ["结尾引导关注", "广告片口播CTA", "无(纯剧情)"],
        mvp: projs.map(p => "复刻「" + p.name + "」分镜").filter(Boolean).slice(0, 3),
      };
      local = (map[el.key] || []).filter(Boolean).slice(0, 3);
    }
    // LLM 增强（在线时）：按领域生成 3 个差异化候选，每个附 1 句解释（带 429 退避 + reroll 换一批）
    const c = llmCfg();
    let mode = "local-fallback";
    let llmError = "";
    let explain = ""; // LLM 对本步的总结解释
    const role = domain === "game" ? "游戏策划" : domain === "novel" ? "网文策划" : "短视频策划";
    const reroll = q.get("reroll") === "1" || q.get("reroll") === "true";
    const avoid = q.get("avoid") || ""; // 上一批候选（reroll 时排除）
    if (c.apiBase && c.apiKey && el.kind !== "text" && !el.key.startsWith("idea")) {
      try {
        let sys = "你是" + role + "。为「" + el.name + "」生成 3 个差异化候选值，参考上下文：" + (ctx || "（无前文）") + "。输出格式：每行一个候选，候选后接 ｜ 一句话解释为什么选它。共 3 行，不要其他说明。";
        if (reroll && avoid) sys += " 注意：必须与上一批完全不同（上一批：" + avoid + "），换不同角度重新生成。";
        const t0 = Date.now();
        const txt = await llmChat([{ role: "system", content: sys }, { role: "user", content: (reroll ? "重新生成 3 个不同的候选（与上一批不同）" : "生成 3 个候选") }], 400);
        const lines = txt.split(/\n+/).map(s => s.replace(/^\s*[\d\.\)、（]\s*/, "").replace(/^候选\s*\d+\s*[:：]\s*/, "").trim()).filter(Boolean).slice(0, 3);
        if (lines.length) {
          local = lines; mode = "llm";
          explain = (reroll ? "重新生成" : "LLM 按「" + el.name + "」结合前文生成") + "了 3 个差异化候选（" + Math.round((Date.now() - t0) / 1000) + "s）；每个候选后「｜」后是 1 句选择理由，可自写覆盖。";
        } else { llmError = "LLM 返回空内容（" + Math.round((Date.now() - t0) / 1000) + "s），已回退本地素材"; }
      } catch (e) {
        mode = "local-fallback"; llmError = String(e.message || e);
        explain = local.length ? "LLM 不可用（" + llmError.slice(0, 40) + "…），回退本地素材" + ((domain === "game" && local.length) ? "：plans/games/styles 库" : "：本地项目/书素材") : "LLM 不可用，且本地无候选";
        if (!local.length) local = domain === "game" ? plans.slice(0, 3).map(p => grab(p.one_liner) || p.name).filter(Boolean) : ["（本地无候选，请自写）"];
      }
    } else if (reroll && local.length) {
      // 离线 reroll：从本地候选池里换一批（排除 avoid 里的）
      const pool = local.slice();
      const avoidSet = new Set(avoid ? avoid.split("|||").filter(Boolean) : []);
      const fresh = pool.filter(x => !avoidSet.has(x));
      explain = "本地素材重新抽取" + (fresh.length ? "（避开上一批）" : "（池已尽，原样）");
      local = fresh.length ? fresh : pool;
      mode = "local-fallback";
    } else if (domain !== "game" && el.kind !== "text" && local.length) {
      explain = "本地素材候选：" + ((dinfo.local_sources || [])[0] || "本地库") + " 提取";
    }
    return { key: el.key, name: el.name, kind: el.kind, required: el.required, desc: el.desc, mode, llmError, explain, local: local.slice(0, 3), multi: el.kind === "pick" };
  },
  // 记录一条方案决策（append JSONL：全部分步方案 + 最终合成品）
  "/api/record": async (q, req, res) => {
    if (req.method !== "POST") return null;
    const body = await readBody(req);
    const rec = { ts: new Date().toISOString(), ...body };
    const DIR = path.join(__dirname, "records");
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(path.join(DIR, "plans.jsonl"), JSON.stringify(rec) + "\n");
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, ts: rec.ts }));
  },
  "/api/records": () => {
    const p = path.join(__dirname, "records", "plans.jsonl");
    let lines = [];
    try { lines = fs.readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { }
    // 倒序 + 上限 500 条（防 jsonl 无限增长拖垮页面）
    return lines.reverse().slice(0, 500);
  },
  // 资产实时查看：图片（png/jpg/webp）直接出二进制。root=vault（默认）/books/out/projects/novel_projects
  "/api/asset-preview": (q, req, res) => {
    const rel = q.get("path") || "";
    const root = q.get("root") || "vault";
    const roots = { vault: path.join(FORGE, "vault"), books: path.join(TOMATO, "books"), out: path.join(FORGE, "out"), projects: path.join(FORGE, "projects"), novel_projects: path.join(FORGE, "novel_projects") };
    const base = roots[root] || roots.vault;
    const fp = path.resolve(base, rel);
    if (!fp.startsWith(base + path.sep)) { res.writeHead(403); return res.end("forbidden"); }
    const ext = path.extname(fp).toLowerCase();
    const ok = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
    if (!ok || !fs.existsSync(fp)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found: " + rel); }
    const ct = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
    const buf = fs.readFileSync(fp);
    res.writeHead(200, { "content-type": ct, "cache-control": "no-store" });
    return res.end(buf);
  },
  // 资产实时查看：文档（md/json/text/csv/html）出文本内容
  "/api/asset-text": (q) => {
    const rel = q.get("path") || "";
    const root = q.get("root") || "vault";
    const roots = { vault: path.join(FORGE, "vault"), books: path.join(TOMATO, "books"), out: path.join(FORGE, "out"), projects: path.join(FORGE, "projects"), novel_projects: path.join(FORGE, "novel_projects") };
    const base = roots[root] || roots.vault;
    const fp = path.resolve(base, rel);
    if (!fp.startsWith(base + path.sep)) return { error: "forbidden" };
    const ext = path.extname(fp).toLowerCase();
    const ok = [".md", ".json", ".txt", ".csv", ".html"].includes(ext);
    if (!ok || !fs.existsSync(fp)) return { error: "not found", path: rel };
    let text;
    try {
      text = ext === ".json" ? JSON.stringify(JSON.parse(fs.readFileSync(fp, "utf8")), null, 2)
        : ext === ".html" ? fs.readFileSync(fp, "utf8")
        : fs.readFileSync(fp, "utf8");
    } catch (e) { return { error: String(e.message) }; }
    return { path: rel, root, size: text.length, text: text.slice(0, 20000), truncated: text.length > 20000 };
  },
  // 资产浏览：按目录列文件（支持实时查看资产内容）。root=vault（默认）/books/out/projects/novel_projects
  "/api/assets": (q) => {
    const rel = q.get("path") || "";
    const root = q.get("root") || "vault";
    const roots = {
      vault: path.join(FORGE, "vault"),
      books: path.join(TOMATO, "books"),
      out: path.join(FORGE, "out"),
      projects: path.join(FORGE, "projects"),
      novel_projects: path.join(FORGE, "novel_projects"),
    };
    const base = roots[root] || roots.vault;
    const fp = path.resolve(base, rel);
    if (!fp.startsWith(base + path.sep)) return { error: "forbidden", root };
    const source_missing = !fs.existsSync(base);
    let entries = [];
    try {
      entries = fs.readdirSync(fp, { withFileTypes: true }).map(e => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
      }));
    } catch { }
    const IMG = [".png", ".jpg", ".jpeg", ".webp", ".gif"], DOC = [".md", ".json", ".txt", ".csv", ".html"];
    entries = entries.map(e => {
      const ext = path.extname(e.name).toLowerCase();
      return { ...e, preview: e.type === "file" ? (IMG.includes(ext) ? "image" : DOC.includes(ext) ? "text" : "other") : null };
    });
    return { path: rel, root, base: "game-forge/" + root, entries, source_missing, note: source_missing ? "数据源缺失（本仓库仅保留 asset-dashboard）：该目录为空属设计如此" : null };
  },
  // 本地素材/思路库（"学习本地思路"：按领域返回可引用的本地素材块）
  "/api/materials": (q) => {
    const domain = q.get("domain") || "game";
    const out = { domain, blocks: [], missing: [] };
    const relSrc = (p) => p.startsWith(WS + path.sep) ? p.slice(WS.length + 1).split(path.sep).join("/") : p;
    const rd = (p, name, tag) => {
      try { const t = fs.readFileSync(p, "utf8"); out.blocks.push({ name, tag, text: t.slice(0, 600), source: relSrc(p) }); } catch { out.missing.push(relSrc(p)); }
    };
    if (domain === "novel") {
      rd(path.join(WS, "tomato/books/dianxiao/style-dna.md"), "dianxiao 风格DNA", "视角/句法/修辞禁区/节奏基准/口癖");
      rd(path.join(WS, "tomato/books/moshu30/style-dna.md"), "moshu30 风格DNA", "职场梗×末世/打卡机意象");
      const ledg = path.join(WS, "tomato/books/dianxiao/canon/foreshadowing-ledger.md");
      rd(ledg, "dianxiao 伏笔账本", "埋设/引爆成对追踪");
      rd(path.join(WS, "game-forge/novel_projects/都市重生爽文-996程序员猝死后回到2019-带/state.json"), "长篇 state", "重生爽文 120 章进度");
    } else if (domain === "video") {
      const projDir = path.join(FORGE, "projects");
      if (!fs.existsSync(projDir)) out.missing.push(relSrc(projDir));
      listDir(projDir).forEach(d => {
        const p = readJson(path.join(FORGE, "projects", d, "project.json"), null);
        if (p) out.blocks.push({ name: d, tag: "短剧/视频项目", text: JSON.stringify(p.card || {}, null, 1).slice(0, 500) + "\n角色：" + JSON.stringify(((p.characters || {}).characters || []).map(c => c.name)), source: "game-forge/projects/" + d });
      });
    } else {
      const kp = path.join(FORGE, "knowledge/plans.json"), kg = path.join(FORGE, "knowledge/games.json"), ks = path.join(FORGE, "knowledge/styles.json"), ka = path.join(FORGE, "vault/art-assets");
      for (const p of [kp, kg, ks, ka]) if (!fs.existsSync(p)) out.missing.push(relSrc(p));
      const plans = readJson(kp, []);
      out.blocks.push({ name: "完整方案库", tag: "plans.json×" + plans.length, text: plans.map(p => (p.name || p.id) + "：" + grab0(p.one_liner)).join("\n").slice(0, 600), source: "game-forge/knowledge/plans.json" });
      const gms = readJson(path.join(FORGE, "knowledge/games.json"), []);
      out.blocks.push({ name: "相似游戏库", tag: "games.json×" + gms.length, text: gms.slice(0, 6).map(g => g.name + "（" + (g.genre || "") + "）借鉴：" + grab0(g.borrow)).join("\n").slice(0, 400), source: "game-forge/knowledge/games.json" });
      const st = readJson(ks, []);
      const sl = Array.isArray(st) ? st : Object.values(st);
      out.blocks.push({ name: "美工风格库", tag: "styles×" + sl.length, text: sl.map(s => s.name + "：" + grab0(s.art_style)).join("\n").slice(0, 400), source: "game-forge/knowledge/styles.json" });
      out.blocks.push({ name: "素材资产", tag: fs.existsSync(ka) ? "vault art-assets" : "vault art-assets（缺失）", text: "extracted_art+pixel-assets，可在实现时直接引用", source: "game-forge/vault/art-assets" });
    }
    function grab0(v) { return v == null ? "" : Array.isArray(v) ? v.join("、") : (typeof v === "object" ? JSON.stringify(v) : String(v)); }
    return out;
  },
  // 重新解析本地库（跑 gen-asset-tags.mjs）
  "/api/tags/refresh": (q, req, res) => {
    if (req.method !== "POST" && req.method !== "GET") return null;
    try {
      const out = execSync("node " + JSON.stringify(path.join(__dirname, "gen-asset-tags.mjs")) + " --force", { timeout: 60000, encoding: "utf8" });
      const doc = readJson(path.join(__dirname, "knowledge/asset-tags.json"), {});
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ ok: true, counts: doc.counts, log: out.trim().slice(0, 200) }));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
  },
  // 可机读标签检索：/api/tags/search?q=&domain=&type=&algo=
  "/api/tags/search": (q) => {
    const doc = readJson(path.join(__dirname, "knowledge/asset-tags.json"), { entries: [] });
    const entries = doc.entries || [];
    const kw = (q.get("q") || "").trim().toLowerCase();
    const dom = q.get("domain") || "";
    const typ = q.get("type") || "";
    const algoName = q.get("algo") || "";
    const norm = (s) => String(s || "").toLowerCase();
    let out = entries.filter(e => {
      if (dom && e.domain !== dom) return false;
      if (typ && e.type !== typ) return false;
      if (algoName) {
        // 定位"同类功能算法"：按 algo.name 或标签匹配，返回合并后的变体
        const hit = (e.algo && norm(e.algo.name).includes(norm(algoName))) ||
          (e.tags || []).some(t => norm(t).includes(norm(algoName))) ||
          norm(e.title).includes(norm(algoName));
        if (!hit) return false;
      }
      if (kw) {
        const hay = norm((e.title || "") + " " + (e.tags || []).join(" ") + " " + (e.id || "") + " " + flat2(e.mechanics) + " " + (e.algo ? flat2(e.algo) : ""));
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    return { total: out.length, entries: out.slice(0, 60), schema: doc._schema };
    function flat2(v) { return v == null ? "" : Array.isArray(v) ? v.join(" ") : (typeof v === "object" ? JSON.stringify(v) : String(v)); }
  },
  // 上传/解析新资产：文本内容 → LLM 提取结构化标签（机读格式）→ 写入 asset-tags.json
  "/api/tags/parse": async (q, req, res) => {
    if (req.method !== "POST") return null;
    const body = await readBody(req);
    const text = body.text || "";
    const domain = body.domain || "cross";
    const source = body.source || "upload";
    if (!text.trim()) return { ok: false, error: "empty text" };
    const c = llmCfg();
    let tags = [], kind = "doc", title = source, algo = null;
    // 无 LLM 时走规则提取（保底）
    const ruleTags = (t) => {
      const out = [];
      if (/数值|波次|掉率|概率/.test(t)) out.push("数值");
      if (/机制|玩法|循环/.test(t)) out.push("机制");
      if (/合成|升阶|融合/.test(t)) out.push("合成升阶");
      if (/塔防|防守/.test(t)) out.push("塔防");
      if (/广告|变现|IAA|IAP/.test(t)) out.push("变现");
      if (/风格|配色|画风/.test(t)) out.push("风格");
      return out;
    };
    if (c.apiBase && c.apiKey) {
      try {
        const prompt = JSON.stringify({
          role: "你是资产标签解析器。从给定文本提取结构化标签（机读格式），输出 JSON：{title, domain, kind, tags:[...], algo:{name,purpose,inputs,outputs,variants,reuse_in}|null, reusable:true}。kind 取 image|doc|style|plan|game|script|state|algorithm。algo 仅当文本描述了可复用的功能/算法（如合成、波次生成、数值配平）时填，同类功能应给出通用 name。只输出 JSON。",
          user: "domain=" + domain + " source=" + source + " 文本：\n" + text.slice(0, 4000),
        });
        const txt = await llmChat([
          { role: "system", content: prompt },
          { role: "user", content: text.slice(0, 4000) },
        ], 800);
        const m = txt.match(/\{[\s\S]*\}/);
        const j = m ? JSON.parse(m[0]) : {};
        title = j.title || title;
        tags = j.tags || [];
        algo = j.algo || null;
        kind = j.kind || kind;
      } catch (e) { tags = ruleTags(text); }
    } else { tags = ruleTags(text); }
    // 写入 asset-tags.json
    const doc = readJson(path.join(__dirname, "knowledge/asset-tags.json"), { _schema: "asset-dashboard/asset-tags@1", entries: [] });
    const id = "parsed:" + Date.now();
    doc.entries.push({
      id, type: algo ? "algo" : "asset", domain, kind, title,
      source: source + "（解析于 " + new Date().toLocaleString("zh-CN") + "）",
      tags: [...new Set(tags.concat(algo ? [algo.name] : []))],
      algo: algo || undefined, raw: text.slice(0, 1000),
      reusable: true, refs: [], created: new Date().toISOString(), origin: "external",
    });
    doc.generated_at = new Date().toISOString();
    fs.writeFileSync(path.join(__dirname, "knowledge/asset-tags.json"), JSON.stringify(doc, null, 1));
    return { ok: true, id, title, tags, algo, kind };
  },
  // 复用定位：按 algo.name 找"同类功能"，返回合并变体 + 可用于哪些资产
  "/api/tags/reuse": (q) => {
    const algoName = q.get("algo") || "";
    const doc = readJson(path.join(__dirname, "knowledge/asset-tags.json"), { entries: [] });
    const hits = (doc.entries || []).filter(e =>
      (e.algo && norm2(e.algo.name).includes(norm2(algoName))) ||
      (e.tags || []).some(t => norm2(t).includes(norm2(algoName))));
    // 按 algo.name 合并
    const byName = {};
    hits.forEach(e => {
      const k = (e.algo && e.algo.name) || e.title;
      (byName[k] = byName[k] || { name: k, variants: [], sources: [], reuse_in: [], purpose: e.algo?.purpose || e.title }).variants.push(e.id);
      byName[k].sources.push(e.source);
      if (e.algo?.variants) byName[k].reuse_in.push(...e.algo.variants);
      if (e.algo?.reuse_in) byName[k].reuse_in.push(...e.algo.reuse_in);
    });
    return { algo: algoName, merged: Object.values(byName), total: hits.length };
    function norm2(s) { return String(s || "").toLowerCase(); }
  },
  // 工程级索引：列出所有工程（游戏/小说/短剧）+ 每项的标签（机读，来自 asset-tags.json 或现场提取）
  "/api/projects-index": (q) => {
    const domain = q.get("domain") || "";
    const doc = readJson(path.join(__dirname, "knowledge/asset-tags.json"), { entries: [] });
    const byId = {};
    (doc.entries || []).forEach(e => { byId[e.id] = e; });
    const out = [];
    // 游戏 out/ 生成产物
    const outDir = path.join(FORGE, "out");
    if (fs.existsSync(outDir)) {
      fs.readdirSync(outDir, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory()) return;
        const t = byId["gameout:" + e.name];
        out.push({ id: "out/" + e.name, domain: "game", kind: "game-build", name: e.name, tags: t ? t.tags : [], source: "game-forge/out/" + e.name, files: safeListFiles(path.join(outDir, e.name)) });
      });
    }
    // 番茄书
    const booksDir = path.join(TOMATO, "books");
    if (fs.existsSync(booksDir)) {
      fs.readdirSync(booksDir, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory()) return;
        const t = byId["novel:" + e.name];
        out.push({ id: "book/" + e.name, domain: "novel", kind: "novel-book", name: e.name, tags: t ? t.tags : [], source: "tomato/books/" + e.name, files: safeListFiles(path.join(booksDir, e.name)) });
      });
    }
    // 长篇 novel_projects
    const npDir = path.join(FORGE, "novel_projects");
    if (fs.existsSync(npDir)) {
      fs.readdirSync(npDir, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory()) return;
        const t = byId["novelproj:" + e.name];
        out.push({ id: "novelproj/" + e.name, domain: "novel", kind: "novel-longform", name: e.name, tags: t ? t.tags : [], source: "game-forge/novel_projects/" + e.name, files: safeListFiles(path.join(npDir, e.name)) });
      });
    }
    // 短剧/视频 projects
    const vpDir = path.join(FORGE, "projects");
    if (fs.existsSync(vpDir)) {
      fs.readdirSync(vpDir, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory()) return;
        const t = byId["video:" + e.name];
        out.push({ id: "video/" + e.name, domain: "video", kind: "video-project", name: e.name, tags: t ? t.tags : [], source: "game-forge/projects/" + e.name, files: safeListFiles(path.join(vpDir, e.name)) });
      });
    }
    // 过滤 domain
    return { total: out.length, projects: domain ? out.filter(p => p.domain === domain) : out };
    function safeListFiles(dir) {
      try { return fs.readdirSync(dir, { withFileTypes: true }).map(f => f.name).slice(0, 40); } catch { return []; }
    }
  },
  // 持久化默认扫描根：GET 读当前配置；POST 保存绝对路径列表（受 SCAN_ROOTS_ALLOWED 白名单约束）
  "/api/scan-roots": async (q, req, res) => {
    if (req.method === "GET") {
      const roots = savedScanRoots();
      return { configured: roots.length > 0, roots, file: "scan-roots.json", note: roots.length ? "已保存默认扫描根：不带参数时 /api/local-scan 与 /api/dedup 将使用它们" : "尚未保存：默认使用 workspace 根（WS / game-forge / tomato）" };
    }
    const body = await readBody(req);
    const roots = (body && Array.isArray(body.roots)) ? body.roots.map(x => String(x).trim()).filter(Boolean) : [];
    if (!roots.length) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "roots 必须为非空数组" })); }
    for (const r of roots) {
      if (!path.isAbsolute(r)) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "扫描根必须是绝对路径: " + r })); }
      if (!fs.existsSync(r) || !fs.statSync(r).isDirectory()) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "扫描根不存在或不是目录: " + r })); }
    }
    const allowR = allowRoots();
    if (allowR.length) {
      const ok = roots.every(r => allowR.some(a => r === a || r.startsWith(a + path.sep)));
      if (!ok) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "扫描根超出 SCAN_ROOTS_ALLOWED 白名单" })); }
    }
    const resolved = [...new Set(roots.map(r => path.resolve(r)))];
    fs.writeFileSync(SCAN_ROOTS_FILE, JSON.stringify({ roots: resolved, updated_at: new Date().toISOString() }, null, 2));
    return { ok: true, count: resolved.length, roots: resolved };
  },
  // 资产去重分析（report-only，不移动/删除任何文件）：字节级完全重复 + 同名跨根嫌疑
  "/api/dedup": async (q) => {
    const rootsParam = (q.get("roots") || "").split(",").map(s => s.trim()).filter(Boolean);
    const saved = rootsParam.length ? [] : savedScanRoots();
    let roots = rootsParam.length ? rootsParam.map(r => path.resolve(r)) : (saved.length ? saved : [WS, FORGE, TOMATO]);
    roots = filterAllowed(roots).filter(r => fs.existsSync(r));
    const depth = Math.min(Number(q.get("depth")) || 6, 8);
    const r = await runDedup(roots, { depth, includeHidden: q.get("includeHidden") === "1" });
    r.source = rootsParam.length ? "param" : (saved.length ? "saved" : "default-workspace");
    return r;
  },
  // 一键本地扫描：递归整理指定根目录下的所有项目与资产，标出可分析项供创作者选择
  // 规则：识别项目（package.json/pyproject/project.json/state.json/index.html/server.mjs）、
  //       资产（png/jpg/webp/gl 计数）、文档；analyzable = 有可读入口或资产文件 >=10
  // 预设：preset=workspace（默认）/ home / all（全电脑）；可配 includeHidden、maxDepth
  "/api/local-scan": (q) => {
    let preset = q.get("preset") || "workspace";
    const depth = Math.min(Number(q.get("depth") || (preset === "all" ? 4 : 3)), 8);
    const includeHidden = q.get("includeHidden") === "1";
    const rootsParam = (q.get("roots") || "").split(",").map(s => s.trim()).filter(Boolean);
    let roots;
    if (rootsParam.length) roots = rootsParam.map(r => path.resolve(r));
    else if (preset === "home") {
      const home = process.env.HOME || process.env.USERPROFILE || path.resolve(".");
      roots = [home];
    } else if (preset === "all") {
      // 全电脑：按 OS 给默认根
      const home = process.env.HOME || process.env.USERPROFILE || "";
      if (process.platform === "win32") {
        roots = [];
        if (home) roots.push(home);
        for (const drv of ["C", "D", "E", "F"]) {
          try { fs.accessSync(drv + ":\\" ); roots.push(drv + ":\\" ); } catch {}
        }
        if (!roots.length) roots = ["C:\\"];
      } else {
        roots = ["/home", "/opt", "/srv", "/data"].filter(p => {
          try { fs.accessSync(p); return true; } catch { return false; }
        });
        if (home && !roots.some(r => home.startsWith(r))) roots.push(home);
        if (!roots.length) roots = [WS, FORGE, TOMATO];
      }
    } else {
      const saved = savedScanRoots();
      if (saved.length) { roots = saved; preset = "saved"; }
      else roots = [WS, FORGE, TOMATO];
    }
    // 公开部署安全：设 SCAN_ROOTS_ALLOWED（逗号分隔绝对路径）时，扫描根被限制在白名单内，防止本机任意目录枚举
    const allowR = (process.env.SCAN_ROOTS_ALLOWED || "").split(",").map(s => s.trim()).filter(Boolean).map(a => path.resolve(a));
    if (allowR.length) {
      roots = (roots || []).filter(r => allowR.some(a => r === a || r.startsWith(a + path.sep)));
      if (!roots.length) roots = allowR.slice();
    }
    const SKIP = new Set(["node_modules", ".git", "__pycache__", ".cache", "dist", "build", "profiles", "logs", "vault"]);
    const IMG = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".glb", ".fbx"];
    const DOC = [".md", ".txt", ".json", ".csv", ".html", ".py", ".mjs", ".js", ".ts"];
    const projMarkers = [
      ["package.json", "npm 项目"],
      ["pyproject.toml", "Python 包"],
      ["project.json", "短剧项目"],
      ["state.json", "连载/状态"],
      ["server.mjs", "本地服务"],
      ["index.html", "H5/页面"],
    ];
    // 扫描一个根：收集目录条目（不递归进 SKIP；深度限制；可选含隐藏目录）
    const results = [];
    const dirMap = new Map(); // relPath -> 资产统计
    const walk = (abs, rel, d) => {
      if (d > depth) return;
      let names = [];
      try { names = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
      // 本目录统计
      const rec = { name: path.basename(abs) || abs, path: rel || path.basename(abs), type: "unknown", files: 0, assets: 0, docs: 0, sizeMB: 0, tags: [], analyzable: false, analyze_hint: "", root: path.basename(roots.find(r => abs === r || abs.startsWith(r + path.sep)) || abs) };
      for (const e of names) {
        if (!includeHidden && e.name.startsWith(".")) continue;
        if (SKIP.has(e.name)) continue;
        const full = path.join(abs, e.name);
        let st;
        try { st = fs.statSync(full); } catch { continue; }
        if (st.isDirectory()) {
          walk(full, rel ? rel + "/" + e.name : e.name, d + 1);
        } else {
          const ext = path.extname(e.name).toLowerCase();
          rec.files++;
          rec.sizeMB += st.size / 1048576;
          if (IMG.includes(ext)) rec.assets++;
          else if (DOC.includes(ext)) rec.docs++;
        }
      }
      // 项目标记识别
      for (const [marker, tag] of projMarkers) {
        if (names.some(e => e.isFile() && e.name === marker)) {
          rec.type = "project";
          rec.tags.push(tag);
          rec.analyzable = true;
          rec.analyze_hint = "含 " + marker + "，可读取入口分析";
        }
      }
      if (rec.assets >= 10) { rec.type = rec.type === "unknown" ? "assets" : "mixed"; if (!rec.analyzable) { rec.analyzable = true; rec.analyze_hint = "含 " + rec.assets + " 个资产文件，可提取分析"; } }
      else if (rec.docs >= 5) { if (rec.type === "unknown") rec.type = "docs"; if (!rec.analyzable && rec.docs >= 15) { rec.analyzable = true; rec.analyze_hint = "含 " + rec.docs + " 个文档，可归纳总结"; } }
      else if (rec.type === "unknown") rec.type = "other";
      if (rec.files > 0) { rec.sizeMB = Math.round(rec.sizeMB * 10) / 10; dirMap.set(rec.path, rec); results.push(rec); }
    };
    for (const root of roots) {
      const base = path.basename(root) || root;
      walk(root, base, 0);
    }
    // 去重：按「规范化绝对路径前缀」过滤——某根包含另一根时，子根的重复条目丢弃
    const seenAbs = new Set();
    const dedup = results.filter(r => {
      const idx = roots.findIndex(rt => path.basename(rt) === (r.path.split("/")[0] || ""));
      const rt = idx >= 0 ? roots[idx] : roots[0];
      const abs = r.path === path.basename(rt) ? rt : path.join(rt, r.path.slice((path.basename(rt) + "/").length));
      const norm = path.resolve(abs);
      for (const p of seenAbs) if (norm.startsWith(p + path.sep)) return false;
      seenAbs.add(norm);
      return true;
    });
    // 按 analyzable 优先 + 类型排序
    dedup.sort((a, b) => (b.analyzable ? 1 : 0) - (a.analyzable ? 1 : 0) || a.path.localeCompare(b.path));
    // 按根分组
    const grouped = {};
    for (const r of dedup) {
      const g = r.root || "other";
      (grouped[g] = grouped[g] || []).push(r);
    }
    const out = {
      preset,
      roots: (roots || []).map(r => path.basename(r) || r),
      scanned_at: new Date().toISOString(),
      total: dedup.length,
      analyzable: dedup.filter(r => r.analyzable).length,
      byType: dedup.reduce((m, r) => (m[r.type] = (m[r.type] || 0) + 1, m), {}),
      items: dedup,
      grouped,
      options: { depth, includeHidden, preset, roots: (roots || []).map(r => path.basename(r) || r), abs_roots: (roots || []).map(r => path.resolve(r)) },
    };
    // 字段完整性兜底：任何情况下都保证前端所需字段存在
    out.total = out.total || 0;
    out.analyzable = out.analyzable || 0;
    out.byType = out.byType || {};
    out.items = out.items || [];
    out.grouped = out.grouped || {};
    out.options = out.options || { depth, includeHidden, preset };
    return out;
  },

  // 导出给 agent（DSH / Codex）的实现包：markdown + 精简 JSON（按领域切指令模板）
  "/api/export": async (q, req, res) => {
    if (req.method !== "POST") return null;
    const body = await readBody(req);
    const idea = body.idea || "";
    const choices = body.choices || {};
    const steps = body.steps || [];
    const domain = body.domain || "game";
    const elDefs = ((readJson(path.join(__dirname, "knowledge/domains.json"), { domains: {} }).domains || {})[domain] || {}).elements || [];
    const nameOf = (k) => ((elDefs.find(e => e.key === k) || {}).name) || k;
    // 领域化 agent 指令模板
    const agentInstructions = {
      game: [
        "1. 平台：单文件 HTML（Canvas + 原生 JS，无构建），桌面 Chrome 60fps。",
        "2. 严格采用规格中的核心循环/胜负条件/数值/内容规模/MVP 范围，不要自增玩法。",
        "3. 先输出实现计划（模块拆分 + 文件清单 + 风险点），待确认后再写完整可运行代码。",
        "4. 数值表/波次表/道具池以规格中对应字段为准；缺口处给保守默认并标注 ASSUMPTION。",
        "5. 交付：单个 .html（含说明注释）+ 一段 3 行以内的玩法说明。",
      ],
      novel: [
        "1. 先写完整大纲（卷/弧/章切分 + 每章一行事件），再写前 3 章全文。",
        "2. 单章字数/节奏/钩子频率严格按规格中的节奏字段，风格参考「风格 DNA 参考」项指向的本地 style-dna。",
        "3. 前 3 章必须兑现规格中的「开篇钩子」，章末 150 字内留强钩。",
        "4. 人物口癖/修辞禁区照风格 DNA 执行，不堆辞藻。",
        "5. 交付：outline.md（大纲）+ ch1-ch3.md + style-dna-reference.md（引用的本地风格要点摘录）。",
      ],
      video: [
        "1. 先出脚本（逐镜：镜号/画面/台词/时长/音效点），再出分镜描述。",
        "2. 前 3 秒必须兑现规格中的「开场钩子」；反转/CTA 点位按规格。",
        "3. 台词调性严格按规格；角色口癖保持一致。",
        "4. 视觉风格/BGM 按规格；缺口给保守默认并标注 ASSUMPTION。",
        "5. 交付：script.md（逐镜脚本）+ keyframes 描述 + 3 行以内成片说明。",
      ],
    }[domain] || [ "1. 按 JSON 规格实现，缺口标 ASSUMPTION。" ];
    const domLabel = { game: "游戏", novel: "小说", video: "短剧视频" }[domain] || domain;
    const spec = {
      _schema: "asset-dashboard/agent-spec@" + domain + "@1",
      domain,
      idea,
      elements: steps.filter(s => s.type === "step").map(s => ({ key: s.el, value: s.choice, source: s.source })),
      final: { idea, domain, ...choices },
      generated_at: new Date().toISOString(),
    };
    const stepLines = steps.filter(s => s.type === "step").map(s =>
      "- **" + nameOf(s.el || s.key) + "**（" + (s.source || "候选") + "）：" + String(s.choice || "")).join("\n");
    const md = [
      "# " + domLabel + "创作规格 — 给 DSH / Codex 等 agent",
      "",
      "> 来源：asset-dashboard 分步生成向导（" + domLabel + "） · 生成于 " + new Date().toLocaleString("zh-CN"),
      "> 用途：把本文件整体交给 DSH 或 Codex，按规约创作。",
      "",
      "## 1. 一句话思路",
      idea || "（未填写）",
      "",
      "## 2. 分步敲定的要素",
      stepLines || "（无分步记录）",
      "",
      "## 3. 最终合成品",
      JSON.stringify(spec.final, null, 2),
      "",
      "## 4. 机器可读规格（JSON）",
      "```json",
      JSON.stringify(spec, null, 2),
      "```",
      "",
      "## 5. 给 agent 的指令（" + domLabel + "）",
      agentInstructions.join("\n"),
    ].join("\n");
    const DIR = path.join(__dirname, "records");
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, "agent-spec-latest.json"), JSON.stringify(spec, null, 2));
    fs.writeFileSync(path.join(DIR, "agent-prompt-latest.md"), md);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, domain, markdown: md, spec, files: ["records/agent-prompt-latest.md", "records/agent-spec-latest.json"] }));
  },
  // ============ agent 接入端点 ============
  // 能力发现：外部 Codex/DSH 读此注册表即可接入（端点 / 资产库 / 数据源 / 认证 / 闭环）
  "/api/agent/manifest": (q, req, res) => {
    if (!agentAuthOk(req, res)) return null;
    const c = llmCfg();
    const tags = readJson(path.join(__dirname, "knowledge/asset-tags.json"), { entries: [] });
    const counts = (tags.entries || []).reduce((m, e) => (m[e.type] = (m[e.type] || 0) + 1, m), {});
    const st = sourceStatus();
    const roots = savedScanRoots();
    const auth = agentAuthCfg();
    const base = (req.headers["x-forwarded-proto"] ? req.headers["x-forwarded-proto"] + "://" : (req.socket.secure ? "https://" : "http://")) + (req.headers.host || "127.0.0.1:7800");
    const tools = [
      { tool: "health", method: "GET", endpoint: "/api/health", desc: "探活 + LLM 在线状态" },
      { tool: "agent_manifest", method: "GET", endpoint: "/api/agent/manifest", desc: "本注册表（能力发现）" },
      { tool: "agent_plan", method: "POST", endpoint: "/api/agent/plan", params: "requirement/domain?/game?/context?", desc: "需求 → 可执行方案（机读 plan）" },
      { tool: "agent_plan_get", method: "GET", endpoint: "/api/agent/plan", params: "plan_id?", desc: "取回方案（缺省=最近一次）" },
      { tool: "tags_search", method: "GET", endpoint: "/api/tags/search", params: "q/domain/type/algo", desc: "资产/算法知识库检索" },
      { tool: "tags_reuse", method: "GET", endpoint: "/api/tags/reuse", params: "algo", desc: "同类算法定位与变体合并" },
      { tool: "materials", method: "GET", endpoint: "/api/materials", params: "domain", desc: "本地素材块（含缺失列表）" },
      { tool: "domain_elements", method: "GET", endpoint: "/api/domainElements", params: "domain", desc: "领域要素序列 + agent 提示" },
      { tool: "projects_index", method: "GET", endpoint: "/api/projects-index", params: "domain?", desc: "工程级索引" },
      { tool: "local_scan", method: "GET", endpoint: "/api/local-scan", params: "preset/roots/depth/includeHidden", desc: "本地目录扫描与项目识别" },
      { tool: "dedup", method: "GET", endpoint: "/api/dedup", params: "roots/depth/includeHidden", desc: "资产去重分析（report-only）" },
      { tool: "scan_roots", method: "GET+POST", endpoint: "/api/scan-roots", desc: "持久化默认扫描根" },
      { tool: "record", method: "POST", endpoint: "/api/record", desc: "记录方案决策/执行结果（append JSONL）" },
      { tool: "records", method: "GET", endpoint: "/api/records", desc: "最近 500 条记录" },
      { tool: "tags_parse", method: "POST", endpoint: "/api/tags/parse", params: "text/domain/source", desc: "新资产 → LLM 提取标签 → 写入知识库" },
      { tool: "tags_refresh", method: "POST", endpoint: "/api/tags/refresh", desc: "重新解析本地库（跑 gen-asset-tags.mjs --force）" },
      { tool: "export", method: "POST", endpoint: "/api/export", desc: "导出 agent 实现包（markdown + JSON spec）" },
      { tool: "asset_preview", method: "GET", endpoint: "/api/asset-preview", params: "path/root", desc: "图片二进制实时预览" },
      { tool: "asset_text", method: "GET", endpoint: "/api/asset-text", params: "path/root", desc: "文档文本读取（≤20KB）" },
      { tool: "asset_browser", method: "GET", endpoint: "/api/assets", params: "path/root", desc: "目录浏览" },
    ];
    return {
      _schema: "asset-dashboard/agent-manifest@1",
      project: "asset-dashboard",
      generated_at: new Date().toISOString(),
      connect: {
        base_url: base,
        health: "/api/health",
        auth: { mode: auth.mode, header: "x-agent-token", token_source: auth.source, note: auth.mode === "token" ? "公开部署已启用 token：所有 /api/agent/* 需 x-agent-token 头" : "本机开放模式：未设 AGENT_TOKEN，/api/agent/* 无鉴权" },
      },
      llm: { online: !!(c.apiBase && c.apiKey), model: c.model, apiBase: c.apiBase || "(未配置)" },
      domains: (readJson(path.join(__dirname, "knowledge/domains.json"), { domains: {} }).domains || {}),
      asset_library: { total_entries: (tags.entries || []).length, counts, file: "knowledge/asset-tags.json" },
      data_sources: st,
      scan_roots: roots,
      agent_local: agentLocalTools(),
      loop: [
        "1. GET /api/agent/manifest（能力发现）",
        "2. POST /api/agent/plan {requirement, domain?, game?, context?} → 机读方案",
        "3. 本地执行 plan.execution.tasks（T2I 生图 / 去重 / 功能实现）",
        "4. POST /api/record {plan_id, result} 回传结果；新素材 POST /api/tags/parse 登记知识库",
      ],
      tools,
    };
  },
  // 需求 → 可执行方案：matched_assets（复用现有）+ execution.tasks（新增：T2I/去重/回传）
  "/api/agent/plan": async (q, req, res) => {
    if (!agentAuthOk(req, res)) return null;
    // GET：取回方案（plan_id 或最近一次）
    if (req.method === "GET") {
      const dir = path.join(__dirname, "records");
      const want = q.get("plan_id") || "";
      let files;
      if (want) files = [want + ".json"];
      else files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith("plan-") && f.endsWith(".json")).sort().reverse() : [];
      for (const f of files) {
        const p = path.join(dir, f);
        if (!fs.existsSync(p)) continue;
        const j = readJson(p, null);
        if (j && j.plan) return { ok: true, plan: j.plan, file: f };
      }
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: want ? "plan not found: " + want : "no saved plan yet" }));
    }
    if (req.method !== "POST") { res.writeHead(405, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "POST or GET only" })); }
    const body = await readBody(req);
    const requirement = String(body.requirement || "").trim();
    if (!requirement) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "requirement 不能为空" })); }
    const ctx = String(body.context || "");
    const fullText = requirement + " " + ctx;
    let game = String(body.game || "").trim();
    const domain = (["game", "novel", "video", "cross"].includes(String(body.domain || "").trim().toLowerCase())) ? String(body.domain).trim().toLowerCase() : inferAgentDomain(fullText);
    const isArt = artRequirementText(fullText);
    if (isArt && !game) game = "generic"; // 美术类需求缺 game 时落到通用桶，保证任务命令路径完整
    const category = isArt ? categorizeArt(fullText) : null;
    // 匹配现有资产
    const tags = readJson(path.join(__dirname, "knowledge/asset-tags.json"), { entries: [] });
    const kw = (requirement + " " + game + " " + ctx).toLowerCase();
    const matched = (tags.entries || [])
      .map(e => {
        const hay = JSON.stringify([e.title, e.tags, e.kind, e.algo]).toLowerCase();
        const hit = kw ? hay.split(" ").filter(t => t && kw.includes(t)).length : 0;
        return { ...e, _score: hit };
      })
      .filter(e => e._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 8)
      .map(({ _score, ...e }) => e);
    // 执行任务
    const tasks = [];
    const tools = agentLocalTools();
    const local = localGameDirs(game);
    if (isArt) {
      const cat = category || categorizeArt(fullText);
      const green = cat.key !== "ui";
      tasks.push({
        id: "T1-gen", step: 1, tool: "agnes_t2i", do: "生成美术素材（T2I）",
        action: "按 artPromptTemplates 生成 " + cat.label + "（" + game + "）",
        command: "python " + tools.t2i_tool + " batch <batch.json>",
        green_chroma: green,
        out_dir: "E:/codex/art-assets/" + cat.dir + "/" + game + "/",
        fallback: "Agnes 不可用时回退 Pollinations flux：https://image.pollinations.ai/prompt/<prompt>?width=1024&height=1024&model=flux&nologo=true&seed=N",
        assumed: tools.assumed,
      });
      if (green) tasks.push({
        id: "T2-chroma", step: 2, tool: "chroma_key", do: "绿幕母版 → 透明 PNG",
        command: "python " + tools.chroma_tool + " <src.png> <dst.png>",
        raw_dir: tools.raw_dir,
        note: "chroma=true 素材渲染 #00B140 绿底，驱动跑 chroma.py 得透明 PNG；绿底母版存 raw/",
        assumed: tools.assumed,
      });
      tasks.push({
        id: "T3-sync", step: 3, tool: "git_art_repo", do: "同步进私有 art-assets 仓并提交",
        command: "git -C " + tools.art_repo + " add -A && git -C " + tools.art_repo + " commit -m \"art(" + game + "): " + requirement.slice(0, 40) + "\"",
        only_add: "只增新文件，不覆盖既有美术",
        assumed: tools.assumed,
      });
      tasks.push({
        id: "T4-integrate", step: 4, tool: "game_ingest", do: "游戏项目 img/ 接入 + 冒烟",
        action: "把新素材拷入 " + game + " 的 img/ 目录（只增不覆盖），node --check 验证无语法错",
        command: "robocopy " + tools.art_repo + "\\" + cat.dir + "\\" + game + " <" + game + " 项目 img\\ 目录（见 local_dirs）> /E /XO  （/XO=不覆盖较旧文件，只增新素材）",
        local_dirs: local.dirs_found,
        local_assumed: !local.art_dir,
      });
      tasks.push({
        id: "T5-report", step: 5, tool: "report_back", do: "回传结果 + 登记知识库",
        action: "POST /api/record {plan_id, result} 记录执行；新素材 POST /api/tags/parse {text, domain:\"" + domain + "\", source:\"" + game + "\"} 登记",
        command: "curl -X POST <base_url>/api/record -H \"content-type: application/json\" -d '" + JSON.stringify({ plan_id: "<本方案 plan_id>", result: "…" }) + "'；新素材再 POST <base_url>/api/tags/parse '" + JSON.stringify({ text: "…", domain: domain, source: game }) + "'",
      });
    } else {
      // 非美术需求 → 领域方案（复用 plans/games/styles 知识库 + LLM 增强）
      tasks.push({
        id: "T1-plan", step: 1, tool: "domain_plan", do: "生成领域方案",
        action: "POST /api/generate?idea=" + encodeURIComponent(requirement) + "（LLM 在线时走模型，离线回退本地方案池）",
        command: "curl \"<base_url>/api/generate?idea=" + encodeURIComponent(requirement) + "\"",
        domain,
      });
      tasks.push({
        id: "T2-implement", step: 2, tool: "export_pack", do: "导出 agent 实现包并本地实现",
        action: "POST /api/export {idea:\"" + requirement + "\", domain:\"" + domain + "\", choices:{}, steps:[]} → 拿 markdown 实现包，按其中 agent 指令本地实现",
        command: "curl -X POST <base_url>/api/export -H \"content-type: application/json\" -d '" + JSON.stringify({ idea: requirement, domain: domain, choices: {}, steps: [] }) + "'",
      });
      tasks.push({
        id: "T3-report", step: 3, tool: "report_back", do: "回传结果",
        action: "POST /api/record {plan_id, domain, result} 记录",
        command: "curl -X POST <base_url>/api/record -H \"content-type: application/json\" -d '" + JSON.stringify({ plan_id: "<本方案 plan_id>", domain: domain, result: "…" }) + "'",
      });
    }
    const planId = "plan-" + Date.now().toString(36);
    const plan = {
      _schema: "asset-dashboard/agent-plan@1",
      plan_id: planId,
      created_at: new Date().toISOString(),
      requirement, domain, game: game || null, kind: isArt ? "art" : "feature",
      category: category ? category.key : null,
      llm: (() => { const c = llmCfg(); return { online: !!(c.apiBase && c.apiKey), model: c.model }; })(),
      matched_assets: matched,
      matched_assets_note: matched.length ? "从 knowledge/asset-tags.json 命中 " + matched.length + " 条，可先复用再决定新增" : "资产库无直接命中，需全新生成",
      local_game_dirs: local,
      execution: { tasks, tools: { source: tools.tools_source, assumed: tools.assumed, paths: { t2i_tool: tools.t2i_tool, t2i_retry: tools.t2i_retry, chroma_tool: tools.chroma_tool, art_repo: tools.art_repo, batch_dir: tools.batch_dir, raw_dir: tools.raw_dir } } },
      report_back: { record: "POST /api/record {plan_id:\"" + planId + "\", ...}", parse: "POST /api/tags/parse {text, domain, source}" },
    };
    const dir = path.join(__dirname, "records");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, planId + ".json"), JSON.stringify({ plan }, null, 2));
    fs.appendFileSync(path.join(dir, "agent-plans.jsonl"), JSON.stringify({ ts: plan.created_at, plan_id: planId, requirement, domain, kind: plan.kind, game: game || null }) + "\n");
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, plan }));
  },
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  const p = u.pathname;
  if (p.startsWith("/api/")) {
    const handler = API[p];
    if (!handler) return (res.writeHead(404, { "content-type": "application/json" }), res.end(JSON.stringify({ error: "unknown endpoint" })));
    try {
      const data = await handler(u.searchParams, req, res);
      if (!res.headersSent) {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(data, null, 1));
      }
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(e.message || e) }));
      }
    }
    return;
  }
  // static
  const file = p === "/" ? "index.html" : p.replace(/^\/+/, "");
  const fp = path.join(__dirname, "web", file);
  if (!fp.startsWith(path.join(__dirname, "web"))) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found: " + file); }
    const ct = fp.endsWith(".html") ? "text/html; charset=utf-8" : fp.endsWith(".js") ? "text/javascript; charset=utf-8" : fp.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream";
    // 本地开发：全 no-store（改完前端立刻生效）；NODE_ENV=production 时对静态资源开缓存
    const isProd = process.env.NODE_ENV === "production";
    const headers = { "content-type": ct, "cache-control": isProd ? "public, max-age=3600" : "no-store, no-cache, must-revalidate, max-age=0" };
    if (!isProd) Object.assign(headers, { "pragma": "no-cache", "expires": "0" });
    res.writeHead(200, headers);
    res.end(buf);
  });
});

const PORT = Number(process.env.PORT || 7800);
const HOST = process.env.HOST || "127.0.0.1"; // 公开部署可 HOST=0.0.0.0（务必同时设 SCAN_ROOTS_ALLOWED 并配 LLM 密钥鉴权）
server.listen(PORT, HOST, () => console.log(`asset-dashboard → http://${HOST}:${PORT}` + (HOST === "127.0.0.1" ? "" : "  (listening on all interfaces — set SCAN_ROOTS_ALLOWED for safety)")));
