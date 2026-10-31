#!/usr/bin/env python3
"""把本地已有游戏项目的素材目录批量登记进素材库，
并给每个素材写 LLM 风格字段（可离线降级）。
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))          # .../game-llm-analyzer/analyzer
sys.path.insert(0, os.path.dirname(HERE))                  # .../game-llm-analyzer
ROOT = os.path.dirname(HERE)                                # .../game-llm-analyzer
LIB_DIR = os.path.join(ROOT, "assets_library")
SRC_ROOT = os.path.dirname(ROOT)                            # .../default-workspace

from analyzer.parsing import art_assets
from analyzer import llm as llm_mod


def register_local_sources(names_to_dirs, style_limit_per_source=4):
    """收集 + LLM 风格解析 + merge 进素材库。"""
    manifest = art_assets.load_manifest(LIB_DIR)
    manifest.setdefault("items", [])
    manifest.setdefault("stats", {"total": 0, "by_category": {}, "images": 0})

    # 收集目标（按 id 去重）
    new_items = {}
    for game, d in names_to_dirs.items():
        if not os.path.isdir(d):
            print(f"[skip] 不存在: {d}")
            continue
        collected = art_assets.collect_assets(d, limit=200)
        for it in collected["items"]:
            it["game"] = game
            it["rel"] = f"{game}/{it['rel']}"
            it["id"] = art_assets.hash_item(it["rel"])
            new_items[it["id"]] = it
        print(f"[+] {game}: {len(collected['items'])} 项")

    # LLM 风格解析（写 new_items 副本）
    targets = {}
    for it in new_items.values():
        if it.get("sha1") and it.get("color_fp"):
            targets.setdefault(it.get("game", "unknown"), []).append(it)
    all_targets = []
    for g, its in targets.items():
        all_targets.extend(its[:style_limit_per_source])

    if llm_mod.is_available():
        print(f"== LLM 风格解析: {len(all_targets)} 张 (模型 {os.environ.get('AGNES_LLM_MODEL', llm_mod.DEFAULT_MODEL)})")
        for i, it in enumerate(all_targets):
            # 重建绝对路径: rel 里第一段是游戏名，映射回 names_to_dirs 的目录
            game_dir = names_to_dirs.get(it.get("game", ""))
            sub = it["rel"].split("/", 1)[1] if "/" in it["rel"] else it["rel"]
            full = os.path.join(game_dir, sub) if game_dir else os.path.join(SRC_ROOT, it["rel"])
            uri = art_assets.data_uri(full)
            if not uri:
                continue
            r = llm_mod.analyze_image_style(uri, context=f"{it.get('game')}/{it['category']} 素材: {it['rel']}")
            style = r.get("json") if r.get("ok") else llm_mod.local_style_fallback()
            style["palette"] = style.get("palette") or [c["hex"] for c in (it.get("color_fp") or {}).get("top_colors", [])]
            it["style"] = style
            it["style_source"] = "llm" if "note" not in style else "fallback"
            print(f"  [{i+1}/{len(all_targets)}] {it['rel']} -> {style.get('art_style', '?')}", flush=True)
    else:
        print("== [LLM 不可用] 写占位风格条目")
        for it in all_targets:
            it["style"] = llm_mod.local_style_fallback()
            it["style_source"] = "fallback"

    # merge new_items into manifest
    existing_ids = {it["id"] for it in manifest["items"]}
    added = 0
    for it in new_items.values():
        if it["id"] not in existing_ids:
            manifest["items"].append(it)
            added += 1
    manifest["stats"]["total"] = len(manifest["items"])
    for it in new_items.values():
        manifest["stats"]["by_category"][it["category"]] = manifest["stats"]["by_category"].get(it["category"], 0) + 1
        if it["ext"] in ("png", "jpg", "jpeg", "webp"):
            manifest["stats"]["images"] += 1
    art_assets.write_manifest(LIB_DIR, manifest)
    print(f"素材库: {LIB_DIR}/manifest.json (总 {manifest['stats']['total']} 项, 新增 {added})")


if __name__ == "__main__":
    base = SRC_ROOT
    sources = {
        "商场大亨(mall-tycoon)": os.path.join(base, "mall-tycoon/web/art-gen"),
        "末日小队(pixel-assets)": os.path.join(base, "pixel-assets"),
        "Tiny Troopers 2(extracted)": os.path.join(base, "extracted_art/usable_art"),
    }
    register_local_sources(sources, style_limit_per_source=3)
