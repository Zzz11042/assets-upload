#!/usr/bin/env python3
"""game-forge flow — 自动化决策流 + 逐步生成游戏

按"生成游戏要素清单"的顺序，把每一步变成创作者的选择题，
确认后再逐步生成（设计文档 → H5 骨架 → 注入数值 → 美工素材 → 可玩产物）。

用法:
  # 交互（默认，逐要素选择）
  python3 game_forge_flow.py
  python3 game_forge_flow.py --idea "末日基地经营"

  # 非交互（API/CI，把选择序列喂进来）
  python3 game_forge_flow.py --idea "末日基地经营" --plan E --style q-chibi-military --ref 5
  python3 game_forge_flow.py --select "idea=末日基地经营,genre=合成+塔防,pillars=0,core_loop=0,win_loss=0,economy=0,progression=0,content_scale=0,style=ink-lantern,audio=0,tech=0,monetization=0,mvp_scope=0"

  # 只列要素清单（看顺序）
  python3 game_forge_flow.py --elements

  # 看已确认的方案状态（断点续跑）
  python3 game_forge_flow.py --status
  python3 game_forge_flow.py --resume
"""
import json, os, re, sys, datetime, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
KB = os.path.join(HERE, "knowledge")
STATE = os.path.join(HERE, "flow_state.json")
OUT = os.path.join(HERE, "out")

def _j(name):
    p = os.path.join(KB, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else []

ELEMENTS = _j("elements.json").get("elements", [])
GAMES = _j("games.json")
PLANS = _j("plans.json")
STYLES = _j("styles.json")

GENRES = sorted({p.get("genre", "") for p in PLANS if p.get("genre")} |
                {g.get("genre", "") for g in GAMES if g.get("genre")})

CORE_LOOPS = [p.get("one_liner", "") for p in PLANS if p.get("one_liner")] + \
             ["(自定义: 直接用思路作为核心循环)"]

PILLARS = [
    "紧张但公平(失败可理解)", "小空间·深选择(紧凑复用)", "工具优先于数值(玩法>堆数)",
    "低门槛·高上限(新手3min上手)", "随机构筑爽感(build多巴胺)", "长线不贬值(meta保值)",
    "每日重置钩子(回流设计)", "美术减法(程序化/极简)", "节奏可控(波制化)", "社交/竞技留存(异步榜)",
]
WIN_LOSS = ["守到第N波", "资金>目标值", "全图收集完成", "限时生存(分钟)", "章节全通关", "击败BOSS"]
ECONOMY = ["双币种分离(局内Gold+局外Chips)", "波内攒·波后结算消费", "非对称惩罚防滚雪球", "材料缺口驱动抽卡/广告", "回收价=购入×0.6"]
PROGRESSION = ["局内词缀build", "局外meta解锁选择(不堆数值)", "合成升阶(二合一)", "军衔/武学树养成", "图鉴收集解锁新池"]
CONTENT = ["MVP最小集(3内容×2类型)", "波次12+BOSS每4波", "20波Brotato节奏", "每日4图轮换", "章节制4章×5-8任务"]
AUDIO = ["无(占位)", "程序化音效", "占位音乐"]
TECH = ["H5 Canvas单文件(零依赖)", "Cocos Creator 3.x", "Unity URP", "Phaser 3", "性能:单屏≤30单位/30fps"]
MONET = ["纯IAA(单局≤4广告点)", "IAA+轻内购(外观不数值)", "免费+内购(金币/皮肤)", "无变现(纯作品)"]
SCOPE = ["砍到1个核心循环", "保留核心+1个长线钩子", "全量方案MVP范围", "含异步榜/赛季"]

OPTION_MAP = {
    "genre": GENRES,
    "pillars": PILLARS,
    "core_loop": CORE_LOOPS,
    "win_loss": WIN_LOSS,
    "economy": ECONOMY,
    "progression": PROGRESSION,
    "content_scale": CONTENT,
    "audio": AUDIO,
    "tech": TECH,
    "monetization": MONET,
    "mvp_scope": SCOPE,
}

# ---------- 检索 ----------
def _tokens(t):
    t = t.lower()
    toks = set(re.findall(r"[a-z0-9]+", t))
    for seg in re.findall(r"[\u4e00-\u9fff]+", t):
        for i in range(len(seg) - 1):
            toks.add(seg[i:i + 2])
        toks.add(seg)
    return toks

def _score(text, fields):
    hay = _tokens(" ".join(map(str, fields)))
    q = _tokens(text)
    return sum(1 for t in q if t in hay) / max(1, len(q))

def pick_similar(idea, top=5):
    out = []
    for g in GAMES:
        s = _score(idea, [g.get("name"), g.get("tags"), g.get("genre"), g.get("mechanics"), g.get("theme")])
        if s > 0.15:
            out.append((s, g))
    out.sort(key=lambda x: -x[0])
    return out[:top]

def pick_style(idea, plan_default=None, top=5):
    cands = []
    for st in STYLES:
        s = _score(idea, [st.get("name"), st.get("tags"), st.get("mood"), st.get("palette_name")])
        if plan_default and st["id"] == plan_default:
            s += 0.3
        cands.append((s, st))
    cands.sort(key=lambda x: -x[0])
    return cands[:top]

# ---------- 状态 ----------
def load_state():
    return json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else None

def save_state(st):
    json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# ---------- 选择 ----------
def _choice(title, options, default=0):
    print(f"\n{title}")
    for i, o in enumerate(options):
        mark = " *" if i == default else ""
        print(f"  {i}. {o}{mark}")
    raw = input(f"  选择 [0-{len(options)-1}] 默认 {default}: ").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default

def run_interactive(idea=""):
    st = load_state() or {"idea": "", "choices": {}, "confirmed": False, "generated": []}
    if not idea:
        idea = st.get("idea") or input("你的思路(一句话): ").strip()
        st["idea"] = idea
    for el in ELEMENTS:
        key = el["key"]
        if st["choices"].get(key) is not None and key not in ("idea",):
            print(f"  [{key}] 已选: {st['choices'][key]} (回车保留, n=重选)")
            if input(f"  重选? [回车保留/n]: ").strip().lower() != "n":
                continue
        if key == "idea":
            st["choices"][key] = idea
            print(f"  [思路] {idea}")
            continue
        if key == "similar_game":
            rec = pick_similar(idea)
            opts = [f"{g['name']} — 借鉴:{g.get('borrow','')[:40]}" for _s, g in rec] + ["(不用参考)"]
            i = _choice(f"Q: {el['name']}", opts, default=len(opts) - 1)
            st["choices"][key] = rec[i][1]["id"] if i < len(rec) else None
            continue
        if key == "style":
            plan_default = None
            pv = st["choices"].get("genre")
            for p in PLANS:
                if p.get("genre") == pv:
                    plan_default = p.get("default_style")
                    break
            cands = pick_style(idea, plan_default)
            opts = [f"{st['name']} ({st.get('art_style','')})" for _s, st in cands]
            i = _choice(f"Q: {el['name']}", opts, default=0)
            st["choices"][key] = cands[i][1]["id"]
            continue
        # 通用 pick
        opts = OPTION_MAP.get(key) or [key]
        i = _choice(f"Q: {el['name']}", opts, default=0)
        st["choices"][key] = opts[i]
        save_state(st)

    # 确认
    print("\n== 你的选择 ==")
    for el in ELEMENTS:
        v = st["choices"].get(el["key"])
        print(f"  {el['name']}: {v}")
    ok = input("\n确认这些选择并开始生成? [y/N]: ").strip().lower()
    if ok != "y":
        print("未确认，选择已存到 flow_state.json，可用 --resume 继续")
        return None
    st["confirmed"] = True
    save_state(st)
    return generate(st)

def parse_select(sel):
    """'k=v,k=v' → dict。v 若是纯数字且选项库有该 key，当索引；否则当值。"""
    out = {}
    for pair in sel.split(","):
        if not pair.strip():
            continue
        k, _, v = pair.partition("=")
        out[k.strip()] = v.strip()
    return out

def generate(st):
    """按确认的要素，逐步生成: 设计文档 → H5 → 数值注入 → 美工 → 产物清单。"""
    ch = st["choices"]
    os.makedirs(OUT, exist_ok=True)
    art_dir = os.path.join(OUT, "flow")
    os.makedirs(art_dir, exist_ok=True)
    plan = None
    # 1) 选方案
    genre = ch.get("genre")
    for p in PLANS:
        if p.get("genre") == genre:
            plan = p
            break
    if plan is None and ch.get("similar_game"):
        for g in GAMES:
            if g["id"] == ch["similar_game"] and g.get("borrow"):
                plan = g
    # 2) 设计文档
    design = {
        "game": "未命名", "genre": genre,
        "pillars": ch.get("pillars"), "core_loop": ch.get("core_loop"),
        "win_loss": ch.get("win_loss"), "economy": ch.get("economy"),
        "progression": ch.get("progression"), "content_scale": ch.get("content_scale"),
        "style_id": ch.get("style"), "audio": ch.get("audio"),
        "tech": ch.get("tech"), "monetization": ch.get("monetization"),
        "mvp_scope": ch.get("mvp_scope"),
        "similar": ch.get("similar_game"),
        "plan_ref": plan.get("name") if isinstance(plan, dict) and "name" in plan else None,
        "confirmed_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    style = next((s for s in STYLES if s["id"] == ch.get("style")), None)
    design["style"] = style
    style_path = os.path.join(art_dir, "设计.md")
    with open(style_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(design, ensure_ascii=False, indent=2))
    # 3) H5 骨架（复用 game_forge.render_h5）
    import game_forge as gf
    plan_name = design["plan_ref"] or genre or "custom"
    numbers = {}
    if isinstance(plan, dict):
        numbers = plan.get("numbers", {})
    css = {"--bg": style.get("palette", ["#1a1a2e"])[0] if style else "#1a1a2e",
           "--accent": (style.get("palette") or ["#f5ecd0"])[1] if style and len(style.get("palette", [])) > 1 else "#f5ecd0",
           "--text": "#fff"}
    mech = [design["core_loop"], design["economy"], design["progression"]]
    h5 = os.path.join(art_dir, "game.html")
    open(h5, "w", encoding="utf-8").write(gf.render_h5(plan_name, numbers, style or {}, css, None, mech))
    # 4) 数值注入说明
    num_path = os.path.join(art_dir, "数值注入.md")
    with open(num_path, "w", encoding="utf-8") as f:
        f.write(f"# 数值注入 — {plan_name}\n\n经济: {design['economy']}\n成长: {design['progression']}\n规模: {design['content_scale']}\n\n")
        f.write("注入到 H5 的 NUM 对象(由 numbers dict 自动 JSON 化):\n")
        f.write(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n")
    # 5) 美工素材清单
    art_list = []
    if style:
        for need in (plan.get("needs", ["hero", "enemy", "background", "icon", "ui"]) if isinstance(plan, dict) else ["hero", "enemy", "background", "icon", "ui"]):
            art_list.append({"need": need, "category": gf._categorize_need(need),
                            "prompt": gf.style_prompt_for_need(style, need), "size": "1K", "ratio": "1:1"})
    art_manifest = os.path.join(art_dir, "art_manifest.json")
    json.dump(art_list, open(art_manifest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    # 产物清单
    manifest = os.path.join(art_dir, "FLOW_MANIFEST.json")
    json.dump({"design": style_path, "game": h5, "numbers": num_path, "art_manifest": art_manifest,
               "art_items": art_list, "confirmed_at": design["confirmed_at"]},
              open(manifest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    st["generated"] = [style_path, h5, num_path, art_manifest, manifest]
    save_state(st)
    print("\n== 生成完成 ==")
    for p in st["generated"]:
        print("  " + p)
    return st

def run_noninteractive(args):
    ch = {}
    if args.idea:
        ch["idea"] = args.idea
    if args.select:
        ch.update(parse_select(args.select))
    # 显式 flag 覆盖
    for flag_key, el in [("plan", "similar_game"), ("style", "style"), ("ref", "similar_game")]:
        v = getattr(args, flag_key, None)
        if v:
            if flag_key == "style":
                ch["style"] = v
            elif flag_key == "ref":
                for g in GAMES:
                    if g["id"] == int(v) or g["name"] == v:
                        ch["similar_game"] = g["id"]
            else:
                for p in PLANS:
                    if p["id"] == v or p["name"] == v:
                        ch["genre"] = p.get("genre")
                        ch["core_loop"] = p.get("core_loop")
                        break
    st = {"idea": ch.get("idea", ""), "choices": ch, "confirmed": True}
    return generate(st)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--idea", default="")
    ap.add_argument("--select", default="")
    ap.add_argument("--plan", default="")
    ap.add_argument("--style", default="")
    ap.add_argument("--ref", default="")
    ap.add_argument("--elements", action="store_true")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--interactive", action="store_true")
    args = ap.parse_args()

    if args.elements:
        print("生成游戏要素清单 (按顺序):")
        for el in ELEMENTS:
            print(f"  [{el['id']}] {el['name']}  ({el['kind']}, required={el['required']})")
        return
    if args.status:
        st = load_state()
        print(json.dumps(st, ensure_ascii=False, indent=2) if st else "无状态")
        return
    if args.resume:
        st = load_state()
        if not st or not st.get("confirmed"):
            print("没有已确认的流，先跑交互或 --select")
            return
        generate(st)
        return
    if args.select or args.plan or args.style or args.ref:
        run_noninteractive(args)
    else:
        run_interactive(args.idea)

if __name__ == "__main__":
    main()
