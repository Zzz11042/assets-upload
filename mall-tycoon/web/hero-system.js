// 主角系统 UI: 打工/消费/恋爱/资产 5 个子标签 + 状态 HUD + 打工小游戏弹层 + 接私活
// 依赖 game.js 的 WORK_JOBS / CONSUMABLES / ROMANCE_NPCS / doWork / buyConsumable /
//          jobUnlocked / workJobPay / MINIGAME_TPL / minigameSettle / SIDE_GIG
(function(){
  if(typeof document==='undefined' || !document.getElementById || !window.ARTX) return;
  // 等 game.js 运行完
  if(!window.doWork || !window.WORK_JOBS){
    setTimeout(function(){
      if(window.doWork && window.WORK_JOBS) init();
    }, 50);
    return;
  }
  init();

  function init(){
    const $=id=>document.getElementById(id);
    const heroPanel=$('heroPanel');
    if(!heroPanel) return;
    // 子标签切换(暴露到 window 供 UI 块调用)
    let _tab='work';
    window._heroTab=_tab;
    window._heroTabClick=function(t){ _tab=t; window._heroTab=t; renderHeroPanel(); };

    // 暴露到 window 供 UI 块调用
    window.renderHeroPanel=renderHeroPanel;
    // HUD 刷新
    const e=$('heroEnergy'); const m=$('heroMood'); const chip=$('heroChip');
    window.updateHeroHUD=function(){
      const p=(window.state&&window.state.protagonist)||{energy:100,mood:50};
      if(e) e.textContent=p.energy;
      if(m) m.textContent=p.mood;
      if(chip){
        const job=window.WORK_JOBS.find(j=>j.key===p.job);
        chip.title='主角 '+p.name+' · 体力 '+p.energy+'/'+p.maxEnergy+' · 心情 '+p.mood+' · 岗位 '+(job?job.name:'无');
      }
    };
    window.updateHeroHUD();
  }

  function renderHeroPanel(){
    const $=id=>document.getElementById(id);
    const p=$('heroPanel');
    p.innerHTML='';
    const st=window.state.protagonist;
    // 标题 + 主角像素形象(HERO_MODELS)
    const h=document.createElement('h3');
    h.textContent='🧑 主角 · '+st.name;
    p.appendChild(h);
    // 主角形象: 动漫立绘(ART_GEN)按性别选 heroMale/heroFemale 优先, 缺省回退 hand-crafted 16×16(HERO_MODELS)
    const modelKey=window.heroModelFor(st);
    const heroArtKey=(st.gender==='female'?'heroFemale':'heroMale');
    const modelImg=document.createElement('img');
    modelImg.className='heroModel heroModelBig';
    modelImg.src=(window.ART_GEN&&window.ART_GEN[heroArtKey]) || (window.ART_GEN&&window.ART_GEN[modelKey==='base'?'hero':modelKey]) || (window.HERO_MODELS&&window.HERO_MODELS[modelKey]) || '';
    modelImg.alt='主角立绘';
    modelImg.title='主角立绘: '+(st.gender==='female'?'女生':'男生')+' · 造型 '+modelKey;
    p.appendChild(modelImg);
    // 状态条
    const stats=document.createElement('div');
    stats.style.cssText='font-size:11px;color:#fff8ec;line-height:1.6;margin-bottom:8px';
    const jobDef=window.WORK_JOBS.find(j=>j.key===st.job);
    stats.innerHTML='💪 体力 <b>'+st.energy+'</b>/'+st.maxEnergy+' · 😊 心情 <b>'+st.mood+'</b> · 🍔 饱食 <b>'+st.hunger+'</b><br>'
      +'💼 当前岗位: <b>'+(jobDef?jobDef.emoji+' '+jobDef.name:'无')+'</b> · 累计打工 '+st.jobDays+' 天<br>'
      +'💕 恋爱: <b>'+(st.romance?('与 '+ROMANCE_NPCS[st.romance].name+' (好感 '+st.romanceLevel+'/10)'):'单身')+'</b>';
    p.appendChild(stats);
    // 子标签
    const tabs=['work','consume','love','cg','design','studio','assets'];
    const tabNames={work:'💼 打工', consume:'🛒 消费', love:'💕 恋爱', cg:'🖼️ CG', design:'🎨 设计', studio:'🎮 工作室', assets:'🎁 资产'};
    const tabBar=document.createElement('div');
    tabBar.style.cssText='display:flex;gap:4px;margin:8px 0;flex-wrap:wrap';
    tabs.forEach(t=>{
      const b=document.createElement('button');
      b.className='heroTab'+(window._heroTab===t?' active':'');
      b.textContent=tabNames[t];
      b.onclick=()=>{ window._heroTabClick(t); };
      tabBar.appendChild(b);
    });
    p.appendChild(tabBar);
    // 内容区
    const body=document.createElement('div');
    body.className='heroBody';
    if(window._heroTab==='work') renderWorkTab(body);
    else if(window._heroTab==='consume') renderConsumeTab(body);
    else if(window._heroTab==='love') renderLoveTab(body);
    else if(window._heroTab==='cg') renderCGTab(body);
    else if(window._heroTab==='design') renderDesignTab(body);
    else if(window._heroTab==='studio') renderStudioTab(body);
    else renderAssetsTab(body);
    p.appendChild(body);
    window.updateHeroHUD&&window.updateHeroHUD();
  }

  function renderWorkTab(body){
    const st=window.state.protagonist;
    const intro=document.createElement('div');
    intro.style.cssText='font-size:11px;color:#fff8ec;margin-bottom:6px';
    intro.textContent='选个岗位打工, 体力耗尽就只能睡觉恢复。心情好/熟练度高/有西装 → 收益更高。打工可先开小游戏: 10s 内通关 → 全额工资 + 心情 +5; 超时 → 40% 工资 + 心情 -3。';
    body.appendChild(intro);
    // 接私活入口(每日 1 次, 走小游戏模板 "gig", 体力 15)
    if(window.SIDE_GIG){
      const gigRow=document.createElement('div');
      const gigAvail=window.jobUnlocked(window.SIDE_GIG);
      gigRow.className='heroRow'+(gigAvail?'':' owned');
      gigRow.innerHTML='<div class="hName">📞 接私活 <span class="m">'+(gigAvail?'¥'+window.workJobPay('gig')+'/次(限时挑战)':'今日已接单')+'</span></div>'
        +'<div class="hDesc">'+window.SIDE_GIG.desc+' · 8s 内点 5 次 → 全额, 超时 40%</div>';
      if(gigAvail && st.energy>=window.SIDE_GIG.energyCost){
        gigRow.onclick=()=>{
          startMinigame('gig');
        };
      } else {
        gigRow.style.cursor='not-allowed';
        gigRow.title=gigAvail?'体力不足':'今日已接单, 明天再来';
      }
      body.appendChild(gigRow);
    }
    // 主职业列表(接私活有专门入口, 不在这里重复渲染)
    window.WORK_JOBS.filter(j=>!j.gig).forEach(j=>{
      const un=window.jobUnlocked(j);
      const can=un&&st.energy>=j.energyCost;
      const row=document.createElement('div');
      row.className='heroRow'+(un?'':' locked')+((st.job===j.key)?' on':'');
      const pay=un?window.workJobPay(j.key):0;
      const tpl=(window.MINIGAME_TPL&&window.MINIGAME_TPL[j.key])||null;
      const mgNote=tpl?(' · 小游戏「'+tpl.title+'」'+((st.minigames&&st.minigames[j.key])?'(已通关 '+st.minigames[j.key]+' 次)':'')): '';
      row.innerHTML='<div class="hName">'+j.emoji+' '+j.name+' <span class="m">'+(un?'¥'+pay+'/次':'🔒')+'</span></div>'
        +'<div class="hDesc">'+j.desc+' · 体力 -'+j.energyCost+' · 心情 '+(j.moodDelta>=0?'+':'')+j.moodDelta+mgNote+'</div>'
        +(tpl&&un?'<button class="invBuy mgBtn" style="margin-top:4px;font-size:10px;padding:2px 6px">🎮 开小游戏(限时挑战)</button>':'');
      if(un){
        // 行本体: 直接打工(数值版, 保留原手感)
        row.onclick=(e)=>{
          if(e.target && e.target.classList && e.target.classList.contains('mgBtn')) return;
          const r=window.doWork(j.key);
          if(r==='energy'){ setTip('体力不足, 睡觉恢复(结束今日)'); }
          else if(r){ save(); floatNum($('heroBtn'),'+'+fmt(r),false); setTip('已打工 '+j.name+', 赚 ¥'+r); window.updateHeroHUD&&window.updateHeroHUD(); renderAll(); }
        };
        // 小游戏按钮: 开限时挑战
        const mg=row.querySelector('.mgBtn');
        if(mg){
          mg.onclick=(e)=>{
            e.stopPropagation();
            startMinigame(j.key);
          };
        }
      } else {
        row.style.cursor='not-allowed';
        row.title='未解锁: '+describeReq(j.unlockReq);
      }
      body.appendChild(row);
    });
  }
  // 小游戏框架: startMiniGame(jobKey) → 弹层 + 计时 + 结算
  // 结算统一走 game.js 的 minigameSettle(jobKey, success): 全额 / 40% + 心情 ±
  function startMinigame(jobKey, customTpl, onDone){
    const st=window.state.protagonist;
    const tpl=customTpl||((window.MINIGAME_TPL||{})[jobKey]);
    const job=window.WORK_JOBS.find(j=>j.key===jobKey);
    if(!tpl) return;
    // 体力: 有 job 则扣 job.energyCost; 设计产品无 job, 不扣体力(用资金替代)
    const cost=job?job.energyCost:0;
    if(cost>0 && st.energy<cost){ setTip('体力不足, 无法开工'); return; }
    // 先扣体力, 进入挑战(与 doWork 相同)
    if(cost>0) st.energy-=cost;
    const ov=document.createElement('div');
    ov.className='mgEvent';
    ov.id='_mgEvent';
    const total=tpl.time*1000;
    let remaining=total;
    let done=0;
    let hitCount=0;
    const box=document.createElement('div');
    box.style.cssText='padding:12px;max-width:340px;background:linear-gradient(180deg,#8a5a30,#7a4a20);border:2px solid #5a3a18;color:#fff8ec';
    const titleEl=document.createElement('div');
    titleEl.style.cssText='font-size:13px;font-weight:900;margin-bottom:6px';
    titleEl.textContent=tpl.title+' · '+tpl.desc;
    box.appendChild(titleEl);
    // 倒计时条
    const barWrap=document.createElement('div');
    barWrap.style.cssText='height:6px;background:rgba(255,255,255,.15);border-radius:3px;margin-bottom:8px';
    const bar=document.createElement('div');
    bar.style.cssText='height:6px;background:#6db36d;border-radius:3px;width:100%';
    barWrap.appendChild(bar);
    box.appendChild(barWrap);
    const cellsWrap=document.createElement('div');
    cellsWrap.style.cssText='display:grid;grid-template-columns:repeat('+(tpl.of||Math.min(tpl.cells,3))+',1fr);gap:6px;margin-bottom:8px';
    if(tpl.choice){
      // 理财/荐股: 3 个方案, 随机收益, 选最高的
      const opts=[0,1,2].map(i=>{
        const rate=Math.round((3+Math.random()*10)*10)/10;
        return {i, rate, gain:Math.round(rate*(100+i*50))};
      });
      const best=Math.max(...opts.map(o=>o.gain));
      opts.forEach(o=>{
        const b=document.createElement('button');
        b.style.cssText='padding:8px;font-size:11px;background:rgba(0,0,0,.2);border:1px solid rgba(200,160,120,.5);color:#fff8ec';
        b.textContent='方案'+(o.i+1)+' · 年化 '+o.rate+'% · 预期 ¥'+o.gain;
        b.onclick=(e)=>{
          e.stopPropagation();
          if(o.gain===best) finish(true); else finish(false);
        };
        cellsWrap.appendChild(b);
      });
    } else {
      const gridN=tpl.of||tpl.cells;
      const pickN=tpl.cells;
      // 找画(tpl.of): 随机 5 格为画, 点中才计数; 其余模式全格可点
      let picSet=new Set();
      if(tpl.of){
        const idx=[...Array(gridN).keys()];
        while(picSet.size<pickN) picSet.add(idx.splice(Math.floor(Math.random()*idx.length),1)[0]);
      }
      const isPic=i=>tpl.of?picSet.has(i):true;
      for(let i=0;i<gridN;i++){
        const b=document.createElement('button');
        b.dataset.i=i;
        b.style.cssText='height:40px;font-size:14px;background:'+(isPic(i)?'rgba(109,179,109,.4)':'rgba(0,0,0,.25)')+';border:1px solid rgba(200,160,120,.5);color:#fff8ec;border-radius:3px';
        b.textContent=(tpl.tap?'📞':(tpl.of?(isPic(i)?'🖼':'❓'):(i+1)));
        b.onclick=(e)=>{
          e.stopPropagation();
          if(tpl.tap){
            if(hitCount>=pickN) return;
            hitCount++;
            b.textContent='✅';
            b.disabled=true;
            if(hitCount>=pickN) finish(true);
            return;
          }
          if(tpl.order){
            if(+b.dataset.i!==done){ done=0; b.disabled=true; b.textContent='✗'; return; }
            done++;
            b.disabled=true; b.textContent='✓';
            if(done>=pickN) finish(true);
            return;
          }
          if(tpl.of && !isPic(i)){ setTip('这里没有画'); return; }
          if(b.dataset.hit) return;
          b.dataset.hit='1'; done++;
          b.textContent='✓';
          if(done>=pickN) finish(true);
        };
        cellsWrap.appendChild(b);
      }
    }
    box.appendChild(cellsWrap);
    const tipEl=document.createElement('div');
    tipEl.style.cssText='font-size:10px;opacity:.7';
    tipEl.textContent='限时 '+tpl.time+'s · 超时按 40% 结算 · 点击遮罩放弃';
    box.appendChild(tipEl);
    ov.appendChild(box);
    let finished=false;
    let timer=setInterval(()=>{
      remaining-=100;
      bar.style.width=Math.max(0,remaining/total*100)+'%';
      if(remaining<=0){ clearInterval(timer); finish(false); }
    },100);
    function finish(success){
      if(finished) return;
      finished=true;
      clearInterval(timer);
      ov.remove();
      // 自定义结算(设计产品等), 否则走打工小游戏统一结算
      if(onDone){
        onDone(success);
        return;
      }
      const pay=window.minigameSettle(jobKey, success);
      save();
      if(jobKey==='gig'){
        floatNum($('heroBtn'),(success?'✅ 接单成功 ':'超时 40% ')+'¥'+pay,false);
        setTip('接私活结算: '+(success?'全额':'40%')+' ¥'+pay);
      } else {
        floatNum($('heroBtn'),(success?'🎮 通关 ':'🎮 超时 ')+'¥'+pay,false);
        setTip('小游戏结算: '+(success?'全额工资':'40% 工资')+' ¥'+pay);
      }
      window.updateHeroHUD&&window.updateHeroHUD();
      renderAll();
    }
    ov.onclick=(e)=>{ if(e.target===ov) finish(false); };
    document.body.appendChild(ov);
  }
  window.startMinigame=startMinigame;
  // 设计产品专用: 不扣体力, 无工资结算, 直接回调 onDone
  window.openProductMinigame=function(productKey, onDone){
    startMinigame(productKey, window.PRODUCT_MINIGAME, onDone);
  };
  function describeReq(req){
    if(!req) return '';
    const parts=[];
    if(req.jobDays) parts.push('打工 '+req.jobDays+' 天');
    if(req.investLevel) parts.push('投资 Lv≥'+req.investLevel);
    if(req.shopsBuilt) parts.push('开过 '+(window.SHOPS[req.shopsBuilt[0]]?window.SHOPS[req.shopsBuilt[0]].name:req.shopsBuilt[0]));
    return parts.join(' + ');
  }

  function renderConsumeTab(body){
    const st=window.state.protagonist;
    const money=window.state.money;
    const cats=[['food','🍔 食物'],['vehicle','🛵 载具'],['cloth','👔 衣服'],['house','🏠 房子'],['service','🎫 服务']];
    cats.forEach(([cat,name])=>{
      const items=window.CONSUMABLES.filter(c=>c.cat===cat);
      if(!items.length) return;
      const head=document.createElement('div');
      head.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:8px 0 4px';
      head.textContent=name;
      body.appendChild(head);
      items.forEach(c=>{
        const owned=st.assets[c.key];
        const can=state.money>=c.price&&!owned;
        const row=document.createElement('div');
        row.className='heroRow'+(owned?' owned':'')+(!owned?'':'');
        row.innerHTML='<div class="hName">'+c.name+' <span class="m">'+(owned?'✅已拥有':'¥'+c.price)+'</span></div>'
          +'<div class="hDesc">'+c.desc+'</div>';
        if(!owned){
          row.onclick=()=>{
            const r=window.buyConsumable(c.key);
            if(r==='money'){ window.setTip&&window.setTip('资金不足, 需 ¥'+c.price); }
            else if(r){ window.save&&window.save(); window.floatNum&&window.floatNum($('heroBtn'),'已买 '+c.name,false); window.setTip&&window.setTip('已购 '+c.name); window.updateHeroHUD&&window.updateHeroHUD(); window.renderAll&&window.renderAll(); renderHeroPanel(); }
          };
        } else row.style.opacity='.6';
        body.appendChild(row);
      });
    });
  }

  function renderLoveTab(body){
    const st=window.state.protagonist;
    const intro=document.createElement('div');
    intro.style.cssText='font-size:11px;color:#fff8ec;margin-bottom:6px';
    intro.textContent='送礼物(¥50)涨好感: 好感 1/3/5 逐级解锁 初识·熟络·心绪 三章; 好感满 5 可表白, 恋爱后进度 1/4/7/10 解锁 告白·甜蜜·情深·婚约 四章 —— 共 7 章, 点亮后可回看。';
    body.appendChild(intro);
    // 按主角性别取可恋池
    const pool=window.romancePool();
    // 性别切换器(仅开局未锁定时可改)
    if(!st.genderChosen){
      const gbar=document.createElement('div');
      gbar.style.cssText='font-size:11px;color:#fff8ec;margin:6px 0;display:flex;gap:4px;align-items:center';
      gbar.innerHTML='<span>主角性别:</span>';
      [['male','♂ 男生'],['female','♀ 女生']].forEach(([g,l])=>{
        const b=document.createElement('button');
        b.className='heroTab'+(st.gender===g?' active':'');
        b.textContent=l; b.style.flex='0 0 auto'; b.style.cssText+='padding:2px 8px';
        b.onclick=()=>{ window.setGender(g); save(); renderHeroPanel(); setTip&&window.setTip('已选择主角为'+(g==='male'?'男':'女')+'生, 恋爱池已切换'); };
        gbar.appendChild(b);
      });
      body.appendChild(gbar);
    } else {
      const gnote=document.createElement('div');
      gnote.style.cssText='font-size:10px;color:#fff8ec;margin:4px 0';
      gnote.textContent='主角: '+(st.gender==='male'?'♂ 男生':'♀ 女生')+' · 可恋对象: '+(st.gender==='male'?'女生池':'男生池');
      body.appendChild(gnote);
    }
    pool.forEach(npc=>{
      const aff=st.friends[npc.key]||0;
      const isLove=st.romance===npc.key;
      const row=document.createElement('div');
      row.className='heroRow'+(isLove?' on':'');
      // 立绘(生图 ART_GEN[name.key] 优先, 缺省 emoji)
      const portrait=(window.ART_GEN&&window.ART_GEN[npc.key])||'';
      // 剧情章节(7 章): 点亮的可回看, 未解锁的显示条件
      const ups=window.romanceUnlocks(npc.key);
      // 注意: 章 0 的 sel 值为 0(falsy), 不能用 || 兜底
      const sel=(window._heroStorySel?window._heroStorySel[npc.key]:null);
      let cur=ups[ups.length-1];
      for(const u of ups){ if(u.unlocked&&sel===u.i) cur=u; }
      const beatMarks=ups.map((u,i)=>{
        const on=u.unlocked;
        return '<button class="storyBeat'+(on?' on':' locked')+((sel===i&&on)?' cur':'')+'" data-k="'+npc.key+'" data-i="'+i+'" title="'+(on?('章节·'+u.label):('未解锁 · '+u.hint))+'">'+(on?('·'+(i+1)):'🔒')+'</button>';
      }).join('');
      const storyHtml=cur ? ((cur.label?('<b>'+cur.label+'</b> '):'')+cur.text) : '还没有故事发生——送礼物提升好感, 解锁第一章';
      row.innerHTML=(portrait?'<img class="npcPortrait" src="'+portrait+'" alt="">':'<span class="npcEmoji">'+npc.emoji+'</span>')
        +'<div class="hName">'+npc.name+' <span class="m">'+(isLove?'💕 '+st.romanceLevel+'/10':'好感 '+aff+'/10')+'</span></div>'
        +'<div class="hDesc">'+npc.desc+'</div>'
        +'<div class="storyBeats">'+beatMarks+'</div>'
        +'<div class="hStory" id="story-'+npc.key+'">'+storyHtml+'</div>'
        +(!isLove&&aff>=5?'<div class="hBtn">💍 好感已满, 可表白</div>':'');
      // 章节按钮: 点亮的可回看
      row.querySelectorAll('.storyBeat.on').forEach(btn=>{
        btn.onclick=(e)=>{ e.stopPropagation(); const i=+btn.dataset.i; const s=(window._heroStorySel=(window._heroStorySel||{}))[npc.key]; window._heroStorySel[npc.key]=(s===i)?null:i; renderHeroPanel(); };
      });
      // 送礼按钮
      const gift=document.createElement('button');
      gift.className='invBuy';
      gift.style.cssText='margin-top:4px;font-size:10px;padding:2px 6px';
      gift.textContent='🎁 送礼物 ¥50';
      gift.onclick=()=>{
        const r=window.giftToNPC(npc.key);
        if(r==='money'){ setTip('资金不足, 需 ¥50'); }
        else { save(); window.maybeShowCGEvent&&window.maybeShowCGEvent(); window.updateHeroHUD&&window.updateHeroHUD(); renderHeroPanel(); }
      };
      row.appendChild(gift);
      // 表白按钮
      if(!isLove&&aff>=5){
        const prop=document.createElement('button');
        prop.className='invBuy';
        prop.style.cssText='margin-top:4px;margin-left:6px;font-size:10px;padding:2px 6px';
        prop.textContent='💍 表白';
        prop.onclick=()=>{
          const r=window.proposeTo(npc.key);
          if(r==='low'){ setTip('好感不够, 需满 5'); }
          else if(r==='already'){ setTip('已是恋人'); }
          else if(r==='wrongpool'){ setTip('与性别不符, 不可恋爱'); }
          else { save(); sUpgrade&&sUpgrade(); window.maybeShowCGEvent&&window.maybeShowCGEvent(); renderHeroPanel(); }
        };
        row.appendChild(prop);
      }
      body.appendChild(row);
    });
  }

  function renderCGTab(body){
    const c=window.cgCount();
    const intro=document.createElement('div');
    intro.style.cssText='font-size:11px;color:#fff8ec;margin-bottom:6px';
    intro.textContent='恋爱 CG 收集簿: '+c.u+'/'+c.t+' 张已解锁。随好感度/恋爱进度跨越关键章节自动解锁。未解锁的以剪影占位。';
    body.appendChild(intro);
    // 每角色分组
    for(const npcKey of Object.keys(window.ROMANCE_CGS)){
      const npc=window.ROMANCE_NPCS[npcKey]; if(!npc) continue;
      const list=window.cgsOf(npcKey);
      const sec=document.createElement('div');
      sec.className='heroRow';
      sec.style.cssText='border:1px solid rgba(150,120,100,.4);border-radius:2px;padding:6px;margin:6px 0;background:rgba(0,0,0,.08)';
      sec.innerHTML='<div class="hName">'+npc.emoji+' '+npc.name+' <span class="m">('+list.filter(x=>x.unlocked).length+'/'+list.length+')</span></div>';
      const grid=document.createElement('div');
      grid.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
      list.forEach(cg=>{
        const box=document.createElement('div');
        box.style.cssText='width:96px';
        if(cg.unlocked&&cg.art){
          box.innerHTML='<img class="cgThumb" src="'+cg.art+'" alt="" style="width:96px;height:54px;object-fit:cover;background:#000;border:1px solid rgba(150,120,100,.6)"><div style="font-size:9px;color:#fff8ec;margin-top:2px">'+cg.title+'</div>';
        } else {
          box.innerHTML='<div style="width:96px;height:54px;background:rgba(0,0,0,.4);border:1px dashed rgba(200,160,180,.4);display:flex;align-items:center;justify-content:center;font-size:22px;color:rgba(255,248,236,.35)">🔒</div><div style="font-size:9px;color:#fff8ec;margin-top:2px;opacity:.5">'+cg.title+' · '+(cg.unlocked?'待生成':'未解锁')+'</div>';
        }
        if(cg.unlocked){
          box.style.cursor='pointer';
          box.onclick=()=>{ window._showCGView(npcKey,cg.s); }; // 放大查看器(主动浏览), 非全屏事件
          box.title='点击查看大图';
        }
        grid.appendChild(box);
      });
      sec.appendChild(grid);
      body.appendChild(sec);
    }
  }

  // 全屏 CG 事件(视觉小说风: 场景插画 + 底部文本框 + 名牌), 支持左右切换相邻章节
  function showCGEvent(npcKey,sIdx){
    const list=window.cgsOf(npcKey);
    const cg=list.find(x=>x.s===sIdx); if(!cg||!cg.unlocked) return;
    const npc=window.ROMANCE_NPCS[npcKey];
    // 相邻已解锁章节
    const unlocked=list.filter(x=>x.unlocked);
    const curIdx=unlocked.findIndex(x=>x.s===sIdx);
    const prev=curIdx>0?unlocked[curIdx-1]:null;
    const next=curIdx<unlocked.length-1?unlocked[curIdx+1]:null;
    const ov=document.createElement('div');
    ov.className='cgEvent';
    ov.id='_cgEvent';
    const art=cg.art;
    ov.innerHTML=(art?'<img class="cgEventArt" src="'+art+'" alt="">':'')
      +'<div class="cgEventBar">'
        +'<div class="cgEventName">'+npc.emoji+' '+npc.name+' · '+cg.title+'</div>'
        +'<div class="cgEventText">'+(window.cgEventText(npcKey,cg.s)||'…')+'</div>'
        +'<div class="cgEventHint">'
          +(prev?'<button class="cgNav" data-nav="-1">◀ 上一章</button>':'')
          +(next?'<button class="cgNav" data-nav="1">下一章 ▶</button>':'')
          +'<span class="cgNavClose">✕ 关闭</span>'
        +'</div>'
      +'</div>';
    ov.onclick=(e)=>{
      if(e.target.classList&&e.target.classList.contains('cgNav')){
        const dir=+e.target.dataset.nav;
        const t=list.find(x=>x.s===(sIdx+dir));
        if(t&&t.unlocked){ ov.remove(); showCGEvent(npcKey,t.s); }
        return;
      }
      ov.remove();
    };
    document.body.appendChild(ov);
  }

  window._showCGEvent=showCGEvent;

  // CG 放大查看器(主动浏览: 大图 16:9 + 标题 + 剧情台词 + 解锁条件, 模态弹层)
  function showCGView(npcKey,sIdx){
    const list=window.cgsOf(npcKey);
    const cg=list.find(x=>x.s===sIdx); if(!cg||!cg.unlocked||!cg.art) return;
    const npc=window.ROMANCE_NPCS[npcKey];
    // 解锁条件文案
    const cond=cg.s===0?'好感 ≥5':(cg.s===1?'恋爱进度 ≥1':'进度满 10(结婚)');
    const ov=document.createElement('div');
    ov.className='cgView';
    ov.id='_cgView';
    ov.innerHTML='<img class="cgViewArt" src="'+cg.art+'" alt="">'
      +'<div class="cgViewBar">'
        +'<div class="cgViewName">'+npc.emoji+' '+npc.name+' · '+cg.title+'</div>'
        +'<div class="cgViewText">'+(window.cgEventText(npcKey,cg.s)||'')+'</div>'
        +'<div class="cgViewHint">'+npc.name+' · '+cond+' · 点击关闭</div>'
      +'</div>';
    ov.onclick=()=>{ ov.remove(); };
    document.body.appendChild(ov);
  }
  window._showCGView=showCGView;

  function renderDesignTab(body){
    const defs=window.PRODUCT_DEFS||[];
    const products=window.state.productList||[];
    const total=window.productTotalValue?window.productTotalValue():0;
    // 说明
    const head=document.createElement('div');
    head.style.cssText='font-size:10px;color:#fff8ec;margin-bottom:6px';
    head.textContent='设计产品 → 上市 → 每日自动卖货 · 累计收益 ¥'+total.toLocaleString()+' · 产品质量受设计小游戏决定';
    body.appendChild(head);
    // 产品设计区
    const dh=document.createElement('div');
    dh.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:8px 0 4px';
    dh.textContent='🎨 产品设计(扣成本 → 8s 组装小游戏)';
    body.appendChild(dh);
    defs.forEach(d=>{
      const row=document.createElement('div');
      row.className='heroRow';
      row.style.cssText='font-size:11px;padding:6px 8px;margin:4px 0;background:rgba(0,0,0,.08);border-left:3px solid #40a058';
      row.innerHTML='<div class="hName">'+d.emoji+' '+d.name+' <span class="m">成本 ¥'+d.cost.toLocaleString()+'</span></div>'
        +'<div class="hDesc">'+d.hint+' · 基础日销 ~'+Math.round(d.base/5000*200)+' 件</div>'
        +'<div style="display:flex;gap:4px;margin-top:3px">'
        +'<button class="designBtn" style="font-size:10px;padding:2px 8px;background:#40a058;color:#fff;border:none;border-radius:3px;cursor:pointer">设计 ¥'+d.cost.toLocaleString()+'</button>'
        +'</div>';
      row.querySelector('.designBtn').onclick=()=>{
        const r=window.startProductDesign(d.key);
        if(r==='money'){ setTip('资金不足, 需 ¥'+d.cost.toLocaleString()); return; }
        // 启动设计小游戏(不扣体力, 无工资结算, 直接回调)
        window.openProductMinigame(d.key, (success)=>{
          window.productDesignDone(d.key, success);
          save(); renderAll();
        });
      };
      body.appendChild(row);
    });
    // 已上市产品
    if(products.length){
      const ph=document.createElement('div');
      ph.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:10px 0 4px';
      ph.textContent='📦 已上市产品('+products.length+' 款)';
      body.appendChild(ph);
      products.forEach(p=>{
        const def=defs.find(x=>x.key===p.key);
        const row=document.createElement('div');
        row.className='heroRow';
        row.style.cssText='font-size:11px;padding:5px 8px;margin:3px 0;background:rgba(0,0,0,.08);border-left:3px solid '+(p.quality>0.4?'#40a058':'#e07080');
        row.innerHTML='<div class="hName">'+(def?def.emoji+' '+def.name:p.key)+' <span class="m">质量 '+(p.quality*100).toFixed(0)+'%</span></div>'
          +'<div class="hDesc">第 '+(p.launchedDay)+' 天上市 · 昨日销 '+(p.dailySold||0)+' 件 · 收益 ¥'+((p.lastEarned||0).toLocaleString())+' · 累计 ¥'+((p.totalEarned||0).toLocaleString())+'</div>';
        body.appendChild(row);
      });
    }
  }

  function renderStudioTab(body){
    window.initDevStudio&&window.initDevStudio();
    const s=window.state.devStudio;
    const defs=window.DEV_STUDIO;
    const money=window.state.money;
    // 未开: 显示开工作室按钮
    if(!s.opened){
      const head=document.createElement('div');
      head.style.cssText='font-size:11px;color:#fff8ec;margin-bottom:6px';
      head.textContent='🎮 游戏开发工作室(开罗《游戏发展国》风): 立项 → 开发进度 → 发售 → 销量回款';
      body.appendChild(head);
      const row=document.createElement('div');
      row.className='heroRow';
      row.style.cssText='font-size:11px;padding:8px;margin:4px 0;background:rgba(0,0,0,.08);border-left:3px solid #40a058';
      row.innerHTML='<div class="hName">🏢 开工作室 <span class="m">¥'+defs.openCost.toLocaleString()+'</span></div>'
        +'<div class="hDesc">开工作室后, 团队 4 名员工(策划/程序/美术/音效)就位 · 日工资 ¥'+defs.dailySalary.toLocaleString()+' · 可立项开发游戏(休闲/动作/RPG/模拟/手游)</div>'
        +'<div style="display:flex;gap:4px;margin-top:4px"><button id="openStudioBtn" style="font-size:11px;padding:3px 10px;background:#40a058;color:#fff;border:none;border-radius:3px;cursor:pointer">开工作室</button></div>';
      body.appendChild(row);
      row.querySelector('#openStudioBtn').onclick=()=>{
        const r=window.openDevStudio();
        if(r==='money'){ setTip('资金不足, 需 ¥'+defs.openCost.toLocaleString()); return; }
        save(); setTip('🎮 游戏工作室已开张'); renderAll();
      };
      return;
    }
    // 已开: 展示团队 + 开发项目 + 已发售游戏
    const th=document.createElement('div');
    th.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:8px 0 4px';
    th.textContent='👥 团队 (技能 → 升级可提升后续项目口碑)';
    body.appendChild(th);
    s.team.forEach(m=>{
      const def=defs.team.find(t=>t.key===m.key);
      const row=document.createElement('div');
      row.className='heroRow';
      row.style.cssText='font-size:11px;padding:5px 8px;margin:3px 0;background:rgba(0,0,0,.08);border-left:3px solid #b8a888;display:flex;justify-content:space-between';
      row.innerHTML='<div class="hName">'+def.name+' <span class="m">Lv'+m.skill+'/'+m.maxSkill+'</span></div>'
        +'<div>'+(m.skill<m.maxSkill?'<button class="upBtn" data-k="'+m.key+'" style="font-size:10px;padding:2px 6px;background:#40a058;color:#fff;border:none;border-radius:2px;cursor:pointer">升级 ¥'+(2000*m.skill).toLocaleString()+'</button>':'<span style="font-size:10px;opacity:.6">已满级</span>')+'</div>';
      const up=row.querySelector('.upBtn');
      if(up) up.onclick=()=>{
        const r=window.upgradeDevTeam(m.key,1);
        if(r==='money'){ setTip('资金不足, 需 ¥'+(2000*m.skill).toLocaleString()); return; }
        save(); setTip(def.name+' 已升级'); renderAll();
      };
      body.appendChild(row);
    });
    // 开发中项目
    if(s.activeProject){
      const p=s.activeProject;
      const typeDef=defs.gameTypes.find(t=>t.key===p.type);
      const audDef=defs.audiences.find(a=>a.key===p.audience);
      const pct=Math.round(p.progress/p.totalDays*100);
      const dh=document.createElement('div');
      dh.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:10px 0 4px';
      dh.textContent='📋 开发中: 《'+(typeDef?typeDef.name:p.type)+'》('+(audDef?audDef.name:p.audience)+')';
      body.appendChild(dh);
      const pr=document.createElement('div');
      pr.className='heroRow';
      pr.style.cssText='font-size:11px;padding:6px 8px;margin:3px 0;background:rgba(0,0,0,.08);border-left:3px solid #40a058';
      pr.innerHTML='<div class="hName">进度 '+pct+'% <span class="m">口碑 '+p.quality+'/100</span></div>'
        +'<div class="hDesc">方向: 创意'+p.dir.creative+'/画面'+p.dir.graphics+'/音乐'+p.dir.music+'/剧情'+p.dir.story+' · 预计 '+p.totalDays+' 天发售</div>'
        +'<div style="height:6px;background:rgba(255,255,255,.15);border-radius:3px;margin-top:4px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:#40a058;border-radius:3px"></div></div>';
      body.appendChild(pr);
      // 当前员工事件(若有)
      if(p.currentEvent){
        const ev=(window.STAFF_EVENTS||[]).find(e=>e.key===p.currentEvent);
        if(ev){
          const er=document.createElement('div');
          er.className='heroRow';
          er.style.cssText='font-size:11px;padding:6px 8px;margin:3px 0;background:rgba(200,60,60,.18);border-left:3px solid #e07080';
          er.innerHTML='<div class="hName">⚠️ '+ev.name+' <span class="m">¥'+ev.cost.toLocaleString()+'</span></div>'
            +'<div class="hDesc">'+ev.desc+'</div>'
            +'<div style="display:flex;gap:4px;margin-top:4px">'
            +'<button id="evPay" style="font-size:10px;padding:2px 8px;background:#40a058;color:#fff;border:none;border-radius:2px;cursor:pointer">付钱摆平</button>'
            +'<button id="evIgnore" style="font-size:10px;padding:2px 8px;background:#8a5a30;color:#fff8ec;border:none;border-radius:2px;cursor:pointer">不付钱</button>'
            +'</div>';
          er.querySelector('#evPay').onclick=()=>{
            const r=window.resolveStaffEvent(true);
            if(r==='money'){ setTip('资金不足'); return; }
            save(); setTip('✅ 事件已解决'); renderAll();
          };
          er.querySelector('#evIgnore').onclick=()=>{
            const r=window.resolveStaffEvent(false);
            save(); setTip('😩 没付钱, 工期延后'); renderAll();
          };
          body.appendChild(er);
        }
      }
    } else {
      // 可立项: 选类型 + 目标 + 方向点数分配
      const sh=document.createElement('div');
      sh.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:10px 0 4px';
      sh.textContent='➕ 立项(团队空闲, 可开新项目 · 方向点数 '+defs.DIR_POINTS+' 点)';
      body.appendChild(sh);
      defs.gameTypes.forEach(t=>{
        defs.audiences.forEach(a=>{
          const row=document.createElement('div');
          row.className='heroRow';
          row.style.cssText='font-size:11px;padding:5px 8px;margin:3px 0;background:rgba(0,0,0,.08);border-left:3px solid '+(t.risk>0.2?'#e07080':(t.risk>0.1?'#b8a888':'#40a058'));
          row.innerHTML='<div class="hName">'+t.emoji+' '+t.name+' → '+a.name+' <span class="m">基础销 '+t.baseSales+' · 风险 '+(t.risk*100).toFixed(0)+'%</span></div>'
            +'<div class="hDesc">'+t.hint+' · '+a.hint+'</div>'
            +'<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">'
            +['0','1','2','3','4'].map(n=>'<button class="dirBtn" data-t="'+t.key+'" data-a="'+a.key+'" data-n="'+n+'" style="font-size:10px;padding:2px 6px;background:rgba(255,255,255,.15);color:#fff8ec;border:none;border-radius:2px;cursor:pointer">投 '+n+' 点</button>').join('')
            +'</div>';
          row.querySelectorAll('.dirBtn').forEach(b=>{
            b.onclick=()=>{
              const n=parseInt(b.dataset.n);
              // 简单分配: 全部投创意(实际可多选, 这里只投 1 项)
              const alloc={creative:0,graphics:0,music:0,story:0};
              alloc.creative=n;
              const r=window.startDevProject(b.dataset.t, b.dataset.a, alloc);
              if(r==='busy'){ setTip('团队正忙, 请等当前项目发售'); return; }
              if(r==='money'){ setTip('资金不足'); return; }
              save(); setTip('📋 《'+t.name+'》已立项'); renderAll();
            };
          });
          body.appendChild(row);
        });
      });
    }
    // 已发售游戏
    if(s.released.length){
      const rh=document.createElement('div');
      rh.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:10px 0 4px';
      rh.textContent='🏆 已发售游戏 ('+s.released.length+' 款 · 市场占有 '+(s.marketShare*100).toFixed(0)+'% · 口碑 '+s.reputation+' · 累计收益 ¥'+s.totalEarned.toLocaleString()+')';
      body.appendChild(rh);
      s.released.slice().reverse().forEach(g=>{
        const tDef=defs.gameTypes.find(t=>t.key===g.type);
        const row=document.createElement('div');
        row.className='heroRow';
        row.style.cssText='font-size:11px;padding:5px 8px;margin:3px 0;background:rgba(0,0,0,.08);border-left:3px solid '+(g.quality>=80?'#e07080':'#40a058');
        const dlcCount=g.dlcCount||0;
        const dlcCost=window.DLC_COST_BASE*(1+dlcCount);
        const dlcDisabled=dlcCount>=2;
        row.innerHTML='<div class="hName">'+(tDef?tDef.emoji+' '+tDef.name:g.type)+' <span class="m">'+'⭐'.repeat(g.stars||3)+' <span style="opacity:.6">'+(g.stars||3)+'</span> · 口碑 '+g.quality+'/100 · 占有 '+(g.marketShare*100).toFixed(0)+'%</span></div>'
          +'<div class="hDesc">第 '+g.releasedDay+' 天发售 · 累计销 '+g.totalSold+' 份 · 累计收益 ¥'+g.totalEarned.toLocaleString()+' · DLC '+dlcCount+'/2</div>'
          +(dlcDisabled?'<div style="font-size:10px;opacity:.5;margin-top:3px">DLC 次数已用完</div>':'<div style="margin-top:4px"><button class="dlcBtn" data-g="'+g.key+'" style="font-size:10px;padding:2px 8px;background:#8a5a30;color:#fff8ec;border:none;border-radius:2px;cursor:pointer">📦 做 DLC ¥'+dlcCost.toLocaleString()+'</button></div>');
        body.appendChild(row);
        const db=row.querySelector('.dlcBtn');
        if(db) db.onclick=()=>{
          const r=window.makeDLC(db.dataset.g);
          if(r==='money'){ setTip('资金不足, 需 ¥'+dlcCost.toLocaleString()); return; }
          if(r==='max'){ setTip('该款 DLC 次数已用完'); return; }
          save(); setTip('📦 DLC 已上线, 销量复活'); renderAll();
        };
      });
    }
  }

  function renderAssetsTab(body){
    const st=window.state.protagonist;
    const owned=Object.keys(st.assets).filter(k=>st.assets[k]);
    // 资产区
    if(!owned.length){
      const none=document.createElement('div');
      none.style.cssText='font-size:11px;color:#fff8ec';
      none.textContent='暂无实物资产。去「消费」标签买载具/衣服/房子/服务。';
      body.appendChild(none);
    }
    owned.forEach(k=>{
      const c=window.CONSUMABLES.find(x=>x.key===k); if(!c) return;
      const row=document.createElement('div');
      row.className='heroRow';
      row.innerHTML='<div class="hName">'+c.name+'</div><div class="hDesc">'+c.desc+'</div>';
      body.appendChild(row);
    });
    // 小游戏通关记录
    if(st.minigames && Object.keys(st.minigames).some(k=>st.minigames[k]>0)){
      const head=document.createElement('div');
      head.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:10px 0 4px';
      head.textContent='🎮 小游戏通关记录';
      body.appendChild(head);
      Object.keys(st.minigames).forEach(k=>{
        const n=st.minigames[k]; if(!n) return;
        const j=window.WORK_JOBS.find(x=>x.key===k);
        const row=document.createElement('div');
        row.className='heroRow';
        row.innerHTML='<div class="hName">'+(j?j.emoji+' '+j.name:k)+' <span class="m">✅ 通关 '+n+' 次</span></div>';
        body.appendChild(row);
      });
    }
    // 股市持仓(设计文档要求: 资产 Tab 展示股市持仓)
    const holdings=window.state.stockHoldings||{};
    const held=Object.keys(holdings).filter(k=>holdings[k]>0);
    if(held.length){
      const head=document.createElement('div');
      head.style.cssText='font-size:12px;font-weight:900;color:#fff8ec;margin:10px 0 4px';
      const fmtV=n=>'¥'+Math.round(n).toLocaleString('zh-CN');
      head.textContent='📈 股市持仓 · 总市值 '+fmtV(window.stockValue());
      body.appendChild(head);
      held.forEach(k=>{
        const price=(window.state.stocks&&window.state.stocks[k])||0;
        const def=(window.STOCK_DEFS||[]).find(s=>s.key===k);
        const row=document.createElement('div');
        row.className='heroRow';
        row.innerHTML='<div class="hName">'+(def?def.emoji+' '+def.name:k)+' <span class="m">'+holdings[k]+' 股 · ¥'+price.toFixed(2)+'</span></div>'
          +'<div class="hDesc">市值 ¥'+Math.round(price*holdings[k])+' · 在「金融」面板买卖</div>';
        body.appendChild(row);
      });
    }
  }
}());
