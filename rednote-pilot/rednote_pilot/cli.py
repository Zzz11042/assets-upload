"""CLI 入口：python -m rednote_pilot.cli ..."""

from __future__ import annotations

import argparse
import json
import os
import sys

from .adb_device import ADBDevice, ADBError
from .llm import LLMClient, LLMConfig
from .planner import Planner
from .skills import SkillRegistry


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="rednote-pilot", description="控制红米 Note 11 Pro 的 AI 助手")
    p.add_argument("--serial", help="adb 设备序列号（不传用第一台在线设备）")
    p.add_argument("--echo", action="store_true", help="离线回显模式（不调 LLM）")
    sub = p.add_subparsers(dest="cmd")

    sub.add_parser("devices", help="列出设备")
    sub.add_parser("skills", help="列出可用技能")

    dinfo = sub.add_parser("info", help="当前设备信息")

    run = sub.add_parser("run", help="按自然语言执行")
    run.add_argument("instruction")
    run.add_argument("--dry", action="store_true", help="只出计划不执行")

    plan = sub.add_parser("plan", help="只看计划")
    plan.add_argument("instruction")

    sk = sub.add_parser("skill", help="调用单个技能")
    sk.add_argument("name")
    sk.add_argument("--args", default="{}", help="JSON 参数")

    sub.add_parser("shot", help="截屏到 /tmp")
    args = p.parse_args(argv)

    if args.cmd in ("devices", None):
        devs = ADBDevice.discover_devices()
        for d in devs:
            print(d.serial, d.state)
        return 0 if devs else 1
    if args.cmd == "skills":
        print(json.dumps(SkillRegistry().manifest(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "info":
        d = _pick_device(args)
        print(json.dumps(d.info().as_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "run" or args.cmd == "plan":
        d = _pick_device(args)
        llm = LLMClient(LLMConfig.echo() if args.echo or not os.environ.get("REDNOTE_PILOT_LLM_API_KEY") and not os.environ.get("OPENAI_API_KEY") else LLMConfig.from_env())
        planner = Planner(d, llm)
        if args.cmd == "plan":
            plan_obj = planner.plan(args.instruction)
            print(plan_obj.as_json())
        else:
            res = planner.execute(args.instruction, dry_run=args.dry)
            print(json.dumps(
                {"ok": res.ok, "plan": {"thought": res.plan.thought, "actions": res.plan.actions, "expected": res.plan.expected}, "results": res.results},
                ensure_ascii=False, indent=2,
            ))
        return 0
    if args.cmd == "skill":
        d = _pick_device(args)
        reg = SkillRegistry()
        try:
            out = reg.call(args.name, d, json.loads(args.args))
            print(json.dumps(out, ensure_ascii=False, indent=2))
        except KeyError as exc:
            print(f"未知技能: {exc}", file=sys.stderr)
            return 2
        return 0
    if args.cmd == "shot":
        d = _pick_device(args)
        pth = d.screenshot("/tmp/rednote_shot.png")
        print(pth)
        return 0
    p.print_help()
    return 1


def os_getenv_key() -> str:
    import os
    return os.environ.get("REDNOTE_PILOT_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")


def _pick_device(args: argparse.Namespace) -> ADBDevice:
    if args.serial:
        return ADBDevice(serial=args.serial)
    found = ADBDevice.discover_devices()
    if not found:
        print("没有可用设备（请确认已连接并开启 USB 调试）", file=sys.stderr)
        raise SystemExit(1)
    return ADBDevice(serial=found[0].serial)


if __name__ == "__main__":
    raise SystemExit(main())
