#!/usr/bin/env python3
"""game-llm-analyzer CLI

用法:
  # 全流程: 解析游戏 → 建素材库 → LLM 风格解析(可选) → 报告 + 竞品参考
  python3 -m analyzer.cli analyze <项目目录> [--game-name NAME] [--style-limit N] [--no-llm]

  # 仅建素材库
  python3 -m analyzer.cli library <素材目录>

  # 仅跑竞品检索
  python3 -m analyzer.cli competitors <项目目录>

输出:
  <项目>/../game-llm-analyzer/reports/<game>_分析报告.md
  <项目>/../game-llm-analyzer/reports/competitors.md
  <项目>/../game-llm-analyzer/assets_library/manifest.json
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzer.parsing import game_profile, art_assets, pvr_extract
from analyzer import llm as llm_mod
from analyzer import report as report_mod
from analyzer import competitors as comp_mod

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_DIR = os.path.join(ROOT, "reports")
LIB_DIR = os.path.join(ROOT, "assets_library")


def _cmd_analyze(args):
    project = os.path.abspath(args.project)
    print(f"== 解析游戏: {project}")
    prof = game_profile.build_profile(project, args.game_name, force_kind=args.kind or "")
    print(f"   类型: {prof['kind']} | 文件: {prof.get('stats', {}).get('total_files', '?')}")

    # Unity PVR 解码
    pvr_dir = None
    if prof["kind"] == "unity":
        pvr_dir = os.path.join(ROOT, "pvr_decoded")
        print("== PVR 纹理解码（Unity 解包）")
        try:
            n = pvr_extract.extract(project, pvr_dir, max_blocks=300)
            print(f"   解码 PVRTC 纹理 {n} 张 → {pvr_dir}")
        except Exception as e:
            print(f"   [pvr] 跳过: {e}")

    print("== 收集美工素材 → 素材库")
    manifest = art_assets.collect_assets(project, limit=args.asset_limit)
    if pvr_dir and os.path.isdir(pvr_dir):
        for f in os.listdir(pvr_dir):
            if f.endswith(".png"):
                p = os.path.join(pvr_dir, f)
                with open(p, "rb") as fh:
                    data = fh.read()
                manifest["items"].append({
                    "id": art_assets.hash_item("pvr/" + f),
                    "rel": f"pvr/{f}", "category": "texture", "ext": "png",
                    "size_bytes": len(data), "sha1": None,
                    "color_fp": art_assets.color_fingerprint(data),
                    "note": "PVRTC 解码产物",
                })
    manifest["game"] = prof.get("game_name")
    manifest["fingerprint"] = prof.get("fingerprint")
    manifest["llm_available"] = llm_mod.is_available()
    manifest["stats"]["total"] = len(manifest["items"])
    print(f"   素材: {manifest['stats']['total']} (分类 {manifest['stats']['by_category']})")
    mpath = art_assets.write_manifest(LIB_DIR, manifest)
    print(f"   素材库: {mpath}")

    styled = []
    if not args.no_llm:
        if manifest["llm_available"]:
            print(f"== LLM 风格解析 (前 {args.style_limit} 张)")
            styled = report_mod.llm_analyze_styles(manifest, project, limit=args.style_limit)
            manifest = report_mod.update_manifest_with_styles(manifest, styled)
            art_assets.write_manifest(LIB_DIR, manifest)
        else:
            print("== [跳过 LLM] 未设置 AGNES_API_KEY/AGNES_API_BASE (source ~/.config/agnes/env 后可启用)")

    print("== 竞品/类似游戏检索")
    comp = comp_mod.find_similar({k: prof.get(k) for k in ("game_name", "play_mechanics", "sections")})
    cpath = comp_mod.write_report(REPORT_DIR, prof.get("game_name"), comp)
    print(f"   竞品: {cpath}")

    rpath = report_mod.generate_markdown_report(
        game_profile.summarize_profile(prof), manifest, styled, comp, REPORT_DIR)
    print(f"   报告: {rpath}")
    print("== 完成")
    return rpath


def _cmd_library(args):
    src = os.path.abspath(args.project)
    manifest = art_assets.collect_assets(src, limit=args.asset_limit)
    manifest["game"] = args.game_name or os.path.basename(src)
    mpath = art_assets.write_manifest(LIB_DIR, manifest)
    print(f"素材库: {mpath} ({manifest['stats']['total']} 项)")


def _cmd_competitors(args):
    project = os.path.abspath(args.project)
    prof = game_profile.build_profile(project, args.game_name or "")
    comp = comp_mod.find_similar({k: prof.get(k) for k in ("game_name", "play_mechanics", "sections")})
    cpath = comp_mod.write_report(REPORT_DIR, prof.get("game_name"), comp)
    print(cpath)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="game-llm-analyzer")
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("analyze", help="全流程: 解析 + 素材库 + LLM 风格 + 报告 + 竞品")
    a.add_argument("project", help="游戏项目目录（源码 / Unity 解包 / 设计文档）")
    a.add_argument("--game-name", default="")
    a.add_argument("--kind", default="", choices=["", "source", "unity", "docs"])
    a.add_argument("--style-limit", type=int, default=8)
    a.add_argument("--asset-limit", type=int, default=500)
    a.add_argument("--no-llm", action="store_true")
    a.set_defaults(fn=_cmd_analyze)

    b = sub.add_parser("library", help="仅建素材库")
    b.add_argument("project")
    b.add_argument("--game-name", default="")
    b.add_argument("--asset-limit", type=int, default=500)
    b.set_defaults(fn=_cmd_library)

    c = sub.add_parser("competitors", help="仅跑竞品检索")
    c.add_argument("project")
    c.add_argument("--game-name", default="")
    c.set_defaults(fn=_cmd_competitors)

    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
