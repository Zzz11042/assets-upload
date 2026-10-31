# gametest — AI Agent 游戏测试 CLI

让任意多模态 AI agent「像人一样操作 H5 游戏,边看画面边决策」的命令行工具。
设计参考了 [OSWorld](https://github.com/elophanto/EloPhanto/blob/main/docs/33-OSWORLD.md#1) 的"截图+动作循环"与 [WarGames](https://pypi.org/project/wargames/0.1.0/#1) 的"像素输入+小动作集+图像回传"模式,底层换成系统级 headless Firefox(geckodriver),零额外依赖(仅 Node 内置模块)。

**被测目标(本期)**:`ares-squad`(末日小队,单文件 H5 游戏)。
**交互形态**:CLI 子命令 + 统一 JSON 输出 + 每步自动截图落盘 PNG,agent 每轮"读图 → 发下一个动作",即 OSWorld 式像素回环。

---

## 快速开始

```bash
cd gametest
./gametest start --url "file://$(pwd)/../ares-squad/web/index.html"
./gametest state                    # 看当前状态 + 截图
./gametest click-elem "#btnStart"   # 点"开始指挥"进营地
./gametest shot                     # 仅截图
./gametest stop                     # 结束会话
./gametest shutdown                 # 关闭后台控制台(可选)
```

每个命令输出**一行可读 JSON**到 stdout,agent 直接解析即可。

---

## 命令一览

| 命令 | 说明 | 示例 |
|---|---|---|
| `start --url <u> [--session s]` | 启动会话并加载页面,返回首帧 | `./gametest start --url "file:///.../index.html"` |
| `shot [--base64]` | 仅截图,落盘 `shot/<sid>_stepN.png` | `./gametest shot` |
| `click X Y [--button left\|right]` | 在**视口 client 坐标**发真实鼠标点击 | `./gametest click 683 307` |
| `tap X Y` | 触摸 tap(事件双发 + 补 click,命中 canvas) | `./gametest tap 683 307` |
| `click-elem <selector>` | 按 CSS 选择器定位元素并点其中心 | `./gametest click-elem "#btnDeploy"` |
| `key K1 K2… [--hold]` | 键盘按键,支持多键;`--hold` 只按不放 | `./gametest key P` |
| `type "text"` | 向当前焦点输入框打字(游戏无输入框时返回错误属正常) | `./gametest type abc` |
| `wait 秒数` | 本地等待,给战斗动画时间推进 | `./gametest wait 2` |
| `drag X1 Y1 X2 Y2` | 拖拽(本期简化为落点点击,预留通用化) | `./gametest drag 100 100 300 300` |
| `reset` | 游戏重开:清 localStorage + 重载,回到新档 | `./gametest reset` |
| `state` | 截图 + 读游戏内部状态(双通道) | `./gametest state` |
| `stop` | 结束当前会话 | `./gametest stop` |
| `shutdown` | 关闭后台控制台进程 | `./gametest shutdown` |

全局:`GAMETEST_SESSION=s2 ./gametest …` 可切换会话(默认 `s1`)。

### 输出结构(所有命令统一)

```jsonc
{
  "ok": true,
  "session": "s1",
  "action": "click-elem",
  "step": 7,
  "image_path": "shot/s1_step007.png",   // 相对 gametest/ 的截图路径
  "image_b64": null,                      // 加 --base64 时内嵌
  "exec": { "ok": true, "center": {"x":524,"y":177} },  // 动作执行回执
  "state": {                               // 双通道状态
    "dom": { "hud": {"gold":"160",...}, "onboard": false, "viewTag":"营地 · 前哨", ... },
    "game": { "inBattle":false, "view":"camp", "mission":1, "gold":160, "food":14,
              "nsoldiers":0, "nenemies":0, "paused":false, "win":0, "camX":0 }
  }
}
```

- `dom` 通道:读 HUD/浮层等 DOM 文本,稳定、快。
- `game` 通道:注入 `<script>` 进页面 realm 读游戏内部变量(`S`/`soldiers`/`enemies`/`civ`/`camX`…),是**精确回环**的关键——agent 可直接拿"任务几、金币多少、敌还剩几个、暂停没有"做决策,不必只靠像素。
- 失败时 `ok:false` + `error` 字段,进程退出码非 0。

### 拟人输入层说明
所有动作都通过 `document.dispatchEvent` 派发**真实 DOM 事件**(`MouseEvent`/`TouchEvent`/`KeyboardEvent`/`input`),带正确 `clientX/Y`、`bubbles`、`cancelable`、`button`——让游戏代码与真人玩家走**完全相同的输入路径**,不绕过任何游戏逻辑。坐标点击用 `document.elementFromPoint` 精确命中,元素定位点击取 `getBoundingClientRect` 中心。未引入贝塞尔轨迹等过度拟人(保持简单、可复现)。

---

## Agent 接入最小回环

```
start --url <file>
loop:
   r = state        # 读图 + 读 game 状态
   决定动作 a
   r = click / click-elem / key / wait
   观察 r.image_path(用 read_image) 与 r.state.game
reset  # 需要新档时
stop
```

对本模型(agent)而言:每轮 `./gametest state` 拿到 `image_path` 后用 `read_image` 读图,结合 `state.game` 的 `mission/inBattle/nenemies` 判断局面,再 `./gametest click …` 推进。

---

## 验证结果(本期端到端)
- ✅ 引导浮层 → 营地:点 `#btnStart`,overlay 由 `onboard` 转 `null`,`view=camp`。
- ✅ 营地建造:点 `.bld` 卡片,金币扣减、`toast` 反馈。
- ✅ 出击任务1(清剿):`#btnDeploy` → `inBattle=true`,数轮内 `mission=2, win=1`。
- ✅ 任务2(护送):平民 x 推进到 1880(接近 WORLD_W=1920),`mission=3`。
- ✅ 任务3(尸潮/僵尸王):`mission=4, win=3` 通关。
- ✅ `reset` 可一键重开新档(gold 160 / food 14 / mission 1)。
- ✅ 截图序列落盘 `shot/s1_step001.png … 031.png`,可复盘。
- ✅ 后台控制台与 geckodriver 可通过 `stop`/`shutdown` 干净关闭。

## 文件结构
```
gametest/
  gametest          # bash 包装器(可执行)
  bin/gametest.js   # CLI:子命令解析、HTTP 调用、JSON 输出
  lib/console.js    # 长驻控制台:geckodriver + HTTP API + 会话 + 输入注入 + 截图 + 状态探针
  shot/             # 截图输出(运行时生成)
  .console.json     # 控制台状态(pid/port/driverPort/sessions,运行时生成)
```

## 依赖与限制
- Node ≥18(本机 22);geckodriver(`/snap/bin/firefox.geckodriver`)。
- 仅 headless Firefox;状态探针的 `game` 通道为 ares-squad 专属,换游戏需改 `scriptForState`(已封装成单一函数)。
- 通用化路线:加 `--url` 复用命令,按目标游戏替换状态探针 + 建筑槽位/技能按钮的 CSS 选择器表即可接入 mall-tycoon、mo-sword 等其它单文件 H5。