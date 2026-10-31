# 《商场大亨(mall-tycoon)》游戏解析报告

生成: 2026-10-28 16:52 | 类型: source | 指纹: b117843a90da

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

| 素材 | 画风 | 配色 | 光影 | 情绪 | 参考风格 |
| --- | --- | --- | --- | --- | --- |
| campus.png | 数字绘画/插画风格 | 冷暖对撞的秋季林荫道配色 | 中央透视汇聚的强光，呈晨雾/夕阳柔光效果 | 宁静、梦幻、略带超现实感 | Stardew Valley 场景氛围, Genshin Impact 蒙德郊区光影 |
| heroFemale.jpg | 日系半厚涂/柔光动漫风（anime semi-realistic illustration） | 暖调粉杏配色——店员系温柔少女氛围 | 柔光正面照明，皮肤有轻微SSS次表面散射 | 温婉、亲切、治愈系日常感，带有一点梦幻朦 | 《偶像大师》系列角色立绘（柔光厚涂风）, 《原神》Q版同人插画风格 |
| heroFemale.png | 日系动漫/半厚涂风格 | 暖奶茶系甜美配色 | 柔和室内漫反射光，低对比度，面部有自然高 | 温柔亲切、治愈系、服务行业氛围 | 动物森友会(Nintendo), 星露谷物语(ConcernedApe) |
| sprite_sheet_all.png | 像素风（Pixel Art）/ 复古16-bit风格 | 废土暗色调：深蓝底色配荧光红绿点缀，暖黄角色提亮 | 低动态范围，顶部/左侧主光源，像素级硬阴 | 末世废土、压抑神秘中带探索感；暗色背景强 | Stardew Valley（像素UI与道具风格）, Dead Cells（废土像素角色与怪物设计） |
| coin_32.png | 像素艺术 (Pixel Art) | 黄金宝藏复古配色 | 中心辐射高光，像素化金属光泽，暖色调发光 | 怀旧珍贵感、游戏奖励氛围、复古收集乐趣 | Stardew Valley, Terraria |
| coin_32_preview.png | 像素 | 锈蚀金铜配紫锈点缀 | 高对比像素阴影，左上高光右下暗部，金属质 | 废土掠夺感，饱经风霜的硬币 | Stardew Valley, Dead Cells |
| drawable-hdpi-v4_def_theme_background.9.png | Q版卡通 / 低多边形卡通渲染风格 | 沙漠迷彩暖灰调 | 扁平化柔和光照，无明显高光，边缘有轻微a | 轻量轻松的二战氛围，去严肃化的卡通军事感 | Team Fortress 2, Call of Duty: Black Ops (Q版模式) |
| drawable-hdpi-v4_dialog_bg.png | unanalyzed | 待 LLM 解析 |  |  |  |
| drawable-hdpi-v4_gc_startview_bg_land.jpg | 现代简约渐变风格 | 清新柠檬薄荷渐变配色 | 柔和均匀渐变光照，无明确光源方向，整体明 | 轻松活泼、青春活力、清新愉悦 | Hearthstone 酒馆对战界面风格, Genshin Impact 角色选择背景 |

### 可复用生图提示词（AI prompt）
- **campus.png** `llm`: > digital painting of a tree-lined avenue, autumn split palette with fiery orange leaves on left and lush green on right, soft volumetric light at vanishing point, dreamy foggy atmosphere, smooth brushwork, no outlines, serene fantasy landscape, concept art style
- **heroFemale.jpg** `llm`: > Japanese semi-realistic anime illustration, soft warm lighting, gentle female character with long black hair and soft smile, wearing beige apron over light pink blouse, café interior background with warm bokeh, subsurface scattering on skin, no hard outlines, delicate hair highlights, cozy治愈 atmosphere, muted pastel color palette with warm beige and blush tones, high-quality digital painting style, soft focus depth of field
- **heroFemale.png** `llm`: > Japanese anime style, semi-thick painting technique, warm bakery setting, female shop assistant character, long black hair with bangs, beige apron over pink shirt, soft ambient lighting, gentle expression, cute and cozy atmosphere, clean line art, mobile game character design, pastel color palette
- **sprite_sheet_all.png** `llm`: > 16-bit pixel art style, post-apocalyptic muted color palette with deep navy and forest green backgrounds, neon red and fluorescent green accents on potions and slimes, warm tan and brown tones for character clothing, hard-edged pixel shading with no gradients, minimal outline relying on color contrast, retro RPG sprite sheet aesthetic similar to Stardew Valley meets Dead Cells, atmospheric gloomy mood with small pops of vibrant magical color
- **coin_32.png** `llm`: > pixel art coin icon, 16-bit retro game style, golden treasure aesthetic, low resolution pixel grid, central highlight glow, warm amber and brown color palette, vintage gaming atmosphere, collectible currency design, no outlines, blocky pixel shapes
- **coin_32_preview.png** `llm`: > pixel art post-apocalyptic game coin, weathered golden copper texture with purple rust accents, dirty metallic surface, worn edge details, 32x32 sprite, top-left highlight shading, gritty wasteland aesthetic, clean pixel borders, no anti-aliasing
- **drawable-hdpi-v4_def_theme_background.9.png** `llm`: > cartoon military background, low-poly art style, soft warm sand tones, flat shading, clean minimal texture, mobile game UI asset, hdpi drawable, subtle alpha border
- **drawable-hdpi-v4_dialog_bg.png** `fallback`: > unanalyzed style, palette: #f8f8f8, #a8a8a8, clean game-ready asset, consistent art direction

## 4. 市面类似游戏参考

## 5. 素材库统计

- 素材总数: 318 (图片 318)
- 分类分布: {"background": 16, "character": 8, "other": 216, "ui": 71, "effect": 6, "texture": 1}

完整清单见 `../assets_library/manifest.json`（含 LLM 风格字段与确定性颜色指纹）。
