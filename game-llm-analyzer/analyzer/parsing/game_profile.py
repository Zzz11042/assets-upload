#!/usr/bin/env python3
"""游戏程序解析层 — 把"游戏项目"变成结构化档案。

支持三类输入:
1. 源码项目（Python/JS 单文件 H5 游戏）: 静态扫描，提取玩法循环/数值/实体/系统
2. Unity 项目（apk 解包产物）: 解析 assets 文件头 + 文本资产（json/xml/yaml + 命名启发）
3. 设计文档/Markdown: 解析章节标题与关键数值表

输出: GameProfile(dict)，交给 report 层做总结、llm 层做语言化。
只依赖标准库。
"""
import json, os, re, hashlib

# ---------- 通用 ----------

def _h(s: str, n: int = 12) -> str:
    return hashlib.md5(s.encode("utf-8", "replace")).hexdigest()[:n]


def _read(path, limit=2_000_000):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read(limit)
    except Exception:
        return ""


# ---------- 1. 源码（Python / JS） ----------

RE_LOOPS = [
    (r"(requestAnimationFrame|setInterval)\s*\(", "帧循环/定时驱动"),
    (r"\bgameLoop\b|\bupdate\s*\(", "主循环 update"),
    (r"\bspawn\w*\s*\(", "敌人/单位生成(spawn)"),
    (r"\bwave[s]?\b", "波次系统"),
    (r"\bday\s*[=+]|nextDay|advanceDay", "天数/昼夜循环"),
    (r"\bcombat|battle|attack|damage", "战斗/伤害"),
    (r"\bupgrade[sd]?\b", "升级系统"),
    (r"\bshop|buy|purchase", "商店/购买"),
    (r"\bachievement", "成就系统"),
    (r"\bevent|randomEvent", "随机事件"),
    (r"\bsave|localStorage|load_game", "存档"),
    (r"\boffline|offlineIncome", "离线收益"),
    (r"\bcurrency|coin|money", "货币"),
    (r"\blevel\s*\+|xp|experience", "等级/经验"),
]

RE_ENTITY = re.compile(
    r"\b(class|struct|interface)\s+(\w+)|\bconst\s+(\w+)\s*=\s*(?:new\s+)?(?:class|\{)[\s\S]{0,200}",
)

RE_NUMBER = re.compile(r'["\']?([a-zA-Z_]\w*|"[^"]+")["\']?\s*[:=]\s*(-?\d+(?:\.\d+)?)')

KEYWORDS_PLAY = {"hp", "max_hp", "maxhp", "atk", "damage", "dmg", "crit", "armor",
                 "level", "xp", "exp", "speed", "coins", "money", "gold", "day",
                 "wave", "wave_time", "duration", "price", "cost", "income", "profit",
                 "tax", "salary", "mult", "multiplier"}


def parse_source_files(paths, game_name: str = "") -> dict:
    """扫描源码文本文件列表，提取玩法/数值/实体。"""
    profile = {
        "kind": "source",
        "game_name": game_name,
        "files": [],
        "play_mechanics": [],
        "entities": [],
        "numbers": {},          # key -> [值样本]
        "constants": {},        # 顶部常量
        "ui_tokens": {},        # CSS 变量（美工风格线索）
        "stats": {"total_files": 0, "total_lines": 0},
    }
    for p in paths:
        text = _read(p)
        if not text:
            continue
        profile["files"].append(p)
        profile["stats"]["total_files"] += 1
        profile["stats"]["total_lines"] += text.count("\n") + 1

        for pat, label in RE_LOOPS:
            m = re.search(pat, text)
            if m and label not in [x["label"] for x in profile["play_mechanics"]]:
                profile["play_mechanics"].append(
                    {"label": label, "sample": m.group(0)[:80], "file": p})

        for m in re.finditer(r"const\s+([A-Z_][A-Z0-9_]*)\s*=\s*([-\d.]+)", text):
            profile["constants"][m.group(1)] = m.group(2)

        for m in re.finditer(r'(--[\w-]+)\s*:\s*([^;]+);', text):
            key, val = m.group(1), m.group(2).strip()
            if re.fullmatch(r"(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[\d.]+px?|[\d.]+em?|[\d.]+rem?)", val):
                profile["ui_tokens"][key] = val

        # 数值样本: 只在看起来像"设计数值"的键上采集，避免淹没
        counts = {}
        for m in RE_NUMBER.finditer(text):
            key = m.group(1).strip('"').lower()
            if key in KEYWORDS_PLAY:
                counts.setdefault(key, []).append(float(m.group(2)))
        for k, v in counts.items():
            v = v[:50]
            profile["numbers"][k] = {
                "n": len(v), "min": min(v), "max": max(v),
                "mean": round(sum(v) / len(v), 3), "sample": v[:8],
            }
    # 实体: 从类名收集
    seen = set()
    for p in paths:
        text = _read(p, 400_000)
        for m in re.finditer(r"\bclass\s+(\w+)", text):
            name = m.group(1)
            if name not in seen and not name[0].islower():
                seen.add(name)
                profile["entities"].append({"name": name, "hint": _hint_entity(name)})
    profile["entities"] = profile["entities"][:40]
    return profile


def _hint_entity(name: str) -> str:
    n = name.lower()
    for kw, hint in [
        ("enemy", "敌人单位"), ("soldier", "士兵单位"), ("player", "玩家角色"),
        ("boss", "Boss"), ("zombie", "僵尸"), ("wave", "波次系统"),
        ("building", "建筑"), ("shop", "商店"), ("customer", "顾客"),
        ("event", "事件"), ("upgrade", "升级"), ("buff", "增益"),
        ("camera", "镜头"), ("renderer", "渲染器"), ("state", "状态机"),
    ]:
        if kw in n:
            return hint
    return "游戏实体/系统类"


# ---------- 2. Unity（apk 解包） ----------

UNITY_TEXT_ASSETS = (".json", ".xml", ".txt", ".yaml", ".js", ".txt")


def parse_unity_extract(root: str, game_name: str = "") -> dict:
    """root 应为已解包的 apk 目录（含 assets/ 或 Data/Manifest.json）。"""
    profile = {
        "kind": "unity",
        "game_name": game_name,
        "manifest": None,
        "engine_version": None,
        "plugins": [],
        "text_assets": [],
        "art_dirs": [],
        "numbers": {},
        "stats": {"total_files": 0},
    }
    manifest = _find_manifest(root)
    if manifest:
        text = _read(manifest)
        try:
            data = json.loads(text)
            profile["manifest"] = data
            profile["engine_version"] = data.get("objects", {}).get("version", "")
            types = {}
            for o in data.get("assets", []):
                t = o.get("type", "unknown")
                types[t] = types.get(t, 0) + 1
            top = sorted(types.items(), key=lambda x: -x[1])[:15]
            profile["asset_type_breakdown"] = {k: v for k, v in top}
        except json.JSONDecodeError:
            pass

    # 文件统计
    counts = {"png": 0, "jpg": 0, "mp3": 0, "ogg": 0, "ttf": 0, "otf": 0, "total": 0}
    for base, _dirs, files in os.walk(root):
        if "arm64" in base or "lib/arm" in base:
            continue
        for f in files:
            profile["stats"]["total_files"] += 1
            ext = os.path.splitext(f)[1].lower().lstrip(".")
            if ext in counts:
                counts[ext] += 1
            lower = f.lower()
            if re.search(r"(sprite|character|enemy|soldier|boss|tile|background|icon|ui|banner|bg_)", lower):
                if ext in ("png", "jpg", "jpeg", "webp", "pvr", "astc") and len(profile["art_dirs"]) < 100:
                    profile["art_dirs"].append(os.path.relpath(os.path.join(base, f), root))
    profile["media_counts"] = counts

    # 文本资产里挖数值与命名
    for base, _dirs, files in os.walk(os.path.join(root, "assets", "bin", "Data")):
        for f in files:
            rel = os.path.relpath(os.path.join(base, f), root)
            if len(profile["text_assets"]) < 200 and not f.lower().endswith(UNITY_TEXT_ASSETS):
                continue
            text = _read(os.path.join(base, f), 500_000)
            if not text:
                continue
            profile["text_assets"].append(rel)
            for m in re.finditer(r'([a-zA-Z_]\w{2,30})\s*[:=]\s*(-?\d+(?:\.\d+)?)', text):
                key = m.group(1).lower()
                if key in KEYWORDS_PLAY:
                    profile["numbers"].setdefault(key, []).append(float(m.group(2)))
            m = re.search(r'"UnityEdition"\s*:\s*"([^"]+)"', text)
            if m and not profile["engine_version"]:
                profile["engine_version"] = m.group(1)
    for k, v in profile["numbers"].items():
        v = v[:50]
        profile["numbers"][k] = {"n": len(v), "min": min(v), "max": max(v),
                                 "mean": round(sum(v) / len(v), 3), "sample": v[:8]}
    return profile


def _find_manifest(root):
    for cand in [
        os.path.join(root, "assets", "bin", "Data", "Managed", "MONO", "BleedingEdge"),
        os.path.join(root, "assets", "bin", "Data"),
        os.path.join(root, "assets"),
        root,
    ]:
        if not os.path.isdir(cand):
            continue
        for f in os.listdir(cand):
            if f in ("Manifest.json", "buildIndex.asset", "globalgamemanagers"):
                return os.path.join(cand, f)
    return None


# ---------- 3. Markdown / 设计文档 ----------

def parse_markdown_docs(paths, game_name: str = "") -> dict:
    profile = {
        "kind": "docs",
        "game_name": game_name,
        "sections": [],
        "numbers": {},
        "references": [],
        "stats": {"total_files": 0, "total_lines": 0},
    }
    for p in paths:
        text = _read(p)
        if not text:
            continue
        profile["stats"]["total_files"] += 1
        profile["stats"]["total_lines"] += text.count("\n") + 1
        for m in re.finditer(r"^(#{1,3})\s+(.+)$", text, re.M):
            profile["sections"].append({"level": len(m.group(1)), "title": m.group(2).strip()})
        for m in re.finditer(r"https?://\S+", text):
            if len(profile["references"]) < 40:
                profile["references"].append(m.group(0))
        # 数值表
        for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(?:秒|天|波|%|金币|¥|k|K|x)?", text):
            pass
        for key, val in re.findall(r"([a-zA-Z_]\w{2,25})[::]\s*(\d+(?:\.\d+)?)", text):
            if key.lower() in KEYWORDS_PLAY:
                profile["numbers"].setdefault(key.lower(), []).append(float(val))
    for k, v in profile["numbers"].items():
        v = v[:50]
        profile["numbers"][k] = {"n": len(v), "min": min(v), "max": max(v),
                                 "mean": round(sum(v) / len(v), 3), "sample": v[:8]}
    return profile


# ---------- 汇总 ----------

def build_profile(project_dir: str, game_name: str = "", force_kind: str = "") -> dict:
    """自动判断输入类型并产出 GameProfile。
    project_dir 可以是目录，也可以是单个文件（.md/.py/.js 等）。
    """
    name = game_name or os.path.basename(project_dir.rstrip("/"))

    # 单文件输入：直接按扩展名处理
    if os.path.isfile(project_dir):
        ext = os.path.splitext(project_dir)[1].lower()
        if ext in (".md", ".txt"):
            prof = parse_markdown_docs([project_dir], name)
            prof["project_dir"] = project_dir
            prof["fingerprint"] = _h(json.dumps({"kind": "docs", "file": project_dir}, ensure_ascii=False))
            return prof
        if ext in (".py", ".js", ".ts", ".mjs", ".jsx"):
            prof = parse_source_files([project_dir], name)
            prof["project_dir"] = project_dir
            prof["fingerprint"] = _h(json.dumps({"kind": "source", "file": project_dir}, ensure_ascii=False))
            return prof

    has_manifest = os.path.exists(os.path.join(project_dir, "assets", "bin", "Data")) or \
        os.path.exists(os.path.join(project_dir, "Data"))
    pyjs = []
    md = []
    for base, _dirs, files in os.walk(project_dir):
        depth = base[len(project_dir):].count(os.sep)
        if "node_modules" in base or ".git" in base or depth > 3:
            continue
        for f in files:
            full = os.path.join(base, f)
            lf = f.lower()
            if lf.endswith((".py", ".js", ".ts", ".mjs", ".jsx")) and "test" not in lf:
                pyjs.append(full)
            elif lf.endswith((".md", ".txt")):
                md.append(full)

    if force_kind:
        kind = force_kind
    elif has_manifest and not pyjs:
        kind = "unity"
    elif pyjs:
        kind = "source"
    elif md:
        kind = "docs"
    else:
        kind = "unity"

    if kind == "unity":
        prof = parse_unity_extract(project_dir, name)
    elif kind == "docs":
        prof = parse_markdown_docs(md, name)
    else:
        prof = parse_source_files(pyjs[:40], name)
        if md:
            prof["docs"] = parse_markdown_docs(md[:10], name)
    prof["project_dir"] = project_dir
    prof["fingerprint"] = _h(json.dumps({
        k: prof.get(k) for k in ("game_name", "kind", "files", "manifest", "sections")
    }, ensure_ascii=False, default=str))
    return prof


def summarize_profile(prof: dict) -> dict:
    """把 profile 压成报告层可用的紧凑 dict。"""
    s = {
        "game_name": prof.get("game_name", ""),
        "kind": prof.get("kind"),
        "fingerprint": prof.get("fingerprint"),
        "stats": prof.get("stats", {}),
        "play_mechanics": prof.get("play_mechanics", []),
        "entities": prof.get("entities", [])[:20],
        "numbers": prof.get("numbers", {}),
        "constants": prof.get("constants", {}) if prof.get("kind") == "source" else {},
        "ui_tokens": (prof.get("ui_tokens") or {}) if prof.get("kind") == "source" else {},
    }
    if prof.get("kind") == "unity":
        s["engine_version"] = prof.get("engine_version")
        s["asset_type_breakdown"] = prof.get("asset_type_breakdown")
        s["media_counts"] = prof.get("media_counts")
        s["art_dirs_sample"] = prof.get("art_dirs", [])[:30]
    if prof.get("kind") == "docs":
        s["sections"] = prof.get("sections", [])[:40]
        s["references"] = prof.get("references", [])
    if prof.get("docs"):
        s["docs_sections"] = prof["docs"].get("sections", [])[:30]
    return s
