// 《墨剑江湖》核心逻辑（纯函数、无 DOM 依赖，浏览器 / Node 均可直接运行）
'use strict';
(function (global) {

  /* ---------------- 数值常量 ---------------- */
  const C = {
    WAVE_SECONDS: 30,
    WAVE_HP_BASE: 8,           // 提高怪物血量（原 6，配合技能/词缀成长）
    WAVE_HP_GROWTH: 1.16,      // 提高成长（原 1.2 → 1.16，防后期卡关）
    WAVE_COUNT_GROWTH: 1.05,
    COUNT_CAP: 110,
    ENEMY_LIFE_TARGET: 4,
    FIRST_WAVE_AT: 3,
    INFINITE_FROM: 15,
    BOSS_EVERY: 10,
    MAX_CONCURRENT: 90,
    SPAWN_RATE_PER_S: 6,
    SPAWN_EDGE: 0.06,
    // 世界尺寸（主角可移动区域，镜头跟随）
    WORLD: { w: 3.0, h: 3.0 },
    // 玩家位置（世界坐标归一化，渲染层映射到屏幕）
    PLAYER_POS: { x: 0.5, y: 0.5 },
    PLAYER_SPEED: 0.35,          // 主角移动速度（世界单位/秒）
    // 基础攻击（数值下调：范围 0.8 / 伤害 9，配合角色特长拉开差距）
    BASE_ATTACK: { rate: 1.6, dmg: 9, range: 0.8 },
    // 主角血量（被墨点贴近扣血，归零死亡；每波回血）
    PLAYER_HP: 140,
    ENEMY_TOUCH_DMG: 10,      // 单只墨点贴近伤害（按波次略微增长，按类型 touchMult 差异化）
    HEAL_PER_WAVE: 20,        // 每波回血（提高防连体死）
    SCHOOL_DPS_MULT: 0.3,
    INK_CAPACITY: 100,
    ULT_DMG: 220,
    ULT_CD: 18,
    INK_PER_KILL: 5,
    INK_REGEN: 4,
    DIRS: ['上', '下', '左', '右'],
  };

  /* ---------------- 怪物类型表（仿土豆兄弟多体型：快/肉/中 + 墨蛟） ---------------- */
  // hpMult 相对基础波血量的倍数；sp 基础移速；touchMult 贴近扣血倍数；size 体型渲染系数
  const ENEMY_TYPES = {
    jiao:   { id: 'jiao',   name: '墨蛟',   hpMult: 4.0, sp: 0.50, touchMult: 2.0, size: 2.2, boss: true },
    slow:   { id: 'slow',   name: '墨盾',   hpMult: 2.4, sp: 0.055, touchMult: 1.2, size: 1.25, weight: 30, fromWave: 3 },
    fast:   { id: 'fast',   name: '墨蝶',   hpMult: 0.55, sp: 0.13, touchMult: 0.6, size: 0.7, weight: 45, fromWave: 5 },
    normal: { id: 'normal', name: '墨点',   hpMult: 1.0, sp: 0.07, touchMult: 1.0, size: 1.0, weight: 100, fromWave: 1 },
  };
  const ENEMY_TYPE_IDS = ['normal', 'slow', 'fast'];

  /* ---------------- 技能表（仿土豆兄弟主动技能：CD + 波次缩放 + 全局目标） ---------------- */
  const SKILLS = {
    nova:  { id: 'nova',  name: '墨爆', key: '1', baseDmg: 50,  cd: 6,  radius: 0.55, desc: '以自身为心爆发墨爆，重创附近墨点' },
    stun:  { id: 'stun',  name: '墨滞', key: '2', duration: 1.2, cd: 8,  radius: 0.5,  desc: '凝滞附近墨点行动 1.2s' },
    drain: { id: 'drain', name: '噬墨', key: '3', healPerKill: 4, cd: 10, window: 4,  desc: '4s 内击杀回血（每只 +4 HP）' },
  };
  const SKILL_IDS = ['nova', 'stun', 'drain'];

  /* ---------------- 3 角色表（攻击方式 + 数值特长） ---------------- */
  const HEROES = {
    jianke: {
      id: 'jianke', name: '墨剑客', role: '均衡近战',
      atk: { rate: 1.6, dmg: 9, range: 0.8 },
      speed: 0.35,
      ult: { type: 'clear', dmg: 220 },
      trait: '基础均衡，大招清屏',
    },
    shushi: {
      id: 'shushi', name: '墨术士', role: '远程溅射',
      atk: { rate: 1.2, dmg: 14, range: 1.4 },
      speed: 0.3,
      ult: { type: 'area', dmg: 180 },
      trait: '攻速低伤害高，溅射 2 墨点，射程远',
      splash: 2,
    },
    qiang: {
      id: 'qiang', name: '墨枪手', role: '超快连射',
      atk: { rate: 3.2, dmg: 5, range: 0.7 },
      speed: 0.4,
      ult: { type: 'clear', dmg: 160 },
      trait: '攻速极快，穿透 1，冷却短',
      pierce: 1,
      ucdMult: 0.7,
    },
  };
  const HERO_IDS = ['jianke', 'shushi', 'qiang'];

  const SCHOOLS = ['剑胎', '剑典', '剑心', '剑魄', '剑罡', '剑影', '寒锋', '流墨', '墨魂'];
  const SCHOOL_LEVELS = 100;

  const AFFIXES = [
    // 常见 22 (60%)
    { id: 'dmg1', name: '剑意', tier: 1, desc: '攻击 +15%', a: 1.15 },
    { id: 'rate1', name: '风助', tier: 1, desc: '攻速 +12%', r: 1.12 },
    { id: 'dmg2', name: '锋锐', tier: 1, desc: '攻击 +25%', a: 1.25 },
    { id: 'rate2', name: '轻身', tier: 1, desc: '攻速 +20%', r: 1.2 },
    { id: 'range1', name: '剑气', tier: 1, desc: '剑气距离 +12%', g: 1.12 },
    { id: 'ink1', name: '回墨', tier: 1, desc: '墨量回复 +20%', ink: 1.2 },
    { id: 'ult1', name: '凝墨', tier: 1, desc: '大招伤害 +10%', u: 1.1 },
    { id: 'ult2', name: '墨涌', tier: 1, desc: '大招冷却 -10%', uc: 0.9 },
    { id: 'pierce1', name: '裂墨', tier: 1, desc: '穿透 +1', p: 1 },
    { id: 'dmg3', name: '重剑', tier: 1, desc: '攻击 +40%', a: 1.4 },
    { id: 'dmg5', name: '寒霜', tier: 1, desc: '攻击 +20%', a: 1.2 },
    { id: 'rate3', name: '轻灵', tier: 1, desc: '攻速 +15%', r: 1.15 },
    { id: 'range2', name: '远锋', tier: 1, desc: '剑气距离 +20%', g: 1.2 },
    { id: 'ink3', name: '墨潮', tier: 1, desc: '墨量上限 +10', inkcap: 10 },
    { id: 'ult5', name: '墨刃', tier: 1, desc: '大招伤害 +15%', u: 1.15 },
    { id: 'ult6', name: '墨疾', tier: 1, desc: '大招冷却 -15%', uc: 0.85 },
    { id: 'pierce2', name: '裂风', tier: 1, desc: '穿透 +1', p: 1 },
    { id: 'rate4', name: '迅捷', tier: 1, desc: '攻速 +25%', r: 1.25 },
    { id: 'regen2', name: '墨息', tier: 1, desc: '每波结束回墨 10', regen: 10 },
    { id: 'frost2', name: '墨缓', tier: 1, desc: '墨点减速 10%', f: 0.1 },
    { id: 'ink4', name: '墨源', tier: 1, desc: '墨量回复 +35%', ink: 1.35 },
    // 良好 8 (25%)
    { id: 'splash', name: '墨溅', tier: 2, desc: '击中溅射 3 墨点', s: 3 },
    { id: 'frost', name: '墨霜', tier: 2, desc: '墨点减速 25%', f: 0.25 },
    { id: 'haste', name: '追风', tier: 2, desc: '攻速 +30%', r: 1.3 },
    { id: 'ink2', name: '墨灵', tier: 2, desc: '墨量上限 +20', inkcap: 20 },
    { id: 'regen', name: '剑灵', tier: 2, desc: '每波结束时回墨 20', regen: 20 },
    { id: 'ult3', name: '墨焰', tier: 2, desc: '大招范围 +30%', ur: 1.3 },
    { id: 'dmg4', name: '淬剑', tier: 2, desc: '攻击 +60%', a: 1.6 },
    { id: 'dodge', name: '云步', tier: 2, desc: '闪避率 +8%', d: 0.08 },
    // 优秀 4 (10%)
    { id: 'chain', name: '剑链', tier: 3, desc: '连锁闪电 5 目标', chain: 5 },
    { id: 'crit', name: '破势', tier: 3, desc: '暴击率 +20%', c: 0.2 },
    { id: 'ult4', name: '天剑', tier: 3, desc: '大招伤害 +50%', u: 1.5 },
    { id: 'vamp', name: '噬墨', tier: 3, desc: '击杀回墨 5', v: 5 },
    // 稀有 2 (4%)
    { id: 'meteor', name: '天陨', tier: 4, desc: '每 15s 墨陨天降', m: 15 },
    { id: 'double', name: '剑影重击', tier: 4, desc: '每 4 击必杀', dd: 4 },
    // 传说 1 (1%)
    { id: 'soul', name: '墨魂', tier: 5, desc: '所有属性 +25%', all: 1.25 },
  ];
  const AFFIX_TIER_COUNT = [21, 8, 4, 2, 1];
  const RARITY_NAMES = ['常见', '良好', '优秀', '稀有', '传说'];

  function pickAffixes(rng, n) {
    const out = [];
    let guard = 0;
    n = Math.max(0, Math.min(3, n | 0 || 0));
    while (out.length < n && guard++ < 500) {
      const r = rng();
      const bucket = r < 0.6 ? 0 : r < 0.85 ? 1 : r < 0.95 ? 2 : r < 0.99 ? 3 : 4;
      const pool = AFFIXES.filter(a => a.tier === bucket + 1 && !out.some(o => o.id === a.id));
      if (!pool.length) { out.push(AFFIXES[bucket === 4 ? AFFIXES.length - 1 : 0]); continue; }
      out.push(pool[Math.floor(rng() * pool.length)]);
    }
    return out;
  }

  class Sim {
    constructor(seed, schoolLv, heroId) {
      this.seed = Number.isFinite(seed) ? seed >>> 0 : 0;
      this.sLv = Math.max(0, Math.min(SCHOOL_LEVELS, (schoolLv | 0) || 0));
      this.heroId = HEROES[heroId] ? heroId : 'jianke';
      this.hero = HEROES[this.heroId];
      this.wave = 0; this.time = 0; this.kills = 0;
      this.enemies = [];
      this.spawnBudget = 0;
      this.build = { a: 1, r: 1, g: 1, p: 0, s: 0, c: 0, f: 0, ink: 1, ult: 1, inkcap: 100, dd: 0, chain: 0, m: 0, v: 0, ucd: 1, ur: 1 };
      this.ink = 0; this.ultReadyAt = C.ULT_CD;
      // 主角血量
      this.hp = C.PLAYER_HP; this.maxHp = C.PLAYER_HP;
      this.mode = 'normal';
      this.over = false;
      this.log = [];
      this.atkTimer = 0;
      this.targetAng = -Math.PI / 2;
      this.hasTarget = false;
      this._lastWave = 0;
      // 技能系统（仿土豆兄弟主动技：CD + 效果窗口）
      this.skillReadyAt = { nova: 0, stun: 0, drain: 0 };
      this.stunUntil = 0;
      this.drainUntil = 0;
      this.drainKills = 0;
      this._lastSkillAt = { nova: -99, stun: -99, drain: -99 };
    }
    _atkStats() {
      const h = this.hero;
      const base = h.atk;
      const b = this.build;
      return {
        rate: base.rate * b.r,
        dmg: base.dmg * b.a * (1 + this.sLv * 0.02 * C.SCHOOL_DPS_MULT * 5),
        range: base.range * b.g,
        splash: h.splash || b.s || 0,
        pierce: (h.pierce || 0) + b.p,
        ucdMult: h.ucdMult || 1,
      };
    }
    _rng() {
      let t = (this.seed += 0x6D2B79F5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    addAffix(a) {
      if (!a) return;
      const b = this.build;
      if (a.a) b.a *= a.a;
      if (a.r) b.r *= a.r;
      if (a.g) b.g *= a.g;
      if (a.p) b.p += a.p;
      if (a.s) b.s = Math.max(b.s, a.s);
      if (a.chain) b.chain = Math.max(b.chain, a.chain);
      if (a.c) b.c = a.c;
      if (a.f) b.f = Math.max(b.f, a.f);
      if (a.ink) b.ink *= a.ink;
      if (a.inkcap) b.inkcap += a.inkcap;
      if (a.u) b.ult *= a.u;
      if (a.uc) b.ucd *= a.uc;
      if (a.ur) b.ur *= a.ur;
      if (a.dd) b.dd = a.dd;
      if (a.m) b.m = a.m;
      if (a.v) b.v = a.v;
      if (a.all) { b.a *= a.all; b.r *= a.all; b.g *= a.all; b.ult *= a.all; }
    }
    nextWave() {
      this.wave++;
      const boss = this.wave % C.BOSS_EVERY === 0;
      if (boss) this.log.push('wave' + this.wave + ':BOSS');
      return boss;
    }
    tick(dt, playerPos) {
      if (this.over) return false;
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) return true;
      this.time += dt;
      // 主角位置（动态，外部传入；缺省用 C.PLAYER_POS）
      const P = (playerPos && Number.isFinite(playerPos.x) && Number.isFinite(playerPos.y))
        ? { x: playerPos.x, y: playerPos.y } : C.PLAYER_POS;
      const reachedWave = Math.max(0, Math.floor((this.time - C.FIRST_WAVE_AT) / C.WAVE_SECONDS));
      while (this.wave < reachedWave) {
        const boss = this.nextWave();
        if (boss) {
          // 墨蛟：仅在未超同屏上限时刷出（防 MAX_CONCURRENT 超限）
          if (this.enemies.length < C.MAX_CONCURRENT) {
            const bhp = C.WAVE_HP_BASE * Math.pow(C.WAVE_HP_GROWTH, Math.min(this.wave, 40) - 1);
            this.enemies.push(this._mkEnemy(0.5, -0.05, 1.2, bhp, true, ENEMY_TYPES.jiao));
          }
        }
      }
      // 刷怪：持续按 SPAWN_RATE_PER_S 出怪（随波次加速，让墨点可见）
      // 仿土豆兄弟多体型：按波次解锁快/肉怪，权重混布
      this.spawnAcc = (this.spawnAcc || 0) + C.SPAWN_RATE_PER_S * (1 + 0.15 * Math.min(this.wave, 10)) * dt;
      const spawnCount = Math.floor(this.spawnAcc);
      this.spawnAcc = Math.max(0, this.spawnAcc - spawnCount);
      if (spawnCount > 0 && this.enemies.length < C.MAX_CONCURRENT) {
        const baseHp = C.WAVE_HP_BASE * Math.pow(C.WAVE_HP_GROWTH, Math.min(this.wave, 40) - 1);
        const W = C.WORLD;
        for (let i = 0; i < spawnCount && this.enemies.length < C.MAX_CONCURRENT; i++) {
          const side = this._rng() * 4 | 0;
          let x = 0.5, y = 0.5;
          if (side === 0) { x = this._rng() * W.w; y = -C.SPAWN_EDGE; }
          else if (side === 1) { x = this._rng() * W.w; y = W.h + C.SPAWN_EDGE; }
          else if (side === 2) { x = -C.SPAWN_EDGE; y = this._rng() * W.h; }
          else { x = W.w + C.SPAWN_EDGE; y = this._rng() * W.h; }
          const type = this._pickEnemyType();
          this.enemies.push(this._mkEnemy(x, y, 0.5 + this._rng() * 0.5, baseHp, false, type));
        }
      }
      // 墨点/墨蛟朝玩家移动 + 玩家自动攻击最近敌人
      // 自动索敌：锁定攻击范围内最近敌人（无目标时保持上角度）
      const atk = this._atkStats();
      let target = null, bestD = atk.range;
      for (const e of this.enemies) {
        if (!e) continue;
        const dd = Math.hypot(P.x - e.x, P.y - e.y);
        if (dd < bestD) { bestD = dd; target = e; }
      }
      this.targetAng = target
        ? Math.atan2(target.y - P.y, target.x - P.x)
        : (this.targetAng !== undefined ? this.targetAng : -Math.PI / 2);
      this.hasTarget = !!target;
      // 玩家攻击节奏化：rate 攻速，每次挥击造成 单次 伤害（有顿挫，非平滑 DPS）
      if (this.atkTimer === undefined) this.atkTimer = 0;
      const attackPeriod = 1 / atk.rate;
      const hitDmg = atk.dmg;
      this.atkTimer += dt;
      const swings = Math.floor(this.atkTimer / attackPeriod);
      this.atkTimer = Math.max(0, this.atkTimer - swings * attackPeriod);
      const bossGuard = e => (e.boss && e.shielded ? 0.4 : 1.0);
      const stunned = this.time < this.stunUntil;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (!e || this.enemies[i] !== e) { this.enemies.splice(i, 1); continue; }
        const dx = P.x - e.x, dy = P.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const slow = Math.max(0.25, 1 - this.build.f);
        // 墨滞技能：被凝滞的怪完全停止移动
        const sp = stunned ? 0 : e.sp * slow * 0.12;
        e.x += (dx / d) * sp * dt;
        e.y += (dy / d) * sp * dt;
        e.stunned = stunned; // 渲染层用
        // 自动命中目标（或攻击范围内所有敌人，保留割草感）
        if (swings > 0 && d < atk.range) e.hp -= hitDmg * swings * bossGuard(e);
        if (e.boss && e.shielded && e.hp < e.maxHp * 0.45) {
          e.hp = Math.max(e.hp, e.maxHp * 0.4);
          e.shielded = false;
          this.log.push('shieldbreak@w' + this.wave);
        }
        // 贴近扣血（按类型 touchMult 差异化，每 0.5s 结算一次避免瞬间清零）
        if (d < 0.06) {
          this.touchAcc = (this.touchAcc || 0) + dt;
          const lastSettle = this._lastSettle || 0;
          if (this.touchAcc >= 0.5 && this.time - lastSettle >= 0.45) {
            this.touchAcc = 0;
            this._lastSettle = this.time;
            const tMult = e.touchMult || 1;
            this.hp -= C.ENEMY_TOUCH_DMG * tMult * (1 + 0.08 * Math.min(this.wave, 15));
            if (this.hp <= 0) { this.hp = 0; this.over = true; this.log.push('died@w' + this.wave); return false; }
          }
        }
        if (e.hp <= 0) {
          this.enemies.splice(i, 1); this.kills++;
          this.ink = Math.min(this.build.inkcap, this.ink + C.INK_PER_KILL + (this.build.v || 0));
          // 噬墨技能：窗口内击杀回血
          if (this.time < this.drainUntil) {
            this.drainKills++;
            this.hp = Math.min(this.maxHp, this.hp + SKILLS.drain.healPerKill);
          }
        }
      }
      // 每波回血 + 每 2 波额外回血（防后期连体死）
      const prevWave = this._lastWave || 0;
      if (this.wave > prevWave && this.wave > 0) {
        this.hp = Math.min(this.maxHp, this.hp + C.HEAL_PER_WAVE + (this.wave % 2 === 0 ? 10 : 0));
        this._lastWave = this.wave;
      }
      this.ink = Math.min(this.build.inkcap, this.ink + C.INK_REGEN * dt * this.build.ink);
      if (this.ink >= C.INK_CAPACITY && this.time >= this.ultReadyAt && this.enemies.length) {
        this.ink = 0;
        this.ultReadyAt = this.time + C.ULT_CD * this.build.ucd * atk.ucdMult;
        const dmg = this.hero.ult.dmg * this.build.ult;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (!e) continue;
          if (e.boss) e.shielded = false;
          e.hp -= dmg;
          if (e.hp <= 0) { this.enemies.splice(j, 1); this.kills++; this.ink = Math.min(this.build.inkcap, this.ink + C.INK_PER_KILL); }
        }
        this.log.push('ult@w' + this.wave);
      }
      return true;
    }
    _mkEnemy(x, y, sp, hp, boss, type) {
      const t = type || ENEMY_TYPES.normal;
      const h = (boss ? t.hpMult : 1) * hp;
      return {
        x: x, y: y, hp: h, maxHp: h,
        s: boss ? 0.045 : (t.sp || 0.035),
        sp: boss ? 0.5 : (t.sp || sp || 0.07),
        boss: !!boss,
        shielded: !!boss,
        type: boss ? 'jiao' : t.id,
        touchMult: t.touchMult || 1,
        size: t.size || 1,
      };
    }
    /* 按波次 + 权重混布怪物类型（快怪 5 波起，肉怪 3 波起） */
    _pickEnemyType() {
      const w = this.wave;
      let pool = ENEMY_TYPES.normal; // 默认
      // 候选池：普通总是有；肉/快按 fromWave 解锁
      const cands = ENEMY_TYPE_IDS.filter(id => {
        const t = ENEMY_TYPES[id];
        return !t.fromWave || w >= t.fromWave;
      });
      let total = 0;
      const ws = cands.map(id => { const t = ENEMY_TYPES[id]; const ww = t.weight || 0; total += ww; return ww; });
      let r = this._rng() * total;
      for (let i = 0; i < cands.length; i++) {
        r -= ws[i];
        if (r < 0) return ENEMY_TYPES[cands[i]];
      }
      return pool;
    }
    /* ---------------- 技能（仿土豆兄弟主动技：CD + 波次缩放） ---------------- */
    // 技能数值随波次成长：dmg +6%/波，半径 +3%/波（封顶），CD 固定
    _skillStat(id) {
      const s = SKILLS[id];
      if (!s) return null;
      const w = this.wave;
      const out = { id: id, cd: s.cd, ready: this.time >= (this.skillReadyAt[id] || 0) };
      if (s.baseDmg) out.dmg = s.baseDmg * (1 + 0.06 * Math.min(w, 25));
      if (s.radius) out.radius = s.radius * (1 + 0.03 * Math.min(w, 20));
      if (s.duration) out.duration = s.duration;
      if (s.healPerKill) out.healPerKill = s.healPerKill * (1 + 0.04 * Math.min(w, 20));
      if (s.window) out.window = s.window;
      return out;
    }
    useSkill(id, playerPos) {
      const P = (playerPos && Number.isFinite(playerPos.x) && Number.isFinite(playerPos.y))
        ? playerPos : C.PLAYER_POS;
      const s = this._skillStat(id);
      if (!s) return false;
      if (this.time < (this.skillReadyAt[id] || 0)) return false; // CD 中
      if (id === 'nova') {
        // 墨爆：以玩家为心，范围内所有敌人受 dmg 伤害
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (!e) continue;
          const dd = Math.hypot(P.x - e.x, P.y - e.y);
          if (dd < s.radius) {
            e.hp -= s.dmg;
            if (e.hp <= 0) {
              this.enemies.splice(i, 1); this.kills++;
              this.ink = Math.min(this.build.inkcap, this.ink + C.INK_PER_KILL);
            }
          }
        }
        this.skillReadyAt.nova = this.time + s.cd;
        this._lastSkillAt.nova = this.time;
        this.log.push('nova@w' + this.wave);
        return true;
      } else if (id === 'stun') {
        // 墨滞：范围内敌人停止 duration 秒
        this.stunUntil = this.time + s.duration;
        this.skillReadyAt.stun = this.time + s.cd;
        this._lastSkillAt.stun = this.time;
        this.log.push('stun@w' + this.wave);
        return true;
      } else if (id === 'drain') {
        // 噬墨：开启 window 秒回血窗口（击杀回血）
        this.drainUntil = this.time + s.window;
        this.drainKills = 0;
        this.skillReadyAt.drain = this.time + s.cd;
        this._lastSkillAt.drain = this.time;
        this.log.push('drain@w' + this.wave);
        return true;
      }
      return false;
    }
    skillCdProgress(id) {
      const s = this._skillStat(id);
      if (!s) return 0;
      const start = (this._lastSkillAt[id] || 0) - s.cd;
      const total = s.cd;
      const p = 1 - Math.max(0, Math.min(1, ((this.time - start) / total)));
      return p;
    }
  }

  const api = { C: C, SCHOOLS: SCHOOLS, SCHOOL_LEVELS: SCHOOL_LEVELS, AFFIXES: AFFIXES, AFFIX_TIER_COUNT: AFFIX_TIER_COUNT, RARITY_NAMES: RARITY_NAMES, HEROES: HEROES, HERO_IDS: HERO_IDS, ENEMY_TYPES: ENEMY_TYPES, ENEMY_TYPE_IDS: ENEMY_TYPE_IDS, SKILLS: SKILLS, SKILL_IDS: SKILL_IDS, pickAffixes: pickAffixes, Sim: Sim };
  global.MoCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
