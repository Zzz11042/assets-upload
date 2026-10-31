// 木屋风橡木背景: 整齐的水平木板(等宽 5 行)+ 错缝竖向接缝(砖砌式 offset)+ 板面内木纹线条
// 颜色采样自原始 ARTX.oak(320×400 像素橡木图), 每行板取一条原图横带 → 纹理与原版同种橡木
// 整体观感: 像木屋外墙的整齐横木板, 而不是杂乱的随机多板拼接
// 256×256 可平铺 tile, CSS background-repeat:repeat 铺满 #app / 面板

const OAK_W = 256, OAK_H = 256;
// 整齐木屋风: 5 行等宽横木板(每行 51.2px), 行间错缝 offset(砖砌式)
const ROWS = 5;
const ROW_H = Math.floor(OAK_H / ROWS); // 51
// 错缝模式: 偶数行(0,2,4)一段整板; 奇数行(1,3)两段错缝 — 像木屋外墙砖砌
const STAGGER = 2; // 错缝偏移比例

function genOakFromOriginal(){
  if(typeof document==='undefined' || !document.createElement || !window.ARTX || !window.ARTX.oak) return null;

  // 1) 加载原始橡木图到离屏 canvas(采样用)
  const img=new Image();
  let srcCan=null;
  img.onload=function(){
    srcCan=document.createElement('canvas');
    srcCan.width=img.naturalWidth||img.width||320;
    srcCan.height=img.naturalHeight||img.height||400;
    srcCan.getContext('2d').drawImage(img,0,0,srcCan.width,srcCan.height);
    renderTile();
  };
  img.onerror=function(){
    // 原始图加载失败: 退回纯色整齐横板(不崩)
    const c=document.createElement('canvas'); c.width=OAK_W; c.height=OAK_H;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#8a5a30'; ctx.fillRect(0,0,OAK_W,OAK_H);
    for(let r=0;r<ROWS;r++){ paintRow(ctx, r, null); }
    window.ARTX.oak=c.toDataURL('image/png');
    if(window.__reinjectOak) window.__reinjectOak();
  };
  img.src=window.ARTX.oak;

  // 2) 按"整齐木屋风"布局把原图横带平铺到 256×256 tile
  function renderTile(){
    if(!srcCan) return;
    const c=document.createElement('canvas'); c.width=OAK_W; c.height=OAK_H;
    const ctx=c.getContext('2d');
    const sw=srcCan.width, sh=srcCan.height;
    for(let r=0;r<ROWS;r++){
      paintRow(ctx, r, srcCan, sw, sh);
    }
    // 轻微颗粒(与原图像素质感一致, 比上版更克制)
    for(let i=0;i<300;i++){
      const x=(Math.random()*OAK_W)|0, y=(Math.random()*OAK_H)|0;
      ctx.fillStyle=Math.random()<0.5?'rgba(40,20,5,0.06)':'rgba(240,220,180,0.05)';
      ctx.fillRect(x,y,1,1);
    }
    window.ARTX.oak=c.toDataURL('image/png');
    if(window.__reinjectOak) window.__reinjectOak();
  }

  // 画一行木板: 偶数行整板, 奇数行两段错缝; 每行从原图取一条横带, 板面内画 2~3 条木纹细线
  function paintRow(ctx, r, srcCan, sw, sh){
    const ry=r*ROW_H; // 行顶部
    const rh=ROWS-1===r ? OAK_H-ry : ROW_H; // 最后一行补到 256
    // 该行用原图第 r/ROWS 条横带(4 等分采样, 纹理来自原版橡木)
    const srcY=Math.floor(r*sh/ROWS);
    const srcH=Math.ceil(sh/ROWS);

    // 分段: 偶数行(0,2,4)整板; 奇数行(1,3)两段, 错缝 50%
    let segs;
    if(r%2===0){
      segs=[{x:0,w:OAK_W}];
    }else{
      // 两段错缝: 左段 0~128, 右段 128~256, 接缝在 128(上一段行接缝在 0/256 边界, 形成砖砌式错开)
      segs=[{x:0,w:128},{x:128,w:128}];
    }

    // 每段: 原图横带平铺到段 + 板面内横向木纹细线(每板 2~3 条, 整齐等距)
    for(const s of segs){
      // 平铺原图横带到段
      if(srcCan && sw && sh){
        for(let dy=0; dy<rh; dy+=srcH){
          for(let dx=0; dx<s.w; dx+=sw){
            const cdx=Math.min(sw, s.w-dx), cdy=Math.min(srcH, rh-dy);
            const sxw=Math.min(sw, sw), syw=Math.min(srcH, sh-srcY);
            ctx.drawImage(srcCan, 0, srcY, sxw, syw, s.x+dx, ry+dy, cdx, cdy);
          }
        }
      } else {
        // 纯色兜底
        ctx.fillStyle='#8a5a30';
        ctx.fillRect(s.x, ry, s.w, rh);
      }
      // 板面内横向木纹细线(整齐等距, 每板 2~3 条, 模拟木屋横木纹理)
      const lines=3;
      for(let li=1;li<=lines;li++){
        const ly=ry+Math.round(rh*li/(lines+1));
        ctx.strokeStyle='rgba(50,30,10,0.18)';
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(s.x+2, ly);
        ctx.lineTo(s.x+s.w-2, ly);
        ctx.stroke();
      }
    }

    // 行间横向板缝(整齐: 每行底一条)
    ctx.strokeStyle='rgba(30,15,5,0.5)';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0, ry+rh); ctx.lineTo(OAK_W, ry+rh); ctx.stroke();
    // 缝上方 1px 高光(木板凸起感)
    ctx.strokeStyle='rgba(216,184,136,0.25)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0, ry+rh-1); ctx.lineTo(OAK_W, ry+rh-1); ctx.stroke();
    // 奇数行: 错缝接缝(128 处一条竖缝)
    if(r%2===1){
      ctx.strokeStyle='rgba(30,15,5,0.45)';
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(128, ry); ctx.lineTo(128, ry+rh); ctx.stroke();
    }
  }

  return null; // 异步(img.onload)
}

// 启动: 生成并替换 window.ARTX.oak (整齐木屋风: 等宽横板 + 错缝 + 板内木纹细线)
(function generateOak(){
  if(!window.ARTX) return;
  const r=genOakFromOriginal();
  if(r===null){
    setTimeout(function(){ if(window.__reinjectOak) window.__reinjectOak(); }, 50);
  }
})();
