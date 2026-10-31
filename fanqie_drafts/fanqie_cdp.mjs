#!/usr/bin/env node
// fanqie_cdp.mjs — drive the user's running Firefox via CDP (port 9222)
// Usage:
//   node fanqie_cdp.mjs status
//   node fanqie_cdp.mjs tabs
//   node fanqie_cdp.mjs goto <url>
//   node fanqie_cdp.mjs newtab <url>
//   node fanqie_cdp.mjs eval <jsonFileOrExpr>
//   node fanqie_cdp.mjs submit <jsonFile>   (payload file {url, payload}) -> POST via fetch with same-origin cookies
// Strategy: for submit, navigate a NEW background tab to a small data: URL
// that carries the payload, execute fetch() in page context (cookies = user session),
// then report the JSON result written to window.__result, and read it back.
import fs from 'node:fs';

const CDP = 'http://127.0.0.1:9222';
async function http(path) {
  const r = await fetch(CDP + path);
  return r.json();
}
async function newWs(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return ws;
}
class C {
  constructor(ws) { this.ws = ws; this.id = 0; this.pend = new Map(); this.events = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pend.has(d.id)) { const [res, rej] = this.pend.get(d.id); this.pend.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result); }
      else if (d.method) this.events.push(d);
    };
  }
  cmd(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pend.set(id, [res, rej]); this.ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (this.pend.has(id)) { this.pend.delete(id); rej(new Error('timeout ' + method)); } }, 60000); });
  }
  async eval(expr, timeout = 60000) {
    const r = await this.cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout });
    if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}
const argv = process.argv.slice(2);
const cmd = argv[0];
if (cmd === 'status') {
  const v = await http('/json/version');
  console.log(JSON.stringify(v, null, 2));
} else if (cmd === 'tabs') {
  const tabs = await http('/json');
  for (const t of tabs) console.log(`${t.id}\t${t.type}\t${t.title}\t${t.url}`);
} else if (cmd === 'goto' || cmd === 'newtab') {
  const url = argv[1];
  let target;
  if (cmd === 'newtab') {
    target = await http('/json/new?' + encodeURIComponent(url));
  } else {
    target = (await http('/json'))[0];
    await target && (target = target);
  }
  const c = new C(await newWs(target.webSocketDebuggerUrl));
  await c.cmd('Page.enable');
  if (cmd === 'goto') {
    await c.cmd('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 8000));
  }
  const title = await c.eval('document.title');
  const loc = await c.eval('location.href');
  console.log(JSON.stringify({ target: target.id, title, loc }, null, 2));
} else if (cmd === 'eval') {
  let expr = argv[1];
  if (fs.existsSync(expr) && !expr.includes(';')) expr = fs.readFileSync(expr, 'utf8');
  const tabs = await http('/json');
  const target = tabs.find(t => t.url.includes('fanqie')) || tabs[0];
  const c = new C(await newWs(target.webSocketDebuggerUrl));
  const v = await c.eval(expr);
  console.log(JSON.stringify(v, null, 2));
} else if (cmd === 'submit') {
  // payload file: { url, payload } — perform a fetch() inside a fanqie.com tab so cookies apply
  const data = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
  const tabs = await http('/json');
  let target = tabs.find(t => t.url.includes('fanqie')) || tabs.find(t => t.url.includes('localhost:8732'));
  if (!target) target = tabs[0];
  const c = new C(await newWs(target.webSocketDebuggerUrl));
  // Serve payload via local http so page can fetch it (avoids quoting hell), OR inline as JSON string
  const inline = JSON.stringify(data);
  const expr = `(() => { const d = ${inline}; return fetch(d.url, { method: (d.payload && Object.keys(d.payload).length && !d.method) ? 'GET' : (d.method || (d.payload ? 'POST' : 'GET')), headers: d.headers || (d.payload ? {'Content-Type':'application/json'} : {}), body: d.payload ? JSON.stringify(d.payload) : undefined, credentials: 'include' }).then(async r => { let t = await r.text(); try { return { ok: r.ok, status: r.status, body: t.slice(0, 2000) }; } catch(e) { return { ok:false, err: String(e) }; } }); })()`;
  const v = await c.eval(expr, 90000);
  console.log(JSON.stringify(v, null, 2));
} else {
  console.error('unknown cmd');
  process.exit(1);
}
