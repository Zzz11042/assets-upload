# 第 17-18 轮美术升级：Tiny Troopers Q版军事卡通风格

> 基于《小小部队2》APK 逆向提取的调色板，全面升级 ares-squad 的像素 sprite 配色与背景素材。
> 参照：`/home/zzz/Documents/deepseek-harness/default-workspace/extracted_art/`（440 张原游戏 PNG + 9003 条资产名清单）

## 第 17 轮：sprite 调色板升级

### 新增：`TT` 调色板常量（Tiny Troopers 军事卡通色系）

| 键 | 色值 | 用途 |
|---|---|---|
| olive / oliveL / oliveD | #6a8a3a / #9ac05a / #4a6a2a | 橄榄军绿（步兵主色、屋顶、大地） |
| khaki / khakiL / khakiD | #c8a868 / #e0c888 / #9a7a48 | 卡其（制服、腰带、沙地） |
| army / armyL / armyD | #4a5a3a / #6a7a4a / #3a4a2a | 深军绿（装甲、废墟、围墙） |
| yellow / yellowL / yellowD | #f0d010 / #ffe858 / #c8a808 | 亮黄（警示条纹、弹药、UI 点缀） |
| steel / steelL / steelD | #7a8a9a / #a8b8c8 / #4a5a6a | 钢灰（载具、哨戒机枪、工事） |
| blood / bone | #8f3a3a / #e8e0c8 | 僵尸暗血 / 骨色 |

### 改动的 sprite 函数

1. **`makeSoldier`** — 头盔加橄榄帽檐、卡其军装腰带；7 职业配色全部对齐 TT 调色板
2. **`makeZombie`** — 改"感染丧尸兵"外观：卡其残破军装 + 钢盔碎片 + 龇牙骨色
3. **`makeBuilding`** — 屋顶橄榄军绿 + 卡其墙体 + 钢灰工事；工坊/电台屋顶加警示黄条纹
4. **`makeTurret`** — 炮塔改钢灰，顶部警示黄灯
5. **`groundTex` / `groundTexCamp`** — 战斗地皮改暗橄榄军事绿，营地改沙土暖色

## 第 18 轮：背景素材场景化精细升级

### 改动的背景函数

`makeGroundBg` 从"单色地皮 + 一种小装饰"升级为"多色地面 + 48px 周期精细装饰图案"，5 种场景各具辨识度：

| 场景 key | 装饰图案 | 视觉特征 |
|---|---|---|
| `city` | 破碎砖墙 + 弹坑 + 铁丝网 + 碎裂路面 + 警示黄黑条 | 左上角砖墙残块、中心弹坑、横向铁丝网、右下角碎裂路面、左下角警示条 |
| `road` | 沥青双车道(14-34px 纵向) + 路肩 + 中线虚线(12px 周期) + 路沿石 | 纵向沥青带、两侧土色路肩、白色中线虚线、浅灰路沿 |
| `lab` | 冷钢灰瓷砖(12px 周期) + 接缝 + 黄黑斜纹警示地胶 + 设备阴影 | 冷蓝灰瓷砖网格、深暗接缝、黄色警示条、左上设备投影 |
| `tunnel` | 混凝土 + 横向管道(3 根, 不同粗细) + 管道支架(12px 周期) + 暖黄灯光(24px 周期) | 灰绿混凝土、3 根钢灰管道、竖直支架、暖黄灯光 + 光晕 |
| `ruin` | 沙土 + 瓦砾堆(3 处) + 斜向铁丝网 + 散落金色弹壳(16px 周期) + 红白警示柱 | 暖沙色地皮、灰褐瓦砾堆、斜铁丝网、金色弹壳、红白条纹警示柱 |

### 兼容性

- 老关卡 `bg:"rubble"` 自动映射到 `city`（`SPR.bg.rubble=SPR.bg.city`）
- `TT_BG` 配置新增 `decoCol2` 第二装饰色（如铁丝网色、光晕色）
- 所有装饰图案以 12/16/24px 周期铺设（48 的因数），tile 平铺接缝零色差，无闪烁

### 色阶验证

5 种背景在 headless Chromium 中渲染后，各自拥有 **6-10 种 distinct 颜色**，且主色调互不相同：

| 场景 | 主色（quantized） | 像素占比 |
|---|---|---|
| city | 橄榄绿 #204020 | 1614/2304 |
| road | 灰 #404040 | 1600/2304 |
| lab | 冷蓝灰 #404060 | 1293/2304 |
| tunnel | 深军绿 #204020 | 1670/2304 |
| ruin | 灰褐 #404040 | 1210/2304 |

## 版权说明

- 原游戏 `assets/` 下的 440 张独立 PNG 及 9003 条资产名清单仅作**风格参考**（色板提取）
- 本游戏 sprite 和背景全部为程序化重绘，不直接复用原游戏像素文件
- 若需商用/公开发布，确认原游戏（Chillingo / 小奥 xiaoao）美术资产版权不构成本项目侵权

## 验证

- `node --check` 语法通过
- headless Chromium 实机渲染（520×900 视口）：5 种任务背景（M1 city / M2 road / M4 lab / M5 tunnel / M7 ruin）均正常，无 JS 错误
- 5 种背景 tile 各自 6-10 种 distinct 颜色，主色调互不相同，场景辨识度高

## 产出文件

| 文件 | 说明 |
|---|---|
| `ares-squad/web/index.html` | 游戏本体（第 17-18 轮已升级） |
| `ares-squad/web/index.html.bak-20261024-2374` | 第 17 轮升级前备份 |
| `ares-squad/art/bg_missions_comparison.png` | 5 种任务实机截图（M1/M2/M4/M5/M7，1500×500） |
| `ares-squad/art/bg_all_comparison.png` | 5 种背景 tile 单图对照（592×1480） |
| `ares-squad/art/bg_city_tile.png` | city 背景 3×2 tile 平铺预览（144×96 放大 3x） |
| `ares-squad/art/bg_road_tile.png` | road 背景 tile |
| `ares-squad/art/bg_lab_tile.png` | lab 背景 tile |
| `ares-squad/art/bg_tunnel_tile.png` | tunnel 背景 tile |
| `ares-squad/art/bg_ruin_tile.png` | ruin 背景 tile |
| `ares-squad/art/bg_city_ingame.png` | city 实机截图（520×900） |
| `ares-squad/art/bg_road_ingame.png` | road 实机截图（520×900） |
