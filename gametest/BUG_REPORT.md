# ares-squad 测试后 Bug 清单(实证)

> 被测目标:`ares-squad/web/index.html`(776 行原始版,快照 `index.html.776lines-original`)。
> 测试工具:`gametest`(geckodriver + headless Firefox + 拟人 DOM 事件 + 截图回传)。
> 测试日期:2026-10-22。每条含:现象 / 复现命令 / 截图 / 实测数据。

---

## 版本说明(重要)
测试中发现 `index.html` 在 10:06 被误写成 37 字节占位符(`// (占位 - 实际由 read 后 edit)`),
完整 776 行源码已从**本会话 DSH 事件历史**(`session_event_read` seq 52/67/72)逐行重建,
并保留三份快照:
- `index.html.776lines-original` —— 776 行原始版(本报告以它为准)
- `index.html.enhanced-811lines` —— 811 行增强版(已加 `cmdHold` 全队指令/摄像机改进,未作为基准)
- `index.html.bak-20261022-776` / `index.html.bak-20261022-811` —— 备份

---

## BUG-A(严重:数值)· 离线收益单位 bug 导致金币/食物溢出
**现象**:长期离线(或 lastSave 被置远)后重开,`gold` 暴涨到 2.4M+,`food` 被钳制在 10(远低于 foodCap 设计)。
**复现**(776 行版):
```
./gametest start --url "file://…/index.html.776lines-original"
./gametest reset            # 清档 → gold 160 food 14
./gametest click-elem "#btnDeploy"
# 等待 mission1 胜利(约 20–35s,随机)
./gametest state            # 读 food/gold
```
**实测**:开局 `food:14, gold:160`;任务1胜后 `food:13, gold:2400340`(预期 food=14+4-1=17,gold=160+140=300)。
**根因**:行 205 `const g=Math.floor(ms/3600*1000);` 把毫秒当小时再乘 1000,`g` 放大 1000 倍;
行 207–208 `part+=partRate*g*0.4` / `gold+=…+g*0.3` 随之溢出。`food` 因 `Math.min(foodCap,…)` 被钳在 10。
**严重级**:P0(经济系统崩溃)。

## BUG-A2(中:数值)· 胜利分支食物扣减与奖励叠加逻辑需核对
**现象**:胜利路径 `S.food=Math.max(0,S.food-1)`(行 616)与奖励 `S.food+=r.food`(行 615)顺序正确,
但受 BUG-A 离线污染后 baseline 已失真,难以单独判定胜利分支本身是否合理。
**判定**:本条并入 BUG-A 统一修复(先修 offlineGain,再回归)。

## BUG-B(中:交互/可测性)· 结果横幅 1.8s 自动消失,agent 截图窗口难命中
**现象**:`endBattle` 末尾 `setTimeout(()=>{…display="none"…},1800)`(行 602)。
agent 需恰好在 1.8s 窗口内调用 `shot` 才能拍到"✅任务完成/❌失败"横幅,否则错过。
**复现**:战斗结束前后各截图,对比 `shot/s1_step007.png`(窗口内)与 `shot/s1_step008.png`(窗口后)——横幅消失。
**实测**:两次 `state` 读到 `resultOverlay.style.display` 由 `flex`→`none`。
**影响**:自动化回归对"胜利/失败横幅"这一关键视觉反馈不可靠。
**严重级**:P1。

## BUG-C(中:存档)· `__resetSave` 不清 localStorage,重载即被旧档覆盖
**现象**:`__resetSave()` 只把内存 `S` 重置为 `newState()`,**保留** `localStorage[ares_squad_v1]`。
一旦后续触发 `location.reload()`(如 `resetAll` 路径或浏览器刷新),启动代码 `load()` 会把旧档读回,
`S` 被旧档覆盖 → "重开"失效。
**复现**(注入 `<script>` 进页面 realm):
```
save() → localStorage len=355
__resetSave() → S.mission=1,但 localStorage 仍 len=355(未清)
resetAll() → location.reload(),重载后 localStorage="none"(resetAll 才真清)
```
**实测**:`__resetSave` 后 `ls:355`(未清);`resetAll` 后 `ls:'none'`(真清)。
**根因**:行 199 注释自述"测试钩子:重置为新存档(不清 localStorage)"——这是有意保留,但与 `resetAll` 行为不一致,易误用。
**严重级**:P1(可测性/数据一致性)。

## BUG-D(高:战斗)· 战斗概率性卡死,无超时/救援机制
**现象**:任务1(清剿)随机分支下,士兵被敌方包围后 `auto-advance` 失效,战斗可卡 100s+(实测一次 `battleT=130.7s` 未结束)。
**复现**(776 行版):
```
./gametest reset → click-elem "#btnStart" → click-elem "#btnDeploy"
./gametest click 500 400     # 误点左侧空地,士兵移动指令
./gametest wait 35 → state   # 观察 inBattle 是否仍 true
```
**实测**:本次随机分支 35s 内通关(mission 2),但**早期一次实测 `battleT=130.7s` 仍 inBattle=true、nenemies=4**,
证实卡死为**概率性**(取决于敌人生成位置 `Math.random` 与士兵初始 hp)。无"卡死超时自动推进/失败判定"兜底。
**严重级**:P0(回归不可复现)。

## BUG-D2(设计)· 无确定性随机种子,agent 回归不可复现
**现象**:全游戏 `Math.random()` 裸调(行 350 敌人生成、行 445/451 技能、行 560 零件掉落),
无 `__seed` 注入点 → 同一操作序列两次运行结果不同,bug 难稳定复现。
**严重级**:P1(可测性)。

## BUG-E(低:数值核对)· escort 终点判定与末段敌人生成同帧竞争
**现象**:行 572 `if(civ.x>=WORLD_W-CELL) endBattle(true)`,而行 476 敌人生成 `ex=Math.min(WORLD_W-CELL, camX+VIEW_W-CELL)`。
任务2(护送)中,平民接近终点时若末段生成敌与平民同 x,存在"平民已赢判定"与"敌攻击平民"同帧顺序依赖。
**实测**:任务2曾成功通关(mission=3),未触发该竞态,列为**潜在**风险。
**严重级**:P2(潜在)。

## 实测截图归档
| 文件 | 说明 |
|---|---|
| `shot/s1_step005.png` | 战斗画面(任务) |
| `shot/s1_step007.png` | 结果横幅窗口内(1.8s 前) |
| `shot/s1_step008.png` | 结果横幅窗口后(已消失) |

---

## 结论
- 共 6 条:2×P0(经济溢出、战斗卡死不可复现)、3×P1(横幅窗口、存档覆盖、无种子)、1×P2(竞态潜在)。
- 其中 BUG-D 在 811 行增强版(`cmdHold` + 摄像机改进)中**部分缓解**,但未彻底解决(仍需"卡死超时"兜底与确定性种子)。
- 详细代码思路分析与最小改动建议见 `ares-squad/web/BUG_ANALYSIS.md`。