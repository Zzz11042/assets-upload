# 同类游戏调研与改进建议

> 基于 2026-10 检索的 8 个公开来源(Steam 商店页 / 开发商博客 / DevPost / dev.to / 3DM), 已按「外部不可信数据」处理, 仅提炼玩法共性作为本 H5 商场游戏的改进参考。

## 一、同类游戏共性玩法

1. **核心循环: Scroll → Earn → Upgrade → Scroll Faster(更速)**(来源: Doomscroll 2077 devlog / Idle Miner 5 周年博客 / Bounce Tycoon)。几乎所有同类游戏都靠「点击 / 自动产 → 升级解锁 → 产出更快」的指数成长曲线驱动留存。
2. **多层解锁节奏**: 解锁成本按指数曲线递增, 不同主题(矿/动物园/咖啡馆)只是换皮, 机制一致(Shop Tycoon 评注 / Two Point / Egg Inc / Idle Theme Park)。
3. **Meta / 声望(Ascension)层**: Idle 游戏标配「第二成长层」, 如 [Resonance](https://apps.apple.com/tw/app/bounce-tycoon-idle-clicker/id6769328582?l=en-GB)、[Time Trials + Tools + Boosts + Ascension](https://devpost.com/software/bubble-pursuit-idle-tycoon-progression-update#1) 这类「重开但保留 meta 加成」的设计。
4. **员工 / 经理 / 自动经营**: [Shop Tycoon: Prepare your wallet](https://store.steampowered.com/app/1392340#1) 的核心差异化是「员工 + 经理 + 保安 + 车队」的多角色委托自动化, 让离线收益可累积。
5. **车队 / 物流 / 设施扩张**: 同一游戏的「建停车场、员工办公室、车队」属于「垂直扩张」而非单纯「铺位扩张」。
6. **主题换装 + 连锁化**: 不同主题(超市/游戏店/酒类店)同机制, 用「开同业态多家」给玩家连锁感([Shop Tycoon 评注](https://steamcommunity.com/id/jarlfrank/recommended/1392340))。
7. **4 结局 + 高分系统**: 同一游戏的多个结局 + 排行榜, 提升重玩价值。
8. **Day 1 / 7 / 30 留存指标**: 开发商明确按 30 天留存曲线设计内容释放节奏([Idle Miner Tycoon 5 周年](https://www.kolibrigames.com/blog/celebrating-five-years-of-idle-miner-tycoon-and-still-going-strong))。

## 二、本 H5 商场游戏当前可改进点(对照同类玩法)

| 同类共性 | 本游戏现状 | 可借鉴的改进 |
|------|------|------|
| 多层解锁 / 主题换装 | 主街道/商业街/大学城(3 张地图) 但机制重复 | 不同地图加「主题差异」: 商业街偏时尚零售、大学城偏餐饮服务、主街道均衡; 地图专属事件/专属业态 |
| 员工 / 经理自动经营 | 已有「职业经理」(每日帮最弱店升级 1 级), 但只是单一委托 | 加更多角色: 保安(抓小偷事件)、收银员(提升客流)、店长(每日自动采购最优商品) |
| 车队 / 物流 / 设施 | 无 | 加「顾客来源」设施: 地铁口(客流 +20% 但维护高)、停车场(延长停留 → 客单提升) |
| Meta / 声望(Ascension) | 无, 一次玩到破产/达成即止 | 加「重开保留 meta 加成」: 破产/达成后, 用累计顾客数兑换「老顾客回头率 +1%」, 重开保留 |
| 多结局 | 单一「扩张成功 ¥100,000」 | 加「4 结局」: 破产 / 达标(¥10万) / 帝国(¥50万) / 传奇(¥100万), 不同结局不同彩蛋 |
| 高分 + 排行榜 | 无 | 本地最高纪录(peakMoney 已有, 可显示「历史最高」) |
| 时间限定事件 | 仅 15 种随机事件 | 加「限时活动」: 7 天内达成某目标给一次性 meta 加成, 提升 Day-7 留存钩子 |
| 离线收益 | 无(刷新即停) | 加「离线收益」: 不在场的 N 天按 50% 效率结算(类 [Egg Inc](https://jovixie.pages.dev/posts/the-most-entertaining-idle-tycoon-games/)) |
| 多角色委托 | 仅经理 | 加「AI 自动定价」按钮: 一键为所有铺位定价到利润最大化, 降低操作成本 |
| 视觉反馈 | 浮层面板 | 已有; 可加「升级时铺位烟花」「事件时全屏闪烁」 |

## 三、最划算的 3 项下一步

1. **加离线收益**(50% 效率、最多 3 天): 让玩家「关掉浏览器第二天还赚了钱」, 直接拉留存; 改动小(保存 lastSaved 时间戳, 加载时结算)。
2. **加多结局 + 本地最高纪录**: 4 种结局(破产/达标/帝国/传奇) + 在面板顶部显示「历史最高 ¥XXX」, 提升重玩动机。
3. **地图主题差异**: 3 张地图不再是同机制换皮, 商业街专属「时尚零售」事件、大学城专属「毕业季」事件、主街道均衡, 让玩家「开不同地图有不同玩法」。

## 参考来源

- [Shop Tycoon: Prepare your wallet (Steam)](https://store.steampowered.com/app/1392340#1)
- [Shop Tycoon 评注(连锁 + 主题换装同机制)](https://steamcommunity.com/id/jarlfrank/recommended/1392340)
- [Idle Miner Tycoon 5 周年: Day 1/7/30 留存指标](https://www.kolibrigames.com/blog/celebrating-five-years-of-idle-miner-tycoon-and-still-going-strong)
- [The Most Entertaining Idle Tycoon Games](https://jovixie.pages.dev/posts/the-most-entertaining-idle-tycoon-games/)
- [Doomscroll 2077: The Idle Game Loop](https://dev.to/tanishpaul1106/the-idle-game-loop-that-keeps-players-coming-back-a-doomscroll-2077-devlog-370a)
- [Bubble Pursuit: Idle Tycoon Progression Update](https://devpost.com/software/bubble-pursuit-idle-tycoon-progression-update#1)
- [Bounce Tycoon: Idle Clicker](https://apps.apple.com/tw/app/bounce-tycoon-idle-clicker/id6769328582?l=en-GB)
- [3DM 商店大亨简体中文](https://dl.3dmgame.com/pc/135670.html)
