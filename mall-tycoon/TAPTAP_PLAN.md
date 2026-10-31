# TapTap 上架执行计划（商场大亨）

> 依据官方文档 https://developer.taptap.cn/v3/cli/ (taptap-cli) 整理。
> 规则:所有写操作先 `--dry-run` → 用户确认 → 同一份 payload + 幂等键 + `--yes`。

## 已完成
- [x] taptap-cli 安装(npm 全局,v2026.10.20)
- [ ] auth login(等待用户浏览器授权)

## 上架步骤

| # | 步骤 | 命令 | 风险 |
|---|---|---|---|
| 1 | 选定厂商 | `taptap-cli developer +list` → `developer +enter --dev-id <id>` | 写(保存上下文) |
| 2 | 创建游戏草稿 | `taptap-cli app create-app --dev-id <id> --data '{"title":"商场大亨","category":"simulation","developer_role":"developer","package_type":"apk"}' --idempotency-key <k1> --dry-run` 然后 `--yes` | 写 |
| 3 | 检查缺口 | `taptap-cli app analyze-app-status --dev-id <id> --app-id <appId>` | 只读 |
| 4 | 传素材 | `upload ./icon.png`、`upload-video ./trailer.mp4 --scene trailer`(均需 --idempotency-key + --yes) | 写 |
| 5 | 写资料字段 | `app get-app-module` → `app save-changes`(每批≤5字段) | 写 |
| 6 | 传 APK | `taptap-cli upload-apk ./mall-tycoon.apk --dev-id <id> --app-id <appId> --yes` | 写 |
| 7 | 绑包体 | `app list-packages` → `app select-package`(槽位:主包体) | 写 |
| 8 | 资质分析 | `qualification analyze-qualification-status --data '{"online":true,"in_app_purchase":true,"ai":false,"ip":false}'` | 只读 |
| 9 | 提审快照 | `app prepare-review-snapshot --data '{"release_schedule":{"kind":"immediate"}}'` → 存 review_fingerprint | 只读 |
| 10 | 预检 | `app precheck-app-review`(复用指纹+上线方式) | 只读 |
| 11 | 提交审核 | `app submit-app-review --data @review-submit.json --idempotency-key <k2> --yes` | 高危不可逆 |

## 提交后
- `dashboard-stats get-dashboard-stats` 看 download/reserve/review 指标
- `player-feedback list-player-reviews` 跟进差评
- CBT/OBT 走 `test-plan`(一个游戏同时只有一个未结束测试计划)

## 关键约束
- 提审三步(snapshot/precheck/submit)必须复用同一 review_fingerprint 与 release_schedule
- 提交失败时先读服务端状态,不更换幂等键盲重试
- 资质中的敏感材料(证件/联系人)只能在开发者中心网页处理
- 大陆正式商用需要游戏版号;可先走 TapTap 预约/测试轨


## 执行记录(2026-10-20)

- 厂商:喜欢摸鱼工作室(dev-id 484472)
- 草稿:商场大亨(app-id 988611,category=simulation,package_type=apk)
  - 资料页:https://developer.taptap.cn/v3/484472/app/988611/store/update
- 资料写入:5 字段成功(description / promotion_material_type=BANNER_4 / banner_4 / icon / screenshots×3),无 stale
- 素材:art/ 下 icon.png(512)、banner_16x9.png(1920×1080)、screenshot_1..5.png(720×1280),占位图
- APK:上传记录 1067675 / 1067682,但解析后 size=0、version_code=0,未进入可绑定候选
  - 根因:占位包无真实 Android 结构,服务端解析失败
- 资质缺口:game-license / icp-filing / privacy-compliance / anti-addiction / ai-declaration / software-copyright / authorization-letters / security-assessment,全部 pending_upload
- 未完成:绑定主包体 → 提审快照/预检/提交

### 待办(按序)
1. 用真实构建产物替换占位 APK:本机无 Unity 编辑器 / Android SDK / JDK,需外部出包
   - 路径 A:Unity Editor 构建 Android APK(项目可直接打开,见 README)
   - 路径 B:CI(装 JDK+Android SDK 装最小可解析 APK,耗时长)
2. 真实 APK 上传后:`app list-packages` 出候选 → `select-package` 绑定 main 槽位
3. 补齐资质材料(版号/备案/软著等,敏感材料走开发者中心网页)
4. `prepare-review-snapshot` → `precheck-app-review` → `submit-app-review --yes`
5. 上架后:`dashboard-stats` / `player-feedback` 跟数据与评价
