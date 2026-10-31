// Mall Tycoon — 核心逻辑(与 Unity 版同构)
// 单文件 H5,零依赖。
"use strict";

// ---- 业态定义:15 种, 开罗风 — 成本/维护/单客价 适中, 需策略投资而非躺赢 ----
const SHOPS = {
  Cafe:        { name:"咖啡厅",   emoji:"☕", build:1200,  upBase:750,  perCustomer:9,   upkeep:40,   maxLevel:5, attract:4,  color:"#8b5a2b", tag:"轻餐饮", artKey:"cafe" },
  Supermarket: { name:"超市",     emoji:"🛒", build:2500,  upBase:1500, perCustomer:14,  upkeep:100,  maxLevel:5, attract:6,  color:"#2e7d32", tag:"零售", artKey:"supermarket" },
  Gaming:      { name:"游戏厅",   emoji:"🎮", build:4000,  upBase:2800, perCustomer:22,  upkeep:220,  maxLevel:5, attract:9,  color:"#1565c0", tag:"娱乐", artKey:"arcade" },
  Cinema:      { name:"电影院",   emoji:"🎬", build:7500,  upBase:4000, perCustomer:35,  upkeep:420,  maxLevel:5, attract:14, color:"#6a1b9a", tag:"娱乐", artKey:"cinema" },
  Food:        { name:"美食广场", emoji:"🍜", build:12000, upBase:6000, perCustomer:48,  upkeep:750,  maxLevel:5, attract:18, color:"#e65100", tag:"餐饮", artKey:"food" },
  Bookstore:   { name:"书店",     emoji:"📚", build:18000, upBase:7500, perCustomer:25,  upkeep:320,  maxLevel:5, attract:22, color:"#5d4037", tag:"文教", artKey:"bookstore" },
  Gym:         { name:"健身房",   emoji:"🏋️", build:22000, upBase:8000, perCustomer:50,  upkeep:850,  maxLevel:5, attract:26, color:"#00695c", tag:"运动", artKey:"gym" },
  Fashion:     { name:"快时尚",   emoji:"👗", build:30000, upBase:11000, perCustomer:75,  upkeep:1300, maxLevel:5, attract:30, color:"#ad1457", tag:"零售", artKey:"fashion" },
  Hotel:       { name:"精品酒店", emoji:"🏨", build:20000, upBase:9000, perCustomer:55,  upkeep:1100, maxLevel:5, attract:20, color:"#00838f", tag:"住宿", artKey:"hotel" },
  // 新增 6 种(开罗风: 成本/维护/单客价 适中, 需策略投资)
  Bakery:      { name:"烘焙坊",   emoji:"🥐", build:6500,  upBase:3200, perCustomer:10,  upkeep:120,  maxLevel:5, attract:12, color:"#c78d4a", tag:"轻餐饮", artKey:"bakery" },
  Pet:         { name:"宠物诊所", emoji:"🐾", build:14000, upBase:5500, perCustomer:60,  upkeep:600,  maxLevel:5, attract:24, color:"#6d8e3a", tag:"服务", artKey:"pet" },
  Pharmacy:    { name:"药妆店",   emoji:"💊", build:18000, upBase:6500, perCustomer:75,  upkeep:800,  maxLevel:5, attract:28, color:"#3a7d8c", tag:"服务", artKey:"pharmacy" },
  Bank:        { name:"银行",     emoji:"🏦", build:35000, upBase:13000, perCustomer:120, upkeep:1800, maxLevel:5, attract:35, color:"#1f3a6d", tag:"金融", artKey:"bank" },
  IT:          { name:"数码体验", emoji:"💻", build:45000, upBase:15000, perCustomer:140, upkeep:2300, maxLevel:5, attract:40, color:"#2a3f8c", tag:"科技", artKey:"tech" },
  Art:         { name:"艺术画廊", emoji:"🎨", build:55000, upBase:18000, perCustomer:160, upkeep:2800, maxLevel:5, attract:45, color:"#7a3f8c", tag:"文化", artKey:"gallery" },
};
// 地图背景 artKey(生图素材)
const MAP_ARTKEY = ["street","plaza","campus"];
if(typeof window!=='undefined') window.MAP_ARTKEY=MAP_ARTKEY;
// 建造顺序:买不起贵的就建最便宜的(同价位里按上表顺序)
const SHOP_ORDER = Object.keys(SHOPS);
const CROWD_CAP_PHASE0 = 8; // 顾客池(顾客小图标同场上限):一街 8 / 二街后 16
const CUS_EMOJI = ["🧑","👩","🧔","👧","🕴","🧕","👴","👵","🧑‍🦱","👱‍♀️"];

const GRID_W = 4, GRID_H = 3; // 主街道(第一张地图)
// ---- 多地图扩展: 玩家升到一街/二街后开放新地图(新街区), 每张地图 = 独立 GRID_W×GRID_H 网格 ----
// 旧档兼容: state.map = 0 表示始终在主街道; 地图解锁后玩家可在 UI 切换
const MAPS = [
  { id:0, name:"主街道",   emoji:"🏙", desc:"起点街区, 12 个铺位" },
  { id:1, name:"商业街",   emoji:"🌆", desc:"解锁一街后开放, 8 个铺位" },
  { id:2, name:"大学城",   emoji:"🏫", desc:"解锁二街后开放, 6 个铺位" },
];
// 每地图铺位数量(主街道=12, 商业街=8, 大学城=6), 总铺位 26
const MAP_SLOTS = [12, 8, 6];
// 各地图需要的 unlockPhase(0=初始可用, 1=需一街, 2=需二街)
const MAP_UNLOCK_PHASE = [0, 1, 2];
// 地图客流修正: 商业街 1.1, 大学城 1.2(吸引不同客群, 鼓励多地图扩张)
const MAP_CROWD_MULT = [1.0, 1.1, 1.2];
// 总铺位数(所有地图合计)
const TOTAL_SLOTS = MAP_SLOTS.reduce((a,b)=>a+b,0); // 26
// 取某地图的铺位索引区间 [start, end)
function mapSlotRange(mapId){
  let start=0;
  for(let m=0;m<mapId;m++) start+=MAP_SLOTS[m];
  return [start, start+MAP_SLOTS[mapId]];
}
// 全局铺位索引 → 所在地图 id
function slotMapOf(globalIdx){
  let acc=0;
  for(let m=0;m<MAPS.length;m++){
    acc+=MAP_SLOTS[m];
    if(globalIdx<acc) return m;
  }
  return MAPS.length-1;
}
// ---- 多阶段扩建: 开罗风 — 投资回报 > 成本, 但越开越贵(经营压力递增) ----
const UNLOCK_PHASES = [
  { label:"一街", cols:3, crowd:8,  cost:30000, desc:"开放第 3 列 + 全体客流 +15% + 解锁商业街地图" },
  { label:"二街", cols:4, crowd:12, cost:90000, desc:"开放第 4 列 + 全体客流再 +15% + 解锁大学城地图" },
  { label:"三街", cols:5, crowd:16, cost:200000, desc:"开放第 5 列 + 客流 +30%(合计)" },
  { label:"四街", cols:6, crowd:20, cost:400000, desc:"开放第 6 列 + 客流 +50%(合计,封顶)" },
];
// 扩建客流加成:初始 1.0 / 一街 1.15 / 二街 1.3 / 三街 1.45 / 四街 1.6(软加成,不压垮经济)
function crowdBoost(){
  return [1.0, 1.15, 1.3, 1.45, 1.6][Math.min(4, state.unlockPhase)];
}
// 当前所在地图 id(0=主街道, 1=商业街, 2=大学城), 旧档未存时默认 0
function curMap(){ return state.map !== undefined ? state.map : 0; }
// 该地图是否已解锁
function mapUnlocked(mapId){ return state.unlockPhase >= MAP_UNLOCK_PHASE[mapId]; }
// 切换当前地图(仅能切到已解锁的)
function setMap(mapId){
  if(!mapUnlocked(mapId)) return false;
  state.map=mapId;
  return true;
}
const DAY_LEN_SEC = 30;
const GOAL_MONEY = 200000;     // 达成即"扩张成功"(开罗风: 目标适中, 需扩张+投资组合拳)
const BANKRUPT_LOSS = 2;      // 连续 2 天负结余 → 破产(经营压力)
// 现金透支判定阈值: 资金低于 -3000 才判破产(破产窗口更紧)
const BANKRUPT_DEBTH = -3000;
const TAX_STEP_DAYS = 3;       // 每 3 天税率上调一次(经营压力递增)
const TAX_STEP = 0.04;         // 每次上调 4 个百分点
const TAX_CAP = 0.35;          // 税率封顶 35%(中长期税收压力)
// ---- 全局难度系数: 开罗风投资正循环 + 适度经营压力, 需策略组合而非躺赢 ----
// 开罗风: 投资有回报(不惩罚), 但成本/税收/竞争需管理, 后期需要连锁总部+投资品种协同
const FLOW_SCALE = 1.0;       // 客流量总乘子(开罗风: 合理客流, 不轻松也不压抑)
const COST_SCALE = 1.1;       // 维护费总乘子(开罗风: 运营成本略升, 投资需考虑ROI)
const PROCUREMENT_SCALE = 0.2; // 进货成本占比(开罗风: 毛利适中)
const WAGE_SCALE = 1.05;      // 工资总乘子(开罗风: 员工成本合理)
const REVENUE_SCALE = 1.0;    // 单客收入乘子(开罗风: 投资回报 = 1:1, 需策略提升)
function taxRate(){
  // 第 1-5 天 5%, 第 6-10 天 10%, 第 11-15 天 15% ... 封顶 40%
  let r = Math.min(TAX_CAP, 0.05 + Math.floor((Math.max(1,state.day)-1)/TAX_STEP_DAYS)*TAX_STEP);
  if(taxBreakActive()) r *= 0.5;  // 税收减免日:税率减半
  return r;
}

// 顾客偏好:客流权重按业态标签加权(权重可被事件/升级影响)
const CROWD_PREF = {
  default:{ 餐饮:1, 零售:1, 娱乐:1, 文教:1, 运动:1, 住宿:1 },
};

// ---- 业态组合协同(黄金搭配):同时开特定业态,相关铺位客流整体加成 ----
// 每组:需同时拥有(各至少 1 家建好)才激活;mult 作用于该组内每家铺位的小时客流
const SYNERGIES = [
  { id:"sy_onestop", name:"一站式服务", tags:[], shops:["Food","Cinema","Hotel"], mult:1.3,
    desc:"美食广场+电影院+酒店:逛吃玩住一条龙,这 3 类铺位客流 ×1.3" },
  { id:"sy_family",  name:"周末亲子",  shops:["Gaming","Cinema","Food"], mult:1.25,
    desc:"游戏厅+电影院+美食广场:亲子客群聚集,这 3 类铺位客流 ×1.25" },
  { id:"sy_work",    name:"下班客流",  shops:["Cafe","Gym","Bookstore"], mult:1.2,
    desc:"咖啡+健身+书店:下班顺路消费,这 3 类铺位客流 ×1.2" },
  { id:"sy_shop",    name:"购物天堂",  shops:["Supermarket","Fashion","Bookstore"], mult:1.2,
    desc:"超市+快时尚+书店:一站式购物,这 3 类铺位客流 ×1.2" },
  // 新增 4 组(围绕新业态)
  { id:"sy_health",  name:"健康生态",  shops:["Gym","Pharmacy","Pet"], mult:1.35,
    desc:"健身+药妆+宠物诊所:健康生活方式,这 3 类铺位客流 ×1.35" },
  { id:"sy_fin",     name:"商务高地",  shops:["Bank","IT","Cafe"], mult:1.4,
    desc:"银行+数码体验+咖啡:商务客群聚集,这 3 类铺位客流 ×1.4" },
  { id:"sy_lux",     name:"高端生活",  shops:["Fashion","Art","Hotel"], mult:1.4,
    desc:"快时尚+艺术画廊+精品酒店:高端消费圈,这 3 类铺位客流 ×1.4" },
  { id:"sy_kids",    name:"亲子烘焙",  shops:["Bakery","Gaming","Cinema"], mult:1.3,
    desc:"烘焙坊+游戏厅+电影院:亲子休闲,这 3 类铺位客流 ×1.3" },
];
// 当前激活的协同组(每组所有 shop 都建过才算)
function activeSynergies(){
  const built=new Set();
  for(const sl of state.slots) if(sl.built) built.add(sl.type);
  return SYNERGIES.filter(g=>g.shops.every(k=>built.has(k)));
}
// 某铺位适用的协同倍率(多组命中取最高,保持克制)
function synergyMult(type){
  let m=1;
  for(const g of activeSynergies()){
    if(g.shops.includes(type)) m=Math.max(m,g.mult);
  }
  return m;
}
// ---- 连锁经营:同一业态开 N 家,第 3 家起该业态铺位客流 +20%(鼓励专精) ----
function chainBonus(type){
  const n=state.slots.filter(s=>s.built&&s.type===type).length;
  return n>=3 ? 1.2 : 1;
}

// ---- 招聘系统:4 档薪水,不同薪水带来不同客流效果 + 士气 + 流失风险 ----
// payGrade: 0=节俭 / 1=正常 / 2=优厚 / 3=顶配
const PAY_GRADES = [
  { id:0, name:"节俭", wageMult:0.85, morale:0.85, churn:0.25, desc:"员工不满,偶尔怠工,客流 -15% · 士气 85% · 流失 25%" },
  { id:1, name:"正常", wageMult:1.00, morale:1.00, churn:0.10, desc:"按行业惯例发薪,客流不加成 · 士气 100% · 流失 10%" },
  { id:2, name:"优厚", wageMult:1.20, morale:1.20, churn:0.04, desc:"高于市场价,服务更好,客流 +20% · 士气 120% · 流失 4%" },
  { id:3, name:"顶配", wageMult:1.45, morale:1.45, churn:0.01, desc:"顶格薪资留人,客流 +45% · 士气 145% · 流失 1%" },
];
function payGrade(){
  const g=PAY_GRADES[Math.max(0,Math.min(3, state.payGrade|0))];
  return g || PAY_GRADES[1];
}
function wageMult(){ return payGrade().wageMult; }
function moraleMult(){ return payGrade().morale; }
function churnRisk(){ return payGrade().churn; }
function setPayGrade(id){
  const n=Number(id);
  if(!PAY_GRADES.some(g=>g.id===n)) return false;
  state.payGrade=n;
  return true;
}
// 某铺位员工日薪(= 该业态维护费 × 工资档位 × 通胀 × 运营成本系数, 运营成本更高)
function dailyWage(sl){
  if(!sl || !sl.built) return 0;
  return Math.round(SHOPS[sl.type].upkeep * wageMult() * state.inflation * WAGE_SCALE);
}

// ---- 事件系统(每天 pre-roll 一个,good/bad/mixed 三档,共 15 种)----
const EVENTS = [
  { key:"promo",    good:true,  w:0.15, msg:"🎉 周末促销,客流 ×1.5",         wobble:1.5, pref:{ 零售:1.6, 餐饮:1.3 } },
  { key:"insp",     good:false, w:0.12, msg:"🔧 商场检修,客流 ×0.5",         wobble:0.5, pref:null },
  { key:"foodfest", good:true,  w:0.08, msg:"🍜 美食节,餐饮客流 ×2",        wobble:1.2, pref:{ 餐饮:2.0 } },
  { key:"fashionwk",good:true,  w:0.08, msg:"👗 时尚周,零售客流 ×1.8",       wobble:1.2, pref:{ 零售:1.8 } },
  { key:"holiday",  good:true,  w:0.06, msg:"🎄 节假日,全场客流 ×2",         wobble:2.0, pref:null },
  { key:"rainy",    good:false, w:0.10, msg:"🌧️ 暴雨天气,客流 ×0.4",        wobble:0.4, pref:null },
  { key:"powercut", good:false, w:0.05, msg:"⚡ 电力故障,客流 ×0.3",        wobble:0.3, pref:null },
  { key:"normal",   good:null,  w:0.20, msg:"☀️ 平日无事件",                wobble:1.0, pref:null },
  // 新增 7 种(围绕新业态 + 投资)
  { key:"healthwk", good:true,  w:0.06, msg:"🏥 健康周,服务客流 ×1.8",      wobble:1.2, pref:{ 服务:1.8 } },
  { key:"bizsummit",good:true, w:0.05, msg:"🏢 商务峰会,金融/科技 ×1.8",   wobble:1.2, pref:{ 金融:1.8, 科技:1.8, 轻餐饮:1.3 } },
  { key:"artweek",  good:true,  w:0.05, msg:"🎨 艺术周,文化/住宿 ×1.8",    wobble:1.2, pref:{ 文化:1.8, 住宿:1.3 } },
  { key:"bakeryfest",good:true, w:0.04, msg:"🥐 烘焙节,轻餐饮 ×2",         wobble:1.2, pref:{ 轻餐饮:2.0 } },
  { key:"virus",    good:false, w:0.05, msg:"🦠 流感季,餐饮/娱乐 ×0.6,服务 ×1.5", wobble:0.9, pref:{ 餐饮:0.6, 娱乐:0.6, 轻餐饮:0.6, 运动:0.6, 服务:1.5 } },
  { key:"taxbreak", good:true,  w:0.03, msg:"💰 税收减免:本日税率减半",      wobble:1.1, pref:null },
  { key:"grandopen",good:true,  w:0.02, msg:"🎊 商场庆典,全场客流 ×1.6",    wobble:1.6, pref:null },
  // 宏观经济事件: 通胀/通缩/地价/补贴
  { key:"inflation",good:false, w:0.05, msg:"📈 物价飞涨,通胀加剧,维护成本 +2%", wobble:0.9, pref:null },
  { key:"deflation",good:true,  w:0.03, msg:"📉 通缩行情,物价回落,成本下降",     wobble:1.1, pref:null },
  { key:"landdrop", good:true,  w:0.05, msg:"🏚️ 周围空地降价! 扩建成本 ×0.55",  wobble:1.0, pref:null },
  { key:"landboom", good:false, w:0.03, msg:"🏙️ 地价暴涨! 扩建成本 ×1.5",      wobble:1.0, pref:null },
  { key:"subsidy",  good:true,  w:0.04, msg:"🎁 政府补贴到账 +¥30,000",         wobble:1.2, pref:null },
];

// ---- 季节系统: 每 30 天 1 季(春→夏→秋→冬循环), 修正各市场类别客流 ----
function seasonOf(day){ return ((day||state.day-1)/30)%4|0; } // 0春 1夏 2秋 3冬
function seasonMult(cat){
  const s=seasonOf();
  // 夏: food/fun 高; 冬: coffee/retail 高; 春: tech 高; 秋: 全客流 +
  const T={0:{tech:1.05},1:{food:1.15,fun:1.15},2:{coffee:1.1,retail:1.1},3:{coffee:1.15,retail:1.1}};
  const extra={1:1.0,2:1.05,3:1.05}[s]||1;
  const base=extra;
  const catM=T[s]&&T[s][cat];
  return catM?catM:base;
}

// ---- 投资系统(开罗风): 增长基金 — 首投门槛适中, 每级回报 +12%, 成本递增需策略 ----
// 开罗风: 投资有正回报, 但中后期成本递增, 需与经营/税收/贷款平衡
const INVEST = {
  baseCost: 20000,      // 第 1 级成本(开罗风: 首投门槛适中)
  costMult: 1.5,        // 每级成本 ×1.5(温和递增, 投资需 ROI 考量)
  crowdMult: 0.12,      // 每级客流 +12%(回报合理, 不躺赢)
  maxLevel: 5,
};
// 当前投资等级(0..5)
function investCost(level){ // level = 下一级索引(0..4)
  if(level >= INVEST.maxLevel) return Infinity; // 已满级
  return Math.round(INVEST.baseCost * Math.pow(INVEST.costMult, level));
}
function investMult(){ return 1 + (state.investLevel||0) * INVEST.crowdMult; }
function buyInvest(){
  if(state.investLevel >= INVEST.maxLevel) return false;
  const cost = investCost(state.investLevel);
  if(state.money < cost) return false;
  state.money -= cost;
  state.investLevel = (state.investLevel||0) + 1;
  return true;
}
// 投资进度(0..1,用于 UI)
function investProgress(){
  if(!state.investLevel || state.investLevel>=INVEST.maxLevel) return null;
  return { next:investCost(state.investLevel), gained:INVEST.crowdMult*100 };
}

// UI 独立建模: 协同组合徽章 + 成就徽章 (AI 生图, agnes-image-2.5-flash)
const SYN = {
  sy_onestop:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEVfLScCAQGmUCjYZCmONiLln16WbFv625jNqZJvU081Gxyxh3FjVirynDdlExRcISX8ynRaJC2wlIkiFxvMeUcrHB5eVlidSSpthy+KjjM5SyBaC1LLNx6nV1f/AADEZkP278dxcQBVQkapTiVTO0GlOySUMyCxXj4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADExdi4AAAAKHRSTlP9BP3+/f7+/v79/f78/hqp/2b/YP+nBmH+//8M/wYBQv8CpZz/RLI7AYMKDQAAAuVJREFUeNpdlYliozAMRIV8gA8gB7l6bbu9/v8Pd0YOybaTEBz3ZWRLwpVu1ctEdc+f23fn3Odt/rHdpN2ml5c22H6punEzOpFuT618Ayde8zzNX+rcOI4Bl6QdlQ7HH47T0Tv1zjsDx1HTsOqvQbzeum2tRBzBlYux2Jvk0UDEnS9XcDWsuySSin02TzpOUs9VIG8aRwdDfo9RpErpE0O/dZOe60O9nM+XEIIqrWU37CTjM+VcsMxDdxSZVOv54XK5VIVcUBjLEFNKWGFJMaZiYDerPNR6eajC9XmzlJgZOGawGO1mgFszrLVazP71NURViVzhEKUgOMGXo+iSAdUKO6fhNfSvUQWhc2JMXElaaOXOqrTslN6NfYweOSlRwHIFwPXUCSPXVpLgYh9CH4uXbDFryjUj40JQAqry5J4s1yD7UAqyLLsCR9LMegODECQZsEwXg3r5kI8dq8dCSkwGOpJNYDUi6V5hiRVSib5OJwM3G8yo4gobq476hL2YJO6iEuw8SKBNGIYFzkhlMsFSuPx3VsaNgfAqz9Qr24HK4tr3TrwatmnYgkoztl4lHKOpZZ+9+JshJhSPC4nrBjnCHByzIMy1bdvI+ueaCdyVcyeAIL1chWXw16Jh6ANCoVBD9Da1z1jvbUXYmPmGHkLGQr/pAyK7LcHmdJdHPgliyWGDG/L4jjy2HPBXK6xLWCwBy9K2aN2zz3yEDNU1LUb0TUbK6Q2bsYq2vaCwObFPbpxpmbtn2fPZQNcbWqXmyr3+4PphPj43x8ImbCcDu/G340BHJJxgKHg0gp01WG3EbgsVLT9eJ5wUB4QsAx1hCyM4ql/YdqYYe2R85qFy4CkDIwM5kFZhr63ULPaWZw9IhOdT2bImzJS/C7Weu0c7Hw+Zj7lU6/14O6505RB5agfpIee09oX1q95BanXEQbk/HFie9vqtu6PBONnn//66XTUTfLyDdqL/gb5n2Z5O3/fJWfAv5B8bviihUbkK2AAAAABJRU5ErkJggg==",
  sy_family:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXvlSoFAQHVbSFXJxWmVCEtDAWZb1z59OrVtZvur0ljFw+PNyHp0rJSKBv7yFhxRS2xiGpwVkytkoanY08xEg9LIRPSKik4FQxvTiuVRzORQi2KOCj05+dyU1NfkXJmZZGaSzu9jDC/n3//AAA6WbZyRi5OlYOGOi0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXUJ5XAAAAKHRSTlP+Af77/fj+///+DvH/XP79/v3/EWae/5kbVZaxAxD//yf/DAH/V/9OTAaJ+wAAArJJREFUeNpllYl22yAQRREDSIAktHpP0zRd/v8P+2ZA2E3nHGu9erOCVfO/fYa3MOxkt+2x1oeqXoWQT3zYrSUiY8g+voCZymjzI+xGKzZj9qE8rYqPy5ChgeXUYXT+F5S3QxjO7DOJnnt3IkqroEr8Ko5IG8txqXH0TLz/nAW0l1DA0FysySEpP47KC6ccBLUGWBVDGMior6YB6dNJG/oVPovrl9irxchxnkAr2nMyYUjQM+kpapCMiUZkc+ICDsR36QgTp4RI4Nl/+5YrtL+CBkXhSImKDuy3gJqogFY8o0B8cUBskxPvZC8V5ApSeoZZcC3JR8ttVM3Gr0FR0qUsWptI+vgEo4EgV4CU74nqC7J2TqTzNwa+SzL52ySK0aLbrmvbBd0UDjYPw1Vx/3SNS6d5aYvZomkXXBrFjdFHrvyw2OI4QTa3OBwBotNZDcXs2qpXrV1sJHuAYtEWap5n5z4mhPfh3Ay9fSugBI6B7FrnACJtDJvMpfeWot2aDBaLfBXNQm5SXmkM54iYItEgY/b2hnQgaShK/qib817mHEc0zbis2DRnUSqDxaXPcuzXY1TchElTMucDL5nSPoWCA1S8KEY5j95J1o/r3RQxlScNniE2+rx6cGLw+zUWsTxT6ATA0bOUx/QKK2DGjqFK6M7cT0gbUqosR9fPVkVTMH2KMunKziime84vblpnsZa1yivzpPOUQRHmqvEdK2avBUQRjU19376CrYBXiZGRWDK3qYPV6Wj5DuB6v8dMlt0BWU941VdjMHEdG3jXB4YOnfeZyRebHJ1VWG+x9IQzide12azr+ifWd9LrwOkULN6usltuRPO0ZOsmzOOG6QnNH1N83nhrl+0dc+2mYg43eTdbZRTvV94B679A4NVi5TfI5s7Tc4tZLFxe/kOeayY//Qu96iGXaBDFewAAAABJRU5ErkJggg==",
  sy_work:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUCAQEoHCrXaC700almJhimTCtbUlzfm1/aspGiaFLxizSaOCJrEQ/79+4eFB5EOkW2iWtfJByinKH///9kY2FVHRoaEh6YMSCXMB2tSifrw6Pvx6aiTBnts6E7M0GjRi2jVVH/AADzzKZ8RTV4Rjp6eISLUkP/fwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUJdcZAAAAKHRSTlMB+/38+/v+/v36/foR/1/+/p7+AgdkniZYp1iMHA7+ZwoBIa7Z/7QCTmAXeQAAAqZJREFUeNqFlNmy4yAMRIUBIwx2vCWOk9wsc7f//8NpgZ2lalKjh5QJxy21BCZaYqDhj9b0/xg+Dlof6fZfjkQv0ojnZrfbjW/Jj6PWB+Eapcxmo5p3gkgMULiNUqp8R34QBPVxIFJqsylLsOrf4CCKemjKpJfAd3UKeWzOIqhyjEtVr5YPiWzUuSxfwJ16qnYgro/Sbz3uUOBmSZ6sKTH3AEkfpD8ikDL3fV9CqVFYyB8P8IMGGYxkUslOT0DB5Uru2T8/Py3z19e8lCf7Ipr1ll5dI3nWS7RfT+jG3J1BMhL5mp1zzN7hBZNGo5LeowONFHhh560xrTfGe/Zpo6/rei3we3XjtZEQMJi0KIWrezT/DNlv4LsEsnmE5bbmxAFci4VmVrQPsGU4axkc96stOSUCWtZuwQCRb50HKC8rdc7sOad2ul7bU2tAsNR7G4rCCiueG5n7+OiihCu998aGYKsCYZ7m8uOwn2H8ttaBs7bIUVnTZWykk0iuqgwuJM65JFk5u13JH3dPzkgbipA45xbRwkYBIz2RvodeSEKIKqNZU+Donct6qC7k8hKZs4cO1I2m/X621svfMsSHjYWz1qTEJ3ksbOgkMOxQVMWKJg7930Lxd5I1VE50maMJ3j+R4sMzs0GNJ4ppA6XN+4ghth4J7igw7ayY+b3OoggHdiLCoWhb10qdlasqVN6yC7aLsDznFNCgiYyV08tQlX7jGjG3KF/MzIJAUtA9wQ3Gy7gWyGHRXYbn7UhJcJ2rgNRhLAYng9m1TgZqQ1yOxDTFvRgPAm5FMIiUZnA4ayZSvH9SABaXSJdRuGA6K1kRmOaWHlycpmLep8dOwC2h8RiVx9XcvnzwIk1XutLvCR8lk/einEjb4cTeXkn0XeK2rEQcV+a5vL98GSY1x4VrcAAAAABJRU5ErkJggg==",
  sy_shop:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEVfIRSgVCmVMxzspkrRWCxjVCwyHhCjkFpXHhyabVYzHxTx7OfUsZFcJxkuGRPnkjlvXFNkV1ZLSiiQgzzp0LFVIhknIha2nJHLeUZHQCf/xEr///9KOUXAPiEyOE88QU9IO0tIRClm//+EY0mfin//u5kAAACUikIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADE0b1rAAAAKHRSTlP8/v7+/v35/hj9Gf7+o5b//hUZ//5YW/7+pv8CFv3///97Bb4YDwD/9l2pqAAAAqhJREFUeNqF1YmW4iAQBdACUpAiIYtmsZfZZ+L//+G8Ihh1TvcZ1Fbi9aUghKattJGI6u2pvS3e/46lQ+W9JhFJ+uEOFxbhbjs9QrimIaH0EJiGYWr4V3xIrGMyTdNy20qqa808neJLaNuhafglHjBuHePQIEyD0Ix+3BYf0AtDoyePNzh2LA21HuMJsujhpQvBM/t2eIJbNwyrCGVINL//YC/Be0+BB14OuI2JyLe0wy8VLRw4KPQte+7qUuM4JyUKrZWLtRT5eg4BZ1bofbeMgPV7ZoDG2qr6YiVI4uv1nCkgMfPLaSRMoUUIWVdpMxRcKxSu2oJahbhmBWpYdsYZEidml6jgDMc+Fkg7q6wxqAB/8Co0XDVRYdRE8wgJsD/k+QnuTH/RouOm/rX6EFKJw8Bb1zttT4nPNdo8lsm5D+BpozHPToGVO9pxapOHPVL9CTTP8FSg/TyR/wNzpDHX8DGUr9/CAa9MxCUx3qE6rGkZdvdqWFeTrolwT7QFinvlAnusG0yrIc/ncIMVrto+jb0bMuzNzkyWzHWex3xVcqIx2Z1vrO91iZDv3lBjR6qQCmbpuw4DzGSGptefqNNboe5S/p1eazQ9q9W87ExeKYaS3lx/EmnHlFnBzWdpl5W+6ZM8vaWUTFYXwcM50vpIQ01eeJqHKintURftEpm9Qv2oUSWOxf8kArL5m3VdRSX53L1JsHaijuY8ArC2QVtF767SdBqJZJ2agHq2ec41tiIqG1bps9O7WAIYDsy6y8YZsZg6xyukKVLrAZuaFUNZMI8n3VqwK+ocX4SmPRPjsh7FYdeEG28babZxzrGi40MmVk6YMou6Yd625mITphoz5aoUu7wHZva42ZfYGCP2LIwNmzkk+fHf/wp3i3CiVMdtxI43Ht/9Be2aSnz8ag4DAAAAAElFTkSuQmCC",
  sy_health:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXjmWusW1LQZ1lcMDH91ppqTk9lKSlYNDeVSzjtuISIPEU5OTl4OkFZMzZ1Qzr///88JCWCPTb/wXpnQ0ZYIk+SXlq6g2D/AABbPEJdO0F4SDx9QTyESkSZmZkAf38A//9nQEQAAABPKi60ZlbvqnBuNjT4x46UREkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADsNid2AAAAKHRSTlP+/f7w/w8Kmf3//QTxb/IB////axQN+wFelhWRgwUCAYIA/P7++//+/Fy8/AAAAppJREFUeNptldliqyAQhgdGQePSNunengVk4P3f8MwMarU9/wUm5MvsIASWGzyucu60Qb5uhAD14WMVhnDe8NsGgy7c3sZyKSp/a4P7M3kjWpbF/L0dLGI0dhViqxsLqK6wORGLrY/lALauZdACpJQAZEPB4RfGUowtSLEksJZQMaZy0zQ5CTqoRYwX9lzuY5yvDCKnIPaggrA6h2misZiaCccPIJ+ZYpOQs5CLmaY2QIzyO91zlGCR2BJHKphKSSBcwVJI01ninJKtoKaiYGLnTxWkPWtDlE7qa5SrRXVcFTFJgCJdV9AJyMl0a8HLJZKmoWnpmvvdYtz7YqTbEl+HhOZqZBXDMX4HkYgkCzN3ZMBQR0v6Ai+ajHRmlvBn7B7YYTZkeAX+wzmZwl5nqQpFRGhyY9DwCthduY6cjPc0jqN0hWeKywFE5lmzNnXlH/w0bL0e75erVqTJRH1jzWKggboi7tPDIA+gBMjBdQTZ8sgyUleaZdAg3On06LTkDF2Xen58gbnvpddOwaKgZNAjZX4cXUtCpBYnP45cSZlojn09A9y8nLaPxnx+Qj1y1bntOuDxWwx3uKpJ/M02/cMDg8PgV+cVZPV5U+JvNvfcMD3v7ZuiBxAWy6bhG7g530B2DXKoOfOj6xAe3asfL/tMSvxSyUXPGOv5+eMDtitjiiQzKDa5zxc1uNTypFoe1eNQQXZuuTCmrCBHyeUnfHK7ReduFeW44QA27OT9abcYwu/wiuocoz2DhIdrL4Q2PHovCREqWFXBu5cDqO75VJhqcb06/mNRrlkXkS+NL4sC5p8gu29bsSnoJkvze/sDvAt8MzIYjyCe7vCql9ByQheMndnlpxf3A1Sr8aTjZX/Ke2jlIt1eJofXxz9p4HVSFNi+RwAAAABJRU5ErkJggg==",
  sy_fin:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUBAQEjGBphWV6dXyj07uZYMSWqoqXcspakbFDzyKPUkGtyRSjv6uexi2lOSlAeGx5uHA9EPERoZ2iyqa7Hd0vo3M4ZEhLEkDM6OkNiVgekWVSuqaxlMx5hYGfFvMLv4c90RhmtUR2VRTWwqK2UbV64gSlpMyRCPUYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABKA6esAAAAKHRSTlMB/P39/P37/Pz+/foU/lpjCv4KlftXnP7/CgohpKT+mKUSX1Rs/0Z5K8eJRQAAAlZJREFUeNp9lIl6qyAQhYcdFdwa0+xp0u393/CeAavRtPd8kaj8nBkGgeg3NVuR1PT0PzVi0rZpfgFCOPLf1hgzo3+7ws8kdKSfLAOFYcD/ZAU4sU8cDfqKwGKt7YobroOmlkGlluQqrh6CDsnRO298Nc9oOeGgmUSSooqucEXhytI/g4QaXPWRk2yiiwUEvKh+nTYhyXCg1nnBhgJtNJvNtt+vwbr+QNsipAMZuUX8Gx2W2HYsb1umfjT4+fJj5Xaks4U8QOLAuIArTKRdgv2NnHPR3w8Hum9K3CMDH9NC0Jxkj95Sea+Ux9PBp7sIceSVJbGBTyBHZnGeSlVG7dsfuD6fz95bG2UsnNa6SNIaHIPV5CYf5BLKKsuoFH6vr0S3lGG/IMsRtNXnKwuubznRnvpHMI7Bo1GfKuttmtGZiW43WmquOBwTyI4ngPv2sM4yAsPE4YipVKqC420qZfVI+g1X21dKTaGJvu5ESm28xIYaabGTnRFemRSWVZ1ODEG8EliOKgkDfFqmHxkyhk68N41aCCNLVlpKxf2nr3l/mllwnczy1sFXvq+lsBpfmNwJiWsnul0H5RFMSStFg1kDzCvBA+Ryo3YcSGorvvkIkd0M2gVnJCfkNYmavxySM6gXICrlBXqzYy3/ArmmmhOz2XEB2iVIeIGX3TPoZw6F4C7OvKvDIyitNePRyE1azotFklJmR8z6YrPm2o9geit3kj/b/JT3E0ezMpcmheaOi5XvYTy7j8eXJLy2LrlcLgnEw8tLCD9n7eLMeH/HEZ1GsWP26sM/Dr8iUTLa3zEAAAAASUVORK5CYII=",
  sy_lux:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEVUHhHWWySfNxinTyPktJVcFRL24Z/srVL3nDRaKB06Ew1NIRc9FQipck2sUiauVC/81WZ3UUFsWlfUeElVVQBxSTmyZFf/AACmnJzaeST////94sSpTB6mg1nRf2jQi3PsurprRjmhPg2hPBH/1KoAAAD6xErziCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADsWPGVAAAAKHRSTlP3/vv7/hH+/v5X/qYE/1YT//4H/gP7CQEFEQH/pv8HCwVMSrIGAP7/ipjt4wAAAktJREFUeNp9lIt24jAMRG3LthxSmhTKu699JPn/P9yRbCdQyg7nBEhuRrLPWGZ4pI0RhSHkv6bcfppVHoQMNuEb+INWxtLqm2MIzSK1fQqNMVsybRNyEQXxmlmUHVrjaEuu/lUwdA1ed/iQKPu2uEMkXUJzaWOsTRD3Y4zZd7XItKhpBm3HWTtNaUrMMcJmtzO7l91L1q6A0o5VJbBwjO8r79f+EkWXyyVWx6aAkxRPeLgG+O6V8x7fBdS6ajiOI0/ZMTOep2nyBQwzyAKmPjsWMc9gdZzGrGkaCSDueJhGthVsZpAVZAbILBVy8QqasuTqGGNPKyK9p9WjvwUtq1LfpwpuS6MVdCrZRREn6zLo4/9BriD7b6Cle3DtdeHbWzA7Tlel13wPHmV7rorjMUCRdBnXjv3Vhl95AjQoDZF0uSUB9xqKs4RicaSaRlyN44iUtxrcgJiRrMfaBawijoyDc+qCJvyvyZ5a2K7I6vbgZUoSUHL0nI/CR1l6AY0gKptYQKLnLp/Cc9AVKWdrVTkaCIkG2Lr5uALMSaAFTAL2ApIzdYA0hqxTv2MryxawBAqsncG8nQrK2XcApcGsfnHE8Dpq4Ezzpdtl2i9sbPaM7J73V0MKz9FgCEHBZtDNqeDVNAt7DKD2eMAV6zlvuhvHm7EnoF5JRtOnOiL0P4DQawHPwwmO3FuX7kHR6+x4UscH4CGD5tdmM3zA0dLbnmhMjxwx4l+HPRwtiD/EP4G50yd4fyILb1136joJxcNhfxg+kK43+dHhx+/hH9Q3YXvMO9AJAAAAAElFTkSuQmCC",
  sy_kids:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXSZB2pTh3sp1z71ZFhIRHmjjUyCgmSNxVgExCcaE41EA3YdFROGhAuDA2vj2r6yHRsUFXbsYdLHxcwERJxQjD9+upRNEUftJ9pRDR9cGrfOEwXYhcA//97YeOGaaD/AAA2JUAuyKxuS76yi5/HMTz/2rYAAADYaB0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACcmflKAAAAKHRSTlP+/v7++P70/hL+Ef2fmf7///9iYP////8RDP8GAf//Af//////BwD+LYlLgQAAAuJJREFUeNptlYt62yAMhYUQYPDdTq9r113t93/DHQnSNd2U70vi+OdIOsKEjo/RbYNEDdlwVUr39xZdkU6pKCLOQrbf7edP4HGMoNxJRCcF5uAkjnsBegNCbkhGOYc3CiGQJAgP+61iKYNQUC4lBc8zBFuXpHv8AHZP0THSnXqvxkkMcbziU83eaozaAzKeN+CJJEH2o1RQ+1UuuRDoH5DTsB1XcBBn9X0gK4gv7EQei4LdMdovgU6HSlud8KgaAN5FJCXouVYZKlTN6qWCVREdyfZCxy7XdMibAgOyhap41uZJBqQe5dSoCR2x3n0nzqAfZwPZPNR20BAHTXwFia0nBV8GaTOrpamZDcQMmw1N0bxmEwqczPUKXoRDklZjEaWwVrNjxAoCw6zz6tmvkiWK2hNda9iKU5BRBzaaeO+JwE6ydccbwOp2MkkDETJ5z7N3zs88ByiWpqgtqxRzAkwJLIFhf8dO8+/HVVEJs0kUzIAcNJFdQZ9lN8VkmwdVhhT1sck+XCnn72ZKfooKuou8R14ul3jxgdjPQUXxBZoAR0diiyfsJ5nuEIt4VFfBOUDcK1gGLYKNzZDO690SVUpbgaxKYk9GnQyu8z1bVZwhG2PK8EbBQMEqBRgz8/2y3PfeL9lbA2AT5lwL9O6CJ9NAz7J8XTKbxIJb0+IUnSbn8jRhDV3BHorf4KumBvfwfQVIzQenc6ugzzH32S+LZZ6nh4cVFifXAntdxi/wEQk1r9didUNwnriC1ECSUUeok/OrGjRhJOpb/4zuU6qaAdtedlXse/UF7+YlrSs/P/cApWbHhKM+1zieFOpzzrpi/vn6uva/zE9zKSWJnR0A+wDN3uluQKl+/fFVy8i4ThY4f+1IKUenG2boHrfRQZL7um1iF2tspTzZ2dO9QbQeRIOg0Fknzyke+2hRPh/NerZvoj0x9zKUcvM30A7Sev7jWRubyUM5uv+AH6L+e+D4+iR4/AE56Egyii6YsgAAAABJRU5ErkJggg==",};
const ACH = {
  a_first:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWfVB7ioGKVMx9oJhXopTDOXCelaFH71V/8yzrt05Gby+OPs9LGdk3X5eFvFAhxUldSJyWKnK9UJyF9RBt5s9stFBVacaq7hSW5jWF7iaeNeoozAAL1voRVVQB5VkhVVap4zPa/PwCJYj7/AAAAAABuJxi0RSm1ZisAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABdVY/5AAAAKHRSTlP7//74/v7+/v7+/////wjzVv+Y8/8X///9//9m/wOwA/8EuwEA/v7+xTgAwAAAAsNJREFUeNpllIm6oyAMhQ8BUVzaqu10mX1G8P3fcE7A2ts78dMU+clJIBZLsb/L5evRqx2/npan/fDTcik/sb36fvhzM3W2222adPYyHeswHd7BwzKZ2mVr6jqEHDvw18SpD+CByyvnVqkcIpqmyaEbrmDswwu8LCfE1TkLe7UAHCxvzGEIFqdCIsc7RSEI2xDlxaiWq2YfQkxSSBTOyhbRRYvGzowam+sc6igiWR2qG20BqeysaxpVbiyHdZCK14EkGI9YAck0yA8+0Zi1CZJoVP8N5XbwCpbs4HLJdeOaQOkqSTotmCKpJ2htLJk6sqqg0qniNYH1ErNJQcO85qutZybLapiEgiT5RNbNEU3IIAHuJp8ZjInhSEaNuIEUoyZq1szbsvKcY6pUXUGrYIpwu+WCtHzndXsqxuQRaDiJyWLldtIiUFXbCoYlhSxdQOpHTQG2GNRsfkllBs3S5EQXJGO+9ZJEvNcF0XpjDEiWqrOyMVyVQghGM+ICwyMRw3GekSzNuk3wOuTEZ9/3po/VM0f03lMR2tbYPMcp97mnesrSMXKZMf559+83J6NNAvYEOF2bYupvK1YWvW4XDCs7YZmw7lgxsHHZuhCUXeq5Wwt+cqc5t76M4Be14+aEdeOAhbhZJZ+JPgQGMrZddz7KOTsQnBcFV7PGvOtqUZeNbXtuPc7FacQdlMf9kfz94QlWGLuuG7y6ls5gAxnDSteO4tt2B4f2+HT9h4hWAsHb0HrmaOTeDkNHsDjzBra/7mLas4LMcRhaVtEVt4PQHMfxIX4cVbqXMLRKDMW9R8zN5KrKCiPmMwaKExYzv0Cwr7Bqz5v9TKCNijdpq19v0r+FfPKfzO7SKCA/OI34n71teI74Bm6dUtcvEM+ISXPM5G3rTMPRukvrh8ivUlOsLD7ZCom56tP2OUe94/ZzG8XtjZ2Wf66UTEWuXKkDAAAAAElFTkSuQmCC",
  a_ten:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWYaVWiTy2QMiFcMC/UkmJwSDpyUU8CAgLKeFmli2XIWCWTnKb7zHWb0tlpNjRoXFtmJyReNTOQRiuJNSlzV0tgN0J3ahilSzDYk4GeeF2NdIRxRzp8g5GqVhSTtsJQPUNtUkZ4fYycMyeLOyX/AADQgj8AAG02SFsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASqfaOAAAAKHRSTlP9/fb7/vv9AP77/P7//6IbHmqYo2D/D0//u/6l/RT/KY7/HlUB/wcOlo4hNwAAAptJREFUeNqNlel24yAMhSUE8oKXJE6T7ntn3v8N50rgxG3/jHJO1QvXgCW+hJpdg/hskHcfzZMJefj7MuPfj/c/Pok4NYT58/mpOZ2aXejPDTXNXlLSGTn0r5Z3dJybmTDPzOfmfQ6h7+kTvmLcQbOe/LmEFTHP7lzM2NOLwCiyowAtUnwpzbSYse95CcUoZsSSrjkdiuQHe9CX9AynGVU1Fc1cjClR8fVmjBEZEzGKG1e9Gok42oocY2sTHcKMbdGJEGbkSGRGzwRjVI0pBSrjQlEpmpE8OMQBE5FxQCJVCQOMQwy+oFIixsedgxkHuoYZB77IwP7Sl1CrIl78MhD8c6DQWuAwEYfH1mS5xWE7j6rbsDHavD+AuOWNkTAOY85yQ5k5EzOyZr25wZ+tlsc8mREnHYnHTB2NrOOb6uOoPELmkWlEFfKzUIhWc9vSVohY4V7kHitWTRnzOTMF6x63zF9oLFqEuomgFfzFflm49eZhqFaBruVhdEyrJkVT2HqNk5ToNrX+Lkzf2V+pbaw9onIPriF4nTt7GK3xRUKPplKHzbVq63uXxPeFth5aM40RW6AYV612IWG785vb2/0xRswHo1JhJhWdsPV65dkZEXZmNKmN96Fqe2sprPCGkZ/MyMqMs/GNGf3GzG0neEvrn6OA/IsZMo1pZyZsmWkBkzGiSX4yI7XW2LAwY7VUcmY6MFN1WruxMnNlZNgwY3VdmH8zg0ux6iRWM54qCq2jEGNl5xczhgIYoQ0zdOvMUFqNriszgmu8YQQV/z9mSPPKzLMzo8bMsjLT/WDGdefMSMaKDLiDfZ3FwowWZtSGuLUvBNOt0H6ZwMsyPRwOyIfDfpqIpmm/v0hxjV+BWenVfiJmoqPl4zXP1/wPUS0epjQ9VhkAAAAASUVORK5CYII=",
  a_maxed:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUDAQLUXiipVieXMRtgIRbjmlrgliwvFBmmaln90nD51ZxjYp6i0tnx7tN3TlpgDgScmp6Jr85WKBv8zjXSdEdIJiR3i7b/AAAwEA9mOUZxQx63h2rzt4l9occAP38dYWHGPhbTu8r///8AfwAccY0A//9VcY2DdoEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABtOzaFAAAAKHRSTlMC/v7++f7+Vf7+/v////4H//+g/v9i/wGJ//P+//8EEP//AQIJAQn/zzH3IwAAAlBJREFUeNqNlIuWoyAMhkkIoKhVq+102unc9vb+b7h/gGovc3YnxZIDH38CRI25s76X4/HYm39YCKk7sK/dASt05POBejJb9hx+9CYAPB3e4AiZLSbuQaH6FFRHiEQFg52imM+vFP0W3lZDZ4d5+2WOoqSwn+roRBccwyOl2xTyXsRPE0jGgliFN9M/cCJC7In85KFZo48bEXNPBhELEHlO3iL65CNAa2V3SwZgVhh65NlqV3eTE2ayYSV7sxNriyJCEk3ovFdFIrtoPmVONYkUyOais1TIVS9hkmJn6gWHiYX6A/kL99O/blPc1GBcDK7lhKFtX3vz+8Lh5thmWM1q1BxayZ9m0QP4aHbRNEtctdKtxhdNMSlKijS7e5tnkO9KsoJl8ezqWpuLNVp23aynj7OwUkLbZbd3lq4rh7Y5NldpXP+qxa30lFKeObReSexi2WnsVjc6SrO25Ejk1tmXrntZ12TyPedIN2C8cR06yaHTFbsYVYYpuS6dNcSTq4mKCYd0PoSjWM7p2qV0EYegNYsdVk3lGpRfuu151rVwN43DhJ2ZQypuJm6ybZD58zPaM9LalEF21+DQ7NuhqYj/jON+P44bpmo/Ns3YItYKVmMLGwaAQ9uO57ZVUMdaM9yAXdu18WNM4DAMMSlisBs+bkDcGuxUcQEHBflUBldwvtSpc3boxnPK0a2DC1gKrMZjNcexVfAyGK9CL6WKJM666zPAXLt4qgVc3wDU3ybZ8ep9AFDA/1oGbUqZU0Hw1RvIXCbwOcqK9D3FnXzDduYvh3MhIAlyGKIAAAAASUVORK5CYII=",
  a_expand1:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUDAQSiWTPrm1FeKiPSZzPNeESaNiNWKiqxb0NxHBX/AAAxEiB2Ui5kV131jzJWKS6fTC41Fx5ZIFmaMxOhTSz1j1QbFVWWMhbwdWx0bAulUCrmeErmeUrvk17//wD8x2r88OyROR2hXV2zimb1kFrPpoV0Qjd7VEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC+D+LlAAAAKHRSTlMB/Pzy/f39YP0KAWH8D/2TnuYRG2BnD5wKBBtmtBoB/wZTBv+m/Lr9dX6M1gAAAmZJREFUeNp9VYl2qyAQhWFQSDWaGLOvTdr+/x/2DiCavPRdc5DlOjsTpV5RGqBcqr8wC/AztdDMZGpME154w+S6MFqzmZ5NpNdYrdfrMF2YotDmvepPpVZ6QJWHhLauI83v1LK1CaQdRhdGzdbJTpN4cFSzfMpz5iSlCGNaNoOtrUu8+TxMisIQmXE9ELVNn8sBg4afEyKH9aD620Ue9oUEWKJABqJJZSCaJFA0FszQqtSFTOAVBkSXJNZNEllVEmmGeaI4yNNGDsxgY12x0EC8E5EGEXZ9KfV1v1cTr2cITxNCXA2hFjnO/bgf+Tw7I4Fcl23wJQdwCqs/cgrPqbjeo6x9ZvpJ4hdyuHhfimpXjkhiMrw6+6HGvEEdSBlIEaAg4tyiMrQjibdPxNKQOBrrx8F+G70QIl5tHZlC/MfXivKUbLMOTCFCRMiWqA2n7kIuB4hiugeJiC1wudCITHXNhGg0vWI0xYRLBmfY2mcjJyybKm351hnOUx6SPYQnOoEbZaN0N/Agbhfz57/1f1AuxwyvP0bEXI/rP5sQOgWe67ixezr2wL6Djk8QEY3a+zeVlbBhbkWiNCl0kdl1tbop3+2mvWePFuP3as7FDTZKfLtOPtTnZ73qxhfim9rgxpugumXdMh/QvdrVvstXYdutmIhbyGARiHQyHlzFluabqczuaJG0kA0T+iMX6BvgSsY3q+jRVZ36o6SWcBXDrQcDTM2EJg3uY38KDXm2PfVkLUvvhmpLlgtZhfqx2KR+uw16t+r6OB4tpaM0hDcdH/3plDv8TIKwPfQHK+JYRiEe+v6Q/wl+AXPAHMpHmjnGAAAAAElFTkSuQmCC",
  a_expand2:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEVfLCqTUzagakp2RjaXMiTWZTDb2K4uFSLVmmHylDSvh2f388/Ib075xW280rsAAADWrYm0oI1wVk7VZDZ3O0D/AADDPSfw8LhiISysPDeWLi2qVVXPWDTxkDv3oEnvtKQwIDBfH3+qVQCdRj2RSLasiT2+1sD/fwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFkhzjAAAAKHRSTlP+/v7+/v3+/v/8//7+//kA///+rP0B/Qa3VbEDfKtqB14IA60H//sCG8/S+wAAArlJREFUeNpVlIliozAMRCXZYGNIIUnTbu+99///cGck51LdhMBjdNpyWn+/D8M0wDQ/zH8faCM/DpJz5v3hXdaTvP04Dt3yfrw1ESd1yMPx+U3W1ycgecia8x03j49nMD8dV3nJZ7M7wXmem0vSnvKLfBMJH5JrvePmvUviAdarSMHCf1adJicbrDuXbuXmW+s0qdo2tmSqbdybAd/aBYFaEdVhmqY/apoM7yi+Et5q4zaCv9GEVz5LysUbwLDwYkO0e9x4lAGYTHVSoY5KkmRmRCEKkFkBHAlmCE5EFHfoPSLATxUHD1kdVHSFiSRn8AYisOSCUKzLYqKzg0qQevBdwnhJF21b2Liza5BMwxKKUA5mh0CZObiKki8O5kyHDKqUqPW4B+mSnBbEO9BhFkQDzFjRem7gAT8s5YUgZiMardXBUnDp1Dxv+IXX84LpoRSLy6L5d0HSuRIbd5i64uEok3QG5WWGqUqpS8UIkQOIAuCRl80Y2qXruDZbWt2N4CA9SNHrc3+cmKBokbpYs7rb7ZpZRg3gUr23or39vGNFFrVq0NyB112C66Qd8KogjFCEjFZaA4iYvbbeVE+ImYiDG2OkUdHcNefOAYhZvGWs8FLNyb0rhjcURazPHV0jcWYNcKttMx0PhYLCQKnp8qy3EayhyBhRnqQeY/IUUjQftCtW64ZoSq9N1DH1JalIM+7V1tHYnXjk00Wpi2siNerjYEyfHyxMIXnTcZXqnaUSnYOe5jgmODniydzaWTEOlr75IsYQ76ufID6x/KOuakTr28S3IjesiwUIweFqyg0KCCAXWL/bx8zP24lHjwbIZf6J3k6Tby3B6fjpEC3OiKsiWwswnH+X9aNzMfJ2psK3S+J0/rXKz6+PC2hNr5S28A0bjl//RNbnz+CMxxingVfeR8bMZ/K8nv4DKQYbBYvLFyEAAAAASUVORK5CYII=",
  a_expand3:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWUbFahUi9qU1FjJieWMiRkTizLZTRelKXUjVnQcUemhmiOj59pc5TwiDk3ISFYN0SKdI0AAADfooiZs8miOUegTDaGz/T/AADu7t0uQRI6XGxNFjtvHTRjii15lsWPTmGY6v8AAP9/X197dIhglWhsgbx4lMqZPxUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvYfwwAAAAKHRSTlP+/v78/v7+/v79/v7+//77/gD/+vxq/QED//9wvf//ExQBCGf/bL1sQv24GgAAAqxJREFUeNp1lQdy4zAMRVFYRVqynV42Zev9b7gfLJZnNothZNl8AvABUKGHE91lVnXsmJ1wIDPWVdU341u9ezw90On9FQxAs4DFBvp1BTpIdfR+okcFZH/EMPPbQV29byQTdl+JXiyqKmVOFhLxh0fvRRqYLY0XwhUpYm/DSueRo1/9N5B24RDAWNqcnUuJHTmXE83QftjqDzmry5Qb2JQ2Xx1kl3LOqYUG6DiTyXB0Pp4T5wLjCSZKS8/Rnm6SANIR65bqsTZQWJ/j25v4KMjRo3ZMXmWCWIU66LyUmyL+p4lp5TMQOs7pTHS7wFpkeERxpMsJjD44A71VDzT5p6d1SHI6Va8m1sD+kCpY3Knl3ooWcrBmqW3uYIDPENi5Xh1YOsBCsLgoTBigjF2hebdb82fP98b/39pgWS0stUO63lqW6y+YQegEwIl9uAYLLWVHBQ5BpDZYuoMLSRHCWnYQE4MZtAqj77uHGoVifd49WuFajiWiMs0ZrMYYRewyXEpTClA4RuYpe4nGEC51ggDub5rHpaAPs44GmtcYJ6gscQGYGLnuYHNpVkaMrafIUO14D62TXBa51HuAHGyhebYjG01Zs5k2AxhFyvbRrYu0m/mN2piYG4TUtVF+k6Fyfwqbhjm1rxtOt23oJl8OBBID6O1+RFb5h+wDZqRrp7Cdjz3cFXf17gK4VdmkfoHi4IwiQjitaynAyhckQFQFLTHttBUc+sy4oqt9OpoFvEiUk5fEguENGL+jKM7sscjGfDiMXgYcLcdtErl9oG5VZobhAmJEQ+7N7ab0q5Sqm9ZYq4Hp4rGd6jTmgO/oO+Zeo8muwnIJnTH0zkBA8f4eP50+fldFtSs8sl5Cmyq8V9tBkUIfn4T/DD821eMNXl5QPU9Ztrdiwkyb/Tmd6C/2cRjpvqX58QAAAABJRU5ErkJggg==",
  a_expand4:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWaYk/mml8AAAD216xkJy6cTzXcazGVMyfYrIp1S0m1iGlvSjjqiypmN0X98MPLcUvvpGj6/PTukV7sdGb44K/316t0ZWpUMDSeVlmqTlG2moc7ETOrWBifUCv3BwD/fwDvlWT//wD12a9/FRVvCm9/fwCWOUL//38AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSAGHsAAAAKHRSTlP+/QD9+/78/f7///7+/f79EwWqERylDLIfpP//G6ACAlgBagIGAv4CiyfKrQAAAr1JREFUeNptlYd6qzAMheWJByMEMppmNOl6/zfskWyapPeq/QDjn3MkYRzSS0wrrVdv67WSWK/fePz9O03LBd+u0DBUGPfmP+D1ylgwAhCpGmvS0/gITlq/KXDGPIPK3LQe7+D06yoRFxBP9ptRfy/gpKdHjjKVJEMPCwNyLOB1dVamN3dBV7wDp8Kaq3kUcKU3PDZLcpnKmVJ12HBLCLo3sTA1ObIAkzywZHoDROM4mxJ9sMQ6sXCqo6UiM4/fRNUYAYDJiL/EefBIuH6jia4zqCCJd6gCRyJJ0jqHoxESkiLYB1IYsafpY+GUjGAjICRnyS6hQVyFS8AjW2PkQBYJSNIchmAEPLBGEBxIqckkAXszss/At0IgNg3Ac8YDibt06BnkSm/0AnBgK3aE0qHkaA5sTfIOIDsoKpIA5VJRLfp+lAO0SqQyQ8rZcm7sE8jpeaJGgj1VrIpyVnWmiLihcxzW/ge0MuW8l7sdhVT68heMMShk5XwLKucuhaAClamOlyNWRizp4eUG1Xg/0C67nHgoihSzE8lcRgW0jXsBmBkUa2STc+0DtxEt4JmEAdptrS0LWjqdowhFGaW61JvG7Wlruy9lYjIF5IPUX3M0KRpqfLMlvXNWBRuDazi7/AgiFxMtkmoI3wy1LR5BOt47eeECxsxY26ZoUyfgZfSttdx/gLyo67tELda3LbvYV0vvdNRHvJRCNtBKpYjERaLRvuGXJhvAUZ+sBFBbe8OtwXzDFHywVfEG8E70CnUO/xT8LP79Se/L3nPZgoMAOyFaDs9S1Yku5wJu9YrFrGTk5atHurD9sszu9cey7X3o/Q4uorGAyO8L5djdh36/b6Sf2Amsy7L0CohoiBfDCMOHrfl81scTL9C2gEMp52X/72aPi+nEpSzbJFb19Dxf4/MTKD4hpYSVn4/L9nf6B0AbIRP+AJCPAAAAAElFTkSuQmCC",
  a_50k:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXQbTdJIR+jXzRcGRnlmTs6FhfdlEVNKSdKJieHOzF1Ryv61lk5GR45Gx1mVVI7HyKrckHy0atqVRVlSUWkg0r///9gQDpuRSyUVzr/AAD/f3/QnIEAAAD2tknoiDhSJSQ5GBzwqUVyNitnKy35x07slTuPRi+vVzMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGja/9AAAAKHRSTlP+8/4S/wn+nWX+/v/mmw9f//8ERP4BV7e6AQL/AP7+/vz+/f7//v7+Ruo0qQAAAxtJREFUeNqFlOliGzcMhEGQS3IPSXbS9Fze1/u/YYeSm9SO3FL6IWk/AQMMCDrfH3kagWO+LB8e0Ifvy3mJOOY8/w+UJmex/Sblf4N/nrY35/aUb+f1c3CR8sjaJdeSFuJ6ys8jytidS625lI/PIy6L/DWyS8nX6jh+RQL5BJQSjQmRa/IPMEQR7Lk8iTgbc3AFtyeAaGe8/QxKexNb3gLAttekchRRZCM/pJaLRVbdGmen6t7uAWOmbpfrh4hf8bP3ngZXt++clUqvvVM53rr0AL9ZYxAQnB9AtNo4Off61zpylO8iiiAiJ0+kufQx+pZcUu519HL8C7wu3w7xBvpGpZSsYI8n5VDSdVl+RDSDc+gOnE86h9CRuFFDN0Uw/0SEWCuIuBSlEw6XdYU9SnnnKoe1WPsAl9OEDDCXnqqrupRZufLUdlVfCq/BTCcnaAXTyBA+iKiLlbjXRL4qpbhwF+b8Dg5eO9i8rj0z4ZOqLTlU1EsuEUbKN3BFKZ56RsGF0PR1QJ9zTkNP3zbk/gPgFxNEmOAYIDPrKZjq7va2ltX7ltgukuRpV1LKcYeBjKB5wPHSITeNMm0lcrwgtfxd++a1Zmq8ritiQuRacs69lOEfoDEk7YubXxLIu0aoYHQAbQ+5UJtuJR0C4T3/hbZhpgNm/HE6MVKsPMHm3RYp5gR/AcOugcHRI4QSVpVUI1QtBuwHeFDc7pm919u80biDHeScMoUObZFp1p0POvJ9aDwqVcBa2nURuc27uNfKET3wicTUOAv2rQ5OMKPtzm1iq5gyeAhQ1wr/YyBru0YeR+KlpubnJGxxq1MhkjPmXmkOxsKZwHO6+vELpmA+rRm6HXKolLaYe2dxgddXGfMYg9YIcD6dY1109RUBtZg7MGIgF5obYrZPxF4bIeWuZ6un1j31OJ9gIO8WPnasuBnkRaGpC2vC0NP/cLE3vOR9wjEVk7ucl4wJdzuLeGL7cWfOh32ypBYjYDIRWoHlcJnqLtgg88h3uwdip9HCYNvNewRxl3N5vkgP8ShxyjEXY+wpn4L38oX9ac/fz99xR4nMutm8zQAAAABJRU5ErkJggg==",
  a_100k:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEVaKyPkpk7okjWhUTCqa0z40WDXbyhsVlY6ExOTNxr01JzeuIvDdkv57NhWKy61jFdSKCVzRC+goqn/AACTc29UOERaWjtyUlKunZv///8/AD9FHh5nQDxmQDZVqqr/AP8AAACsZ0nQmmyPSTfWpHSZWEJHGRfRZiQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADXfatkAAAAKHRSTlPx/v/+/v//Ee3+/v7+/w/+m/wIAQsVCP//AQR1fqUDAQD+/v7+/vj/HJ8mXQAAAuhJREFUeNptlImW2jAMRWXLa4CwzNK9je3Y+f8/7JMdmNJWc5gD4fKeZEui5R4veM1v9Ih53h+OoMe7xXt/ofUwYsp08bNf/gW9/050ntZHZNPA+r/B+QeZ6bDmWpiL/Jk1Z7AX/wz6IWZKesSOkv8AX8Ct08GUmv4M02XvJMAXD06t5hlDHDUbuNDrAIfemu4ctdaov1NacxLy/QEeoHdU3Y8OSqkzDUWtalpV8x38AsG1GnkqesLpnTQmwWikSWJ8yCw+WgTtNFlrdWh7BqaKuQf4RtNae0aiQEpZ/MaRWpUyO5nb14VeJUMex9FQCISdczwpCSaDx6sSxRlc7mC5fj5z00jRRZ4QdgdzPgN7A9hPpnw6WKvO7LqilZp0BCjeqolizrWfy1XKUFFbUVRW681FKjCrGSdEd0FDJCouOlhzlFS3SFTk9mtOjVCzZMho1chwpa4YtdIbMzVRTHU1gUbNfD3BV296i8gRnrg9dTp9DhQLksxpByud4KutYyc5buz4KL+09tw6iCYGWABaeaw4MhS1YCcYCKmo4IA+FOX0YBc3xv+BKcE2tyHPDmYcd21aMoScc7pjdmDbhvIiZynmjGOsbRxHZHbgTp1TTjg8bqyg6BskK4likXHmExigHRNOu2ZS8OThLdU49D0KVdukJLtNd18YbRyYwwIQ3gZk+ISO0ZtVnXRq9+UQqMQw06+5S8pdWyhu0sACShmCtVJzCdK4c1OQVMfrtV8JykLvAuxquOuS1A5SyWKeSm9/DMAAB8Ym5RTD+0IyhBUbobcQFwlBd0xmK5UxXMvy1lKWedX6OEa7toDcpHE45aMYD9DjOkHyGNixeMroL+yUFOkOYrKRsZAyyH8EOAXu9rHNZopJ5XOtdaAy+LWycBT809oLhB0ga67ukfABa5DC/LQf55+XcDXwzx/RT+yyzH+v5tu3Fooxxz1MuoZ2ufn/LPvb6+3SqOxBoF7/t+x3NjzC+6evfgOK1XlTY5MI1wAAAABJRU5ErkJggg==",
  a_500k:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWlVB3mq0z52WPQbhwIAwluNBuJOxvmiSt1YmWKeHiYlJ1VIh3JeEC5gTU2FRFEJBpsRSM6HhWId4j+wD338Ib///85HBy8eUC+g0RUJBORSCPRdiloKhc7GRGsWShIHBC2ZSvShjDzpTPtmDDYljKtVhX7tjnIaywAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC4KQ3LAAAAKHRSTlP+/v7+Evv//xAODhv//dWd/ogP//8BfP///P/+/vT/+//+//7//v//rO/lTAAAAwBJREFUeNp1lYl23CAMRQUYmKWTpU3aGtmsNvz/H1YCTzLpad9JMH5cJLH4DEzTdD5/P50vel3X58vp8v1yOp9PpO48Xc6X8/nyPsH1/UrvYQ0ACOva+3fdAG+jd51guq4vUmzblnOt21fVypaQUj9dYZq0lEIphah626WwG+NFEkkRpxcpIcxdof/9pRDlWwe1vIV5Wf4aJd1nhTQi6hqDXpZFL4QP6aPthg5wgCKucwiPscLxOh4ryHlEhECJR6x5mQ0407H+Tm2A2sFZdZAtTmZsydZoANDdmAnEAzQfEWlcVSmzAiFEPCoOoMIRce0bE8LSSmmFwIa0zRaOtX+CHNGwhBSltYal8q4rcnR4BGkJnCsBxyGkZCGxpSakVZrBj8Vow0ylMfRWimx5RkY+XFjWD9DMxxE3hYnGMedEc7gGLDbpO7i8CGstqCSELcJmkVIlUoiSEi8K6XDoPk4BkhQI/Zaogmgpa801ESJKIdfu688TTM97sZiSpfkilUJPK5gRSCEpASYs8DrB66J2MKYlRACqKaWkGiaxpQiqUe7uwjPMN/Eo+D2ev+IXW8ww59GrvZXxJrsEyEe9zRCU2pWylr8DqyzsJceYK8R6V85YZAfBqn0HAoGq3XMNIf+ArlISwCbjNkA6U7p45PMNgpIJlKnfm+65nHMhEG0C40DvELX3BlQGEBW0c354C+TKi/lWkmu+OVWKay1qCplLXHyM6DBvLnqTpByg8d5rVTf6CLxbDCd0nj2Um/ER6JAo9TebjHNOq22jdNwjudEbnu7gTKCLkVLvm2uR1CIdBffI81RWdEdqAr1HqpHrIUVPZOO2e57AHwdo4qixF/Ygw3X7aFK9g1wP1qPGT7G3cI0MBqTtoTychmZzaa2XSgIeoyEcIKWMzTvwPTXNQaoEwPNk8jDSIRK4Qqk8zey27+dQ9BAPry+awZ2+leTAgaL/LyUOz9GnJGygiMrXXOjcho5OeXBqVCrA04yK7vv+f6lNqfkJTh8/Ap+/Bv/Q9Q9yZYAji4KR5wAAAABJRU5ErkJggg==",
  a_10day:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXfoF+gUCjcbC9uLR6QLBnlkTf42pLIelB1Lh2jaEd1GQUdBQT2w22QSjBqJxaUTCKKPSeBOieENBi+ilk/AABVVQCHQy3/AADDh3jpuoX//wD71YluJRUAAABwNSnwiDNpHAzSVCzlWDCYRBjNZyuQORRTGRb+4pMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACMTQtcAAAAKHRSTlP+/f71/P7//1j/CP/+HZSiHmK0/wQDTwER/wH//gD//v3///7+/v7/cgpL0QAAAq9JREFUeNp9lIuaoygQhasKMDeT7pnZndldiUAAff83nFOg3ener+fECKW/h0Kh6N709/3oY4z+eN/V4mjeYurN9fjCOWd+OV4R/dI4q/jn+f7fO3i+Xz2Tiv3r/a+n2Nkbog3Uzj8xB64cOF77CBH9nKXEY3dqjjdjjHOhxhqcY6OyzkmNsUjR+KaO59errbYG8ULOl1C7AnvnXM2Oba329fVM92N0FArzIsRL5l0Vl8V7Zgnk4rc7YboYhr3xyMqjURlvDNythizI5+UbeR6dLOyKLSFZCV3yEPTFpoCnxY3sKWaHcVkSHmWfZNODfRG2VgQ3i8sKYgQ42EtN+WIfTSlJvXBKl+UhErwNT6BYpLaDYlvsK6MvyH4DTZD0EH+5AEzNUXBaLhfRMJkGegX7eILf410iqYcA6wYq0vXW7h3IvA3t7R/VHWMufqZDOUB0wII5fBBifgKHicYVmvQHre2YVm2JPoDjMJ1mmgbcHtpJD6Jxmj6CK26fDDW7dwEcB6J5m0wHKZpI0yetZFlB9wzOc6R1aBvg7YGRPO+OvpYZIHI6LbSS9xErawfZRnrPMVh13MGZ2fOwg5W/AiMrPBHnw0rZ8vOsP4FTAy0YsvUj+JwjHEfNcci6qWj6H4jXu4FEbTIMkjfQbqunOQI0PwDGJcYZjiuM1umzY5viDxgQn7BHTu37sX5RfbHzvh5nQ8OwrQNdFmv/kt0P68fMqCLqiF14+pe+0AFDlM0xYF9/yR3sgs2uObIL2Lxm/kIGW14o69CEyqCgUdj0pkftAofSQF8TqpFISalA3M4lIe+SUKBCKShSCUPfvldBWQzKisO/4EB5EMZGdE2h1O83LXtceuLFjb0ea+yCXujXLeounc9HFDlNpzXaM35uZXf2rcH14/XcSvPyZ7XS/BtjSHe1zIs4fQAAAABJRU5ErkJggg==",
  a_30day:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWlUCmenqCnakdlKhXeZyb635janWecNh5mW1tGGAjqiDE8AABPIxV9fYJfHBMxKDQzNUrCeEjswX3k5dHJOha4jWFRPEd2QSY7Fwk7R1mJTk7WtoD8141IFgTQWCMAAADrt3Y2BgDlZSbmp2vKhVaSNxZdJRA9EQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIe4ibAAAAKHRSTlP+//74/v///v+j/QRV/xD6//////////9N/w3///3+AP/9/////v78UfYVWQAAAsZJREFUeNp9lIuaoyAMRiPhotbq9DKzN7Agou//hpuAtnZ3v/21CuGYhECBR1bjQsDHX8I1uKY0gX593+GCiF1/IvX5zq1uKea+gP2jcwitBNe9++tcApnNp+KxaRyTrcPmTZjNEBqODqe+dywk8B9KbRuc+9mfgALAOEJaAQLFJ7V8ty29JjBsljJ0D+galNNojHuCGyynSSZ0GcTmOzg05HChvCGkadxE3+Z5ZDNMLawbSHkvCOPEfiY5AoyScAKpQPRFmw6gQ0IKCATSmwO5wOYXyEMjeyEyJ1kyKOZx2kFZ0npT7u7mLUfYPk8k2KeTe8+5FY+bUiAhlA4g98jIA2akMq0otGdpERJVzHE7zg7lmEIZ8V5RjVa8KMvyczBU4kVTl8AkJxN8GbI3waC4clv5SzDyPskglKfVmO7SBF04q56gnmcfIRmqSwIBQElIk4S6zrN+ghdvrTBGW/8N5Z2KG0LitQ6grDZGvDwyCKCVRjS0o3EY+HlHoEgA4pUjgUqDthGc+fpRb0qLsFcNPJpBl0HrKbT1ejhXRbdqUMrSEl7VFvoA+s+6fnJVJT4Z/NSz38FrAZWuP6qqPp+rurrR/VEr3ixALg4eLdGRwTNdt+z1o7bq6v2VUniBPtK6beAu8uh5nlEdQguOUcAcl3kOTcsbUzzU8QLqUsDq6DHnCPEQWkDcPFKCPPXskWZ9uRzAK3vMob92bzT1qhYcmnbIMbRlVms9VLdz4c7DL2uP4DZrTaF91LXYfdY1LYmUMc5voSGBAcL9Pp+hjhlMBmTc11pormOklfJai7IlBG90y8WlWir9jf9cAkTZ8VRYHfXAQk3DavsjWE8HBIG05WKMulwvxSx+6VkQ2CCCmP+riwBs8vlIwd8Ef7T4dKYTt0M66pcl/w6N/FxKs+MT9/EY1tXxTSfayu+QD+VsWdd8bBP0G8PAbmxne6esAAAAAElFTkSuQmCC",
  a_20k:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWiVS/pmUteJyPNcDQrFSDlkDqOMiGoY1XQc04AAABhUi1hUk0xMVL7zZYxTiNmGRmjkWC1kJL1rFTos4VINUb//wAvRGzxoVLwp093OjGFRTj/AAAzVYKWUk+ITUVzNTRzQz5+QjN6Qjx4gDuBQjzDPBn/fwD/f38AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIPHKmAAAAKHRSTlP+/f7+/v79//0A/v////8M//9h//8B/yWkbGkB/xZUmDV7h/+K/wICQedQ3wAAAsBJREFUeNp1VYdyWyEQvKPDK3pqlkvs9OT//zC7B1Zke8wgDRzL3l5Bklrrrn57kE/H4w6AWqU+7eqLWTym55T/Ex9JL0QKvr7CErvx3YhKuPyoz1V29Rc2XotPV8IxJHn1oBB5qDupj2JA3nRvByk9SCkUjLbte5ckiQuvQ3gfxOR8lu8iJRYP35Btwtw7YCEH0+JVB2MfHxn7GXBvgW8Y1WQpnUVlyJ8xFqAU55YrH28Zk/sI9D69AlUHytH16TRN03CN814M0vWgxXJN11M4zVfgKCrPGIwlHNdiBNLlnDuwGEsHioCOrpOLLLl3TvOyKWvT3RXT6Id31AW7UjJEOj1qr6LnofedkYso6TfuOV2yJTI7Z4FZ/Xow3th9su5JqoCEtk4Actk7Ra4tSMc5p5TQF4yHwLwAGXqxbqvmMtk6Lsp8KtvxCINIRk8Zkp0F+jAtiyIe6ogRpgxccKksBWqT5CyFMMyc3Xxi4N4i7/oKFdA3MiphINW7kxQyJYpjykh8hKLSiwZ9GW5IgfQvI4fjaUhzyV6Th12hDwlnmuBmvJk5kFHcujZf+HwiigZ9IVkN3DZwSITLhWldAxkZZVvbtNIBMpkmxsGLVLQACWYCEaSs7ecGYIJU5Dww1C2z5NCrYXZ4fQgSjTOBkSmDvTABYEKoGFmNmT1TFM3u5nkO3Q5GN7QhO0OwjwiGj8JKiAqHvDaUy+33ghlRjy2xSwFBx0ZFwZjB1tqGsDRO+33e71tsKfEeIQRiWNNFB+TaABQ8rQkAH+bT3AyhciC8T5m/3N05rrlo8GSPlkR6kEu/YNgwh5l2PkTX0G7WA/ayL1IPamJ5/mqnYC7i+MkBYcXqHshojNg0poE3/bhtzu6BO5+B1Cvru9Gt9/XvWSqQh5uTaF9x3DRPh/rnjB/7+vRUL4cPLNf14VLP+Pv4B3R2Gi+DsTIOAAAAAElFTkSuQmCC",
  a_50k_c:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUDAQJgKB6gTyrdlWyqY0uRNB00GR7Jc1NnTyzwsoVoEg7NZSPplitRJCNWLCtsUlRXNE08Gh0WK1JiXV44MUxjYwD/AAA4HSeLSiuVWFMwYG5XJUv+w5AAfx83TV5mQDhiSSq0AACJU0U9M0A8TCkAVf9lQECDM0EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAw75VfAAAAKHRSTlMB+/3+/v78/v3+Cf7+pFf7/6AODP0CAVm8HAcT/AP/TbYDSbH/A73/Ov5VMgAAAwRJREFUeNp9VId22zAMJEAQpERrWHY8spqk6///sHeU3cyWz9KzKAi8RYZwHT2uG1y3g8iw4M9d+N8Yj1vhGMfl64I+9NvtcdSURMxEtJ7COAyfq/tFWKOqZl1nqdbaOi/9x4ZbyXhvuDRGU+tysnuTIfTv68aUUoz4RWmtMx4yIMjuTWX/jLqqSUxcigpWBQQ8A4rIRYxVl2VAL5V53u+9bDCK4iYS2+Kvyw6iBmDmU7S91Bir4rbBZBfZeAwH1B0IL8lEQJl9cQOR2GUIUKTw7Xjow3MYNFpqWmjMIFxyVjbLVlyAOsdE7v2OLYoXdExqWqW9TUmTulCE2FnZ0TSzDCQUz7XW5OztsAb/0NeE6L+F8NBPZZomVJuRKtuguVFNUlT7LTOZ9z/RoEwXjBEaNgE04SellB9o70LRR2naMg66UgWjWRTKyGWobFG5bVMgzFsXq+xFZqyPaDSDAKNTD+FFqRvRZMznhDeU1YgU66MHZYeRJ+pWUJIBCk0JALIakRAuPgXifAqqRbxIawPYvroJXPTaMrWoRIBCp8ItqQ7LLrbrhmZDtkfZbOKmanhq0XcIXhNNYNCwiFbygkOSaoYWQ7hz69iBjCiPyeoMWGcaGZiPmCDPwKV0zb/FaYLjbYcxSAw9yKBFH3YBu4R5QLR9P8/u+AasGfGU2YxURiZ3VZ+sfZpmawavprR1mMDmdRjWyVxVpmxTY311r4UvpaFHHu9gEfW/3KyQtbcoQtQCUJCVe2GkwxmLgDsLL/LkjhQpdryPwxnJXbRm7HwkEpisBQkJzqvsjdca3Bu05Nakew63a9s+Ps86z4ltAVIa6ZtwZJj8wlOajhBpDRiBrnXrOSCcbPljeih1zS0Lqr/CQzi/VhZqC+CQkfkED0iNPOjpJbw9fcIZ8hkOtJgL93XhcaVEEj4fe3QYbx07qqmHjnv/Hm7fV+6CJLhVFEUaCu1gBOQcdh/P3Nth2PZPqPTHaY+9LwETy7/O+uU4QlCf/XrYH74+8Ru9rfuw+/t0HX8A+CUdnZQZ59QAAAAASUVORK5CYII=",
  a_all9:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUEAgRmFRWlUSltLCOUNyKka1LRXyhqLShYJiZjEF/gmmduUFZkYWHklDFycg6qVQD/AADLcEgOHFetjHCXlJVqTSBUN0V4RSxtmcaGORqKSxhhbZGTRS6qVVU9Eh0AAP8VamoA//+hGRmD3fozM5kAVap3VEp7lCEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqgmnMAAAAKHRSTlMEE/z4+/v+pmoL/f4G/QIDAf4L/f7+/mX+tV//oAP9AQUBBP4FA3z7qSQubwAAAjtJREFUeNqNVIl24jAMlOQrjpNASDhaYHvt8f9/uCOHAOGZ7colvDqDrtGIaGlrYgdj+saYKkd1Ta6iMjYyc1QcGel7X3ub/9HbWICv8c763vbWC9HT8LyhqMBacJwCN3p7h+f3IPCxk4hLLUXwIerIWCspnX521wKs9x5YJNYoyA004IXBr71xfi6MKVhR8/aNSPra+xqF04eBR5iEa7qVrb2egDaGbKeA62CM+YFTXXtHcKcRH5pXweV2m3ZMU4sakDE4Nw7DHgWsVufP1ZnOGZiM2RpzD0RSfV3/pm5BkhGzszePTGx7Vw6N4FeP665rygxcrvlD2aVv52SyLpPEPD8fSJ3v9MkCVtr29a17MnZKRRImAxTM72lVyhKVg92EaZLJ/Gs5W226CP7IuJSRxZGOAFqrXTL0AtAAZp54JIupg9cAoJPDeHgKNMdkDRkA2xZQh2KeeETE7Z9toHCppipVTbTRmcyh0VLtK0cueGRupq8sn/81zATPKnyMO7F3jcabAGUoT7xe0GdzfqdfvFRh8i/LLWTytSxVqEflStACLL+ZRGh9WYV3HoO0Xn3eVMjw51KCFD7pfdLrRjPCVCU3YsS6CzCCm+ORRrSAc12iDcYogjIZsSyb2aN4SGus95rYxTQjaTNpMzBSNLoAJCeju0BPBqJCyDBSc2vZNNC6zfpe69K1FyfZlDZpxC44OGvw4OI05RWMAcDSGL7GlMavDIx5XLgsecGiRO/l34pfKx1as5jHV38BmdUUvB17XpwAAAAASUVORK5CYII=",
  a_lv3:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXUcUeeVjXppE9eKyj8yVqsYks7LixcLS1YKy5VKizIbTp7QzJvZWS4hkqFPS754pfhiTz/AACwoJUALlV5ahTwuH//8H88Dh17TTV9SUm8lV0/FCMA/wB8Q0C/Xz+/X1+2gT//f3///wD/2pH37cHsi1AAAADyk1EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmWOZgAAAAKHRSTlP+/f7u/v8JnCVo//0O/fr//wH/CRMEBNanQgmZAf8ICP8EAQf//gD+JS+YaQAAAq5JREFUeNp1lYlyozAMhiXZMuZMmt7do3sZv/8b7i+ZNNCd9UwIgz9+HZYErfuVc0rdiNVlrMMW7e4f+i6EwFEkMm66Pn/9DN4luzZIIpY02J6mu4Oiac0ila5LAM+mu1NMa+54BlaE9ksiHnKX19TAuzW9MASqydVaSsW1FiPhhvDL/frLwOkhdxpdqwAGXahg+Xvmq3Z5mgCmtR8FHHaKKRhTSkOLo2MPqIERNsn2xcHbgqzEK5h7ZIVEG0kHrBjIfQaYps64AhsEcM8VZjwyspsSpdVBqiLqGrdFI7Pb5i9ropyvivTJu8rnkw7iijnTU7DcwIJSPZplltPsf1HDE0COiNgUbiE0rsR4ulzmxY79N73hiIeda5UC4y+co5fH6RR5waG/0fr8Q9RS++EZw4mqS3VShFVlfl6pZ6l0k4PF+AcX1cUwHDUXZIR7CuKx3DiBuYsu+s0r+Bw85xIcHKq7ZmZNBZ7JonjjPCAOrtpApBA+Ec/wFCm2epEK0ywDSl4GgDg1A62aOAwnDTjwFi1kyB1Vtls4GahfyJ7NcO2Csw1VztVAvAPXVYNaXS49rYFJeYhezHgF4gE5gYiXpdUplMJK7waqhRRHrewGeeD9eRr4nR5xEJAUGdyzMCKtsGfJasVuvcHhZwMXszggZ62EyM4evtjtBj56mRGNQSnA79Yu3orePq1vvcyscGEbtvDb1QYkrTNUTbBD4VorWD9vOofaRYK1uCJaYU3JUrkVD+3RasWMrdCnrV1Dk7Tj1x2H9igNXHegDwAVj7f1tvnosWygj5T2xPNi46Je5wR5KG2kYEjdI54tE1vDflAFkdwD2cYeIsei4xq8WnZj72OQGsm2Pwxboj8NUhdto3mvuI3m/O+wn16vuk3rdfrPV8E+HzkZHLqEu8PWX1wCbv4ddhcAAAAAAElFTkSuQmCC",
  a_synergy:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXmo05bJx6qWDDfhDuLOypWGBcxERL4y2l3RipRLin13YpRJyKykFmXb0g8GRtVVQBgV1fCTSbOd0A9ERC4hDwA/wB6WUD/AAD///8/P38Af/8A//9XPENwRzaqqqr/f3///6oAAADFWS7VdzbhfDjNaDNwNSSSRSsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADtK214AAAAKHRSTlP++v7+/hcc//df/5H+/l8DDv/+//8B/wEBBAIBJl0DAgMA/v7+/vz+otIE6QAAAwFJREFUeNptVdliGyEMlAQs7OU4aa7eXVjE//9hR2wdx0n1YoyG0eiwTNvFwvFxPrOqhuHmEkZX3DAM4fV11kpEad7+BFxckW/AbeCUdDxpdTBaTyNrSsMnxl8jFzApt+L2vZCwijH//PpyCzyzmL9IcYbcq1SH76ThPWMYwmZA143cToRPPNlJv5nzHeMMoOt8ezSm3fVnpPOV8W47zTP30BUccYrUyYW9UON5HgEBEDihZaGym7s80GR8wMmyLEhoITkBRHdPQS1fshQKbAdfQfYsMRKbh2R4uqMtsHQ/2OBnQRJOG+ojFCk1hXZCPQ2IQkC7iPOPcVoFQRlgAi7SggtU9QBKsbppEgSaVi/PiQX5E7AU45TKhdFXC+ZIEhzL8zpF+dKcQMej0TI9cNho2EZQVihyXbhVJy4ANm4NIRbGcdiGA1iFeSrVIRJ1Ei0uaTagMegJwO8zQu+yriifk0fpQEVm0pp6MIrQKuNGo0pFKjTBCjM3Qy4JyYgeZ8aAykjcanEe91NBzyCre6eFLe8uWguar8Q+14wyo3OosTTfm4F07I4YxbaxOoBZGKFQ1rbv4rkTrRDhCFL6sOwd2HO2PF2rrpo/AqacTIvHPUahMI3cRDwimqbUeaK9BjXYxFsoEh0JZTRpYCxIVExYjImLgMzbhOK959E6c2JBafHSlT5vNgu8A9latclzhU+XzhjQFbXocUXHBcBSa82ZqGbqLbShABAToApaWpBFauAHG5CRcq6X6ZGcmwfS4oPM9EJcrqXSFKcJlPIGhPSGrpipb2I4ekAiJdJDvs5jBrJJ9maQ0RCyVlOX74nu6xE6dErUxeJ3YDfbVIaEgyrm1n5cSBuLzhAi/QEOBxfwEOzVfthkC2+0BeBzvpB1tBUnY2vZAgjvV8o7YH4z4vl2SW3bASw13xjp9mFJnQ1YXD005trVVszP+cMiPY8Yb8wG9mdnEjthE4znl8+rGTZa4602ihNs+O+yDyH0rNAl5PAb4sL/lv2/q+GHMX3++/gLgNNv5NqrEvwAAAAASUVORK5CYII=",
  a_allshop:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUAAAD38/Plnl+kYk+jUjL6z3DNc0xsOEL15J7Np5tyYmWiXVJtMzmfSzWfUC6eWkloOUV/fwCujY95Rkt1Ki7/AACNOy67hWmce4V2HHB3REylYk/DaTlrPEe/Pz+oVj3/f3///wD///97QT9yQEtqaqqXOyyqqlUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC9q36dAAAAKHRSTlMA//79+/7+/P7+EBb+oCKcpgL/+QQB/f7/EZBV/0wETgIBAv9HDJsDoNC5bAAAAnVJREFUeNp1lNei4yAMREGiGHBJbKfevvX//3BHGMfcbKInEh8kNCpKVbaPSpli+PWpnthepa5ztNjQ9fjjCdh/GEfW2gbm+KXvn7k0RrBiDZuHUFQpu1vfSPBr0oPoGbSWQjFHGYz3WJwjSw6sizHcN9y/p9rn4SIsk6WTvhkZAogP86FCf12vO3g0HFYusIDd0KXNX0ppYPacE1lBOVs2hoeU3rPPi0q+PVligJJA4YicgNTQETIlyTYOUg2TPZINhOjhJFz2iE8BRYIocZAsltDM8ICE+JUcs4A5eRrSp5p3mZu0hA66RXRuHblWNwY3F5mom5US0Iy6gBq5s3eiZ8igyGTdn8wRgdOjHIL2RBOT8yJ5vqlJUugUbtOSaYsnUPDMLTv2Ae+0pigAMSqQHY5HX0w6hGgFyaj2BmrJ4Sh6SD8aubVqar+DgSHP2rgE/6EGt9AI3rItkyDR1k4qHvkGemnc8sSJ6nLeeZyclUqiRshapoJrcLfIp7PUdDp757zoOObGzU9/zToK2WRhoSOf4dZ5EV2PUEVCnaQy4KK4bFCyUmspsyhR1xog+udtyMNynthCHlSZA3Si05i7h4SjoUebqcuUSwJpWCTgUeqOC8e1H8n0S+cm7wVgO+F2u1Upe0TC5sfXnIcmxbjMDLdmG9d28eiGPlWr5W23Q1I/+Tyu4HiWN3Zd9/Ft/Je53oY164es+xywQi8xygLYIiM23mf6lPb3qydmmeqVgiX5//JRBzVL2aslhXwfbbODiigzVWuPHoNiIue2SqGfOjzk5vTCvDYuVnP6+2Qz45m7Kxfr0Adfz3a46LlO4W8VU/3tH+VpHK1C9DuWAAAAAElFTkSuQmCC",
  a_5syn:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXonmKkYk3Md1KiVjj23pnLq6B0OziIOy2wjovo29qeWlB9IyN5QD3+0XX/BQWJNSuNRjeSSDlxZGS2g1l2Q0GaU0R1OzikNzaNTzmOUEZ2OzN0aiR4RkR8REA/AAAAf39wQT2JPy7/f3///wAAAAD9/PyQRzX7yHEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADzRvkfAAAAKHRSTlP+/P37/v70+///FAP6/gGjk2AN/5mUrRAhVG0FTv8EAkZMAgEA//7+7yhnGgAAArZJREFUeNp9VdmC2yAMlMDYGB9x4ly7m+3Jwv//YUcCp2na7TzFMOgYHaH4iCHGJXVA2uvHA+iRNsdlxwS4hndLvHxC/BkPC2g55wYg2v3L4jyEy/V6MpTJKgjUU4jzE7F8vzJlwxVgphDf5nn+w2J42X/f7xIRuw+FQxAcwpPrEF7UX+pS/1HhEjW8D8AwVOIlLp0tKdh0Z4KYrUpVZKP4Fs+0ARlwZa6WcpJInbUBTPohOUyUBEimyRpl7zp8wCjcOOJLDDTsNdfe9ZyYDTXWqWODYw2cQeX9hWJrpuLP4xK+yPWSMydxLcBjiE8Hu2ni2Rg5Xbn3llj00XilqKcrjUR2064lM9JkXeVtCrBpXEctDiqxh+CJJnjrhEf8sREnUqJYdIDHNRTgViqYYdTLqQMxC9GQ9b3T/Lg1ahEdBHtdOWNXiIiRUyftBcnYtpRBNKAlztPUaLk2ixp5rYzk2o4jnmZ6POwonpWplYFSDXce0kuRtFqdFVcGV1+OaqRAaiaiejxGtQSNMEXweBbHpkBsIjgEDS3YC7gtTDpKtWwN0ohPGS6HZMpQlG6XrI0I5kv/J5VGW2Y1piYD0WrWqEyvvFYaTisOI5lrPDzeib6UqknyPrXyQlq2e38fx5YfKrM1RYIkjHc+leZpNO9a69/d4+Wuk4pK9yCMpl4Uize+96N0pkys1yeIt7SVaL8E6fBcmCBKQcRMacgsxN4LEYIPL5qq807FqU1XR0FmAe1CZh/ooJuEirTK63VRGB1XEVN4cZa5PmJSsgK1qQo0rbhWzZlP1wFEDPcpbSXcVk9NTbFbrvFw3z1awLG9z4/w8A2ct5VSt9m3201CoHVbeyCWZTYM89N+PJx0ptaVV/2BRfb3ag6Hw1v8+pCW4df/Lvtz7RlZ9uEzogZ91JkYb89/H78A5n9lF0rP+xgAAAAASUVORK5CYII=",
  a_chain:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWgTCmYNSFxJSDdnWTIUihvYWFwnakEAQGlaknFdE+MRyhxssmP1sz51ZZnIh1nKyXotoVhLC74x3RMZY58RjOCpZ5tYWeOOSmQhnBZO06LxrzNPgt4QCx3xM//AAA4OGOqVQCIQzX/fwAAf/8Aqv9MP1laOE9VVQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACTjTzmAAAAKHRSTlP5/fn+/v7+AP/+vP7+/xap/2L+/vz+Epf/j/3/tf4BCQNMAgIDFP4D5MI8KQAAAoxJREFUeNpdlIl6ozAMhCVfmOaAAEmTtNvudq/3f8OdkQxN118S9FvDyDIO0h27U1COS9cBjiEQj91f4MViPWFeurf3oCIpJeKxG1QJz913CE9qKXkXCN1QRPTXBw0tFr28XToJjX50Rzn+NHvBBC0HB5VneJxWkO5DuChVFEvy1L393kBQe2iLoqWAgt+WhH05qC3ZW2EK/hfvMomyAwdNgGZBoIcMymJsDXii0KutwBQ90NhWQB4A9+lKtkMt5x4N6IihX8BzXiyl7S4r2ISSHhzFxpr7H3QVimHact7Pw12bkCOIlzbiah6gCaUSq7qwgds7SGu0Shtpdbd16QZVTSgSxxijC7X2I6j3ZuqaMmGNsfbASiGgJ/TccHEYI1aClUbO86eqhgbwwRZHHwYS6iTxQH98VBrUOMFxivVgNLH3OFXfrClKuE7RAbOBMw1iEHamvuNclZGP1rS2XeaT9rOKLu3MIYNv0Nd2oPkxu3QQHXv0pPqkMkZGcQQIo36EINE29YeUDvHlcMC/Rjx6iYBXgEUQJlvDiFtXxxb1cXOMJqBQMRlr6KsLEfVaXdj3gVH0/71WbKaEnANzbJDwZ4WqOWdt24DW8zxnrPELKCEs8zzbFmEu47PbZQCjecllV1bI4iACAaK8219hUgrml7rbnwGZ0xTeTVgq0xCyWjk3YWnCbxDu3fFezXFvwvNZKRQTXos+Cr/RUa9NiNJlqXvLXb30vQmzVZeaF1YjKNrInsplA+4W1mib/2RrLsvnEaJjO1w8mCjIoywDf8o+48IjiEs2sH8Uf++rMG3C2A+YSw9CPptSPg+pzmV9I7B0yW0Rr3hi4eavoHDiM7vdEIUF4SJhuPGtjus/2lQamS4Bu8UAAAAASUVORK5CYII=",
  a_invest3:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEXkmVhcJR7qkDOoWy42HyDaai9eDg9OLC2dNyPzxnk4GR1YKymgbU791IhfVlngdkQ7ExRNOEh8Sy3+xTc7GxsdLFGuhTCnkGH/AABSPkB/fwBqQ0MAAADYZS6LNyasRijwt3LSWix1NCf4yoNsKyTnWTKTRizqqGcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABfofTnAAAAKHRSTlP+9v7+Ef4NYv7/YKP8/xH99iL//5cS//8B/wJ1AP7+/v7+/v/8//7+aUdemAAAA0NJREFUeNpVlYl24zYMRQFRXGRJtpPJJNNWXMVQ//+HfaDsOkVOfHzEy4dVMG0/bDTb9maL2D9v22bG7c/4NHpheL5ZWxXBhlatxc3X6QuEmp0bsEOMSLXZbtfLw+wPxRMDiP90HElQVks3xU/wz2aVqKUjrTssAU/UON9guPkf+HtWOJjStO9T/9tTSgTSfYs9wKtwIpGGgcAIt8s1IfUL/HsbhUs7OFja93UVTuDlh6IxZtbC7RCF5LHScuxJwphOTp/gdbsEpIEcCGzaV1JfC60TPKjYOdYCms0wSjKJJ4kN3DBMC+1ralp37u5yB0eAZ2w78HVRv/SgaKXW83Dc+M4CjrZJbCf5UBQu5JNbqNnR0LULei0k6iMZKOZlf3CBpVVl3AC+MaWb98PQYUTmgo6qfZ96kD6If2MoDKOG2ueODUTvIUanwxlfkezpUDPGDJ6T97kVL6Au4EC63Dk0ftrRW+7gkG65fU6LEk6wEJxz35nLJHr+lqgKWHEjfA56eteqdo4ZpGb2aafs8+1UfJtVOpz6NQyldbfMKrJz4LImD5MYr9TrTdGpQQUWrnLWWUQReHB68BlZozxGfE/EOAmh67kSvQ8Mn4q+ms4+UTFSHrx3tHCpznUuqmmJ4jG/o+dfLhMF6Yz0uoYannpRIa1FaYAFcX9y7o0BOG7jnUMJtYbGrOM7jhXmBhHijsMbcuPRGMR4natwiJIddHpa6BM04UcdCW3ZJMYHdy+Ba0ZoqrqQ0SPvtVfqOE4OQ8G1dD26+Zw9zrPKMiKQ1AO4avvCIIZekclsaJDOMJTuNI09oOp87YuFRJD5Ly6MPXHQjaCbpSeyLlQrrVyeirXel8VFuA8NmyTJWsEIH0cLtTTsFWMEtEj2YjljZFqFeqPTWinAWht87ZK0YVNttsIfUBSz9oZH2ZHAlH6BssdqzF4SiS2cBeWT6lMvefdeG3OpUTBpm0zjxzhzUKpT+PAPEB8A8SqUPgqqMkLBkHWxUhSm+XKCI56jRB9zjTIJbPuToMXp/IGjXvKuaOzFogQXjjKysvU3DmdwWP7WXrGfXqt5xBhxbCw7H4Gj/qI9/n/Z4+fBiI5hNs978nWU34p+tv0Lgyd1gvCJ23cAAAAASUVORK5CYII=",
  a_20k_new:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEWoUi+dZE8EAgXPYC2XNSnbll6VkpfMc0pwUFefVC5qMDJmMzWdj2lkIiZvTDtwLTGOMiySV1hsUlqc2uKQVFCgUS+NNy2pUjjkjDhkTlVub5llNU1cJFbz15mTYFOFdJNbM01bOEhaSVP2GgHHVysiJlqQr8emJxgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBrGn/AAAAKHRSTlP2+AP77/v7+vCe9qz4HvBeZiUd/Vwxo2L9nf3zJv6p/luuaxKuFf0XzTiEAwAAA2NJREFUeNpdlYmS4joMRa8k29kJCQlhbZYG+v//8F050zNVTxQxcY6vFssBne736tb0x5FDx++offN8KvTYPO+8w6C8eZtd+LgLKEddjYvteFSMG5R31SFgIvgD40V7swzWvQ7fCCZH1Wcp5VO1MqsIzhAH91SE6h1Ap2MwEGzqjdA1AmyAbmN86bcGKr51rJ3TnuBDQY6LF5jZ8gfUi4MgcUallHfXY12KPHXvYMUFMdpWtwTPb23OJwEcpOu+3kAeGgKIQqtYFC+COetafPodCJbab+i69Agd7FEU0bRx19N8Zi6ydBlEUwvBObhrwx5CEHxkUnW1RMG0dVAI1ptSWEUGB4KuODqI6lLHawwZNCyuuCFYXK8EA0T+gm/B9SoraASZjIwUjNFBDjbkRy+VeEVcVhANkxG5gNF4cAQLB2twoyRGkS3B2mx21yIdYlGs4LVw18ig27ZnPLAf30GC4Z9rs1wQe3V0goKKHGx+1HUN4b4fYk6GngmygAS9BA4aQTxqD4RRBfcXUFB39qTtNYSan6UPlPBkHBwdC6trIUhFvC61W79llgVB/IKZFbMCXTh4Mpc8lcH4C7LgNOCL3WKigf5jNbiuLVuGyPsmFwt/Cv7FfhFRHJhb1a1gb/5oORIsJHO83bMNYtTcIb+KPRcd0B8LB/UPGNgG16gbupA1xtD35rx+FayuaFGsQUYPRKWlVXp2uw/xcDjYe2JkPHh5twSBLPscHnWl5Yl2nxkxMCwCOZV6PJ3Kmo3OO54qL6hVnaRzSv0sQU7yPXHYEURZUiXEm2R9alb8lilNc0uX6YdguxP9SjglQRWTnzuRlFJ1ESphmqO0OwfbtGsJflLLoyAZLCUxmU5uH5Fp5qpd+n7mgeDOEwhIPmwIxuoCSac0dfgfmD7M2jxD+Ong68BjS1u+joQg0P6CrlX48bhsvMQV7HZz19EyKNZ6jNgJtQq/iDrIOiJl8GBUJphLfMTH68Nzw71x0HdG0u10g9e75MLWXwNatZ9Uem9YvIrvtWedPrdP6gnmyOn62mqFXcscCnguyB2+H1jv0rXc5qPkvSYoBC3317qFe15ugvu6Vpd1qCxJ/tXs0WuomwZ3fZzPj8eFc82+eW+loekSHl6Qash/BBP0nw3rXDf+nZiG/wCPSDBmwSpeAQAAAABJRU5ErkJggg==",};
// 主角初始: 负债开局(星露谷风: 从店员做起)
function defaultProtagonist(){
  return {
    name:"小满",
    gender:"male",     // 主角性别: male/female (开局可选), 决定可恋池
    energy:100, maxEnergy:100,
    mood:50, hunger:100,
    job:"cafe", jobDays:0,
    assets:{},       // {bike:true, moped:true, coat:true, suit:true, room:true, apart:true}
    romance:null,   // 恋爱对象 key, null=单身
    romanceLevel:0, // 0-10, 10=结婚
    friends:{},     // {lisa:3, ken:1, ...}
  };
}
// 设主角性别(仅开局可改; 已存档后锁定, 避免破坏恋爱数据)
function setGender(g){
  const p=state.protagonist;
  if(!p.genderChosen){ p.gender=(g==="female"?"female":"male"); p.genderChosen=true; }
  return p.gender;
}
const state = {
  money: -3000,
  day: 1,
  dayTime: 0,
  unlockPhase: 0,             // 0=初始(2 列), 1=一街, 2=二街, 3=三街, 4=四街
  map: 0,                      // 当前所在地图 id(0=主街道, 1=商业街, 2=大学城), 旧档未存时默认 0
  eventToday: null,          // key
  peakMoney: -3000,
  maxLevelReached: 0,
  totalCustomers: 0,
  negativeDays: 0,           // 连续负结余计数
  bankrupt: false,
  achievements: [],
  payGrade: 1,              // 招聘薪水档位 0=节俭 / 1=正常 / 2=优厚 / 3=顶配
  investLevel: 0,           // 增长基金等级 0..5
  manager: false,           // 是否已雇经理(每日自动帮最弱店铺升级)
  decorations: {},          // 装饰: {slotIndex: true} 已购装饰的铺位索引
  // ---- 宏观经济系统(模拟现实经济规律: 通胀/就业/地价/借贷) ----
  inflation: 1.0,          // 通胀指数(1.0=无通胀, 1.2=物价+20%): 越高维护/进货成本越高
  landPriceMult: 1.0,      // 地价指数(随通胀与事件波动): 影响扩建成本
  employment: 0.0,         // 小镇就业率 0..1: 越高商场效益越好(消费力)
  // ---- 银行借贷系统 ----
  loans: [],               // [{principal, balance, dailyInterest, day, shop, bad}]
  // ---- 进货定价系统(可选采购商品并自定售价) ----
  priceIndex: 1.0,         // 采购价指数(被通胀推高): 进货成本 = 基准 × priceIndex
  shopPrices: {},          // {slotIndex: {goods, price}} 玩家为铺位选定的商品与售价
  slots: Array.from({length:TOTAL_SLOTS}, () => ({
    built:false, type:null, level:0, customersToday:0, revenueToday:0
  })),
  // ---- 主角系统(星露谷风: 从店员做起) ----
  protagonist: defaultProtagonist(),
  // ---- 市场/股市/新闻系统 ----
  marketMult:{coffee:1,retail:1,food:1,service:1,fun:1,tech:1},
  marketHist:{coffee:[1],retail:[1],food:[1],service:[1],fun:[1],tech:[1]},
  stocks:{coffee:100,retail:100,food:120,med:150,tech:80,bank:200},
  stockHoldings:{},
  stockHist:{coffee:[100],retail:[100],food:[120],med:[150],tech:[80],bank:[200]},
  news:[],
};

// 当前顾客池(顾客小图标同场上限):随阶段 8/12/16/20/24,有硬上限
function crowdCap(){ return [CROWD_CAP_PHASE0, 12, 16, 20, 24][Math.min(4, state.unlockPhase)]; }
// 是否处于税收减免日(税率减半)
function taxBreakActive(){ return state.eventToday === "taxbreak"; }

// ---- 主角系统: 打工/消费/恋爱/资产 ----
const WORK_JOBS = [
  { key:"cafe",   name:"咖啡厅店员",   emoji:"☕", energyCost:20, pay:350,  moodDelta:5,  unlockReq:null, desc:"最轻松的起点, 赚点零花" },
  { key:"super",  name:"超市理货员",   emoji:"🛒", energyCost:30, pay:600,  moodDelta:3,  unlockReq:{jobDays:3}, desc:"搬货理货, 比端盘子累点但钱多" },
  { key:"courier",name:"外卖骑手",     emoji:"🛵", energyCost:40, pay:900,  moodDelta:-3, unlockReq:{jobDays:5}, desc:"跑单赚快钱, 有点奔波" },
  { key:"it",     name:"数码店柜员",   emoji:"💻", energyCost:50, pay:1400, moodDelta:2,  unlockReq:{jobDays:8, shopsBuilt:["IT"]}, desc:"卖数码, 需开过 1 家数码体验店" },
  { key:"artist", name:"画廊讲解员",   emoji:"🎨", energyCost:60, pay:2200, moodDelta:4,  unlockReq:{jobDays:12, shopsBuilt:["Art"]}, desc:"艺术讲解, 需开过 1 家艺术画廊" },
  { key:"bank",   name:"银行大堂经理", emoji:"🏦", energyCost:80, pay:3800, moodDelta:-5, unlockReq:{jobDays:18, investLevel:2}, desc:"银行大堂, 需投资 Lv≥2" },
];
const CONSUMABLES = [
  { key:"coffee", cat:"food", name:"路边摊咖啡", price:50,   desc:"饱食 +20 / 心情 +5" },
  { key:"meal",   cat:"food", name:"工作餐",     price:150,  desc:"饱食 +60 / 心情 +10" },
  { key:"bike",   cat:"vehicle", name:"自行车",  price:3000, desc:"体力上限 +10(通勤)" },
  { key:"moped",  cat:"vehicle", name:"电动摩托", price:12000,desc:"体力上限 +20" },
  { key:"coat",   cat:"cloth",  name:"冬季大衣", price:2000, desc:"心情 +5(永久)" },
  { key:"suit",   cat:"cloth",  name:"西装",     price:8000, desc:"打工收益 +10%(永久)" },
  { key:"room",   cat:"house",  name:"合租单间", price:30000,desc:"睡觉恢复 +20%" },
  { key:"apart",  cat:"house",  name:"小公寓",   price:120000,desc:"睡觉恢复 +40% + 心情上限 +10" },
];
// 恋爱角色池: 主角可选性别(开局), 男→可恋女性池, 女→可恋男性池
// 每角色 7 章剧情, 按好感度/恋爱进度逐级解锁(不同好感度 → 不同剧情):
//   章0 初识(好感≥1) / 章1 熟络(好感≥3) / 章2 心绪(好感≥5, 表白前置)
//   章3 告白(恋爱进度≥1) / 章4 甜蜜(进度≥4) / 章5 情深(进度≥7) / 章6 婚约(进度≥10)
const STORY_LABELS = ["初识","熟络","心绪","告白","甜蜜","情深","婚约"];
const STORY_UNLOCK = [
  {need:"aff", v:1,  hint:"好感 ≥1"},
  {need:"aff", v:3,  hint:"好感 ≥3"},
  {need:"aff", v:5,  hint:"好感 ≥5"},
  {need:"rom", v:1,  hint:"恋爱后·进度 ≥1"},
  {need:"rom", v:4,  hint:"进度 ≥4"},
  {need:"rom", v:7,  hint:"进度 ≥7"},
  {need:"rom", v:10, hint:"进度满 10(结婚)"},
];
const ROMANCE_NPCS = {
  // 女性池(男主角可恋)
  lisa:  { key:"lisa",  name:"莉莎",   emoji:"🎨", gender:"female", desc:"咖啡店常客·插画师, 爱聊艺术",
    story:[ "你在咖啡店给她带了杯热拿铁, 她翻着速写本抬头一笑:'你常来吧?'",
            "你们聊到打烊, 她画了张商场的剪影, 画里也画了你。",
            "她把一张围裙店主的涂鸦贴在小黑板上, 旁边写:'我们的主角'。",
            "表白夜她放下画笔:'从明天起, 你就是我的主角。'",
            "约会日你们去画廊看新展, 你们俩同时指着同一幅画笑了。",
            "她画完长卷《老镇商场》, 拿着钥匙的主角是你。",
            "婚礼背景是她的新画: 你俩并肩站在商场门口。" ] },
  mia:   { key:"mia",   name:"小夏",   emoji:"📷", gender:"female", desc:"大学城学生·摄影师, 元气满满",
    story:[ "她举着相机在你背后'咔嚓'一张:'抓到你了——最帅的店主!'",
            "她教你调相机, 你说'学不会', 她憋笑:'再给你拍一百张。'",
            "她送你一张洗出来的照片: '我最喜欢的那张——你回头对我笑。'",
            "毕业合照那天她站到你身边:'这张照片, 主角得是你。'",
            "约会去天台, 她拍下商场的灯火, 给相册命名'你的店'。",
            "她的摄影集初稿: 第一页是你, 最后一页是空白, 写着'未完待续'。",
            "婚礼上她既是宾客又是摄影师:'这辈子最重要的照片, 我亲手拍了。'" ] },
  yuki:  { key:"yuki",  name:"雪子",   emoji:"📈", gender:"female", desc:"银行女经理·干练温柔, 懂经营",
    story:[ "她审完你的报表挑眉:'敢欠着债来谈投资, 勇气可嘉。'",
            "你们对账到打烊, 她递来咖啡:'生意和感情, 都要细水长流。'",
            "她把一枚戒指放进合同袋:'这是无息定金——算我们第一次'对赌'。'",
            "她把合同袋推过来:'从今天起, 你是我最重要的长期项目。'",
            "约会去攀岩馆, 她笑着说'登顶的风景才配得上这段关系'。",
            "她给你们开了个联名账户: '密码是我们第一天见面的日期。'",
            "婚礼致辞她只说一句:'我这辈子最赚的投资, 不会亏。'" ] },
  sora:  { key:"sora",  name:"小春",   emoji:"🌿", gender:"female", desc:"花店女孩·温柔爱笑, 爱养花",
    story:[ "她送你一枝白色洋桔梗:'给刚接手商场的你, 叫它重新热闹起来。'",
            "你们一起给花浇水, 她教你认哪株花'记得水'。",
            "她在屋顶种下一株风信子:'等它开花, 就像我们的故事。'",
            "她捧着一束风信子: '花开了, 我们也是。'",
            "约会你们绕着花店走, 她给每朵花都起了名字, 最好看的那朵以你命名。",
            "她做了一本干花册, 一页一次约会: '这样我们就不会忘记哪一天我们笑了。'",
            "婚礼花艺全是你俩一起养大的花: '每一朵, 都浇过我们的回忆。'" ] },
  // 男性池(女主角可恋)
  ken:   { key:"ken",   name:"凯恩",   emoji:"🔧", gender:"male", desc:"商场老员工·热心肠, 经验丰富(20多岁的踏实后辈)",
    story:[ "他拍你肩膀:'伙计, 这商场交给你, 我跟着你干。'",
            "你们通宵盘货, 他教你认每一批货的来路, 你头一挨在他胳膊上睡着了。",
            "他把工牌别在你胸前:'当年老板把它给我, 如今轮到你了。'",
            "他把工作牌递给你:'从今天起, 你是老板, 我是你一辈子的员工。'",
            "你们一起拉开店门帘, 他讲商场的老故事:'你第一次进来问路的那天, 我就没忘。'",
            "他教你开铺仪式:'老店传下去, 才算真的活着。'",
            "婚礼上他是证婚人:'这次我不做员工, 我做你的见证人。'" ] },
  haruto:{ key:"haruto",name:"晴人",   emoji:"🎸", gender:"male", desc:"商场驻场乐手·银发少年, 文艺",
    story:[ "他在收银台弹你爱听的歌, 弹完挠头:'这首送新店主。'",
            "你们听黑胶到深夜, 他跟着哼, 旋律里好像藏着你的名字。",
            "他给你一张手写的谱:'这首歌只给你, 别给别人听。'",
            "他把谱子递给你:'旋律以你命名——从今天起, 你是我的主角。'",
            "你们在商场办了场小型演出, 最后一首他唱给你。",
            "他谱了一首《商场圆舞曲》:'它每被弹一次, 就是我想起你一次。'",
            "婚礼用那首圆舞曲开场:'终章, 我只写给我们俩。'" ] },
  rei:   { key:"rei",   name:"烈",     emoji:"⚡", gender:"male", desc:"健身教练·阳光热血, 爱运动",
    story:[ "他把你'拎'去做深蹲:'要管大商场, 先有体力!'",
            "你们约着晨跑, 他陪你跑到天亮, 你靠在他背上:'下次换我带你。'",
            "他递给你一条运动手环:'表白的日子戴它——看到底。'",
            "他单膝跪地, 手里是枚运动型戒指:'我的体力, 给你用到老。'",
            "你们去攀岩, 他在下面接住你:'以后你就是我的人生安全员。'",
            "你们一起跑完人生第一场半马, 他在终点等你:'我们一个都没落下。'",
            "婚礼办成接力赛: '你是我的下一棒, 我们一直跑下去。'" ] },
  shiro: { key:"shiro", name:"雪彦",   emoji:"📖", gender:"male", desc:"书店店长·知性内敛, 爱读书",
    story:[ "他在收银台给你推了一本《商业与诗》:'你的商场, 需要一点浪漫。'",
            "你们在书店角落对坐到闭店, 他念了一句诗, 你听出了告白。",
            "他把一枚书签夹进书里递给你:'挑给你读的诗, 夹在中间, 别弄丢。'",
            "他捧着一本手抄诗集:'每一页, 都是我想对你说的话。'",
            "你们共读一整本书, 他在扉页写下日期:'故事开始的那天。'",
            "他送你一本绝版书, 扉页手写着:'我们的第一版。'",
            "婚礼誓词是那本书的尾章:'这本书的结局, 我想和你一起写完。'" ] },
};
// 各角色剧情解锁状态(7 章): 好感章节按 friends[key], 恋爱章节按 romanceLevel
function romanceUnlocks(key){
  const p=state.protagonist; const npc=ROMANCE_NPCS[key]; if(!npc) return [];
  const aff=p.friends[key]||0; const inRom=p.romance===key; const lv=p.romanceLevel||0;
  return STORY_UNLOCK.map((u,i)=>{
    let unlocked;
    if(u.need==="aff") unlocked = aff>=u.v;
    else unlocked = inRom && lv>=u.v;
    return { i, text:npc.story[i], label:STORY_LABELS[i], hint:u.hint, unlocked };
  });
}
// 取某性别主角的可恋池
function romancePool(){
  const g=state.protagonist.gender;
  return Object.values(ROMANCE_NPCS).filter(n=> n.gender===(g==="male"?"female":"male"));
}
// 体力上限(基础 100 + 载具 + 房子 + 健身卡 +15)
function protagonistMaxEnergy(){
  const p=state.protagonist;
  let m=100;
  if(p.assets.bike) m+=10;
  if(p.assets.moped) m+=20;
  if(p.assets.gym) m+=15;
  return m;
}
// 打工收益(心情 + 熟练度 + 西装 + 投资课程)
function workJobPay(jobKey){
  const j=WORK_JOBS.find(x=>x.key===jobKey); if(!j) return 0;
  const p=state.protagonist;
  const moodMult=1 + (p.mood-50)/100*0.3; // 心情 50=1.0, 0=0.85, 100=1.15
  const skillMult=1 + p.jobDays*0.05;
  const suitMult=p.assets.suit?1.1:1;
  const courseMult=p.assets.icourse?1.05:1;
  return Math.round(j.pay*moodMult*skillMult*suitMult*courseMult);
}
// 某岗位是否已解锁(gig 岗位=接私活, 每日限 1 次, 由 state.protagonist.sideGigDay 控制)
function _jobUnlockedBase(j){
  if(!j.unlockReq) return true;
  const p=state.protagonist;
  if(j.unlockReq.jobDays && p.jobDays<j.unlockReq.jobDays) return false;
  if(j.unlockReq.investLevel && (state.investLevel||0)<j.unlockReq.investLevel) return false;
  if(j.unlockReq.shopsBuilt){
    for(const k of j.unlockReq.shopsBuilt){
      if(!state.slots.some(s=>s.built&&s.type===k)) return false;
    }
  }
  return true;
}
function jobUnlocked(j){
  if(!j) return false;
  if(j.gig) return !(state.protagonist.sideGigDay===state.day);
  return _jobUnlockedBase(j);
}
// 执行一次打工: 扣体力, 加钱, 加熟练度, 改心情; 体力不足返回 "energy"
function doWork(jobKey){
  const p=state.protagonist;
  const j=WORK_JOBS.find(x=>x.key===jobKey); if(!j||!jobUnlocked(j)) return false;
  if(p.energy<j.energyCost) return "energy";
  p.energy-=j.energyCost;
  p.mood=Math.max(0,Math.min(100,p.mood+j.moodDelta));
  const pay=workJobPay(jobKey);
  state.money+=pay; state.money=Math.round(state.money);
  p.jobDays++; p.job=jobKey;
  if(state.money>state.peakMoney) state.peakMoney=state.money;
  return pay;
}
// 消费: 食物(饱食/心情) / 载具·衣服·房子(永久资产)
function buyConsumable(key){
  const p=state.protagonist;
  const c=CONSUMABLES.find(x=>x.key===key); if(!c) return false;
  if(c.cat==="food"){
    if(state.money<c.price) return "money";
    state.money-=c.price; state.money=Math.round(state.money);
    p.hunger=Math.min(100, p.hunger+(key==="coffee"?20:60));
    p.mood=Math.min(100, p.mood+(key==="coffee"?5:10));
    return true;
  }
  if(p.assets[key]) return "owned";
  if(state.money<c.price) return "money";
  state.money-=c.price; state.money=Math.round(state.money);
  p.assets[key]=true;
  if(key==="coat") p.mood=Math.min(100,p.mood+5);
  return true;
}
// 送礼给 NPC(好感 +1), 需 ¥50
function giftToNPC(key){
  const p=state.protagonist;
  const npc=ROMANCE_NPCS[key]; if(!npc) return false;
  if(state.money<50) return "money";
  state.money-=50; state.money=Math.round(state.money);
  p.friends[key]=Math.min(10,(p.friends[key]||0)+1);
  return p.friends[key];
}
// 表白: 好感 ≥5 才可
function proposeTo(key){
  const p=state.protagonist;
  const npc=ROMANCE_NPCS[key]; if(!npc) return "unknown";
  // 性别限制: 只能与可恋池角色恋爱
  const pool=romancePool();
  if(!pool.some(n=>n.key===key)) return "wrongpool";
  if(p.romance===key) return "already";
  if((p.friends[key]||0)<5) return "low";
  p.romance=key; p.romanceLevel=1;
  return true;
}
// 取某角色「当前已解锁的最新章节」(兼容旧调用)
function romanceStory(key){
  const npc=ROMANCE_NPCS[key]; if(!npc) return null;
  const ups=romanceUnlocks(key);
  let latest=null;
  for(const u of ups){ if(u.unlocked) latest=u; }
  return latest?{ npc, stage:latest.i, text:latest.text, label:latest.label } : null;
}
// ============ 恋爱 CG 事件(视觉小说风) ============
// 8 角色 × 3 关键章 CG: s0=心绪(章 2, 好感≥5) / s1=告白(章 3, 恋爱≥1) / s2=婚约(章 6, 进度=10)
const ROMANCE_CGS = {
  lisa:  [{s:0,stage:2,title:"咖啡与速写本"},{s:1,stage:3,title:"画布前的告白"},{s:2,stage:6,title:"婚礼·永远的主角"}],
  mia:   [{s:0,stage:2,title:"屋顶的极坐标"},{s:1,stage:3,title:"最重要的一张照片"},{s:2,stage:6,title:"快门声里的誓言"}],
  yuki:  [{s:0,stage:2,title:"合同袋里的戒指"},{s:1,stage:3,title:"花园里的长期项目"},{s:2,stage:6,title:"永不亏损的投资"}],
  sora:  [{s:0,stage:2,title:"洋桔梗"},{s:1,stage:3,title:"屋顶花园的风信子"},{s:2,stage:6,title:"花语誓言"}],
  ken:   [{s:0,stage:2,title:"老仓库的账本"},{s:1,stage:3,title:"红色缎带的工作牌"},{s:2,stage:6,title:"证婚人"}],
  haruto:[{s:0,stage:2,title:"手写的乐谱"},{s:1,stage:3,title:"只唱给你听"},{s:2,stage:6,title:"圆舞曲终章"}],
  rei:   [{s:0,stage:2,title:"运动手环"},{s:1,stage:3,title:"攀岩墙上的安全员"},{s:2,stage:6,title:"接力赛婚礼"}],
  shiro: [{s:0,stage:2,title:"书签与诗"},{s:1,stage:3,title:"手抄诗集"},{s:2,stage:6,title:"书的尾章"}],
};
// 已解锁 CG 集合: 按角色存 [s 编号]
function cgUnlocked(npcKey,sIdx){
  const p=state.protagonist; const c=ROMANCE_CGS[npcKey]&&ROMANCE_CGS[npcKey][sIdx]; if(!c) return false;
  const aff=p.friends[npcKey]||0; const inRom=p.romance===npcKey; const lv=p.romanceLevel||0;
  if(c.s===0) return aff>=STORY_UNLOCK[2].v;      // 心绪章: 好感 5
  if(c.s===1) return inRom&&lv>=STORY_UNLOCK[3].v; // 告白章: 进度 1
  return inRom&&lv>=STORY_UNLOCK[6].v;              // 婚约章: 进度 10
}
function cgsOf(npcKey){
  const list=ROMANCE_CGS[npcKey]||[];
  return list.map((c,i)=>({ ...c, key:npcKey, idx:i, unlocked:cgUnlocked(npcKey,i), art:(window.ART_GEN?window.ART_GEN[npcKey+'_s'+c.s]:'') }));
}
function allCGs(){
  const out=[];
  for(const k of Object.keys(ROMANCE_CGS)) out.push(...cgsOf(k));
  return out;
}
function cgCount(){
  let u=0,t=0;
  for(const c of allCGs()){ t++; if(c.unlocked) u++; }
  return {u,t};
}
// 取某 CG 的「事件文本」(对话/旁白), 按 7 章当前解锁章取
function cgEventText(npcKey,sIdx){
  const c=ROMANCE_CGS[npcKey]&&ROMANCE_CGS[npcKey][sIdx]; if(!c) return '';
  const ups=romanceUnlocks(npcKey);
  const beat=ups[c.stage];
  return beat?beat.text:'';
}
// 自动 CG 事件: 检测「新解锁的关键 CG」(跨天/送礼/表白后调用), 返回待弹 CG 列表
// 用 p.cgSeen {npcKey_sIdx:true} 记录已弹过, 防止重复
function cgNewEvents(){
  const p=state.protagonist;
  if(!p.cgSeen||typeof p.cgSeen!=='object') p.cgSeen={};
  const out=[];
  for(const npcKey of Object.keys(ROMANCE_CGS)){
    ROMANCE_CGS[npcKey].forEach((c,i)=>{
      const id=npcKey+'_s'+i;
      if(!p.cgSeen[id] && cgUnlocked(npcKey,i)) out.push({npcKey,sIdx:i});
    });
  }
  return out;
}
function cgMarkSeen(npcKey,sIdx){
  const p=state.protagonist;
  if(!p.cgSeen||typeof p.cgSeen!=='object') p.cgSeen={};
  p.cgSeen[npcKey+'_s'+sIdx]=true;
}
// ============ 恋爱 CG 事件 end ============
// 每日主角结算: 体力重置 + 心情/饱食衰减 + 恋爱对象 buff
function protagonistDailySettle(){
  const p=state.protagonist;
  p.maxEnergy=protagonistMaxEnergy();
  p.energy=p.maxEnergy; // 睡觉回满
  p.mood=Math.max(0,p.mood-5);
  p.hunger=Math.max(0,p.hunger-20);
  if(p.romance){
    p.mood=Math.min(100,p.mood+10);
    p.romanceLevel=Math.min(10,p.romanceLevel+1);
    if(p.romanceLevel>=10){ p.mood=Math.min(100,p.mood+10); p.maxEnergy+=0; } // 结婚 buff(永久 +10 心情已在 mood 里)
  }
}

// ---- 成就 ----
const ACHIEVEMENTS = [
  { id:"a_first",  name:"开张营业", desc:"建起第 1 家铺位",     check:s=>s.slots.some(x=>x.built) },
  { id:"a_ten",    name:"百货商场", desc:"同时开满 10 家铺位",   check:s=>s.slots.filter(x=>x.built).length>=10 },
  { id:"a_maxed",  name:"旗舰店铺", desc:"把任意铺位升到 Lv5",   check:s=>s.slots.some(x=>x.built&&x.level>=5) },
  { id:"a_expand1",name:"城市地标", desc:"完成一街扩建",          check:s=>s.unlockPhase>=1 },
  { id:"a_expand2",name:"二街通幽", desc:"完成二街扩建",          check:s=>s.unlockPhase>=2 },
  { id:"a_expand3",name:"三街通达", desc:"完成三街扩建",          check:s=>s.unlockPhase>=3 },
  { id:"a_expand4",name:"四街帝国", desc:"完成四街扩建",          check:s=>s.unlockPhase>=4 },
  { id:"a_50k",    name:"小有名气", desc:"资金达到 ¥50,000",     check:s=>s.peakMoney>=50000 },
  { id:"a_100k",   name:"扩张成功", desc:"资金达到 ¥100,000",    check:s=>s.peakMoney>=100000 },
  { id:"a_500k",   name:"商业帝国", desc:"资金达到 ¥500,000",    check:s=>s.peakMoney>=500000 },
  { id:"a_10day",  name:"长期经营", desc:"经营满 10 天",         check:s=>s.day>=11 },
  { id:"a_30day",  name:"铁腕操盘", desc:"经营满 30 天",         check:s=>s.day>=31 },
  { id:"a_20k",    name:"万客盈门", desc:"累计接待 20,000 顾客", check:s=>s.totalCustomers>=20000 },
  { id:"a_50k_c",  name:"人潮汹涌", desc:"累计接待 50,000 顾客", check:s=>s.totalCustomers>=50000 },
  { id:"a_all9",   name:"全业态",  desc:"每种业态都开过一家",    check:s=>{ const seen=new Set(); for(const sl of s.slots) if(sl.built) seen.add(sl.type); return seen.size>=SHOP_ORDER.length; } },
  { id:"a_lv3",    name:"中流砥柱", desc:"同时拥有 3 家 Lv3+",  check:s=>s.slots.filter(x=>x.built&&x.level>=3).length>=3 },
   { id:"a_synergy",name:"黄金搭档", desc:"激活任意业态组合协同", check:s=>activeSynergies().length>0 },
   { id:"a_allshop",name:"全能百货", desc:"同时激活 3 种组合协同", check:s=>activeSynergies().length>=3 },
   { id:"a_5syn",   name:"商业交响", desc:"同时激活 5 种组合协同", check:s=>activeSynergies().length>=5 },
   { id:"a_chain",  name:"连锁巨头", desc:"同业态开满 3 家(享连锁 +20%)", check:s=>{ const c={}; for(const sl of s.slots) if(sl.built) c[sl.type]=(c[sl.type]||0)+1; return Object.values(c).some(n=>n>=3); } },
  { id:"a_invest3",name:"资本运作", desc:"投资增长基金到 3 级",   check:s=>(s.investLevel||0)>=3 },
  { id:"a_20k_new",name:"新锐商家", desc:"开过 6 种不同业态",      check:s=>{ const seen=new Set(); for(const sl of s.slots) if(sl.built) seen.add(sl.type); return seen.size>=6; } },
  { id:"a_manager",name:"运筹帷幄", desc:"雇佣职业经理",          check:s=>s.manager===true },
  { id:"a_decor",  name:"精雕细琢", desc:"为一家铺位购买装饰",    check:s=>Object.keys(s.decorations||{}).length>=1 },
  { id:"a_sat80",  name:"口碑爆棚", desc:"顾客满意度稳定到 80%+",  check:s=>(s.satisfaction||0)>=0.80 },
  { id:"a_loan",   name:"资本杠杆", desc:"从银行借到第一笔贷款",    check:s=>(s.loans||[]).length>0 },
  { id:"a_macro",  name:"经济操盘手", desc:"就业率提升到 50%+",     check:s=>(s.employment||0)>=0.5 },
  { id:"a_pricer", name:"精算师",   desc:"为一家铺位自定义商品定价", check:s=>Object.keys(s.shopPrices||{}).length>=1 },
];
function checkAchievements(){
  const newly=[];
  for(const a of ACHIEVEMENTS){
    if(state.achievements.includes(a.id)) continue;
    if(a.check(state)){ state.achievements.push(a.id); newly.push(a); }
  }
  return newly;
}

// 全局铺位索引(跨地图): 当前地图局部 (x,y) → state.slots 的绝对下标
// 主街道 4×3(0..11); 商业街 4×2(12..19); 大学城 3×2(20..25)
function slotGlobalIndex(x,y){
  const m=curMap();
  const [start]=mapSlotRange(m);
  const mapW=(m===0?GRID_W:m===1?4:3), mapH=(m===0?GRID_H:2);
  if(x<0||y<0||x>=mapW||y>=mapH) return -1;
  return start+y*mapW+x;
}
// ---- 槽位: 不同地图用不同网格 ----
// 主街道 4×3(12 铺位); 商业街 4×2(8 铺位); 大学城 3×2(6 铺位)
function slotAt(x,y){
  const m=curMap();
  const mapW=(m===0?GRID_W:m===1?4:3), mapH=(m===0?GRID_H:2);
  if(x<0||y<0||x>=mapW||y>=mapH) return null;
  const [start]=mapSlotRange(m);
  const i=start+y*mapW+x;
  return (i<0||i>=state.slots.length)?null:state.slots[i];
}
// 当前地图的网格尺寸(供 UI 渲染)
function curMapGrid(){
  const m=curMap();
  if(m===0) return [GRID_W,GRID_H];
  if(m===1) return [4,2];
  return [3,2];
}
// 当前开放列数: 主街道随阶段开放(2..6 列); 新地图(商业街/大学城)全列可用
function openCols(){
  const m=curMap();
  if(m===0) return 2 + state.unlockPhase;
  return (m===1?4:3); // 商业街 4 列 / 大学城 3 列, 全开放
}
function isCellLocked(x){
  // 主街道: 锁到 openCols() 之前; 新地图全列可用
  if(curMap()!==0) return false;
  return x >= openCols();
}
// 下一解锁阶段的成本(已完成=0, 被地价指数/通胀推高)
function nextUnlockCost(){
  if(state.unlockPhase >= UNLOCK_PHASES.length) return 0;
  // 地价事件(空地降价日)会拉低, 否则地价随通胀上涨
  return Math.round(UNLOCK_PHASES[state.unlockPhase].cost * state.landPriceMult);
}

// ---- 客流 ----
function attractivity(){
  let s=20;
  for(const sl of state.slots){
    if(sl.built){ const d=SHOPS[sl.type]; if(d) s += d.attract * sl.level; }
  }
  return s;
}
function dailyCustomers(){ return Math.max(0, Math.round(Math.sqrt(attractivity())*40)); }

function eventWobble(){
  if(!state.eventToday) return 1;
  const e=EVENTS.find(x=>x.key===state.eventToday);
  return e ? e.wobble : 1;
}
function eventPref(){
  if(!state.eventToday) return null;
  const e=EVENTS.find(x=>x.key===state.eventToday);
  return e ? e.pref : null;
}
// ---- 顾客深化:满意度 + 回头客(回头客系数影响次日基础客流) ----
const REPURCHASE = {
  satDecay: 0.05,        // 每日满意度自然衰减 5%
  satFloor: 0.20,        // 满意度下限 20%
  repurchaseMult: 0.30,  // 回头客对次日基础客流的加成 = 满意度 × 0.30
};
// 满意度由当日服务质量(工资档位士气 + 装饰加成 + 事件 good)决定
function updateSatisfaction(){
  // 取所有已建铺位的满意度均值作为商场整体满意度
  const built=state.slots.filter(s=>s.built);
  if(!built.length){ if(state.satisfaction===undefined) state.satisfaction=1.0; return; }
  const n=built.length;
  let sum=0;
  for(const sl of built){
    let base=0.5;
    base+=Math.max(0,(sl.level-(SHOPS[sl.type]||SHOPS.Cafe).maxLevel)*-0.05);            // 等级越高满意度越高
    base+=moraleMult()*0.2;                                                // 士气 1.0~1.45 → +20%~+29%
    const idx=state.slots.indexOf(sl);
    if(hasDecor(idx)) base+=0.15;                                          // 装饰 +15%
    base+=eventWobble()>1 ? 0.1 : (eventWobble()<1 ? -0.05 : 0);           // 事件 good +10% / bad -5%
    sum+=Math.max(REPURCHASE.satFloor, Math.min(1.0, base));
  }
  const prev=state.satisfaction===undefined?1.0:state.satisfaction;
  state.satisfaction=prev+(sum/n-prev)*(1-REPURCHASE.satDecay); // 缓慢逼近
  state.satisfaction=Math.max(REPURCHASE.satFloor, Math.min(1.0, state.satisfaction));
}
function repurchaseMult(){ return (state.satisfaction===undefined?1.0:state.satisfaction) * REPURCHASE.repurchaseMult; }
// 回头客加成:叠加进 customersPerHour
function crowdWeightTotal(tag){
  const p=eventPref();
  const w=p && p[tag] ? p[tag] : 1;
  return w * (1 + repurchaseMult());
}

// ---- 银行借贷系统(开罗风): 借款利息温和, 鼓励投资扩张而非惩罚借贷 ----
const LOAN = {
  min: 10000,              // 单笔最小贷款
  max: 300000,             // 单笔最大贷款(开罗风: 提高上限, 支持大额扩张)
  rateDaily: 0.0008,       // 日利率 0.08%(≈年化 29%, 开罗风: 低利息, 借贷作为扩张工具)
  minDays: 5,             // 最短借款天数
  maxDays: 90,            // 最长借款天数(开罗风: 延长, 给扩张留时间)
  graceDays: 5,           // 到期后宽限天数, 仍不清→坏账罚息 + 移除
};
// 可借额度: 铺位总价值的 80%(不含现金, 避免"借钱还现金"自循环), 最低可借 LOAN.min
function loanAvailableMax(){
  let asset = 0;
  for(const sl of state.slots) if(sl.built){ const d=SHOPS[sl.type]; if(d) asset += d.build; }
  return Math.max(LOAN.min, Math.min(LOAN.max, Math.floor(asset*0.8)));
}
// 当前总负债(本金余额合计)
function totalDebt(){
  return state.loans.reduce((s,l)=>s+l.balance, 0);
}
// 当日债务利息总额(利息直接从资金扣, 本金不变)
function loanInt(){
  return state.loans.reduce((s,l)=>s+Math.round(l.balance*LOAN.rateDaily), 0);
}
// 每日利息总额(与 loanInt 等价, 兼容旧引用)
function dailyInterestTotal(){ return loanInt(); }
// 借款: amount(10000..max), days(5..60), 返回新贷款或 null
function takeLoan(amount, days){
  const amt = Math.max(LOAN.min, Math.min(LOAN.max, Math.floor(amount)));
  const d   = Math.max(LOAN.minDays, Math.min(LOAN.maxDays, Math.floor(days)));
  if(amt > loanAvailableMax()) return null; // 超出可贷额度(需已有资产抵押)
  state.money += amt; // 现金到账
  const loan = { principal: amt, balance: amt, day: state.day, bad: false, dueDay: state.day + d };
  state.loans.push(loan);
  return loan;
}
// 主动还款: 还某笔贷款的部分/全部(不还本金, 扣现金)
function repayLoan(idx, amount){
  const l = state.loans[idx];
  if(!l) return false;
  const pay = Math.min(l.balance, Math.floor(amount));
  if(pay<=0) return false;
  if(state.money < pay) return false;
  state.money -= pay;
  l.balance -= pay;
  // 还清则移除
  if(l.balance<=0) state.loans.splice(idx,1);
  return true;
}
// 每日债务结算: 到期检查(到期未还→逾期→再3天→坏账罚息+移除); 利息由 endDay 经 loanInt() 统一计提
function settleLoans(){
  let bankruptBad = false;
  for(let i=state.loans.length-1;i>=0;i--){
    const l=state.loans[i];
    // 到期日检查: 到期未还清 → 逾期, 再给 3 天宽限, 仍不清则坏账(罚息 50% + 移除该笔)
    if(state.day>=l.dueDay && l.balance>0){
      l.bad=true;
      if(state.day>=l.dueDay+LOAN.graceDays){
        const penalty=Math.floor(l.balance*0.5);
        state.money -= penalty;
        state.money=Math.round(state.money);
        state.loans.splice(i,1);
        bankruptBad=true;
      }
    }
  }
  return bankruptBad;
}
// 总负债占比(用于破产判定 + HUD)
function debtRatio(){
  const asset=state.money+totalDebt();
  return asset>0 ? totalDebt()/asset : 0;
}

// ---- 宏观经济系统: 通胀 / 就业率 / 地价 / 工资联动 ----
// 通胀: 每日缓慢上升, 被"事件(补贴/通缩)"拉低; 推高维护与进货成本
function updateInflation(){
  // 基础通缩压力: 经济越好(满意度/就业高)通胀越慢
  const baseGrowth=0.002; // 每日 +0.2%
  const dampen=(state.satisfaction||1)*0.0005; // 满意度高 → 通胀 -0.05%/日
  state.inflation += (baseGrowth - dampen);
  // 通胀事件: 通缩日拉回 1.0, 通胀日推高
  if(state.eventToday==="inflation") state.inflation += 0.02;
  if(state.eventToday==="deflation") state.inflation = Math.max(0.85, state.inflation-0.05);
  state.inflation = Math.max(0.85, Math.min(2.0, state.inflation)); // 区间 85%~200%
  // 物价指数(进货成本)= 通胀指数
  state.priceIndex = state.inflation;
}
// 地价: 跟随通胀, 被"空地降价"事件拉低
function updateLandPrice(){
  // 地价 = 通胀 × 就业(经济好→地价涨) × 事件修正
  let mult = state.inflation * (0.5 + (state.employment||0)*0.5);
  if(state.eventToday==="landdrop") mult *= 0.55; // 周围空地降价日: 地价 ×0.55
  if(state.eventToday==="landboom") mult *= 1.5;  // 地价暴涨日: 地价 ×1.5
  state.landPriceMult = Math.max(0.5, Math.min(2.5, mult));
}
// 就业率: 随"商场雇佣的员工数"与"发工资"变化(商场是小镇雇主)
function updateEmployment(){
  // 已建铺位数 + 工资档位 决定就业贡献
  const built=state.slots.filter(s=>s.built).length;
  const wagePressure=(state.payGrade||1)/4; // 工资越高 → 居民收入越高 → 就业意愿越高
  // 有在贷 → 扩张期就业略高(商场是雇主); 无贷 → 中性
  const loanPressure = state.loans.length>0 ? -0.05 : 0.05;
  const target = Math.min(1, built/12*0.7 + wagePressure*0.3 + loanPressure);
  // 缓慢逼近目标 + 通胀高→失业率升(通缩反之)
  const inflPressure = state.inflation>1.1 ? -0.03 : 0;
  const prev=state.employment||0;
  state.employment = prev + (target-prev)*0.3 + inflPressure;
  state.employment = Math.max(0, Math.min(1, state.employment));
}
// 经济倍率: 就业率越高, 商场客流越旺(居民有钱消费)
function economyMult(){
  // 就业 0→1 对应客流 ×0.8 ~ ×1.3
  return 0.8 + (state.employment||0)*0.5;
}
// 工资通胀联动: 通胀越高, 员工要求工资越高(实际工资被通胀侵蚀)
// 把工资成本也乘通胀, 让玩家在通胀期更痛
function wageMultInflated(){
  return wageMult() * state.inflation;
}

// ---- 经理系统:雇经理每日自动帮"最弱"(等级最低,平级取收入最低)的已建店铺升 1 级 ----
const MANAGER = { cost: 80000, desc:"¥80,000 一次性 · 每日自动帮一家最弱的已建店铺免费升 1 级" };
function managerCost(){ return MANAGER.cost; }
function hireManager(){
  if(state.manager || state.money < MANAGER.cost) return false;
  state.money -= MANAGER.cost;
  state.manager = true;
  return true;
}
// 经理每日行动:找一家最弱且可升级的已建店铺免费升 1 级
function managerAct(){
  if(!state.manager) return null;
  let target=null;
  for(const sl of state.slots){
    if(!sl.built) continue;
    const def=SHOPS[sl.type]||SHOPS.Cafe;
    if(sl.level>=def.maxLevel) continue;
    if(target===null){ target=sl; continue; }
    if(sl.level<target.level || (sl.level===target.level && sl.revenueToday<target.revenueToday)) target=sl;
  }
  if(!target) return null;
  target.level++;
  if(target.level>state.maxLevelReached) state.maxLevelReached=target.level;
  return { type:target.type, level:target.level };
}

// ---- 装饰系统:给铺位买装饰, 该铺位客流 +15%(克制, 不压垮经济) ----
const DECOR = { cost: 20000, crowdMult: 1.15, desc:"¥20,000 · 该铺位客流 +15%" };
function decorCost(){ return DECOR.cost; }
function hasDecor(i){ return !!state.decorations[i]; }
function decorMult(i){ return hasDecor(i) ? DECOR.crowdMult : 1; }
function buyDecor(i){
  const sl=state.slots[i];
  if(!sl || !sl.built || hasDecor(i)) return false;
  if(state.money < DECOR.cost) return false;
  state.money -= DECOR.cost;
  state.decorations[i]=true;
  return true;
}

// ---- 进货定价系统: 玩家为铺位选采购商品并自定售价 ----
// 每种商品有基准成本(被通胀推高)+ 建议价区间; 售价越高于成本利润率越高, 但顾客越挑剔(客流降)

// 旧 3 档通用商品(保留, 作为兜底默认)
const GOODS = [
  { key:"basic",  name:"基础货", baseCost:6,  sugMin:9,  sugMax:14, crowdPenalty:0.95, desc:"成本低, 薄利多销", model:null },
  { key:"normal", name:"常规货", baseCost:12, sugMin:18, sugMax:28, crowdPenalty:0.85, desc:"中等成本, 利润可观", model:null },
  { key:"premium",name:"精品货", baseCost:24, sugMin:40, sugMax:60, crowdPenalty:0.72, desc:"成本高, 利润厚, 客流受价格压制", model:null },
];

// 各店铺可选商品: 每店铺 2-3 种专属商品, 商品带独立模型 key(ARTX 有则渲染, 无则省略)
// cost/price 单位: 单客毛利前基准; 玩家可在 sugMin~sugMax 自定售价
const SHOP_GOODS = {
  Cafe:        [ { key:"coffee",  name:"拿铁",   cost:4,  price:12, crowdPenalty:0.95, model:"coffee"  },
                 { key:"cake",    name:"蛋糕",   cost:6,  price:18, crowdPenalty:0.90, model:"cake"    },
                 { key:"teabag",  name:"茶包",   cost:2,  price:8,  crowdPenalty:0.92, model:"teabag"  } ],
  Supermarket: [ { key:"apple",   name:"苹果",   cost:3,  price:8,  crowdPenalty:0.95, model:"apple"   },
                 { key:"rice",    name:"大米",   cost:8,  price:15, crowdPenalty:0.88, model:"rice"    },
                 { key:"milk",    name:"牛奶",   cost:5,  price:10, crowdPenalty:0.92, model:"milk"    } ],
  Gaming:      [ { key:"joystick",name:"摇杆",   cost:15, price:40, crowdPenalty:0.80, model:"joystick"},
                 { key:"token",   name:"代币",   cost:2,  price:10, crowdPenalty:0.95, model:"token"   },
                 { key:"arcade",  name:"街机卡", cost:8,  price:20, crowdPenalty:0.88, model:"arcade"  } ],
  Cinema:      [ { key:"ticket",  name:"电影票", cost:20, price:55, crowdPenalty:0.78, model:"ticket"  },
                 { key:"popcorn", name:"爆米花", cost:6,  price:18, crowdPenalty:0.92, model:"popcorn" },
                 { key:"beer",    name:"精酿",   cost:12, price:30, crowdPenalty:0.85, model:"beer"    } ],
  Food:        [ { key:"noodle",  name:"面条",   cost:8,  price:22, crowdPenalty:0.90, model:"noodle"  },
                 { key:"sushi",   name:"寿司",   cost:15, price:40, crowdPenalty:0.80, model:"sushi"   },
                 { key:"bbq",     name:"烧烤",   cost:10, price:28, crowdPenalty:0.85, model:"bbq"     } ],
  Bookstore:   [ { key:"book",    name:"小说",   cost:10, price:30, crowdPenalty:0.88, model:"book"    },
                 { key:"comic",   name:"漫画",   cost:8,  price:22, crowdPenalty:0.90, model:"comic"   },
                 { key:"pen",     name:"钢笔",   cost:15, price:40, crowdPenalty:0.82, model:"pen"     } ],
  Gym:         [ { key:"protein", name:"蛋白粉", cost:20, price:55, crowdPenalty:0.80, model:"protein" },
                 { key:"yoga",    name:"瑜伽垫", cost:12, price:35, crowdPenalty:0.85, model:"yoga"    },
                 { key:"water",   name:"矿泉水", cost:2,  price:8,  crowdPenalty:0.95, model:"water"   } ],
  Fashion:     [ { key:"dress",   name:"连衣裙", cost:30, price:90, crowdPenalty:0.75, model:"dress"   },
                 { key:"bag",     name:"手袋",   cost:25, price:80, crowdPenalty:0.78, model:"bag"     },
                 { key:"sneaker", name:"球鞋",   cost:35, price:110,crowdPenalty:0.72, model:"sneaker" } ],
  Hotel:       [ { key:"room",    name:"标间",   cost:80, price:200,crowdPenalty:0.70, model:"room"    },
                 { key:"spa",     name:"SPA",    cost:50, price:150,crowdPenalty:0.75, model:"spa"     },
                 { key:"breakfast",name:"早餐",  cost:15, price:40, crowdPenalty:0.88, model:"breakfast"} ],
  Bakery:      [ { key:"bread",   name:"面包",   cost:3,  price:9,  crowdPenalty:0.92, model:"bread"   },
                 { key:"donut",   name:"甜甜圈", cost:4,  price:12, crowdPenalty:0.90, model:"donut"   },
                 { key:"croissant",name:"可颂",  cost:5,  price:14, crowdPenalty:0.88, model:"croissant"} ],
  Pet:         [ { key:"kibble",  name:"粮",     cost:8,  price:20, crowdPenalty:0.88, model:"kibble"  },
                 { key:"toy",     name:"玩具",   cost:5,  price:15, crowdPenalty:0.90, model:"toy"     },
                 { key:"shampoo", name:"香波",   cost:10, price:25, crowdPenalty:0.85, model:"shampoo" } ],
  Pharmacy:    [ { key:"vits",    name:"维生素", cost:12, price:30, crowdPenalty:0.85, model:"vits"    },
                 { key:"cream",   name:"面霜",   cost:15, price:38, crowdPenalty:0.82, model:"cream"   },
                 { key:"syrup",   name:"糖浆",   cost:8,  price:20, crowdPenalty:0.90, model:"syrup"   } ],
  Bank:        [ { key:"fund",    name:"基金",   cost:100,price:180,crowdPenalty:0.70, model:"fund"    },
                 { key:"insure",  name:"保险",   cost:60, price:130,crowdPenalty:0.75, model:"insure"  },
                 { key:"card",    name:"卡服务", cost:20, price:60, crowdPenalty:0.85, model:"card"    } ],
  IT:          [ { key:"laptop",  name:"笔记本", cost:180,price:400,crowdPenalty:0.65, model:"laptop"  },
                 { key:"phone",   name:"手机",   cost:150,price:350,crowdPenalty:0.68, model:"phone"   },
                 { key:"drone",   name:"无人机", cost:200,price:450,crowdPenalty:0.62, model:"drone"   } ],
  Art:         [ { key:"painting",name:"画作",   cost:300,price:600,crowdPenalty:0.60, model:"painting"},
                 { key:"sculpt",  name:"雕塑",   cost:250,price:500,crowdPenalty:0.62, model:"sculpt"  },
                 { key:"print",   name:"版画",   cost:80, price:200,crowdPenalty:0.72, model:"print"   } ],
};
// 取某店铺的可选商品列表(兜底: 旧 GOODS 3 档)
function shopGoodsList(type){
  return SHOP_GOODS[type] || GOODS;
}
// 取铺位当前定价 {goods, price}; goods 是商品 key
function slotPricing(i){
  const p=state.shopPrices[i];
  if(!p) return { goods:0, price:null }; // goods=0 表示按业态默认(首商品), price=null
  return p;
}
// 取铺位当前商品对象: 优先按 goods key 在 shopGoodsList(type) 里查, 查不到兜底首商品
function slotGoods(i){
  const sl=state.slots[i];
  if(!sl) return null;
  const pr=slotPricing(i);
  const list=shopGoodsList(sl.type);
  // goods 是 key(字符串)时按 key 查; 是旧数值索引时按序查; 都查不到兜底首商品
  let g=null;
  if(typeof pr.goods==='string'){ g=list.find(x=>x.key===pr.goods)||null; }
  else if(typeof pr.goods==='number'){ g=list[pr.goods]||null; }
  return g||list[0];
}
// 设置铺位定价: goodsKey=商品 key, price=玩家定的单客售价(可选, null=按商品基准价)
function setShopPrice(i, goodsKey, price){
  const sl=state.slots[i];
  if(!sl || !sl.built) return false;
  const list=shopGoodsList(sl.type);
  const g=list.find(x=>x.key===goodsKey)||list[0];
  if(!g) return false;
  // price===null/undefined → 使用商品基准价; 否则夹到 [cost, price*1.5] 区间(防越界)
  let p;
  if(price===null || price===undefined){
    p = null; // effectivePerCustomer 会自动按商品基准价
  } else {
    p = Math.max(g.cost, Math.min(Math.floor(price), g.price*1.5));
  }
  state.shopPrices[i]={ goods:g.key, price:p };
  return true;
}
// 该铺位的实际单客售价: 玩家定价 > 商品基准价(被 REVENUE_SCALE 略压低, 提高金币获取难度)
function effectivePerCustomer(sl, i){
  const g=slotGoods(i);
  const pr=slotPricing(i);
  let per;
  if(pr.price!==null && pr.price!==undefined){
    per=pr.price; // 玩家定价直接作为单客收入
  } else {
    per=g.price; // 默认按商品基准价
  }
  return Math.round(per * REVENUE_SCALE);
}
// 定价对客流的影响: 定价高于商品基准价 30% 以上会压低客流
function priceCrowdFactor(i){
  const g=slotGoods(i);
  const pr=slotPricing(i);
  if(pr.price===null) return 1;
  let factor=g.crowdPenalty;
  if(pr.price>g.price*1.3) factor *= Math.max(0.5, 1-(pr.price-g.price*1.3)/(g.price*0.5));
  return factor;
}
// 进货成本: 商品成本 × 物价指数(通胀) × 市场类别倍率, 每日从收入里扣(被 PROCUREMENT_SCALE 放大)
// 市场系统(商品类别价格波动): 6 类, 每 3 天 roll 一次, 影响进货成本
const MARKET_CATS = [
  { key:"coffee", name:"咖啡原料", tag:"轻餐饮" },
  { key:"retail", name:"零售商品", tag:"零售" },
  { key:"food",   name:"餐饮原料", tag:"餐饮" },
  { key:"service",name:"服务耗材", tag:"服务" },
  { key:"fun",    name:"娱乐设备", tag:"娱乐" },
  { key:"tech",   name:"科技产品", tag:"科技" },
];
// 铺位 tag → 商品类别
function marketCatOfShopTag(tag){
  const t=String(tag||'');
  if(t==='轻餐饮') return 'coffee';
  if(t==='餐饮') return 'food';
  if(t==='零售'||t==='运动'||t==='文化'||t==='住宿'||t==='文教') return 'retail';
  if(t==='服务'||t==='金融') return 'service';
  if(t==='娱乐') return 'fun';
  if(t==='科技') return 'tech';
  return 'retail';
}
// 铺位的商品类别倍率(未初始化时默认 1)
function shopMarketMult(sl){
  if(!sl||!sl.built) return 1;
  const def=SHOPS[sl.type]||{};
  return (state.marketMult||{})[marketCatOfShopTag(def.tag)] || 1;
}
// 初始化市场系统(旧档兼容: 缺失则补默认)
function initMarket(){
  if(!state.marketMult || typeof state.marketMult!=='object') state.marketMult={};
  for(const c of MARKET_CATS){
    if(typeof state.marketMult[c.key]!=='number' || state.marketMult[c.key]<=0) state.marketMult[c.key]=1.0;
  }
  if(!Array.isArray(state.marketHist)) state.marketHist={};
  for(const c of MARKET_CATS){
    if(!Array.isArray(state.marketHist[c.key])) state.marketHist[c.key]=[1.0];
  }
}
// 市场波动: 每 3 天触发; 每类 ±20%~±60% 随机冲击 + 向 1.0 回归 + 通胀漂移
function marketRoll(){
  initMarket();
  for(const c of MARKET_CATS){
    const cur=state.marketMult[c.key];
    const drift=(state.inflation-1)*0.05;
    const shock=(Math.random()*1.2-0.6);
    let next=cur + (1.0-cur)*0.25 + shock + drift;
    next=Math.max(0.4, Math.min(2.0, next));
    state.marketMult[c.key]=Math.round(next*100)/100;
    state.marketHist[c.key].push(state.marketMult[c.key]);
    if(state.marketHist[c.key].length>7) state.marketHist[c.key].shift();
  }
  marketNews();
}
// 每日结算: 每 3 天 roll
function marketTick(){
  if(state.day%3===0) marketRoll();
}
// 市场新闻: 波动 ≥15% 生成条目
function marketNews(){
  for(const c of MARKET_CATS){
    const hist=state.marketHist[c.key]||[1,1];
    if(hist.length<2) continue;
    const prev=hist[hist.length-2], cur=hist[hist.length-1];
    const chg=Math.round((cur/prev-1)*100);
    if(Math.abs(chg)>=15){
      addNews({
        title:(chg>0?'📈':'📉')+c.name+'价格'+(chg>0?'上涨':'回落')+' '+Math.abs(chg)+'%',
        body:'市场监测: '+c.name+'批发指数 '+(prev).toFixed(2)+' → '+(cur).toFixed(2)+'。'+(chg>0?'进货成本上升,注意毛利空间。':'进货成本下降,是囤货的好时机。'),
        day:state.day, type:'market', good:chg<0, tag:'进货成本'
      });
    }
  }
}

// 股市系统: 6 只股票, 每日收盘涨跌, 玩家可买卖
const STOCK_DEFS = [
  { key:"coffee", name:"咖啡连锁", emoji:"☕", base:100, vol:0.03, hint:"餐饮景气推高" },
  { key:"retail", name:"零售集团", emoji:"🛒", base:100, vol:0.04, hint:"促销/时尚周利好" },
  { key:"food",   name:"餐饮控股", emoji:"🍜", base:120, vol:0.04, hint:"美食节利好" },
  { key:"med",    name:"医疗集团", emoji:"🏥", base:150, vol:0.02, hint:"防御性资产" },
  { key:"tech",   name:"科技新锐", emoji:"💻", base:80,  vol:0.08, hint:"高波动高收益" },
  { key:"bank",   name:"银行股份", emoji:"🏦", base:200, vol:0.02, hint:"低波动蓝筹" },
];
// 初始化股票(旧档兼容)
function initStocks(){
  if(!state.stocks || typeof state.stocks!=='object') state.stocks={};
  if(!state.stockHoldings || typeof state.stockHoldings!=='object') state.stockHoldings={};
  if(!Array.isArray(state.stockHist)) state.stockHist={};
  for(const s of STOCK_DEFS){
    if(typeof state.stocks[s.key]!=='number' || state.stocks[s.key]<=0) state.stocks[s.key]=s.base;
    if(!Array.isArray(state.stockHist[s.key])) state.stockHist[s.key]=[s.base];
  }
}
// 每日收盘: 每只 ±5% 基础波动 + 事件/通胀修正
function stockSettle(){
  initStocks();
  for(const s of STOCK_DEFS){
    let chg=(Math.random()*0.10-0.05);
    const ev=state.eventToday;
    if(ev==='promo'||ev==='fashionwk') chg+= s.key==='retail'?0.03:0;
    if(ev==='foodfest') chg+= s.key==='food'?0.04:0;
    if(ev==='bizsummit') chg+= s.key==='tech'?0.03:0;
    if(ev==='inflation') chg+= s.key==='tech'?0.02:(s.key==='bank'?-0.02:0);
    if(ev==='deflation') chg+= s.key==='med'?0.02:0;
    if(ev==='holiday') chg+= 0.02;
    if(ev==='rainy'||ev==='powercut') chg-= 0.03;
    let next=state.stocks[s.key]*(1+chg);
    next=Math.max(10, Math.min(500, Math.round(next*100)/100));
    state.stocks[s.key]=next;
    state.stockHist[s.key].push(next);
    if(state.stockHist[s.key].length>7) state.stockHist[s.key].shift();
  }
  // 大涨大跌新闻: 单日 ≥4%
  for(const s of STOCK_DEFS){
    const hist=state.stockHist[s.key];
    if(hist.length<2) continue;
    const dayChg=hist[hist.length-2] ? (state.stocks[s.key]/hist[hist.length-2]-1) : 0;
    if(Math.abs(dayChg)>=0.04){
      addNews({
        title:(dayChg>0?'🚀':'💥')+s.name+(dayChg>0?'大涨':'大跌')+' '+(Math.abs(dayChg)*100).toFixed(1)+'%',
        body:s.emoji+' '+s.name+' 收盘 ¥'+state.stocks[s.key].toFixed(2)+(dayChg>0?',资金流入明显。':'，市场恐慌抛售。'),
        day:state.day, type:'stock', good:dayChg>0, tag:'股市'
      });
    }
  }
}
// 买股票(整数股, 资金扣除)
function buyStock(key, n){
  initStocks();
  n=Math.floor(Math.max(0,n));
  if(n<=0) return "none";
  const price=state.stocks[key]; if(typeof price!=='number') return "unknown";
  const cost=Math.round(price*n);
  if(state.money<cost) return "money";
  state.money-=cost; state.money=Math.round(state.money);
  state.stockHoldings[key]=(state.stockHoldings[key]||0)+n;
  return true;
}
// ---- 理财/债券: 3 档期限, 0 风险保本, 到期自动兑付 ----
const BOND_TYPES = [
  { key:"b7",  name:"7 天理财",  days:7,  rate:0.02, desc:"年化 2%, 灵活" },
  { key:"b30", name:"30 天理财", days:30, rate:0.04, desc:"年化 4%" },
  { key:"b90", name:"90 天理财", days:90, rate:0.07, desc:"年化 7%, 锁定较久" },
];
// 初始化
function initBonds(){ if(!Array.isArray(state.bonds)) state.bonds=[]; }
// 买理财: 按 本金×rate×期限/365 计息, 到期自动兑付
function buyBond(typeKey, principal){
  initBonds();
  const t=BOND_TYPES.find(b=>b.key===typeKey); if(!t) return "unknown";
  principal=Math.floor(Math.max(0,principal));
  if(principal<=0) return "none";
  // 通胀日短期利率 +50%, 通缩日长期 +50%
  let eff=t.rate;
  if(state.eventToday==="inflation" && t.days<=7) eff*=1.5;
  if(state.eventToday==="deflation" && t.days>=90) eff*=1.5;
  const interest=Math.round(principal*eff*(t.days/365));
  if(state.money<principal) return "money";
  state.money-=principal; state.money=Math.round(state.money);
  state.bonds.push({type:typeKey, principal, interest, dueDay:state.day+t.days, openDay:state.day});
  return true;
}
// 每日结算: 到期理财兑付(本金+利息)
function bondSettle(){
  initBonds();
  const due=state.bonds.filter(b=>b.dueDay<=state.day);
  if(due.length===0) return null;
  let total=0;
  for(const b of due){ total+=b.principal+b.interest; state.bonds.splice(state.bonds.indexOf(b),1); }
  state.money+=Math.round(total); state.money=Math.round(state.money);
  addNews({
    title:"💰 理财到期兑付",
    body:due.length+" 笔理财到期, 回款 ¥"+total.toLocaleString()+"(本金+利息)",
    day:state.day, type:"bond", good:true, tag:"理财"
  });
  return total;
}
// 理财市值(未到期按本金估)
function bondValue(){ initBonds(); return state.bonds.reduce((s,b)=>s+b.principal,0); }
// ---- 黄金: 避险资产, 与股市负相关(大盘大跌日金价涨) ----
const GOLD = { base:200, vol:0.03 };
function initGold(){
  if(!state.gold || typeof state.gold!=='object') state.gold={qty:0, price:GOLD.base, hist:[GOLD.base]};
  if(typeof state.gold.price!=='number'||state.gold.price<=0) state.gold.price=GOLD.base;
  if(!Array.isArray(state.gold.hist)) state.gold.hist=[GOLD.base];
}
// 每日金价: 基础波动 + 股市恐慌(最大跌幅>4%时金价 +2~4%)
function goldSettle(){
  initGold();
  let chg=(Math.random()*0.06-0.03);
  // 恐慌联动: 找股票当日最大跌幅
  initStocks();
  let maxDrop=0;
  for(const s of STOCK_DEFS){
    const h=state.stockHist[s.key]||[];
    if(h.length>=2){
      const prev=h[h.length-2];
      const cur=s.key?state.stocks[s.key]:0;
      const d=(prev-cur)/prev; // 跌为正
      if(d>maxDrop) maxDrop=d;
    }
  }
  if(maxDrop>0.04) chg+=0.02+Math.min(0.02,maxDrop*0.5);
  // 通胀日金价 +1%(抗通胀), 通缩日 -1%
  if(state.eventToday==="inflation") chg+=0.01;
  if(state.eventToday==="deflation") chg-=0.01;
  let next=Math.round(state.gold.price*(1+chg)*100)/100;
  next=Math.max(50,Math.min(1000,next));
  state.gold.price=next;
  state.gold.hist.push(next);
  if(state.gold.hist.length>7) state.gold.hist.shift();
  if(Math.abs(chg)>=0.03){
    addNews({
      title:(chg>0?"🥇 金价上涨":"📉 金价回落")+" "+(Math.abs(chg)*100).toFixed(1)+"%",
      body:"黄金今日收 ¥"+next.toFixed(2)+(chg>0?", 避险情绪推升金价。":", 风险偏好回升。"),
      day:state.day, type:"gold", good:chg>0, tag:"黄金"
    });
  }
}
// 买黄金(按克, 1 克=price 元)
function buyGold(g){
  initGold(); g=Math.floor(Math.max(0,g));
  if(g<=0) return "none";
  const cost=Math.round(state.gold.price*g);
  if(state.money<cost) return "money";
  state.money-=cost; state.money=Math.round(state.money);
  state.gold.qty=(state.gold.qty||0)+g;
  return true;
}
// 卖黄金(变现)
function sellGold(g){
  initGold(); g=Math.floor(Math.max(0,g));
  if(g<=0) return "none";
  const held=state.gold.qty||0;
  if(g>held) return "none";
  state.money+=Math.round(state.gold.price*g); state.money=Math.round(state.money);
  state.gold.qty=held-g;
  return true;
}
// 黄金市值
function goldValue(){ initGold(); return Math.round((state.gold.qty||0)*state.gold.price); }
// ---- 加密货币: 3 币, 高波动高风险, 与科技股正相关 ----
const CRYPTO_DEFS = [
  { key:"bzq",  name:"BZC 山寨币",  base:50,  vol:0.15, hint:"高波动" },
  { key:"stab", name:"STAB 稳定币", base:100, vol:0.005, hint:"抗跌" },
  { key:"aia",  name:"AI 概念币",  base:80,  vol:0.25, hint:"科技联动" },
];
function initCrypto(){
  if(!state.crypto || typeof state.crypto!=='object') state.crypto={};
  if(!state.crypto.prices) state.crypto.prices={};
  if(!state.crypto.holdings) state.crypto.holdings={};
  if(!state.crypto.hist) state.crypto.hist={};
  for(const c of CRYPTO_DEFS){
    if(typeof state.crypto.prices[c.key]!=='number'||state.crypto.prices[c.key]<=0) state.crypto.prices[c.key]=c.base;
    if(!Array.isArray(state.crypto.hist[c.key])) state.crypto.hist[c.key]=[c.base];
    if(typeof state.crypto.holdings[c.key]!=='number') state.crypto.holdings[c.key]=0;
  }
}
// 每日币价波动
function cryptoSettle(){
  initCrypto();
  const techChg=(function(){
    const h=state.stockHist&&state.stockHist.tech||[];
    return h.length>=2 ? state.stocks.tech/h[h.length-2]-1 : 0;
  })();
  for(const c of CRYPTO_DEFS){
    let chg=(Math.random()*2-1)*c.vol;
    if(c.key==='aia') chg+=Math.max(0,techChg)*0.5; // AI 币随科技股
    if(c.key==='stab') chg*=0.2; // 稳定币抗跌
    let next=Math.round(state.crypto.prices[c.key]*(1+chg)*100)/100;
    next=Math.max(5,Math.min(5000,next));
    state.crypto.prices[c.key]=next;
    state.crypto.hist[c.key].push(next);
    if(state.crypto.hist[c.key].length>7) state.crypto.hist[c.key].shift();
    // 大涨大跌新闻(≥10%)
    if(Math.abs(chg)>=0.10){
      addNews({
        title:(chg>0?"🚀 币圈大涨":"📉 币圈大跌")+": "+c.name+" "+(chg>0?"+":"")+(chg*100).toFixed(1)+"%",
        body:c.key+" 价格 ¥"+next.toFixed(2), day:state.day, type:"crypto", good:chg>0, tag:"加密货币"
      });
    }
  }
}
// 买币(按数量)
function buyCrypto(key, n){
  initCrypto();
  n=Math.floor(Math.max(0,n));
  if(n<=0) return "none";
  const price=state.crypto.prices[key];
  const cost=Math.round(price*n*100)/100;
  if(state.money<cost) return "money";
  state.money-=Math.round(cost); state.money=Math.round(state.money);
  state.crypto.holdings[key]=(state.crypto.holdings[key]||0)+n;
  return true;
}
// 卖币
function sellCrypto(key, n){
  initCrypto();
  n=Math.floor(Math.max(0,n));
  if(n<=0) return "none";
  const held=state.crypto.holdings[key]||0;
  if(n>held) return "none";
  state.money+=Math.round(state.crypto.prices[key]*n*100)/100; state.money=Math.round(state.money);
  state.crypto.holdings[key]=held-n;
  return true;
}
// 加密货币市值
function cryptoValue(){ initCrypto(); let s=0; for(const c of CRYPTO_DEFS) s+=c?state.crypto.holdings[c.key]*state.crypto.prices[c.key]:0; return Math.round(s); }
// 卖股票(回款到账)
// ---- 房地产/REIT: 3 档物业, 每日租金结算 + 价格波动(与零售市联动) ----
const PROPERTY_DEFS = [
  { key:"apt", name:"小公寓",   rent:80,  base:20000, hint:"低风险, 稳定租金" },
  { key:"off", name:"写字楼",   rent:200, base:60000, hint:"中等风险" },
  { key:"cpt", name:"商铺",     rent:500, base:150000, hint:"高收益, 有 10-40% 空置率" },
];
function initProperties(){
  if(!Array.isArray(state.properties)) state.properties=[];
}
// 买物业(按件数, 立即开始收租)
function buyProperty(key, n){
  initProperties();
  n=Math.floor(Math.max(0,n));
  if(n<=0) return "none";
  const d=PROPERTY_DEFS.find(p=>p.key===key); if(!d) return "unknown";
  const cost=Math.round(d.base*n);
  if(state.money<cost) return "money";
  state.money-=cost; state.money=Math.round(state.money);
  let rec=state.properties.find(p=>p.key===key);
  if(!rec){ rec={key,qty:0,vacancyRate:0}; state.properties.push(rec); }
  rec.qty+=n;
  return true;
}
// 每日地产结算: 商铺价 × 零售市系数; 日租金=月租/30×(1-空置率)×qty
function propertySettle(){
  initProperties();
  const retailM=state.marketMult&&state.marketMult.retail||1;
  for(const p of state.properties){
    const d=PROPERTY_DEFS.find(x=>x.key===p.key); if(!d) continue;
    p.price=p.key==='cpt'?Math.round(d.base*retailM):d.base;
    const vr=p.key==='cpt'?Math.random()*0.3:Math.random()*0.1;
    p.vacancyRate=vr;
    const dayRent=Math.round(d.rent*(1-vr)*p.qty/30);
    state.money+=dayRent; state.money=Math.round(state.money);
    p.lastRent=dayRent;
  }
}
// 卖物业(按件)
function sellProperty(key, n){
  initProperties();
  n=Math.floor(Math.max(0,n));
  if(n<=0) return "none";
  const rec=state.properties.find(p=>p.key===key);
  if(!rec||n>rec.qty) return "none";
  const d=PROPERTY_DEFS.find(x=>x.key===key);
  state.money+=Math.round((rec.price||d.base)*n); state.money=Math.round(state.money);
  rec.qty-=n;
  if(rec.qty<=0) state.properties.splice(state.properties.indexOf(rec),1);
  return true;
}
// 地产市值
function propertyValue(){ initProperties(); let s=0; for(const p of state.properties){ const d=PROPERTY_DEFS.find(x=>x.key===p.key); s+=(p.price||(d&&d.base)||0)*p.qty; } return Math.round(s); }
// 卖股票(回款到账)
function sellStock(key, n){
  initStocks();
  n=Math.floor(Math.max(0,n));
  const held=state.stockHoldings[key]||0;
  if(n<=0||n>held) return "none";
  const price=state.stocks[key];
  state.money+=Math.round(price*n); state.money=Math.round(state.money);
  state.stockHoldings[key]=held-n;
  if(state.stockHoldings[key]<=0) delete state.stockHoldings[key];
  return true;
}
// 股票总市值
function stockValue(){
  initStocks();
  let v=0;
  for(const k in state.stockHoldings){
    v+= (state.stocks[k]||0) * (state.stockHoldings[k]||0);
  }
  return Math.round(v);
}

// 新闻系统: 事件/市场/股市 → 条目(倒序保留 30 条)
function addNews(item){
  if(!Array.isArray(state.news)) state.news=[];
  item.id='n'+state.news.length+'_'+Date.now();
  state.news.unshift(item);
  if(state.news.length>30) state.news.length=30;
}
// 每日事件 → 新闻
function eventNews(key){
  const e=EVENTS.find(x=>x.key===key);
  if(!e || e.key==='normal') return;
  addNews({
    title:e.msg,
    body:'第 '+state.day+' 天发生: '+e.msg,
    day:state.day, type:'event', good:!!e.good, tag:e.good?'利好':'利空'
  });
}

// 打工小游戏模板(供 hero-system UI 调用): 10s 限时, 完成→全额+心情5, 超时→40%-心情3
// gig 模板供接私活用(8s 内点 5 次)
const MINIGAME_TPL = {
  cafe:   { time:10, title:"☕ 咖啡拉花", desc:"按顺序点亮 8 格拉花", cells:8, order:true },
  super:  { time:10, title:"🛒 超市理货", desc:"点满 9 格货架(任意顺序)", cells:9, order:false },
  courier:{ time:10, title:"🛵 外卖跑单", desc:"点完 6 个订单", cells:6, order:false },
  it:     { time:10, title:"💻 装机配单", desc:"按 1→6 顺序装部件", cells:6, order:true },
  artist: { time:10, title:"🎨 画廊找画", desc:"9 宫格点出 5 幅画(任意顺序)", cells:5, of:9, order:false },
  bank:   { time:10, title:"🏦 理财优选", desc:"算利率, 选收益最高的一项", cells:3, choice:true },
  streamer:{time:10, title:"📱 直播冲榜", desc:"10s 内连点 12 次", cells:12, tap:true },
  advisor:{ time:10, title:"📊 荐股考验", desc:"看 3 只 K 线, 选涨势最强", cells:3, choice:true },
  gig:    { time:8,  title:"📞 接私活", desc:"8s 内点 5 次接单", cells:5, tap:true },
};
// 打工小游戏结算(由 UI 弹层调用): success → 全额工资 + 心情 5; 超时/失败 → 40% 工资 + 心情 -3
// 体力在进弹层前由 UI 扣(与 doWork 相同); 这里只做钱/心情/记录
function minigameSettle(jobKey, success){
  const p=state.protagonist;
  const j=WORK_JOBS.find(x=>x.key===jobKey);
  const base=j?workJobPay(jobKey):800;
  const pay=Math.round(base*(success?1:0.4));
  state.money+=pay; state.money=Math.round(state.money);
  p.mood=Math.max(0,Math.min(100,p.mood+(success?5:-3)));
  if(!p.minigames || typeof p.minigames!=='object') p.minigames={};
  p.minigames[jobKey]=(p.minigames[jobKey]||0)+(success?1:0);
  p.jobDays++;
  p.job=jobKey;
  if(jobKey==='gig') p.sideGigDay=state.day; // 接私活标记当日已接
  return pay;
}
if(typeof window!=='undefined'){
  window.minigameSettle=minigameSettle;
  window.MINIGAME_TPL=MINIGAME_TPL;
}

// 主角扩展: 2 个新职业 + 3 项新消费 + 接私活
const EXTRA_JOBS = [
  { key:"streamer", name:"网红主播", emoji:"📱", energyCost:35, pay:1800, moodDelta:6,
    unlockReq:{jobDays:10, investLevel:1}, desc:"直播打赏, 需打工 10 天 + 投资 Lv≥1" },
  { key:"advisor",  name:"投资顾问", emoji:"📊", energyCost:70, pay:5000, moodDelta:-2,
    unlockReq:{jobDays:15, investLevel:3}, desc:"给老板做投资咨询, 需打工 15 天 + 投资 Lv≥3" },
];
// 新职业并入 WORK_JOBS(供现有 jobUnlocked / workJobPay 统一处理)
WORK_JOBS.push(...EXTRA_JOBS);

// 接私活: 每日 1 次(主角扩展), 走小游戏模板 "gig"; 结算统一走 doWork → minigameSettle(全额 1.0 / 超时 0.4)
const SIDE_GIG = { key:"gig", name:"接私活", emoji:"📞", energyCost:15, pay:800, moodDelta:3, unlockReq:null, desc:"随机接单(维修/跑腿/代排队), 每日限 1 次 · 体力 15", gig:true };
WORK_JOBS.push(SIDE_GIG); // 并入后 doWork / jobUnlocked / workJobPay / UI 列表统一处理(gig 每日限 1 次由 jobUnlocked 判断)

// ---- 产品设计系统(开罗风): 设计产品 → 上市 → 每日卖货, 收益受质量/价格/市场趋势影响 ----
// 设计游戏/手机/家电/潮玩 4 类, 每类有不同成本/收益/市场波动; 产品设计小游戏(组件选择+命名)
const PRODUCT_DEFS = [
  { key:"game",  name:"独立游戏", emoji:"🎮", cost:3000,  base:5000,  quality:0.5,  vol:0.1,  hint:"低成本入门, 玩家口碑传播" },
  { key:"phone", name:"手机",   emoji:"📱", cost:15000, base:30000, quality:0.6,  vol:0.15, hint:"高利润, 需跟科技市" },
  { key:"gadget",name:"家电",   emoji:"🔌", cost:8000,  base:15000, quality:0.55, vol:0.08, hint:"稳定收益, 抗波动" },
  { key:"toy",   name:"潮玩手办", emoji:"🧸", cost:5000,  base:9000,  quality:0.65, vol:0.12, hint:"年轻人市场, 季节影响" },
];
// 设计小游戏: 8s 内按顺序点 6 个组件(不同产品组件不同)
const PRODUCT_MINIGAME = { time:8, title:"🎨 产品设计", desc:"按设计图顺序组装 6 个组件", cells:6, order:true };
// 初始化产品
function initProducts(){
  if(!state.products || typeof state.products!=='object') state.products={};
  if(!Array.isArray(state.productList)) state.productList=[];
}
// 开始设计: 扣成本, 进入设计小游戏(由 hero-system UI 调用)
function startProductDesign(key){
  initProducts();
  const def=PRODUCT_DEFS.find(p=>p.key===key);
  if(!def) return "unknown";
  if(state.money<def.cost) return "money";
  state.money-=def.cost; state.money=Math.round(state.money);
  // 创建设计任务
  if(!state.products.designs) state.products.designs=[];
  state.products.designs.push({key, startedDay:state.day, done:false});
  return true;
}
// 设计完成(小游戏 success) → 产品上市
function productDesignDone(key, success){
  initProducts();
  const idx=(state.products.designs||[]).findIndex(d=>d.key===key);
  if(idx<0) return;
  const d=state.products.designs[idx];
  if(success){
    d.done=true;
    // 产品上架: 计算初始销量
    const def=PRODUCT_DEFS.find(p=>p.key===key);
    const quality=success?def.quality:0.2; // 成功 → 完整质量, 失败 → 残次品
    state.productList.push({key, quality, launchedDay:state.day, dailySold:0, totalEarned:0});
    addNews({
      title:"📦 "+def.name+" 上市",
      body:"你的 "+def.name+" 产品上架, 预计日销 "+Math.round(def.base*quality/5000*200*10)+" 件",
      day:state.day, type:"product", good:true, tag:"设计"
    });
  } else {
    // 失败: 残次品, 只能打折卖
    d.done=true;
    const def=PRODUCT_DEFS.find(p=>p.key===key);
    state.productList.push({key, quality:0.1, launchedDay:state.day, dailySold:0, totalEarned:0});
    addNews({
      title:"⚠️ "+def.name+" 设计失败",
      body:"残次品上市, 只能低价倾销",
      day:state.day, type:"product", good:false, tag:"设计"
    });
  }
}
// 每日产品结算: 每款产品卖货(数量 = 质量 × 市场趋势 × 季节)
function productSettle(){
  initProducts();
  const retailM=state.marketMult&&state.marketMult.retail||1;
  const seasonM=seasonMult('retail');
  for(const p of state.productList){
    const def=PRODUCT_DEFS.find(x=>x.key===p.key);
    if(!def) continue;
    // 日销量: 基础价 / 5000 × 200 × 市场/季节, 乘质量, 随机波动
    let base=Math.round(def.base/5000*200*retailM*seasonM*p.quality);
    base=Math.round(base*(0.8+Math.random()*0.4));
    p.dailySold=base;
    // 收益: 销量 × 单件利润(基础价 × 质量 × 随机)
    const profitPer=def.base*0.04*p.quality; // 单件利润 ~4% 基础价
    const earned=Math.round(profitPer*base);
    p.totalEarned+=earned;
    state.money+=earned; state.money=Math.round(state.money);
    p.lastEarned=earned;
  }
  // 大涨大跌新闻(单日收益 > 5 万)
  for(const p of state.productList){
    if(p.lastEarned>50000){
      const def=PRODUCT_DEFS.find(x=>x.key===p.key);
      addNews({
        title:"🚀 "+def.name+" 大卖!",
        body:"今日售出 "+p.dailySold+" 件, 收益 ¥"+p.lastEarned.toLocaleString(),
        day:state.day, type:"product", good:true, tag:"设计"
      });
    }
  }
}
// 产品总收益(累计)
function productTotalValue(){
  initProducts();
  return state.productList.reduce((s,p)=>s+(p.totalEarned||0),0);
}
if(typeof window!=='undefined'){
  window.PRODUCT_DEFS=PRODUCT_DEFS;
  window.PRODUCT_MINIGAME=PRODUCT_MINIGAME;
  window.initProducts=initProducts;
  window.startProductDesign=startProductDesign;
  window.productDesignDone=productDesignDone;
  window.productSettle=productSettle;
  window.productTotalValue=productTotalValue;
}

// ---- 游戏开发工作室(开罗《游戏发展国》风): 立项 → 开发进度条 → 发售 → 销量回款 + 口碑/市场占有 ----
// 工作室: 一次性建成, 雇佣 4 名员工(策划/程序/美术/音效), 员工有技能/工资/升级;
// 开发: 选游戏类型 + 目标用户 + 方向点数分配(创意/画面/音乐/剧情) → 每日进度条推进 → 达成即发售;
// 发售: 销量 = 基础 × 口碑 × 市场占有 × 衰减, 累计销售, 爆款会拉高后续项目起点
const DEV_STUDIO = {
  key:"game_studio",
  openCost: 30000,        // 开工作室成本(开罗风: 中等投资门槛)
  dailySalary: 1500,      // 4 名员工每日工资合计(开罗风: 团队成本是长期支出)
  team: [
    { key:"plan", name:"策划",  skill:1, maxSkill:5, baseWage:300,  desc:"负责游戏设计方向" },
    { key:"code", name:"程序",  skill:1, maxSkill:5, baseWage:400,  desc:"负责开发与性能" },
    { key:"art",  name:"美术",  skill:1, maxSkill:5, baseWage:400,  desc:"负责画面与角色" },
    { key:"sound",name:"音效",  skill:1, maxSkill:5, baseWage:400,  desc:"负责音乐与配音" },
  ],
  // 方向点数分配: 项目可投创意/画面/音乐/剧情 4 项, 各项影响该维度的口碑
  DIR_POINTS: 4,          // 每个项目可分配 4 点(可重复投同一项)
  // 游戏类型(开罗风: 不同题材有基础销量 + 受众偏好)
  gameTypes: [
    { key:"casual",  name:"休闲",  emoji:"🧩", baseSales:600,  risk:0.0,  hint:"稳定受众, 低波动" },
    { key:"action",  name:"动作",  emoji:"⚔️", baseSales:900,  risk:0.1,  hint:"爽快感强, 中等波动" },
    { key:"rpg",     name:"RPG",   emoji:"📜", baseSales:1200, risk:0.2,  hint:"高利润, 波动大" },
    { key:"sim",     name:"模拟",  emoji:"🏠", baseSales:700,  risk:0.05, hint:"策略玩家, 粘性高" },
    { key:"mobile",  name:"手游",  emoji:"📱", baseSales:1500, risk:0.3,  hint:"高销量, 高风险" },
  ],
  // 目标用户(影响市场占有基础值)
  audiences: [
    { key:"kids",   name:"儿童",   baseShare:0.4, hint:"量大价低" },
    { key:"teens",  name:"青少年", baseShare:0.5, hint:"核心玩家" },
    { key:"adult",  name:"成人",   baseShare:0.35, hint:"单价高, 量少" },
  ],
};
// 初始化工作室
function initDevStudio(){
  if(typeof state.devStudio!=='object'||state.devStudio===null) state.devStudio={};
  const s=state.devStudio;
  if(!s.opened) s.opened=false;
  if(!Array.isArray(s.team)) s.team=DEV_STUDIO.team.map(t=>({key:t.key, skill:t.skill, maxSkill:t.maxSkill}));
  if(typeof s.projects!=='object'||s.projects===null) s.projects={};
  if(!Array.isArray(s.released)) s.released=[];
  if(!Array.isArray(s.designs)) s.designs=[];
  if(typeof s.totalEarned!=='number') s.totalEarned=0;
  if(typeof s.marketShare!=='number') s.marketShare=0;
  if(typeof s.reputation!=='number') s.reputation=0;
}
// 开工作室
function openDevStudio(){
  initDevStudio();
  if(state.devStudio.opened) return "opened";
  if(state.money<DEV_STUDIO.openCost) return "money";
  state.money-=DEV_STUDIO.openCost; state.money=Math.round(state.money);
  state.devStudio.opened=true;
  addNews({
    title:"🎮 游戏工作室开张",
    body:"投入 ¥"+DEV_STUDIO.openCost.toLocaleString()+" 开了游戏开发工作室, 4 名员工(策划/程序/美术/音效)就位, 可以立项开发游戏了",
    day:state.day, type:"studio", good:true, tag:"开发"
  });
  return true;
}
// 开始设计: 扣立项成本 → 进入设计小游戏(由 hero-system UI 调用)
function startDevDesign(projectKey){
  initDevStudio();
  if(!state.devStudio.opened) return "studio";
  // 立项成本: 1000 × 类型数量(开罗风: 低成本, 鼓励多立项)
  const cost=1000;
  if(state.money<cost) return "money";
  state.money-=cost; state.money=Math.round(state.money);
  state.devStudio.designs.push({key:projectKey, startedDay:state.day, done:false});
  return true;
}
// 设计完成(小游戏 success) → 立项成功
function devDesignDone(projectKey, success){
  initDevStudio();
  const idx=state.devStudio.designs.findIndex(d=>d.key===projectKey);
  if(idx<0) return;
  const d=state.devStudio.designs[idx];
  d.done=true;
  const def=DEV_STUDIO.gameTypes.find(p=>p.key===projectKey);
  if(success){
    addNews({
      title:"📋 《"+(def?def.name:projectKey)+"》立项成功",
      body:"设计稿通过, 4 名员工开始开发, 预计 "+Math.round(20+Math.random()*30)+" 天发售",
      day:state.day, type:"studio", good:true, tag:"开发"
    });
  } else {
    addNews({
      title:"⚠️ 《"+(def?def.name:projectKey)+"》立项失败",
      body:"设计稿被否决, 团队重新构思",
      day:state.day, type:"studio", good:false, tag:"开发"
    });
  }
}
// 开始开发: 选游戏类型 + 目标用户 + 分配方向点数 → 创建项目
// 参数: typeKey, audienceKey, dirAllocation({creative,graphics,music,story}, 各 0-4, 合计 = DEV_STUDIO.DIR_POINTS)
function startDevProject(typeKey, audienceKey, dirAllocation){
  initDevStudio();
  if(!state.devStudio.opened) return "studio";
  if(state.devStudio.activeProject) return "busy"; // 同一时间只开发 1 款(开罗风: 专注团队)
  const typeDef=DEV_STUDIO.gameTypes.find(t=>t.key===typeKey);
  const audDef=DEV_STUDIO.audiences.find(a=>a.key===audienceKey);
  if(!typeDef||!audDef) return "unknown";
  const alloc={creative:0,graphics:0,music:0,story:0};
  const valid=(dirAllocation&&typeof dirAllocation==='object')?dirAllocation:alloc;
  let total=0;
  for(const k of Object.keys(alloc)){ const v=Math.floor(Math.max(0,valid[k]||0)); alloc[k]=v; total+=v; }
  if(total>DEV_STUDIO.DIR_POINTS) total=DEV_STUDIO.DIR_POINTS; // 防溢出
  const project={
    type:typeKey, audience:audienceKey, dir:alloc,
    startedDay:state.day,
    progress:0,
    totalDays:Math.round(20+Math.random()*30), // 总开发天数(开罗风: 20-50 天)
    quality:0,  // 口碑分(由 dir 分配 + 团队技能决定)
    released:false,
  };
  // 口碑分: 4 项各贡献 0-25, 基础 10 + 方向分配加成 + 团队技能加成
  let base=10;
  base+=alloc.creative*4 + alloc.graphics*3 + alloc.music*3 + alloc.story*3; // 方向点加成
  // 团队技能: 策划/程序 → 创意+剧情; 美术 → 画面; 音效 → 音乐
  const team=state.devStudio.team;
  const skillPlan=team.find(t=>t.key==='plan')?team.find(t=>t.key==='plan').skill:1;
  const skillCode=team.find(t=>t.key==='code')?team.find(t=>t.key==='code').skill:1;
  const skillArt=team.find(t=>t.key==='art')?team.find(t=>t.key==='art').skill:1;
  const skillSound=team.find(t=>t.key==='sound')?team.find(t=>t.key==='sound').skill:1;
  base+= (skillPlan+skillCode)*2 + skillArt*3 + skillSound*3; // 技能加成
  project.quality=Math.min(100, base);
  state.devStudio.activeProject=project;
  addNews({
    title:"🎬 《"+typeDef.name+"》开发启动",
    body:"目标"+audDef.name+" · 方向: 创意"+alloc.creative+"/画面"+alloc.graphics+"/音乐"+alloc.music+"/剧情"+alloc.story+" · 口碑预估 "+project.quality+"/100",
    day:state.day, type:"studio", good:true, tag:"开发"
  });
  return true;
}
// 提升开发进度(每日自动, 也可手动加 1 天额外进度)
function boostDevProgress(){
  initDevStudio();
  const p=state.devStudio.activeProject;
  if(!p||p.released) return 0;
  p.progress+=1;
  return p.progress;
}
// 员工事件(开罗风: 开发中随机出"想吃甜品/加班费"等, 花钱摆平或牺牲工期)
// 在 devProjectCheckComplete 后每日 30% 概率触发(同一项目同一事件不重复)
const STAFF_EVENTS = [
  { key:"snack",  name:"想吃甜品", cost:500,  desc:"团队想吃甜品, 付钱安抚 +5% 进度; 不付 -1 天工期" },
  { key:"overtime",name:"加班费",  cost:1000, desc:"程序要求加班费, 付钱 +8% 进度; 不付 -2 天工期" },
  { key:"bug",    name:"紧急 bug", cost:800,  desc:"美术发现 bug, 修 bug 钱 +5% 口碑; 不付 -1 天工期" },
  { key:"teamwork",name:"团建",    cost:1500, desc:"策划提议团建, 付钱全员士气 +1; 不付 -1 天工期" },
];
// 随机员工事件(返回事件对象, 概率 30%, 同类不重复)
function rollStaffEvent(){
  initDevStudio();
  const s=state.devStudio;
  const p=s.activeProject;
  if(!p||p.released) return null;
  if(Math.random()>0.3) return null;
  // 排除已触发过的
  if(!Array.isArray(p.eventFired)) p.eventFired=[];
  const available=STAFF_EVENTS.filter(e=>!p.eventFired.includes(e.key));
  if(!available.length) return null;
  const ev=available[Math.floor(Math.random()*available.length)];
  p.currentEvent=ev.key;
  p.eventDay=state.day;
  return ev;
}
// 处理员工事件: 付钱 (true) 或 摆烂 (false)
function resolveStaffEvent(pay){
  initDevStudio();
  const s=state.devStudio;
  const p=s.activeProject;
  if(!p||!p.currentEvent) return "none";
  const ev=STAFF_EVENTS.find(e=>e.key===p.currentEvent);
  if(!ev) return "none";
  if(!Array.isArray(p.eventFired)) p.eventFired=[];
  p.eventFired.push(ev.key);
  p.currentEvent=null;
  if(pay){
    if(state.money<ev.cost) return "money";
    state.money-=ev.cost; state.money=Math.round(state.money);
    if(ev.key==='snack') p.progress+=p.totalDays*0.05;
    else if(ev.key==='overtime') p.progress+=p.totalDays*0.08;
    else if(ev.key==='bug') p.quality=Math.min(100,p.quality+2);
    else if(ev.key==='teamwork') p.progress+=p.totalDays*0.03;
    addNews({
      title:"🍬 团队事件 · 付钱解决",
      body:ev.name+" 已摆平 (¥"+ev.cost.toLocaleString()+")",
      day:state.day, type:"studio", good:true, tag:"开发"
    });
  } else {
    // 摆烂: 工期 -1 ~ -2 天(不付钱, 团队士气低落)
    p.totalDays+= (ev.key==='overtime'?2:1);
    addNews({
      title:"😩 团队事件 · 没付钱",
      body:ev.name+" 没解决, 工期延后",
      day:state.day, type:"studio", good:false, tag:"开发"
    });
  }
  return true;
}
// 检查开发完成(每日 endDay 自动调用): progress>=totalDays → 发售
function devProjectCheckComplete(){
  initDevStudio();
  const p=state.devStudio.activeProject;
  if(!p||p.released) return null;
  p.progress=Math.min(p.totalDays, p.progress);
  if(p.progress>=p.totalDays){
    p.released=true;
    return p;
  }
  return null;
}
// 发售游戏: 计算市场占有 + 初始日销, 加入 released 列表
function releaseGame(project){
  initDevStudio();
  const typeDef=DEV_STUDIO.gameTypes.find(t=>t.key===project.type);
  const audDef=DEV_STUDIO.audiences.find(a=>a.key===project.audience);
  // 市场占有: 受众基础 × 质量/100 × 口碑修正(爆款 +50%)
  let share=audDef.baseShare * (project.quality/100);
  if(project.quality>=80) share*=1.5; // 爆款修正
  if(project.quality<30) share*=0.5;  // 烂作修正
  share=Math.min(0.9, share+Math.random()*0.05); // 随机 +5%, 封顶 90%
  state.devStudio.marketShare=Math.min(0.95, state.devStudio.marketShare+share*0.2); // 市场占有累积
  // 初始日销: 基础销量 × 质量 × 市场占有 × 随机
  let dailySales=Math.round(typeDef.baseSales * (project.quality/50) * share * (0.9+Math.random()*0.3));
  const released={
    key:"g"+state.day+"_"+(((s.released)||[]).length), // 唯一 id(DLC 定位用)
    type:project.type, audience:project.audience,
    releasedDay:state.day,
    dailySales,
    marketShare:share,
    quality:project.quality,
    totalSold:0,
    totalEarned:0,
    risk:typeDef.risk,
  };
  state.devStudio.released.push(released);
  state.devStudio.reputation+=Math.round(project.quality/10); // 口碑累积
  state.devStudio.activeProject=null;
  // 媒体测评(开罗《游戏发展国》风: 口碑 → 1-5 星评分, 评分再放大初始日销; 加入随机波动, 高分偶翻车)
  let stars=reviewStars(project.quality);
  // 媒体波动: 高分有 10% 概率掉 1 星, 低分有 10% 概率升 1 星(开罗风: 媒体不可控)
  const roll=Math.random();
  let mediaNote="";
  if(stars>=4 && roll<0.1){ stars--; mediaNote=" · 媒体意外挑刺(掉 1 星)"; }
  else if(stars<=2 && roll>0.9){ stars++; mediaNote=" · 媒体惊喜好评(升 1 星)"; }
  released.stars=stars;
  // 评分修正: 5星 ×1.5 / 4星 ×1.25 / 3星 ×1.0 / 2星 ×0.75 / 1星 ×0.5
  const starMult=[1,0.5,0.75,1.0,1.25,1.5][stars];
  released.dailySales=Math.round(released.dailySales*starMult);
  // 媒体发布会新闻
  if(stars>=4){
    addNews({
      title:"⭐ 《"+(typeDef?typeDef.name:project.type)+"》获媒体好评!",
      body:"《游戏志》给出 "+stars+" 星"+mediaNote+" · \"画面出色, 玩法扎实\" · 评分加成 ×"+starMult,
      day:state.day, type:"studio", good:true, tag:"开发"
    });
  } else if(stars<=2){
    addNews({
      title:"😢 《"+(typeDef?typeDef.name:project.type)+"》口碑平平",
      body:"《游戏志》给出 "+stars+" 星"+mediaNote+" · \"中规中矩\" · 评分折扣 ×"+starMult,
      day:state.day, type:"studio", good:false, tag:"开发"
    });
  }
  addNews({
    title:"🚀 《"+typeDef.name+"》发售!",
    body:"目标"+audDef.name+" · 口碑 "+project.quality+"/100 · 评分 "+stars+"⭐ · 市场占有 "+(share*100).toFixed(0)+"% · 预计日销 "+released.dailySales+" 份",
    day:state.day, type:"studio", good:true, tag:"开发"
  });
  return released;
}
// 口碑分 → 媒体星级(开罗风: 1-5 星, 高分高星)
function reviewStars(quality){
  if(quality>=90) return 5;
  if(quality>=75) return 4;
  if(quality>=55) return 3;
  if(quality>=35) return 2;
  return 1;
}
// 游戏每日销量结算(开罗风: 销量随时间衰减, 但爆款衰减慢)
function gameSettle(){
  initDevStudio();
  const s=state.devStudio;
  // 工作室未开: 无销量, 只扣工资(若有)
  if(!s.opened) return;
  // 员工工资
  state.money-=DEV_STUDIO.dailySalary; state.money=Math.round(state.money);
  // 各已发售游戏日销
  const marketMult=state.marketMult&&state.marketMult.tech||1;
  for(const g of s.released){
    // 衰减: 发售 30 天后日销 ×0.7, 60 天后 ×0.4, 90 天后停止
    const age=state.day-g.releasedDay;
    let decay=1;
    if(age>=90) decay=0;
    else if(age>=60) decay=0.4;
    else if(age>=30) decay=0.7;
    // 爆款(quality>=80)衰减慢
    if(g.quality>=80) decay*=1.3;
    // 风险: 手游波动大
    const riskFactor=g.risk>0.2?(0.7+Math.random()*0.6):(0.9+Math.random()*0.2);
    const sold=Math.round(g.dailySales*decay*riskFactor*marketMult);
    g.totalSold+=sold;
    // 收益: 单份 ~¥30(开罗风: 量价平衡)
    const earned=Math.round(sold*30);
    g.totalEarned+=earned;
    s.totalEarned+=earned;
    state.money+=earned; state.money=Math.round(state.money);
    // 爆款新闻
    if(sold>1000){
      const typeDef=DEV_STUDIO.gameTypes.find(t=>t.key===g.type);
      addNews({
        title:"🏆 《"+(typeDef?typeDef.name:g.type)+"》大卖!",
        body:"今日售出 "+sold+" 份, 收益 ¥"+earned.toLocaleString()+" · 累计 "+g.totalSold+" 份",
        day:state.day, type:"studio", good:true, tag:"开发"
      });
    }
  }
}
// 提升员工技能(开罗风: 投研究点升级, 提升后续项目口碑)
function upgradeDevTeam(memberKey, times){
  initDevStudio();
  const s=state.devStudio;
  if(!s.opened) return "studio";
  times=Math.max(1,Math.floor(times||1));
  const member=s.team.find(t=>t.key===memberKey);
  const def=DEV_STUDIO.team.find(t=>t.key===memberKey);
  if(!member||!def) return "unknown";
  // 升级成本: 2000 × 当前技能(开罗风: 越级越贵)
  const cost=2000*member.skill*times;
  if(state.money<cost) return "money";
  state.money-=cost; state.money=Math.round(state.money);
  member.skill=Math.min(member.maxSkill, member.skill+times);
  addNews({
    title:"📈 团队 "+def.name+" 升级",
    body:"技能提升到 Lv"+member.skill+" (上限 "+member.maxSkill+")",
    day:state.day, type:"studio", good:true, tag:"开发"
  });
  return true;
}
// 工作室总收益
function devStudioValue(){
  initDevStudio();
  return state.devStudio.totalEarned;
}
// ---- DLC 更新(开罗风): 已发售游戏付费做资料片, 销量复活 + 口碑 +5 ----
// 成本: 第 1 次 ¥2000, 第 2 次 ¥4000(限 2 次); 效果: 口碑 +5, 衰减计时清零, 日销按新口碑重算
const DLC_COST_BASE = 2000;
function makeDLC(gKey){
  initDevStudio();
  const s=state.devStudio;
  if(!s.opened) return "studio";
  const g=s.released.find(x=>x.key===gKey);
  if(!g) return "none";
  if((g.dlcCount||0)>=2) return "max";
  const cost=DLC_COST_BASE*(1+(g.dlcCount||0));
  if(state.money<cost) return "money";
  state.money-=cost; state.money=Math.round(state.money);
  g.dlcCount=(g.dlcCount||0)+1;
  g.quality=Math.min(100,g.quality+5); // 口碑 +5
  g.stars=reviewStars(g.quality);        // 星级随口碑刷新
  g.lastDLC=state.day;
  // 衰减计时清零: 重置 releasedDay, 日销按新口碑/星级重算
  g.releasedDay=state.day;
  const typeDef=DEV_STUDIO.gameTypes.find(t=>t.key===g.type);
  const starMult=[1,0.5,0.75,1.0,1.25,1.5][g.stars]||1;
  g.dailySales=Math.round(typeDef.baseSales*(g.quality/50)*g.marketShare*1.2*starMult*(0.9+Math.random()*0.3));
  addNews({
    title:"📦 《"+(typeDef?typeDef.name:g.type)+"》资料片上线!",
    body:"口碑 +5 → "+g.quality+"/100 ("+g.stars+"⭐) · 销量复活, 日销回升至 "+g.dailySales+" 份",
    day:state.day, type:"studio", good:true, tag:"开发"
  });
  return true;
}
if(typeof window!=='undefined'){
  window.DEV_STUDIO=DEV_STUDIO;
  window.initDevStudio=initDevStudio;
  window.openDevStudio=openDevStudio;
  window.startDevDesign=startDevDesign;
  window.devDesignDone=devDesignDone;
  window.startDevProject=startDevProject;
  window.boostDevProgress=boostDevProgress;
  window.devProjectCheckComplete=devProjectCheckComplete;
  window.releaseGame=releaseGame;
  window.gameSettle=gameSettle;
  window.upgradeDevTeam=upgradeDevTeam;
  window.devStudioValue=devStudioValue;
  // 媒体测评 + 员工事件 + DLC
  window.reviewStars=reviewStars;
  window.STAFF_EVENTS=STAFF_EVENTS;
  window.rollStaffEvent=rollStaffEvent;
  window.resolveStaffEvent=resolveStaffEvent;
  window.makeDLC=makeDLC;
  window.DLC_COST_BASE=DLC_COST_BASE;
}

const EXTRA_CONSUMABLES = [
  { key:"gym",    cat:"service", name:"健身卡",   price:5000,  desc:"体力上限 +15(永久)" },
  { key:"pet",    cat:"service", name:"宠物",     price:8000,  desc:"心情 +15(永久)" },
  { key:"icourse",cat:"service", name:"投资课程", price:20000, desc:"打工收益 +5%(永久)" },
];
CONSUMABLES.push(...EXTRA_CONSUMABLES);

// 进货成本: 商品成本 × 物价指数(通胀) × 市场类别倍率, 摊到每个顾客近似
function dailyProcureCost(i){
  const g=slotGoods(i);
  if(!g) return 0;
  const sl=state.slots[i];
  const estFlow = Math.max(1, customersPerHour(sl)||1);
  const mkmult=shopMarketMult(sl);
  return Math.round(g.cost * state.priceIndex * mkmult * estFlow * PROCUREMENT_SCALE);
}

// 某业态在本日的客流权重(基础 1 × 事件偏好)
function crowdWeight(tag){
  const p=eventPref();
  return p && p[tag] ? p[tag] : 1;
}

function customersPerHour(sl){
  if(!sl.built) return 0;
  const def=SHOPS[sl.type]||SHOPS.Cafe;
  const i=state.slots.indexOf(sl);
  // 顾客小时客流: 含季节修正(夏食娱/冬咖零/春科技/秋全客流)
return Math.round(def.attract * sl.level * FLOW_SCALE * eventWobble() * crowdWeightTotal(def.tag) * synergyMult(def.type) * chainBonus(def.type) * crowdBoost() * wageMult() * investMult() * decorMult(i) * economyMult() * priceCrowdFactor(i) * (seasonMult(marketCatOfShopTag(def.tag))||1));
}

function rollDailyEvent(){
  // 按 w 权重采样
  const total = EVENTS.reduce((s,e)=>s+e.w,0);
  let r = Math.random()*total;
  for(const e of EVENTS){
    if(r < e.w){ state.eventToday = (e.key==="normal"?null:e.key); return state.eventToday; }
    r -= e.w;
  }
  state.eventToday=null;
  return state.eventToday;
}

function tickDay(){
  for(const sl of state.slots){
    if(!sl) continue;
    const c=customersPerHour(sl);
    if(c<=0) continue;
    const share=Math.round(c*(0.85+Math.random()*0.3));
    sl.customersToday+=share;
    const i=state.slots.indexOf(sl);
    // 顾客随机挑选该铺位的某件商品购买: 各商品等权重抽样, 让"不同顾客买不同商品"成立
    const list=shopGoodsList(sl.type);
    const pick=list[Math.floor(Math.random()*list.length)]||list[0];
    sl.purchaseToday=pick.key; // 记录当日代表商品(供顾客图标展示)
    // 单客收入: 玩家定价 > 商品基准价, 再扣进货成本(被通胀推高)
    let per=effectivePerCustomer(sl,i);
    const procure=dailyProcureCost(i); // 当日进货成本(摊到每个顾客近似)
    const netPer=Math.max(1, per - Math.round(procure/Math.max(1,share)));
    sl.revenueToday+=share*per;
    sl.procureToday=(sl.procureToday||0)+procure;
  }
}

function endDay(){
  let income=0, expense=0, customers=0, wages=0, procure=0;
  for(const sl of state.slots){
    if(!sl.built) continue;
    const def=SHOPS[sl.type]||SHOPS.Cafe;
    income    += sl.revenueToday;
    procure   += sl.procureToday||0;       // 进货成本(被通胀推高)
    wages     += dailyWage(sl);             // 员工日薪(= 维护费 × 工资档位 × 通胀 × 运营成本系数)
    expense   += def.upkeep * state.inflation * COST_SCALE; // 维护费被通胀推高 + 运营成本系数
    customers += sl.customersToday;
    sl.customersToday=0; sl.revenueToday=0; sl.procureToday=0;
  }
  const tax=Math.round((income-procure)*taxRate()); // 营业税(对毛利计税)
  // 宏观经济: 每日更新通胀/地价/就业
  updateInflation();
  updateLandPrice();
  updateEmployment();
  // 银行债务结算: 每日计息 + 到期/坏账检查
  const loanBad=settleLoans();
  state.money += income - tax - expense - wages - procure;
  state.money = Math.round(state.money);
  state.money -= loanInt(); // 当日利息(本金不变), 取整
  state.money = Math.round(state.money);
  // 市场/股市每日结算(新闻同时生成)
  initMarket(); initStocks();
  marketTick();       // 每 3 天波动商品类别价
  stockSettle();      // 每只股票收盘涨跌 + 新闻
  // 新增投资结算: 理财兑付 / 黄金 / 加密货币 / 地产 / 产品 / 游戏工作室
  initBonds(); initGold(); initCrypto(); initProperties(); initProducts(); initDevStudio();
  bondSettle(); goldSettle(); cryptoSettle(); propertySettle(); productSettle(); gameSettle();
  // 游戏工作室: 开发进度推进 + 检查完成发售 + 随机员工事件
  if(state.devStudio&&state.devStudio.opened){
    if(state.devStudio.activeProject){
      boostDevProgress();
      const done=devProjectCheckComplete();
      if(done) releaseGame(done);
      // 每日 30% 触发员工事件(若未完成)
      if(!done) rollStaffEvent();
    }
  }
  state.totalCustomers += customers;
  if(state.money>state.peakMoney) state.peakMoney=state.money;
  const net = income - tax - expense - wages - procure - loanInt();
  const built=state.slots.filter(s=>s.built).length;
  state.negativeDays = (net<0 || loanBad || (built>0 && state.money<0)) ? state.negativeDays+1 : 0;
  // 破产判定: 连续 2 天负结余/透支 OR 当日即坏账 OR 现金深度透支(低于 BANKRUPT_DEBTH, 给拆除/借款回血窗口); 铺位已建才看资金透支
  if(state.negativeDays >= BANKRUPT_LOSS || loanBad || (built>0 && state.money<BANKRUPT_DEBTH)){ state.bankrupt = true; }
  const taxRateToday=taxRate();
  state.day++;
  state.dayTime=0;
  state.eventToday=null;
  updateSatisfaction(); // 顾客深化: 更新满意度, 影响次日回头客
  protagonistDailySettle(); // 主角: 体力回满 / 心情·饱食衰减 / 恋爱推进
  const managerResult=managerAct(); // 经理每日免费帮最弱店铺升 1 级
  const report={ day:state.day-1, customers, income, tax, taxRate:taxRateToday, expense, wages, procure,
    net: net,
    managerUpgrade:managerResult ? { type:managerResult.type, level:managerResult.level } : null,
    satisfaction:Math.round((state.satisfaction||1)*100),
    inflation:Math.round(state.inflation*100),
    employment:Math.round((state.employment||0)*100),
    debt:totalDebt(),
    loanCount:state.loans.length };
  rollDailyEvent();
  if(state.eventToday) eventNews(state.eventToday); // 事件 → 新闻
  return report;
}

function unlockNext(){
  if(state.unlockPhase >= UNLOCK_PHASES.length) return false;
  const cost = nextUnlockCost(); // 含地价/通胀修正
  if(state.money < cost) return false;
  state.money -= cost;
  state.unlockPhase++;
  return true;
}

function buildAt(x,y){
  const sl=slotAt(x,y); if(!sl||sl.built) return false;
  if(isCellLocked(x)) return false;
  // 按 SHOP_ORDER 顺序,买得起哪个建哪个
  for(const key of SHOP_ORDER){
    const def=SHOPS[key];
    if(state.money>=def.build){
      state.money-=def.build;
      sl.built=true; sl.type=key; sl.level=1;
      break;
    }
  }
  // 建造成功后, 为该铺位设默认商品(首商品)
  if(sl.built){
    const idx=state.slots.indexOf(sl);
    const list=shopGoodsList(sl.type);
    const g=list[0];
    if(g && !state.shopPrices[idx]){
      state.shopPrices[idx]={ goods:g.key, price:null };
    }
  }
  return sl.built;
}
// 指定业态建铺:优先建选中的业态;买不起则回退到"买得起的里最便宜的"(保持原有手感)
function buildAtSelected(x,y,shopKey){
  const sl=slotAt(x,y); if(!sl||sl.built) return false;
  if(isCellLocked(x)) return false;
  const want=shopKey ? SHOPS[shopKey] : null;
  let built=false;
  if(want && state.money>=want.build){
    state.money-=want.build;
    sl.built=true; sl.type=shopKey; sl.level=1;
    built=true;
  } else {
    // 回退:自动买最便宜
    built=buildAt(x,y);
  }
  // 建造成功后, 为该铺位设默认商品(首商品)
  if(built && sl.built){
    const idx=state.slots.indexOf(sl);
    const list=shopGoodsList(sl.type);
    const g=list[0];
    if(g && !state.shopPrices[idx]){
      state.shopPrices[idx]={ goods:g.key, price:null };
    }
  }
  return built;
}
// 业态收益速查(Lv1 满客流 24h 估算,含当前协同加成 + 当期税率):日净利 ≈ 日客流×单价×(1-税率) − 维护 − 工资
function shopDailyEstimate(key){
  const def=SHOPS[key];
  const hourCustomers=def.attract*FLOW_SCALE*synergyMult(key);
  const dailyRevenue=Math.round(hourCustomers*24*def.perCustomer*REVENUE_SCALE);
  const tax=Math.round(dailyRevenue*taxRate());
  const wage=Math.round(def.upkeep*wageMult()*WAGE_SCALE);
  const proc=Math.round(def.upkeep*2*PROCUREMENT_SCALE); // 进货成本估算
  const expense=Math.round(def.upkeep*state.inflation*COST_SCALE); // 维护费(通胀×运营成本)
  const net=dailyRevenue-tax-expense-wage-proc;
  const paybackDays=Math.ceil(def.build/Math.max(1,net));
  return { revenue:dailyRevenue, tax, expense, wage, net, paybackDays, profitable:net>0 };
}
function upgradeAt(x,y){
  const sl=slotAt(x,y); if(!sl||!sl.built) return false;
  const def=SHOPS[sl.type];
  if(sl.level>=def.maxLevel) return false;
  const cost=def.upBase*sl.level;
  if(state.money<cost) return false;
  state.money-=cost; sl.level++;
  if(sl.level>state.maxLevelReached) state.maxLevelReached=sl.level;
  return true;
}
function demolishAt(x,y){
  const sl=slotAt(x,y); if(!sl||!sl.built) return false;
  state.money += Math.floor(SHOPS[sl.type].build/2);
  sl.built=false; sl.type=null; sl.level=0; sl.customersToday=0; sl.revenueToday=0;
  return true;
}

function goalReached(){ return state.money>=GOAL_MONEY; }
function totalBuilt(){ return state.slots.filter(s=>s.built).length; }

function save(){
  // 不持久化日内进度: 日内计数/日内时钟每次刷新归零, 避免刷新后从日内中段"跳跃"
  const { dayTime, ...rest } = state;
  localStorage.setItem("mall_tycoon_save", JSON.stringify(rest));
}
function load(){
  const raw=localStorage.getItem("mall_tycoon_save");
  if(!raw) return false;
  try{
    const s=JSON.parse(raw);
    if(!s || typeof s!=='object') return false;
    Object.assign(state, s);
    // 兼容旧存档:缺失字段填默认
    if(state.unlockPhase===undefined) state.unlockPhase=0;
    if(state.eventToday===undefined) state.eventToday=null;
    if(state.peakMoney===undefined) state.peakMoney=state.money;
    if(state.maxLevelReached===undefined) state.maxLevelReached=0;
    if(state.totalCustomers===undefined) state.totalCustomers=0;
    if(state.negativeDays===undefined) state.negativeDays=0;
    if(state.bankrupt===undefined) state.bankrupt=false;
    if(state.payGrade===undefined || !PAY_GRADES.some(g=>g.id===state.payGrade)) state.payGrade=1;
    if(state.investLevel===undefined) state.investLevel=0;
    if(state.investLevel>INVEST.maxLevel) state.investLevel=INVEST.maxLevel;
    if(state.manager===undefined) state.manager=false;
    if(state.decorations===undefined || typeof state.decorations!=='object') state.decorations={};
    if(state.satisfaction===undefined || typeof state.satisfaction!=='number') state.satisfaction=1.0;
    if(state.inflation===undefined || typeof state.inflation!=='number') state.inflation=1.0;
    if(state.landPriceMult===undefined || typeof state.landPriceMult!=='number') state.landPriceMult=1.0;
    if(state.employment===undefined || typeof state.employment!=='number') state.employment=0.0;
    if(state.priceIndex===undefined || typeof state.priceIndex!=='number') state.priceIndex=1.0;
    if(!Array.isArray(state.loans)) state.loans=[];
    else state.loans=state.loans.filter(l=>l && typeof l.balance==='number' && l.balance>0); // 旧贷款余额校验
    if(state.shopPrices===undefined || typeof state.shopPrices!=='object') state.shopPrices={};
  else {
    // 旧档 goods 可能是数值索引或旧 GOODS key, 归一化为当前商品 key
    for(const k in state.shopPrices){
      const p=state.shopPrices[k];
      const sl=state.slots[+k];
      if(!sl) continue;
      if(typeof p.goods==='number'){
        const list=shopGoodsList(sl.type);
        p.goods=list[Math.min(p.goods,list.length-1)].key;
      }
      if(!shopGoodsList(sl.type).some(g=>g.key===p.goods)) p.goods=shopGoodsList(sl.type)[0].key;
    }
  }
    if(!Array.isArray(state.achievements)) state.achievements=[];
    // 兼容旧 "gridUnlocked"(true) → unlockPhase=1
    if(s.gridUnlocked===true && state.unlockPhase===0) state.unlockPhase=1;
    // 多地图兼容: 旧档无 state.map → 默认主街道(0)
    if(state.map===undefined) state.map=0;
    // 校验 slots 数组完整性(损坏/旧版存档时逐格兜底, 从 12 扩容到 TOTAL_SLOTS=26)
    const want=TOTAL_SLOTS;
    if(!Array.isArray(state.slots) || state.slots.length!==want){
      const oldSlots=Array.isArray(state.slots)?state.slots:[];
      state.slots=Array.from({length:want}, (_,i)=>{
        const d={built:false,type:null,level:0,customersToday:0,revenueToday:0};
        if(oldSlots[i]) Object.assign(d, oldSlots[i]);
        if(d.built && !(d.type in SHOPS)){ d.built=false; d.type=null; d.level=0; }
        d.customersToday=0; d.revenueToday=0;
        return d;
      });
    } else {
      for(let i=0;i<want;i++){
        const d={built:false,type:null,level:0,customersToday:0,revenueToday:0};
        Object.assign(d, state.slots[i]||{});
        if(d.built && !(d.type in SHOPS)) { d.built=false; d.type=null; d.level=0; }
        d.customersToday=0; d.revenueToday=0;
        state.slots[i]=d;
      }
    }
    if(!Array.isArray(state.news)) state.news=[];
    initMarket();
    initStocks();
    // 主角系统兼容: 旧档无 protagonist → 补默认主角(负债开局)
    if(!state.protagonist || typeof state.protagonist!=='object'){
      state.protagonist=defaultProtagonist();
    } else {
      const p=state.protagonist;
      p.maxEnergy=protagonistMaxEnergy();
      if(p.energy===undefined) p.energy=p.maxEnergy;
      if(p.mood===undefined) p.mood=50;
      if(p.hunger===undefined) p.hunger=100;
      if(p.jobDays===undefined) p.jobDays=0;
      if(p.assets===undefined || typeof p.assets!=='object') p.assets={};
      if(p.romance===undefined) p.romance=null;
      if(p.romanceLevel===undefined) p.romanceLevel=0;
      if(p.friends===undefined || typeof p.friends!=='object') p.friends={};
      if(p.gender===undefined) p.gender='male';
      if(p.genderChosen===undefined) p.genderChosen=(state.totalCustomers>0 || state.day>1 || state.slots.some(s=>s.built)); // 老档=已选定
      if(p.cgSeen===undefined || typeof p.cgSeen!=='object') p.cgSeen={};
      if(p.minigames===undefined || typeof p.minigames!=='object') p.minigames={};
    }
    return true;
  }catch(e){ return false; }
}
function resetSave(){
  Object.assign(state,{
    money:-3000, day:1, dayTime:0,
    unlockPhase:0, eventToday:null,
    peakMoney:-3000, maxLevelReached:0,
    totalCustomers:0, negativeDays:0, bankrupt:false,
    achievements:[],
    payGrade:1,
    investLevel:0,
    manager:false,
    decorations:{},
    satisfaction:1.0,
    inflation:1.0,
    landPriceMult:1.0,
    employment:0.0,
    priceIndex:1.0,
    loans:[],
    shopPrices:{},
    map:0,
    marketMult:{coffee:1,retail:1,food:1,service:1,fun:1,tech:1},
    marketHist:{coffee:[1],retail:[1],food:[1],service:[1],fun:[1],tech:[1]},
    stocks:{coffee:100,retail:100,food:120,med:150,tech:80,bank:200},
    stockHoldings:{},
    stockHist:{coffee:[100],retail:[100],food:[120],med:[150],tech:[80],bank:[200]},
    news:[],
    protagonist:defaultProtagonist(),
    slots:Array.from({length:TOTAL_SLOTS},()=>({built:false,type:null,level:0,customersToday:0,revenueToday:0}))
  });
  localStorage.removeItem("mall_tycoon_save");
}

// ---- 主角系统 API 暴露到 window(供 hero-system.js 独立脚本访问) ----
if(typeof window!=='undefined'){
  window.state=state;
  window.SHOPS=SHOPS;
  window.WORK_JOBS=WORK_JOBS;
  window.CONSUMABLES=CONSUMABLES;
  window.ROMANCE_NPCS=ROMANCE_NPCS;
  window.romancePool=romancePool;
  window.romanceStory=romanceStory;
  window.romanceUnlocks=romanceUnlocks;
  window.STORY_UNLOCK=STORY_UNLOCK;
  window.STORY_LABELS=STORY_LABELS;
  window.ROMANCE_CGS=ROMANCE_CGS;
  window.cgUnlocked=cgUnlocked;
  window.cgsOf=cgsOf;
  window.allCGs=allCGs;
  window.cgCount=cgCount;
  window.cgEventText=cgEventText;
  window.cgNewEvents=cgNewEvents;
  window.cgMarkSeen=cgMarkSeen;
  window.setGender=setGender;
  window.doWork=doWork;
  window.buyConsumable=buyConsumable;
  window.giftToNPC=giftToNPC;
  window.proposeTo=proposeTo;
  window.workJobPay=workJobPay;
  window.jobUnlocked=jobUnlocked;
  window.protagonistMaxEnergy=protagonistMaxEnergy;
  window.shopsBuiltOf=function(k){ return state.slots.some(s=>s.built&&s.type===k); };
  // 市场/股市/新闻 API
  window.MARKET_CATS=MARKET_CATS;
  window.STOCK_DEFS=STOCK_DEFS;
  window.marketCatOfShopTag=marketCatOfShopTag;
  window.shopMarketMult=shopMarketMult;
  window.marketRoll=marketRoll;
  window.marketTick=marketTick;
  window.initMarket=initMarket;
  window.initStocks=initStocks;
  window.stockSettle=stockSettle;
  window.buyStock=buyStock;
  window.sellStock=sellStock;
  window.stockValue=stockValue;
  window.addNews=addNews;
  window.eventNews=eventNews;
  // 新增投资品种: 理财/黄金/加密货币/地产/产品设计
  window.BOND_TYPES=BOND_TYPES;
  window.GOLD=GOLD;
  window.CRYPTO_DEFS=CRYPTO_DEFS;
  window.PROPERTY_DEFS=PROPERTY_DEFS;
  window.initProducts=initProducts;
  window.startProductDesign=startProductDesign;
  window.productDesignDone=productDesignDone;
  window.productSettle=productSettle;
  window.productTotalValue=productTotalValue;
  window.initBonds=initBonds;
  window.buyBond=buyBond;
  window.bondSettle=bondSettle;
  window.bondValue=bondValue;
  window.initGold=initGold;
  window.goldSettle=goldSettle;
  window.buyGold=buyGold;
  window.sellGold=sellGold;
  window.goldValue=goldValue;
  window.initCrypto=initCrypto;
  window.cryptoSettle=cryptoSettle;
  window.buyCrypto=buyCrypto;
  window.sellCrypto=sellCrypto;
  window.cryptoValue=cryptoValue;
  window.initProperties=initProperties;
  window.buyProperty=buyProperty;
  window.sellProperty=sellProperty;
  window.propertySettle=propertySettle;
  window.propertyValue=propertyValue;
  // 季节
  window.seasonOf=seasonOf;
  window.seasonMult=seasonMult;
  // 总财富(钱+股票+理财+黄金+加密货币+地产)
  window.totalWealth=function(){
    let w=state.money;
    try{ w+=window.stockValue?stockValue():0; }catch(e){}
    try{ w+=window.bondValue?bondValue():0; }catch(e){}
    try{ w+=window.goldValue?goldValue():0; }catch(e){}
    try{ w+=window.cryptoValue?cryptoValue():0; }catch(e){}
    try{ w+=window.propertyValue?propertyValue():0; }catch(e){}
    return Math.round(w);
  };
  // 主角扩展 API
  window.EXTRA_JOBS=EXTRA_JOBS;
  window.EXTRA_CONSUMABLES=EXTRA_CONSUMABLES;
  window.SIDE_GIG=SIDE_GIG;
  window.minigameSettle=minigameSettle;
}
