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
| **设置** | `/api/settings` | **配置 LLM API（Base/Key/模型），写入 `settings.json`；可测试连通** |

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

## LLM 配置（设置视图 / settings.json / 环境变量）

- 网页「设置」视图填 API Base（OpenAI 兼容，含 `/v1`）+ Key + 模型 → 写 `asset-dashboard/settings.json`。
- `settings.json` 优先于环境变量 `AGNES_API_BASE`/`AGNES_API_KEY`/`AGNES_MODEL`。
- 配好后「方案生成」走在线 LLM（`mode:"llm"`）；未配或调用失败自动回退本地（`mode:"local-fallback"`，并在响应里带 `llmError`）。
- 安全：GET 不回传完整 key（只给尾号 + 是否有 key），POST 留空 key 不清空原值。

## 与 DSH / Codex 直调

- **DSH**：把本 server 的 API 包成 MCP 工具（见 `../game-forge` 的 forge 引擎），或 `dsh-dify` 插件接 Dify 知识库。
- **Codex**：OpenAI 兼容方式直接 fetch 上述 `/api/*`；方案生成配 `AGNES_API_BASE`+`AGNES_API_KEY` 后走在线 LLM。

## 数据来源（只读，不改原库）

- `../game-forge/vault/INDEX.json`
- `../game-forge/knowledge/{games,plans,styles,elements}.json`
- `../game-forge/projects/*/project.json`（短剧）
- `../game-forge/novel_projects/*/state.json`（长篇）
- `../tomato/books/*/state.json`（番茄书）
- 本地扫描（`/api/local-scan`）：任意指定根目录（默认工作区 + game-forge + tomato），递归识别项目/资产/文档

## 局限 / 下一步

- 当前"方案生成"本地回退只从 plans.json 打分（无 LLM 时候选 hit=0，仅按库顺序 top3）。
- 在线 LLM 生成（agnes-3.0-flash）的接线在 server.mjs 预留，未实装。
- 资产图片/视频未在网页内预览（只有计数 + 元数据）。
