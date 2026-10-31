"""离线单测：验证 LLM 回显 / 计划解析 / 技能清单 / system prompt，不需要设备。"""

import json

from rednote_pilot.adb_device import DeviceInfo
from rednote_pilot.llm import LLMClient, LLMConfig, ChatMessage
from rednote_pilot.planner import Planner
from rednote_pilot.skills import SkillRegistry
from rednote_pilot.system_prompt import build_system_prompt


class FakeDevice:
    """什么都不做的假设备，验证 planner 的 plan-only 路径。"""

    def info(self):
        raise NotImplementedError

    def as_dict(self):
        return {}

    # 下面这些方法在 plan-only 时不会被调用，
    # 但 planner.execute 的非 dry_run 路径会调用它们，
    # 我们仅测试 plan 与 dry_run。
    def ls(self, *a): return []
    def cat(self, *a): return ""
    def write_file(self, *a): pass
    def tap(self, *a): pass
    def swipe(self, *a): pass
    def keyevent(self, *a): pass
    def input_text(self, *a): pass
    def input_text_unicode(self, *a): pass
    def launch_app(self, *a): pass
    def stop_app(self, *a): pass
    def current_app(self): return ""
    def list_packages(self, *a): return []
    def get_package_info(self, *a): return {}
    def install_apk(self, *a): return ""
    def uninstall_app(self, *a): return ""
    def pull(self, *a): return ""
    def push(self, *a): pass
    def rm(self, *a): pass
    def mv(self, *a): pass
    def cp(self, *a): pass
    def chmod(self, *a): pass
    def mkdir(self, *a): pass
    def df(self): return ""
    def du(self, *a): return ""
    def screenshot(self, *a, **kw): return ""
    def dump_ui(self, **kw): return {"nodes": [], "xml": ""}
    def shell(self, *a, **kw): return ""


def test_llm_echo_mode():
    llm = LLMClient(LLMConfig.echo())
    assert llm.is_echo
    out = llm.chat([ChatMessage("user", "hello")])
    parsed = json.loads(out)
    assert parsed["echo"] == "hello"


def test_skill_registry_manifest():
    reg = SkillRegistry()
    names = reg.names()
    for required in ("launch_rednote", "screenshot", "write_file", "tap", "shell"):
        assert required in names
    manifest = reg.manifest()
    # 高风险技能要有标记
    risky = {m["name"]: m["risk"] for m in manifest}
    assert risky["shell"] == "high"
    assert risky["remove_file"] == "high"


def test_planner_dry_run_does_not_execute():
    """dry_run 时不调用 FakeDevice 上的破坏性方法。"""
    calls: list[str] = []

    class TracingDevice(FakeDevice):
        def rm(self, *a, **kw):
            calls.append("rm")
            return super().rm(*a, **kw)

    d = TracingDevice()
    p = Planner(d, LLMClient(LLMConfig.echo()))
    res = p.execute("删除 /sdcard/junk", dry_run=True)
    # echo 模式下 plan.actions 为空（提示型计划），不会真执行
    assert res.plan is not None
    assert "rm" not in calls


def test_system_prompt_with_device_context():
    """build_system_prompt 注入设备型号/分辨率，并包含安全约束。"""
    d = DeviceInfo(
        serial="X", model="Redmi Note 11 Pro",
        android_version="13", sdk=33,
        resolution="1080x2400", orientation="0",
    )
    p = build_system_prompt(d)
    assert "Redmi Note 11 Pro" in p
    assert "1080x2400" in p
    assert "0..1080 x 0..2400" in p          # 坐标范围提示
    assert "ui.dump_ui" in p                   # 提示用 dump_ui 定位
    assert "登录" in p and "支付" in p          # 安全约束
    assert "com.xhs.rednote" in p              # 包名速查


def test_system_prompt_without_device():
    """设备为 None 时不出现'设备上下文'段，但工具清单仍在。"""
    p = build_system_prompt(None)
    assert "设备上下文" not in p
    assert "可用动作" in p
    assert "file:" in p


def test_planner_plan_calls_device_info():
    """LLM 模式下 plan() 会调一次 device.info()，并把结果注入 system。"""
    import rednote_pilot.llm as m

    sent: dict = {}

    class _Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": json.dumps(
                {"thought": "t", "actions": [{"tool": "input", "method": "tap", "args": {"x": 100, "y": 200}}], "expected": "ok"})}}]}

    class _Client:
        def __init__(self, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def post(self, url, headers, json):
            sent["json"] = json
            sent["url"] = url
            return _Resp()

    m.httpx.Client = _Client

    calls: list = []

    class InfoDevice(FakeDevice):
        def info(self):
            calls.append(1)
            return DeviceInfo(serial="F", model="Redmi Note 11 Pro", android_version="13", resolution="1080x2400")

    d = InfoDevice()
    p = Planner(d, LLMClient(LLMConfig(api_key="k", base_url="http://x/v1", model="m")))
    plan = p.plan("点一下")
    assert calls == [1]                                  # 只调一次
    assert "Redmi Note 11 Pro" in sent["json"]["messages"][0]["content"]
    assert plan.actions and plan.actions[0]["method"] == "tap"
