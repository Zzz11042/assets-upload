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

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const WS = path.resolve(__dirname, ".."); // default-workspace
const FORGE = path.join(WS, "game-forge");
const TOMATO = path.join(WS, "tomato");
const SETTINGS_FILE = path.join(__dirname, "settings.json");

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", c => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
    req.on("error", reject);
  });
}

const API = {
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
    };
  },
  "/api/vault": () => readJson(path.join(FORGE, "vault/INDEX.json"), []),
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
      const next = {
        apiBase: body.apiBase ?? cur.apiBase ?? "",
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
    return { path: rel, root, base: "game-forge/" + root, entries };
  },
  // 本地素材/思路库（"学习本地思路"：按领域返回可引用的本地素材块）
  "/api/materials": (q) => {
    const domain = q.get("domain") || "game";
    const out = { domain, blocks: [] };
    const rd = (p, name, tag) => {
      try { const t = fs.readFileSync(p, "utf8"); out.blocks.push({ name, tag, text: t.slice(0, 600), source: p.split("/home/zzz/Documents/deepseek-harness/default-workspace/").pop() }); } catch { }
    };
    if (domain === "novel") {
      rd(path.join(WS, "tomato/books/dianxiao/style-dna.md"), "dianxiao 风格DNA", "视角/句法/修辞禁区/节奏基准/口癖");
      rd(path.join(WS, "tomato/books/moshu30/style-dna.md"), "moshu30 风格DNA", "职场梗×末世/打卡机意象");
      const ledg = path.join(WS, "tomato/books/dianxiao/canon/foreshadowing-ledger.md");
      rd(ledg, "dianxiao 伏笔账本", "埋设/引爆成对追踪");
      rd(path.join(WS, "game-forge/novel_projects/都市重生爽文-996程序员猝死后回到2019-带/state.json"), "长篇 state", "重生爽文 120 章进度");
    } else if (domain === "video") {
      listDir(path.join(FORGE, "projects")).forEach(d => {
        const p = readJson(path.join(FORGE, "projects", d, "project.json"), null);
        if (p) out.blocks.push({ name: d, tag: "短剧/视频项目", text: JSON.stringify(p.card || {}, null, 1).slice(0, 500) + "\n角色：" + JSON.stringify(((p.characters || {}).characters || []).map(c => c.name)), source: "game-forge/projects/" + d });
      });
    } else {
      const plans = readJson(path.join(FORGE, "knowledge/plans.json"), []);
      out.blocks.push({ name: "完整方案库", tag: "plans.json×5", text: plans.map(p => (p.name || p.id) + "：" + grab0(p.one_liner)).join("\n").slice(0, 600), source: "game-forge/knowledge/plans.json" });
      const gms = readJson(path.join(FORGE, "knowledge/games.json"), []);
      out.blocks.push({ name: "相似游戏库", tag: "games.json×" + gms.length, text: gms.slice(0, 6).map(g => g.name + "（" + (g.genre || "") + "）借鉴：" + grab0(g.borrow)).join("\n").slice(0, 400), source: "game-forge/knowledge/games.json" });
      const st = readJson(path.join(FORGE, "knowledge/styles.json"), []);
      const sl = Array.isArray(st) ? st : Object.values(st);
      out.blocks.push({ name: "美工风格库", tag: "styles×" + sl.length, text: sl.map(s => s.name + "：" + grab0(s.art_style)).join("\n").slice(0, 400), source: "game-forge/knowledge/styles.json" });
      out.blocks.push({ name: "素材资产", tag: "vault art-assets×471", text: "extracted_art(442)+pixel-assets(29)，可在实现时直接引用", source: "game-forge/vault/art-assets" });
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
  // 一键本地扫描：递归整理指定根目录下的所有项目与资产，标出可分析项供创作者选择
  // 规则：识别项目（package.json/pyproject/project.json/state.json/index.html/server.mjs）、
  //       资产（png/jpg/webp/gl 计数）、文档；analyzable = 有可读入口或资产文件 >=10
  // 预设：preset=workspace（默认）/ home / all（全电脑）；可配 includeHidden、maxDepth
  "/api/local-scan": (q) => {
    const preset = q.get("preset") || "workspace";
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
      roots = [WS, FORGE, TOMATO];
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
      roots: roots.map(r => path.basename(r) || r),
      scanned_at: new Date().toISOString(),
      total: dedup.length,
      analyzable: dedup.filter(r => r.analyzable).length,
      byType: dedup.reduce((m, r) => (m[r.type] = (m[r.type] || 0) + 1, m), {}),
      items: dedup,
      grouped,
      options: { depth, includeHidden, preset, roots },
    };
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
    // 本地开发：全 no-store，确保改完前端立刻生效（浏览器不缓存）
    const headers = { "content-type": ct, "cache-control": "no-store, no-cache, must-revalidate, max-age=0", "pragma": "no-cache", "expires": "0" };
    res.writeHead(200, headers);
    res.end(buf);
  });
});

const PORT = Number(process.env.PORT || 7800);
server.listen(PORT, "127.0.0.1", () => console.log(`asset-dashboard → http://127.0.0.1:${PORT}`));
