#!/usr/bin/env python3
"""报告层 — 汇总 GameProfile + 素材库 + LLM 分析，生成两份产物:
1. 分析报告 (Markdown): 玩法/美工/数值/竞品 全方面总结
2. LLM 风格语言化: 把素材风格字段拼成可复用的 AI 生图 prompt

用法: 由 CLI 编排; 本模块只做"内容生成"。
"""
import json, os, datetime, re

from .parsing import game_profile, art_assets
from . import llm
from . import competitors


def _fmt_num(v):
    if isinstance(v, float):
        return f"{v:g}"
    return str(v)


def generate_markdown_report(profile_sum: dict, manifest: dict, style_reports: list,
                            competitors_result: dict, out_dir: str) -> str:
    """profile_sum: summarize_profile() 结果; style_reports: 已解析风格的素材条目列表。"""
    os.makedirs(out_dir, exist_ok=True)
    name = profile_sum.get("game_name") or "game"
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    path = os.path.join(out_dir, f"{_slug(name)}_分析报告.md")

    lines = [
        f"# 《{name}》游戏解析报告",
        "",
        f"生成: {now} | 类型: {profile_sum.get('kind')} | 指纹: {profile_sum.get('fingerprint')}",
        "",
        "## 1. 玩法解析",
        "",
    ]
    mech = profile_sum.get("play_mechanics") or []
    secs = profile_sum.get("sections") or []
    if mech:
        lines.append("| 机制 | 代码证据 | 位置 |")
        lines.append("| --- | --- | --- |")
        for m in mech[:20]:
            lines.append(f"| {m['label']} | `{m.get('sample','')[:48]}` | {os.path.basename(m.get('file',''))} |")
        lines.append("")
    elif secs:
        lines.append("### 设计文档章节结构")
        for s in secs[:20]:
            lines.append("  " * (s.get("level", 1) - 1) + f"- {s['title']}")
        lines.append("")
    else:
        lines.append("（未从源码中提取到明确机制标签；见数值与实体部分）")
        lines.append("")

    ents = profile_sum.get("entities") or []
    if ents:
        lines.append("### 核心实体")
        for e in ents[:15]:
            lines.append(f"- **{e['name']}** — {e.get('hint','')}")
        lines.append("")

    lines += ["## 2. 数值设计", "",
              "### 关键数值区间（自动提取）", "",
              "| 键 | 样本数 | min | max | mean | 样本 |",
              "| --- | --- | --- | --- | --- | --- |"]
    nums = profile_sum.get("numbers") or {}
    if nums:
        for k, v in sorted(nums.items())[:25]:
            lines.append(f"| {k} | {v['n']} | {_fmt_num(v['min'])} | {_fmt_num(v['max'])} | {_fmt_num(v['mean'])} | {','.join(_fmt_num(x) for x in v['sample'][:5])} |")
        lines.append("")
    else:
        lines.append("（无）")
        lines.append("")

    consts = profile_sum.get("constants") or {}
    if consts:
        lines.append("### 顶部常量（配置层数值）")
        for k, v in sorted(consts.items())[:30]:
            lines.append(f"- `{k}` = {v}")
        lines.append("")

    lines += ["## 3. 美工风格解析（LLM 语言化）", ""]
    if style_reports:
        lines.append("| 素材 | 画风 | 配色 | 光影 | 情绪 | 参考风格 |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for s in style_reports[:20]:
            st = s.get("style") or {}
            lines.append(
                f"| {os.path.basename(s.get('rel', s.get('path', '')))} | {st.get('art_style','')} | "
                f"{st.get('palette_name','') or ','.join((st.get('palette') or [])[:3])} | "
                f"{(st.get('lighting') or '')[:20]} | {(st.get('mood') or '')[:20]} | "
                f"{', '.join((st.get('reference') or [])[:2])} |")
        lines.append("")
        lines.append("### 可复用生图提示词（AI prompt）")
        for s in style_reports[:8]:
            st = s.get("style") or {}
            lines.append(f"- **{os.path.basename(s.get('rel', s.get('path','')))}** `{s.get('style_source','')}`: > {llm.build_style_prompt(st)}")
        lines.append("")
    else:
        lines.append("（LLM 不可用或未执行风格解析；素材库 manifest.json 含确定性风格指纹: 主色/亮度/对比度）")
        lines.append("")

    ui = profile_sum.get("ui_tokens") or {}
    if ui:
        lines.append("### UI 主题色 token（代码内 CSS 变量）")
        for k, v in sorted(ui.items())[:20]:
            lines.append(f"- `{k}`: `{v}`")
        lines.append("")

    lines += ["## 4. 市面类似游戏参考", ""]
    if competitors_result.get("games"):
        for group in competitors_result["games"]:
            lines.append(f"### {group['tag']}")
            for g in group["games"]:
                lines.append(f"- **{g['name']}**: {g.get('mechanics','')} — {g.get('notes','')}")
            lines.append("")
    if competitors_result.get("kb_resources"):
        lines.append("### 本地知识库已有调研")
        for k in competitors_result["kb_resources"]:
            lines.append(f"- {k['title']}")
        lines.append("")

    stats = manifest.get("stats", {})
    lines += ["## 5. 素材库统计", "",
              f"- 素材总数: {stats.get('total', 0)} (图片 {stats.get('images', 0)})",
              f"- 分类分布: " + json.dumps(stats.get("by_category", {}), ensure_ascii=False),
              "",
              "完整清单见 `../assets_library/manifest.json`（含 LLM 风格字段与确定性颜色指纹）。",
              ""]

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return path


def llm_analyze_styles(manifest: dict, project_dir: str, limit: int = 12) -> list:
    """挑选 manifest 中有 sha1/颜色指纹的素材（图片类），逐张调 LLM 视觉解析风格。
    返回带 style 字段的条目列表；LLM 不可用时写占位条目（离线可跑）。
    """
    candidates = [it for it in manifest.get("items", []) if it.get("sha1")][:limit]
    results = []
    for it in candidates:
        path = os.path.join(project_dir, it["rel"])
        style = None
        if os.path.exists(path) and llm.is_available():
            uri = art_assets.data_uri(path)
            if uri:
                r = llm.analyze_image_style(uri, context=f"{it['category']} 素材: {it['rel']}")
                if r.get("ok"):
                    style = r["json"]
                else:
                    print(f"  [llm] {it['rel']}: {r.get('error')} → 降级占位", flush=True)
        if style is None:
            style = llm.local_style_fallback()
        style["palette"] = style.get("palette") or \
            [c["hex"] for c in (it.get("color_fp") or {}).get("top_colors", [])]
        entry = dict(it)
        entry["style"] = style
        entry["style_source"] = "llm" if (style and "note" not in style) else "fallback"
        results.append(entry)
    return results


def update_manifest_with_styles(manifest: dict, styled: list) -> dict:
    by_id = {it["id"]: it for it in manifest.get("items", [])}
    for s in styled:
        if s["id"] in by_id:
            by_id[s["id"]]["style"] = s["style"]
            by_id[s["id"]]["style_source"] = s.get("style_source", "unknown")
    return manifest


def _slug(name: str) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff]+", "-", name.strip())
    return s or "game"
