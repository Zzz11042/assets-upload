// 《墨剑江湖》渲染层（Canvas 水墨风 + UI 绑定，DOM 操作全部 try/catch 兜底防闪退）
'use strict';
(function () {
  if (typeof document === 'undefined') return;
  const E = window.MoEngine;
  const C = window.MoCore.C;
  const AFFIXES = window.MoCore.AFFIXES;
  const RARITY_NAMES = window.MoCore.RARITY_NAMES;
  const HEROES = (window.MoCore && window.MoCore.HEROES) || {};
  const HERO_IDS = (window.MoCore && window.MoCore.HERO_IDS) || ['jianke', 'shushi', 'qiang'];

  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('game');
  const ctx = canvas ? canvas.getContext('2d') : null;

  /* ---------------- 画布尺寸（DPR 适配，竖屏手机优先） ---------------- */
  function resize() {
    if (!canvas || !ctx) return;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // 竖屏手机：填满可用区域（减去 HUD + 触屏控件 + header）
      const w = Math.min(window.innerWidth, 480);
      const h = Math.max(240, Math.min(window.innerHeight - 240, 760));
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      makePaper();
    } catch (e) { /* 尺寸异常不闪退 */ }
  }

  /* ---------------- 夜墨背景（黑底 + 浅灰远山 + 雾带 + 白印，夜墨高反差） ---------------- */
  let paper = null;
  function makePaper() {
    if (!canvas) return;
    try {
      paper = document.createElement('canvas');
      paper.width = canvas.width; paper.height = canvas.height;
      const p = paper.getContext('2d');
      if (!p) { paper = null; return; }
      const W = paper.width, H = paper.height;
      // 夜墨底色（纯黑 → 深灰，由上而下）
      const g = p.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0c0c0e');
      g.addColorStop(0.5, '#08080a');
      g.addColorStop(1, '#050506');
      p.fillStyle = g;
      p.fillRect(0, 0, W, H);
      // 纤维（极淡灰纤维，模拟夜间宣纸肌理）
      for (let i = 0; i < 1400; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        p.fillStyle = 'rgba(150,150,150,' + (0.004 + Math.random() * 0.008).toFixed(3) + ')';
        p.fillRect(x, y, 1 + Math.random() * 2, 0.8);
      }
      // 晕染墨渍（边角，淡白雾）
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        const r = 40 + Math.random() * 120;
        const rg = p.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(220,220,220,' + (0.015 + Math.random() * 0.02).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(220,220,220,0)');
        p.fillStyle = rg;
        p.beginPath(); p.arc(x, y, r, 0, 6.2832); p.fill();
      }
      // 远山（夜山剪影，浅灰三层叠远 + 晕染）
      function mountain(yBase, amp, alpha, freq, blur) {
        p.beginPath();
        p.moveTo(0, H);
        for (let x = 0; x <= W; x += 3) {
          const n = Math.sin(x * freq) * 0.6 + Math.sin(x * freq * 2.7 + 1.3) * 0.3 + Math.sin(x * freq * 5.1 + 4) * 0.1;
          p.lineTo(x, yBase + n * amp);
        }
        p.lineTo(W, H);
        p.closePath();
        p.save();
        if (blur) p.filter = 'blur(' + blur + 'px)';
        p.fillStyle = 'rgba(120,120,130,' + alpha + ')';
        p.fill();
        p.restore();
      }
      // 由远及近：淡→浓
      mountain(H * 0.40, H * 0.06, 0.10, 0.006 / W * 40, 3);
      mountain(H * 0.50, H * 0.045, 0.16, 0.006 / W * 55, 2);
      mountain(H * 0.58, H * 0.03, 0.24, 0.006 / W * 75, 1);
      // 山间雾带（横向淡白）
      for (let i = 0; i < 4; i++) {
        const fy = H * (0.44 + i * 0.05);
        const fg = p.createLinearGradient(0, fy - 20, 0, fy + 20);
        fg.addColorStop(0, 'rgba(180,180,190,0)');
        fg.addColorStop(0.5, 'rgba(180,180,190,0.10)');
        fg.addColorStop(1, 'rgba(180,180,190,0)');
        p.fillStyle = fg;
        p.fillRect(0, fy - 20, W, 40);
      }
      // 淡云（横向灰带）
      for (let i = 0; i < 5; i++) {
        const cy = H * (0.30 + Math.random() * 0.3);
        const cw = W * (0.25 + Math.random() * 0.35);
        const cx = Math.random() * W;
        const rg2 = p.createRadialGradient(cx, cy, 0, cx, cy, cw);
        rg2.addColorStop(0, 'rgba(110,110,120,0.10)');
        rg2.addColorStop(1, 'rgba(110,110,120,0)');
        p.fillStyle = rg2;
        p.save();
        p.translate(cx, cy);
        p.scale(3.2, 1);
        p.beginPath(); p.arc(0, 0, cw / 3.2, 0, 6.2832); p.fill();
        p.restore();
      }
      // 白印（右下，"墨剑"，白底黑字 反色）
      p.save();
      const sx = W - 18, sy = H - 44;
      p.translate(sx, sy);
      p.fillStyle = 'rgba(240,240,240,0.85)';
      p.fillRect(-14, -16, 30, 32);
      p.fillStyle = '#0a0a0a';
      p.font = '600 11px "Songti SC","STSong",serif';
      p.textAlign = 'center';
      p.textBaseline = 'middle';
      p.fillText('墨', -7, -4);
      p.fillText('剑', 8, 6);
      p.restore();
    } catch (e) { paper = null; }
  }

  /* ---------------- 世界坐标 → 屏幕像素（镜头跟随，主角居中） ---------------- */
  // 世界坐标 wx,wy ∈ [0, WORLD.w]×[0, WORLD.h]；cam 为镜头中心
  function worldToPx(wx, wy, cam) {
    if (!canvas) return { x: 0, y: 0 };
    const W = canvas.width, H = canvas.height;
    const scale = W / C.WORLD.w; // 水平填充，纵向按比例
    const cx = cam && cam.x !== undefined ? cam.x : C.WORLD.w / 2;
    const cy = cam && cam.y !== undefined ? cam.y : C.WORLD.h / 2;
    const sx = (wx - cx) * scale + W / 2;
    const sy = (wy - cy) * scale + H / 2;
    return {
      x: Math.max(-80, Math.min(W + 80, sx)),
      y: Math.max(-80, Math.min(H + 80, sy)),
    };
  }
  // 兼容旧接口（带 cam）
  function toPx(wx, wy, cam) {
    return worldToPx(wx, wy, cam);
  }

  /* ---------------- 墨点敌人（水墨墨滴：入场淡入 + 受击闪白 + 溅射 + 血条 + 墨气） ---------------- */
  function drawEnemy(e, t, g) {
    if (!e || !ctx) return;
    const pos = toPx(e.x, e.y, g ? g.cam : null);
    const x = pos.x, y = pos.y;
    const W = canvas.width;
    // 体型按类型差异化（墨蝶小/墨盾大/墨点中/墨蛟最大）
    const sizeMult = e.size || 1;
    const r = (e.boss ? 0.085 : 0.036) * W * sizeMult;
    const etype = e.type || 'normal';
    // 入场淡入（bornAt 起 0.5s 内 alpha 0→1，避免生硬弹出）
    let alpha = 1;
    if (g && e.bornAt !== undefined) {
      const age = g.time - e.bornAt;
      if (age < 0.5) alpha = Math.max(0, age / 0.5);
    }
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // 墨气（淡晕，大范围，白雾）
    const g0 = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g0.addColorStop(0, e.boss ? 'rgba(240,240,240,0.28)' : 'rgba(225,225,225,0.18)');
    g0.addColorStop(1, 'rgba(225,225,225,0)');
    ctx.fillStyle = g0;
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 6.2832); ctx.fill();
    // 墨滴核（蠕动 + 不规则溅射边，白墨）
    const wob = Math.sin(t * 0.004 + e.x * 9) * r * 0.14;
    const wob2 = Math.cos(t * 0.003 + e.y * 7) * r * 0.1;
    const cx = x + wob, cy = y + wob2;
    // 墨滴主体（径向渐变，白→淡）
    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
    g1.addColorStop(0, e.boss ? 'rgba(250,250,250,0.96)' : 'rgba(235,235,235,0.9)');
    g1.addColorStop(0.55, e.boss ? 'rgba(210,210,210,0.55)' : 'rgba(200,200,200,0.42)');
    g1.addColorStop(1, 'rgba(200,200,200,0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    const spikes = 8;
    for (let i = 0; i <= spikes * 4; i++) {
      const a = (i / (spikes * 4)) * Math.PI * 2;
      const sp = r * (1 + 0.18 * Math.sin(a * spikes + e.x * 5 + t * 0.003) + 0.1 * Math.cos(a * (spikes + 2) + e.y * 4));
      const px = cx + Math.cos(a) * sp, py = cy + Math.sin(a) * sp;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    // 类型特征视觉（黑底白墨下，用不同轮廓区分 快/肉/中）
    if (etype === 'fast') {
      // 墨蝶：双翼 + 高频抖动（小快）
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, W * 0.002);
      const flut = Math.sin(t * 0.02) * r * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy); ctx.lineTo(cx - r * 1.2, cy - r * 0.7 + flut);
      ctx.moveTo(cx - r * 0.3, cy); ctx.lineTo(cx - r * 1.2, cy + r * 0.7 - flut);
      ctx.moveTo(cx + r * 0.3, cy); ctx.lineTo(cx + r * 1.2, cy - r * 0.7 - flut);
      ctx.moveTo(cx + r * 0.3, cy); ctx.lineTo(cx + r * 1.2, cy + r * 0.7 + flut);
      ctx.stroke();
    } else if (etype === 'slow') {
      // 墨盾：外圈厚白壳 + 方角（大肉，高血量警示）
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(2, W * 0.005);
      const cr = r * 1.5;
      ctx.strokeRect(cx - cr * 0.7, cy - cr * 0.7, cr * 1.4, cr * 1.4);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(cx - cr * 0.7, cy - cr * 0.7, cr * 1.4, cr * 1.4);
    }
    // 受击闪白（黑底上敌人本身已白，闪时用纯白强闪 + 描边）
    if (g && e.hurtAt > 0 && (g.time - e.hurtAt) < 0.15) {
      const hitA = 1 - (g.time - e.hurtAt) / 0.15;
      ctx.fillStyle = 'rgba(255,255,255,' + (hitA * 0.7).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, 6.2832); ctx.fill();
    }
    // 墨滴高光（左上一点强光）
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.35, 0, 6.2832); ctx.fill();
    // 墨滴小溅射点（白墨）
    ctx.fillStyle = 'rgba(235,235,235,' + (e.boss ? 0.5 : 0.42) + ')';
    for (let i = 0; i < 4; i++) {
      const sa = (i / 4) * Math.PI * 2 + t * 0.002 + e.x * 3;
      const sr = r * (1.6 + 0.3 * Math.sin(t * 0.005 + i * 2 + e.y * 5));
      const sx = cx + Math.cos(sa) * sr, sy = cy + Math.sin(sa) * sr;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.12, 0, 6.2832); ctx.fill();
    }
    // 墨滞技能：被凝滞时加淡蓝光晕 + 停滞标记
    if (e.stunned) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.setLineDash([W * 0.006, W * 0.004]);
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
      // 凝滞符（白"止"字小印）
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '700 ' + Math.max(8, W * 0.016) + 'px "Songti SC","STSong",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('滞', cx, cy - r * 1.4);
    }
    // 墨蛟特征（龙角 + 龙身）
    if (e.boss) drawJiao(e, cx, cy, r, t, g);
    // 护盾（墨蛟，白虚线）
    if (e.boss && e.shielded) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(2, W * 0.005);
      ctx.setLineDash([W * 0.012, W * 0.008]);
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.9, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 血条（墨滴下方，白底黑槽 + 白血）
    const bw = r * 3.2;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x - bw / 2, y + r * 2.0, bw, Math.max(2, W * 0.004));
    // 墨点敌人血条（白血 / boss 浅灰血）
    const hpR = Math.max(0, Math.min(1, e.hp / e.maxHp));
    ctx.fillStyle = e.boss ? '#9a9a9a' : '#ffffff';
    ctx.fillRect(x - bw / 2, y + r * 2.0, bw * hpR, Math.max(2, W * 0.004));
    ctx.restore();
  }

  /* ---------------- 墨蛟（龙角 + 龙须 + 龙身墨气 + 龙鳞 + 龙瞳 + 破盾光效） ---------------- */
  function drawJiao(e, cx, cy, r, t, g) {
    if (!ctx) return;
    const W = canvas.width;
    const phase = t * 0.0012;
    // 龙角（双角，分叉，白墨）
    ctx.strokeStyle = 'rgba(245,245,245,0.9)';
    ctx.lineWidth = Math.max(2, W * 0.006);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy - r * 0.7);
    ctx.lineTo(cx - r * 0.9, cy - r * 1.5);
    ctx.moveTo(cx - r * 0.6, cy - r * 1.1);
    ctx.lineTo(cx - r * 1.0, cy - r * 1.2);
    ctx.moveTo(cx + r * 0.4, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.9, cy - r * 1.5);
    ctx.moveTo(cx + r * 0.6, cy - r * 1.1);
    ctx.lineTo(cx + r * 1.0, cy - r * 1.2);
    ctx.stroke();
    // 龙须（飘动，淡白）
    ctx.strokeStyle = 'rgba(220,220,220,0.55)';
    ctx.lineWidth = Math.max(1, W * 0.003);
    ctx.beginPath();
    const sw = Math.sin(t * 0.003) * r * 0.15;
    ctx.moveTo(cx - r * 0.5, cy - r * 0.3);
    ctx.quadraticCurveTo(cx - r * 1.5, cy + r * 0.3 + sw, cx - r * 1.2, cy + r * 0.9 + sw);
    ctx.moveTo(cx + r * 0.5, cy - r * 0.3);
    ctx.quadraticCurveTo(cx + r * 1.5, cy + r * 0.3 - sw, cx + r * 1.2, cy + r * 0.9 - sw);
    ctx.stroke();
    // 龙身（环绕墨气，3 段 + 缩放脉动，白）
    ctx.strokeStyle = 'rgba(235,235,235,0.55)';
    ctx.lineWidth = Math.max(3, W * 0.011);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a0 = phase + i * 2.1;
      const pulse = 1 + 0.15 * Math.sin(t * 0.004 + i);
      ctx.moveTo(cx + Math.cos(a0) * r * 1.2 * pulse, cy + Math.sin(a0) * r * 1.2 * pulse);
      ctx.quadraticCurveTo(
        cx + Math.cos(a0 + 0.8) * r * 1.9 * pulse, cy + Math.sin(a0 + 0.8) * r * 1.9 * pulse,
        cx + Math.cos(a0 + 1.5) * r * 2.3 * pulse, cy + Math.sin(a0 + 1.5) * r * 2.3 * pulse
      );
    }
    ctx.stroke();
    // 龙鳞（核心周围小白环）
    ctx.fillStyle = 'rgba(230,230,230,0.45)';
    for (let i = 0; i < 5; i++) {
      const la = (i / 5) * Math.PI * 2 + t * 0.0015;
      const lr = r * 0.7;
      ctx.beginPath(); ctx.arc(cx + Math.cos(la) * lr, cy + Math.sin(la) * lr, r * 0.12, 0, 6.2832); ctx.fill();
    }
    // 龙瞳（护盾=浅灰，破盾=纯白强光）
    const eyeColor = e.shielded ? 'rgba(200,200,200,0.85)' : 'rgba(255,255,255,0.95)';
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.2, r * 0.08, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.25, cy - r * 0.2, r * 0.08, 0, 6.2832); ctx.fill();
    // 破盾光效（shielded 变 false 后 0.8s 内，白扩散环）
    if (!e.shielded && g && e._breakAt !== undefined && (g.time - e._breakAt) < 0.8) {
      const bt = 1 - (g.time - e._breakAt) / 0.8;
      const br = r * (2.0 + (1 - bt) * 1.5);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, br));
      bg.addColorStop(0, 'rgba(255,255,255,0)');
      bg.addColorStop(0.6, 'rgba(255,255,255,' + (bt * 0.5).toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, br), 0, 6.2832); ctx.fill();
    }
  }

  /* ---------------- 主角（水墨剑客：平滑转向 + 挥击顿挫 + 笔锋 + 剑气） ---------------- */
  function drawHero(g, t) {
    if (!ctx) return;
    // 主角始终画在屏幕中心（镜头跟随），世界坐标由 cam 决定
    const x = canvas.width / 2, y = canvas.height / 2;
    const W = canvas.width;
    const r = W * 0.048;
    // 自动攻击：主角面向最近敌人（sim.targetAng 已同步到 g.p.ang）
    // 无目标时保持上一点角度（避免乱转）
    let targetAng;
    if (g && g.p && typeof g.p.ang === 'number') {
      targetAng = g.p.ang; // 有目标用目标角，无目标保持上次角度
    } else {
      targetAng = -Math.PI / 2; // 默认朝上
    }
    heroAng = lerpAngle(heroAng, targetAng, 0.25);
    const ang = heroAng;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    // 挥击顿挫：按 sim 的攻击节奏摆动笔剑（有节奏感而非静止）
    let swing = 0;
    try {
      if (g && g.sim && g.sim.atkTimer !== undefined) {
        const period = 1 / (C.BASE_ATTACK.rate * g.sim.build.r);
        const phase = (g.sim.atkTimer % period) / period;
        // 挥击：快速前摆 + 慢速回摆
        swing = Math.sin(phase * Math.PI) * 0.6 - 0.3;
      }
    } catch (e) { swing = 0; }
    // 方向扇形（笔势预判区，淡白）
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r * 3.4, ang - 1.0, ang + 1.0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // 投影（浅灰椭圆，增强黑人物在黑底上的层次）
    ctx.fillStyle = 'rgba(140,140,140,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.35, r * 0.85, r * 0.3, 0, 0, 6.2832);
    ctx.fill();
    // 衣袍（黑色墨袍 + 白描边高光，黑底上靠边缘光辨识）
    const robeG = ctx.createRadialGradient(x - r * 0.2, y + r * 0.2, 0, x, y + r * 0.3, r * 1.4);
    robeG.addColorStop(0, '#101014');
    robeG.addColorStop(0.7, '#0a0a0c');
    robeG.addColorStop(1, 'rgba(10,10,12,0.7)');
    ctx.fillStyle = robeG;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.4, r * 0.95, r * 1.1, 0, 0, 6.2832);
    ctx.fill();
    // 袍身白描边（左侧高光弧）
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.4, r * 0.95, r * 1.1, 0, Math.PI * 0.55, Math.PI * 1.45);
    ctx.stroke();
    // 衣摆（黑色 + 白边）
    const flap = Math.sin(t * 0.005) * r * 0.2;
    const hemG = ctx.createLinearGradient(0, y + r * 0.6, 0, y + r * 1.9);
    hemG.addColorStop(0, '#141418');
    hemG.addColorStop(1, 'rgba(16,16,20,0.7)');
    ctx.fillStyle = hemG;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.8);
    ctx.quadraticCurveTo(x - r * 0.9 + flap, y + r * 1.6, x - r * 0.3, y + r * 1.8);
    ctx.quadraticCurveTo(x + r * 0.3, y + r * 1.8, x + r * 0.9 + flap, y + r * 1.5);
    ctx.lineTo(x + r * 0.7, y + r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(1, W * 0.0015);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.8);
    ctx.quadraticCurveTo(x - r * 0.9 + flap, y + r * 1.6, x - r * 0.3, y + r * 1.8);
    ctx.stroke();
    // 腰带（白色束带，黑袍上的亮点）
    ctx.strokeStyle = 'rgba(240,240,240,0.55)';
    ctx.lineWidth = Math.max(1.5, W * 0.003);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y + r * 0.35);
    ctx.quadraticCurveTo(x, y + r * 0.45, x + r * 0.6, y + r * 0.35);
    ctx.stroke();
    // 头 + 发髻（黑墨渐变 + 白轮廓）
    const headG = ctx.createRadialGradient(x - r * 0.15, y - r * 0.65, 0, x, y - r * 0.55, r * 0.5);
    headG.addColorStop(0, '#1c1c22');
    headG.addColorStop(1, '#0a0a0c');
    ctx.fillStyle = headG;
    ctx.beginPath(); ctx.arc(x, y - r * 0.55, r * 0.45, 0, 6.2832); ctx.fill();
    // 头部白轮廓（左上高光弧）
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.45, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
    // 发髻（白线勾边，黑底上保持辨识）
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 1.0, r * 0.22, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 1.0, r * 0.22, 0, 6.2832); ctx.stroke();
    // 发髻小飘（白线）
    ctx.strokeStyle = 'rgba(240,240,240,0.7)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.2, y - r * 1.05);
    ctx.quadraticCurveTo(x - r * 0.5, y - r * 1.3 + flap * 0.4, x - r * 0.7, y - r * 1.15);
    ctx.stroke();
    // 笔剑（带挥击摆动 + 白笔杆高光 + 墨色剑身）
    const swordAng = ang + swing;
    const tipX = x + Math.cos(swordAng) * r * 2.2;
    const tipY = y + Math.sin(swordAng) * r * 2.2;
    // 剑身（黑墨主体 + 白芯高光：双笔法）
    ctx.strokeStyle = '#0c0c0e';
    ctx.lineWidth = Math.max(5, W * 0.013);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(swordAng) * r * 0.4, y - Math.sin(swordAng) * r * 0.4);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, W * 0.005);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(swordAng) * r * 0.4, y - Math.sin(swordAng) * r * 0.4);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // 笔锋墨滴（剑尖挂白墨，黑剑尖的亮尖）
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const dripX = tipX + Math.cos(swordAng) * r * 0.25;
    const dripY = tipY + Math.sin(swordAng) * r * 0.25 + Math.sin(t * 0.006) * r * 0.08;
    ctx.beginPath(); ctx.arc(dripX, dripY, r * 0.13, 0, 6.2832); ctx.fill();
    // 挥击时墨浪（弧形白痕 + 扩散）
    if (Math.abs(swing) > 0.15) {
      const waveG = ctx.createRadialGradient(x, y, r * 1.2, x, y, r * 2.6);
      waveG.addColorStop(0, 'rgba(255,255,255,0)');
      waveG.addColorStop(0.7, 'rgba(255,255,255,0.35)');
      waveG.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(2, W * 0.004) * (1 + Math.abs(swing));
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, swordAng - 0.7, swordAng + 0.7);
      ctx.stroke();
      // 墨浪粒子（白）
      ctx.fillStyle = 'rgba(245,245,245,0.55)';
      for (let i = 0; i < 3; i++) {
        const pa = swordAng + (i - 1) * 0.4;
        const pr = r * (2.0 + 0.4 * Math.abs(swing));
        ctx.beginPath(); ctx.arc(x + Math.cos(pa) * pr, y + Math.sin(pa) * pr, r * 0.08, 0, 6.2832); ctx.fill();
      }
    } else {
      // 待机剑气（弧形白痕 + 剑锋高光）
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = Math.max(1, W * 0.003);
      ctx.beginPath();
      ctx.arc(tipX, tipY, r * 0.6, ang - 1.2, ang + 1.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, W * 0.0015);
      ctx.beginPath();
      ctx.arc(tipX, tipY, r * 0.45, ang - 0.6, ang + 0.6);
      ctx.stroke();
    }
    // 角色特征视觉（墨术士：白墨符法阵 + 墨弹；墨枪手：箭矢连射）
    try {
      const heroId = g && g.hero;
      const hasT = !!(g && g.p && g.p.hasTarget);
      const simAtk = (g && g.sim && g.sim.atkTimer !== undefined) ? g.sim.atkTimer : 0;
      if (heroId === 'shushi') {
        // 墨符法阵（脚下旋转的白符环）
        const sig = t * 0.001;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = Math.max(1.5, W * 0.003);
        ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 1.3, sig, sig + Math.PI * 1.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 1.6, -sig, -sig + Math.PI * 1.5); ctx.stroke();
        // 法术墨珠（白，悬浮剑尖方向）
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(tipX, tipY, r * 0.2, 0, 6.2832); ctx.fill();
        // 溅射白环（提示远程溅射范围）
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.setLineDash([W * 0.004, W * 0.004]);
        ctx.beginPath(); ctx.arc(x, y, r * 3.0, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
        // 墨弹（有目标时：沿目标角飞出的白墨弹，按攻击节奏发射 2 发呈溅射状）
        if (hasT && g.sim && g.sim.hasTarget) {
          drawProjectileBolt(x, y, r, ang, W, g, 'shushi', simAtk);
        }
      } else if (heroId === 'qiang') {
        // 枪管（黑墨 + 白芯）
        ctx.strokeStyle = '#0c0c0e';
        ctx.lineWidth = Math.max(4, W * 0.008);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(swordAng) * r * 0.3, y - Math.sin(swordAng) * r * 0.3);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = Math.max(1.5, W * 0.003);
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(swordAng) * r * 0.3, y - Math.sin(swordAng) * r * 0.3);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        // 箭矢（有目标时：连射白箭，按超快节奏多枚沿目标角飞散）
        if (hasT && g.sim && g.sim.hasTarget) {
          drawArrows(x, y, r, ang, W, g, simAtk);
        }
      }
    } catch (e) { /* 角色视觉异常不影响主体 */ }
  }

  /* ---------------- 墨术士墨弹（白墨弹 + 光尾，按攻击节奏发射） ---------------- */
  function drawProjectileBolt(x, y, r, ang, W, g, heroId, simAtk) {
    try {
      const atk = g.sim._atkStats ? g.sim._atkStats() : null;
      const rate = atk ? atk.rate : 1.2;
      const period = 1 / rate;
      const phase = (simAtk % period) / period; // 0..1 攻击节奏
      const flight = 0.35; // 弹速快，飞行时间短
      const n = heroId === 'shushi' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        // 每发弹相位错开（溅射感）
        const ph = ((phase - i * 0.35) % 1 + 1) % 1;
        if (ph > 0.8) continue; // 只画最近一发
        const prog = ph / 0.8; // 0..1 飞行进度
        const sp = heroId === 'shushi' ? 0.22 : 0.12;
        const spreadA = ang + i * 0.12 - 0.06; // 两发小夹角
        const dist = r * 1.5 + (r * 2.6) * prog;
        const px = x + Math.cos(spreadA) * dist;
        const py = y + Math.sin(spreadA) * dist;
        const br = heroId === 'shushi' ? r * 0.22 * (1 - prog * 0.4) : r * 0.16;
        // 光尾（白墨拖尾）
        const tailA = Math.atan2(py - y, px - x);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - prog)).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1.5, W * 0.003) * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(tailA) * r * 0.7, py - Math.sin(tailA) * r * 0.7);
        ctx.lineTo(px, py);
        ctx.stroke();
        // 弹体（白墨圆珠）
        ctx.fillStyle = 'rgba(255,255,255,' + (0.95 - prog * 0.3).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(px, py, br, 0, 6.2832); ctx.fill();
        // 溅射命中环（术士专用，接近射程末端时）
        if (heroId === 'shushi' && prog > 0.7) {
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 * (prog - 0.7) / 0.3).toFixed(3) + ')';
          ctx.lineWidth = Math.max(1, W * 0.002);
          ctx.beginPath(); ctx.arc(px, py, r * 0.5 * (prog - 0.7) / 0.3, 0, 6.2832); ctx.stroke();
        }
      }
    } catch (e) { /* 弹道异常不影响主体 */ }
  }

  /* ---------------- 墨枪手箭矢（白箭 + 尾羽，超快连射） ---------------- */
  function drawArrows(x, y, r, ang, W, g, simAtk) {
    try {
      const atk = g.sim._atkStats ? g.sim._atkStats() : null;
      const rate = atk ? atk.rate : 3.2;
      const period = 1 / rate;
      const phase = (simAtk % period) / period;
      // 连射：同一节奏内飞 3 枚（相位错开 0.33）
      const n = 3;
      for (let i = 0; i < n; i++) {
        const ph = ((phase - i * 0.33) % 1 + 1) % 1;
        if (ph > 0.9) continue;
        const prog = ph / 0.9; // 飞行进度
        const spreadA = ang + (i - 1) * 0.1; // 三枚小夹角（连射扇形）
        const dist = r * 1.5 + (r * 2.4) * prog;
        const px = x + Math.cos(spreadA) * dist;
        const py = y + Math.sin(spreadA) * dist;
        const len = r * 0.6;
        // 箭杆（白）
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 - prog * 0.4).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1.5, W * 0.003);
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(spreadA) * len, py - Math.sin(spreadA) * len);
        ctx.lineTo(px, py);
        ctx.stroke();
        // 箭头（白尖）
        ctx.fillStyle = 'rgba(255,255,255,' + (0.95 - prog * 0.3).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, W * 0.004), 0, 6.2832);
        ctx.fill();
      }
    } catch (e) { /* 箭矢异常不影响主体 */ }
  }
  // 平滑角度插值（处理 -π/π 环绕）
  let heroAng = -Math.PI / 2; // 默认朝上
  function lerpAngle(a, b, k) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * k;
  }
  /* ---------------- 墨渍（被杀残留：溅射纹理 + 扩散 + 缓慢消散） ---------------- */
  function drawInkSpots(g) {
    if (!ctx || !g) return;
    const cam = g.cam || null;
    for (const s of g.inkSpots || []) {
      if (!s) continue;
      const pos = toPx(s.x, s.y, cam);
      const W = canvas.width;
      const lifeF = Math.max(0, Math.min(1, s.life / 4));
      const r = (s.boss ? 0.14 : 0.05) * W * (1 + (1 - lifeF) * 0.5);
      const alpha = s.boss ? 0.18 : 0.12;
      // 主墨渍（白雾）
      ctx.fillStyle = 'rgba(235,235,235,' + (alpha * lifeF).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, 6.2832); ctx.fill();
      // 溅射点（周围小白点）
      ctx.fillStyle = 'rgba(235,235,235,' + (alpha * 0.5 * lifeF).toFixed(3) + ')';
      for (let i = 0; i < 5; i++) {
        const sa = (i / 5) * Math.PI * 2 + s.x * 7;
        const sr = r * (1.2 + 0.4 * ((i * 13 + Math.floor(s.y * 91)) % 10) / 10);
        ctx.beginPath(); ctx.arc(pos.x + Math.cos(sa) * sr, pos.y + Math.sin(sa) * sr, r * 0.18, 0, 6.2832); ctx.fill();
      }
      // 边缘晕（径向渐变，白雾）
      const eg = ctx.createRadialGradient(pos.x, pos.y, r * 0.8, pos.x, pos.y, r * 1.6);
      eg.addColorStop(0, 'rgba(235,235,235,0)');
      eg.addColorStop(0.6, 'rgba(235,235,235,' + (alpha * 0.4 * lifeF).toFixed(3) + ')');
      eg.addColorStop(1, 'rgba(235,235,235,0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 1.6, 0, 6.2832); ctx.fill();
    }
  }

  /* ---------------- 技能特效（墨爆扩散环 / 墨滞凝滞符 / 噬墨回血光，瞬发 0.6s 渐隐） ---------------- */
  function drawSkillFlash(g, t) {
    if (!ctx || !g || !g._skillFlash) return;
    try {
      const sf = g._skillFlash;
      const age = g.time - sf.at;
      const dur = 0.6;
      if (age < 0 || age > dur) return;
      const p = age / dur; // 0→1
      const pos = { x: canvas.width / 2, y: canvas.height / 2 };
      const W = canvas.width;
      if (sf.id === 'nova') {
        // 墨爆：以主角为心扩散白环（半径 0→skill radius 像素）
        const rad = W * 0.55 * p;
        const a = (1 - p) * 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.lineWidth = Math.max(2, W * 0.008) * (1 - p);
        ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, rad), 0, 6.2832); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + ((1 - p) * 0.25).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, rad * 0.8), 0, 6.2832); ctx.fill();
      } else if (sf.id === 'stun') {
        // 墨滞：环形"止"字 + 扩散虚线圈（凝滞意象）
        const rad = W * 0.45 * (0.3 + 0.7 * p);
        const a = (1 - p) * 0.7;
        ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.lineWidth = Math.max(2, W * 0.005);
        ctx.setLineDash([W * 0.01, W * 0.008]);
        ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, rad), 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.font = '700 ' + Math.max(14, W * 0.05) + 'px "Songti SC","STSong",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('滞', pos.x, pos.y);
      } else if (sf.id === 'drain') {
        // 噬墨：回血光晕（绿色调改白）+ 上升墨粒
        const a = (1 - p) * 0.5;
        const rg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, Math.max(1, W * 0.3));
        rg.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, W * 0.3), 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.font = '700 ' + Math.max(12, W * 0.03) + 'px "Songti SC","STSong",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', pos.x, pos.y - W * 0.1 * (1 - p));
      }
    } catch (e) { /* 技能特效异常不闪退 */ }
  }

  /* ---------------- 大招墨爆（全屏墨浪 + 冲击环 + 墨粒飞散 + 核心爆点） ---------------- */
  function drawUlt(g) {
    if (!ctx || !g || g.ultFlash <= 0) return;
    // 墨爆从主角位置（屏幕中心）扩散
    const pos = { x: canvas.width / 2, y: canvas.height / 2 };
    const W = canvas.width, H = canvas.height;
    const t = 1 - g.ultFlash; // 0→1 进度
    // 墨浪径向扩散（三层渐变，白雾）
    const r = Math.max(W, H) * 1.15 * t;
    const a = g.ultFlash * 0.55;
    const rg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, Math.max(1, r));
    rg.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
    rg.addColorStop(0.45, 'rgba(230,230,230,' + (a * 0.65).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(230,230,230,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, r), 0, 6.2832); ctx.fill();
    // 冲击环（双层，白）
    ctx.strokeStyle = 'rgba(255,255,255,' + (g.ultFlash * 0.7).toFixed(3) + ')';
    ctx.lineWidth = Math.max(2, W * 0.006) * (1 - t);
    ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, r * 0.85), 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,220,220,' + (g.ultFlash * 0.4).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, W * 0.003) * (1 - t);
    ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, r * 0.65), 0, 6.2832); ctx.stroke();
    // 墨粒飞散（8 颗，白）
    ctx.fillStyle = 'rgba(245,245,245,' + (g.ultFlash * 0.5).toFixed(3) + ')';
    for (let i = 0; i < 8; i++) {
      const pa = (i / 8) * Math.PI * 2 + t * 2;
      const pr = r * (0.5 + 0.3 * Math.sin(i * 2 + t * 4));
      ctx.beginPath();
      ctx.arc(pos.x + Math.cos(pa) * pr, pos.y + Math.sin(pa) * pr, W * 0.004 * (1 - t) + 1, 0, 6.2832);
      ctx.fill();
    }
    // 中心墨爆核心（前 40% 显示，强光）
    if (t < 0.4) {
      const coreR = W * 0.08 * (1 - t / 0.4);
      const cg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, Math.max(1, coreR));
      cg.addColorStop(0, 'rgba(255,255,255,0.9)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1, coreR), 0, 6.2832); ctx.fill();
    }
  }

  /* ---------------- HUD ---------------- */
  function hud(g) {
    try {
      if (!g) return;
      const set = function (id, v) { const el = $(id); if (el) el.textContent = String(v == null ? '' : v); };
      set('wave', g.sim ? g.sim.wave : 0);
      set('kills', g.kills || 0);
      set('codex', E.codexCount(g));
      set('build', g.buildNames && g.buildNames.length ? g.buildNames.slice(-4).join('·') : '—');
      // 当前角色名（HUD 显示）
      set('hero', HEROES[g.hero] ? HEROES[g.hero].name : '—');
      const inkEl = $('inkbar');
      if (inkEl && g.sim) {
        const p = Math.max(0, Math.min(1, g.sim.ink / C.INK_CAPACITY));
        inkEl.style.width = (p * 100).toFixed(1) + '%';
        inkEl.classList.toggle('full', p >= 0.999);
      }
      // 主角血量条（HUD）
      const hpEl = $('hpbar');
      if (hpEl && g.p) {
        const hp = g.p.maxHp > 0 ? g.p.hp / g.p.maxHp : 0;
        hpEl.style.width = (Math.max(0, Math.min(1, hp)) * 100).toFixed(1) + '%';
        hpEl.classList.toggle('low', hp < 0.3);
      }
      // 暂停按钮显隐 + 墨爆按钮 ready 态 + 换角按钮显隐
      const pb = $('pausebtn');
      if (pb) pb.classList.toggle('show', g.state === 'playing' || g.state === 'pick');
      const ub = $('ultbtn');
      if (ub && g.sim) {
        ub.classList.toggle('ready', g.sim.ink >= C.INK_CAPACITY);
      }
      const sb = $('switchbtn');
      if (sb) {
        // 每 5 波解锁换角（波 5/10/15...），仅在 playing 态显示
        const unlocked = g.wave >= 5 && g.wave % 5 === 0;
        sb.classList.toggle('show', g.state === 'playing' && unlocked);
      }
      // 技能技钮（仿土豆兄弟主动技：CD + ready 态）
      updateSkillButtons(g);
    } catch (e) { /* HUD 异常不闪退 */ }
  }

  /* ---------------- 技能技钮（3 个主动技：墨爆/墨滞/噬墨，CD 显示 + ready 高亮） ---------------- */
  function updateSkillButtons(g) {
    try {
      if (!g || !g.sim) return;
      if (g.state !== 'playing') {
        // 非战斗中隐藏技钮
        ['sknova', 'skstun', 'skdrain'].forEach(function (id) {
          const el = $(id);
          if (el) el.classList.remove('show', 'ready');
        });
        return;
      }
      const states = E.skillStates(g);
      states.forEach(function (st) {
        if (!st || !st.id) return;
        const el = $('sk' + st.id);
        if (!el) return;
        el.classList.add('show');
        el.classList.toggle('ready', st.ready);
        // 冷却遮罩（从下往上填充，显示 CD 剩余比例）
        const mask = el.querySelector('.cdmask');
        if (mask) mask.style.height = (st.cdProgress * 100).toFixed(1) + '%';
      });
    } catch (e) { /* 技钮异常不闪退 */ }
  }

  /* ---------------- 3 选 1 词缀面板 ---------------- */
  function showPick(g) {
    try {
      const panel = $('pick');
      if (!panel || !g) return;
      panel.hidden = !g.pickOptions;
      if (!g.pickOptions) return;
      const wrap = panel.querySelector('.cards');
      if (!wrap) return;
      wrap.innerHTML = '';
      g.pickOptions.forEach(function (a, i) {
        if (!a) return;
        const card = document.createElement('div');
        card.className = 'card t' + a.tier;
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        const num = document.createElement('div');
        num.className = 'cardnum';
        num.textContent = String(i + 1);
        const body = document.createElement('div');
        body.className = 'cbody';
        const rn = document.createElement('div');
        rn.className = 'rname';
        rn.textContent = RARITY_NAMES[a.tier - 1] || '';
        const an = document.createElement('div');
        an.className = 'aname';
        an.textContent = a.name || '';
        const ad = document.createElement('div');
        ad.className = 'adesc';
        ad.textContent = a.desc || '';
        body.appendChild(rn); body.appendChild(an); body.appendChild(ad);
        card.appendChild(num); card.appendChild(body);
        const onPick = function () { E.chooseAffix(g, i); };
        card.addEventListener('click', onPick, { passive: true });
        card.addEventListener('touchend', function (ev) {
          // 触屏：阻止 click 二次触发（移动端双发）
          ev.preventDefault(); onPick();
        }, { passive: false });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(); }
        }, { passive: false });
        wrap.appendChild(card);
      });
    } catch (e) { /* 面板异常不闪退 */ }
  }

  /* ---------------- 结束 / 暂停面板 ---------------- */
  function showOver(g) {
    try {
      const el = $('over');
      if (!el || !g) return;
      el.hidden = g.state !== 'over';
      if (g.state === 'over') {
        const w = $('overWave'), k = $('overKills'), c = $('overCodex');
        if (w) w.textContent = String(g.sim.wave);
        if (k) k.textContent = String(g.kills);
        if (c) c.textContent = String(E.codexCount(g));
      }
    } catch (e) { /* 不闪退 */ }
  }
  function showPause(g) {
    try {
      const el = $('pause');
      if (!el || !g) return;
      el.hidden = g.state !== 'pause';
    } catch (e) { /* 不闪退 */ }
  }

  /* ---------------- 键盘（自动攻击版：大招 + 技能 1/2/3 + 词缀 Q/W/E + 暂停） ---------------- */
  function bindKeys(g) {
    window.addEventListener('keydown', function (ev) {
      try {
        if (!ev || !g) return;
        const k = ev.key || ev.code || '';
        if (k === ' ' || k === 'Spacebar') { E.ult(g); ev.preventDefault(); }
        else if (k === '1') E.skill(g, 'nova');
        else if (k === '2') E.skill(g, 'stun');
        else if (k === '3') E.skill(g, 'drain');
        else if (k === 'q' || k === 'Q') E.chooseAffix(g, 0);
        else if (k === 'w' || k === 'W') E.chooseAffix(g, 1);
        else if (k === 'e' || k === 'E') E.chooseAffix(g, 2);
        else if (k === 'p' || k === 'P' || k === 'Escape') {
          if (g.state === 'playing') E.pause(g);
          else if (g.state === 'pause') E.resume(g);
        }
      } catch (e) { /* 键盘异常不闪退 */ }
    }, { passive: false });
  }

  /* ---------------- 触屏（自动攻击版：墨爆按钮 + 3 技能技钮） ---------------- */
  function bindTouch(g) {
    const ultBtn = $('ultbtn');
    if (ultBtn) {
      ultBtn.addEventListener('click', function () { E.ult(g); }, { passive: true });
      ultBtn.addEventListener('touchstart', function () { E.ult(g); }, { passive: true });
    }
    // 技能技钮（仿土豆兄弟主动技）
    ['sknova', 'skstun', 'skdrain'].forEach(function (id) {
      const b = $(id);
      if (!b) return;
      const sid = id.slice(2); // nova/stun/drain
      b.addEventListener('click', function () { E.skill(g, sid); }, { passive: true });
      b.addEventListener('touchstart', function () { E.skill(g, sid); }, { passive: true });
    });
    // 方向按钮已移除（自动攻击），保留 querySelectorAll 兜底防残留
    document.querySelectorAll('.dirbtn[data-dir]').forEach(function (b) {
      b.addEventListener('click', function () { /* no-op */ }, { passive: true });
    });
    // 虚拟摇杆（自由移动）
    bindJoystick(g);
  }

  /* ---------------- 虚拟摇杆（左下角拖拽，归一化输出驱动主角移动） ---------------- */
  function bindJoystick(g) {
    const stick = $('joystick');
    const knob = $('joyknob');
    if (!stick || !knob) return;
    let active = false, id = null;
    const R = 56; // 摇杆半径（CSS px）
    function apply(dx, dy) {
      // dx,dy 为 knob 相对 center 的位移（CSS px）
      const d = Math.hypot(dx, dy);
      const k = Math.min(1, d / R);
      if (d > 0.5) {
        knob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
        E.setMove(g, dx * k / R, dy * k / R); // 归一化 -1..1
      } else {
        E.setMove(g, 0, 0);
      }
    }
    stick.addEventListener('touchstart', function (ev) {
      try {
        const t = ev.changedTouches[0];
        if (!t) return;
        active = true; id = t.identifier;
        const rect = stick.getBoundingClientRect();
        stick._cx = rect.left + rect.width / 2;
        stick._cy = rect.top + rect.height / 2;
        ev.preventDefault();
      } catch (e) { /* 摇杆异常不闪退 */ }
    }, { passive: false });
    stick.addEventListener('touchmove', function (ev) {
      try {
        if (!active) return;
        for (let i = 0; i < ev.changedTouches.length; i++) {
          const t = ev.changedTouches[i];
          if (t.identifier !== id) continue;
          apply(t.clientX - stick._cx, t.clientY - stick._cy);
        }
        ev.preventDefault();
      } catch (e) { }
    }, { passive: false });
    function end() {
      active = false;
      knob.style.transform = 'translate(0,0)';
      E.setMove(g, 0, 0);
    }
    stick.addEventListener('touchend', function () { end(); }, { passive: true });
    stick.addEventListener('touchcancel', function () { end(); }, { passive: true });
    // 桌面鼠标兜底
    stick.addEventListener('mousedown', function (ev) {
      try {
        active = true;
        stick._cx = ev.target.getBoundingClientRect().left + ev.target.getBoundingClientRect().width / 2;
        stick._cy = stick._cx - (ev.target.getBoundingClientRect().width / 2); // 估算
        const rect = stick.getBoundingClientRect();
        stick._cx = rect.left + rect.width / 2; stick._cy = rect.top + rect.height / 2;
        const move = function (me) { apply(me.clientX - stick._cx, me.clientY - stick._cy); };
        const up = function () { active = false; end(); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      } catch (e) { }
    });
  }

  /* ---------------- 开局选角 + 局内切角 UI ---------------- */
  function bindHero(g) {
    try {
      // 开局面板角色卡
      const cards = document.querySelectorAll('#menu .herocard');
      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          const hid = card.getAttribute('data-hero');
          if (!HEROES[hid]) return;
          g._pendingHero = hid;
          // 高亮选中
          cards.forEach(function (c) { c.classList.remove('sel'); });
          card.classList.add('sel');
          const label = $('heroLabel');
          if (label) label.textContent = HEROES[hid].name;
        }, { passive: true });
      });
      // 局内切换按钮（右上角）
      const sw = $('switchbtn');
      if (sw) {
        sw.addEventListener('click', function () {
          const heroPanel = $('heropanel');
          if (heroPanel && !heroPanel.hidden) { heroPanel.hidden = true; return; }
          if (!heroPanel) return;
          // 仅当 wave 是 5 的倍数时可切换
          heroPanel.hidden = false;
          const wrap = heroPanel.querySelector('.heros');
          if (wrap) {
            wrap.innerHTML = '';
            HERO_IDS.forEach(function (hid) {
              const h = HEROES[hid];
              const b = document.createElement('button');
              b.className = 'herobtn' + (g.hero === hid ? ' cur' : '');
              b.textContent = h.name + '·' + h.role;
              b.setAttribute('data-hero', hid);
              b.addEventListener('click', function () {
                E.switchHero(g, hid);
                heroPanel.hidden = true;
              }, { passive: true });
              wrap.appendChild(b);
            });
          }
        }, { passive: true });
      }
    } catch (e) { /* 选角异常不闪退 */ }
  }

  /* ---------------- 主渲染（分层：宣纸底 → 墨渍 → 墨粒 → 敌人 → 主角 → 墨爆） ---------------- */
  function frame(g, t) {
    if (!ctx || !canvas) return;
    try {
      if (paper && paper.width === canvas.width && paper.height === canvas.height) {
        ctx.drawImage(paper, 0, 0);
      } else {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      drawInkSpots(g);
      drawInkParticles(g);
      for (const e of g.enemies || []) drawEnemy(e, t, g);
      drawHero(g, t);
      drawUlt(g);
      drawSkillFlash(g, t);
      hud(g);
      showPick(g);
      showOver(g);
      showPause(g);
    } catch (e) { /* 渲染异常不闪退 */ }
  }

  /* ---------------- 墨粒飞散（击杀喷溅，短暂轨迹 + 渐隐） ---------------- */
  function drawInkParticles(g) {
    if (!ctx || !g) return;
    const W = canvas.width;
    const cam = g.cam || null;
    for (const p of g.particles || []) {
      if (!p) continue;
      const pos = toPx(p.x, p.y, cam);
      const a = Math.max(0, Math.min(1, p.life));
      const r = W * 0.004 * (0.5 + a);
      ctx.fillStyle = 'rgba(240,240,240,' + (a * 0.6).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, 6.2832); ctx.fill();
      // 墨粒拖尾（短白线）
      ctx.strokeStyle = 'rgba(240,240,240,' + (a * 0.3).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, W * 0.0015);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - p.vx * W * 0.06, pos.y - p.vy * canvas.height * 0.06);
      ctx.stroke();
    }
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    try {
      resize();
      const g = E.newGame((Date.now() & 0xffff) | 0);
      window.__moSword = g; // 调试 / 后续存档

      const startBtn = $('start');
      if (startBtn) startBtn.addEventListener('click', function () {
        const hid = g._pendingHero || g.hero;
        E.start(g, ((Math.random() * 0x7fffffff) | 0) >>> 0, hid);
        const m = $('menu');
        if (m) m.hidden = true;
      }, { passive: true });

      const againBtn = $('again');
      if (againBtn) againBtn.addEventListener('click', function () {
        E.start(g, ((Math.random() * 0x7fffffff) | 0) >>> 0, g.hero);
        const o = $('over');
        if (o) o.hidden = true;
      }, { passive: true });

      const resumeBtn = $('resume');
      if (resumeBtn) resumeBtn.addEventListener('click', function () { E.resume(g); }, { passive: true });

      // 游戏内暂停按钮（移动端）
      const pauseBtn = $('pausebtn');
      if (pauseBtn) pauseBtn.addEventListener('click', function () {
        if (g.state === 'playing' || g.state === 'pick') E.pause(g);
      }, { passive: true });

      bindKeys(g);
      bindTouch(g);
      bindHero(g);

      // 页面隐藏时暂停（防 rAF 爆炸与闪退）
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && g.state === 'playing') E.pause(g);
      }, { passive: true });

      window.addEventListener('resize', function () { resize(); }, { passive: true });

      let last = 0;
      function loop(t) {
        try {
          const dt = last ? (t - last) / 1000 : 0.016;
          last = t;
          E.tick(g, dt);
          frame(g, t);
        } catch (e) {
          // 单帧渲染异常不冒泡，避免整页闪退
          if (typeof console !== 'undefined') console.error('[mo-sword] frame error', e);
        }
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    } catch (e) {
      if (typeof console !== 'undefined') console.error('[mo-sword] boot failed', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { passive: true });
  } else {
    boot();
  }
})();
