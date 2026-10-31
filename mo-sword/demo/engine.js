// 《墨剑江湖》游戏引擎：DOM 无关的状态机 + 战斗编排（浏览器 / Node 双端可用）
'use strict';
(function (global) {
  const core = global.MoCore;
  const C = core.C;
  const pickAffixes = core.pickAffixes;
  const HEROES = core.HEROES || {};

  function newGame(seed, heroId) {
    const hid = HEROES[heroId] ? heroId : 'jianke';
    const g = {
      seed: (Number.isFinite(seed) ? seed : (Date.now() | 0)) >>> 0,
      state: 'menu',
      hero: hid,
      sim: new core.Sim((Number.isFinite(seed) ? seed : (Date.now() | 0)) >>> 0, 0, hid),
      time: 0, wave: 0, kills: 0,
      // 主角移动 + 镜头（世界坐标）
      player: { x: C.WORLD.w / 2, y: C.WORLD.h / 2, vx: 0, vy: 0, speed: (HEROES[hid] || {}).speed || C.PLAYER_SPEED },
      cam: { x: C.WORLD.w / 2, y: C.WORLD.h / 2 },
      p: { x: C.PLAYER_POS.x, y: C.PLAYER_POS.y, ink: 0, dir: 0, ang: -Math.PI / 2, hasTarget: false },
      ultFlash: 0,
      buildNames: [],
      heroBuilds: {},   // 各角色独立 build（局内切换保留）
      pickOptions: null,
      enemies: [],
      inkSpots: [],
      particles: [],
      codex: {},
      totalKills: 0,
      bestWave: 0,
      events: [],
      rng: mulberry((Number.isFinite(seed) ? seed : (Date.now() | 0)) >>> 0),
      _lastKills: 0,
      _prevEnemies: null,
    };
    return g;
  }
  function mulberry(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tick(g, dt) {
    if (!g || g.state !== 'playing') return g;
    if (!Number.isFinite(dt) || dt <= 0) return g;
    dt = Math.min(dt, 0.1);
    g.time += dt;
    // 主角移动（摇杆输入 vx/vy 归一化 -1..1，无输入衰减归零）
    if (g.player) {
      const pv = g.player;
      const sp = pv.speed || C.PLAYER_SPEED;
      pv.x = clamp(pv.x + (pv.vx || 0) * sp * dt, 0, C.WORLD.w);
      pv.y = clamp(pv.y + (pv.vy || 0) * sp * dt, 0, C.WORLD.h);
      // 无摇杆输入时速度衰减（避免惯性漂移）
      if (Math.abs(pv.vx) < 0.05 && Math.abs(pv.vy) < 0.05) { pv.vx = 0; pv.vy = 0; }
      // 镜头平滑跟随主角（lerp 0.15），钳制到世界
      const lerp = 0.15;
      g.cam.x = clamp(g.cam.x + (pv.x - g.cam.x) * lerp, 0, C.WORLD.w);
      g.cam.y = clamp(g.cam.y + (pv.y - g.cam.y) * lerp, 0, C.WORLD.h);
    }
    const ok = g.sim.tick(dt, g.player);
    if (!ok && g.sim.over) {
      g.state = 'over';
      g.bestWave = Math.max(g.bestWave, g.sim.wave);
      g.totalKills += g.sim.kills;
      g.kills = g.sim.kills;
      return g;
    }
    // 同步敌人状态（含受击/破盾时间戳，供渲染层做闪白/光效）
    g.enemies = (g.sim.enemies || []).map(function (e, i) {
      const prev = g._prevEnemies && g._prevEnemies[i];
      const hpDrop = prev && prev.hp > e.hp;
      const shieldDrop = prev && prev.shielded && !e.shielded;
      return {
        x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, s: e.s,
        boss: e.boss, shielded: e.shielded,
        type: e.type || 'normal',
        size: e.size || 1,
        touchMult: e.touchMult || 1,
        stunned: !!e.stunned,
        bornAt: prev ? prev.bornAt : g.time,
        hurtAt: hpDrop ? g.time : 0,
        _breakAt: shieldDrop ? g.time : (prev ? prev._breakAt : undefined),
      };
    });
    g._prevEnemies = g.enemies.map(function (e) { return { hp: e.hp, shielded: e.shielded, bornAt: e.bornAt, _breakAt: e._breakAt }; });
    // 同步主角面向角度（自动索敌目标）给渲染层
    g.p.ang = g.sim.targetAng;
    g.p.hasTarget = g.sim.hasTarget;
    // 同步主角血量给渲染层（HUD 血条）
    g.p.hp = g.sim.hp;
    g.p.maxHp = g.sim.maxHp;
    // 击杀墨渍 + 墨粒喷溅（从 sim 检测 diff）
    const prevKills = g._lastKills || 0;
    if (g.sim.kills > prevKills) {
      // 估算新杀位置：取最近敌人区域（用 sim.enemies 中已不存在的，简化用随机落点）
      const n = g.sim.kills - prevKills;
      for (let i = 0; i < n && i < 8; i++) {
        // 用主角位置附近随机落点（无 DOM，纯数值）
        const ang = g.rng() * Math.PI * 2;
        const dist = 0.05 + g.rng() * 0.1;
        const sx = C.PLAYER_POS.x + Math.cos(ang) * dist;
        const sy = C.PLAYER_POS.y + Math.sin(ang) * dist;
        g.inkSpots.push({ x: sx, y: sy, life: 4, boss: false });
        // 墨粒喷溅（向四周飞散）
        for (let j = 0; j < 5 && g.particles.length < 120; j++) {
          const pa = g.rng() * Math.PI * 2;
          const pd = 0.3 + g.rng() * 0.4;
          g.particles.push({ x: sx, y: sy, vx: Math.cos(pa) * pd, vy: Math.sin(pa) * pd, life: 0.6 + g.rng() * 0.4, boss: false });
        }
      }
      g._lastKills = g.sim.kills;
    }
    // 新波次 → 3 选 1 词缀
    if (g.sim.wave > g.wave && g.enemies.length === 0) {
      g.wave = g.sim.wave;
      if (g.sim.wave >= C.INFINITE_FROM) g.sim.mode = 'infinite';
      const opts = pickAffixes(g.rng, 3);
      if (opts && opts.length) {
        g.pickOptions = opts;
        g.state = 'pick';
        g.events.push({ type: 'pick' });
      } else {
        g.wave = 0;
      }
    }
    for (let i = g.inkSpots.length - 1; i >= 0; i--) {
      const s = g.inkSpots[i];
      if (!s) { g.inkSpots.splice(i, 1); continue; }
      s.life -= dt;
      if (s.life <= 0) g.inkSpots.splice(i, 1);
      if (g.inkSpots.length > 40) g.inkSpots.splice(0, g.inkSpots.length - 40);
    }
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i];
      if (!p) { g.particles.splice(i, 1); continue; }
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) g.particles.splice(i, 1);
      if (g.particles.length > 120) g.particles.splice(0, g.particles.length - 120);
    }
    g.ultFlash = Math.max(0, g.ultFlash - dt * 2);
    return g;
  }

  /* ---------------- 主角移动/镜头辅助 ---------------- */
  function clamp(v, lo, hi) {
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }
  // 摇杆输入（归一化向量 -1..1，引擎层不做 UI）
  function setMove(g, nx, ny) {
    if (!g || !g.player) return g;
    g.player.vx = clamp(nx, -1, 1);
    g.player.vy = clamp(ny, -1, 1);
    return g;
  }
  // 角色切换：每 5 波解锁（wave 是 5 的倍数才允许，初始可切换），保留各角色独立 build
  function switchHero(g, heroId) {
    if (!g || !HEROES[heroId] || g.state === 'over') return g;
    // 每 5 波解锁：wave=0 可初始切换，之后需 wave % 5 === 0
    if (g.wave !== 0 && g.wave % 5 !== 0) return g;
    if (g.hero === heroId) return g;
    // 保存当前角色 build
    if (!g.heroBuilds[g.hero]) g.heroBuilds[g.hero] = Object.assign({}, g.sim.build);
    // 切换角色
    g.hero = heroId;
    g.sim.heroId = heroId;
    g.sim.hero = HEROES[heroId];
    // 恢复目标角色 build（若无则用基础 build）
    g.sim.build = g.heroBuilds[heroId] || Object.assign({}, g.sim.build);
    g.player.speed = HEROES[heroId].speed || C.PLAYER_SPEED;
    g.events.push({ type: 'heroSwitch', to: heroId });
    return g;
  }

  function chooseAffix(g, idx) {
    if (g.state !== 'pick' || !g.pickOptions) return g;
    idx = Math.max(0, Math.min(g.pickOptions.length - 1, (idx | 0) || 0));
    const a = g.pickOptions[idx];
    if (!a) { g.state = 'playing'; g.pickOptions = null; return g; }
    g.sim.addAffix(a);
    g.buildNames.push(a.name);
    g.codex[a.id] = (g.codex[a.id] || 0) + 1;
    g.pickOptions = null;
    g.wave = g.sim.wave;
    g.state = 'playing';
    g.events.push({ type: 'affix', id: a.id });
    return g;
  }

  function setDir(g, dir) {
    if (!g || g.state === 'over') return g;
    g.p.dir = Math.max(0, Math.min(3, (dir | 0) || 0));
    return g;
  }

  function ult(g) {
    if (!g || g.state !== 'playing') return g;
    const s = g.sim;
    if (!s || s.ink < C.INK_CAPACITY || s.time < s.ultReadyAt) return g;
    s.ink = 0;
    s.ultReadyAt = s.time + C.ULT_CD * s.build.ucd;
    const dmg = C.ULT_DMG * s.build.ult;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (!e) continue;
      if (e.boss) e.shielded = false;
      e.hp -= dmg;
      if (e.hp <= 0) {
        s.enemies.splice(i, 1); s.kills++;
        s.ink = Math.min(s.build.inkcap, s.ink + C.INK_PER_KILL);
        g.inkSpots.push({ x: e.x, y: e.y, life: 4, boss: e.boss });
      }
    }
    g.ultFlash = 1;
    g.events.push({ type: 'ult' });
    return g;
  }

  /* ---------------- 技能（仿土豆兄弟主动技：CD + 波次缩放） ---------------- */
  // 调用 sim.useSkill；成功后记录事件供渲染层做特效
  function skill(g, id) {
    if (!g || g.state !== 'playing' || !g.sim) return g;
    const ok = g.sim.useSkill(id, g.player);
    if (ok) {
      g.events.push({ type: 'skill', id: id, at: g.sim.time });
      // 技能特效时间戳（渲染层做闪光/环）
      g._skillFlash = { id: id, at: g.time };
    }
    return g;
  }
  // 同步技能 CD 状态给渲染层（HUD 技钮显隐/冷却）
  function skillStates(g) {
    const SKILLS = (core.SKILLS || {});
    const out = [];
    for (const id of (core.SKILL_IDS || [])) {
      const s = g.sim._skillStat(id);
      out.push({
        id: id,
        name: SKILLS[id] ? SKILLS[id].name : id,
        key: SKILLS[id] ? SKILLS[id].key : '',
        ready: s ? s.ready : false,
        cdProgress: s ? g.sim.skillCdProgress(id) : 1,
      });
    }
    return out;
  }

  function start(g, seed, heroId) {
    const hid = HEROES[heroId] ? heroId : g.hero;
    g.seed = (Number.isFinite(seed) ? seed : ((Math.random() * 0x7fffffff) | 0)) >>> 0;
    g.hero = hid;
    g.sim = new core.Sim(g.seed, 0, hid);
    g.rng = mulberry(g.seed);
    g.state = 'playing';
    g.time = 0; g.wave = 0; g.kills = 0;
    g.enemies = []; g.inkSpots = []; g.particles = [];
    g.buildNames = []; g.codex = {}; g.pickOptions = null;
    g.heroBuilds = {};
    g._lastKills = 0;
    g._prevEnemies = null;
    g.player = { x: C.WORLD.w / 2, y: C.WORLD.h / 2, vx: 0, vy: 0, speed: (HEROES[hid] || {}).speed || C.PLAYER_SPEED };
    g.cam = { x: C.WORLD.w / 2, y: C.WORLD.h / 2 };
    g.p = { x: C.PLAYER_POS.x, y: C.PLAYER_POS.y, ink: 0, dir: 0, ang: -Math.PI / 2, hasTarget: false };
    g.ultFlash = 0;
    g.events = [];
    return g;
  }

  function pause(g) {
    if (g && g.state === 'playing') { g.state = 'pause'; g.events.push({ type: 'pause' }); }
    return g;
  }
  function resume(g) {
    if (g && g.state === 'pause') { g.state = 'playing'; g.events.push({ type: 'resume' }); }
    return g;
  }
  function drainEvents(g) {
    const e = g.events; g.events = [];
    return e;
  }
  function codexCount(g) {
    let n = 0;
    for (const k in g.codex) n += (g.codex[k] || 0) || 0;
    return n;
  }

  const api = {
    newGame: newGame, tick: tick, chooseAffix: chooseAffix, setDir: setDir,
    setMove: setMove, switchHero: switchHero, ult: ult, start: start,
    pause: pause, resume: resume, drainEvents: drainEvents, codexCount: codexCount,
    skill: skill, skillStates: skillStates,
  };
  global.MoEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
