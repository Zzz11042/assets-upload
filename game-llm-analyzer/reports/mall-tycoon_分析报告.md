# 《mall-tycoon》游戏解析报告

生成: 2026-10-28 18:09 | 类型: source | 指纹: 86214a452f01

## 1. 玩法解析

| 机制 | 代码证据 | 位置 |
| --- | --- | --- |
| 货币 | `money` | _ui_wiring.py |
| 等级/经验 | `xp` | _ui_wiring.py |
| 帧循环/定时驱动 | `setInterval(` | hero-system.js |
| 商店/购买 | `buy` | hero-system.js |
| 存档 | `save` | hero-system.js |
| 天数/昼夜循环 | `day +` | game.js |
| 成就系统 | `achievement` | game.js |
| 随机事件 | `event` | game.js |
| 主循环 update | `update(` | build.js |

## 2. 数值设计

### 关键数值区间（自动提取）

| 键 | 样本数 | min | max | mean | 样本 |
| --- | --- | --- | --- | --- | --- |
| cost | 50 | 2 | 300000 | 12635.1 | 20000,60000,150000,300000,80000 |
| day | 2 | 1 | 1 | 1 | 1,1 |
| income | 1 | 0 | 0 | 0 | 0 |
| level | 9 | 0 | 1 | 0.222 | 0,1,1,0,0 |
| money | 2 | -3000 | -3000 | -3000 | -3000,-3000 |
| mult | 8 | 1.2 | 1.4 | 1.3 | 1.3,1.25,1.2,1.2,1.35 |
| price | 50 | 8 | 120000 | 3562.94 | 50,150,3000,12000,2000 |

### 顶部常量（配置层数值）
- `BANKRUPT_DEBTH` = -5000
- `BANKRUPT_LOSS` = 2
- `COST_SCALE` = 1.4
- `CROWD_CAP_PHASE0` = 8
- `DAY_LEN_SEC` = 30
- `FLOW_SCALE` = 0.85
- `GOAL_MONEY` = 100000
- `GRID_W` = 4
- `OAK_W` = 256
- `PROCUREMENT_SCALE` = 0.25
- `REVENUE_SCALE` = 0.95
- `ROWS` = 5
- `STAGGER` = 2
- `TAX_CAP` = 0.45
- `TAX_STEP` = 0.05
- `TAX_STEP_DAYS` = 5
- `WAGE_SCALE` = 1.3

## 3. 美工风格解析（LLM 语言化）

（LLM 不可用或未执行风格解析；素材库 manifest.json 含确定性风格指纹: 主色/亮度/对比度）

## 4. 市面类似游戏参考

### 模拟经营
- **Stardew Valley**: 多经营线+季节+社交 — 像素暖色调, 24色量化风格
- **Two Point Hospital**: 经营+建设+随机事件 — Q版卡通, 明亮高饱和
- **游戏内商场经营(自有项目)**: 9业态+连锁+昼夜 — 见 mall-tycoon 项目

### 本地知识库已有调研
- TapTap 无版号（无需 ISBN）上架路径 — 操作格式与规则
- Galgame 恋爱事件/CG 设计要点(自研总结)
- 同类游戏玩法研究（为阿瑞斯小队改进方向）

## 5. 素材库统计

- 素材总数: 409 (图片 409)
- 分类分布: {"other": 282, "texture": 4, "background": 27, "ui": 75, "character": 21}

完整清单见 `../assets_library/manifest.json`（含 LLM 风格字段与确定性颜色指纹）。
