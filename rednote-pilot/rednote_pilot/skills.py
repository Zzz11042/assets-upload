"""技能（Skills）系统：把常用的 RedNote/红米操作封装成确定性技能。

每个技能是一个 Skill 对象，LLM 在编排层之外也能被 API 直接调用。
技能清单（manifest）描述技能名/参数/安全级别，由 planner 和 API 共用。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .adb_device import ADBDevice
from .planner import Planner


@dataclass
class Skill:
    name: str
    description: str
    params: dict[str, Any]
    risk: str = "low"  # low | medium | high
    handler: Callable[[ADBDevice, dict[str, Any]], Any] = field(repr=False, default=None)  # type: ignore

    def invoke(self, device: ADBDevice, args: dict[str, Any]) -> Any:
        if self.handler is None:
            raise NotImplementedError(f"skill {self.name} 没有 handler")
        return self.handler(device, args or {})

    def as_manifest(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "params": self.params,
            "risk": self.risk,
        }


def _build_skills() -> list[Skill]:
    """内置技能库。"""

    def launch_rednote(d: ADBDevice, a: dict[str, Any]) -> dict:
        pkg = a.get("package", "com.xhs.rednote")
        d.launch_app(pkg, a.get("activity", ""))
        return {"launched": pkg}

    def open_search(d: ADBDevice, a: dict[str, Any]) -> dict:
        pkg = a.get("package", "com.xhs.rednote")
        d.launch_app(pkg, a.get("activity", ""))
        return {"hint": "红米 Note 11 Pro 默认分辨率 1080x2400；红米 11 Pro 的搜索入口通常在上部"}

    def screenshot(d: ADBDevice, a: dict[str, Any]) -> dict:
        p = d.screenshot(a.get("local", "/tmp/rednote_shot.png"))
        return {"path": str(p)}

    def read_file(d: ADBDevice, a: dict[str, Any]) -> dict:
        return {"content": d.cat(str(a["path"]))}

    def write_file(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.write_file(str(a["path"]), str(a.get("content", "")))
        return {"path": a["path"], "written": True}

    def pull_file(d: ADBDevice, a: dict[str, Any]) -> dict:
        p = d.pull(str(a["remote"]), str(a["local"]))
        return {"local": str(p)}

    def push_file(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.push(str(a["local"]), str(a["remote"]))
        return {"remote": a["remote"]}

    def list_dir(d: ADBDevice, a: dict[str, Any]) -> dict:
        return {"entries": d.ls(str(a.get("path", "/sdcard")))}

    def remove_file(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.rm(str(a["path"]))
        return {"removed": a["path"]}

    def move_file(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.mv(str(a["src"]), str(a["dst"]))
        return {"src": a["src"], "dst": a["dst"]}

    def make_dir(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.mkdir(str(a["path"]))
        return {"made": a["path"]}

    def tap(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.tap(int(a["x"]), int(a["y"]))
        return {"x": a["x"], "y": a["y"]}

    def swipe(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.swipe(int(a["x1"]), int(a["y1"]), int(a["x2"]), int(a["y2"]), int(a.get("ms", 300)))
        return "swiped"

    def keyevent(d: ADBDevice, a: dict[str, Any]) -> dict:
        d.keyevent(a.get("code", "back"))
        return "keyevent"

    def input_text(d: ADBDevice, a: dict[str, Any]) -> dict:
        text = str(a.get("s", ""))
        if any(ord(ch) > 127 for ch in text):
            d.input_text_unicode(text)
        else:
            d.input_text(text)
        return "typed"

    def shell(d: ADBDevice, a: dict[str, Any]) -> dict:
        return {"stdout": d.shell(str(a["cmd"]))}

    def install_apk(d: ADBDevice, a: dict[str, Any]) -> dict:
        return {"stdout": d.install_apk(str(a["local_apk"]))}

    def current_app(d: ADBDevice, a: dict[str, Any]) -> dict:
        return {"package": d.current_app()}

    def list_packages(d: ADBDevice, a: dict[str, Any]) -> dict:
        return {"packages": d.list_packages(a.get("filter"))}

    return [
        Skill("launch_rednote", "打开红米 Note 11 Pro 上的 RedNote 应用", {"package": "com.xhs.rednote", "activity": ""}, "low", launch_rednote),
        Skill("open_search", "打开 RedNote 应用（搜索入口需结合坐标操作）", {"package": "com.xhs.rednote", "activity": ""}, "low", open_search),
        Skill("screenshot", "截屏并保存到本地", {"local": "/tmp/rednote_shot.png"}, "low", screenshot),
        Skill("read_file", "读取设备上的文本文件", {"path": "/sdcard"}, "low", read_file),
        Skill("write_file", "在设备上创建/覆盖文本文件", {"path": "/sdcard/x.txt", "content": ""}, "medium", write_file),
        Skill("pull_file", "把设备文件拉到本地", {"remote": "/sdcard/a.txt", "local": "./a.txt"}, "medium", pull_file),
        Skill("push_file", "把本地文件推到设备", {"local": "./a.txt", "remote": "/sdcard/a.txt"}, "medium", push_file),
        Skill("list_dir", "列目录", {"path": "/sdcard"}, "low", list_dir),
        Skill("remove_file", "删除设备上的文件或目录", {"path": "/sdcard/x"}, "high", remove_file),
        Skill("move_file", "移动/重命名", {"src": "", "dst": ""}, "medium", move_file),
        Skill("make_dir", "创建目录", {"path": "/sdcard/x"}, "low", make_dir),
        Skill("tap", "点击坐标", {"x": 0, "y": 0}, "low", tap),
        Skill("swipe", "滑动", {"x1": 0, "y1": 0, "x2": 0, "y2": 0, "ms": 300}, "low", swipe),
        Skill("keyevent", "按键（home/back/enter 等）", {"code": "back"}, "low", keyevent),
        Skill("input_text", "输入文本（中文用 ADBKeyboard）", {"s": ""}, "low", input_text),
        Skill("shell", "在设备 shell 执行命令（谨慎）", {"cmd": ""}, "high", shell),
        Skill("install_apk", "安装本地 APK", {"local_apk": ""}, "high", install_apk),
        Skill("current_app", "获取前台应用包名", {}, "low", current_app),
        Skill("list_packages", "列出已安装包", {"filter": ""}, "low", list_packages),
    ]


class SkillRegistry:
    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {}
        for s in _build_skills():
            self._skills[s.name] = s

    def names(self) -> list[str]:
        return sorted(self._skills)

    def get(self, name: str) -> Optional[Skill]:
        return self._skills.get(name)

    def manifest(self) -> list[dict[str, Any]]:
        return [s.as_manifest() for s in sorted(self._skills.values(), key=lambda s: s.name)]

    def call(self, name: str, device: ADBDevice, args: Optional[dict[str, Any]] = None) -> Any:
        s = self._skills.get(name)
        if s is None:
            raise KeyError(f"unknown skill: {name}")
        return s.invoke(device, args or {})

    def call_json(self, name: str, device: ADBDevice, args: Optional[dict[str, Any]] = None) -> str:
        return json.dumps(self.call(name, device, args), ensure_ascii=False, default=str)


__all__ = ["Skill", "SkillRegistry", "Planner"]
