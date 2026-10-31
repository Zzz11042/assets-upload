# 像素美术风格调研: 星露谷 / 泰拉瑞亚

> 目标: 把本游戏(H5 canvas 原型)的美工从 emoji+矩形 升级为 16-bit 像素风, 模仿星露谷物语 & 泰拉瑞亚。

## 1. 星露谷物语风格要点(调研摘要)
- **角色 sprite 约 16x32 像素**(现代高清化会放大 2~3x), 圆润的头 + 简化的身体比例, 小尺寸下仍"一眼能认出"。
- **暖色调 16-bit 调色板**, 大色块、低细节密度。
- 每色 3~5 个明度档(暗部更深、亮部更亮), 少量色相偏移(阴影偏冷/高光偏暖)。
- 轮廓线: 深色描边(但不是全黑, 偏色深的同色系), 用于强调剪影。
- 光影: 左上光源 → 右上/左上有高光, 右下/左下有阴影。
- 地面/建筑: 大色块 + 细纹理(砖缝、木纹), 纹理要"成簇"不零散。

参考:
- [Stardew Valley 画面评价](https://ld0.indienova.com/u/meowsnow/blogread/3427#comments)(16-bit 风、大色块、轮廓线)
- [Stardew Valley Cozy Pixel Look 风格指南](https://videocue.io/looks/stardew-valley-cozy-pixel)(16x32 角色、暖色调、overworld tile)
- [9种颜色配色方案(星露谷葡萄色板)](https://www.color5.com/upload/color-scheme/37454.html)

## 2. 泰拉瑞亚风格要点(调研摘要)
- **限制每色 3~4 档明度 + 1 档轮廓色**, 用大色块簇, 不用零散单像素条纹。
- 色相偏移要克制(阴影略偏冷, 高光略偏暖, 不要乱跳)。
- 细节(刀刃、符文等)交给 sprite 本身, 动态光效交给 shader/发光。
- 单位 sprite 小(约 16~24px), 高对比剪影, 便于识别。

参考:
- [Terraria 像素美术 Agent Skill](https://skillsmp.com/creators/timhjersted/tsorcrevamp/agents-skills-terraria-pixel-art)
- [Terraria 论坛: 像素艺术建议](https://forums.terraria.org/index.php?threads/pixel-art-glasias-pixel-art-collection-critique-is-welcome.128384/#post-304410605)(每色 4~5 档、高光加在刀刃上)
- [Electroman102 像素艺术讨论](https://forums.terraria.org/index.php?threads/electroman102-s-pixel-art.70186/page-2)(明暗对比、色块)

## 3. 本作落地方案(canvas 单文件, 零依赖)
**核心思路**: 所有单位/建筑不用 emoji, 改用**程序化像素 sprite**: 离屏 canvas 绘制小像素图(如 12x14), 放大整数倍(3x), 主 canvas 开启 `imageSmoothingEnabled=false` 保持像素锐利。

### 3.1 调色板(暖 16-bit, 受限)
| 用途 | 色值 |
|---|---|
| 地皮(战斗/营地) | #3a5a3a / #2f4a2f / #5a7a4a |
| 土壤细节 | #4a3a2a / #6a5a4a |
| 士兵-步兵(绿) | 主体 #5a8a4a / 高 #7aaa5a / 暗 #3a6a2a / 轮廓 #1f3a1f |
| 士兵-机枪手(蓝) | 主体 #4a7aa0 / 高 #6a9ac0 / 暗 #2a5a80 / 轮廓 #1a3a5a |
| 士兵-狙击手(橙) | 主体 #c08a3a / 高 #e0a84a / 暗 #905a2a / 轮廓 #5a3a1a |
| 僵尸-walker | 主体 #7a9a6a / 高 #9aba8a / 暗 #5a7a4a / 轮廓 #2f4a2f |
| 僵尸-fatty | 主体 #8a6a4a / 高 #aa8a5a / 暗 #6a4a3a / 轮廓 #3f2f2f |
| 僵尸-king | 主体 #8a4a5a / 高 #aa6a7a / 暗 #6a2a3a / 轮廓 #3f1f2f |
| 建筑-未建 | 灰褐 #6a6a5a 暗 |
| 建筑-已建 | 暖色高亮 |

### 3.2 sprite 尺寸
- 士兵: 12w x 14h 像素, 3x 放大 → 36x42 屏显(与现 28px 血条匹配)
- 僵尸: 同 12x14
- 建筑: 16w x 14h 像素, 3x 放大 → 48x42(现建筑槽 64x64, 建筑 sprite 居中)
- 武器: 简化为角色持械(右臂像素)

### 3.3 实现
- `makeSprite(w,h,drawPx)`: 创建离屏 canvas, `drawPx(px,py,color)` 逐像素填充, 返回 canvas。
- 主循环 `ctx.imageSmoothingEnabled=false`; 绘制单位时 `ctx.drawImage(sprite, x-off, y-off, 36, 42)`。
- 动画: 步行 2 帧(左右脚交换), 攻击 1 帧前倾 + 枪口闪光, 僵尸 2 帧摇晃。
- 保持现有世界坐标/摄像机/血条/目标圈逻辑不变, 只替换"单位绘制"与"建筑绘制"。

### 3.4 验收
- 语法 OK; 点击回归 PASS; 出屏=0; 10x 战役 10/10; 服务器 200。
- 视觉: 士兵/僵尸/建筑不再是 emoji, 而是清晰像素小人/方块; 缩放 3x 仍锐利无模糊。

## 4. 风险
- 纯 canvas 程序化像素图比 emoji 费代码, 单文件体积会增(预计 +6~10KB, 仍 <150KB)。
- 像素风在"小尺寸"下要克制细节(每色 3~4 档), 不要画太多纹理。
- 整数倍放大 + imageSmoothingEnabled=false 是锐利关键, 漏设会糊。
