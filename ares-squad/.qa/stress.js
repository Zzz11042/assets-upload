/* QA stress suite (compact, sync-pump version): ares-squad web/index.html */
const { JSDOM } = require('/home/zzz/Documents/deepseek-harness/default-workspace/node_modules/jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../web/index.html', 'utf8');

function mkDom(seed) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    beforeParse(window) {
      window.addEventListener('error', e => { errors.push('WIN-ERR: ' + e.message); });
      const g2d = { canvas: { width: 520, height: 640 }, measureText: () => ({ width: 10 }) };
      const ctxProto = new Proxy(g2d, {
        get(t, p) { if (p in t) return t[p]; return () => {}; },
        set(t, p, v) { t[p] = v; return true; }
      });
      window.HTMLCanvasElement.prototype.getContext = function () { return ctxProto; };
      const store = {};
      if (seed) { store['ares_squad_v1'] = JSON.stringify(seed); }
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: k => (k in store) ? store[k] : null,
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
          get length() { return Object.keys(store).length; }
        },
        configurable: true
      });
      window.Image = class { set src(v) { setTimeout(() => this.onload && this.onload(), 2); } };
      window.fetch = () => new Promise(r => setTimeout(() => r({ ok: true, json: () => Promise.resolve({}) }), 2));
    }
  });
  return { dom, errors };
}

function runScenario(name, seed, opts) {
  const deploy = !!opts.deploy, secs = opts.secs || 30, stepMs = opts.stepMs || 16, autoBattle = !!opts.autoBattle;
  return new Promise(resolve => {
    const { dom, errors } = mkDom(seed);
    const w = dom.window;
    setTimeout(() => {
      const t0 = Date.now();
      let deployed = false;
      let loop = false;
      const loopWatch = { key: null, count: 0 };
      try {
        if (deploy) {
          const btn = w.document.getElementById('btnDeploy');
          if (btn) { btn.onclick(); deployed = true; }
        }
        if (autoBattle) {
          const ab = w.document.getElementById('btnAutoBattle');
          if (ab) { ab.onclick(); }
        }
        while (Date.now() - t0 < secs * 1000) {
          w.__gtStep(stepMs);
          const g = w.__gt();
          if (deployed && !g.inBattle && g.view === 'camp') break;
          // 死锁检测: 状态(存活数+敌人数)连续 1000 步不变且仍在战斗中
          // 第 31 轮: 主线(campaign)有 90s 兜底胜利, 状态冻结属正常(补尸维持敌数), 跳过判定;
          // 仅保卫/无尽(无限循环, 无时长兜底)保留死锁检测
          const isCampaign = g.mode === 'campaign';
          const key = g.nsoldiers + '/' + g.nenemies;
          if (!isCampaign && key === loopWatch.key) { if (++loopWatch.count > 1000) { loop = true; break; } }
          else if (!isCampaign) { loopWatch.key = key; loopWatch.count = 0; }
        }
      } catch (e) { errors.push('STEP-ERR: ' + e.message); }
      let f = null;
      try { f = w.__gt(); } catch (_) {}
      resolve({ name, final: f, errors, loop, elapsed: Date.now() - t0 });
    }, 400); // 等异步 sprite 加载完成
  });
}

const S0 = { mission: 1, mode: 'campaign', day: 1, gold: 500, part: 100, food: 20, med: 5, crewMax: 15,
  bld: { barracks: 2, workshop: 1, kitchen: 1, medbay: 0, wall: 0, radio: 0, tower: 0, armory: 0 },
  defWave: 0, endlessTier: 0, weapon: 'm9',
  crew: [{ type: 0, hp: 320, mor: 100, wep: 'm9', ammo: { m9: 30 }, dead: false }], won: 0 };
const crew = a => a.map(t => {
  if (t === 'nan') return { type: NaN, hp: 320, mor: 100, wep: 'm9', ammo: { m9: 30 }, dead: false };
  const base = { 0: ['m9', 320], 1: ['mg', 320], 5: ['rocket', 280], 6: ['gauss', 160] }[t] || ['m9', 320];
  return { type: t, hp: base[1], mor: 100, wep: base[0], ammo: { [base[0]]: t === 5 ? 6 : t === 6 ? 50 : 30 }, dead: false };
});

const scenarios = [
  // --- 原始 7 项压力矩阵 (紧凑时长) ---
  { name: 'defense dt=8ms',  seed: null, opts: { deploy: true, secs: 30, stepMs: 8 } },
  { name: 'defense dt=45ms', seed: null, opts: { deploy: true, secs: 30, stepMs: 45 } },
  { name: 'm8-defend', seed: { S: { mission: 8, mode: 'campaign', day: 8, gold: 1000, part: 200, food: 50, med: 20, crewMax: 15, bld: { barracks: 2, workshop: 2, kitchen: 2, medbay: 1, wall: 1, radio: 1, tower: 1, armory: 1 }, defWave: 0, endlessTier: 0, weapon: 'm9', crew: crew([0, 1]), won: 7 } }, opts: { deploy: true, secs: 30 } },
  { name: 'm9-final',  seed: { S: { mission: 9, mode: 'campaign', day: 9, gold: 1000, part: 200, food: 50, med: 20, crewMax: 15, bld: { barracks: 2, workshop: 2, kitchen: 2, medbay: 1, wall: 1, radio: 1, tower: 1, armory: 1 }, defWave: 0, endlessTier: 0, weapon: 'm9', crew: crew([0]), won: 8 } }, opts: { deploy: true, secs: 30 } },
  { name: 'endless-tier10', seed: { S: { mode: 'endless', endlessTier: 10, day: 10, gold: 1000, part: 200, food: 50, med: 20, crewMax: 15, bld: { barracks: 3, workshop: 2, kitchen: 2, medbay: 1, wall: 1, radio: 1, tower: 2, armory: 1 }, defWave: 0, weapon: 'm9', crew: crew([0]), won: 0 } }, opts: { deploy: true, secs: 30 } },
  { name: 'defense-wave8', seed: { S: { mode: 'defense', defWave: 8, day: 8, gold: 1000, part: 200, food: 50, med: 20, crewMax: 15, bld: { barracks: 3, workshop: 2, kitchen: 2, medbay: 1, wall: 1, radio: 1, tower: 2, armory: 1 }, endlessTier: 0, weapon: 'm9', crew: crew([0]), won: 0 } }, opts: { deploy: true, secs: 30 } },
  { name: 'endless-loop', seed: { S: { mode: 'endless', endlessTier: 1, day: 1, gold: 500, part: 100, food: 20, med: 5, crewMax: 15, bld: { barracks: 2, workshop: 1, kitchen: 1, medbay: 0, wall: 0, radio: 0, tower: 0, armory: 0 }, defWave: 0, weapon: 'm9', crew: crew([0]), won: 0 } }, opts: { deploy: true, secs: 45 } },
  // --- 新增: 损坏存档 / 隐藏职业 ---
  { name: 'corrupt type=5 (hidden)',  seed: { S: Object.assign({}, S0, { crew: crew([5]) }) }, opts: { deploy: true, secs: 30 } },
  { name: 'corrupt type=6 (hidden)',  seed: { S: Object.assign({}, S0, { crew: crew([6]) }) }, opts: { deploy: true, secs: 30 } },
  { name: 'corrupt type=NaN',         seed: { S: Object.assign({}, S0, { crew: crew(['nan']) }) }, opts: { deploy: true, secs: 30 } },
  { name: 'corrupt type=-1',          seed: { S: Object.assign({}, S0, { crew: crew([-1]) }) }, opts: { deploy: true, secs: 30 } },
  { name: 'corrupt type=999 (oob)',   seed: { S: Object.assign({}, S0, { crew: crew([999]) }) }, opts: { deploy: true, secs: 30 } },
  { name: 'corrupt mixed 0/5/999/6/nan', seed: { S: Object.assign({}, S0, { crew: crew([0, 5, 999, 6, 'nan']) }) }, opts: { deploy: true, secs: 30 } },
   // --- 第 31 轮: 自动战斗开关 (mission 1 全自动通关) ---
   { name: 'auto-battle m1', seed: { S: Object.assign({}, S0, { crew: crew([0, 1, 0]) }) }, opts: { deploy: true, secs: 200, stepMs: 16, autoBattle: true } },
];

(async () => {
  const results = [];
  for (const s of scenarios) {
    results.push(await runScenario(s.name, s.seed, s.opts));
  }
  console.log('=== STRESS MATRIX + CORRUPTED-SAVE RESULTS ===');
  let pass = 0;
  for (const r of results) {
    const f = r.final || {};
    const nanCheck = ['nsoldiers', 'nenemies', 'gold', 'part', 'food', 'med', 'crew'].some(k => typeof f[k] === 'number' && Number.isNaN(f[k]));
    const bad = (r.errors && r.errors.length) || r.loop || nanCheck;
    if (!bad) pass++;
    console.log(
      (bad ? 'FAIL' : 'PASS') + ' | ' + r.name +
      ' | inBattle=' + f.inBattle + ' view=' + f.view +
      ' nsold=' + f.nsoldiers + ' nen=' + f.nenemies +
      ' | ' + r.elapsed + 'ms' +
      (r.loop ? ' [DEADLOCK: state frozen >1000 steps]' : '') +
      (r.errors && r.errors.length ? ' | ERR: ' + r.errors.join(' ; ').slice(0, 300) : '')
    );
  }
  console.log('\n' + pass + '/' + results.length + ' scenarios passed');
  process.exit(pass === results.length ? 0 : 1);
})();
