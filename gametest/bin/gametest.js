#!/usr/bin/env node
"use strict";
/* gametest CLI:AI agent 游戏测试 CLI
 * 用法:./gametest <command> [args]
 * 输出:JSON(stdout)
 */
const http = require("http");

const CONSOLE_PORT = 8791;
const CONSOLE = `http://127.0.0.1:${CONSOLE_PORT}`;

/* ---- 工具 ---- */
function j2o(v) {
  // 把 geckodriver 返回的 JSON 值转成纯对象(处理 ArrayBuffer 等)
  return v;
}
function out(obj, code) {
  console.log(JSON.stringify(obj, null, 1));
  process.exit(obj && obj.ok ? 0 : (code===0?1:code));
}
function err(msg) {
  out({ ok: false, error: msg }, 1);
}
function post(path, body, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { host: "127.0.0.1", port: CONSOLE_PORT, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          let j;
          try { j = JSON.parse(text); } catch (e) { return reject(new Error("bad response: " + text)); }
          resolve(j);
        });
      }
    );
    req.on("error", (e) => reject(e));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.write(data);
    req.end();
  });
}
function get(path, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: CONSOLE_PORT, path, method: "GET" }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        let j;
        try { j = JSON.parse(text); } catch (_) { j = { raw: text }; }
        resolve(j);
      });
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

/* ---- 会话 ---- */
let SESSION = process.env.GAMETEST_SESSION || "s1";

async function ensureConsole() {
  // ping console
  try {
    const p = await get("/ping");
    if (p && p.ok) return;
  } catch (_) {}
  // 尝试启动 console
  const { spawn } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const here = path.resolve(__dirname, "..");
  const stateFile = path.join(here, ".console.json");
  // 已有 state 且 pid 存活?
  try {
    const st = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (st.pid) {
      process.kill(st.pid, 0); // 不抛异常则存活
      // 等待 console 起来
      for (let i = 0; i < 20; i++) {
        try { const p = await get("/ping"); if (p.ok) return; } catch (_) {}
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  } catch (_) {}
  // 启动
  const proc = spawn(process.execPath, [path.join(here, "lib", "console.js")], { detached: true, stdio: "ignore" });
  proc.unref();
  for (let i = 0; i < 30; i++) {
    try { const p = await get("/ping"); if (p.ok) return; } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  err("无法启动 gametest console");
}

/* ---- 命令实现 ---- */
const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);

function val(name, dflt) {
  const i = rest.indexOf("--" + name);
  if (i >= 0 && rest[i + 1]) return rest[i + 1];
  return dflt;
}
function hasFlag(name) {
  return rest.includes("--" + name);
}

(async () => {
  try {
    if (!cmd) {
      console.log(JSON.stringify({ usage: "gametest <start|shot|click|tap|click-elem|key|type|wait|drag|state|stop> [args]", session: SESSION }, null, 1));
      return;
    }

    switch (cmd) {
      case "start": {
        const url = val("url", null);
        if (!url) err("start 需要 --url <file://...或http://...>");
        await ensureConsole();
        const sid = val("session", SESSION);
        SESSION = sid;
        const r = await post("/session", { id: sid, url });
        out(r);
        break;
      }
      case "shot": {
        await ensureConsole();
        const r = await post("/shot", { session: SESSION, base64: hasFlag("base64") });
        out(r);
        break;
      }
      case "click": {
        const x = Number(rest.find((v) => !v.startsWith("-")) || 0);
        const y = Number(rest[rest.indexOf(String(x)) + 1] || 0);
        await ensureConsole();
        const r = await post("/action", {
          session: SESSION, type: "point", x, y,
          button: val("button", "left") === "right" ? 2 : 0,
          base64: hasFlag("base64"),
        });
        out(r);
        break;
      }
      case "tap": {
        const x = Number(rest.find((v) => !v.startsWith("-")) || 0);
        const y = Number(rest[rest.indexOf(String(x)) + 1] || 0);
        await ensureConsole();
        const r = await post("/action", { session: SESSION, type: "touch", x, y, base64: hasFlag("base64") });
        out(r);
        break;
      }
      case "click-elem": {
        const sel = rest.find((v) => !v.startsWith("--")) || rest[0];
        if (!sel) err("click-elem 需要 <selector>,例如 #btnDeploy");
        await ensureConsole();
        const r = await post("/action", { session: SESSION, type: "click", selector: sel, base64: hasFlag("base64") });
        out(r);
        break;
      }
      case "key": {
        // 第一个非 -- 参数是键序列(空格分隔),如 "W Shift"
        const keysRaw = rest.find((v) => !v.startsWith("--")) || "";
        const keys = keysRaw.split(/\s+/).filter(Boolean);
        await ensureConsole();
        const r = await post("/action", { session: SESSION, type: "key", keys, hold: hasFlag("hold"), base64: hasFlag("base64") });
        out(r);
        break;
      }
      case "type": {
        const text = rest.find((v) => !v.startsWith("--")) || "";
        await ensureConsole();
        const r = await post("/action", { session: SESSION, type: "type", text, base64: hasFlag("base64") });
        out(r);
      }
      case "wait": {
        const sec = Number(rest.find((v) => !v.startsWith("--")) || 1);
        await ensureConsole();
        const r = await post("/action", { session: SESSION, type: "wait", seconds: sec, state: false, base64: hasFlag("base64") });
        out(r);
        break;
      }
      case "drag": {
        const nums = rest.filter((v) => !v.startsWith("-")).map(Number);
        if (nums.length < 4) err("drag 需要 X1 Y1 X2 Y2");
        await ensureConsole();
        const r = await post("/action", { session: SESSION, type: "drag", x1: nums[0], y1: nums[1], x2: nums[2], y2: nums[3], base64: hasFlag("base64") });
        out(r);
        break;
      }
      case "reset": {
        await ensureConsole();
        const r = await post("/reset", { session: SESSION });
        out(r);
        break;
      }
      case "state": {
        await ensureConsole();
        const r = await post("/shot", { session: SESSION, state: true });
        out(r);
        break;
      }
      case "stop": {
        await ensureConsole();
        const r = await post("/close", { session: SESSION });
        out(r);
        break;
      }
      case "shutdown": {
        await ensureConsole();
        const r = await post("/shutdown", {});
        out(r);
        break;
      }
      default:
        err("未知命令 " + cmd);
    }
  } catch (e) {
    err(e.message || String(e));
  }
})();
