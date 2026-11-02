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
| **去重分析** | **图片资产去重（report-only）：字节级完全重复（SHA-1）+ 同名跨根跨格式嫌疑，量化可回收空间** |
| **扫描根持久化** | **保存默认扫描根（scan-roots.json），/api/local-scan 与 /api/dedup 不带参数时复用；/api/sources 显式暴露缺失数据源** |

## 数据来源（只读，不改原库）

- `game-forge/vault/INDEX.json`
- `game-forge/knowledge/{games,plans,styles,elements}.json`
- `game-forge/projects/*/project.json`（短剧）
- `game-forge/novel_projects/*/state.json`（长篇）
- `tomato/books/*/state.json`（番茄书）
- 本地扫描：任意指定根目录（默认工作区 + game-forge + tomato），递归识别项目 / 资产 / 文档
- 去重分析：指定扫描根（或已保存的 scan-roots.json），仅报告候选，不移动/删除任何文件
- 数据源缺失（本仓库仅保留 asset-dashboard，game-forge / tomato 不存在时）：相关端点按设计返回空，并通过 `/api/sources` 与总览页显式提示缺失项

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

`/api/dedup` 与 `/api/scan-roots` 同样受 `SCAN_ROOTS_ALLOWED` 约束：
保存扫描根（POST /api/scan-roots）时白名单外的根会被拒绝；`/api/dedup` 的 `roots` 参数与已保存根都会被过滤到白名单内。

## 目录结构

```
asset-dashboard/
├─ server.mjs          # 零依赖 Node 服务（/api/* + 静态 SPA）
├─ gen-asset-tags.mjs  # 资产标签生成脚本
├─ dedup.mjs           # 资产去重分析引擎（可独立 CLI 使用）+ /api/dedup
├─ knowledge/          # 资产标签 + 领域 schema
├─ web/index.html      # 单页前端（含本地扫描 / 去重分析视图）
├─ scan-roots.json     # 已保存的默认扫描根（运行时生成，.gitignore 排除）
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

## 扫描根与去重 API

```
GET  /api/scan-roots                        # 当前已保存的默认扫描根（scan-roots.json）
POST /api/scan-roots  {"roots":["/abs/a","/abs/b"]}   # 保存默认扫描根（绝对路径，受白名单约束）
GET  /api/sources                           # 数据源可用性 {ws, game_forge, tomato, missing[]}
GET  /api/dedup?depth=6                     # 资产去重分析（report-only）；可加 &roots=a,b 与 &includeHidden=1
```

行为说明：
- 不带 `roots` 参数时，`/api/local-scan`（workspace 预设）与 `/api/dedup` 优先使用已保存的默认扫描根（scan-roots.json），没有才回退到工作区根（WS / game-forge / tomato）。
- `/api/local-scan` 响应新增 `abs_roots`（绝对路径根列表，供前端「保存为默认」使用）与 `preset:"saved"` 标记。
- `/api/dedup` 返回 `{report_only, summary{filesScanned,totalImageMB,exactGroupCount,exactDupFiles,potentialSavingsMB,sameNameGroupCount}, exactGroups[], sameNameGroups[], roots_abs, source}`：
  - `exactGroups`：字节级完全重复（大小+扩展名预筛后仅对候选组算 SHA-1），每组含可回收 MB；
  - `sameNameGroups`：同名基（去扩展名、小写）跨 ≥2 根的图片（跨格式嫌疑，如 png 母版 vs webp），需视觉确认；
  - 前端「去重分析」视图展示摘要瓦片 + 两类表格；独立 CLI：`node asset-dashboard/dedup.mjs --roots "a,b" --depth 6 --out dedup-report.json --md dedup-report.md`。
- 去重分析为 report-only：只列出候选与量化空间，绝不移动/删除用户文件。
- 知识库保护：`gen-asset-tags.mjs` 在本机缺少 game-forge / tomato 且已提交 asset-tags.json 非空时跳过重建（不冲掉知识库快照）；`--force` 重建时保留上一版 `origin:"external"` 条目。
