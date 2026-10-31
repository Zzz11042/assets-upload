# rednote-pilot —— 控制红米 Note 11 Pro 的 AI 助手

一个轻量级 Python 工具集，让你用自然语言 / API / CLI 控制你的 **Redmi Note 11 Pro**（或其他任意 Android 设备）：

- 📱 **通过 ADB 控制手机**：点击、滑动、按键、输入文字、启动/停止应用、截图、抓 UI 节点
- 🤖 **接入外部 LLM API**：任意 OpenAI 兼容端点（DeepSeek / OpenAI / 通义 / 智谱 / 自定义网关）
- 📁 **按要求修改手机文件**：`write / push / pull / rm / mv / mkdir / chmod / df / du`
- 🧩 **技能系统**：把常用动作封成可枚举的"技能"，LLM 可自动选择，也可被 API 直接调用
- 🌐 **HTTP API**：FastAPI 服务，可挂任何 Web 前端 / 其他系统调用

## 快速开始（3 分钟）

```bash
# 1. 安装
cd rednote-pilot
python -m venv .venv && source .venv/bin/activate
pip install -e .

# 2. 手机端
# - 设置 → 关于手机 → 连续点"版本号"7 次，解锁"开发者选项"
# - 设置 → 开发者选项 → 打开 "USB 调试"
# - 用数据线连接电脑，第一次会弹出"允许 USB 调试?"，选"始终允许"

# 3. 确认电脑能看到手机
adb devices
# 例如：
#   List of devices attached
#   ABCD1234    device

# 4. 装 ADBKeyboard（可选，输入中文必需）
# https://github.com/sunxiao1991/ADBKeyBoard
# 安装后在 设置 → 输入法 → 把 ADBKeyboard 设为默认

# 5. 配置 LLM（任选一家，默认 DeepSeek）
export REDNOTE_PILOT_LLM_API_KEY=sk-xxxxxxxx
# 可选：
# export REDNOTE_PILOT_LLM_BASE_URL=https://api.deepseek.com/v1
# export REDNOTE_PILOT_LLM_MODEL=deepseek-chat

# 6. 试一下
python -m rednote_pilot.cli devices       # 列出设备
python -m rednote_pilot.cli run "帮我打开设置"
python -m rednote_pilot.cli skill list_packages --args '{"filter":"miui"}'
```

## 接入外部 LLM API

`LLMClient` 是 **OpenAI 兼容**协议（`POST {base_url}/chat/completions`）。只需三个环境变量：

| 变量 | 说明 |
|---|---|
| `REDNOTE_PILOT_LLM_API_KEY` | 你家的 API Key |
| `REDNOTE_PILOT_LLM_BASE_URL` | 端点（DeepSeek 默认 `https://api.deepseek.com/v1`） |
| `REDNOTE_PILOT_LLM_MODEL` | 模型名（默认 `deepseek-chat`） |

不同供应商示例：

```bash
# DeepSeek
export REDNOTE_PILOT_LLM_API_KEY=sk-xxx
export REDNOTE_PILOT_LLM_BASE_URL=https://api.deepseek.com/v1
export REDNOTE_PILOT_LLM_MODEL=deepseek-chat

# OpenAI
export REDNOTE_PILOT_LLM_API_KEY=sk-xxx
export REDNOTE_PILOT_LLM_BASE_URL=https://api.openai.com/v1
export REDNOTE_PILOT_LLM_MODEL=gpt-4o-mini

# 通义 / 千问
export REDNOTE_PILOT_LLM_API_KEY=sk-xxx
export REDNOTE_PILOT_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
export REDNOTE_PILOT_LLM_MODEL=qwen-max

# 本地 Ollama / 公司网关（把 127.0.0.1:11434/v1 或你的网关地址填进去）
export REDNOTE_PILOT_LLM_API_KEY=ollama
export REDNOTE_PILOT_LLM_BASE_URL=http://127.0.0.1:11434/v1
export REDNOTE_PILOT_LLM_MODEL=qwen2.5:7b
```

代码内自定义：

```python
from rednote_pilot import LLMClient, LLMConfig, ADBDevice, Planner

cfg = LLMConfig(
    api_key="sk-xxx",
    base_url="https://api.deepseek.com/v1",
    model="deepseek-chat",
)
planner = Planner(ADBDevice(serial="ABCD1234"), LLMClient(cfg))
res = planner.execute("帮我打开文件管理器，把 /sdcard/dcim/a.jpg 改名成 b.jpg")
print(res.plan.actions)   # 查看 LLM 出的动作计划
print(res.results)        # 每步执行的输出
```

## 修改手机文件

`ADBDevice` 暴露完整的文件 API（shell 层）：

```python
from rednote_pilot import ADBDevice
d = ADBDevice()          # 自动发现第一台设备

d.ls("/sdcard/DCIM")                       # 列目录
d.cat("/sdcard/a.txt")                     # 读文件
d.write_file("/sdcard/a.txt", "hello")      # 写/覆盖文本文件
d.push("./local.png", "/sdcard/local.png")  # 推本地文件到手机
d.pull("/sdcard/photo.jpg", "./photo.jpg")  # 拉手机文件到本地
d.mkdir("/sdcard/mydir")
d.rm("/sdcard/junk.txt")
d.mv("/sdcard/a.jpg", "/sdcard/b.jpg")
d.cp("/sdcard/a.jpg", "/sdcard/c.jpg")
d.chmod("755", "/sdcard/script.sh")
d.df()                                     # 磁盘占用
d.du("/sdcard")                            # 目录体积
d.shell("find /sdcard -name '*.jpg' -mtime -1")   # 任意 shell
```

LLM 编排层把这些全部暴露成 `file` 工具组，自然语言直接说：

> "把手机里最近下载的图片都改名成 `img_001` 开头的"

## HTTP API（接入你自己的系统）

```bash
python -m rednote_pilot.server --host 127.0.0.1 --port 8710
```

常用端点（详见 `rednote_pilot/server.py` 顶部注释）：

```bash
curl http://127.0.0.1:8710/devices
curl -X POST http://127.0.0.1:8710/run \
  -H 'Content-Type: application/json' \
  -d '{"instruction":"打开小红书，搜索「redmi note 11 pro」"}'

curl -X POST http://127.0.0.1:8710/file/write \
  -H 'Content-Type: application/json' \
  -d '{"path":"/sdcard/hello.txt","content":"hi from rednote-pilot"}'

curl -X POST http://127.0.0.1:8710/skills/launch_rednote \
  -H 'Content-Type: application/json' \
  -d '{"args":{"package":"com.xhs.rednote"}}'
```

## 关于"控制 RedNote（小红书）"

`Planner` 把常用操作封成**技能**（`SkillRegistry.manifest()` 可列出全部），包括：

- `launch_rednote` / `open_search` / `tap` / `swipe` / `input_text` / `screenshot` / `dump_ui`
- 任意 shell 兜底（高风险）

小红书 App 的包名（v1.14+ 在 MIUI/HyperOS 上）通常是 `com.xhs.rednote`。如果不确定，先跑：

```bash
python -m rednote_pilot.cli skill list_packages --args '{"filter":"xhs"}'
```

> ⚠️ **安全说明**
> - 本工具默认只监听 `127.0.0.1`，请勿把 API 直接暴露公网
> - LLM 只能输出受 schema 约束的动作（`tool/method/args`），不会直接"点屏"
> - 高风险操作（`rm` / `shell` / `install_apk`）在 manifest 里标了 `risk: high`，前端可据此做人工审批
> - 涉及账号登录、支付、验证码、密码等操作，请人工完成，不要把手机钥匙交给模型

## 仓库结构

```
rednote-pilot/
├── rednote_pilot/
│   ├── __init__.py       # 顶层导出
│   ├── adb_device.py     # ADB 控制 + 文件 + UI + 应用管理
│   ├── llm.py            # OpenAI 兼容 LLM 客户端
│   ├── planner.py        # 自然语言 -> 动作计划 -> 执行
│   ├── system_prompt.py  # 动态 system prompt（注入设备型号/分辨率）
│   ├── skills.py         # 技能系统（确定性动作）
│   ├── server.py         # FastAPI HTTP 服务
│   └── cli.py            # 命令行入口
├── examples/
│   ├── quick.py          # 一键 demo
│   └── http_example.py   # 纯 HTTP 客户端示例
├── tests/
│   └── test_offline.py   # 不依赖设备的单测（LLM 回显/计划解析）
├── pyproject.toml
└── README.md
```

> **Planner 行为说明**：每次 `plan()` 会先调用 `device.info()` 拿到当前设备的型号/系统版本/分辨率，
> 动态注入到 LLM 的 system prompt（见 `system_prompt.build_system_prompt`）。
> 这样 LLM 在选 `tap` 坐标时知道屏幕是 `1080x2400`，在选 `launch` 时知道是 MIUI 还是 HyperOS。
> 离线（echo）模式不会调 `device.info()`，可直接在没连手机时调试计划解析。

## 离线测试（不接手机）

```bash
pytest tests/test_offline.py
# 或者：
python -c "
from rednote_pilot import LLMClient, LLMConfig, Planner
import json
# 不接设备，只看计划
class FakeDevice: pass
p = Planner(FakeDevice(), LLMClient(LLMConfig.echo()))
print(json.dumps(p.plan('打开设置').as_json(), ensure_ascii=False, indent=2))
"
```

## 路线图

- [ ] OCR 视觉定位（用截图 + 本地模型识别"搜索"按钮位置）
- [ ] 技能录制器（边操作边生成 skill manifest）
- [ ] 风险审批 Web UI（high 技能需点确认）
- [ ] 多设备并发（当前 CLI/API 是单设备串行）
