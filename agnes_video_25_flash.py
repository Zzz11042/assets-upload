#!/usr/bin/env python3
"""Agnes Video 2.5 Flash — 按官方文档实现

参考文档: https://www.agnes-ai.cn/zh-Hans/docs/agnes-video-25-flash

文档"快速接入"三步:
1. 设置环境变量:
     export AGNES_API_KEY="sk-..."      # 密钥只放服务端，不写进代码/前端/公开仓库
     export AGNES_API_BASE="https://apihub.agnes-ai.com/v1"
   本模块通过 os.environ 读取，未设置时抛出明确错误（不提供硬编码 fallback）。
2. 创建视频任务: POST {base}/videos  （OpenAI 兼容端点）
3. 查询任务结果: GET  {base 同域}/agnesapi?video_id=<VIDEO_ID>&model_name=agnes-video-2.5-flash

Flash 专属限制（校验失败 → 400，不建任务不计费）:
- 模型 ID:     agnes-video-2.5-flash
- size 固定:   "720P"（实测 720P 16:9 输出 1280x704）
- seconds:     字符串 "4"–"12"，n 固定 1
- mode:        text / keyframe / reference
    text:      无媒体字段
    keyframe:  first_frame 与 last_frame 至少一个；不允许 images/audios/videos
    reference: images(<=5)、audios(<=3)、videos 至少一类；videos 传参考视频为 Flash 400
- 查询:        推荐 video_id + model_name=agnes-video-2.5-flash（全模式）
               不带 model_name 的纯 video_id 查询仅 text 模式适用
- 完成判断:    status == "completed" 时取顶层 url；internal_status/internal_progress
               是内部字段，即使 pending/0 也以 status 为准
- Flash 专属错误（按 size、images、audios、videos 顺序返回首个）→ 400
- 队列满:      503 {"code":"video_queue_full"}（校验通过后排队阶段被拒）
- 计费:        与 2.5 相同公式，当前限时免费 ¥0/秒

用法:
    source ~/.config/agnes/env          # 或自行 export
    python3 agnes_video_25_flash.py     # 默认 text 模式 720P 演示
"""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error

# ---- 1. 设置环境变量（文档要求：密钥不写进代码，仅服务端持有）----
def _require_env(name):
    val = os.environ.get(name)
    if not val:
        sys.stderr.write(
            f"[error] 环境变量 {name} 未设置。按文档请先执行：\n"
            f'  export {name}="..."\n'
            f'  （密钥文件示例: source ~/.config/agnes/env）\n')
        raise SystemExit(1)
    return val

MODEL = "agnes-video-2.5-flash"


class FlashValidationError(Exception):
    """本地参数预校验错误（Flash 专属 400 场景，避免浪费请求）"""


def _validate(payload):
    """按文档对请求做本地预校验。"""
    size = payload.get("size")
    if size != "720P":
        raise FlashValidationError(f'size 必须为 "720P"，收到 {size!r}（Flash 专属 400）')
    mode = payload.get("mode", "text")
    secs = str(payload.get("seconds", "4"))
    if secs not in [str(i) for i in range(4, 13)]:
        raise FlashValidationError(f'seconds 必须是 "4"–"12" 字符串，收到 {secs!r}')
    if payload.get("n") not in (None, 1):
        raise FlashValidationError(f'n 固定为 1，收到 {payload.get("n")!r}')
    if mode == "text":
        for k in ("first_frame", "last_frame", "images", "audios", "videos"):
            if payload.get(k):
                raise FlashValidationError(f"mode=text 不允许媒体字段 {k}")
    elif mode == "keyframe":
        if not (payload.get("first_frame") or payload.get("last_frame")):
            raise FlashValidationError("mode=keyframe 需要 first_frame 或 last_frame")
        for k in ("images", "audios", "videos"):
            if payload.get(k):
                raise FlashValidationError(f"mode=keyframe 不允许 {k}")
    elif mode == "reference":
        imgs, auds, vids = payload.get("images"), payload.get("audios"), payload.get("videos")
        if not (imgs or auds or vids):
            raise FlashValidationError("mode=reference 需要 images/audios/videos 至少一类非空")
        if imgs and len(imgs) > 5:
            raise FlashValidationError(f"reference 图片最多 5 张，收到 {len(imgs)}")
        if auds and len(auds) > 3:
            raise FlashValidationError(f"reference 音频最多 3 段，收到 {len(auds)}")
        if vids:
            raise FlashValidationError("Flash 不支持传入参考视频 videos（Flash 专属 400）")
        if payload.get("first_frame") or payload.get("last_frame"):
            raise FlashValidationError("mode=reference 不允许 first_frame/last_frame")
    else:
        raise FlashValidationError(f"未知 mode: {mode!r}")


def _auth_headers():
    key = _require_env("AGNES_API_KEY")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _base():
    return os.environ.get("AGNES_API_BASE", "https://apihub.agnes-ai.com/v1").rstrip("/").removesuffix("/v1")


# ---- 2. 创建视频任务 ----
def create_task(payload, validate=True, verbose=True, queue_retry=0, queue_retry_wait=20):
    """创建视频任务，返回 video_id（保存它用于查询）。

    服务端队列满时返回 503 {"code":"video_queue_full"}；可传 queue_retry 自动重试。
    """
    if validate:
        _validate(payload)
    url = f"{_base()}/v1/videos"
    last_err = None
    for attempt in range(queue_retry + 1):
        req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                     headers=_auth_headers())
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            try:
                body = json.loads(raw)
            except Exception:
                body = {"raw": raw}
            code = body.get("code") if isinstance(body, dict) else None
            if code == "video_queue_full" and attempt < queue_retry:
                if verbose:
                    print(f"[queue] full, retry in {queue_retry_wait}s ({attempt+1}/{queue_retry})", file=sys.stderr)
                time.sleep(queue_retry_wait)
                continue
            last_err = RuntimeError(f"HTTP {e.code} 创建失败: {raw[:300]}")
            break
        vid = body.get("video_id") or body.get("id")
        if not vid:
            last_err = RuntimeError(f"创建失败，无 video_id: {body}")
            break
        if verbose:
            print(f"[task] video_id={vid} mode={payload.get('mode','text')} size=720P", file=sys.stderr)
        return vid
    raise last_err or RuntimeError("创建失败")


# ---- 3. 查询任务结果 ----
def query(video_id, model_name=MODEL, timeout=60):
    """查询任务。推荐 video_id + model_name（全模式适用）。

    文档: GET /agnesapi?video_id=<VIDEO_ID>&model_name=agnes-video-2.5-flash
    """
    params = {"video_id": video_id}
    if model_name:
        params["model_name"] = model_name
    url = f"{_base()}/agnesapi?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {_require_env('AGNES_API_KEY')}"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def wait(video_id, poll_interval=2.0, max_wait=600, verbose=True):
    """轮询直到 completed/failed。文档建议 1–2 秒间隔；以 status 为准（非 internal_*）。"""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        st = query(video_id)
        status = st.get("status")
        if verbose:
            print(f"[poll] {status} progress={st.get('progress')}", file=sys.stderr)
        if status == "completed":
            return st
        if status == "failed":
            raise RuntimeError(f"任务失败: {json.dumps(st.get('error'), ensure_ascii=False)}")
        time.sleep(poll_interval)
    raise TimeoutError(f"等待超时 {max_wait}s")


def generate(prompt, seconds="5", aspect_ratio="16:9", mode="text",
             first_frame=None, last_frame=None, images=None, audios=None,
             seed=None, poll_interval=2.0, max_wait=600, out_path=None,
             download=True, verbose=True, queue_retry=5, queue_retry_wait=30):
    """一站式：创建 → 轮询 → （可选）下载 mp4。"""
    payload = {"model": MODEL, "prompt": prompt, "seconds": str(seconds),
               "mode": mode, "size": "720P"}
    if aspect_ratio:
        payload["aspect_ratio"] = aspect_ratio
    if seed is not None:
        payload["seed"] = seed
    if first_frame:
        payload["first_frame"] = first_frame
    if last_frame:
        payload["last_frame"] = last_frame
    if images:
        payload["images"] = images
    if audios:
        payload["audios"] = audios

    vid = create_task(payload, verbose=verbose, queue_retry=queue_retry, queue_retry_wait=queue_retry_wait)
    st = wait(vid, poll_interval=poll_interval, max_wait=max_wait, verbose=verbose)
    result = {"video_id": vid, "status": st.get("status"), "url": st.get("url"),
              "seconds": st.get("seconds"), "size": st.get("size")}
    if download and st.get("url"):
        path = out_path or "agnes_video.mp4"
        req = urllib.request.Request(st["url"])
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            f.write(r.read())
        result["downloaded_to"] = path
    if verbose:
        print(f"[done] {result}", file=sys.stderr)
    return result


if __name__ == "__main__":
    r = generate(prompt="雨后的未来城市街道，霓虹灯倒映在地面，一辆银色跑车缓慢驶过，电影级运镜，自然环境声",
                 seconds="5", aspect_ratio="16:9", mode="text")
    print(json.dumps({k: (v[:80] + "..." if isinstance(v, str) and len(v) > 80 else v)
                      for k, v in r.items()}, ensure_ascii=False))
