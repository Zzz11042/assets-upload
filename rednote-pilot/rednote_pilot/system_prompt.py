"""Planner 用的 system prompt 构造器。

把工具清单、JSON 输出约定、设备上下文、安全约束合成一段 system 消息。
`Planner.plan()` 每次都会带当前 device info 动态生成，
避免 LLM 在"分辨率多少 / 型号是什么"上瞎猜。
"""

from __future__ import annotations

import json
from typing import Any, Optional

from .adb_device import DeviceInfo

# 工具组与方法的硬约束（LLM 只能选这些）
TOOL_CATALOG = """\
device:
  status, list_devices
input:
  tap(x, y), swipe(x1, y1, x2, y2, ms), keyevent(code|home|back|enter), text(s)
app:
  list_packages(filter), get_package_info(pkg), launch(pkg, activity?), stop(pkg), current_app
file:
  read(path), write(path, content), push(local, remote), pull(remote, local),
  mkdir(path), rm(path), mv(src, dst), cp(src, dst), chmod(mode, path),
  ls(path), df, du(path)
ui:
  screenshot(local), dump_ui, screenshot_and_save(path)
shell:
  exec(cmd)   # 谨慎：仅运行明确且可逆的命令；破坏性/系统级命令见下方安全约束
"""

JSON_SPEC = """\
输出约定（必须严格 JSON，字段名固定；不要加 ```json 围栏）：
{
  "thought": "简要说明推理（<=80 字）",
  "actions": [
    {"tool": "app", "method": "launch", "args": {"pkg": "com.xhs.rednote"}},
    {"tool": "input", "method": "tap", "args": {"x": 540, "y": 2000}}
  ],
  "expected": "执行后用户应看到什么（一句话）"
}
"""

SAFETY_RULES = """\
安全约束（硬性，违反就返回空 actions）：
- 禁止：删除 /system、/vendor、/data、/sdcard/Android/ 之外的根目录
- 禁止：reboot、pm uninstall -k、install -r 系统包
- 禁止：涉及登录、支付、验证码、密码、银行卡的操作
- 不明确的指令（缺参数、同名联系人、目标二义）必须 actions:[] 并写 expected
- 高风险 tool（shell.rm/install）只在指令明确要求时执行，并在 thought 中说明
"""

PKG_HINTS = """\
常用包名速查（MIUI / HyperOS，按需 list_packages 确认）：
- 文件管理: com.miui.files / com.android.documentsui
- 相机: com.android.camera / com.hynic.camera / com.lge.camera
- 微信: com.tencent.mm   淘宝: com.taobao.taobao
- 小红书: com.xhs.rednote （若未装，先 list_packages filter=xhs）
"""


def build_system_prompt(device: Optional[DeviceInfo]) -> str:
    """生成完整的 system prompt。device 为 None 时省略设备上下文段。"""
    ctx_lines: list[str] = []
    if device is not None:
        ctx_lines.append("当前设备上下文（来自 getprop/wm）：")
        ctx_lines.append(
            json.dumps(
                {
                    "model": device.model,
                    "manufacturer": device.manufacturer,
                    "android_version": device.android_version,
                    "sdk": device.sdk,
                    "resolution": device.resolution,
                    "orientation": device.orientation,
                },
                ensure_ascii=False,
            )
        )
        if device.resolution:
            w, h = device.resolution.split("x")
            ctx_lines.append(
                f"屏幕 {device.resolution}，点击坐标范围 0..{w} x 0..{h}；"
                "若不确定控件位置，先用 ui.dump_ui 获取节点树，按 bounds 中心点 tap。"
            )
    ctx_block = ("\n".join(ctx_lines) + "\n\n") if ctx_lines else ""
    return (
        "你是红米手机的自动化助手。把用户指令翻译成结构化动作计划。\n\n"
        f"{ctx_block}"
        f"可用动作（只能选以下 tool/method）：\n{TOOL_CATALOG}\n\n"
        f"{JSON_SPEC}\n\n{SAFETY_RULES}\n\n{PKG_HINTS}\n"
    )
