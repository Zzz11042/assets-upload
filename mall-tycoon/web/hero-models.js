// 主角像素模型 (16×16, 4-bit 调色板) — 与 GOODS_MODELS 同风格
// 输出 window.HERO_MODELS = { base, suit, moped, bike, ... } 各状态主角造型
// 主角「小满」: 默认休闲 / 西装(打工) / 载具
(function(){
  if(typeof document==='undefined' || !document.createElement) return;
  const PALETTE = [
    '#000000', // 0 黑
    '#1a1a1a', // 1 深灰
    '#3a3a3a', // 2 灰
    '#6a6a6a', // 3 中灰
    '#9a9a9a', // 4 浅灰
    '#e0e0e0', // 5 白
    '#fff8ec', // 6 奶白
    '#f5e8c8', // 7 米
    '#d8b888', // 8 橡木(头发/皮肤偏棕)
    '#8a5a30', // 9 深橡(头发)
    '#f0c090', // a 皮肤
    '#e89860', // b 皮肤阴影
    '#4a90d9', // c 牛仔蓝(休闲衣)
    '#1565c0', // d 深蓝(西装)
    '#e86030', // e 橙(外套)
    '#2e7d32', // f 绿
  ];
  // 16×16 主角造型: '.' 透明
  const grid = (rows)=>{
    const c=document.createElement('canvas'); c.width=16; c.height=16;
    const ctx=c.getContext('2d');
    for(let y=0;y<16;y++){
      const row=rows[y]||'';
      for(let x=0;x<16;x++){
        const ch=(row[x]||'.');
        if(ch==='.') continue;
        const idx=parseInt(ch,16);
        if(idx<0||idx>=PALETTE.length) continue;
        ctx.fillStyle=PALETTE[idx];
        ctx.fillRect(x,y,1,1);
      }
    }
    return c.toDataURL('image/png');
  };

  // 主角「小满」— 默认休闲(站姿): 棕发/皮肤/牛仔蓝衣/深色裤
  const heroBase = [
    "................",
    "................",
    ".....999999.....",
    "....99999999....",
    "....9aa9aa9.....",
    "....aaaaaa......",
    "...aabbbaa......",
    "...aaaaaaaa.....",
    "...cccccc.......",
    "...cccccc.......",
    "...c.cc.c.......",
    "...c.cc.c.......",
    "...9.99.9.......",
    "...9.99.9.......",
    "...11..11.......",
    "................",
  ];
  // 西装(打工): 深蓝西装 + 白领
  const heroSuit = [
    "................",
    "................",
    ".....999999.....",
    "....99999999....",
    "....9aa9aa9.....",
    "....aaaaaa......",
    "...aabbbaa......",
    "...d5dd5d5......",
    "...dd.dddd......",
    "...ddd.ddd......",
    "...d.d.dd.......",
    "...d.d.dd.......",
    "...9.99.9.......",
    "...9.99.9.......",
    "...11..11.......",
    "................",
  ];
  // 穿橙色外套(大衣)
  const heroCoat = [
    "................",
    "................",
    ".....999999.....",
    "....99999999....",
    "....9aa9aa9.....",
    "....aaaaaa......",
    "...aabbbaa......",
    "...eeeeee.......",
    "...ee.eee.......",
    "...ee.eee.......",
    "...e.e.e.e......",
    "...e.e.e.e......",
    "...9.99.9.......",
    "...9.99.9.......",
    "...11..11.......",
    "................",
  ];
  // 骑电动摩托
  const heroMoped = [
    "................",
    "................",
    ".....999999.....",
    "....99999999....",
    "...a.aaaaaa.....",
    "...aaaaaaaa.....",
    "...cccccc.......",
    "...cccccc.......",
    "222cccccc22.....",
    "222cc.cc22......",
    "000.1.1.00......",
    "20.0..0.02......",
    ".00....00.......",
    "................",
    "................",
    "................",
  ];
  // 骑自行车
  const heroBike = [
    "................",
    "................",
    ".....999999.....",
    "....99999999....",
    "...a.aaaaaa.....",
    "...aaaaaaaa.....",
    "...cccccc.......",
    "22.ccc.cc2......",
    "22.c..c22.......",
    "00.1..100.......",
    "00....00........",
    ".00..00.........",
    "................",
    "................",
    "................",
    "................",
  ];

  window.HERO_MODELS = {
    base:  grid(heroBase),
    suit:  grid(heroSuit),
    coat:  grid(heroCoat),
    moped: grid(heroMoped),
    bike:  grid(heroBike),
  };
  // 辅助: 按主角资产/岗位 返回最合适模型 key
  window.heroModelFor=function(p){
    if(!p) return 'base';
    // 载具优先(资产有 moped 显示摩托, 否则 bike)
    if(p.assets && p.assets.moped) return 'moped';
    if(p.assets && p.assets.bike) return 'bike';
    // 资产: 大衣 > 西装 > 默认
    if(p.assets && p.assets.coat) return 'coat';
    // 有打工岗位且不是默认 cafe → 西装
    if(p.job && p.job!=='cafe') return 'suit';
    return 'base';
  };
})();
