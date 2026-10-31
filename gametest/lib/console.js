#!/usr/bin/env node
"use strict";
/* gametest console: 长驻控制器
 * - 管理 geckodriver(Firefox 系统级 headless)
 * - 每个会话 = 一个 W3C WebDriver 会话
 * - 提供 HTTP API 供 CLI 子命令调用
 * 状态文件: gametest/.console.json { pid, port, driverPort, sessions: {sid: {driverSession, step}} }
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync, spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(ROOT, ".console.json");

const DRIVERS = [
  { bin: "/snap/bin/firefox.geckodriver", kind: "gecko", caps: { browserName: "firefox" } },
  { bin: "/usr/local/bin/geckodriver", kind: "gecko", caps: { browserName: "firefox" } },
];

function findDriver() {
  for (const d of DRIVERS) {
    try { fs.accessSync(d.bin, fs.constants.X_OK); return d; } catch (_) {}
  }
  // 回退: 从 PATH 找
  try {
    const p = execFileSync("which", ["geckodriver"], { encoding: "utf8" }).trim();
    if (p) return { bin: p, kind: "gecko", caps: { browserName: "firefox" } };
  } catch (_) {}
  return null;
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch (_) { return null; }
}
function writeState(st) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 1));
}

async function httpJson(url, method, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let d;
  try { d = JSON.parse(text); } catch (_) { d = { raw: text }; }
  if (d && d.value !== undefined && d.status && d.status >= 400) {
    const e = new Error(d.value.message || d.raw || "webdriver error");
    e.code = d.status; e.detail = d.value; throw e;
  }
  return d.value !== undefined ? d.value : d;
}

/* ============ geckodriver 封装 ============ */
async function startDriver() {
  const d = findDriver();
  if (!d) throw new Error("未找到 geckodriver:请安装(snap install firefox 自带 /snap/bin/firefox.geckodriver)");
  const port = 4444 + Math.floor(Math.random() * 200);
  const proc = spawn(d.bin, ["-p", String(port), "--log", "info"], {
    stdio: ["ignore", "pipe", "pipe"], detached: false,
  });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});
  // 等待 driver ready
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/status`);
      const j = await r.json();
      if (j.value && j.value.ready) return { proc, port, kind: d.kind, caps: d.caps };
    } catch (_) {}
    await new Promise((res) => setTimeout(res, 300));
  }
  proc.kill();
  throw new Error("geckodriver 启动超时");
}

async function newSession(drv, url) {
  const caps = { ...drv.caps, "moz:firefoxOptions": {} };
  const res = await httpJson(`http://127.0.0.1:${drv.port}/session`, "POST", {
    capabilities: { alwaysMatch: caps },
  });
  const sid = res.sessionId || res;
  if (url) {
    await httpJson(`http://127.0.0.1:${drv.port}/session/${sid}/url`, "POST", { url });
  }
  return sid;
}

async function execScript(drv, sid, script) {
  return httpJson(`http://127.0.0.1:${drv.port}/session/${sid}/execute/sync`, "POST", {
    args: [],
    script,
  });
}

async function screenshot(drv, sid) {
  const b64 = await httpJson(`http://127.0.0.1:${drv.port}/session/${sid}/screenshot`, "GET");
  return Buffer.from(b64, "base64");
}

/* ============ 输入注入(拟人:真实 DOM 事件) ============ */
function scriptForElementClick(selector, button) {
  const btn = button || 0;
  return `return (function(){
  var el=document.querySelector(${JSON.stringify(selector)});
  if(!el) return {ok:false,error:"element not found: "+${JSON.stringify(selector)}};
  el.scrollIntoView({block:"center"});
  var r=el.getBoundingClientRect();
  var cx=r.left+r.width/2, cy=r.top+r.height/2;
  var common={bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy,button:${btn}};
  el.dispatchEvent(new MouseEvent("mouseover",common));
  el.dispatchEvent(new MouseEvent("mousemove",common));
  el.dispatchEvent(new MouseEvent("mousedown",{...common,buttons:1}));
  el.dispatchEvent(new MouseEvent("mouseup",{...common,buttons:0}));
  el.dispatchEvent(new MouseEvent("click",{...common,buttons:0}));
  return {ok:true,center:{x:cx,y:cy}};
})()`;
}

function scriptForPointClick(x, y, button) {
  const btn = button || 0;
  // x,y 是"视口坐标"(CSS px,相对整个页面视口)。
  // 若页面某可滚动容器内有 canvas,游戏坐标按 canvas 换算;这里直接用 client 坐标命中元素。
  return `return (function(){
  var x=${Number(x)||0}, y=${Number(y)||0};
  var el=document.elementFromPoint(x,y);
  if(!el) return {ok:false,error:"nothing at point "+x+","+y};
  var common={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:${btn}};
  el.dispatchEvent(new MouseEvent("mouseover",common));
  el.dispatchEvent(new MouseEvent("mousemove",common));
  el.dispatchEvent(new MouseEvent("mousedown",{...common,buttons:1}));
  el.dispatchEvent(new MouseEvent("mouseup",{...common,buttons:0}));
  el.dispatchEvent(new MouseEvent("click",{...common,buttons:0}));
  return {ok:true,tag:el.tagName,id:el.id,selector:(el.id?("#"+el.id):el.tagName.toLowerCase())};
})()`;
}

function scriptForTouch(x, y) {
  return `return (function(){
  var x=${Number(x)||0}, y=${Number(y)||0};
  var el=document.elementFromPoint(x,y);
  if(!el) return {ok:false,error:"nothing at point "+x+","+y};
  var t={clientX:x,clientY:y,identifier:1,pageX:x,pageY:y,target:el};
  var mk=function(type){ var ev=new TouchEvent(type,{bubbles:true,cancelable:true,view:window,touches:type==="touchend"?[]:[t],targetTouches:type==="touchend"?[]:[t],changedTouches:[t]}); return ev; };
  el.dispatchEvent(mk("touchstart"));
  el.dispatchEvent(mk("touchend"));
  // 游戏同时监听 mousedown,补一发 click 保证命中
  var common={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0};
  el.dispatchEvent(new MouseEvent("mousedown",{...common,buttons:1}));
  el.dispatchEvent(new MouseEvent("mouseup",{...common,buttons:0}));
  el.dispatchEvent(new MouseEvent("click",{...common,buttons:0}));
  return {ok:true,tag:el.tagName};
})()`;
}

function scriptForKey(keys, hold) {
  // keys: 数组,如 ["KeyW"] 或 ["ShiftLeft","KeyA"]
  const keyNames = JSON.stringify(keys);
  if (hold) {
    return `return (function(){
  var keys=${keyNames};
  var target=document.activeElement||document.body;
  keys.forEach(function(k){ target.dispatchEvent(new KeyboardEvent("keydown",{key:k,code:k,which:0,bubbles:true,cancelable:true})); });
  return {ok:true,held:true,keys:keys};
})()`;
  }
  return `return (function(){
  var keys=${keyNames};
  var target=document.activeElement||document.body;
  keys.forEach(function(k){
    target.dispatchEvent(new KeyboardEvent("keydown",{key:k,code:k,which:0,bubbles:true,cancelable:true}));
    target.dispatchEvent(new KeyboardEvent("keyup",{key:k,code:k,which:0,bubbles:true,cancelable:true}));
  });
  return {ok:true,keys:keys};
})()`;
}

function scriptForType(text) {
  const t = JSON.stringify(text);
  return `return (function(){
  var s=${t};
  var target=document.activeElement;
  if(!target || (target.tagName!=="INPUT" && target.tagName!=="TEXTAREA")) return {ok:false,error:"no focused input"};
  s.split("").forEach(function(ch){
    target.dispatchEvent(new KeyboardEvent("keydown",{key:ch,code:ch,which:ch.charCodeAt(0),bubbles:true,cancelable:true}));
    target.value = (target.value||"") + ch;
    target.dispatchEvent(new Event("input",{bubbles:true}));
    target.dispatchEvent(new KeyboardEvent("keyup",{key:ch,code:ch,which:ch.charCodeAt(0),bubbles:true,cancelable:true}));
  });
  return {ok:true,len:s.length};
})()`;
}

function scriptForWait(seconds) {
  // 在 JS 里 sleep(geckodriver execute 是同步,用长 timeout 的忙等待不可行;
  // 这里返回标记,由 CLI 侧本地 sleep)
  return `return {ok:true,note:"wait handled client-side"}`;
}

function scriptForState() {
  // 注入 <script> 到页面 realm 读游戏内部状态(ares-squad 专属, 可换探针)
  return `return (function(){
    var out={dom:{}};
    out.dom.viewTag=document.getElementById("viewTag")?document.getElementById("viewTag").textContent:null;
    out.dom.hud={gold:document.getElementById("hGold")?document.getElementById("hGold").textContent:null,
      part:document.getElementById("hPart")?document.getElementById("hPart").textContent:null,
      food:document.getElementById("hFood")?document.getElementById("hFood").textContent:null,
      med:document.getElementById("hMed")?document.getElementById("hMed").textContent:null};
    out.dom.toast=document.getElementById("toast")?document.getElementById("toast").textContent:null;
    out.dom.hint=document.getElementById("campHint")?document.getElementById("campHint").textContent:null;
    out.dom.missionLabel=document.getElementById("mName")?document.getElementById("mName").textContent:null;
    out.dom.onboard=(document.getElementById("onboard")&&document.getElementById("onboard").style.display!=="none");
    out.dom.resultOverlay=(document.getElementById("resultOverlay")&&document.getElementById("resultOverlay").style.display!=="none");
    out.dom.battleBar=(document.getElementById("battleBar")&&document.getElementById("battleBar").style.display!=="none");
    out.dom.battleBarVisible=out.dom.battleBar===true?document.getElementById("battleBar").style.display:null;
    // 页面 realm 注入读内部变量
    var s=document.createElement("script");
    s.textContent="window.__gt=window.__gt||{};window.__gt.state=null;window.__gt.err=null;try{window.__gt.state={inBattle:inBattle,view:view,paused:paused,mission:S.mission,win:S.won,gold:Math.floor(S.gold),part:Math.floor(S.part),food:S.food,med:S.med,nsoldiers:soldiers.length,nenemies:enemies.length,crew:S.crew.length,camX:Math.round(camX),camY:Math.round(camY)};}catch(e){window.__gt.err=String(e);}";
    document.documentElement.appendChild(s); s.remove();
    out.game=window.__gt.state||null;
    out.gameErr=window.__gt.err||null;
    return out;
  })()`;
}

/* ============ HTTP API ============ */
const sessions = {}; // sid -> { driverSession, step }
let drv = null;

function getDriver() {
  if (drv && drv.proc && drv.proc.exitCode === null) return drv;
  throw new Error("driver not running");
}

async function ensureSession(sid) {
  if (sessions[sid]) return sessions[sid];
  const d = getDriver();
  const ds = await newSession(d, null);
  sessions[sid] = { driverSession: ds, step: 0 };
  persist();
  return sessions[sid];
}

function persist() {
  const st = readState() || {};
  st.pid = process.pid;
  st.sessions = Object.fromEntries(
    Object.entries(sessions).map(([k, v]) => [k, { driverSession: v.driverSession, step: v.step }])
  );
  writeState(st);
}

function restore() {
  const st = readState();
  if (!st) return;
  for (const [k, v] of Object.entries(st.sessions || {})) {
    sessions[k] = { driverSession: v.driverSession, step: v.step };
  }
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  try {
    // GET /ping
    if (p === "/ping") return send(200, { ok: true, pid: process.pid });

    if (req.method === "POST") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      await new Promise((r) => req.on("end", r));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || "{}") : {};

      // POST /session  { id, url }
      if (p === "/session") {
        const sid = body.id || "s" + Date.now().toString(36);
        await ensureSession(sid);
        if (body.url) {
          await httpJson(`http://127.0.0.1:${getDriver().port}/session/${sessions[sid].driverSession}/url`, "POST", { url: body.url });
        }
        persist();
        return send(200, { ok: true, session: sid, driverSession: sessions[sid].driverSession });
      }

      // POST /action  { session, type, ... }
      if (p === "/action") {
        const sid = body.session;
        if (!sessions[sid]) return send(404, { ok: false, error: "session not found: " + sid + ",run start first" });
        const d = getDriver();
        const ds = sessions[sid].driverSession;
        sessions[sid].step++;
        const step = sessions[sid].step;
        let script = null, detail = {};
        switch (body.type) {
          case "click": detail = { selector: body.selector }; script = scriptForElementClick(body.selector, body.button); break;
          case "point": detail = { x: body.x, y: body.y }; script = scriptForPointClick(body.x, body.y, body.button); break;
          case "touch": detail = { x: body.x, y: body.y }; script = scriptForTouch(body.x, body.y); break;
          case "key": detail = { keys: body.keys, hold: !!body.hold }; script = scriptForKey(body.keys, body.hold); break;
          case "type": detail = { text: body.text }; script = scriptForType(body.text); break;
          case "drag": detail = { x1: body.x1, y1: body.y1, x2: body.x2, y2: body.y2 }; script = scriptForPointClick(body.x2, body.y2); break; // 简化:落点点击
          case "wait": detail = { seconds: body.seconds || 0 }; script = scriptForWait(body.seconds || 0); break;
          default: return send(400, { ok: false, error: "unknown action type: " + body.type });
        }
        let execResult = null;
        try {
          execResult = await execScript(d, ds, script);
        } catch (e) {
          execResult = { ok: false, error: e.detail?.message || e.message };
        }
        // 截图
        const shotDir = path.join(ROOT, "shot");
        fs.mkdirSync(shotDir, { recursive: true });
        const shotPath = path.join(shotDir, `${sid}_step${String(step).padStart(3, "0")}.png`);
        let image_path = null, image_b64 = null;
        if (body.noShot !== true) {
          try {
            const buf = await screenshot(d, ds);
            fs.writeFileSync(shotPath, buf);
            image_path = "shot/" + path.basename(shotPath);
            if (body.base64) image_b64 = buf.toString("base64");
          } catch (e) {
            /* 截图失败不阻塞 */
          }
        }
        // 本地等待(wait 类)
        if (body.type === "wait") {
          const s = Number(body.seconds) || 0;
          if (s > 0) await new Promise((r) => setTimeout(r, s * 1000));
        }
        let state = null;
        if (body.state !== false) {
          try { state = await execScript(d, ds, scriptForState()); } catch (_) {}
        }
        persist();
        return send(200, {
          ok: !!(execResult && execResult.ok !== false),
          session: sid,
          action: body.type,
          detail,
          exec: execResult,
          image_path,
          image_b64,
          step,
          state,
        });
      }

      // POST /shot { session, state? }
      if (p === "/shot") {
        const sid = body.session;
        if (!sessions[sid]) return send(404, { ok: false, error: "session not found: " + sid });
        const d = getDriver();
        const ds = sessions[sid].driverSession;
        sessions[sid].step++;
        const step = sessions[sid].step;
        const shotDir = path.join(ROOT, "shot");
        fs.mkdirSync(shotDir, { recursive: true });
        const shotPath = path.join(shotDir, `${sid}_step${String(step).padStart(3, "0")}.png`);
        const buf = await screenshot(d, ds);
        fs.writeFileSync(shotPath, buf);
        let state = null;
        if (body.state !== false) {
          try { state = await execScript(d, ds, scriptForState()); } catch (_) {}
        }
        persist();
        return send(200, {
          ok: true, session: sid, action: "shot", step,
          image_path: "shot/" + path.basename(shotPath),
          image_b64: body.base64 ? buf.toString("base64") : null,
          state,
        });
      }

      // POST /reset { session }  游戏重开: 清 localStorage + 重载
      if (p === "/reset") {
        const sid = body.session;
        if (!sessions[sid]) return send(404, { ok: false, error: "session not found" });
        const d = getDriver();
        const ds = sessions[sid].driverSession;
        try {
          await execScript(d, ds, `return (function(){
            try{ localStorage.removeItem("ares_squad_v1"); window.__resetSave&&window.__resetSave(); }catch(e){}
            location.reload(); return {ok:true,reloaded:true};
          })()`);
        } catch(e) { /* 重载会中断当前请求,忽略 */ }
        sessions[sid].step++;
        persist();
        await new Promise((r) => setTimeout(r, 1500)); // 等重载
        let state = null;
        try { state = await execScript(d, ds, scriptForState()); } catch (_) {}
        return send(200, { ok: true, session: sid, action: "reset", step: sessions[sid].step, state });
      }

      // POST /close { session }
      if (p === "/close") {
        const sid = body.session;
        if (sessions[sid]) {
          const d = getDriver();
          try { await httpJson(`http://127.0.0.1:${d.port}/session/${sessions[sid].driverSession}/delete`, "DELETE"); } catch (_) {}
          delete sessions[sid];
          persist();
          return send(200, { ok: true, closed: sid });
        }
        return send(404, { ok: false, error: "session not found" });
      }

      // POST /shutdown
      if (p === "/shutdown") {
        persist();
        return send(200, { ok: true, shutting: true });
      }

      return send(404, { ok: false, error: "unknown endpoint " + p });
    }
    return send(405, { ok: false, error: "method not allowed" });
  } catch (e) {
    return send(500, { ok: false, error: e.detail?.message || e.message });
  }
});

(async () => {
  drv = await startDriver();
  restore();
  const port = Number(process.argv[2]) || 8791;
  server.listen(port, "127.0.0.1", () => {
    const st = readState() || {};
    st.pid = process.pid;
    st.port = port;
    st.driverPort = drv.port;
    st.started = new Date().toISOString();
    writeState(st);
    console.error("[gametest-console] listening on 127.0.0.1:" + port + " driver:" + drv.port);
  });
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  function shutdown() {
    persist();
    try { drv.proc.kill("SIGTERM"); } catch (_) {}
    try { fs.unlinkSync(STATE_FILE); } catch (_) {}
    process.exit(0);
  }
  // 收到 /shutdown 标志:轮询状态文件里的 shutdown 标记
  setInterval(() => {
    const st = readState();
    if (st && st.shutdown) {
      shutdown();
    }
  }, 1000);
})();
