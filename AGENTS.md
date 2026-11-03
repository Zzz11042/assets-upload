# AGENTS.md — Codex / AI Agent 接入手册

本仓库是 `asset-dashboard`：零 npm 依赖的本地「资产管理 + 方案生成」服务（Node 标准库，`asset-dashboard/server.mjs`），
为游戏 / 小说 / 短剧创作者把分散在本机的工程、美术、文本资产整理成网页 + REST API，
并提供 **Agent 接入层**（`/api/agent/*`）：外部 agent（Codex / DSH）可以发现能力、把需求交进去生成机读方案、
本地执行后回传结果。

## 快速启动

```bash
cd asset-dashboard
node server.mjs                # → http://127.0.0.1:7800（PORT 可改）
node --check server.mjs        # 改完 server.mjs 后先做语法检查
```

## Agent 接入层（本手册核心）

### 1. 能力发现

```
GET /api/agent/manifest
```

返回 `_schema: asset-dashboard/agent-manifest@1`：`connect`（base_url / 鉴权模式）、`llm`（在线状态）、
`domains`、`asset_library`（knowledge/asset-tags.json 条目数与分类计数）、`data_sources`、`scan_roots`（已保存默认扫描根）、
`agent_local`（本机工具路径 + 来源 + assumed 标记）、`loop`（四步闭环）、`tools`（端点注册表，含用途与参数）。
agent 应以 manifest 为唯一事实来源决定调用哪些端点，不要猜。

### 2. 需求 → 机读方案

```
POST /api/agent/plan   {"requirement":"…","domain":"game|novel|video|cross","game":"tap-samurai","context":"…"}
GET  /api/agent/plan?plan_id=<id>        # 取回方案（缺 plan_id = 最近一次）
```

- `requirement` 必填，其余可选；`domain` 缺省自动从需求文本推断；`context` 会与 requirement 拼起来做资产匹配。
- 响应 `_schema: asset-dashboard/agent-plan@1`，关键字段：
  - `plan_id`：`plan-<base36>`，持久化在 `records/<plan_id>.json` + `records/agent-plans.jsonl`（均 .gitignore 排除）；
  - `kind`：`art`（美术需求）/ `video`（短视频需求：V1 脚本 → V2 T2V 分镜 → V3 合成 → V4 发布 → V5 回传）或 `feature`（功能需求，按 domain 生成 /api/generate + /api/export 步骤）；
  - `base`：服务 base_url（步骤命令中的取步/回传端点拼它）；`batch_file`：art 类真实批次 spec 路径（`records/<plan_id>-batch.json`，已按需求写好 N 条素材）；
  - `next_step`：下一步合成指令（`GET /api/agent/step?plan_id=…`）；
  - `category`：art 类命中的 ART_CATEGORIES（monster/effect/ui/scene/prop → monsters/effects/ui/scenes/props 目录）；
  - `matched_assets`：从 `knowledge/asset-tags.json` 按关键词命中的既有资产（先复用再生成）；
  - `local_game_dirs`：`{game, art_dir, dirs_found}`——asset 仓内该游戏的类别目录 + 已保存扫描根下同名目录；
  - `execution.tasks[]`：有序任务，每个含 `id/step/tool/do/action/command`；art 类固定五步：
    1. `T1-gen` agnes T2I 批量生图（绿幕母版）；2. `T2-chroma` chroma key 出透明 PNG；
    3. `T3-sync` 同步进 art-assets 仓并 commit；4. `T4-integrate` 进游戏 img/（只增不覆盖）；5. `T5-report-back` 回传；
  - `execution.tools`：`{source: default|agent-local.json, assumed, paths{...}}`——本机工具实际路径，执行前先核对其存在；
  - `report_back`：回传端点说明（/api/record + /api/tags/parse）。

### 3. 本机执行约定（美术类任务）

- 生图：`python <paths.t2i_tool> batch <batch.json>`（agnes-image-2.5-flash 批量工具；429 用 `paths.t2i_retry` 退避重试）；
  透明素材的 prompt 必须带绿幕后缀 `isolated on a solid #00B140 green screen background, no character, no text, no watermark`；
- 抠图：`python <paths.chroma_tool> <绿幕png> <透明png>`（阈值版 chroma key）；绿幕母版存 `paths.raw_dir`；
- 素材仓：`paths.art_repo`（git），按 `类别/游戏/` 二级目录存放，命名小写中划线；**只增新文件，不覆盖既有美术**，改完 commit；
- 批次 spec（batch.json / agnes_batch.json / 日志）放 `paths.batch_dir`；
- 功能类任务（feature）：走 `/api/generate`（方案打分/LLM）→ `/api/export`（agent 实现包）→ `/api/record`（记录）；
- 短视频类任务（video）：`python <paths.t2v_tool> create "<prompt>" [--aspect 16:9] [--seconds 5] [--out <plan_id>_shotN.mp4]`（默认 out `out/agnes/agv_<id>.mp4`，超时后 `poll <id>` 续跑）→ ffmpeg concat 合成（`paths.video_compose`）→ `biliup` 上传 / `publish-agnes.ps1` 发布（`paths.biliup_tool` / `paths.video_publish`）→ `/api/record` 回传。

### 4. 分步合成（/api/agent/step）

方案落盘后按「取一步 → 执行 → 标记完成」循环推进，每步都是自包含的（command / inputs / outputs / verify + 标记完成指令）：

```
GET  /api/agent/step?plan_id=<id>[&step=<task_id>]   # 缺省=最近方案的下一个未完成步
POST /api/agent/step/done  {"plan_id":"…","step":"<task_id>","result":"…?"}  # 标记完成，返回 next 与 all_done
```

- 响应 `_schema` 之外的关键返回：`step`（`id/step/total/tool/do/command/inputs/outputs/verify/status/mark_done`）、`done_count/total/all_done`；
  缺 plan 时 404（`no saved plan yet` / `plan not found`）；全部完成时 `step:null` + `all_done:true`。
- 标记完成会写 `records/<plan_id>.json` 的 `progress.done` 并 append `records/agent-plans.jsonl`（`event: step_done`）。
- 本机零依赖 CLI（Node ≥ 18，全局 fetch）：

```
node asset-dashboard/agent-cli.mjs manifest
node asset-dashboard/agent-cli.mjs plan "给 tap-samurai 生成 3 个怪物" --game tap-samurai --domain game
node asset-dashboard/agent-cli.mjs step [plan_id] [step|n]     # 取下一步（缺省=最近方案）
node asset-dashboard/agent-cli.mjs done [plan_id] <step|n> [--result "..."]
```

  选项 `--base <url>`（默认 `http://127.0.0.1:7800`）；鉴权读 env `AGENT_TOKEN` 自动带 `x-agent-token` 头。

### 5. 结果回传

```
POST /api/record      {"plan_id":"plan-…","result":"…","status":"complete|failed","files":["…"]}
POST /api/tags/parse  {"text":"…","domain":"game","source":"…"}   # 新素材 → LLM 提取标签 → 写入知识库
```

## 认证与安全

- **AGENT_TOKEN**：env `AGENT_TOKEN` 或 `settings.json.agentToken`（后者优先）。启用后所有 `/api/agent/*`
  需带请求头 `x-agent-token: <token>`，否则 401（响应带 `www-authenticate: X-Agent-Token`）。未启用时开放（仅限本机部署）。
- **公开部署**（HOST=0.0.0.0）务必：设 `AGENT_TOKEN`；设 `SCAN_ROOTS_ALLOWED`（逗号分隔白名单，约束 /api/local-scan、
  /api/dedup、POST /api/scan-roots 可访问的根）；`MAX_BODY_BYTES`（默认 1MB）限制请求体；网关层再加身份鉴权。
- `settings.json` / `records/` / `scan-roots.json` / `agent-local.json` 全部 .gitignore 排除，不入库。

## agent-local.json（部署机覆盖）

`asset-dashboard/agent-local.json`（gitignore 排除，每台部署机自备）可覆盖内置默认的本机工具路径
（`t2i_tool / t2i_retry / t2i_key / chroma_tool / art_repo / batch_dir / raw_dir / t2v_tool / video_compose / biliup_tool / video_out_dir / video_publish`）。
文件缺失时 manifest 与 plan 中的 `agent_local.assumed=true`（内置默认值仅为参考）；
agent 执行前应检查 `execution.tools.assumed` 与 `paths` 是否真实存在，缺失则先向用户确认再执行。

## 本仓库改动守则

- 零 npm 依赖：只用 Node 标准库（http / fs / path / crypto）；
- 改 `server.mjs` 后必须 `node --check server.mjs`；服务端 API handler 签名 `(searchParams, req, res)`，
  return 值自动 JSON 化（200），自己写了 res（headersSent）就不要再 return；
- 前端单文件 `web/index.html`：helpers `$` / `api` / `esc` 已存在，新视图要在 `views` 数组与 `show()` 里注册；
- 不新增依赖、不引入构建步骤；文档改动同步 README / DEPLOY 对应章节。
