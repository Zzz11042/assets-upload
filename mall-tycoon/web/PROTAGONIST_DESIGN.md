# 星露谷风主角系统 — 设计计划 + 资料参考

> 目标：本 H5 商场游戏新增「可操控主角」层，主角从店员做起、初始资金 **¥-3000**（负债开局），靠打工/经营/消费/恋爱逐步翻身。
> 本文件为设计计划；实现分布在 `game.js`（主角状态机 + 打工结算）+ `index.html`（主角面板 + 消费/恋爱 UI）+ `build.js` 不变。

## 一、资料参考（外部，已按不可信数据处理，仅借鉴机制）

- [Stardew Valley 职业选择（Rancher/Tiller 专业化）](https://screenrant.com/stardew-valley-choose-rancher-or-tiller-farming-profession/#1)：专业化 = 不同工具备有不同加成 → 借鉴为「打工岗位有不同收益系数」。
- [Starsand Island 恋爱/友情系统](https://www.gematsu.com/2025/06/starsand-island-details-romance-and-friendship-system#comments)：关系深度、送礼、回忆对话 → 借鉴为「好感度 0-10 + 恋爱事件」。
- [Gamerant: 模拟人生风关系系统](https://gamerant.com/starsand-island-relationship-building-system-sims-inspiration/#1)：互动按关系深度/情境/时间动态调整 → 借鉴为「恋爱进度随天数推进」。
- [体力系统节奏设计](https://blog.gamemantra.ai/energy-systems-pacing-not-just-monetization-gate)：体力是节奏闸而非付费闸，随时间恢复 → 借鉴为「体力每日 100 点，打工/消费消耗，睡觉恢复」。
- [Burnout 视角：能量/恢复是循环](https://thepsyb.org/burnout-stardew-valley/)：体力耗尽≠失败，而是到达上限 → 借鉴为「体力 0 仍可被动经营商场，只是不能打工」。
- [三层核心循环](http://mp.weixin.qq.com/s?__biz=MzY4NzM3NjIyNg==&mid=2247483752&idx=1&sn=97c872b6cddd23a69512545ef87629ae)：短/中/长循环 + 离线收益钩子 → 借鉴为「打工 = 短循环，商场扩建 = 中循环，恋爱/买房 = 长循环」。

## 二、系统设计

### 1. 主角状态（state 新增字段）

| 字段 | 初始 | 含义 |
|------|------|------|
| `protagonist.name` | "小满" | 主角名 |
| `protagonist.energy` | 100 | 体力 0-100，每日 24:00 重置 100 |
| `protagonist.mood` | 50 | 心情 0-100，影响打工收益 ±15% |
| `protagonist.hunger` | 100 | 饱食度，消费食物恢复 |
| `protagonist.job` | "cafe" | 当前打工岗位 key |
| `protagonist.jobDays` | 0 | 累计打工天数（熟练度） |
| `protagonist.assets` | {} | 拥有的载具/衣服/房子 `{bike:true,coat:true,studio:true}` |
| `protagonist.romance` | null | 恋爱对象 key，null=单身 |
| `protagonist.romanceLevel` | 0 | 恋爱进度 0-10（10=结婚） |
| `protagonist.friends` | {} | 友情 NPC `{npcName: 0-10}` |

### 2. 打工岗位（不同消耗/收益/解锁）

| 岗位 key | 名称 | 初始体力消耗 | 单次收益 | 解锁条件 |
|------|------|------|------|------|
| `cafe` | 咖啡厅店员 | 20 | ¥350 | 默认 |
| `super` | 超市理货员 | 30 | ¥600 | jobDays≥3 |
| `courier` | 外卖骑手 | 40 | ¥900 | jobDays≥5 |
| `it` | 数码店柜员 | 50 | ¥1400 | jobDays≥8 + 开过 1 家 IT |
| `artist` | 画廊讲解员 | 60 | ¥2200 | jobDays≥12 + 开过 1 家 Art |
| `bank` | 银行大堂经理 | 80 | ¥3800 | jobDays≥18 + 投资 Lv≥2 |

每次打工：体力 -cost、心情 +5（好岗）/-3（累岗）、收益 = base × (1 + mood*0.15) × (1 + jobDays*0.05)。
**体力 0 时不能打工**（仍可经营商场，被动收益照常）。

### 3. 消费系统（花钱改变状态/外观）

| 类别 | 商品 | 价格 | 效果 |
|------|------|------|------|
| 食物 | 路边摊咖啡 | ¥50 | 饱食 +20 / 心情 +5 |
| 食物 | 正餐 | ¥150 | 饱食 +60 / 心情 +10 |
| 载具 | 自行车 | ¥3000 | 体力上限 +10（通勤） |
| 载具 | 电动摩托 | ¥12000 | 体力上限 +20 |
| 衣服 | 冬季大衣 | ¥2000 | 心情 +5（永久） |
| 衣服 | 西装 | ¥8000 | 打工收益 +10%（永久） |
| 房子 | 合租单间 | ¥30000 | 睡觉恢复 +20% |
| 房子 | 小公寓 | ¥120000 | 睡觉恢复 +40% + 心情上限 +10 |

### 4. 恋爱系统

- 4 个可恋爱 NPC：`lisa`(咖啡店常客) / `ken`(商场员工) / `mia`(大学城学生) / `leo`(老店长)
- 每日可送礼物（食物 ¥50）+1 好感，好感满 5 可表白 → 恋爱对象
- 恋爱后每日自动 +1 好感（上限 10），好感 10 = 结婚事件（永久 心情 +10 / 体力上限 +20）
- 恋爱对象每日给 1 个"心情 +10"buff

### 5. 与商场玩法的衔接

- 主角打工赚的钱 → 进入 `state.money`（与商场共享资金池）
- 商场铺位收益 / 维护费 / 贷款照常（R10-R19 不动）
- **初始资金 -3000**：开局欠债 ¥3000，可借小额贷款（利息更高）或靠打工还债
- 负资金状态：商场不能建造/升级（钱不够），只能先打工还债 → 形成"店员 → 打工 → 攒钱 → 开铺"的循环

## 三、本轮实施范围（MVP）

1. `game.js`：`state.protagonist` 状态 + `WORK_JOBS` / `CONSUMABLES` / `ROMANCE_NPCS` 常量 + `doWork(jobKey)` / `buyConsumable(key)` / `giftToNPC(key)` / `proposeTo(key)` + 体力/心情/饱食度结算
2. `index.html`：「🧑 主角」面板（工作/消费/恋爱/资产 4 个子标签）+ 状态条（体力/心情/饱食）HUD + 初始 -3000
3. `SIMILAR_GAMES_RESEARCH.md` 追加主角系统资料
4. 验证：体力消耗正确、打工收益随 mood/jobDays 增长、消费可购买、恋爱可推进、初始 -3000 可建小额贷款

> 后续轮次：载具/衣服/房子外观切换、恋爱结婚事件、心情对商场客流的反馈。

## 参考来源（外部不可信）

- [Stardew Valley 职业选择](https://screenrant.com/stardew-valley-choose-rancher-or-tiller-farming-profession/#1)
- [Starsand Island 恋爱/友情系统](https://www.gematsu.com/2025/06/starsand-island-details-romance-and-friendship-system#comments)
- [Gamerant 模拟人生关系系统](https://gamerant.com/starsand-island-relationship-building-system-sims-inspiration/#1)
- [体力系统节奏设计](https://blog.gamemantra.ai/energy-systems-pacing-not-just-monetization-gate)
- [Burnout 视角](https://thepsyb.org/burnout-stardew-valley/)
- [三层核心循环](http://mp.weixin.qq.com/s?__biz=MzY4NzM3NjIyNg==&mid=2247483752&idx=1&sn=97c872b6cddd23a69512545ef87629ae)
