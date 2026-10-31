# 玩法 & 投资扩展方案

> 现状盘点：市场(6 类别) / 股市(6 只股, 每日收盘 ±5%+事件) / 新闻 / 增长基金(5 级) / 打工(基础 9 种+私活+小游戏) / 消费 / 恋爱 CG / 建筑覆盖。
> 业界参考：[Investor Empire](https://idledb.com/ios/game/com.investorempire.app/investor-empire-idle)（股票+债券+加密货币+房地产组合）/ [Hero Investor](https://store.steampowered.com/app/5062780/Hero_Investor_Business_Tycoon/)（基金/REIT/商品/替代投资）/ [Golden Tycoon](https://apptopia.com/ios/app/6786546375/about#1)（股票+加密货币+房地产三市场联动）。
> 设计原则：每条投资都有**独立波动节奏 + 与新闻/事件联动 + 一个 UI 标签页**，复用现有 `endDay`/`addNews`/`_renderEcoExtTab` 框架，单文件可热改。

## 一、投资种类扩展（ecoPanel 新增 4 个 Tab）

### 1. 债券/理财 Tab（防守端）
- 3 档期限：7 天（年化 2%）/ 30 天（年化 4%）/ 90 天（年化 7%）
- 到期自动回款 + 利息（`state.bonds:[{type,principal,dueDay,rate}]`，`endDay` 检查 dueDay 兑付）
- 联动：通胀日（inflation 事件）短期债券利率 +50%；通缩日长期 +50%
- 风险：0（保本）→ 给紧张期玩家"存钱避险"出口
- 成本：低（无实现复杂度），纯 UI+结算钩子

### 2. 黄金/贵金属 Tab（避险端）
- `state.gold` 数量 + 价格每日波动 ±3%（独立于股市，受 `state.riskAversion` 影响：股市大跌日黄金涨）
- 买入/卖出，与股票负相关 → 对冲工具
- 联动新闻："金价受避险情绪推高 X%"
- 成本低，复用 `stockSettle` 框架改成 `commoditySettle`

### 3. 加密货币 Tab（高风险端）
- 3 种币：BZC(山寨币，日波动 ±15%)/STAB(稳定币，±0.5%)/AI(高波动，±25%)
- 与 `tech` 股票正相关（科技事件日 +5%）
- 高收益高风险：单日可能翻倍，也可能腰斩
- 成本中，复用 `STOCK_DEFS` 的 vol 字段逻辑

### 4. 房地产/REIT Tab（资产端）
- 3 档物业：小公寓(年化 3%)/写字楼(年化 5%)/商铺(年化 8%+空置率风险)
- `state.properties` 持有数 + 租金每日结算 + 物业波动价(与零售市联动)
- 空置率：每月随机 10-40% 空置 → 模拟"商铺不租满"
- 成本中，需要新的 `endDay` 结算 + 与 SHOP 客流联动的可选简化版
- **可选**：让"商铺"投资直接给某地图客流 +5%，与主游戏强联动

## 二、玩法扩展（3 条，按优先级）

### P0：连锁商店/总部建筑
- 新增 1 个"总部"铺位类型(26 铺位中 1 格专属)，建后解锁"分店"机制：
  - 同业态每多 1 家分店，基础客流 +2%（连锁效应），上限 10%
  - 总部等级(1-5)：每级解锁 1 个总部特权(工资 -5% / 维护 -5% / 促销成本 -10% / 客流 +3% / 税率 -2%)
- 成本中，需要新 `HQ_SHOP` 常量 + 总部等级持久化 + 1 个"连锁"面板
- **价值**：给"后期"明确目标（现在达到 GOAL_MONEY 10 万后没事干）

### P1：季节/天气影响（与事件联动强化）
- 现有 `EVENTS` 是随机日事件；扩展：每月(30 天)进入 1 个季节（春/夏/秋/冬）
- 每季修正：夏 `food/fun` +15% / 冬 `coffee/retail` +10% / 春 `tech` 股票 +3% / 秋全客流 +5%
- 成本极低（`state.season=day/30%4` + 3 行修正逻辑）

### P2：排行榜/成就扩展
- 现有 14 个成就；加 6 个新成就（债券满仓 / 黄金保值 / 加密货币翻倍 / 房地产满编 / 连锁 5 店 / 季节穿越）
- 复用 `ACH` 常量 + 检测钩子

## 三、实施路线（建议 1-2 轮完成 P0+P1，另 1 轮完成投资 4 Tab）

| 顺序 | 任务 | 涉及文件 | 估时 |
|---|---|---|---|
| 1 | 季节/天气修正(P1) | game.js | 0.5h |
| 2 | 债券 Tab(1.1) | game.js+index.html | 1h |
| 3 | 黄金 Tab(1.2) | game.js+index.html | 1h |
| 4 | 加密货币 Tab(1.3) | game.js+index.html | 1.5h |
| 5 | 房地产 Tab(1.4) | game.js+index.html | 2h |
| 6 | 连锁总部(P0) | game.js+index.html+buildings.js | 3h |
| 7 | 新成就(P2) | game.js | 0.5h |

## 四、UI 改动
- `ecoPanel` 子 Tab：市场 / 股市 / 新闻 / **理财 / 黄金 / 加密货币 / 房产**（共 7 个，横向滚动）
- 资产面板（主角）新增 4 块：理财余额 / 黄金市值 / 加密货币市值 / 房产市值
- 顶部 HUD 新增 1 个"财富总值"chip（钱 + 股票 + 理财 + 黄金 + 加密货币 + 房产）

## 五、数据模型新增字段
```
state: {
  bonds:[{type,principal,dueDay,rate}],
  gold:{qty,price,hist:[]},
  crypto:{bzq:0,stab:0,ai:0, prices:{}, hist:{}},
  properties:[{type,qty,rent,dueDay,vacancyRate}],
  season, // 0-3
  hqLevel, // 0-5
  franchise:{type, count},
}
```

## 六、风险
- 投资品种多了会导致"钱被锁死在理财"→ 维护费/贷款压力失效；需保留 1 个"急用钱"机制（卖 1 家商铺/黄金变现）
- 加密货币 25% 波动 + 10 万目标 → 可能 1-2 天达成，破坏节奏；需要限制初始投资上限（1 万）+ 解锁条件（需打工 15 天）
