#!/usr/bin/env python3
"""LLM 接入层 — 按官方文档"设置环境变量"约定，密钥只放环境变量。

端点:   POST {AGNES_API_BASE}/chat/completions   (OpenAI 兼容)
模型:   agnes-3.0-flash（默认，可用 AGNES_LLM_MODEL 覆盖）
视觉:   支持 image_url（Data URI / URL）实现美工素材风格解析

依赖:   仅标准库 urllib；无 key 时降级为离线模板（保证离线可跑）
"""
import base64, json, os, sys, time, urllib.request, urllib.parse, urllib.error

DEFAULT_MODEL = "agnes-3.0-flash"
DEFAULT_VISION_MODEL = "agnes-2.5-flash"   # 视觉解析走 2.5-flash（3.0-flash 的 chat 视觉报 403/超时）
TIMEOUT = 180
MAX_RETRIES = 3


def _env(name):
    return os.environ.get(name) or ""


def is_available() -> bool:
    return bool(_env("AGNES_API_KEY")) and bool(_env("AGNES_API_BASE"))


def _base() -> str:
    b = _env("AGNES_API_BASE") or "https://apihub.agnes-ai.com/v1"
    return b.rstrip("/")


def chat(messages, model: str = None, temperature: float = 0.4, max_tokens: int = 4000) -> dict:
    """调用 LLM chat completions。返回:
    {"ok": True, "text": str, "raw": dict} 或 {"ok": False, "error": str, "fallback": True}
    """
    if not is_available():
        return {"ok": False, "error": "AGNES_API_KEY/AGNES_API_BASE 未设置（请先 source ~/.config/agnes/env）", "fallback": True}

    model = model or _env("AGNES_LLM_MODEL") or DEFAULT_MODEL
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens
    req = urllib.request.Request(
        f"{_base()}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {_env('AGNES_API_KEY')}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            text = ""
            choices = data.get("choices") or []
            if choices:
                text = (choices[0].get("message") or {}).get("content") or ""
            return {"ok": True, "text": text, "raw": data}
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8", "replace")[:200]
            except Exception:
                body = ""
            last_err = f"HTTP {e.code}: {body}"
            # 间歇性 403/429/5xx → 短退避重试；402(付费)/404 不重试
            if e.code in (402, 404):
                break
            if attempt < MAX_RETRIES:
                time.sleep(min(10, 2 ** attempt) + 0.5 * attempt)
                continue
            break
        except Exception as e:  # 超时/网络错误
            last_err = f"{type(e).__name__}: {e}"
            if attempt < MAX_RETRIES:
                time.sleep(min(15, 2 ** attempt))
                continue
            break
    return {"ok": False, "error": last_err or "unknown", "fallback": True}


def chat_json(system: str, user: str, **kw) -> dict:
    """要求模型输出 JSON（尽量稳定）；解析失败时把原文放进 text。"""
    messages = [
        {"role": "system", "content": system + "\n只输出 JSON，不要 markdown，不要解释。"},
        {"role": "user", "content": user},
    ]
    r = chat(messages, **kw)
    if not r["ok"]:
        return r
    text = r["text"].strip()
    # 去掉可能的 ```json 围栏
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        obj = json.loads(text)
        return {"ok": True, "json": obj, "raw": r["raw"]}
    except json.JSONDecodeError:
        return {"ok": False, "text": r["text"], "error": "JSON 解析失败", "fallback": True}


def analyze_image_style(data_uri_or_url: str, context: str = "") -> dict:
    """把一张美工素材（Data URI 或 URL）交给 LLM 视觉解析，
    返回结构化风格描述: 画风/配色/光影/轮廓/情绪/参考风格词。
    """
    system = "你是资深游戏美术总监。请分析给定的游戏美工素材，输出 JSON 风格解析。"
    user = json.dumps({
        "task": "image_style_analysis",
        "context": context or "游戏素材",
        "schema": {
            "art_style": "画风（如 像素/Q版卡通/水墨/写实…）",
            "palette": ["主要色值 hex 列表"],
            "palette_name": "一句话配色命名",
            "lighting": "光影特征",
            "outline": "轮廓/线稿特征",
            "mood": "情绪/氛围",
            "texture": "材质/纹理",
            "reference": ["可参考的市面游戏风格 1-3 个"],
            "style_prompt": "一段可直接用于 AI 生图的英文风格提示词",
        },
    }, ensure_ascii=False)
    messages = [
        {"role": "system", "content": system + "\n只输出 JSON，不要 markdown，不要解释。"},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user},
                {"type": "image_url", "image_url": {"url": data_uri_or_url}},
            ],
        },
    ]
    r = chat(messages, temperature=0.3, max_tokens=1500,
             model=os.environ.get("AGNES_VISION_MODEL", DEFAULT_VISION_MODEL))
    if not r["ok"]:
        return r
    text = r["text"].strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return {"ok": True, "json": json.loads(text), "raw": r["raw"]}
    except json.JSONDecodeError:
        return {"ok": False, "text": r["text"], "error": "JSON 解析失败", "fallback": True}


def build_style_prompt(style: dict) -> str:
    """把结构化风格字段拼成一段英文 AI 生图 prompt。"""
    p = style.get("style_prompt")
    if p:
        return p
    parts = [
        f"{style.get('art_style','game asset')} style",
        f"palette: {', '.join(style.get('palette', []))}",
        style.get("lighting", ""),
        style.get("outline", ""),
        style.get("mood", ""),
        style.get("texture", ""),
        "clean game-ready asset, consistent art direction",
    ]
    return ", ".join(x for x in parts if x)


def local_style_fallback() -> dict:
    """离线降级：给素材库写一个确定性的默认风格条目。"""
    return {
        "art_style": "unanalyzed",
        "palette": [],
        "palette_name": "待 LLM 解析",
        "lighting": "",
        "outline": "",
        "mood": "",
        "texture": "",
        "reference": [],
        "style_prompt": "",
        "note": "LLM 不可用，为占位条目；source ~/.config/agnes/env 后重跑 analyzer.report",
    }
