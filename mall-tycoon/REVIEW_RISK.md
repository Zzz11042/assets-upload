# 商场大亨(H5) — 提审前风险清单(应用 989062)

按 taptap-cli 官方 `review-risk-checklist` 五组结构整理,来源类型与文档章节均标注。
生成时间:2026-10-20;数据全部来自当次 CLI 读取(非旧会话)。

## 一、确定性阻断项(服务端当前事实)

| 项 | 严重度 | 状态 | 证据 | 下一步 |
|---|---|---|---|---|
| SCE 协议未签 | 阻断 | 未处理 | `analyze-app-status` → `SCE_AGREEMENT_REQUIRED` blocker,field_ids=[] | 用户明确同意后 `app agree-sce-agreement --yes`,再重查确认消失 |
| 主包体 | 无 | 已满足 | `list-packages` → `current_bindings=[{package_id:336456, slot:main}]`,status=ready,H5 | 无需动作 |
| 必填素材(square_promo_image) | 无 | 已满足 | `get-app-module assets-upload` 读回 = `https://img-tc.tapimg.com/.../4e82e52f...png`(750x1334) | 无需动作 |

## 二、官方规则人工复核项(无法机器验证的内容语义)

引用:TapTap 游戏审核规范细则 v4(https://developer.taptap.cn/docs/store/release/publish/agree/),规则目录 `official-review-rules-v4.md`。

| 规则 | 摘要 | 检查状态 |
|---|---|---|
| `review.material.visual_quality` | 图片/视频清晰、无拉伸/模糊/纯色/简单图案 | **需人工复核** — 5 张截图与方形宣传图为程序化绘制,实机视频为 UI 状态卡片序列;内容合规,但审核员可能判定"过于简单",建议提审前人工过目 |
| `review.game.quality_dependency` | 不得简单网页套壳、主要功能依赖第三方 | **需人工复核** — 本作 H5 包体即游戏本体,符合 H5 应用定位;无第三方依赖 |
| `review.general.illegal_sensitive` | 无违法/涉政/涉赌/色情/广告法禁用词 | 需人工复核 — 文案与画面均为商场经营,无敏感内容;未见风险 |
| `review.material.no_code_group_link` | 文案不得含兑换码/玩家群/外部链接 | 已满足 — 简介/开发者的话均无外链 |

## 三、历史审核风险

无。`list-app-versions` 显示该应用仅 1 个版本 `V-20261020`,status=draft(last_event=draft_created),**从未提交审核**,无 `review_rejected` 记录。

## 四、无法验证项

- 实机演示视频(video_id=5996268)的服务端素材审核结果 — 按官方规则,视频上传拿 videoId 即视为素材已提供,后台转码/素材审核不在提审前确认范围;提交后由服务端异步判定。
- 审核员对"卡片序列视频是否算实机录屏"的最终判定 — 官方未明确禁止;如驳回,需重新录制真实游戏运行录屏替换。

## 五、已通过项(当前确定性证据)

| 项 | 证据 |
|---|---|
| 游戏本体功能完整 | jsdom 全量回归 9/9 通过(onboard/建铺/升级/拆除/过天/财报/成就/存档/重开) |
| 手机触屏/PWA 适配 | viewport/safe-area/禁缩放验证通过 |
| H5 包体结构合规 | `game/index.html` 单目录 zip,`upload-h5-package` 结构预检通过 |
| 简介/截图/图标/Banner/方形图/视频/开发者的话 | 全部读回验证非空 |
| 资质事实 | `app_features`(离线/无内购/无 AI/无 IP, package_types=[h5])已写入;ai-declaration 草稿 saved(非 AIGC);`analyze-app-status` 无 `QUALIFICATION_INCOMPLETE` warning → 无必须资质缺口 |

## 提审前置(需用户操作)

1. **SCE 协议**:用户明确同意 → `agree-sce-agreement --yes` → 重查 blocker 消失
2. **游戏检测**:按 [TEST_CHECKLIST.md](<mall-tycoon/web/TEST_CHECKLIST.md>) 12 项
3. **提审三步**(用户点头"提审"后):
   - `prepare-review-snapshot --data '{"release_schedule":{"kind":"immediate"}}'`
   - `precheck-app-review`(复用同一 release_schedule 与指纹)
   - 预检结果确认 → `submit-app-review --idempotency-key <key> --yes`
