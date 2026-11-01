# asset-dashboard — 资产管理 + 方案生成（网页可视化）

零 npm 依赖（仅 Node 标准库）。把分散在本机的游戏工程、美术资产、小说连载、短剧项目整理成
一个本地网页 + REST API，并提供「一键扫描本地项目与资产」能力，供创作者快速整理本机材料、
勾选可分析项、导出给 AI agent（DSH / Codex）做下一步分析。

## 能力总览

| 模块 | 说明 |
|---|---|
| 总览 | 资产计数、番茄连载进度、短剧项目状态 |
| 资产库 | 入库游戏 / 知识库游戏 / 可借鉴方案 / 美工风格（关键词过滤） |
| 资产查看 | 多工程 + 机读标签，点文件看实时内容 |
| 小说 / 短剧 | 番茄书 + novel-forge 长篇 / Pavo 式短剧分镜 |
| 方案生成 | 一句话思路 → 候选方案（本地打分 / 在线 LLM 自动回退） |
| 分步生成 | 向导式生成方案，记录入 records/，可导出合成品给 agent |
| **本地扫描** | **一键整理本机所有项目与资产，列出可分析项，勾选导出给 agent** |

## 数据来源（只读，不改原库）

- `game-forge/vault/INDEX.json`
- `game-forge/knowledge/{games,plans,styles,elements}.json`
- `game-forge/projects/*/project.json`（短剧）
- `game-forge/novel_projects/*/state.json`（长篇）
- `tomato/books/*/state.json`（番茄书）
- 本地扫描：任意指定根目录（默认工作区 + game-forge + tomato），递归识别项目 / 资产 / 文档

## 启动

```bash
cd asset-dashboard
node server.mjs            # → http://127.0.0.1:7800
PORT=8080 node server.mjs  # 自定义端口
```

LLM 在线方案生成（可选）：
- 网页「设置」视图填 API Base + Key + 模型 → 写入 `settings.json`（已被 .gitignore 排除，不入库）
- 或设环境变量 `AGNES_API_BASE` / `AGNES_API_KEY` / `AGNES_MODEL`（settings.json 优先）

## 公开部署（线上访问）

默认监听 `127.0.0.1`（仅本机）。若要发布为公网可访问的站点，启用以下部署开关（环境变量）：

| 变量 | 说明 |
|---|---|
| `HOST` | 监听地址，默认 `127.0.0.1`；公网部署设 `0.0.0.0` |
| `PORT` | 端口，默认 `7800` |
| `NODE_ENV` | 设 `production` 后对静态资源开 `Cache-Control: public, max-age=3600` |
| `SCAN_ROOTS_ALLOWED` | 逗号分隔的绝对路径白名单；设置后 `/api/local-scan` 的 `roots` 参数被限制在白名单内，防止本机任意目录/文件枚举 |
| `MAX_BODY_BYTES` | 请求体上限（默认 1MB），超限被拒绝 |

> **安全注意**：`/api/local-scan`、`/api/asset-text` 等端点会读取部署机本机的文件与目录。公网部署时务必：
> 1. 设 `SCAN_ROOTS_ALLOWED` 限定可扫描目录；
> 2. 在网关 / 反向代理层加鉴权（本服务自身不校验访问者身份）；
> 3. 只暴露需要的端点，敏感本机数据不要放进部署目录。

## 目录结构

```
asset-dashboard/
├─ server.mjs          # 零依赖 Node 服务（/api/* + 静态 SPA）
├─ gen-asset-tags.mjs  # 资产标签生成脚本
├─ knowledge/          # 资产标签 + 领域 schema
├─ web/index.html      # 单页前端（含本地扫描视图）
└─ README.md
仓库根（仅本目录，本地材料已删除）：
├─ README.md           # 本文件
├─ DEPLOY.md           # 一键部署文档（Linux + Windows）
└─ scripts/            # 一键部署脚本（deploy-linux.sh / deploy-windows.bat）
```

## 本地扫描 API

```
GET /api/local-scan?depth=3
GET /api/local-scan?roots=/abs/path,/abs/path2&depth=2
```
返回 `{roots, total, analyzable, byType, items:[{name,path,type,files,assets,docs,sizeMB,tags,analyzable,analyze_hint}]}`。
跳过 node_modules / .git / __pycache__ / profiles / vault 等；深度上限 4 层。
