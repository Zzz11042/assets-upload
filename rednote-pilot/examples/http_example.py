"""纯 HTTP 客户端示例：通过 rednote-pilot 的 API 控制手机。

用法：
    # 先启动服务：python -m rednote_pilot.server --port 8710
    python examples/http_example.py
"""

import os
import sys

import httpx

BASE = os.environ.get("REDNOTE_PILOT_BASE", "http://127.0.0.1:8710")


def post(path: str, payload: dict) -> dict:
    with httpx.Client(base_url=BASE, timeout=60.0) as c:
        r = c.post(path, json=payload)
        r.raise_for_status()
        return r.json()


def main() -> None:
    print(f"连接到 {BASE} ...")
    try:
        with httpx.Client(base_url=BASE, timeout=5.0) as c:
            h = c.get("/health").json()
            print("health:", h)
            devs = c.get("/devices").json()
            print("devices:", devs)
            if not devs.get("devices"):
                print("没有设备，仅演示 /skills 与 /plan（离线回显）")
                skills = c.get("/skills").json()
                print(f"skills: {len(skills['skills'])} 个")
                for s in skills["skills"][:5]:
                    print("  -", s["name"], f"({s['risk']})")
                return
    except httpx.ConnectError:
        print(f"连不上 {BASE}，请先 python -m rednote_pilot.server", file=sys.stderr)
        sys.exit(1)

    serial = devs["devices"][0]["serial"]

    # 1. 自然语言执行
    run = post("/run", {"instruction": "截一张屏，保存 /tmp/demo.png", "serial": serial, "dry_run": True})
    print("\n[1] /run dry_run:", run["ok"], run.get("error", ""))
    for r in run.get("results", []):
        print("   ", r["tool"], r["method"], r["args"], "->", r["output"][:80])

    # 2. 单技能
    sk = post("/skills/screenshot", {"args": {"local": "/tmp/demo.png"}, "serial": serial})
    print("\n[2] /skills/screenshot:", sk.get("result"))

    # 3. 文件写入
    fw = post("/file/write", {"path": "/sdcard/hi.txt", "content": "hello from http_example", "serial": serial})
    print("\n[3] /file/write:", fw)

    # 4. 文件回读
    fr = post("/file/read", {"path": "/sdcard/hi.txt", "serial": serial})
    print("[4] /file/read:", fr.get("content"))


if __name__ == "__main__":
    main()
