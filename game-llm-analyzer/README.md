# game-llm-analyzer — 游戏程序解析 + 美工素材库 + LLM 全方面分析工具

把"游戏程序"（源码 H5 / Unity apk 解包 / 设计文档）变成三份可复用资产：

1. **分析报告**（Markdown）：玩法 / 数值设计 / 美工风格 / 市面类似游戏参考 全方面总结
2. **美工素材库**（`assets_library/manifest.json`）：素材分类 + 确定性风格指纹（主色/亮度/对比度）+ LLM 语言化风格描述 + 可复用 AI 生图 prompt
3. **竞品参考**（`reports/competitors.md`）：按玩法标签匹配市面游戏（本地知识库优先 + 内置速查表 + 可喂 web_search 结果）

## 目录结构

```
analyzer/
  cli.py              # 命令行入口（analyze / library / competitors）
  llm.py              # LLM 接入层（agnes-3.0-flash 文本 + agnes-2.5-flash 视觉；离线可降级）
  report.py           # 报告生成 + 素材风格解析编排
  competitors.py      # 竞品/类似游戏检索（本地知识库 + 内置表）
  parsing/
    game_profile.py   # 游戏程序解析（源码/Unity/文档 三种 profile）
    art_assets.py     # 素材发现/分类/指纹/manifest
    pvr_extract.py    # PVRTC 纹理解码（Tiny Troopers 类 Unity apk）
assets_library/
  manifest.json       # 素材库（含 LLM 风格字段）
reports/
  <game>_分析报告.md
  competitors.md
```

## 用法

```bash
cd /home/zzz/Documents/deepseek-harness/default-workspace/game-llm-analyzer

# 全流程（默认离线可跑；接 LLM 前先 source 密钥）
python3 -m analyzer.cli analyze <项目目录> --game-name "游戏名"

# 接入 LLM（风格语言化 / 生图 prompt）
source ~/.config/agnes/env    # 设置 AGNES_API_KEY / AGNES_API_BASE
python3 -m analyzer.cli analyze <项目目录> --game-name "游戏名" --style-limit 8

# 仅建素材库 / 仅跑竞品
python3 -m analyzer.cli library <素材目录>
python3 -m analyzer.cli competitors <项目目录>
```

可选环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `AGNES_API_KEY` | — | LLM 密钥（不设置则离线降级） |
| `AGNES_API_BASE` | `https://apihub.agnes-ai.com/v1` | API 基址 |
| `AGNES_LLM_MODEL` | `agnes-3.0-flash` | 文本/玩法分析模型 |
| `AGNES_VISION_MODEL` | `agnes-2.5-flash` | 图像风格解析模型 |

## 解析层能力

- **源码**（Python/JS/TS）：正则提取帧循环/spawn/波次/昼夜/战斗/商店/成就/事件/存档/离线收益等玩法机制；`class` 实体识别；`cost/income/price/mult/...` 数值区间统计；CSS 变量 → UI 主题色 token
- **Unity apk 解包**：扫描 `sharedassets*.assets` / `.resS`，统计媒体类型，从文本资产挖数值；`pvr_extract` 解码 PVRTC 纹理（Tiny Troopers 2 实测 0 张 = 该包无 PVR 容器头，但管线已就绪）
- **设计文档**（Markdown）：章节标题 / 数值表 / 外链

## 美工风格语言化

每个素材 manifest 条目可携带：

```json
{
  "rel": "art/gen/citywall_768.png",
  "color_fp": {"top_colors": [{"hex": "#f8b8c8","pct":12.1}, ...], "brightness": 180, "contrast": "medium"},
  "style": {
    "art_style": "Pixel Art / 俯视角像素风",
    "palette": ["#f8b8c8", "#7ec8a0", "#f8d868"],
    "palette_name": "樱花粉都市暖光色系",
    "lighting": "路灯暖黄光晕呈圆形扩散",
    "mood": "温馨治愈、梦幻甜美、宁静日常",
    "reference": ["Stardew Valley", "Dave the Diver"],
    "style_prompt": "Top-down pixel art city intersection, pastel pink ..."
  },
  "style_source": "llm"
}
```

`style_prompt` 可直接喂给 `agnes-image-2.5-flash` 等生图模型做风格复刻 / 新素材生成。

## 竞品检索逻辑

1. 从 GameProfile 的玩法标签匹配内置速查表（割草/末日防御/模拟经营/Roguelike/塔防 五类）
2. 本地知识库 `dsh-kb/06-资源` 里已有的调研自动引用
3. agent 侧可把 `web_search` 结果喂入 `competitors.md` 的"网络检索结果"章节

## 已跑通示例

| 输入 | 类型 | 报告 | 素材库 |
| --- | --- | --- | --- |
| `mall-tycoon/`（商场大亨 H5） | source | `reports/商场大亨-mall-tycoon-_分析报告.md` | 411 项（ui 45 / background 27 / character 23 ...） |
| `apk_extract/`（Tiny Troopers 2） | unity | `reports/Tiny-Troopers-2_分析报告.md` | 300 项（ui 107 / background 24 ...） |
