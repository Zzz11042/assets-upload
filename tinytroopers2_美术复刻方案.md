# Tiny Troopers 2 美术复刻可行方案

> 基于对 `xxbd2gfzb_174720.apk`（88 MB，Unity 4.7.0 Mono 管线）的完整逆向分析。
> 包名：`com.xiaoao.tinytroopers2.nearme.gamecenter`，原版：Chillingo 发行。

---

## 一、原游戏美术资产全景

### 1.1 引擎与数据格式

| 项目 | 值 |
|---|---|
| 引擎 | **Unity 4.7.0f1**（Mono，C# 完整保留在 `Assembly-CSharp.dll`） |
| 关卡文件 | 52 个 `level*` 文件（序列化场景） |
| 共享资源 | 46 个 `sharedassets*.assets`（部分拆分为 `.split0~16`） |
| 纹理数据 | 8 个 `.resS` 文件，共 4.4 MB（PVRTC/ETC1 压缩，无法直接导出为 PNG） |
| 独立图片 | `res/drawable` 下 382 张 PNG（渠道 SDK UI）；`assets/` 下 43 张 PNG/JPG（头像、气泡、渠道 logo）→ **已导出到 `extracted_art/usable_art/`** |
| 游戏本体纹理 | 嵌入 Unity 二进制（PVRTC/ETC1），**无法直接转 PNG**，需用 Unity 4.7 或 AssetRipper 导出；纹理**名称清单**已提取至 `extracted_art/art_inventory.json`（9003 个资产名，含 1352 个美术相关名） |

### 1.2 美术风格定位

通过对象命名（`soldier_face0~31`、`humvee_*`、`helicopter_*`、`building_*`、`fog_day_desert/lush/snow/night`）还原：

```
类型：轻度 3D 卡通军事（Q版迷你兵种 + 载具）
视角：斜45°俯视（isometric-ish），非纯2D
单位：soldier（32种脸 + 17套制服 uniform_01~17）、humvee、helicopter、technical、tank
场景：沙漠 / 绿地 / 雪地 / 夜间 四套天气雾效，含 briefng room、city_building、
      bridge、wood、cottage、train、powerlines 等 props
特效：particles（弹壳、爆炸、烟雾、枪口焰）、article（muzzle、shockwave）
UI：  卡通扁平风格，bubble 气泡、badge、medal、groove 滑槽
图标：app_icon 192×192，渠道 logo 150×38
```

### 1.3 关键美术对象清单（从资产名提取）

| 类别 | 对象示例 |
|---|---|
| 兵种角色 | `soldier_rookie`、`soldierface`（32种脸）、`uniform_01~17`、`specialist_*`（8种专家） |
| 载具 | `humvee`（含炮塔/轮子/破损状态）、`helicopter`（含旋翼blur帧）、`technical`、`tank_turret` |
| 建筑 | `building_block1~5`、`building_dome`、`city_building1~4`、`barracks`（含破损态） |
| 场景道具 | `sandbags`、`tree3_many`、`tree_stump`、`water_pool`、`bridge1~3`、`powerlines`、`train1~3` |
| 天气/环境 | `fog_day_desert/lush/snow`、`fog_night`、`streetlight_plane_winter` |
| 特效 | `particle_bulletshell_spray_large/medium/small`、`particle_explosion`、`dynamite_fire/sparks`、`muzzle` |
| UI | `bubble_bg/fg`、`badge`、`medal`（lite_medal_1~6）、`groove1~3Button`、`minimap_indicator1~7` |
| 僵尸模式 | `zombie`、`zombie_captured`、`zombiered/white`、`loadingbg_zombie` |

---

## 二、可行方案对比

### 方案 A：纯人工重绘（最正规，工期最长）

**做法**：以原游戏为玩法/数值参考，美术完全原创。

| 子项 | 工作量估计 | 工具 |
|---|---|---|
| 角色（32脸×17制服，Q版小人） | 2-3 周（2D立绘+序列帧） | Photoshop / Aseprite |
| 载具（humvee、helicopter、technical、tank） | 2 周 | Blender（低模3D）或 2D |
| 场景道具（建筑、树木、水、桥、电线） | 2-3 周 | Aseprite / Blender |
| 特效（弹壳、爆炸、烟雾、枪口焰） | 1 周 | 2D序列帧或 Unity Particles |
| UI（气泡、勋章、徽章、滑槽、小地图） | 1-2 周 | Photoshop |
| 天气雾效（4套） | 3 天 | Unity Shader |
| **合计** | **约 8-12 周，1名美术** | |

**优点**：无版权风险，可自由调整风格
**缺点**：周期长，成本高；Q版兵种32张脸需要大量绘制

---

### 方案 B：程序化生成 + 少量手绘（推荐，性价比最高）

**核心思路**：原游戏的"小兵"风格本质是**低面数 3D 卡通**，可以用程序化方式生成大部分资产，只手绘关键角色。

#### B1. 角色生成管线

```
┌─────────────────────────────────────────────────┐
│  角色 = 基础网格（低多边形兵人）                  │
│       + 制服颜色贴图（17套 = 17个材质球）         │
│       + 脸部贴图（32张 = 32个小型脸贴图 64×64）   │
│       + 动画序列（walk/shoot/die = 3套关键帧）    │
└─────────────────────────────────────────────────┘
```

| 子项 | 做法 | 工作量 |
|---|---|---|
| 基础兵人网格 | 用 Blender 建模一个低面数（~200面）站立兵人，骨骼绑定 | 3 天 |
| 32张脸 | Aseprite 画 32 张 64×64 像素脸（卡通Q版），或用 Stable Diffusion 生成草图再手绘修正 | 1 周 |
| 17套制服 | 17 个颜色材质球（改 diffuse 颜色即可），无需重绘 | 半天 |
| 动画 | walk（4帧）/ shoot（4帧）/ die（3帧）/ idle（2帧），Unity 动画状态机 | 3-5 天 |
| 专家兵种（8种） | 在基础兵人上加配件（帽子/枪型/背包），克隆 mesh 改材质 | 2-3 天 |
| **合计** | | **约 3-4 周，1名 3D 美术** |

#### B2. 载具生成管线

| 载具 | 做法 | 工作量 |
|---|---|---|
| humvee | Blender 低模（~500面），含 2 个炮塔状态 + 破损态 | 2 天 |
| helicopter | 低模 + 3 张旋翼 blur 帧（序列帧动画） | 2 天 |
| technical | 低模皮卡 + 炮塔 | 1.5 天 |
| tank | 低模坦克 + 炮塔 | 1.5 天 |
| **合计** | | **约 1 周** |

#### B3. 场景（程序化 + 手绘混合）

```
场景 = 地形网格（低面数，带顶点色）
     + 建筑 prefab（Blender 低模，共 5 种基础建筑）
     + 树木（3 种：tree3_many / tree_dry / tree_stump）
     + 地面贴花（草地/沙地/雪地/夜间 4 套 diffuse）
     + 雾效（Unity 内置 Fog + 4 种颜色配置）
     + 路灯/电线（2D 精灵 or 低模）
```

| 子项 | 工作量 |
|---|---|
| 地形生成脚本（C#，按 level 配置生成） | 3 天 |
| 建筑 prefab（5种，低模 ~300面/个） | 4 天 |
| 树木/道具（10种） | 3 天 |
| 地面贴花 ×4 天气 | 2 天 |
| 雾效 Shader | 1 天 |
| **合计** | **约 2 周** |

#### B4. 特效（全程序化）

| 特效 | 做法 | 工作量 |
|---|---|---|
| 弹壳散落 | Unity Particle System（黄色小立方体 + 重力） | 1 天 |
| 爆炸 | Particle System（球形 + 径向扩张 + alpha fade） | 1 天 |
| 枪口焰 | 2D 序列帧（4帧，128×128）or Particle 闪光 | 半天 |
| 烟雾 | Particle System（灰白色 + 缓慢上升 + 扩张） | 半天 |
| 子弹轨迹 | LineRenderer（青色细线，持续 0.3s） | 半天 |
| 直升机尾迹 | Particle System（螺旋桨 blur 序列帧） | 半天 |
| **合计** | **约 1 周** |

#### B5. UI（手绘，量不大）

| UI 组件 | 做法 | 工作量 |
|---|---|---|
| 主界面（地图选择、兵种列表） | 扁平卡通风格，参考原游戏截图 | 3 天 |
| 战斗中 HUD（CP 条、弹药、暂停） | 9-slice 按钮 + 进度条 | 2 天 |
| 气泡/对话框 | 手绘 3 种气泡形状 | 1 天 |
| 勋章/徽章（6种） | 矢量风格小图标 64×64 | 2 天 |
| 小地图指示器（7种） | 三角形/圆形 + 颜色区分 | 1 天 |
| **合计** | **约 1.5 周** |

#### 方案 B 总计

| 角色 | 载具 | 场景 | 特效 | UI | 合计 |
|---|---|---|---|---|---|
| 3-4周 | 1周 | 2周 | 1周 | 1.5周 | **约 8-9 周（1名全职美术）** |

---

### 方案 C：AI 辅助批量生成（最快，质量需人工精修）

**做法**：用 Stable Diffusion / Midjourney 生成草图，再用 Aseprite 手绘精修成像素/卡通风格。

| 子项 | 工具 | 说明 |
|---|---|---|
| 32张脸 | SD 2D pixel art 模型 + prompt "chibi military soldier face, 64x64, game sprite" | 批量生成 → 人工筛选 → 手绘修正，**1 周** |
| 17套制服颜色 | 程序化（改材质色值），无需 AI | **半天** |
| 载具草图 | SD "low poly military humvee game asset, top-down view" | 生成 → Blender 重模，**3 天** |
| 场景背景 | SD "2D game background, desert military base, cartoon style, 1920x1080" | 生成 4 套天气背景，**3 天** |
| UI 图标 | Midjourney "flat game UI icon, medal, cartoon military style" | 批量 → 矢量精修，**2 天** |
| 特效序列帧 | Aseprite 手工（量小） | **2 天** |
| **合计** | | **约 4-5 周（含 AI 生成 + 人工精修）** |

**风险**：AI 生成质量不稳定，32张脸风格需统一（建议用同一 seed 系列）；载具需 3D 重建，AI 只能出参考图。

---

### 方案 D：提取原游戏纹理（最快但版权风险高）

**做法**：用 Unity 旧版本（4.7）工程加载原 APK 的 `bin/Data` 目录，批量导出所有 Texture2D 为 PNG。

```bash
# 需要 Unity 4.7.0（旧版，可从 Unity Hub 获取）
# 创建空工程 → 将 bin/Data 目录替换 → 批量导出
# 或用 AssetRipper / UAssetGUI 直接解析
```

| 步骤 | 工具 | 说明 |
|---|---|---|
| 解析 .resS 纹理 | AssetRipper（支持 Unity 4.x） | 导出 PVRTC/ETC1 为 PNG（有损，质量中等） |
| 解析 .assets 中的 Sprite | AssetRipper | 导出 UI sprite |
| 解析 .assets 中的 Mesh | AssetRipper | 导出 FBX 低模 |
| 批量整理 | Python 脚本 | 按类型分类命名 |

**工作量**：1-2 天（工具自动化）
**版权风险**：⚠️ **高**。原游戏美术资产受版权保护，提取后用于任何商业/公开发布项目均构成侵权。仅限个人学习研究。

---

## 三、推荐路线（综合性价比）

```
第 1 周：方案 D（学习用）→ 导出原游戏纹理/模型，建立参考图集
        同时开始方案 B 的 Blender 基础兵人建模

第 2-4 周：方案 B
  - 角色：Blender 低模 + 32张脸手绘（可参考 D 导出的结果）
  - 载具：Blender 低模 × 4 种
  - 场景：C# 程序化地形 + 5种建筑 prefab

第 5-6 周：方案 B
  - 特效：Unity Particle System
  - UI：扁平卡通风格手绘
  - 天气雾效：Unity Shader × 4

第 7-9 周：整合
  - Unity 工程搭建（2D UI + 3D 场景混合渲染）
  - 动画状态机
  - 52 张关卡布局（可参考原游戏 level 文件中的 trigger/sphere 命名）
```

**预计总工期：9-12 周，团队 2 人（1美术 + 1程序），可交付完整可玩原型。**

---

## 四、直接使用原游戏美术（推荐方案）

原游戏纹理存储在 `assets/bin/Data/` 下的 46 个 `.assets` 文件和 8 个 `.resS` 文件中。
**直接复用原美术的方法如下：**

### 4.1 方法：用 Unity 4.7 直接加载原工程数据

```bash
# 1. 安装 Unity 4.7.0（Unity Hub → 旧版安装 → 4.7.0p1）
# 2. 创建空 Unity 4.7 工程
# 3. 将 apk_extract/assets/bin/Data 目录复制到工程 Assets/ 目录
# 4. Unity 会自动识别并导入所有 .assets 和 .resS 文件
# 5. 在 Project 窗口批量选中所有 Texture2D → 右键 → Export
```

**结果**：得到所有原始纹理（PNG 格式），按原文件结构命名。

### 4.2 方法：用 AssetRipper 批量导出（无需安装 Unity）

```bash
# 下载 AssetRipper 最新版（支持 Unity 4.x 格式）
# https://github.com/PerAShin/AssetRipper/releases

# 命令行导出（导出到 extracted_art/）
AssetRipper apk_extract/assets/bin/Data/ --output extracted_art/

# 导出内容：
#   extracted_art/Textures/   ← 所有 PNG 纹理（约数百张）
#   extracted_art/Meshes/     ← 所有 FBX 模型（兵种、载具、建筑）
#   extracted_art/Scenes/     ← 关卡场景（.unity 文件）
#   extracted_art/Prefabs/    ← 预制体
```

**结果**：全部原始资产导出为可用文件。

### 4.3 方法：用 UAssetGUI 查看（GUI 工具）

```
下载地址：https://github.com/0xd4x/UAssetGUI
打开 apk_extract/assets/bin/Data 目录 → 浏览树形结构 → 右键导出
```

### 4.4 当前可立即使用的资产（已导出）

以下内容**不需要任何工具，立即可用**：

| 目录 | 数量 | 内容 | 说明 |
|---|---|---|---|
| `extracted_art/usable_art/res_drawables/` | 382 张 PNG | 渠道 SDK UI 图（图标、按钮、对话框背景、加载动画） | 可直接导入 Unity 作为 UI 素材参考 |
| `extracted_art/usable_art/avatars/` | 20 张 JPG | 玩家头像（Q版卡通风格） | 可作为角色风格参考 |
| `extracted_art/usable_art/theme_images/` | 36 张 PNG | 气泡、弹窗、徽章（卡通/深色/通用三套主题） | 游戏本体 UI 图 |
| `extracted_art/usable_art/splash/` | 1 张 PNG | 启动画面（64×64 占位图） | — |
| `extracted_art/art_inventory.json` | 9003 条 | **全部纹理/对象名称**（含 1352 个美术相关名） | 用于重建资产清单，指导重制 |

**纹理像素数据（PVRTC/ETC1 压缩）的提取方法**：

```bash
# 方法 1：AssetRipper（推荐，跨平台，无需安装 Unity）
# 下载：https://github.com/PerAShin/AssetRipper/releases
# 命令行（.NET 6+ 环境）：
dotnet AssetRipper.dll "apk_extract/assets/bin/Data" -o "extracted_art/full_export/"
# 导出：Textures/ (PNG), Meshes/ (FBX), Prefabs/, Scenes/

# 方法 2：Unity 4.7 手动导出
# 1. Unity Hub → 安装 4.7.0f1（Archive 标签页）
# 2. 新建空工程 → 将 bin/Data 目录内容复制到 Assets/
# 3. 等待导入完成（约 5 分钟）
# 4. Project 窗口 → 批量选中 Texture2D → 右键 → Export → 选 PNG

# 方法 3：UABEC（.NET 工具）
# 下载：https://github.com/0xd4x/UABEC
# 指向 bin/Data 目录 → 浏览 → 导出
```

**预期导出结果**（基于 art_inventory.json 统计）：

| 类别 | 估计数量 | 格式 |
|---|---|---|
| 兵种角色贴图（脸 + 制服 + 状态） | ~200-400 张 | PNG |
| 载具模型（humvee/helicopter/technical/tank） | ~30-60 个 | FBX |
| 建筑/场景道具 | ~50-100 个 | FBX |
| UI 贴图（气泡/勋章/小地图/按钮） | ~100-200 张 | PNG |
| 特效序列帧（弹壳/爆炸/烟雾） | ~50-100 张 | PNG |
| 关卡场景（52 个 level + boot_camp + 5 章节） | 60+ 个 | .unity |
| **合计** | **约 500-1000 个文件** | |

### 4.5 版权说明

⚠️ **重要**：原游戏美术资产（纹理、模型、关卡）受版权保护，属于 Chillingo / 小奥（xiaoao）/ 37互娱。
- **个人学习研究**：可直接使用，无法律风险
- **公开发布 / 商业项目**：构成侵权，不能直接使用原资产
- **建议**：导出后作为**风格参考**，再按方案 B 重制类似风格的美术

---

## 六、参考图片（已提取）

以下图片已复制到 `art_reference/` 目录，可直接作为风格参考：

| 文件 | 内容 | 尺寸 |
|---|---|---|
| `app_icon.png` | 游戏图标（Q版士兵剪影） | 192×192 |
| `game_logo.png` | 渠道游戏 logo | 150×38 |
| `game_start_logo.png` | 启动画面 logo | — |
| `bubble_bg@2x.png` | 对话气泡背景（卡通风格 UI 参考） | 256×256 |
| `pop_splash@2x.png` | 弹窗特效（深色主题） | — |
| `avatar_head_pic_0.jpg` | 玩家头像（Q版卡通） | — |

---

## 五、技术注意事项

1. **Unity 版本**：原游戏是 Unity 4.7，现用 Unity 2021 LTS（或 2022）重制，资产需重新导入，PVRTC 纹理不兼容（改用 ASTC 或 DXT）
2. **3D 低模规格**：建议顶点数 ≤ 500/个，贴图 256×256 以内，保证低端机流畅
3. **渲染**：斜 45° 俯视角可用正交相机 + 2D 场景，也可用透视相机 + 3D 低模（原游戏用的是 3D 低模）
4. **粒子特效**：Unity 4 的 Particle System 较简单，重制时用 Unity 5+ 的新版 Particles 更容易做
5. **关卡数据**：原游戏 52 个 level 文件中的 `sphere_*`（触发器）、`point_*`（标记点）命名规范可直接参考，重建关卡编辑工具
