# asset-dashboard — 网页可视化入口（资产管理 + 方案生成）

零 npm 依赖（仅 Node 标准库）。把分散在 `game-forge/`（vault/knowledge/novel/drama）和 `tomato/books/` 的资产库，变成一个本地网页 + REST API。

## 启动

```bash
cd asset-dashboard
node server.mjs            # → http://127.0.0.1:7800
# 在线 LLM 方案生成（可选）:
# source ~/.config/agnes/env && node server.mjs
# 自定义端口: PORT=8080 node server.mjs
```

## 网页视图

| 视图 | 读什么 | 功能 |
|---|---|---|
| 总览 | `/api/overview` | 资产计数、番茄连载进度、短剧项目状态 |
| 资产库 | `/api/vault` `/api/knowledge/*` | 入库游戏、知识库游戏、可借鉴方案、美工风格（palette 色板 + 生图 prompt），支持关键词过滤 |
| 资产查看 | `/api/assets-live` | 多工程 + 机读标签，点文件看实时内容 |
| 小说 | `/api/books` `/api/projects/novel` | 番茄书（下一章/字数/未回收伏笔/文风）+ novel-forge 长篇项目 |
| 短剧 | `/api/projects/drama` | Pavo 式短剧（分镜/关键帧/视频数/状态） |
| 方案生成 | `/api/generate?idea=` | 一句话思路 → 方案候选（本地：knowledge/plans.json 关键词打分 top3；配置 LLM 后走在线生成） |
| 分步生成 | `/api/wizard/*` | 向导式生成方案，记录入 records/，可导出合成品给 agent |
| 方案记录 | `/api/records` | 查看/导出历史方案 |
| 资产解析 | `/api/tags` | 机读标签搜索与解析 |
| **本地扫描** | `/api/local-scan` | **一键整理本机所有项目与资产目录，列出可分析项（含 project.json/state.json/index.html 入口或资产文件 ≥10），勾选导出给 agent** |
| **去重分析** | `/api/dedup` | **图片去重（report-only）：字节级完全重复（SHA-1，含可回收 MB）+ 同名跨根跨格式嫌疑；可保存默认扫描根（`/api/scan-roots`）** |
| **设置** | `/api/settings` | **配置 LLM API（Base/Key/模型），写入 `settings.json`；可测试连通** |
| **Agent 接入** | `/api/agent/manifest` `/api/agent/plan` `/api/agent/step` `/api/agent/step/done` | **需求 → 机读可执行方案 + 分步合成：manifest 能力发现、plan 生成/取回（资产命中、本机目录、有序任务、本机工具路径）、step 逐步取任务并标记完成（art / video / novel / feature 四类方案）** |

## API 端点

```
GET /api/overview
GET /api/vault
GET /api/knowledge/games|plans|styles|elements
GET /api/books
GET /api/projects/drama
GET /api/projects/novel
GET /api/generate?idea=<一句话>
GET /api/settings            # 脱敏读（不回传完整 key，只给 keyTail）
POST /api/settings           # 写 settings.json {apiBase,apiKey,model}；key 留空则保留原值
GET /api/local-scan[?roots=<逗号分隔绝对路径>&depth=2|3|4]   # 一键扫描本地项目与资产
GET /api/dedup[?roots=<逗号分隔绝对路径>&depth=4|6|8&includeHidden=1]  # 资产去重分析（report-only）
GET /api/scan-roots          # 已保存的默认扫描根（scan-roots.json）
POST /api/scan-roots         # 保存默认扫描根 {"roots":["/abs/a","/abs/b"]}（绝对路径；设 SCAN_ROOTS_ALLOWED 时受限）
GET /api/agent/manifest      # Agent 能力发现（端点注册表 + 资产库 + 数据源 + 本机工具 + 分步合成闭环）
POST /api/agent/plan        # 需求 → 机读方案 {"requirement","domain?","game?","context?"}（kind: art|video|novel|feature）
GET /api/agent/plan?plan_id=  # 取回方案 + 进度（缺省=最近一次）
GET /api/agent/step?plan_id=&step=  # 分步合成：取下一个未完成步骤（缺省=最近方案；含 command/verify/标记完成指令）
POST /api/agent/step/done   # 分步合成：标记步骤完成 {"plan_id","step","result?"} → 返回 next 与 all_done
GET /api/sources             # 数据源可用性 {ws, game_forge, tomato, missing[]}
```

## 本地扫描（/api/local-scan）

- 默认扫描 `WS`（工作区）+ `FORGE`（game-forge）+ `TOMATO`（tomato）三个根；`roots=` 参数可指定任意绝对路径（逗号分隔）。
- `depth` 默认 3，上限 4；跳过 node_modules / .git / __pycache__ / .cache / dist / build / profiles / logs / vault。
- 识别规则：
  - **project**：含 package.json / pyproject.toml / project.json / state.json / server.mjs / index.html 任一 → analyzable=true
  - **assets**：图片/模型文件（png/jpg/webp/gif/glb/fbx）≥ 10 → analyzable=true
  - **docs**：文档（md/txt/json/csv/html/py/mjs/js/ts）≥ 15 → analyzable=true
- 返回 `{roots, total, analyzable, byType, items:[{name,path,type,files,assets,docs,sizeMB,tags,analyzable,analyze_hint}]}`
- 网页「本地扫描」视图可勾选可分析项，点「📦 导出勾选给 agent」复制 JSON 指令给 DSH / Codex 分析。

## 去重分析（/api/dedup，report-only）

- 引擎：`dedup.mjs`（可独立 CLI：`node dedup.mjs --roots "a,b" --depth 6 --out dedup-report.json --md dedup-report.md`）。
- 算法：遍历各扫描根的图片（png/jpg/jpeg/webp/gif，与 local-scan 相同的 SKIP/隐藏目录规则）→ 按「大小+扩展名」预筛 → 仅对 ≥2 文件候选组流式算 SHA-1 →
  - **exactGroups**：字节级完全重复（安全清理候选，每组给出可回收 MB，按可回收空间排序，默认最多 500 组）；
  - **sameNameGroups**：同名基（去扩展名、小写）跨 ≥2 根（跨格式嫌疑，如 png 母版 vs 游戏内 webp，需视觉确认，默认最多 300 组）。
- 根目录优先级：`?roots=` 参数 > `scan-roots.json` 已保存根 > 工作区默认（WS / game-forge / tomato）；设 `SCAN_ROOTS_ALLOWED` 时全部受白名单过滤。
- 返回 `{report_only:true, summary{filesScanned,totalImageMB,exactGroupCount,exactDupFiles,potentialSavingsMB,sameNameGroupCount}, exactGroups[], sameNameGroups[], roots, roots_abs, depth, source}`。
- **绝不移动/删除用户文件**，只产出候选报告；网页「去重分析」视图展示摘要瓦片 + 两类可展开表格，并提供「💾 保存当前扫描根为默认」（调用 POST /api/scan-roots，复用最近一次 local-scan 的 `abs_roots`）。
- `scan-roots.json` 为本地状态文件（.gitignore 已排除）；不带参数时 local-scan 的 workspace 预设与 dedup 都优先用它（响应 `preset:"saved"`）。

- 数据源缺失（game-forge / tomato 不在本仓库）时：相关端点按设计返回空，`/api/sources` 与 `/api/overview`（`sources` 字段）显式列出缺失项，总览页顶部黄字提示。

## LLM 配置（设置视图 / settings.json / 环境变量）

- 网页「设置」视图填 API Base（OpenAI 兼容，含 `/v1`）+ Key + 模型 → 写 `asset-dashboard/settings.json`。
- `settings.json` 优先于环境变量 `AGNES_API_BASE`/`AGNES_API_KEY`/`AGNES_MODEL`。
- 配好后「方案生成」走在线 LLM（`mode:"llm"`）；未配或调用失败自动回退本地（`mode:"local-fallback"`，并在响应里带 `llmError`）。
- 安全：GET 不回传完整 key（只给尾号 + 是否有 key），POST 留空 key 不清空原值。

## 与 DSH / Codex 直调

- **DSH**：把本 server 的 API 包成 MCP 工具（见 `../game-forge` 的 forge 引擎），或 `dsh-dify` 插件接 Dify 知识库。
- **Codex**：优先走 Agent 接入层——`GET /api/agent/manifest`（能力发现）→ `POST /api/agent/plan`（需求 → 机读方案，kind: art / video / feature）→ 分步合成循环：`GET /api/agent/step?plan_id=…` 取下一步 → 本地执行 `step.command`（T2I 生图 / chroma key / 素材仓 / T2V 短视频 / 小说分章写作）→ `POST /api/agent/step/done` 标记完成直到 `all_done` → `POST /api/record` + `POST /api/tags/parse` 回传与登记；本机零依赖 CLI：`node asset-dashboard/agent-cli.mjs manifest|plan|latest|step|done`（`--base` 默认 `http://127.0.0.1:7800`，鉴权读 env `AGENT_TOKEN`）；完整手册见仓库根 `AGENTS.md`。其余端点 OpenAI 兼容方式直接 fetch；方案生成配 `AGNES_API_BASE`+`AGNES_API_KEY` 后走在线 LLM。
- **鉴权**：设 `AGENT_TOKEN`（env 或 `settings.json.agentToken`）后，`/api/agent/*` 需请求头 `x-agent-token`；未设则开放（仅限本机部署）。
- **agent-local.json**（.gitignore 排除）：按部署机覆盖本机工具路径（`t2i_tool / t2i_retry / t2i_key / chroma_tool / art_repo / batch_dir / raw_dir / t2v_tool / video_compose / biliup_tool / video_out_dir / video_publish / novel_out_dir`）；缺失时 manifest / plan 带 `assumed:true`。

## 数据来源（只读，不改原库）

- `../game-forge/vault/INDEX.json`
- `../game-forge/knowledge/{games,plans,styles,elements}.json`
- `../game-forge/projects/*/project.json`（短剧）
- `../game-forge/novel_projects/*/state.json`（长篇）
- `../tomato/books/*/state.json`（番茄书）
- 本地扫描（`/api/local-scan`）：任意指定根目录（默认工作区 + game-forge + tomato），递归识别项目/资产/文档
- 去重分析（`/api/dedup` / `dedup.mjs`）：指定或已保存扫描根，仅报告候选重复，不修改任何文件
- 知识库保护：`gen-asset-tags.mjs` 在本机缺少 game-forge/tomato 且已有非空 asset-tags.json 时跳过重建（保护已提交的知识库快照）；有数据源的重建会保留上一版 `origin:"external"` 条目

## 局限 / 下一步

- 当前"方案生成"本地回退只从 plans.json 打分（无 LLM 时候选 hit=0，仅按库顺序 top3）。
- 在线 LLM 生成（agnes-3.0-flash）的接线在 server.mjs 预留，未实装。
- 资产图片/视频未在网页内预览（只有计数 + 元数据）。
