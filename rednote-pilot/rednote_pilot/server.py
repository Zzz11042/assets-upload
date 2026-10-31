"""FastAPI 服务：把 RedNote Pilot 暴露为 HTTP API。

端点：
GET  /health
GET  /devices
GET  /skills
POST /plan            {instruction, context?}        -> 动作计划
POST /run             {instruction, context?, dry_run?} -> 计划+执行结果
POST /skills/{name}   {args}                          -> 单技能调用
POST /file/read       {path}
POST /file/write      {path, content}
POST /file/list       {path}
POST /file/push       {local, remote}
POST /file/pull       {remote, local}
POST /file/mkdir      {path}
POST /file/rm         {path}
POST /file/mv         {src, dst}
POST /ui/screenshot   {local}
POST /ui/dump         {}
POST /app/launch      {pkg, activity?}
POST /app/stop        {pkg}
POST /app/current     {}
POST /input/tap       {x, y}
POST /input/swipe     {x1, y1, x2, y2, ms?}
POST /input/key       {code}
POST /input/text      {s}

设备由启动参数 --serial 或请求头 X-Device-Serial 指定；
未指定时使用发现到的第一台设备。
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .adb_device import ADBDevice, ADBError, DeviceNotFound
from .llm import LLMClient, LLMConfig
from .planner import Planner
from .skills import SkillRegistry

registry = SkillRegistry()


def _default_llm_config() -> LLMConfig:
    provider = os.environ.get("REDNOTE_PILOT_LLM_PROVIDER", "deepseek")
    cfg = LLMConfig.from_env(provider)
    if not cfg.api_key:
        cfg.model = os.environ.get("REDNOTE_PILOT_LLM_MODEL", cfg.model)
    return cfg


class AppState:
    def __init__(self) -> None:
        self.device: Optional[ADBDevice] = None
        self.planner: Optional[Planner] = None
        self.llm: Optional[LLMClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state = AppState()
    yield


app = FastAPI(title="RedNote Pilot", version="0.1.0", lifespan=lifespan)


# ------------------------------------------------------------------ #
# 设备管理
# ------------------------------------------------------------------ #
def _get_device(app: FastAPI, serial: Optional[str]) -> ADBDevice:
    serial = serial or os.environ.get("REDNOTE_PILOT_SERIAL")
    if serial:
        dev = ADBDevice(serial=serial)
    else:
        found = ADBDevice.discover_devices()
        if not found:
            raise HTTPException(404, "没有可用设备（请确认已连接并开启 USB 调试）")
        dev = ADBDevice(serial=found[0].serial)
    try:
        dev.info()
    except (ADBError, DeviceNotFound) as exc:
        raise HTTPException(503, f"设备不可用: {exc}")
    return dev


def _planner(app: FastAPI) -> Planner:
    if app.state.planner is None:
        app.state.llm = LLMClient(_default_llm_config())
    return app.state.planner


# ------------------------------------------------------------------ #
# 请求体
# ------------------------------------------------------------------ #
class RunReq(BaseModel):
    instruction: str
    context: dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False
    serial: Optional[str] = None


class PlanReq(BaseModel):
    instruction: str
    context: dict[str, Any] = Field(default_factory=dict)
    serial: Optional[str] = None


class SkillReq(BaseModel):
    args: dict[str, Any] = Field(default_factory=dict)
    serial: Optional[str] = None


class FileReadReq(BaseModel):
    path: str
    serial: Optional[str] = None


class FileWriteReq(BaseModel):
    path: str
    content: str
    serial: Optional[str] = None


class FileDirReq(BaseModel):
    path: str = "/sdcard"
    serial: Optional[str] = None


class FileTransferReq(BaseModel):
    local: str
    remote: str
    serial: Optional[str] = None


class MvReq(BaseModel):
    src: str
    dst: str
    serial: Optional[str] = None


class TapReq(BaseModel):
    x: int
    y: int
    serial: Optional[str] = None


class SwipeReq(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int
    ms: int = 300
    serial: Optional[str] = None


class KeyReq(BaseModel):
    code: str = "back"
    serial: Optional[str] = None


class TextReq(BaseModel):
    s: str
    serial: Optional[str] = None


class AppReq(BaseModel):
    pkg: str
    activity: str = ""
    serial: Optional[str] = None


class ScreenshotReq(BaseModel):
    local: str = "/tmp/rednote_shot.png"
    serial: Optional[str] = None


# ------------------------------------------------------------------ #
# 路由
# ------------------------------------------------------------------ #
@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "rednote-pilot", "version": app.title}


@app.get("/devices")
def devices() -> dict[str, Any]:
    try:
        found = ADBDevice.discover_devices()
        return {"devices": [d.as_dict() for d in found]}
    except ADBError as exc:
        raise HTTPException(500, str(exc))


@app.get("/skills")
def skills() -> dict[str, Any]:
    return {"skills": registry.manifest()}


@app.post("/plan")
def plan(req: PlanReq) -> dict[str, Any]:
    app.state.device = _get_device(app, req.serial)
    planner = Planner(app.state.device, LLMClient(_default_llm_config()))
    p = planner.plan(req.instruction, req.context)
    return {
        "plan": {"thought": p.thought, "actions": p.actions, "expected": p.expected},
    }


@app.post("/run")
def run(req: RunReq) -> dict[str, Any]:
    device = _get_device(app, req.serial)
    planner = Planner(device, LLMClient(_default_llm_config()))
    res = planner.execute(req.instruction, req.context, dry_run=req.dry_run)
    return {
        "ok": res.ok,
        "plan": {"thought": res.plan.thought, "actions": res.plan.actions, "expected": res.plan.expected} if res.plan else None,
        "results": res.results,
        "error": res.error,
    }


@app.post("/skills/{name}")
def skill(name: str, req: SkillReq) -> dict[str, Any]:
    device = _get_device(app, req.serial)
    try:
        out = registry.call(name, device, req.args)
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    except ADBError as exc:
        raise HTTPException(502, str(exc))
    return {"skill": name, "ok": True, "result": out}


# 文件 API ---------------------------------------------------------------- #
@app.post("/file/read")
def file_read(req: FileReadReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    return {"path": req.path, "content": d.cat(req.path)}


@app.post("/file/write")
def file_write(req: FileWriteReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.write_file(req.path, req.content)
    return {"path": req.path, "written": True}


@app.post("/file/list")
def file_list(req: FileDirReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    return {"path": req.path, "entries": d.ls(req.path)}


@app.post("/file/push")
def file_push(req: FileTransferReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.push(req.local, req.remote)
    return {"remote": req.remote}


@app.post("/file/pull")
def file_pull(req: FileTransferReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    p = d.pull(req.remote, req.local)
    return {"local": str(p)}


@app.post("/file/mkdir")
def file_mkdir(req: FileDirReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.mkdir(req.path)
    return {"path": req.path}


@app.post("/file/rm")
def file_rm(req: FileDirReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.rm(req.path)
    return {"removed": req.path}


@app.post("/file/mv")
def file_mv(req: MvReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.mv(req.src, req.dst)
    return {"src": req.src, "dst": req.dst}


# UI / App / Input ------------------------------------------------------ #
@app.post("/ui/screenshot")
def ui_screenshot(req: ScreenshotReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    p = d.screenshot(req.local)
    return {"path": str(p)}


@app.post("/ui/dump")
def ui_dump(req: FileDirReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    return d.dump_ui()


@app.post("/app/launch")
def app_launch(req: AppReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.launch_app(req.pkg, req.activity)
    return {"pkg": req.pkg}


@app.post("/app/stop")
def app_stop(req: AppReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.stop_app(req.pkg)
    return {"stopped": req.pkg}


@app.post("/app/current")
def app_current(req: FileDirReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    return {"package": d.current_app()}


@app.post("/input/tap")
def input_tap(req: TapReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.tap(req.x, req.y)
    return {"x": req.x, "y": req.y}


@app.post("/input/swipe")
def input_swipe(req: SwipeReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.swipe(req.x1, req.y1, req.x2, req.y2, req.ms)
    return "swiped"


@app.post("/input/key")
def input_key(req: KeyReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    d.keyevent(req.code)
    return {"code": req.code}


@app.post("/input/text")
def input_text(req: TextReq) -> dict[str, Any]:
    d = _get_device(app, req.serial)
    if any(ord(c) > 127 for c in req.s):
        d.input_text_unicode(req.s)
    else:
        d.input_text(req.s)
    return "typed"


# ------------------------------------------------------------------ #
# 启动 CLI
# ------------------------------------------------------------------ #
def main() -> None:
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="RedNote Pilot API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8710)
    parser.add_argument("--serial", help="指定设备序列号；不传则用发现到的第一台")
    args = parser.parse_args()
    if args.serial:
        os.environ["REDNOTE_PILOT_SERIAL"] = args.serial
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
