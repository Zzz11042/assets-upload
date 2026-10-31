# douyin-ops — 抖音账号全自动运营

## 账号
- 昵称：用户5717444115965
- 抖音号：74277034968
- 手机：17881151118（仅用于安全验证）

## 脚本
| 脚本 | 用途 |
|------|------|
| `bin/login.mjs` | 扫码/SMS 登录（已完成，session 保存在 `profiles/default`） |
| `bin/publish-v9.mjs` | 上传并发布视频；若触发安全验证，将 SMS 验证码写入 `state/smscode.txt` 即可 |
| `bin/gen-video.mjs` | 用 ffmpeg 生成 9:16 竖屏视频（gradient/slideshow/text 风格） |
| `bin/reply-comments.mjs` | 抓取评论并自动回复（`--dry-run` 只预览） |
| `bin/status.mjs` | 抓取账号/作品数据 → `state/status.json` |
| `bin/poll.mjs` | 每 N 分钟自动跑 status + reply |
| `bin/schedule-publish.mjs` | 定时发布视频（内容队列在 `state/queue.json`） |

## 内容流水线
1. `state/queue.json` 中放入待发布内容：`{ "file": "videos/x.mp4", "title": "...", "desc": "...", "tags": "..." }`
2. `schedule-publish.mjs` 按节奏取出并调用 publish-v9
3. 安全验证触发时：把 SMS 代码写 `state/smscode.txt`（或 `DY_CODE_FILE`），publish-v9 自动填入

## 风控说明
- 拟人化节奏：每步随机延迟 0.5-3s，发布间隔 ≥ 2h
- 新设备/异地登录会触发 SMS 验证（一次性或周期性）
- 持续操作有被限流/封号风险，已在前述沟通中确认接受
