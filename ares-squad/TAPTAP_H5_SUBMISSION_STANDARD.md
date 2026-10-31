# TapTap 上架包体类型标准（所有游戏统一）

> 适用：本开发者账号（484472）名下所有 TapTap 游戏，今后全部按本规范提交。
> 依据：`taptap-cli package-management get-available-package-types` 实测 + 刀光尸潮（964358）线上版本。

## 一、TapTap 支持的上架包体类型

| 包体类型 | type 值 | 能否在 TapTap 内直接玩 | 说明 |
|---|---|---|---|
| **H5** | `h5` | ✅ **能（在线玩/免下载即玩）** | 网页单文件构建，浏览器内运行。本账号所有游戏均只开放此类型 |
| APK | `apk` | 需下载安装 | 安卓原生包，本账号未开放 |
| Spark（TapTap 制造） | `spark` | ✅ 在线玩 | 地图/小游戏引擎，本账号未开放 |
| Windows | `windows` | 需下载 | PC 端，本账号未开放 |
| Mini App（Tap 小游戏） | `mini_app` | ✅ 在线玩 | 平台小游戏容器，本账号未开放 |

**实测**：`get-available-package-types` 对 阿瑞斯小队(1005095) 与 刀光尸潮(964358) 返回的可用类型均为 `["h5"]`。即本账号开发者权限下**只有 H5 一条链路可用**。

## 二、可直接玩的类型 = H5

- H5 包上传后状态 `ready`，绑定 main 槽位 → 提交审核 → 上线后用户点「在线玩」即可免下载即玩。
- 「云玩/云游戏」是另一套后台授权+选品流程，**不在 CLI 范围内**（上轮已确认），与本规范无关。

## 三、我提交的「刀光尸潮」是什么类型

- 刀光尸潮（App ID **964358**），状态「已上线」，最新版本 **V-20261030**（online / published）
- 上架包体类型 = **H5**（`available_package_types: ["h5"]`，线上 14 个 H5 包均 `ready`）

## 四、今后统一提交规范（所有 TapTap 游戏）

对每个游戏，按 H5 链路标准流程提交：

1. **上传/确认 H5 包**：`taptap-cli upload-h5-package`（H5 构建 zip 或单文件），得到 `package_id`，状态 `ready`
2. **创建草稿**：`taptap-cli app create-draft`
3. **绑定主包体**：`taptap-cli app select-package`，`slot=main`，`package={"id":"<package_id>","type":"h5"}`，`expected` 用 `list-packages` 读回的 main 槽位 expected 原样填
4. **补齐必填资料**：`save-changes`（title / category / icon / app_platforms 等 5 必填；建议补 description、developer_message、promotion_text、banner_4、square_promo_image、screenshots、gameplay_demo_video）
   - 宣传图规则：后期排版、仅保留游戏名标题、不截成多张拼图、标题不贴边裁切
5. **校验**：`taptap-cli app analyze-app-status` → 无 blockers/suggestions/warnings
6. **提交审核**：`taptap-cli app submit-app-review`，`release_schedule={"kind":"immediate"}`，先 dry-run 再 `--yes`
7. **跟进**：`list-app-versions` 轮询到 `online` / 处理素材反馈

### 固定参数
- dev-id：`484472`
- 包体类型：一律 `h5`
- H5 包格式：自包含单文件 `game/index.html`（无外部 http 依赖、无 launcher）

### 已按此规范完成的游戏
- 阿瑞斯小队（1005095）：H5 包 381805，已上线 V-20261029-1
- 刀光尸潮（964358）：H5 包（14 个 ready），已上线 V-20261030
