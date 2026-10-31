# 《Tiny Troopers 2》游戏解析报告

生成: 2026-10-28 16:41 | 类型: unity | 指纹: 2eb372916ce6

## 1. 玩法解析

（未从源码中提取到明确机制标签；见数值与实体部分）

## 2. 数值设计

### 关键数值区间（自动提取）

| 键 | 样本数 | min | max | mean | 样本 |
| --- | --- | --- | --- | --- | --- |
（无）

## 3. 美工风格解析（LLM 语言化）

| 素材 | 画风 | 配色 | 光影 | 情绪 | 参考风格 |
| --- | --- | --- | --- | --- | --- |
| bubble_bg.png | 极简几何/黑白卡通 | 纯黑底+白色圆盘+中心黑洞的靶心配色 | 无光影变化，平面纯色块，卡通扁平渲染风格 | 神秘/聚焦/气泡感，类似瞄准或目标符号， | Among Us 太空舱界面, Angry Birds 关卡选择背景 |
| bubble_bg@2x.png | Q版卡通 | 梦幻柔粉蓝白糖果色系 | 均匀柔和的漫射光，无明显阴影，呈现扁平化 | 清新、梦幻、轻松、童趣 | Candy Crush Saga, Monument Valley |
| bubble_bg.png | 现代简约UI风格 / 气泡透明质感 | 黑白灰气泡渐变光晕配色 | 中心强白光晕，边缘柔和阴影渐变，模拟气泡 | 清透、轻盈、纯净、现代感 | 《Monument Valley》UI背景, 《Alto's Odyssey》气泡元素 |

### 可复用生图提示词（AI prompt）
- **bubble_bg.png** `llm`: > minimalist geometric bubble background, pure white circle on solid black field, centered dark void, flat vector cartoon style, no gradient, no texture, clean hard edges, simple UI dialogue bubble aesthetic, monochrome palette, modern mobile game background design
- **bubble_bg@2x.png** `llm`: > cartoon bubble background, soft pastel colors, dreamy atmosphere, translucent glass-like texture, gentle gradient, minimalist flat design, cute aesthetic, clean white base with pink and blue highlights, no sharp outlines, suitable for mobile game UI, high quality, trending on ArtStation
- **bubble_bg.png** `llm`: > minimalist game UI bubble background, soft radial gradient glow from center, semi-transparent glass-like sphere, white to dark gray gradient, clean smooth edges, subtle light refraction, modern flat design, elegant and airy atmosphere, transparent overlay style

## 4. 市面类似游戏参考

### 割草/幸存者Like
- **Brotato 土豆兄弟**: 局内构筑+波次商店, 20波节奏 — 波内只攒不用, 商店自走棋式
- **999秒幸存者**: 200+道具, 40+装备, 高随机性 — 爽感来自构筑而非基础数值
- **VA-11 Hall-A**: 波次+Roguelite构筑 — 短循环单局<3分钟

### 末日/基地防御
- **Darkwood**: 昼夜循环: 白天搜刮修营地→夜晚守家 — 准备-防守-结算三段式
- **Rogue Tower**: 45波3模式, 敌人3种防御机制 — Boss波+刷怪塔
- **Tiny Troopers 2**: Q版军事TD, 兵营/弹药/医疗多线资源 — 3级墙HP, Boomer/Dropper 敌人

### 模拟经营
- **Stardew Valley**: 多经营线+季节+社交 — 像素暖色调, 24色量化风格
- **Two Point Hospital**: 经营+建设+随机事件 — Q版卡通, 明亮高饱和
- **游戏内商场经营(自有项目)**: 9业态+连锁+昼夜 — 见 mall-tycoon 项目

### Roguelike
- **Hades**: 局内Build+局外叙事推进 — 死亡不惩罚, 对话驱动
- **Slay the Spire**: 卡牌构筑+精英/小怪节奏 — 50局内随机性设计

### 塔防
- **Kingdom Rush**: 固定点位+波次设计+英雄技能 — 波次曲线先缓后陡
- **Bloons TD 6**: 塔协同+猴子升级路线 — 数值深度靠组合而非堆DPS

### 本地知识库已有调研
- TapTap 无版号（无需 ISBN）上架路径 — 操作格式与规则
- Galgame 恋爱事件/CG 设计要点(自研总结)
- 同类游戏玩法研究（为阿瑞斯小队改进方向）

## 5. 素材库统计

- 素材总数: 300 (图片 300)
- 分类分布: {"ui": 107, "background": 24, "other": 162, "effect": 6, "texture": 1}

完整清单见 `../assets_library/manifest.json`（含 LLM 风格字段与确定性颜色指纹）。
