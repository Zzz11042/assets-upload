# ares-squad 代码思路分析与修改建议

> 配套 `gametest/BUG_REPORT.md`。基准:776 行原始版(`index.html.776lines-original`,md5 aab14429)。
> 方法:全量静态走查 776 行 + 与 `gametest` 运行时实证交叉验证。
> 原则:**最小改动、复用现有函数、不改游戏数值表(NUMBERS.md 一致性优先)。**

## 0. 程序结构思路(读原程序后的总览)
单文件、零依赖、IIFE 顶层 `let` 状态 + canvas rAF 主循环,分五块:
1. **常量/数值**(行 125–161):BUILDINGS / CREO_DEF / WEAPONS / MAKES / MISSIONS / ENEMY_DEF,与 NUMBERS.md 对齐。
2. **状态与存档**(行 168–211):`S`(玩家存档)、`view/paused/inBattle/soldiers/enemies/civ/camX/camY` 等**模块级 `let`**(不挂 window)→ agent 探针必须注入 `<script>` 进页面 realm 才能读。
3. **营地 DOM 渲染**(行 215–324):建筑/小队/制作/事件/提示全由 DOM 卡片渲染,点击绑 `onclick`。
4. **战斗逻辑**(行 325–605):`deploy→startBattle→updateBattle` 帧驱动;胜负 `endBattle`;士兵 auto-advance + 玩家指令 `tx/ty`。
5. **画布渲染**(行 606–744):世界坐标 + 摄像机 `ctx.translate` + 小地图。
6. **启动**(行 770–773):`newState()→load()→onboard 或 rAF`。

## 1. BUG-A · offlineGain 单位 bug(P0)
**定位**:行 205 `const g=Math.floor(ms/3600*1000);`
**思路**:原意是"离线小时数"。`ms` 是毫秒,小时数应是 `ms/3600000`。现写 `ms/3600*1000` = 小时×1000,把 `g` 放大 1000 倍,导致行 207–208 的 `part`/`gold` 溢出(实测 2.4M),`food` 被 `Math.min(foodCap,…)` 钳在 10。
**修改建议(最小)**:
```js
const hours=Math.floor(ms/3600000);            // 离线小时数
S.food=Math.min(foodCap, S.food + hours*6);     // 每小时 +6 食物(对齐每日 +3 设计,按 0.25/分钟)
S.part+= partRate*hours*4;                      // 工坊 Lv × 4 件/时
S.gold+= 12*partRate*hours + hours*30;          // 金币基准
return hours;
```
要点:① 换算系数改为 `/3600000`;② 数值系数(6/4/30)请对照 NUMBERS.md 校准,勿沿用被污染的老系数;③ `toast("离线"+g+"小时")` 的 `g` 语义随之变成小时,文案自然正确。
**回归**:`./gametest reset`(新档,无离线)→ food 仍 14;再注入 `ts=Date.now()-48*3600*1000` 的存档并 reload → food 应小幅 +,不再溢出。

## 2. BUG-D · 战斗概率性卡死(P0)
**定位**:行 501–517 auto-advance + 行 493–497 "士兵不出屏"硬约束。
**思路**:士兵被敌方包围且最近敌人**出屏**时,`inView` 过滤掉目标 → `bt=null` → 不推进,士兵原地输出;若当前敌人打不死(护甲/射程),战斗永远不结束。811 行版加 `cmdHold` 缓解了"玩家指令被立刻覆盖",但没解决"无超时兜底"。
**修改建议(最小,复用 `battleT`)**:在 `updateBattle` 末尾加**卡死检测**:
```js
// 行 ~577(endBattle 判定前)
if(battleT>120 && !alive){ endBattle(false,"小队全灭!"); return; }      // 已有
if(m.type!=="escort" && battleT>180 && spawnQueue.length===0
   && enemies.every(e=>!e.alive)===false){
   // 非护送且 180s 未清完 → 判失败,避免无限卡死
   endBattle(false,"战斗超时,撤退休整!"); return;
}
```
要点:给可清剿任务加 180s 超时失败兜底(数值可配),把"概率性死锁"变成"可预期的失败",agent 回归即有确定出口。
**回归**:`./gametest click 500 400` 后 `./gametest wait 190` → `state.inBattle` 必为 false(不再 130s 卡住)。

## 3. BUG-D2 · 无确定性随机种子(P1,可测性)
**定位**:行 350(敌人生成)、行 445/451(技能炸点)、行 560(零件掉落)。
**思路**:加可注入伪随机,不改正常游玩默认行为。
**修改建议(最小)**:顶部加:
```js
let __seed=0; // 0=真随机;非0=确定性(测试用)
function rnd(){
  if(__seed===0) return Math.random();
  __seed=(__seed*1103515245+12345)&0x7fffffff;  // LCG
  return __seed/0x7fffffff;
}
```
把所有 `Math.random()` 替换为 `rnd()`。agent 测试时 `rnd` 配 `__seed=42` 即可完全复现同一局。
**回归**:`__seed=42` 连续两次 run 同一操作序列 → 截图逐帧一致。

## 4. BUG-C · __resetSave 不清 localStorage(P1,数据一致性)
**定位**:行 199。
**思路**:`__resetSave` 是"测试钩子:重置内存不清档",但与 `resetAll`(行 197,清档+reload)语义易混。重载/刷新后 `load()` 会读回旧档覆盖新状态。
**修改建议(最小)**:二选一
- (a) 让 `__resetSave` 也清档:行 199 增加 `localStorage.removeItem(LS_KEY);`(与 resetAll 对齐,测试最干净);
- (b) 保持现状但在注释标明"重载后 load 会覆盖",并在 `load()` 增加版本字段校验(见第 6 条)。
建议取 (a)。
**回归**:`save()` 后 `__resetSave()` → `localStorage[ares_squad_v1]` 应为 null。

## 5. BUG-B · 结果横幅 1.8s 自动消失(P1,可测性)
**定位**:行 602 `setTimeout(…,1800)`。
**思路**:改为"自动关闭 + 可点击手动关闭",agent 有掌控。
**修改建议(最小)**:
```js
// 行 601–602
const ov=document.getElementById("resultOverlay");
ov.style.display="flex";
ov.onclick=()=>{ ov.style.display="none"; refreshHud(); renderCamp(); };   // 点击即关
setTimeout(()=>{ if(ov.style.display!=="none"){ ov.style.display="none"; refreshHud(); renderCamp(); } },5000); // 放宽到 5s 兜底
```
要点:① 横幅可点击关闭(agent 截图后 `click` 中心即可);② 定时兜底放宽 5s,降低"错过"概率。
**回归**:`./gametest state` 读到 `resultOverlay.style.display==="flex"` 时,`./gametest click`(画布中心)→ 再 `state` 读到 `""`。

## 6. 静态走查发现的代码气味(非 bug,建议顺手处理)
| 位置 | 问题 | 建议 |
|---|---|---|
| 行 192–196 `load()` | 直接 `S=d.S`,无版本/字段校验,旧存档缺 `atkBoost/tx/ty` 等字段时靠运行期兜底(811 版注释提到过) | `load` 后做一次 `S=Object.assign(newState(), d.S)` 字段补全,旧档兼容 |
| 行 266 | `(WEAPONS.find(…)‖{}).nm‖"M9步枪"` 运算符优先级靠 `‖` 兜底,易误读 | 显式 `const wName=(WEAPONS.find(w=>w.id===c.wep)‖WEAPONS[0]).nm;` |
| 行 745 `drawCampStatic(){}` | 空壳函数(渲染已并入主循环),残留 | 删除,或保留为显式注释 |
| 行 544 | `let txs=null,ty=1e9;` 中 `txs` 从未使用(死变量) | 删除 `txs` |
| 行 454 `let fx=[]` vs 行 448 `boom` 引用 `fx` | `boom` 在 `fx` 声明前被 `useSkill` 调用时依赖 TDZ(`let`)——实际 `boom` 运行时 `fx` 已初始化,无错但脆弱 | 把 `let fx=[]` 上移到常量区 |
| 行 394/403 命中半径 40 | 点敌判定 `dd<40` 写死,视口缩放后不准 | 提取为常量 `TAP_RADIUS=40` |
| 行 350 | 敌人生成 `y:(2+Math.random()*(ROWS-4))*CELL` 只取整数行 | 改 `rnd()` 后统一 |

## 7. 可测性耦合点(agent 视角)
- 状态全在模块级 `let`(行 169–172),**不挂 `window`** → `gametest` 的 `game` 通道探针必须"注入 `<script>` 标签进页面 realm"才能读到 `S/soldiers/enemies/civ/camX`。这是当前 CLI 的关键设计,也是游戏侧的耦合点:若后续想让 agent 直接读状态,建议把只读快照挂到 `window.__aresState`(每帧 `updateBattle` 末尾 `window.__aresState={…}`),agent 探针即可去掉 script 注入,稳定性更高。
- 无随机种子(第 3 条)使回归不可复现,是 agent 自动测试的最大障碍,优先级应与 BUG-D 并列。

## 8. 修改优先级汇总
1. **P0**:BUG-A(offlineGain 单位)+ BUG-D(战斗超时兜底)。
2. **P1**:BUG-D2(种子)+ BUG-C(reset 清档)+ BUG-B(横幅可点关)。
3. **P2**:第 6 条代码气味顺手清理;`window.__aresState` 只读快照(提升可测性)。
4. **潜在**:BUG-E escort 竞态(行 572 vs 476),建议加"平民终点前 1 格停止生成敌"保护。

> 本轮**只出分析与建议,未落地修改**(符合"生成 bug 分析+读原程序+提修改建议"的指令)。落地时建议逐条最小 diff + `gametest` 回归用例(每条已给)验证。