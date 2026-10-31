// 《墨剑江湖》无头验证与单元测试（Node 直接运行：node test.js）
'use strict';
const assert = require('assert');
const core = require('./core.js');
const engine = require('./engine.js');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  PASS', name); }
  catch (e) { failed++; console.log('  FAIL', name, '-', e && e.message); }
}

console.log('\n== core.js ==');
t('Sim tick dt 越界不崩（NaN/负数/超大 dt）', () => {
  const s = new core.Sim(1, 0, 'jianke');
  assert.strictEqual(s.tick(NaN), true);
  assert.strictEqual(s.tick(-1), true);
  assert.strictEqual(s.tick(5), true);
  assert.ok(s.time === 0);
});
t('tick 正常推进时间', () => {
  const s = new core.Sim(1, 0, 'jianke');
  s.tick(0.1);
  assert.ok(Math.abs(s.time - 0.1) < 1e-9);
});
t('pickAffixes 返回 3 张且不重复', () => {
  let seed = 42;
  const rng = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let x = Math.imul(seed ^ (seed >>> 15), seed | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 50; i++) {
    const out = core.pickAffixes(rng, 3);
    assert.strictEqual(out.length, 3, '应返回 3 张');
    const ids = out.map(a => a.id);
    assert.strictEqual(new Set(ids).size, 3, '不应重复');
  }
});
t('词缀池 36 张 且稀有度桶 22/8/4/2/1', () => {
  assert.strictEqual(core.AFFIXES.length, 36);
  const cnt = [0, 0, 0, 0, 0];
  core.AFFIXES.forEach(a => { cnt[a.tier - 1]++; });
  assert.deepStrictEqual(cnt, core.AFFIX_TIER_COUNT);
});
t('HEROES 3 角色且攻速/射程差异化', () => {
  assert.strictEqual(core.HERO_IDS.length, 3);
  const jk = core.HEROES.jianke, ss = core.HEROES.shushi, q = core.HEROES.qiang;
  assert.ok(jk && ss && q, '3 角色都应存在');
  // 枪手攻速最高
  assert.ok(q.atk.rate > jk.atk.rate, '墨枪手攻速应高于墨剑客');
  assert.ok(q.atk.rate > ss.atk.rate, '墨枪手攻速应高于墨术士');
  // 术士射程最远
  assert.ok(ss.atk.range > jk.atk.range, '墨术士射程应最远');
  assert.ok(ss.atk.range > q.atk.range, '墨术士射程应大于墨枪手');
});
t('攻击范围/伤害已下调（基准 range 0.8 / dmg 9）', () => {
  assert.strictEqual(core.C.BASE_ATTACK.range, 0.8);
  assert.strictEqual(core.C.BASE_ATTACK.dmg, 9);
  assert.strictEqual(core.C.WORLD.w, 3.0);
  assert.strictEqual(core.C.WORLD.h, 3.0);
});
t('Sim 接受 heroId 并应用角色攻击参数', () => {
  const s = new core.Sim(1, 0, 'shushi');
  const st = s._atkStats();
  assert.strictEqual(st.rate, 1.2, '术士攻速 1.2');
  assert.strictEqual(st.range, 1.4, '术士射程 1.4');
  assert.strictEqual(st.splash, 2, '术士溅射 2');
});

console.log('\n== engine.js ==');
t('newGame 初始状态合法', () => {
  const g = engine.newGame(7);
  assert.strictEqual(g.state, 'menu');
  assert.strictEqual(g.sim.wave, 0);
  assert.ok(g.enemies.length === 0);
});
t('start 后 state=playing', () => {
  const g = engine.newGame(7);
  engine.start(g, 99);
  assert.strictEqual(g.state, 'playing');
});
t('tick 在 over 后不再推进', () => {
  const g = engine.newGame(7);
  engine.start(g, 99);
  g.state = 'over';
  const before = g.time;
  engine.tick(g, 0.1);
  assert.strictEqual(g.time, before);
});
t('chooseAffix 在 pick 态才生效', () => {
  const g = engine.newGame(7);
  engine.start(g, 99);
  const before = g.sim.build.a;
  engine.chooseAffix(g, 0); // 非 pick 态，应无效
  assert.strictEqual(g.sim.build.a, before);
});
t('tick 触发 3 选 1 后 state=pick', () => {
  const g = engine.newGame(42);
  engine.start(g, 42);
  let sawPick = false;
  for (let i = 0; i < 4000; i++) {
    engine.tick(g, 0.1);
    if (g.state === 'pick') { sawPick = true; assert.ok(g.pickOptions && g.pickOptions.length === 3); break; }
    if (g.state === 'over') break;
  }
  assert.ok(sawPick, '应在游戏过程中触发 pick');
});
t('select 后回 playing 且 build 改变', () => {
  const g = engine.newGame(42);
  engine.start(g, 42);
  for (let i = 0; i < 4000; i++) {
    engine.tick(g, 0.1);
    if (g.state === 'pick') break;
    if (g.state === 'over') break;
  }
  if (g.state === 'pick') {
    const a0 = g.sim.build.a;
    engine.chooseAffix(g, 0);
    assert.strictEqual(g.state, 'playing');
    assert.ok(g.buildNames.length === 1);
    assert.ok(g.sim.build.a >= a0);
  }
});
t('ult 需满墨量，否则无效', () => {
  const g = engine.newGame(7);
  engine.start(g, 7, 'jianke');
  for (let i = 0; i < 200; i++) engine.tick(g, 0.1);
  const inkBefore = g.sim.ink;
  engine.ult(g);
  assert.strictEqual(g.sim.ink, inkBefore, '未满墨量时 ult 不应扣墨');
});
t('newGame 带 heroId 且玩家/镜头初始化在世界中心', () => {
  const g = engine.newGame(7, 'qiang');
  assert.strictEqual(g.hero, 'qiang');
  assert.ok(Math.abs(g.player.x - 1.5) < 1e-6 && Math.abs(g.player.y - 1.5) < 1e-6, '主角应在世界中心');
  assert.ok(Math.abs(g.cam.x - 1.5) < 1e-6, '镜头应跟随主角');
  assert.ok(g.player.speed > 0, '主角应有移动速度');
});
t('setMove 驱动主角移动且钳制在世界边界', () => {
  const g = engine.newGame(7, 'jianke');
  engine.start(g, 7, 'jianke');
  engine.setMove(g, -1, -1); // 向左上
  for (let i = 0; i < 500; i++) engine.tick(g, 0.1); // 50s，足够出界
  assert.ok(g.player.x >= 0 - 1e-6 && g.player.x <= core.C.WORLD.w + 1e-6, 'x 应钳制在世界内');
  assert.ok(g.player.y >= 0 - 1e-6 && g.player.y <= core.C.WORLD.h + 1e-6, 'y 应钳制在世界内');
  // 镜头也应钳制
  assert.ok(g.cam.x >= 0 && g.cam.x <= core.C.WORLD.w, '镜头 x 钳制');
});
t('switchHero 需 5 波整数倍且切换生效', () => {
  const g = engine.newGame(7, 'jianke');
  engine.start(g, 7, 'jianke');
  assert.strictEqual(g.hero, 'jianke');
  // 模拟到 wave=3（非 5 倍数）不可切换
  g.wave = 3;
  g.state = 'playing';
  engine.switchHero(g, 'shushi');
  assert.strictEqual(g.hero, 'jianke', 'wave=3 不应切换');
  // wave=5 可切换
  g.wave = 5;
  engine.switchHero(g, 'qiang');
  assert.strictEqual(g.hero, 'qiang', 'wave=5 应切到墨枪手');
  assert.strictEqual(g.sim.heroId, 'qiang');
  assert.ok(Math.abs(g.player.speed - core.HEROES.qiang.speed) < 1e-6, '切换后应继承枪手速度');
});

console.log('\n== 怪物类型 ==');
t('ENEMY_TYPES 含 快/肉/中 + 墨蛟 且数值差异化', () => {
  assert.strictEqual(core.ENEMY_TYPES.jiao.boss, true);
  assert.ok(core.ENEMY_TYPES.slow.hpMult > core.ENEMY_TYPES.normal.hpMult, '墨盾血厚于墨点');
  assert.ok(core.ENEMY_TYPES.fast.sp > core.ENEMY_TYPES.normal.sp, '墨蝶快于墨点');
  assert.ok(core.ENEMY_TYPES.slow.sp < core.ENEMY_TYPES.fast.sp, '墨盾慢于墨蝶');
  assert.ok(core.ENEMY_TYPES.fast.touchMult < 1, '墨蝶贴近伤低于墨点');
  assert.strictEqual(core.ENEMY_TYPE_IDS.length, 3, '3 种普通怪');
});
t('按波次混布：wave=1 只有墨点，wave=5+ 有墨蝶', () => {
  const s1 = new core.Sim(7, 0, 'jianke');
  s1.wave = 1;
  const t1 = s1._pickEnemyType().id;
  assert.strictEqual(t1, 'normal', 'wave=1 应只有墨点');
  const s5 = new core.Sim(7, 0, 'jianke');
  s5.wave = 5;
  // 高权重采 500 次，必出现 fast
  let sawFast = false;
  for (let i = 0; i < 500; i++) { if (s5._pickEnemyType().id === 'fast') { sawFast = true; break; } }
  assert.ok(sawFast, 'wave=5 应能刷出墨蝶');
});
t('刷出的普通怪带 type/size/touchMult 字段', () => {
  const s = new core.Sim(7, 0, 'jianke');
  s.wave = 5;
  for (let i = 0; i < 60; i++) s.tick(0.1);
  assert.ok(s.enemies.length > 0, '应有怪');
  for (const e of s.enemies) {
    assert.ok(e.type && e.size && e.touchMult !== undefined, '怪应带类型字段');
    assert.ok(!e.boss, '前 6s 不应出墨蛟');
  }
});

console.log('\n== 技能（仿土豆兄弟） ==');
t('SKILLS 含 墨爆/墨滞/噬墨 3 个主动技 + 3 键位', () => {
  assert.strictEqual(core.SKILL_IDS.length, 3);
  const s = new core.Sim(7, 0, 'jianke');
  assert.strictEqual(typeof s._skillStat('nova').dmg, 'number', '墨爆应有波次缩放伤害');
  assert.strictEqual(core.SKILLS.nova.key, '1');
  assert.strictEqual(core.SKILLS.stun.key, '2');
  assert.strictEqual(core.SKILLS.drain.key, '3');
});
t('墨爆：CD 内不可连放，CD 好可放且伤敌人', () => {
  const s = new core.Sim(7, 0, 'jianke');
  s.time = 10; s.wave = 1;
  s.enemies.push(s._mkEnemy(0.51, 0.5, 0.5, 30, false));
  assert.ok(s.useSkill('nova', { x: 0.5, y: 0.5 }), 'CD 好应可用');
  assert.ok(s.enemies.length === 0 || s.enemies[0].hp < 30, '墨爆应伤近身怪');
  assert.ok(!s.useSkill('nova', { x: 0.5, y: 0.5 }), 'CD 中不应再放');
});
t('墨滞：凝滞窗口内敌人停止移动', () => {
  const s = new core.Sim(7, 0, 'jianke');
  s.time = 10;
  s.enemies.push(s._mkEnemy(1.5, 2.0, 0.2, 100, false));
  s.useSkill('stun', { x: 0.5, y: 0.5 });
  const before = s.enemies[0].x;
  s.tick(0.5, { x: 0.5, y: 0.5 });
  const after = s.enemies[0].x;
  assert.ok(Math.abs(after - before) < 1e-6, '凝滞中怪应原地不动');
});
t('噬墨：窗口内击杀回血', () => {
  const s = new core.Sim(7, 0, 'jianke');
  s.time = 10;
  s.hp = 50;
  s.enemies.push(s._mkEnemy(0.5, 0.5, 0.5, 10, false));
  assert.ok(s.useSkill('drain', { x: 0.5, y: 0.5 }), '噬墨应可放');
  s.enemies[0].hp = 0; // 触发击杀路径（手动置 0 再 tick 清）
  s.tick(0.1, { x: 0.5, y: 0.5 });
  assert.ok(s.hp > 50, '噬墨窗口击杀应回血');
});
t('engine.skill 在 playing 态生效且记事件', () => {
  const g = engine.newGame(7, 'jianke');
  engine.start(g, 7, 'jianke');
  g.sim.time = 20;
  const evBefore = g.events.length;
  g._prev = g.sim.skillReadyAt.nova;
  g.sim.skillReadyAt.nova = 0; // 强制 CD 好
  engine.skill(g, 'nova');
  assert.ok(g.events.length > evBefore && g.events[g.events.length - 1].type === 'skill', '应记 skill 事件');
  const states = engine.skillStates(g);
  assert.strictEqual(states.length, 3, '应返回 3 个技能状态');
  assert.ok(states.every(st => st.id && typeof st.cdProgress === 'number'), '每个状态应含 CD 进度');
});

console.log('\n== 无头长跑 3600s（lv30，seed 42，墨剑客） ==');
(function longRun() {
  const s = new core.Sim(42, 30, 'jianke');
  let waveMark = 1, steps = 0;
  const rng = core.Sim.prototype._rng; // 用 seed 驱动
  function myRng() {
    let t = (s.seed += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  let maxEnemies = 0;
  while (!s.over && s.time < 3600) {
    const reached = Math.min(110, Math.max(1, Math.floor((s.time - 3) / 30) + 1));
    while (waveMark <= reached && !s.over) {
      const a = core.pickAffixes(myRng, 1)[0];
      if (a) s.addAffix(a);
      waveMark++;
    }
    s.tick(0.1);
    steps++;
    maxEnemies = Math.max(maxEnemies, s.enemies.length);
    if (steps > 400000) { console.log('  FAIL 超步数限制'); failed++; return; }
  }
  const reached = s.wave;
  console.log('  wave=' + reached + ' kills=' + s.kills + ' time=' + s.time.toFixed(0) + ' over=' + s.over
    + ' maxEnemies=' + maxEnemies
    + ' ults=' + s.log.filter(x => x.startsWith('ult')).length
    + ' bosses=' + s.log.filter(x => x.includes('BOSS')).length
    + ' shieldbreaks=' + s.log.filter(x => x.startsWith('shieldbreak')).length);
  // 目标：lv30 应打到 15+ 波（无尽模式），墨蛟可被击杀（不破盾也被大招击杀），同屏不超限
  assert.ok(reached >= 15, 'lv30 应至少打到 15 波（无尽），实际 ' + reached);
  assert.ok(s.log.some(x => x.startsWith('ult')), '应释放大招');
  assert.ok(maxEnemies <= core.C.MAX_CONCURRENT, '同屏不应超上限');
  assert.ok(steps < 400000, '步数应在合理范围');
  passed++; console.log('  PASS 长跑 3600s 数值达成目标');
})();

console.log('\n== 确定性 ==');
(function det() {
  function run(seed, sLv, heroId) {
    const s = new core.Sim(seed, sLv, heroId);
    let waveMark = 1, steps = 0;
    function myRng() {
      let t = (s.seed += 0x6D2B79F5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    while (!s.over && s.time < 600) {
      const reached = Math.min(30, Math.max(1, Math.floor((s.time - 3) / 30) + 1));
      while (waveMark <= reached && !s.over) {
        const a = core.pickAffixes(myRng, 1)[0];
        if (a) s.addAffix(a);
        waveMark++;
      }
      s.tick(0.1); steps++;
      if (steps > 200000) break;
    }
    return JSON.stringify({ wave: s.wave, kills: s.kills, time: +s.time.toFixed(1), over: s.over });
  }
  const a = run(42, 0, 'jianke'), b = run(42, 0, 'jianke');
  assert.strictEqual(a, b, '同 seed 应完全确定性');
  passed++; console.log('  PASS 确定性（' + a + '）');
  // 3 角色进度差异（确定性）
  const hj = run(42, 0, 'jianke'), hs = run(42, 0, 'shushi'), hq = run(42, 0, 'qiang');
  console.log('  角色进度 jianke=' + hj + ' shushi=' + hs + ' qiang=' + hq);
  assert.ok(hj !== hs || hs !== hq || hj !== hq, '3 角色进度应有差异');
  passed++; console.log('  PASS 3 角色进度差异');
})();

console.log('\n== 总结 ==');
console.log('PASS ' + passed + ' / FAIL ' + failed);
if (failed > 0) process.exitCode = 1;
