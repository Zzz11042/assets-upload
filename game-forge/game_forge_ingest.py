#!/usr/bin/env python3
"""game-forge ingest — 游戏文件收件箱 + 自动分类入库

用法（用户把游戏文件/项目放到 inbox/ 后调用）:
  python3 game_forge.py ingest                 # 处理 inbox/ 全部内容
  python3 game_forge.py ingest <文件或项目目录>  # 直接摄入指定路径
  python3 game_forge.py catalog                # 打印已入库游戏清单

流程:
  inbox/<任意名字>/ 或 inbox/xxx.zip → 自动分类 → 存入 vault/<分类>/<游戏名>/
    → 提取知识（games/plans/styles）→ 登记素材 → 生成解析报告
    → 更新 vault/INDEX.json 与 INDEX.md
分类规则（启发式，按目录特征）:
  - source-game : 含 .html 单文件游戏 或 含 js+html 目录（自研源码 H5 游戏）
  - unity-extract : 含 assets/bin/Data 或 sharedassets*.assets（apk 解包）
  - design-docs : 只有 .md/.txt（策划案/调研/方案）
  - art-assets : 只有图片/字体/音频（素材包）
  - apk-raw : 含 .apk 原始包
  - reference : 其他（参考截图/视频等）
"""
import json, os, re, shutil, zipfile, datetime, hashlib, sys

HERE = os.path.dirname(os.path.abspath(__file__))
INBOX = os.path.join(HERE, "inbox")
VAULT = os.path.join(HERE, "vault")
LIB = os.path.join(HERE, "knowledge")
REPORTS = os.path.join(HERE, "reports")
INDEX_JSON = os.path.join(VAULT, "INDEX.json")
INDEX_MD = os.path.join(VAULT, "INDEX.md")

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tga"}
ART_EXTS = IMG_EXTS | {".ttf", ".otf", ".woff2", ".mp3", ".ogg", ".wav", ".m4a"}
CODE_EXTS = {".js", ".ts", ".py", ".mjs", ".jsx", ".html"}
DOC_EXTS = {".md", ".txt"}


def _sha1(p):
    try:
        h = hashlib.sha1()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()[:12]
    except OSError:
        return ""


def classify_entry(base: str) -> str:
    """对 inbox 里的一坨（目录或文件）判定分类。"""
    if not os.path.isdir(base):
        ext = os.path.splitext(base)[1].lower()
        if ext == ".zip":
            return "design-docs" if _zip_has_only_docs(base) else "source-game"
        if ext == ".apk":
            return "apk-raw"
        if ext in IMG_EXTS or ext in (".ttf", ".otf"):
            return "art-assets"
        if ext in (".mp4", ".mov", ".webm"):
            return "reference"
        if ext in CODE_EXTS:
            return "source-game"
        if ext in DOC_EXTS:
            return "design-docs"
        return "reference"
    if os.path.isdir(os.path.join(base, "assets", "bin", "Data")) or \
            any(f.startswith("sharedassets") and f.endswith(".assets") for f in os.listdir(base)):
        return "unity-extract"
    pyjs = docs = arts = 0
    for p, _d, fs in os.walk(base):
        if "node_modules" in p or ".git" in p:
            continue
        for f in fs:
            e = os.path.splitext(f)[1].lower()
            if e in CODE_EXTS:
                pyjs += 1
            elif e in ART_EXTS:
                arts += 1
            elif e in DOC_EXTS:
                docs += 1
    if arts >= 5 and pyjs <= 2:
        return "art-assets"
    if pyjs >= 3:
        return "source-game"
    if arts >= 5:
        return "art-assets"
    if docs >= 1:
        return "design-docs"
    if arts >= 1:
        return "art-assets"
    return "reference"


def _zip_has_only_docs(zp):
    try:
        with zipfile.ZipFile(zp) as z:
            names = z.namelist()
            non_doc = [n for n in names
                       if os.path.splitext(n)[1].lower() not in DOC_EXTS and not n.endswith("/")]
            return len(non_doc) == 0
    except Exception:
        return False


def _name_of(entry) -> str:
    if os.path.isdir(entry):
        return os.path.basename(entry.rstrip("/"))
    b = os.path.basename(entry)
    return re.sub(r"\.(zip|apk)$", "", b)


def _extract_archive(src, dest):
    if src.endswith(".zip"):
        with zipfile.ZipFile(src) as z:
            z.extractall(dest)
        return dest
    if src.endswith(".apk"):
        # apk 即 zip: 解出 assets/ 部分
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                if n.startswith(("assets/", "lib/")):
                    out = os.path.join(dest, os.path.dirname(n))
                    os.makedirs(out, exist_ok=True)
                    if not n.endswith("/"):
                        with z.open(n) as s, open(os.path.join(dest, n), "wb") as o:
                            shutil.copyfileobj(s, o)
        return dest
    return dest


def _count_files(d):
    n = 0
    for _p, _ds, fs in os.walk(d):
        if "node_modules" in _p or ".git" in _p:
            continue
        n += len(fs)
    return n


def _knowledge_hint(path: str, category: str):
    """从目录里找 README/策划案，给入库条目写"可借鉴点"提示。"""
    hint = ""
    for cand in ("README.md", "策划案.md", "设计.md", "方案.md", "PLAN.md"):
        p = os.path.join(path, cand)
        if os.path.exists(p):
            with open(p, encoding="utf-8", errors="replace") as f:
                text = f.read(3000)
            lines = [l.lstrip("# ").strip() for l in text.splitlines()
                     if l.startswith("# ")][:3]
            hint = " | ".join(lines) or os.path.basename(p)
            break
    if not hint and category == "source-game":
        for f in ("game.js", "index.html", "core.js"):
            p = os.path.join(path, f)
            if os.path.exists(p):
                hint = f"自研源码（入口 {f}），建议用 game-llm-analyzer 跑 analyze 提取玩法/数值"
                break
    return hint


def ingest_one(entry: str) -> dict:
    entry = os.path.abspath(entry)
    if not os.path.exists(entry):
        return {"entry": entry, "status": "missing"}
    if entry.endswith((".zip", ".apk")):
        cat = classify_entry(entry)
        game_name = _name_of(entry)
        stage = os.path.join("/tmp", f"gf_inbox_{game_name}")
        if os.path.exists(stage):
            shutil.rmtree(stage)
        os.makedirs(stage)
        _extract_archive(entry, stage)
        target_root = stage
        note = f"从 {os.path.basename(entry)} 解压"
    else:
        cat = classify_entry(entry)
        game_name = _name_of(entry)
        note = ""
        if os.path.isdir(entry):
            target_root = entry
        else:
            # 单文件（文档/图片/代码）: 复制进 vault/<cat>/<game>/
            target_root = None
            game_name = re.sub(r"\.[a-z0-9]+$", "", game_name, flags=re.I)

    dest = os.path.join(VAULT, cat, game_name)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if entry.endswith((".zip", ".apk")):
        shutil.copytree(target_root, dest)
    elif target_root is not None:
        shutil.copytree(target_root, dest,
                        ignore=shutil.ignore_patterns("node_modules", ".git"))
    else:
        os.makedirs(dest, exist_ok=True)
        shutil.copy2(entry, os.path.join(dest, os.path.basename(entry)))

    n_files = _count_files(dest)
    hint = _knowledge_hint(dest, cat)
    record = {
        "game": game_name,
        "category": cat,
        "path": os.path.relpath(dest, VAULT),
        "files": n_files,
        "sha1": _sha1(os.path.join(dest, "..")) if os.path.isdir(dest) else "",
        "hint": hint,
        "ingested_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "note": note,
        "kb": {"games": [], "plans": [], "styles": []},
    }

    # 分类知识提取（交给 game_forge 的检索；这里写最小 hint 到 games.json 的 reference 条目）
    if cat in ("source-game", "unity-extract"):
        record["kb"]["games"].append(
            {"id": f"vault-{game_name}", "name": game_name, "genre": "vault",
             "tags": cat, "borrow": hint, "notes": "vault 入库，建议先跑 analyzer 报告"})
    _register_into_knowledge(record)
    _write_report_stub(record)
    # 源码/Unity: 调 game-llm-analyzer 生成全方面报告（玩法/数值/美工风格/竞品）
    if cat in ("source-game", "unity-extract"):
        _run_analyzer(record, cat, dest)
    return record


def _register_into_knowledge(record):
    """把 vault 条目追加进 knowledge/games.json（幂等: 按 id 去重）。"""
    p = os.path.join(LIB, "games.json")
    games = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else []
    ids = {g.get("id") for g in games}
    added = []
    for g in record.get("kb", {}).get("games", []):
        if g["id"] not in ids:
            g.setdefault("theme", "")
            g.setdefault("mechanics", "")
            g.setdefault("mood", "")
            g.setdefault("art_style", "")
            games.append(g)
            added.append(g["id"])
    if added:
        json.dump(games, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    record["kb"]["games_added"] = added
    return added


def _run_analyzer(record, cat, dest):
    """调 game-llm-analyzer CLI 生成全方面解析报告，存到 reports/。失败不阻断入库。"""
    import subprocess
    analyzer_cli = "/home/zzz/Documents/deepseek-harness/default-workspace/game-llm-analyzer/analyzer/cli.py"
    if not os.path.exists(analyzer_cli):
        record["analyzer"] = "missing cli"
        return
    env = os.environ.copy()
    env_key = env.get("AGNES_API_KEY", "")
    # 离线跑（避免 LLM 403/限流影响入库），风格指纹仍会生成
    env["AGNES_API_KEY"] = ""
    cmd = ["python3", analyzer_cli, "analyze", dest,
           "--game-name", record["game"], "--no-llm",
           "--kind", "unity" if cat == "unity-extract" else "source",
           "--style-limit", "0"]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=300, env=env,
                           cwd=os.path.dirname(analyzer_cli))
        out_rel = ""
        m = re.search(r"报告:\s*(\S+)", p.stdout)
        if m:
            out_rel = m.group(1)
            if os.path.exists(out_rel):
                target = os.path.join(REPORTS, f"{record['game']}_分析报告.md")
                shutil.copy2(out_rel, target)
                record["analyzer_report"] = target
        record["analyzer"] = "ok" if p.returncode == 0 else f"rc={p.returncode}"
    except Exception as e:
        record["analyzer"] = f"error: {e}"


def _write_report_stub(record):
    """在 vault 下写一份入库说明（真正全量报告建议接 game-llm-analyzer）。"""
    os.makedirs(REPORTS, exist_ok=True)
    p = os.path.join(REPORTS, f"{record['game']}_ingest.md")
    with open(p, "w", encoding="utf-8") as f:
        f.write(f"# {record['game']} 入库报告\n\n"
                f"- 分类: {record['category']}\n"
                f"- 存档: vault/{record['path']} ({record['files']} 文件)\n"
                f"- 入库时间: {record['ingested_at']}\n"
                f"- {record.get('note','')}\n\n"
                f"## 可借鉴点（自动提取）\n{record.get('hint') or '（待补）'}\n\n"
                f"## 建议下一步\n"
                f"- 源码/Unity: 用 `python3 -m analyzer.cli analyze vault/{record['path']}` 生成玩法/数值/美工全方面报告\n"
                f"- 素材: 用 `analyzer/register_local.py` 登记进素材库 manifest\n")
    record["report"] = p


def ingest_inbox() -> list:
    os.makedirs(INBOX, exist_ok=True)
    entries = [os.path.join(INBOX, e) for e in os.listdir(INBOX)]
    results = []
    for e in entries:
        if os.path.basename(e) in (".keep",):
            continue
        r = ingest_one(e)
        results.append(r)
        # 处理完从 inbox 移除（已存 vault）
        if r.get("status") != "missing" and not e.endswith((".zip", ".apk")):
            shutil.rmtree(e, ignore_errors=True)
        elif r.get("status") != "missing":
            os.remove(e)
    _write_index()
    return results


def _write_index():
    os.makedirs(VAULT, exist_ok=True)
    records = []
    for cat in sorted(os.listdir(VAULT)) if os.path.isdir(VAULT) else []:
        cat_dir = os.path.join(VAULT, cat)
        if not os.path.isdir(cat_dir):
            continue
        for game in sorted(os.listdir(cat_dir)):
            records.append({
                "game": game, "category": cat,
                "path": os.path.join(cat, game),
                "files": _count_files(os.path.join(cat_dir, game)),
            })
    json.dump(records, open(INDEX_JSON, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    lines = ["# 游戏文件库 (vault) INDEX", "",
             f"共 {len(records)} 个游戏", "",
             "| 游戏 | 分类 | 文件数 | 路径 |", "| --- | --- | --- | --- |"]
    for r in records:
        lines.append(f"| {r['game']} | {r['category']} | {r['files']} | vault/{r['path']} |")
    open(INDEX_MD, "w", encoding="utf-8").write("\n".join(lines) + "\n")


def catalog():
    if os.path.exists(INDEX_JSON):
        records = json.load(open(INDEX_JSON, encoding="utf-8"))
    else:
        records = []
        for cat in sorted(os.listdir(VAULT)) if os.path.isdir(VAULT) else []:
            for game in sorted(os.listdir(os.path.join(VAULT, cat))):
                records.append({"game": game, "category": cat,
                                "path": os.path.join(cat, game)})
    print(f"vault/ 共 {len(records)} 个游戏:")
    for r in records:
        print(f"  [{r['category']}] {r['game']}  →  vault/{r['path']}")
    return records


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("", "help", "-h"):
        print(__doc__)
        return
    cmd = args[0]
    if cmd == "ingest":
        if len(args) >= 2:
            target = args[1]
            r = ingest_one(target)
            _write_index()
            print(json.dumps(r, ensure_ascii=False, indent=2))
        else:
            results = ingest_inbox()
            print(f"ingest 完成: {len(results)} 项")
            for r in results:
                print(f"  [{r.get('category','?')}] {r.get('game','?')} "
                      f"→ vault/{r.get('path','?')} ({r.get('files',0)} 文件)")
    elif cmd == "catalog":
        catalog()
    elif cmd == "classify":
        path = args[1] if len(args) > 1 else ""
        print(classify_entry(path) if path else "用法: classify <路径>")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
