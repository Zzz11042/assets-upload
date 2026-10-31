# game-forge — 选择驱动的游戏生成 CLI

把本地各种游戏文件（调研 / 方案 / 素材库 / 风格知识 / LLM API）总结成一个工具：
**给一句话思路 → 在本地知识库里检索相似游戏与候选方案 → 全部变成选择题 → 一键生成可玩 H5 游戏 + 美工素材清单 + 生图 prompt**。

设计哲学：减少创作者需要"描述"的内容，换成"选择"。

## 目录

```
game_forge.py            # 唯一入口 CLI
knowledge/
  games.json             # 游戏库（15 款：赵云/寻道/向僵尸/赌石潮/末日小队/商场大亨/4方案/TT2/Brotato/Darkwood/Stardew/Hades）
  plans.json             # 方案库（A上元灯阵/B百工图鉴/C玉匣开鉴/D墨剑江湖/E末日小队，含完整数值/机制/风格映射）
  styles.json            # 风格库（9 种美工风格：水墨灯彩/工笔线描/像素鉴宝/水墨武侠/Q版军事/像素暖色/赛博/扁平/写实）
out/                     # 生成产物（<方案>_game.html + <方案>_设计.md + <方案>/art/*.png + art_manifest.json）
```

## 用法

### 非交互（API / CI 可直接调）

```bash
cd game-forge

# 1) 给思路，列出相似游戏 + 候选方案 + 风格候选（选择题结构，JSON）
python3 game_forge.py recommend "末日基地经营" --json

# 2) 直接选方案 + 风格 + 参考游戏，生成可玩 H5 + 设计方案
python3 game_forge.py generate --plan D --style ink-wuxia --ref 3

# 3) 顺带在线生图（需 source ~/.config/agnes/env）
source ~/.config/agnes/env
python3 game_forge.py generate --plan C --style pixel-jade --ref 4 --gen-art
```

### 交互（CLI 菜单，逐题选择）

```bash
python3 game_forge.py generate --interactive
# 输入思路 → 选相似游戏 → 选方案 → 选风格 → 生成 → 是否生图
```

### 其他

```bash
python3 game_forge.py games          # 列游戏库
python3 game_forge.py styles         # 列风格库（按关键词检索）
python3 game_forge.py plan --plan B --style ink-line   # 只出设计方案 md
```

## 选择题如何工作

`recommend` 把"思路"和 knowledge 里三个库做 bigram + 英文词匹配打分：

- **相似游戏**（Q1）：按思路检索 `games.json`，给出 `borrow`（可借鉴什么）
- **候选方案**（Q2）：检索 `plans.json`，每个方案含完整 `core_loop / mechanics / numbers / long_term / monetization / mvp_scope / risks`
- **风格候选**（Q3）：检索 `styles.json`，每种风格含 `palette / mood / style_prompt`（可直接喂生图）

`generate` 选定后自动组装：
- 方案数值 → 注入 H5 游戏（`NUM` JS 对象）
- 风格 palette → CSS 变量（`--bg/--accent/--text` + `--c0..n`）
- 参考游戏 → 标题页"参考游戏"标注
- 方案 `needs`（hero/enemy/background/icon/ui）→ 逐条拼生图 prompt → `art_manifest.json`

## 产物

| 文件 | 说明 |
| --- | --- |
| `out/<方案>_game.html` | 单文件零依赖可玩 H5（Canvas 核心循环 + 风格化 UI + 数值表） |
| `out/<方案>_设计.md` | 完整设计方案（玩法/数值/风格/素材清单/长线/变现/技术/MVP/风险） |
| `out/<方案>/art/*.png` | 在线生成的美工素材（`--gen-art` + 密钥） |
| `out/<方案>/art/art_manifest.json` | 素材生图清单（离线时只有 prompt，可直接补跑） |

## 已验证

- 5 个方案（A–E）全部生成 HTML，JS 花括号配平检查通过
- 交互模式喂 `0/0/1/n` 选出上元灯阵，正确生成
- `--gen-art` 在线生成玉匣开鉴 3 张 PNG（1312×736，各 ~1MB）

## 游戏文件收件箱（分类保存 + 提高制作水准）

把你发给我的游戏文件放进 `inbox/`（目录、单文件、.zip、.apk 都行），然后：

```bash
python3 game_forge_ingest.py ingest        # 处理 inbox/ 全部内容（处理后自动清空 inbox）
python3 game_forge_ingest.py catalog        # 看 vault/ 已入库清单
```

或直接指定路径摄入：`python3 game_forge_ingest.py ingest <文件或项目目录>`。

自动分类（启发式）→ 存档 `vault/<分类>/<游戏名>/`：

| 分类 | 判定特征 |
| --- | --- |
| `source-game` | 含 ≥3 个 js/ts/py/html（自研 H5/源码游戏） |
| `unity-extract` | 含 `assets/bin/Data` 或 `sharedassets*.assets`（apk 解包） |
| `art-assets` | 图片素材为主（含生成脚本的也算素材库） |
| `design-docs` | 只有 .md/.txt（策划案/调研/方案） |
| `apk-raw` | 原始 .apk |
| `reference` | 其他（截图/视频） |

**提高制作水准的链路**（入库时自动触发）：
1. 存档 `vault/` + 更新 `vault/INDEX.json` / `INDEX.md`
2. 源码/Unity 条目自动调 `game-llm-analyzer` 生成全方面解析报告 → `reports/<游戏>_分析报告.md`（玩法机制/数值区间/美工风格/竞品参考）
3. 游戏条目登记进 `knowledge/games.json`（供 `recommend` 检索，给思路时找相似游戏）

## 自动化决策流（按要素顺序，选择驱动，逐步生成）

调研"生成游戏需要什么要素"后（`knowledge/elements.json`，14 要素按生成顺序），
把每一步变成创作者的选择题，确认后再**逐步生成**：

```bash
# 交互：逐要素选择（思路→相似游戏→类型→设计支柱→核心循环→胜负→数值·经济→
#        数值·成长→内容规模→美工风格→音频→平台→变现→MVP → 确认）
python3 game_forge_flow.py

# 非交互（API/CI）：喂选择序列
python3 game_forge_flow.py --select "idea=水墨割草,genre=文字肉鸽割草,pillars=0,core_loop=3,win_loss=0,economy=1,progression=0,content_scale=0,style=ink-wuxia,audio=0,tech=0,monetization=0,mvp_scope=0"

# 看当前要素清单顺序
python3 game_forge_flow.py --elements
# 断点续跑（选择存 flow_state.json）
python3 game_forge_flow.py --status
python3 game_forge_flow.py --resume
```

确认后逐步生成 5 个产物（`out/flow/`）：
1. `设计.md` — 完整设计方案（14 要素 + 风格 + 参考方案）
2. `game.html` — 可玩 H5 骨架（注入所选风格 palette + 数值 NUM 对象）
3. `数值注入.md` — 经济/成长/规模 数值说明
4. `art_manifest.json` — 美工素材生图 prompt 清单
5. `FLOW_MANIFEST.json` — 产物索引

## Pavo 式一键 AI 短剧（drama_forge）

学 Pavo（Agnes AI 短剧平台 app.pavo-ai.work）的"一键生成"模式：给一句话，
**引导式**一步步做完短剧创作，每步有确认 checkpoint，支持**定向返工**（只改指定
镜头不推倒重来），最后合成成片。

```bash
# 走完 步0-2: 需求卡片 + 角色/场景/道具设计 + 分镜脚本（在线用 LLM 细化）
python3 drama_forge.py new "修仙掌门推销防脱洗发水广告"

# 步3 关键帧 / 步4 逐镜视频（在线: source ~/.config/agnes/env + --online）
python3 drama_forge.py keyframes <项目名> --online
python3 drama_forge.py videos <项目名> --online

# 步5 定向返工: 只重做第2镜（头发要先好再被吹跑），其他不动
python3 drama_forge.py rework <项目名> --shot 2 --reason "头发要先好再被吹跑"

# 步6 合成: ffmpeg 拼 N 段 mp4 → final.mp4（无 ffmpeg 则出拼接清单）
python3 drama_forge.py stitch <项目名>

# 其他: show 看状态 / list 列项目 / card 只出需求卡片
python3 drama_forge.py show <项目名>
python3 drama_forge.py list
```

### 借鉴 Pavo 的三个关键机制
- **素材快速引用**: 角色/场景/道具设计图可被后续镜头复用，保证跨镜角色一致性
- **智能模型路由**: 每个镜头按描述自动选生成方式——动作/运镜镜→`keyframe`(首尾帧)、角色一致镜→`reference`、常规→`text`
- **Harness 调度 + 定向返工**: 需求理解→角色设计→分镜→关键帧→视频→修改→成片，`rework --shot N` 只重做指定镜头

### 离线可跑通
无密钥时全链路退化为 prompt/清单输出（卡片/分镜/关键帧 prompt/拼接清单），不阻断。
在线需 `AGNES_API_KEY`：LLM 细化需求卡片+分镜，`agnes-image-2.5-flash` 出关键帧，
`agnes-video-2.5-flash` 出逐镜视频。

# 引导完善需求（Pavo 的"确认无误再往下"原则）

`new` 完成后自动进入**需求完善引导**：逐项检查卡片缺口（8 个字段 + 分镜运镜），
对缺失项**针对性提问**，创作者逐条回答（回车保留默认），补全后标记 `refined`。
随时 `guide <项目名>` 复查，`--json` 看机器可读缺口。

```bash
# 看缺口（哪些字段还需创作者补充）
python3 drama_forge.py guide <项目名>
# 逐项完善（交互）
python3 drama_forge.py guide <项目名>
# 看缺口（非交互/API）
python3 drama_forge.py guide <项目名> --json
```

缺口判定：字段为 空/None/含"占位/离线卡片/未定"标记 → 需补充；正常内容不再追问。

## 统一入口 forge.py（跨领域: 游戏 / 短剧 / 小说）

同一套"一句话 → 需求卡片 → 缺口引导完善 → 设计要素 → 分层生成"机制，
各领域贡献自己的 spec + 生成器，复用 `forge_common` 的引导引擎：

```bash
python3 forge.py kinds                 # 看可生成领域
python3 forge.py new novel "都市重生爽文: 996程序员猝死后回到2019"
python3 forge.py new drama "修仙掌门推销防脱洗发水广告"
python3 forge.py new game  "末日基地经营"
python3 forge.py guide <领域> <项目名> [--json]    # 缺口检查 + 逐项引导完善
python3 forge.py generate <领域> <项目名> [--online]
python3 forge.py list <领域>
```

| 领域 | 模块 | 生成器 | 产物 |
| --- | --- | --- | --- |
| novel | `novel_forge.py` | 大纲 + 第1章 | `大纲.json`(卷一细纲8章) + `ch1.md`(LLM正文) |
| drama | `drama_forge.py` | 关键帧 + 逐镜视频 + 返工 + 合成 | `keyframes/*.png` + `videos/*.mp4` + `final.mp4` |
| game | `game_forge_flow.py` | 要素决策流 | `设计.md` + `game.html` + `art_manifest.json` |

各领域也可单独调用（`novel_forge.py` / `drama_forge.py` / `game_forge_flow.py`），
`forge.py` 是它们的统一外壳。

## 小说工程化记忆系统（novel_memory.py, 复刻 long-novel-writer + ai-novelist）

`novel_forge.py` 内置分层记忆系统，解决 AI 写长篇"后期走形"的核心问题
（早期设定被稀释 / 数值能力前后矛盾 / 伏笔忘了回收 / 配角消失后现编）：

| 机制 | 来源 | 命令 |
| --- | --- | --- |
| L0 正文 + L1 单章摘要(冻结) | long-novel-writer | 自动落盘（写章时） |
| 写前组装协议 | long-novel-writer | `assemble_context`（写章自动调） |
| 正典账本 canon/ (facts/promises/progression/rules/timeline, 只追加) | long-novel-writer | `canon <名> "事实" --kind facts` |
| 三级伏笔 + 超期预警 | ai-novelist | `foreshadow <名> "描述" --level campaign` / `pay --id FS-001 --chapter 12` |
| 节奏三档配额 | ai-novelist | `rhythm_assign`（快档上限 3） |
| 一致性检查(伏笔超期+能力回退) | 两者 | `memory <名> --chapter N` |

目录结构（每个小说项目下）：
```
L0/ch-0001.md        正文(永不修改)
L1/brief-ch-0001.md  单章摘要(写完冻结)
canon/facts.jsonl    正典事实(只追加)
foreshadow.jsonl     伏笔台账(三级)
consistency_report.json  一致性报告
```

## 与 game-llm-analyzer 的关系

- `game-llm-analyzer`：解析已有游戏程序 → 总结 + 素材库 + 风格语言化（"读懂"游戏）
- `game-forge`：给思路 → 选方案/风格/参考 → 生成新游戏（"造出"游戏）

两者共享 knowledge（可后续把 analyzer 素材库 manifest 也喂给 forge 的素材清单）。
