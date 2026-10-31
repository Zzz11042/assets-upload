# 商场大亨 — 最终交接清单(两个应用)

生成时间:2026-10-20。数据均来自当次 taptap-cli 读回验证,非旧会话推测。

## 应用 1:商场大亨 (app_id 988611, package_type=apk)

旧版应用,保留不动。服务端包体类型为 APK,拒收 H5 包体(`upload-h5-package` 返回 422 "该应用类型不支持上传 H5 包体"),占位 APK(size=0)无法解析。

- 简介/截图/图标/Banner/推荐语:已写入远端
- 主包体:未绑定(仅 2 个 size=0 占位记录,不可用)
- blocker:`MISSING_PACKAGE`
- 若后续要走此应用:需准备**真实可安装 APK**(Unity/CI 产物),走 `upload-apk` → `select-package`

## 应用 2:商场大亨(H5) (app_id 989062, package_type=h5)

**当前主推路线**,全部素材与包体已就绪:

| 项 | 状态 | 证据 |
|---|---|---|
| H5 包体 | ✅ 绑定 main 槽位, ready | package_id=336456 |
| 简介 | ✅ 296 字符 | 读回 |
| 游戏截图 | ✅ 5 张 | 读回 |
| 图标 / Banner / 方形宣传图 | ✅ | 读回 |
| 实机演示视频 | ✅ video_id=5996268 | 读回(Playwright 渲染真实 UI + ffmpeg 合成) |
| 开发者的话 / 推荐语 | ✅ | 读回 |
| 资质事实 | ✅ app_features(离线/无内购/无AI/无IP/H5)已写入 | 读回 |
| AI 声明资质 | 🔄 reviewing | audit_id=475629(非阻断,无 QUALIFICATION_INCOMPLETE warning) |
| 游戏本体 | ✅ jsdom 回归 9/9 | index.bundle.html |

### 唯一剩余 blocker
`SCE_AGREEMENT_REQUIRED` — 《创意工坊内容授权协议》(https://www.taptap.cn/doc/ugcgame-agreement)
签署方式(二选一):
- 用户在对话中回复"同意签署" → 执行 `taptap-cli app agree-sce-agreement --dev-id 484472 --app-id 989062 --yes`
- 用户自行到 https://www.taptap.cn/doc/ugcgame-agreement 签署,回来重查

### 游戏检测
- 桌面:双击 `web/MALL_TYCOON_H5_桌面版.html`
- 服务器:`http://127.0.0.1:8731/index.bundle.html`(服务在线)
- 手机(同一内网):`http://10.110.47.234:8731/index.bundle.html`
- 12 项清单:[web/TEST_CHECKLIST.md](<mall-tycoon/web/TEST_CHECKLIST.md>)

### 提审(用户回复"提审"后执行,官方三步契约)
1. `taptap-cli app prepare-review-snapshot --dev-id 484472 --app-id 989062`(read,仅 scope;返回 `revision`+`version_id`,保存)
2. `taptap-cli app precheck-app-review --dev-id 484472 --app-id 989062 --data '{"release_schedule":{"kind":"immediate"},"version_id":"<步骤1的version_id>"}'`(预检,可跳过;展示 blockers/warnings,用户确认)
3. 用户最终确认 → `taptap-cli app submit-app-review --dev-id 484472 --app-id 989062 --data '{"release_schedule":{"kind":"immediate"},"version_id":"<步骤1的version_id>"}' --idempotency-key <key> --yes`(high-risk write)

注意:第 2/3 步必须传完全相同的 `release_schedule`;`version_id` 与第 1 步不一致时回到第 1 步重新生成快照。精确定时上线须 ≥ 当前时间 + 6 小时,本方案用"立即上线"。

提审前风险清单:[REVIEW_RISK.md](<mall-tycoon/REVIEW_RISK.md>)
