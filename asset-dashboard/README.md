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

## 网页 6 个视图

| 视图 | 读什么 | 功能 |
|---|---|---|
| 总览 | `/api/overview` | 资产计数、番茄连载进度、短剧项目状态 |
| 资产库 | `/api/vault` `/api/knowledge/*` | 入库游戏、知识库游戏、可借鉴方案、美工风格（palette 色板 + 生图 prompt），支持关键词过滤 |
| 小说 | `/api/books` `/api/projects/novel` | 番茄 4 本（下一章/字数/未回收伏笔/文风）+ novel-forge 长篇项目 |
| 短剧 | `/api/projects/drama` | 3 个 Pavo 式短剧（分镜/关键帧/视频数/状态） |
| 方案生成 | `/api/generate?idea=` | 一句话思路 → 方案候选（本地：knowledge/plans.json 关键词打分 top3；配置 LLM 后走在线生成） |
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
```

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
- `../tomato/books/*/state.json`（番茄 4 本）

## 局限 / 下一步

- 当前"方案生成"本地回退只从 plans.json 打分（无 LLM 时候选 hit=0，仅按库顺序 top3）。
- 在线 LLM 生成（agnes-3.0-flash）的接线在 server.mjs 预留，未实装。
- 资产图片/视频未在网页内预览（只有计数 + 元数据）。
