"""RedNote（红米）Pilot 的 AI 编排层。

把自然语言指令交给 LLM，LLM 按 JSON 输出受约束的动作计划；
本层校验计划后下发到 ADBDevice 执行，并回收结果。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional

from .adb_device import ADBDevice, ADBError
from .llm import ChatMessage, LLMClient
from .system_prompt import build_system_prompt

# 旧代码与外部调用方可能引用 SYSTEM_PROMPT，保留别名（默认无设备上下文）。
SYSTEM_PROMPT = build_system_prompt(None)


@dataclass
class ActionPlan:
    thought: str
    actions: list[dict[str, Any]]
    expected: str

    def as_json(self) -> str:
        return json.dumps(
            {"thought": self.thought, "actions": self.actions, "expected": self.expected},
            ensure_ascii=False,
        )


@dataclass
class ExecResult:
    ok: bool
    results: list[dict[str, Any]]
    plan: Optional[ActionPlan] = None
    error: str = ""
    notes: str = ""


class Planner:
    """自然语言 -> 动作计划 -> 执行 的编排器。"""

    def __init__(self, device: ADBDevice, llm: LLMClient | None = None) -> None:
        self.device = device
        self.llm = llm or LLMClient()

    def plan(self, instruction: str, context: Optional[dict[str, Any]] = None) -> ActionPlan:
        if self.llm.is_echo:
            # 离线回显模式：不调 LLM，直接给一个提示型计划
            return ActionPlan(
                thought="LLM echo mode: 未配置 API key，无法生成动作计划。"
                        "请设置 REDNOTE_PILOT_LLM_API_KEY 后重试。",
                actions=[],
                expected=f"收到指令: {instruction[:200]}",
            )
        # 动态生成 system prompt：带上当前设备的型号/分辨率等上下文
        try:
            device_info = self.device.info()
        except Exception:
            device_info = None
        system_prompt = build_system_prompt(device_info)
        ctx = json.dumps(context or {}, ensure_ascii=False)
        user_msg = f"用户指令: {instruction}\n当前上下文: {ctx}"
        msg = [ChatMessage("system", system_prompt), ChatMessage("user", user_msg)]
        try:
            raw = self.llm.chat(msg, json_mode=True)
            obj = self.llm._parse_json(raw)
        except Exception as exc:
            return ActionPlan(thought=f"LLM 不可用或返回无法解析: {exc}", actions=[], expected="请检查 LLM 配置后重试")
        actions = obj.get("actions", []) or []
        # 仅保留已知 tool 名，避免幻觉
        known = {"device", "input", "app", "file", "ui", "shell"}
        actions = [a for a in actions if isinstance(a, dict) and a.get("tool") in known]
        return ActionPlan(
            thought=str(obj.get("thought", ""))[:300],
            actions=actions,
            expected=str(obj.get("expected", "")),
        )

    def execute(self, instruction: str, context: Optional[dict[str, Any]] = None, dry_run: bool = False) -> ExecResult:
        plan = self.plan(instruction, context)
        if not plan.actions:
            return ExecResult(ok=False, results=[], plan=plan, error="无可执行动作", notes=plan.thought)
        results: list[dict[str, Any]] = []
        for i, a in enumerate(plan.actions):
            tool, method, args = a.get("tool"), a.get("method"), a.get("args", {})
            entry: dict[str, Any] = {"index": i, "tool": tool, "method": method, "args": args, "ok": False, "output": ""}
            if dry_run:
                entry["output"] = "[dry-run] 未实际执行"
                results.append(entry)
                continue
            try:
                out = self._dispatch(tool, method, args)
                entry["ok"] = True
                entry["output"] = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False, default=str)
            except (ADBError, ValueError) as exc:
                entry["output"] = f"错误: {exc}"
            except Exception as exc:  # noqa: BLE001
                entry["output"] = f"未知错误: {exc}"
            results.append(entry)
        ok = all(r["ok"] for r in results)
        return ExecResult(ok=ok, results=results, plan=plan, notes=plan.expected)

    # ------------------------------------------------------------------ #
    def _dispatch(self, tool: str, method: str, args: dict[str, Any]) -> Any:
        d = self.device
        if tool == "device":
            if method == "status":
                return d.info().as_dict()
            if method == "list_devices":
                return [x.as_dict() for x in ADBDevice.discover_devices(d.adb_path, d.host, d.port)]
            raise ValueError(f"unknown device method: {method}")
        if tool == "input":
            if method == "tap":
                d.tap(int(args["x"]), int(args["y"]))
                return "ok"
            if method == "swipe":
                d.swipe(int(args["x1"]), int(args["y1"]), int(args["x2"]), int(args["y2"]), int(args.get("ms", 300)))
                return "ok"
            if method == "keyevent":
                d.keyevent(args.get("code", "back"))
                return "ok"
            if method == "text":
                text = str(args.get("s", ""))
                if any(ord(ch) > 127 for ch in text):
                    d.input_text_unicode(text)
                else:
                    d.input_text(text)
                return "ok"
            raise ValueError(f"unknown input method: {method}")
        if tool == "app":
            if method == "list_packages":
                return d.list_packages(args.get("filter"))
            if method == "get_package_info":
                return d.get_package_info(str(args["pkg"]))
            if method == "launch":
                d.launch_app(str(args["pkg"]), str(args.get("activity", "")))
                return "launched"
            if method == "stop":
                d.stop_app(str(args["pkg"]))
                return "stopped"
            if method == "current_app":
                return d.current_app()
            raise ValueError(f"unknown app method: {method}")
        if tool == "file":
            if method == "read":
                return d.cat(str(args["path"]))
            if method == "write":
                d.write_file(str(args["path"]), str(args.get("content", "")))
                return "written"
            if method == "push":
                d.push(str(args["local"]), str(args["remote"]))
                return "pushed"
            if method == "pull":
                p = d.pull(str(args["remote"]), str(args["local"]))
                return str(p)
            if method == "mkdir":
                d.mkdir(str(args["path"]))
                return "made"
            if method == "rm":
                d.rm(str(args["path"]))
                return "removed"
            if method == "mv":
                d.mv(str(args["src"]), str(args["dst"]))
                return "moved"
            if method == "cp":
                d.cp(str(args["src"]), str(args["dst"]))
                return "copied"
            if method == "chmod":
                d.chmod(str(args["mode"]), str(args["path"]))
                return "chmod"
            if method == "ls":
                return d.ls(str(args.get("path", "/sdcard")))
            if method == "df":
                return d.df()
            if method == "du":
                return d.du(str(args["path"]))
            raise ValueError(f"unknown file method: {method}")
        if tool == "ui":
            if method == "screenshot":
                p = d.screenshot(str(args.get("local", "/tmp/rednote_shot.png")))
                return str(p)
            if method == "dump_ui":
                return d.dump_ui()["nodes"]
            raise ValueError(f"unknown ui method: {method}")
        if tool == "shell":
            return d.shell(str(args["cmd"]))
        raise ValueError(f"unknown tool: {tool}")
