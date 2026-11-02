# 一键部署文档（Linux / Windows）

asset-dashboard **零 npm 依赖**（纯 Node 标准库），无需 `npm install`，clone 完即可运行。

## 前置

- Node.js ≥ 18（`node -v` 查看；无则先装）
- 仅本地 `127.0.0.1` 监听，端口默认 7800

## Linux / macOS

### 方式一：一键脚本（推荐）

```bash
# 已 clone 本仓库、仓库根目录
./scripts/deploy-linux.sh
# 或指定端口与 LLM 环境变量
PORT=8080 AGNES_API_KEY=sk-xxx ./scripts/deploy-linux.sh
```

### 方式二：手动

```bash
git clone https://github.com/Zzz11042/assets-upload.git
cd assets-upload/asset-dashboard
node server.mjs                 # → http://127.0.0.1:7800
```

## Windows（PowerShell）

### 方式一：一键脚本（推荐）

双击 `scripts\deploy-windows.bat`，或在 PowerShell 中：

```powershell
scripts\deploy-windows.bat
# 自定义端口：
$env:PORT=8080; scripts\deploy-windows.bat
```

脚本会：
1. 检测 Node 是否安装（未装则提示 winget 安装命令）
2. 若不在仓库目录则自动 `git clone` 本仓库
3. 进入 `asset-dashboard\` 并 `node server.mjs` 启动
4. 打印访问地址 `http://127.0.0.1:7800`

### 方式二：手动

```powershell
git clone https://github.com/Zzz11042/assets-upload.git
cd assets-upload\asset-dashboard
node server.mjs
```

## LLM 在线方案生成（可选）

- 网页「设置」视图填 API Base + Key + 模型 → 写入本地 `settings.json`（.gitignore 已排除，不入库）
- 或设环境变量 `AGNES_API_BASE` / `AGNES_API_KEY` / `AGNES_MODEL`（settings.json 优先于环境变量）
- 未配置 LLM 时「方案生成」自动回退本地打分模式

## 本地扫描功能使用

1. 打开网页 → 顶栏「本地扫描」
2. 填扫描根目录（逗号分隔绝对路径；留空 = 默认工作区 + game-forge + tomato）
3. 点「🔍 一键扫描」→ 列出全部项目 / 资产目录 + 可分析项
4. 勾选要分析的目录 → 点「📦 导出勾选给 agent」复制 JSON 指令 → 粘贴给 DSH / Codex 做分析

## 去重分析功能使用（report-only，不移动/删除文件）

1. 打开网页 → 顶栏「去重分析」
2. 首次使用：先在「本地扫描」页扫一次你的资产目录（或在「去重分析」页先跑一次），然后点「💾 保存当前扫描根为默认」（写入 `asset-dashboard/scan-roots.json`，已被 .gitignore 排除）
3. 以后直接点「🔍 运行去重分析」：不带参数时自动复用已保存的扫描根；也可用 API `GET /api/dedup?roots=/abs/a,/abs/b&depth=6` 临时指定
4. 结果：图片文件总数 / 总量、字节级完全重复组（SHA-1，含每组可回收 MB）、同名跨根跨格式嫌疑组（需目检）
5. 命令行用法（不依赖服务）：
   ```bash
   node asset-dashboard/dedup.mjs --roots "E:/a,D:/b" --depth 6 --out dedup-report.json --md dedup-report.md
   ```

## 数据源缺失提示（本仓库形态）

本仓库仅保留 `asset-dashboard/` 本身，`game-forge/` 与 `tomato/` 不在仓内。相关端点（vault / books / projects 等）按设计返回空，不会报错；`/api/sources` 与「总览」页会显式列出缺失的数据源，避免误以为数据丢失。

## 常见问题

- **端口被占用**：`PORT=8081 node server.mjs`（Windows：`$env:PORT=8081; node server.mjs`）
- **Node 版本过低**：LLM 调用依赖 `fetch` 全局（Node 18+ 内置）
- **扫不到某目录**：该目录在跳过名单（node_modules / .git / __pycache__ / profiles / vault）或被深度上限 4 层截断
- **不带参数扫描/去重用了哪些根**：`GET /api/scan-roots` 查看已保存的默认扫描根；`scan-roots.json` 缺省时回退到工作区根（WS / game-forge / tomato）
- **公网部署安全**：`/api/dedup` 与 `POST /api/scan-roots` 均受 `SCAN_ROOTS_ALLOWED` 白名单约束（见 README「公开部署」）
