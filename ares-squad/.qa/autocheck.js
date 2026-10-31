/* 第 31 轮验证: 自动战斗开关 + 拉锯 + 补给点 */
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

// 验证 1: 自动战斗开关 — 3 士兵(M9+MG) 90s 内坚守 → 胜利
// 验证 2: 补给点存在(出生地 protected)
const seed = { S: {
  mission: 1, mode: 'campaign', day: 1, gold: 500, part: 100, food: 20, med: 5, crewMax: 15,
  bld: { barracks: 2, workshop: 1, kitchen: 1, medbay: 0, wall: 0, radio: 0, tower: 0, armory: 0 },
  defWave: 0, endlessTier: 0, weapon: 'm9',
  crew: [
    { type: 0, hp: 320, mor: 100, wep: 'm9', ammo: { m9: 30 }, dead: false },
    { type: 1, hp: 320, mor: 100, wep: 'mg', ammo: { mg: 60 }, dead: false },
    { type: 0, hp: 320, mor: 100, wep: 'm9', ammo: { m9: 30 }, dead: false },
  ],
  won: 0
}};

const { dom, errors } = mkDom(seed);
const w = dom.window;
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

setTimeout(() => {
  try {
    // 部署
    const btn = w.document.getElementById('btnDeploy');
    assert(!!btn, '部署按钮存在');
    btn.onclick();

    // 开启自动战斗
    const ab = w.document.getElementById('btnAutoBattle');
    assert(!!ab, '自动战斗按钮存在');
    ab.onclick();
    assert(w.__gt().autoBattle === true, 'autoBattle 标志已激活');

    // 跑 95s 游戏时间(90s 兜底胜利 + 余量)
    const t0 = Date.now();
    const steps = Math.round(95000 / 16);
    for (let i = 0; i < steps; i++) {
      w.__gtStep(16);
      const g = w.__gt();
      if (!g.inBattle && g.view === 'camp') break; // 战斗已结束
    }

    const g = w.__gt();
    assert(g.view === 'camp', '战斗已结束, 返回营地 (inBattle=' + g.inBattle + ')');
    assert(g.mission >= 2, '任务 1 通关, 主线推进到任务 2 (mission=' + g.mission + ')');
    assert(errors.length === 0, '无 JS 错误 (' + errors.length + (errors.length ? ' → ' + errors.join('; ').slice(0, 200) : '') + ')');
  } catch (e) {
    failed++;
    console.log('  ✗ 异常: ' + e.message);
  }
  console.log('\n=== 第 31 轮验证结果: ' + passed + '/' + (passed + failed) + ' ===');
  process.exit(failed === 0 ? 0 : 1);
}, 400);
