#!/usr/bin/env python3
"""forge — 跨领域引导式生成统一入口（游戏/短剧/小说/...）

复用 forge_common 的"一句话→需求卡片→缺口引导完善→设计要素→分层生成"
机制，各领域的 spec + 生成器由子模块贡献。

领域:
  game   : game_forge_flow（要素决策流, 已在 game-forge 内验证）
  drama  : drama_forge（Pavo 式短剧）
  novel  : novel_forge（网文/长篇）

用法:
  # 看所有领域
  python3 forge.py kinds

  # 给某个领域新建项目(走该领域的引导完善流程)
  python3 forge.py new novel "都市重生爽文: 996程序员猝死后回到2019"
  python3 forge.py new drama "修仙掌门推销防脱洗发水广告"
  python3 forge.py new game  "末日基地经营"

  # 看某领域项目缺口 / 逐项完善
  python3 forge.py guide <领域> <项目名> [--json]

  # 生成(各领域生成器):
  python3 forge.py generate <领域> <项目名> [--online]

  # 列某领域所有项目
  python3 forge.py list <领域>
"""
import json, os, sys, argparse, importlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forge_common as fc

DOMAINS = {
    "novel": ("novel_forge", "NOVEL_SPEC", "novel_projects", "state.json"),
    "drama": ("drama_forge", None, "projects", "project.json"),
    "game": ("game_forge_flow", None, "out", "state.json"),
}

def _load_domain(kind):
    mod_name, spec_name, proj_dir, state_file = DOMAINS[kind]
    mod = importlib.import_module(mod_name)
    spec = fc.get(kind)
    if spec is None:
        spec = _domain_spec(kind)
        fc.register(kind, spec)
    return mod, spec, os.path.join(HERE, proj_dir), state_file

def _domain_spec(kind):
    """为 drama/game 领域构造 forge_common spec（它们已有自己的卡片/引导实现，
    这里提供通用 fields 以便 forge.py 统一 guide/缺口检查）。"""
    if kind == "drama":
        fields = [
            ("title", "标题", "10字内", True),
            ("synopsis", "概梗", "30字内讲清谁在哪做什么", True),
            ("duration_sec", "时长(秒)", "4-60秒", True),
            ("aspect", "画幅", "9:16竖屏/16:9横屏/1:1", True),
            ("visual_style", "视觉风格", "电影感/日系动漫/水墨/像素…", True),
            ("content_type", "内容类型", "搞笑/情绪/反转/宣传/广告/爽剧", True),
            ("notes", "补充说明", "参考作品/目标平台/禁忌", False),
        ]
        return {"fields": fields,
                "defaults": {"aspect": "9:16", "content_type": "通用短剧", "duration_sec": 6}}
    if kind == "game":
        fields = [
            ("genre", "类型", "玩法类型", True),
            ("core_loop", "核心循环", "单一核心动词+30-60s循环", True),
            ("win_loss", "胜负条件", "明确胜利/失败", True),
            ("style", "美工风格", "风格库id", True),
            ("mvp_scope", "MVP范围", "砍到可玩最小集", True),
        ]
        return {"fields": fields, "defaults": {}}
    return {"fields": [], "defaults": {}}

def cmd_kinds():
    print("可生成领域:")
    # import 各领域模块, 让它们把自己注册的 spec 暴露给 forge_common
    import novel_forge, drama_forge  # noqa
    for k in DOMAINS:
        spec = fc.get(k) or _domain_spec(k)
        n_fields = len(spec.get("fields", []))
        src = "已注册" if fc.get(k) else "构造"
        print(f"  {k:6s}  ({n_fields} 个需求字段, {src}, 模块 {DOMAINS[k][0]})")

def cmd_new(kind, idea, online=False, json_out=False, guide=True):
    mod, spec, proj_root, state_file = _load_domain(kind)
    # 统一走 forge_common.new_item(带该领域的 state_file)
    st = fc.new_item(kind, idea, proj_root, online=online, json_out=json_out, guide=guide,
                     state_file=state_file)
    return st

def cmd_guide(kind, name, json_out=False):
    mod, spec, proj_root, state_file = _load_domain(kind)
    state = fc.load_state(proj_root, name, state_file=state_file)
    fc.guide(spec, state, interactive=not json_out, json_out=json_out,
             projects_root=proj_root, item_slug=state.get("slug"))

def cmd_generate(kind, name, online=True):
    mod, spec, proj_root, state_file = _load_domain(kind)
    state = fc.load_state(proj_root, name, state_file=state_file)
    state["_state_file"] = state_file
    if kind == "novel":
        out = mod._gen_outline(state, online=online, projects_root=proj_root)
        state["outline"] = out.get("outline")
        out2 = mod._gen_chapter(state, online=online, projects_root=proj_root, chapter=1)
        state["chapter1"] = out2["chapter"]
        print(f"[novel] 大纲: {out['outline']} | 第1章: {out2['chapter']}")
    elif kind == "drama":
        out = mod.gen_keyframes(state, online=online)
        out2 = mod.gen_videos(state, online=online)
        print(f"[drama] 关键帧: {len(state.get('keyframes', {}))} | 视频: {len(state.get('videos', {}))}")
    elif kind == "game":
        out = mod.generate(state)
        print(f"[game] 生成: {out}")
    fc.save_state(proj_root, state.get("slug") or name, state, state_file=state_file)
    return state

def cmd_list(kind):
    _, spec, proj_root, state_file = _load_domain(kind)
    if not os.path.isdir(proj_root):
        print("（暂无项目）")
        return
    for d in sorted(os.listdir(proj_root)):
        f = os.path.join(proj_root, d, "state.json")
        f2 = os.path.join(proj_root, d, "project.json")
        for fp in (f, f2):
            if os.path.exists(fp):
                s = json.load(open(fp, encoding="utf-8"))
                idea = s.get("idea", s.get("game", ""))[:30]
                print(f"  [{kind}] {d}  [{s.get('status','?')}]  {idea}")
                break

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="kinds")
    ap.add_argument("kind", nargs="?", default="")
    ap.add_argument("arg", nargs="?", default="")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--online", action="store_true")
    args = ap.parse_args()

    if args.cmd == "kinds":
        cmd_kinds()
    elif args.cmd == "new":
        if not args.kind or not args.arg:
            sys.exit("用法: forge.py new <kind> <一句话>")
        cmd_new(args.kind, args.arg, online=args.online, json_out=args.json)
    elif args.cmd == "guide":
        cmd_guide(args.kind, args.arg, json_out=args.json)
    elif args.cmd == "generate":
        cmd_generate(args.kind, args.arg, online=args.online)
    elif args.cmd == "list":
        cmd_list(args.kind or "novel")
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
