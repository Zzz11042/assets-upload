#!/usr/bin/env python3
"""novel_forge — 引导式小说生成 CLI（复用 forge_common + novel_memory）

和 drama_forge(短剧)/game_forge_flow(游戏) 同一套机制：
  一句话创意 → 需求卡片 → 缺口引导完善 → 设计要素 → 分层生成

小说生成按 novel-forge 的分层思想 + 长篇小说工程化记忆系统:
  卡片(书名/题材/基调/更新节奏/平台/目标字数/主角设定)
  → 世界观/力量体系/主线/卷规划
  → 卷一细纲(章节细纲: 每章钩子/冲突/转折)
  → 逐章正文(在线用 LLM, 离线给细纲级骨架)
  → L0-L5 分层摘要 + 正典账本 + 三级伏笔 + 节奏三档 + 一致性检查

记忆系统（复刻 long-novel-writer + ai-novelist, 见 novel_memory.py）:
  L0 正文 → L1 单章摘要 → L2 篇章 → L3 弧 → L4 卷 → L5 全书
  canon: facts/rules/timeline/promises/progression (只追加, 防回退)
  伏笔: 战略/战役/战术 三级 + 超期预警
  一致性: 确定性规则(伏笔超期/能力回退) + LLM 模糊判断

子命令:
  python3 novel_forge.py new "一句话创意" [--json]
  python3 novel_forge.py guide <名> [--json]      # 缺口检查+逐项提问
  python3 novel_forge.py outline <名>              # 生成卷规划+卷一细纲
  python3 novel_forge.py chapter <名> [--chapter 1] [--online]  # 写正文(L0+L1落盘)
  python3 novel_forge.py memory <名> [--chapter N]  # 一致性检查(伏笔超期/能力回退)
  python3 novel_forge.py foreshadow <名> "描述" [--level campaign]  # 埋三级伏笔
  python3 novel_forge.py pay <名> --id FS-001 --chapter 12  # 回收伏笔
  python3 novel_forge.py canon <名> "事实" [--kind facts]  # 追加正典账本
  python3 novel_forge.py run <名> [--from-ch 1] [--to-ch 30] [--online]  # 批量写作流水线
  python3 novel_forge.py progress <名>               # 长篇进度(字数/章数/里程碑)
  python3 novel_forge.py list / show <名>
"""
import json, os, re, sys, argparse

import forge_common as fc
import novel_memory as nm
import novel_runtime as nrt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROJECTS = os.path.join(HERE, "novel_projects")

# ---------- 领域 spec: 小说 ----------
NOVEL_FIELDS = [
    ("title", "书名", "10字内、有钩子、含题材信号", True),
    ("subject", "题材", "都市/玄幻/悬疑/科幻/历史/游戏/仙侠/现实…", True),
    ("tone", "基调", "爽/燃/虐/治愈/搞笑/黑暗/悬疑反转…", True),
    ("platform", "发布平台", "番茄(免费阅读)/起点(付费)/晋江(女频)/B站(短篇)", True),
    ("rhythm", "更新节奏", "日更4000字/日更1万字/存稿3章再更…", False),
    ("length", "目标字数", "短篇3万字/中篇10万/长篇30万+/无限连载", True),
    ("hero", "主角设定", "主角身份+核心困境+金手指/特长(一句话)", True),
    ("hook", "核心钩子", "让读者追下去的那个悬念或爽点", True),
]

NOVEL_SPEC = {
    "fields": NOVEL_FIELDS,
    "defaults": {
        "subject": "都市", "tone": "爽", "platform": "番茄",
        "rhythm": "日更4000字", "length": "长篇30万+",
    },
    "llm": {
        "card": '把下面一句话创意整理成小说需求卡片,只输出JSON对象:{"title":书名10字内,"subject":题材,"tone":基调,"platform":"番茄/起点/晋江/B站","rhythm":"更新节奏","length":"目标字数规模","hero":"主角身份+困境+金手指一句话","hook":"核心悬念或爽点一句话"}。创意: {idea}',
        "design": '基于需求卡片设计小说骨架,只输出JSON对象:{"world":"世界观一段","power":"力量/金手指体系一段","mc_arc":"主角弧线起点到目标一段","volumes":[{"no":1,"name":"卷名","goal":"本卷目标","chapters":"章数"}],"main_conflict":"主线冲突一段"}。需求卡片: {card}',
    },
    "design_fallback": {
        "world": "（离线占位: 世界观）", "power": "（离线占位: 金手指/力量体系）",
        "mc_arc": "（离线占位: 主角弧线）", "main_conflict": "（离线占位: 主线冲突）",
        "volumes": [{"no": 1, "name": "卷一·开局", "goal": "立住主角与核心钩子", "chapters": "8-12章"}],
    },
}
fc.register("novel", NOVEL_SPEC)

# ---------- 生成器 ----------
def _gen_outline(state, online=True, projects_root=None):
    pdir = os.path.join(projects_root, state["slug"])
    os.makedirs(pdir, exist_ok=True)
    card = state["card"]
    design = state.get("design", {})
    outline = {
        "book": card.get("title", state["idea"]),
        "world": design.get("world", ""),
        "power": design.get("power", ""),
        "mc_arc": design.get("mc_arc", ""),
        "main_conflict": design.get("main_conflict", ""),
        "volumes": design.get("volumes", []),
        "chapters_v1": [],
    }
    # 卷一细纲（8章, 每章: 钩子/冲突/转折/结尾钩）
    llm = fc.llm_json(
        f'为这本小说写卷一细纲(8章),只输出JSON对象:{{"chapters":[{{"no":1,"title":"章标题","beat":"本章节拍一段","hook":"章末钩子一句话"}}]}}。'
        f'书名: {card.get("title")} 题材: {card.get("subject")} 基调: {card.get("tone")} '
        f'主角: {card.get("hero")} 钩子: {card.get("hook")} 目标字数: {card.get("length")}')
    if llm and "chapters" in llm:
        outline["chapters_v1"] = llm["chapters"]
        outline["ch_source"] = "llm"
    else:
        outline["chapters_v1"] = [
            {"no": 1, "title": "开局·困境", "beat": "主角登场+核心困境暴露", "hook": "金手指/转机初现"},
            {"no": 2, "title": "转折·入局", "beat": "主角抓住转机进入新舞台", "hook": "首个小反派出现"},
            {"no": 3, "title": "立威·打脸", "beat": "主角小试身手立威", "hook": "引来更大注意"},
            {"no": 4, "title": "受阻·升级", "beat": "遭遇挫折,能力升级", "hook": "隐藏强敌露一手"},
            {"no": 5, "title": "盟友·情报", "beat": "结识盟友,获得关键情报", "hook": "主线悬念加深"},
            {"no": 6, "title": "布局·反杀", "beat": "主角设局", "hook": "局成,敌不知"},
            {"no": 7, "title": "高潮前夜", "beat": "大战/大事件蓄势", "hook": "倒计时/危机爆发"},
            {"no": 8, "title": "卷一高潮", "beat": "主线首个高潮+阶段目标达成", "hook": "更大舞台/卷二引线"},
        ]
        outline["ch_source"] = "fallback"
    path = os.path.join(pdir, "大纲.json")
    json.dump(outline, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    state["outline"] = outline
    return {"outline": path, "chapters": len(outline["chapters_v1"])}

def _gen_chapter(state, online=True, projects_root=None, chapter=1):
    pdir = os.path.join(projects_root, state["slug"])
    os.makedirs(pdir, exist_ok=True)
    card = state["card"]
    outline = state.get("outline", {})
    ch = next((c for c in outline.get("chapters_v1", []) if c["no"] == chapter),
               {"no": chapter, "title": f"第{chapter}章", "beat": "", "hook": ""})
    # 写前组装上下文（L1 brief + 上一章结尾 + 伏笔 + canon）
    ctx = nm.assemble_context(pdir, chapter)
    text = ""
    if online and fc.has_key():
        text = fc.llm_json(
            f'写这章正文,只输出JSON对象:{{"text":"正文全文(1500-2500字)"}}。'
            f'《{card.get("title", state["idea"])}》 基调:{card.get("tone")} 主角:{card.get("hero")} '
            f'本章({ch["no"]})标题: {ch.get("title")} 节拍: {ch.get("beat","")} 章末钩: {ch.get("hook","")}'
            f'\n\n=== 上下文(写前组装) ===\n{ctx[:4000]}')
        text = text.get("text", "") if text else ""
        if not text:
            text = _skeleton_chapter(state, ch)
            text += "\n（LLM 失败, 回退骨架, 在线重跑可细化）"
    else:
        text = _skeleton_chapter(state, ch)
    path = os.path.join(pdir, f"ch{chapter}.md")
    open(path, "w", encoding="utf-8").write(text)
    # L0: 正文落盘（永不修改）
    nm.add_chapter_l0(pdir, chapter, text)
    # L1: 单章摘要（写完即冻结; 离线给 beat/hook 级）
    brief = (f"第{chapter}章「{ch.get('title','')}」: {ch.get('beat','')}。"
             f"章末钩: {ch.get('hook','')}。基调: {card.get('tone','')}")
    if online and fc.has_key():
        l1 = fc.llm_json(f'为这章写 300-500 字摘要,只输出JSON:{{"brief":"摘要"}}。正文:\n{text[:3000]}')
        if l1 and l1.get("brief"):
            brief = l1["brief"]
    nm.add_chapter_l1(pdir, chapter, brief)
    state.setdefault("chapters", {})[str(chapter)] = path
    return {"chapter": path, "l0": os.path.join(pdir, "L0", f"ch-{chapter:04d}.md"),
            "l1": os.path.join(pdir, "L1", f"brief-ch-{chapter:04d}.md"),
            "source": "llm" if (online and fc.has_key()) else "skeleton"}

def _skeleton_chapter(state, ch):
    card = state["card"]
    lines = [f"# {ch.get('title','')}", "",
             f"> 节拍: {ch.get('beat','')}  |  章末钩: {ch.get('hook','')}", "",
             "（正文骨架, 在线用 LLM 展开）", ""]
    return "\n".join(lines)

NOVEL_SPEC["gen"] = _gen_outline

# ---------- CLI ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="list")
    ap.add_argument("args", nargs="*")
    ap.add_argument("--chapter", type=int, default=1)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--online", action="store_true")
    ap.add_argument("--level", default="tactical")
    ap.add_argument("--id", default="")
    ap.add_argument("--kind", default="facts")
    ap.add_argument("--from-ch", type=int, default=1)
    ap.add_argument("--to-ch", type=int, default=0)
    args = ap.parse_args()

    if args.cmd == "new":
        if not (args.args and args.args[0]):
            sys.exit("用法: novel_forge.py new <一句话创意>")
        st = fc.new_item("novel", args.args[0], PROJECTS, online=args.online, json_out=args.json,
                          guide=not args.json)
    elif args.cmd == "guide":
        st = fc.load_state(PROJECTS, args.args[0] if args.args else "")
        fc.guide(NOVEL_SPEC, st, interactive=not args.json, json_out=args.json,
                 projects_root=PROJECTS, item_slug=st["slug"])
    elif args.cmd == "outline":
        st = fc.load_state(PROJECTS, args.args[0] if args.args else "")
        out = _gen_outline(st, online=args.online or fc.has_key(), projects_root=PROJECTS)
        print(f"卷一细纲: {out['chapters']} 章 → {out['outline']}")
    elif args.cmd == "chapter":
        st = fc.load_state(PROJECTS, args.args[0] if args.args else "")
        out = _gen_chapter(st, online=args.online or fc.has_key(), projects_root=PROJECTS,
                           chapter=args.chapter)
        fc.save_state(PROJECTS, st["slug"], st)
        print(f"第{args.chapter}章: {out['chapter']} ({out['source']})  L1:brief-ch-{out.get('l1','?').split('-')[-1].replace('.md','')}")
    elif args.cmd == "memory":
        st = fc.load_state(PROJECTS, args.args[0] if args.args else "")
        pdir = os.path.join(PROJECTS, st["slug"])
        cur = args.chapter or 1
        report = nm.consistency_report(pdir, cur)
        rp = os.path.join(pdir, "consistency_report.json")
        json.dump(report, open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"一致性检查(第{cur}章): {len(report['deterministic'])} 个确定性问题 → {rp}")
        for iss in report["deterministic"]:
            print(f"  [{iss['rule']}] {iss['detail']}")
    elif args.cmd == "foreshadow":
        st = fc.load_state(PROJECTS, args.args[0] if args.args else "")
        pdir = os.path.join(PROJECTS, st["slug"])
        desc = args.args[1] if len(args.args) > 1 else "(描述)"
        entry = nm.foreshadow_add(pdir, desc, level=args.level,
                                  source_chapter=args.chapter or 1)
        print(f"伏笔 {entry['id']}: {entry['desc']} ({entry['level']}, 源章{entry.get('source_chapter')})")
    elif args.cmd == "pay":
        st = fc.load_state(PROJECTS, args.args[0] if args.args else "")
        pdir = os.path.join(PROJECTS, st["slug"])
        nm.foreshadow_payoff(pdir, args.id, args.chapter or 0)
        print(f"伏笔 {args.id} 已回收 (第{args.chapter or 0}章)")
    elif args.cmd == "canon":
        st = fc.load_state(PROJECTS, args.args[0])
        pdir = os.path.join(PROJECTS, st["slug"])
        fact = " ".join(args.args[1:]) if len(args.args) > 1 else ""
        entry = nm.canon_append(pdir, args.kind, {"desc": fact, "note": args.level})
        print(f"正典 {args.kind} 追加: {entry['id']} {fact}")
    elif args.cmd == "show":
        st = fc.load_state(PROJECTS, args.args[0])
        print(json.dumps(st, ensure_ascii=False, indent=2)[:2000])
    elif args.cmd == "run":
        nrt.run(args.args[0], start=args.from_ch, end=args.to_ch or None,
                online=args.online or fc.has_key())
    elif args.cmd == "progress":
        nrt.status(args.args[0])
    elif args.cmd == "list":
        if not os.path.isdir(PROJECTS):
            print("（暂无小说项目）")
            return
        for d in sorted(os.listdir(PROJECTS)):
            f = os.path.join(PROJECTS, d, "state.json")
            if os.path.exists(f):
                s = json.load(open(f, encoding="utf-8"))
                print(f"  {d}  [{s.get('status','?')}]  {s.get('idea','')[:30]}")
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
