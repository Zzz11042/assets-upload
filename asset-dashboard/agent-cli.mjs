#!/usr/bin/env node
// agent-cli.mjs — asset-dashboard Agent 接入层零依赖 CLI（Node >= 18，全局 fetch）
// 用法:
//   node asset-dashboard/agent-cli.mjs manifest
//   node asset-dashboard/agent-cli.mjs plan "给 tap-samurai 生成 3 个新怪物" [--game tap-samurai] [--domain game] [--ctx "…"]
//   node asset-dashboard/agent-cli.mjs latest [--plan-id <id>]
//   node asset-dashboard/agent-cli.mjs step [plan_id] [step|n]        # 取下一个未完成步骤（缺省=最近 plan）
//   node asset-dashboard/agent-cli.mjs done [plan_id] <step|n> [--result "..."]
// 选项: --base <url>（默认 http://127.0.0.1:7800）；鉴权读 env AGENT_TOKEN → x-agent-token 头

const args = process.argv.slice(2);
const opts = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--base") opts.base = args[++i];
  else if (a === "--game") opts.game = args[++i];
  else if (a === "--domain") opts.domain = args[++i];
  else if (a === "--ctx") opts.ctx = args[++i];
  else if (a === "--result") opts.result = args[++i];
  else if (a === "--plan-id") opts.planId = args[++i];
  else if (a.startsWith("-")) { process.stderr.write("未知选项: " + a + "\n"); process.exit(2); }
  else pos.push(a);
}
const cmd = pos[0] || "help";
const base = (opts.base || "http://127.0.0.1:7800").replace(/\/+$/, "");
const token = process.env.AGENT_TOKEN || "";

async function call(method, path, body) {
  const headers = { "content-type": "application/json" };
  if (token) headers["x-agent-token"] = token;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    process.stderr.write("HTTP " + res.status + " " + path + ": " + text + "\n");
    process.exit(1);
  }
  return data;
}

function usage() {
  process.stdout.write(
    "agent-cli.mjs 子命令:\n" +
    "  manifest                      能力发现（agent manifest）\n" +
    '  plan "需求" [--game g] [--domain d] [--ctx "..."]   需求 → 可执行方案\n' +
    "  latest [--plan-id id]         取回方案（缺省=最近一次）\n" +
    "  step [plan_id] [step|n]       分步合成：取下一个未完成步骤\n" +
    '  done [plan_id] <step|n> [--result "..."]  标记步骤完成\n' +
    "  选项: --base <url>（默认 http://127.0.0.1:7800）; 鉴权: env AGENT_TOKEN\n"
  );
}

(async () => {
  switch (cmd) {
    case "manifest": {
      const d = await call("GET", "/api/agent/manifest");
      process.stdout.write(JSON.stringify(d, null, 2) + "\n");
      break;
    }
    case "plan": {
      const requirement = pos[1];
      if (!requirement) { usage(); process.exit(2); }
      const body = { requirement };
      if (opts.game) body.game = opts.game;
      if (opts.domain) body.domain = opts.domain;
      if (opts.ctx) body.context = opts.ctx;
      const d = await call("POST", "/api/agent/plan", body);
      const plan = d.plan || {};
      const tasks = (plan.execution && plan.execution.tasks) || [];
      process.stdout.write(
        "plan_id: " + (plan.plan_id || "-") + "\n" +
        "kind: " + (plan.kind || "-") + (plan.base ? "  base: " + plan.base : "") + "\n" +
        "steps: " + tasks.length + "（" + tasks.map(t => t.id).join(" → ") + "）\n" +
        "next: " + (plan.next_step || "-") + "\n" +
        "查看单步: node asset-dashboard/agent-cli.mjs step " + (plan.plan_id || "") + "\n"
      );
      break;
    }
    case "latest": {
      const p = opts.planId ? "/api/agent/plan?plan_id=" + encodeURIComponent(opts.planId) : "/api/agent/plan";
      const d = await call("GET", p);
      const plan = d.plan || {};
      const tasks = (plan.execution && plan.execution.tasks) || [];
      process.stdout.write(
        "plan_id: " + (plan.plan_id || "-") + "  (file: " + (d.file || "-") + ")\n" +
        "kind: " + (plan.kind || "-") + "  domain: " + (plan.domain || "-") + "\n" +
        "steps: " + tasks.map(t => t.id).join(" → ") + "\n" +
        JSON.stringify(d, null, 2) + "\n"
      );
      break;
    }
    case "step": {
      const planId = pos[1] || "";
      const step = pos[2] || "";
      let p = "/api/agent/step";
      const qs = [];
      if (planId) qs.push("plan_id=" + encodeURIComponent(planId));
      if (step) qs.push("step=" + encodeURIComponent(step));
      if (qs.length) p += "?" + qs.join("&");
      const d = await call("GET", p);
      if (!d.step) {
        process.stdout.write((d.all_done ? "全部步骤已完成" : d.error || "无步骤") + "  plan_id=" + d.plan_id + "  done=" + d.done_count + "/" + d.total + "\n");
        break;
      }
      const s = d.step;
      process.stdout.write(
        "plan_id: " + d.plan_id + "  step " + s.step + "/" + s.total + "  [" + s.id + "]" + (s.status === "done" ? "  (已标记完成)" : "") + "\n" +
        "tool: " + (s.tool || "-") + "\n" +
        "do: " + (s.do || "-") + "\n" +
        "command:\n  " + (s.command || "-") + "\n" +
        (s.verify ? "verify: " + s.verify + "\n" : "") +
        "标记完成: " + s.mark_done.cli + "\n"
      );
      break;
    }
    case "done": {
      const planId = pos[1] || "";
      const step = pos[2] || "";
      if (!planId || !step) { usage(); process.exit(2); }
      const body = { plan_id: planId, step };
      if (opts.result != null) body.result = opts.result;
      const d = await call("POST", "/api/agent/step/done", body);
      process.stdout.write(
        "plan " + d.plan_id + ": 标记 " + d.done + " 完成（" + d.done_count + "/" + d.total + "）" +
        (d.all_done ? "  → 全部完成 ✓" : "") + "\n" +
        (d.next ? "下一步: " + d.next + "  取法: node asset-dashboard/agent-cli.mjs step " + d.plan_id + " " + d.next + "\n" : "")
      );
      break;
    }
    case "help":
    default:
      usage();
      break;
  }
})().catch(e => { process.stderr.write("错误: " + (e.message || e) + "\n"); process.exit(1); });
