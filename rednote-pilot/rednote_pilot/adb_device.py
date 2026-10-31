"""ADB 设备控制层。

通过本地 adb 可执行文件（或 TCP 连接的远程 adb server）控制 Android 设备。
覆盖：设备连接/查询、shell 命令执行、输入模拟（点击/滑动/按键/文字）、
应用管理（安装/卸载/启动/停止/前台查询）、屏幕操作（截图/UI 转储）、
文件操作（push/pull/ls/mkdir/rm/mv/cp/cat/chmod/df/du 与二进制流式同步）。
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

DEFAULT_ADB_PATH = "adb"
DEFAULT_TIMEOUT_S = 30.0


@dataclass
class DeviceInfo:
    """已连接设备的基础信息。"""

    serial: str
    state: str = "device"
    product: str = ""
    model: str = ""
    device: str = ""
    android_version: str = ""
    sdk: int = 0
    manufacturer: str = ""
    resolution: str = ""
    orientation: str = ""
    _extra_props: dict[str, str] = field(default_factory=dict)

    @property
    def is_online(self) -> bool:
        return self.state == "device"

    def as_dict(self) -> dict[str, Any]:
        d = {
            "serial": self.serial,
            "state": self.state,
            "model": self.model,
            "manufacturer": self.manufacturer,
            "android_version": self.android_version,
            "sdk": self.sdk,
            "resolution": self.resolution,
            "orientation": self.orientation,
        }
        for k, v in self._extra_props.items():
            if k in ("brand", "display", "ram", "rom") and v:
                d[k] = v
        return d


class ADBError(RuntimeError):
    """adb 调用失败时抛出，携带 stderr 原文。"""


class DeviceNotFound(ADBError):
    pass


class ADBDevice:
    """封装对单台设备的 adb 操作。线程安全通过外部串行锁保证。"""

    def __init__(
        self,
        serial: Optional[str] = None,
        adb_path: str = DEFAULT_ADB_PATH,
        host: Optional[str] = None,
        port: Optional[int] = None,
        timeout: float = DEFAULT_TIMEOUT_S,
    ) -> None:
        self.serial = serial
        self.adb_path = adb_path
        self.host = host
        self.port = port
        self.timeout = timeout
        if not self._which(adb_path):
            raise ADBError(
                f"找不到 adb 可执行文件: {adb_path!r}。"
                "请安装 Android Platform Tools 或传入自定义路径。"
            )

    # ------------------------------------------------------------------ #
    # 基础
    # ------------------------------------------------------------------ #
    @staticmethod
    def _which(exe: str) -> bool:
        return shutil.which(exe) is not None or Path(exe).is_file()

    def _target_args(self) -> list[str]:
        args: list[str] = []
        if self.host and self.port:
            args += ["-H", self.host, "-P", str(self.port)]
        if self.serial:
            args += ["-s", self.serial]
        return args

    def _run(
        self,
        *args: str,
        shell: bool = False,
        input_data: Optional[bytes] = None,
        binary: bool = False,
        timeout: Optional[float] = None,
        check: bool = True,
    ) -> bytes:
        """执行 adb 命令，返回 stdout（可为二进制）。"""
        cmd = [self.adb_path, *self._target_args(), *args]
        try:
            proc = subprocess.run(
                cmd,
                input=input_data,
                capture_output=True,
                text=not binary,
                timeout=timeout or self.timeout,
            )
        except FileNotFoundError as exc:
            raise ADBError(f"adb 不存在或无权限: {exc}") from exc
        except subprocess.TimeoutExpired as exc:
            raise ADBError(f"adb 命令超时({timeout or self.timeout}s): {' '.join(cmd)}") from exc
        if check and proc.returncode != 0:
            err = (proc.stderr or "").strip() or f"returncode={proc.returncode}"
            raise ADBError(f"adb {' '.join(args)} 失败: {err}")
        return proc.stdout

    def _text(self, *args: str, **kw: Any) -> str:
        return self._run(*args, binary=False, **kw).decode("utf-8", "replace")

    def shell(self, cmd: str, timeout: Optional[float] = None) -> str:
        """在设备 shell 中执行命令，返回合并 stdout+stderr。"""
        out = self._text("shell", cmd, timeout=timeout)
        return out

    def shell_json(self, cmd: str, timeout: Optional[float] = None) -> Any:
        """执行 shell 命令并解析 JSON 输出（供结构化数据接口使用）。"""
        raw = self.shell(cmd, timeout=timeout)
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            start = raw.find("[")
            end = raw.rfind("]")
        if start == -1 or end == -1:
            raise ADBError(f"无法从输出解析 JSON: {raw[:200]!r}")
        return json.loads(raw[start : end + 1])

    # ------------------------------------------------------------------ #
    # 设备发现
    # ------------------------------------------------------------------ #
    @staticmethod
    def discover_devices(adb_path: str = DEFAULT_ADB_PATH, host: Optional[str] = None, port: Optional[int] = None) -> list[DeviceInfo]:
        """列出所有已连接且状态为 device 的设备。"""
        args = []
        if host and port:
            args += ["-H", host, "-P", str(port)]
        if not ADBDevice._which(adb_path):
            raise ADBError(f"找不到 adb 可执行文件: {adb_path!r}")
        proc = subprocess.run(
            [adb_path, *args, "devices"], capture_output=True, text=True, timeout=15
        )
        devices: list[DeviceInfo] = []
        for line in (proc.stdout or "").splitlines()[1:]:
            m = re.match(r"^(\S+)\s+(device|offline|unauthorized|no device)\b", line)
            if not m:
                continue
            serial, state = m.group(1), m.group(2)
            devices.append(DeviceInfo(serial=serial, state=state))
        return devices

    def connect(self, serial: str, timeout: float = 15.0) -> DeviceInfo:
        """连接一台设备（USB 或 TCP/IP）。"""
        self._text("shell", "echo ok", timeout=timeout)
        return self.info()

    def disconnect(self) -> None:
        self._text("disconnect", check=False)

    def info(self) -> DeviceInfo:
        """读取设备详细属性（型号/系统/分辨率等）。"""
        base = DeviceInfo(serial=self.serial or "unknown")
        try:
            raw = self.shell("getprop; echo '---'; wm size; wm density", timeout=15)
        except ADBError:
            raise DeviceNotFound(f"设备 {self.serial} 不可达")
        prop_re = re.compile(r"^\[([^\]]+)\] \[([^\]]*)\]")
        for line in raw.splitlines():
            m = prop_re.match(line.strip())
            if not m:
                continue
            key, value = m.group(1), m.group(2)
            if not value:
                continue
            if key == "ro.product.model":
                base.model = value
            elif key == "ro.product.brand":
                base.manufacturer = value
            elif key == "ro.build.version.release":
                base.android_version = value
            elif key == "ro.build.version.sdk":
                base.sdk = int(value) if value.isdigit() else 0
            elif key in ("ro.product.device", "ro.product.name"):
                base.device = value
            elif key in ("ro.hardware", "ro.board.platform"):
                base._extra_props.setdefault("device", value)
        for m in re.finditer(r"Physical size: (\d+x\d+)", raw):
            base.resolution = m.group(1)
        for m in re.finditer(r"mCurrentRotation=(\d)", raw):
            base.orientation = {0: "0", 1: "90", 2: "180", 3: "270"}.get(m.group(1), m.group(1))
        return base

    # ------------------------------------------------------------------ #
    # 输入模拟
    # ------------------------------------------------------------------ #
    def tap(self, x: int, y: int) -> None:
        self.shell(f"input tap {int(x)} {int(y)}")

    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300) -> None:
        self.shell(f"input swipe {int(x1)} {int(y1)} {int(x2)} {int(y2)} {int(duration_ms)}")

    def keyevent(self, code: int | str) -> None:
        """KeyCode: 数字（Android KeyEvent）或别名（home/back/enter 等）。"""
        alias = {
            "home": "KEYCODE_HOME",
            "back": "KEYCODE_BACK",
            "enter": "KEYCODE_ENTER",
            "recent": "KEYCODE_APP_SWITCH",
            "menu": "KEYCODE_MENU",
            "power": "KEYCODE_POWER",
            "volume_up": "KEYCODE_VOLUME_UP",
            "volume_down": "KEYCODE_VOLUME_DOWN",
            "camera": "KEYCODE_CAMERA",
        }
        if isinstance(code, str) and code in alias:
            code = alias[code]
        self.shell(f"input keyevent {code}")

    def input_text(self, text: str) -> None:
        """输入纯文本。中文等非 ASCII 走 ime 通道（需要设备支持）。"""
        text = text.replace("'", "").replace('"', "").replace(" ", "")
        self.shell(f'input text "{text}"')

    def input_text_unicode(self, text: str) -> None:
        """通过广播给 ADBKeyboard 输入 Unicode 文本（中文友好）。

        需要设备已安装 https://github.com/sunxiao1991/ADBKeyBoard
        并将其设为默认输入法。
        """
        escaped = text.replace('"', "").replace("'", "").replace("&", "")
        self.shell(f'am broadcast -a ADB_INPUT_TEXT --es msg "{escaped}"')

    def screenshot(self, local_path: str | Path, timeout: float = 60.0) -> Path:
        """截屏并保存到本地。返回本地路径。"""
        p = Path(local_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        self._run(
            "exec-out", "screencap", "-p",
            binary=True, timeout=timeout,
        )
        # screencap 输出直接作为 stdout 返回
        data = self._run("exec-out", "screencap", "-p", binary=True, timeout=timeout)
        p.write_bytes(data)
        return p

    def dump_ui(self, timeout: float = 30.0) -> dict[str, Any]:
        """抓取当前界面的 UI 节点树（包名/文本/类名/边界）。"""
        remote = "/sdcard/__ui_dump.xml"
        self.shell(f"rm -f {remote}")
        self.shell(f"uiautomator dump {remote}")
        xml = self.shell(f"cat {remote}")
        self.shell(f"rm -f {remote}", check=False)
        nodes = self._parse_ui_nodes(xml)
        return {"xml": xml, "nodes": nodes}

    @staticmethod
    def _parse_ui_nodes(xml_text: str) -> list[dict[str, Any]]:
        """解析 uiautomator dump 为扁平节点列表。"""
        import xml.etree.ElementTree as ET

        nodes: list[dict[str, Any]] = []
        for chunk in re.findall(
            r"<hierarchy[^>]*>.*?</hierarchy>", xml_text, flags=re.S
        ):
            root = ET.fromstring(chunk)
            for node in root.iter("node"):
                rect = node.get("bounds", "")
                m = re.match(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", rect)
                box = (
                    {"l": int(m.group(1)), "t": int(m.group(2)), "r": int(m.group(3)), "b": int(m.group(4))}
                    if m
                    else {}
                )
                nodes.append(
                    {
                        "class": node.get("class", ""),
                        "text": node.get("text", ""),
                        "content_desc": node.get("content-desc", ""),
                        "resource_id": node.get("resource-id", ""),
                        "package": node.get("package", ""),
                        "clickable": node.get("clickable") == "true",
                        "bounds": box,
                    }
                )
        return nodes

    # ------------------------------------------------------------------ #
    # 应用管理
    # ------------------------------------------------------------------ #
    def list_packages(self, filter_str: Optional[str] = None) -> list[str]:
        """列出已安装包名；filter_str 非空时按子串过滤。"""
        out = self.shell("pm list packages")
        pkgs = [
            line[len("package:"):].strip()
            for line in out.splitlines()
            if line.startswith("package:")
        ]
        if filter_str:
            pkgs = [p for p in pkgs if filter_str in p]
        return pkgs

    def get_package_info(self, package: str) -> dict[str, Any]:
        """查询包信息：版本、是否系统应用、导出 activity。"""
        dump = self.shell(f"dumpsys package {package}")
        info: dict[str, Any] = {"package": package}
        m = re.search(r"versionName=([^\s]+)", dump)
        info["version"] = m.group(1) if m else ""
        m = re.search(r"targetSdkVersion=(\d+)", dump)
        info["target_sdk"] = int(m.group(1)) if m else 0
        info["system_app"] = re.search(r"\(system|user\)\s", dump) is None and "Flags: [ SYSTEM" in dump
        acts: list[str] = []
        for m in re.finditer(
            r"([\w.]+/.+Activity\b.*?)(?:\n\{|\Z)", dump, re.S
        ):
            acts.append(m.group(1).strip().split("\n")[0])
        info["activities"] = [a for a in acts if "/" in a][:20]
        return info

    def launch_app(self, package: str, activity: str = "") -> None:
        """启动应用。activity 为空则走 monkey 默认入口。"""
        if activity:
            self.shell(f"am start -a android.intent.action.MAIN -n {package}/{activity}")
        else:
            self.shell(f"monkey -p {package} -c android.intent.category.LAUNCHER 1")

    def stop_app(self, package: str) -> None:
        self.shell(f"am force-stop {package}")

    def install_apk(self, local_apk: str | Path) -> str:
        """通过 push + pm install 安装本地 APK。返回 stdout。"""
        p = Path(local_apk)
        remote = f"/data/local/tmp/{p.name}"
        self._run("push", str(p), remote, timeout=300)
        return self.shell(f"pm install -r {remote}")

    def uninstall_app(self, package: str) -> str:
        return self.shell(f"pm uninstall {package}")

    def current_app(self) -> str:
        """返回当前前台包名（启发式：mResumedActivity 优先）。"""
        out = self.shell("dumpsys window")
        m = re.search(r"mResumedActivity=.*?([a-zA-Z][\w.]*)/[\w.]+", out)
        if m:
            return m.group(1)
        m = re.search(r"topResumedActivity=.*?([a-zA-Z][\w.]*)/[\w.]+", out)
        return m.group(1) if m else ""

    # ------------------------------------------------------------------ #
    # 文件操作（shell 层）
    # ------------------------------------------------------------------ #
    def ls(self, path: str = "/sdcard") -> list[dict[str, str]]:
        """以 JSON 友好的方式列出目录。"""
        raw = self.shell(f"ls -la {path}")
        entries: list[dict[str, str]] = []
        for line in raw.splitlines()[1:]:
            parts = line.split(None, 8)
            if len(parts) < 8:
                continue
            size = parts[4]
            mtime = " ".join(parts[5:8])
            name = parts[8] if len(parts) == 9 else parts[7]
            entries.append(
                {"mode": parts[0], "size": size, "mtime": mtime, "name": name, "type": "dir" if parts[0].startswith("d") else "file"}
            )
        return entries

    def cat(self, path: str, max_bytes: int = 512 * 1024) -> str:
        data = self._run("shell", "cat", path, binary=False, timeout=self.timeout)
        return data.decode("utf-8", "replace")[:max_bytes]

    def write_file(self, path: str, content: str) -> None:
        """在设备上创建/覆盖文本文件（走 base64 分块，避免 shell 转义问题）。

        文件最终落在 path；先写 path.b64 再解码，最后删除临时文件。
        """
        import base64

        parent = path.rsplit("/", 1)[0] if "/" in path else ""
        if parent:
            self.shell(f'mkdir -p "{parent}"', check=False)
        b64 = base64.b64encode(content.encode("utf-8")).decode()
        self.shell(f'rm -f "{path}"', check=False)
        chunk = 4000
        for i in range(0, len(b64), chunk):
            self.shell(f"echo -n '{b64[i : i + chunk]}' >> \"{path}.b64\"")
        self.shell(f'base64 -d "{path}.b64" > "{path}" && rm -f "{path}.b64"')

    def push(self, local: str | Path, remote: str, timeout: float = 300.0) -> None:
        p = Path(local)
        if not p.exists():
            raise ADBError(f"本地文件不存在: {local}")
        self._run("push", str(p), remote, timeout=timeout)

    def pull(self, remote: str, local: str | Path, timeout: float = 300.0) -> Path:
        p = Path(local)
        p.parent.mkdir(parents=True, exist_ok=True)
        self._run("pull", remote, str(p), timeout=timeout)
        return p

    def mkdir(self, path: str) -> None:
        self.shell(f"mkdir -p {path}")

    def rm(self, path: str) -> None:
        self.shell(f"rm -rf {path}")

    def mv(self, src: str, dst: str) -> None:
        self.shell(f"mv {src} {dst}")

    def cp(self, src: str, dst: str) -> None:
        self.shell(f"cp -r {src} {dst}")

    def chmod(self, mode: str, path: str) -> None:
        self.shell(f"chmod {mode} {path}")

    def df(self) -> str:
        return self.shell("df -h /sdcard /data 2>/dev/null || df -h")

    def du(self, path: str) -> str:
        return self.shell(f"du -sh {path} 2>/dev/null")
