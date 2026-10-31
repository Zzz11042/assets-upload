#!/usr/bin/env python3
"""美工素材提取层 — 把游戏项目/解包目录里的图片素材组织成"素材库"。

职责:
- 发现素材 (png/jpg/webp/ttf, 按目录启发分类: character/ui/background/icon/sound...)
- 计算确定性风格指纹 (PIL 可用时: 主色/亮度/对比度; 否则跳过)
- 生成统一 manifest (assets_library/manifest.json)
- 可选 LLM 视觉解析每个素材的风格 → 写回 manifest (analyzer.report 触发)

只依赖标准库 + 可选 PIL。
"""
import base64, json, os, re, hashlib

try:
    from PIL import Image
    HAS_PIL = True
except Exception:
    HAS_PIL = False

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tga", ".pvr", ".astc"}
FONT_EXTS = {".ttf", ".otf", ".woff", ".woff2"}
AUDIO_EXTS = {".mp3", ".ogg", ".wav", ".m4a"}
TEXTURE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".tga"}

CATEGORY_PATTERNS = [
    ("character", re.compile(r"(character|soldier|enemy|hero|player|zombie|civilian|ped|sprite|boss)", re.I)),
    ("ui", re.compile(r"(ui|hud|icon|badge|button|panel|menu|logo|sign|frame|chip|tooltip)", re.I)),
    ("background", re.compile(r"(background|bg|scene|map|level|terrain|skyline|wall|stage|tile|floor|camp)", re.I)),
    ("effect", re.compile(r"(particle|fx|effect|sfx|boom|burst|flash)", re.I)),
    ("audio", re.compile(r"\.(mp3|ogg|wav|m4a)$", re.I)),
    ("font", re.compile(r"\.(ttf|otf|woff2?)$", re.I)),
    ("texture", re.compile(r"(texture|tex|dither|noise|tileset|sheet)", re.I)),
]


def classify(relpath: str) -> str:
    for cat, pat in CATEGORY_PATTERNS:
        if pat.search(relpath):
            return cat
    return "other"


def is_skippable(relpath: str) -> bool:
    return any(seg in relpath.lower() for seg in ("arm64", "lib/", "arm/", "mono/"))


def _color_fingerprint(data: bytes, w: int, h: int) -> dict:
    """PIL: 16 色主色表 + 亮度/对比度统计。"""
    if not HAS_PIL:
        return {}
    try:
        import io
        img = Image.open(io.BytesIO(data)).convert("RGB").resize((64, 64))
        px = list(img.getdata())
        # 16-bin 直方图近似主色
        hist = {}
        for r, g, b in px:
            key = (r >> 4, g >> 4, b >> 4)
            hist[key] = hist.get(key, 0) + 1
        top = sorted(hist.items(), key=lambda x: -x[1])[:6]
        top = [{"hex": "#{:02x}{:02x}{:02x}".format((k[0] << 4) + 8, (k[1] << 4) + 8, (k[2] << 4) + 8),
                "pct": round(v / len(px) * 100, 1)} for k, v in top]
        lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in px]
        mean = sum(lum) / len(lum)
        var = sum((x - mean) ** 2 for x in lum) / len(lum)
        contrast = "low" if var < 150 else ("medium" if var < 600 else "high")
        return {"top_colors": top, "brightness": round(mean, 1), "contrast": contrast,
                "color_count": len(hist)}
    except Exception:
        return {}


def data_uri(path: str, max_bytes: int = 600_000) -> str:
    """生成 data URI（供 LLM 视觉解析）。过大返回 ""。"""
    try:
        size = os.path.getsize(path)
        if size > max_bytes:
            return ""
        ext = os.path.splitext(path)[1].lower()
        mime = {"png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".webp": "image/webp", ".gif": "image/gif"}.get(ext.lstrip("."), "application/octet-stream")
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        return f"data:{mime};base64,{b64}"
    except Exception:
        return ""


def hash_item(rel: str) -> str:
    """确定性条目 id。"""
    return hashlib.md5(rel.encode()).hexdigest()[:12]


def color_fingerprint(data: bytes) -> dict:
    """对图片 bytes 计算确定性风格指纹（PIL 可用时）。"""
    if not data or not HAS_PIL:
        return {}
    try:
        import io
        img = Image.open(io.BytesIO(data)).convert("RGB").resize((64, 64))
        px = list(img.getdata())
        hist = {}
        for r, g, b in px:
            key = (r >> 4, g >> 4, b >> 4)
            hist[key] = hist.get(key, 0) + 1
        top = sorted(hist.items(), key=lambda x: -x[1])[:6]
        top = [{"hex": "#{:02x}{:02x}{:02x}".format((k[0] << 4) + 8, (k[1] << 4) + 8, (k[2] << 4) + 8),
                "pct": round(v / len(px) * 100, 1)} for k, v in top]
        lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in px]
        mean = sum(lum) / len(lum)
        var = sum((x - mean) ** 2 for x in lum) / len(lum)
        contrast = "low" if var < 150 else ("medium" if var < 600 else "high")
        return {"top_colors": top, "brightness": round(mean, 1), "contrast": contrast,
                "color_count": len(hist)}
    except Exception:
        return {}


def collect_assets(root: str, limit: int = 2000) -> dict:
    """扫描 root 下全部素材，返回 {"items": [...], "stats": {...}}。
    每项: id/path/rel/category/ext/size_bytes/sha1/color_fp
    """
    items = []
    stats = {"total": 0, "by_category": {}, "images": 0}
    for base, _dirs, files in os.walk(root):
        if "node_modules" in base or ".git" in base:
            continue
        for f in files:
            rel = os.path.relpath(os.path.join(base, f), root)
            if is_skippable(rel):
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in IMG_EXTS or ext in FONT_EXTS or ext in AUDIO_EXTS:
                full = os.path.join(base, f)
                try:
                    size = os.path.getsize(full)
                except OSError:
                    continue
                cat = classify(rel)
                item = {
                    "id": hashlib.md5(rel.encode()).hexdigest()[:12],
                    "rel": rel,
                    "category": cat,
                    "ext": ext.lstrip("."),
                    "size_bytes": size,
                    "color_fp": {},
                }
                if ext in TEXTURE_EXTS and size < 1_000_000:
                    try:
                        with open(full, "rb") as fh:
                            data = fh.read()
                        item["sha1"] = hashlib.sha1(data).hexdigest()[:12]
                        item["color_fp"] = _color_fingerprint(data, 0, 0)
                    except Exception:
                        pass
                items.append(item)
                stats["total"] += 1
                stats["by_category"][cat] = stats["by_category"].get(cat, 0) + 1
                if ext in IMG_EXTS:
                    stats["images"] += 1
                if len(items) >= limit:
                    break
        if len(items) >= limit:
            break
    items.sort(key=lambda x: (x["category"], x["rel"]))
    return {"items": items, "stats": stats}


def write_manifest(library_dir: str, manifest: dict) -> str:
    os.makedirs(library_dir, exist_ok=True)
    path = os.path.join(library_dir, "manifest.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return path


def load_manifest(library_dir: str) -> dict:
    p = os.path.join(library_dir, "manifest.json")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"items": [], "stats": {}}
