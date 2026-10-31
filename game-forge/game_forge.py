#!/usr/bin/env python3
"""game-forge — 选择驱动的游戏生成工具

设计哲学：创作者给"思路"（一句话/关键词），工具在本地知识库里
检索相似游戏与方案，把"需要描述的内容"压缩成"选择题"，
最终一键生成可玩的 H5 游戏（单文件、零依赖）+ 美工素材清单 + 数值表。

子命令:
  games          列出游戏库（按玩法/题材/风格索引）
  recommend      给思路 → 检索相似游戏 + 候选方案 + 风格候选，输出选择题
  plan           选择/输入方案 id → 生成结构化设计方案（数值/玩法/风格/素材清单）
  generate       方案 id → 生成可玩 H5 游戏 + 素材生成清单 + 生图 prompt
  style-list     列出风格库
  styles         按风格关键词检索 + 给出生图 prompt

  非交互（API/CI）:
  python3 game_forge.py recommend "末日基地经营" --json
  python3 game_forge.py plan --game 4 --plan 墨剑江湖 --style pixel-warm --json
  python3 game_forge.py generate --game 4 --plan 墨剑江湖 --style pixel-warm [--gen-art]

  交互（CLI 菜单，减少描述）:
  python3 game_forge.py recommend "末日基地经营"
  python3 game_forge.py generate
"""
import json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
KB = os.path.join(ROOT, "knowledge")
OUT = os.path.join(ROOT, "out")

# ---------- 知识库加载 ----------

def _load_json(name):
    p = os.path.join(KB, name)
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

GAMES = _load_json("games.json") or []
PLANS = _load_json("plans.json") or []
STYLES = _load_json("styles.json") or []

# ---------- 检索 ----------

def _tokens(text):
    """中文无分词，用 bigram + 英文词做简单匹配。"""
    text = text.lower()
    toks = set(re.findall(r"[a-z0-9]+", text))
    cjk = re.findall(r"[\u4e00-\u9fff]+", text)
    for seg in cjk:
        for i in range(len(seg) - 1):
            toks.add(seg[i:i + 2])
        toks.add(seg)
    return toks

def _score(text, fields):
    """fields: list[str] 或 dict，返回匹配分。"""
    if isinstance(fields, dict):
        fields = [json.dumps(fields, ensure_ascii=False)]
    hay = " ".join(fields).lower()
    hay_toks = _tokens(hay)
    q_toks = _tokens(text)
    hit = 0
    for t in q_toks:
        if t in hay_toks:
            hit += 1
    return hit / max(1, len(q_toks))

def find_games(idea, top=6):
    """按思路检索相似游戏。"""
    scored = []
    for g in GAMES:
        fields = [g.get("name", ""), g.get("tags", ""), g.get("genre", ""),
                  g.get("mechanics", ""), g.get("theme", ""), g.get("mood", "")]
        s = _score(idea, fields)
        scored.append((s, g))
    scored.sort(key=lambda x: -x[0])
    return scored[:top]

def find_plans(idea, top=5):
    scored = []
    for p in PLANS:
        fields = [p.get("name", ""), p.get("genre", ""), p.get("tags", ""),
                  p.get("one_liner", ""), p.get("core_loop", ""),
                  " ".join(p.get("mechanics", []))]
        s = _score(idea, fields)
        scored.append((s, p))
    scored.sort(key=lambda x: -x[0])
    return scored[:top]

def find_styles(idea, top=5):
    scored = []
    for st in STYLES:
        fields = [st.get("name", ""), st.get("tags", ""), st.get("palette_name", ""),
                  st.get("mood", ""), st.get("art_style", "")]
        s = _score(idea, fields)
        scored.append((s, st))
    scored.sort(key=lambda x: -x[0])
    return scored[:top]

def recommend(idea, as_json=False):
    """给思路 → 返回 相似游戏 / 候选方案 / 风格候选 的选择题结构。"""
    games = find_games(idea)
    plans = find_plans(idea)
    styles = find_styles(idea)
    result = {
        "idea": idea,
        "similar_games": [
            {"id": g["id"], "name": g["name"], "genre": g.get("genre"),
             "tags": g.get("tags"), "score": round(s, 2)}
            for s, g in games if s > 0.15
        ],
        "candidate_plans": [
            {"id": p["id"], "name": p["name"], "genre": p.get("genre"),
             "score": round(s, 2), "one_liner": p.get("one_liner", "")}
            for s, p in plans if s > 0.15
        ],
        "style_options": [
            {"id": st["id"], "name": st["name"], "score": round(s, 2)}
            for s, st in styles if s > 0.15
        ],
        "questions": [
            "Q1 玩法参考: 选一个相似游戏(按相似度高排列)",
            "Q2 方案: 选一个候选方案(或输入 0 自创)",
            "Q3 风格: 选一个美工风格(或直接回车用方案默认风格)",
        ],
    }
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return result
    print(f"## 思路: {idea}\n")
    print("### Q1 相似游戏 (参考)")
    for i, g in enumerate(result["similar_games"], 1):
        print(f"  {i}. {g['name']}  [{g.get('genre','')}]  tags={g.get('tags','')}")
    print(f"\n### Q2 候选方案")
    for i, p in enumerate(result["candidate_plans"], 1):
        print(f"  {i}. {p['name']}  [{p.get('genre','')}] — {p.get('one_liner','')}")
    print("  0. 以上都不合适，描述自创")
    print(f"\n### Q3 美工风格")
    for i, st in enumerate(result["style_options"], 1):
        print(f"  {i}. {st['name']}")
    print("  (直接回车 = 用所选方案的默认风格)")
    return result

# ---------- 方案 ----------

def get_plan(name_or_id):
    for p in PLANS:
        if str(p["id"]) == str(name_or_id) or p["name"] == name_or_id:
            return p
    return None

def get_game(name_or_id):
    for g in GAMES:
        if str(g["id"]) == str(name_or_id) or g["name"] == name_or_id:
            return g
    return None

def get_style(name_or_id):
    for st in STYLES:
        if st["id"] == name_or_id or st["name"] == name_or_id:
            return st
    return None

def build_plan(plan, style=None, ref_game=None):
    """把方案 + 风格 + 参考游戏 合成一份完整设计方案。"""
    out = {
        "plan": plan["name"],
        "genre": plan.get("genre"),
        "one_liner": plan.get("one_liner"),
        "core_loop": plan.get("core_loop"),
        "mechanics": plan.get("mechanics", []),
        "numbers": plan.get("numbers", {}),
        "long_term": plan.get("long_term", []),
        "monetization": plan.get("monetization", {}),
        "tech": plan.get("tech", {}),
        "mvp_scope": plan.get("mvp_scope", []),
        "risks": plan.get("risks", []),
        "style": None,
        "ref_game": None,
        "asset_manifest": [],
    }
    if style:
        out["style"] = style
        # 生成素材清单（按风格 + 方案机制）
        for need in plan.get("needs", []):
            out["asset_manifest"].append({
                "need": need,
                "category": _categorize_need(need),
                "prompt": style_prompt_for_need(style, need),
                "size": style.get("size", "1K"),
                "ratio": "1:1" if style.get("category_hint") in ("icon", "ui") else style.get("ratio", "16:9"),
            })
    if ref_game:
        out["ref_game"] = {"id": ref_game["id"], "name": ref_game["name"],
                           "borrow": ref_game.get("borrow", "")}
    return out

def _categorize_need(need):
    n = need.lower()
    if any(k in n for k in ("icon", "ui", "hud", "badge", "button", "logo")):
        return "ui"
    if any(k in n for k in ("background", "bg", "scene", "map", "terrain")):
        return "background"
    if any(k in n for k in ("character", "hero", "soldier", "enemy", "sprite")):
        return "character"
    if any(k in n for k in ("particle", "fx", "effect")):
        return "effect"
    return "other"

def style_prompt_for_need(style, need):
    """把风格拼进素材需求 → 生图 prompt。"""
    base = style.get("style_prompt", "")
    return f"{need} game asset, {base}" if base else f"{need} game asset, consistent art direction"

def save_plan(design, name):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"{_slug(name)}_设计.md")
    with open(p, "w", encoding="utf-8") as f:
        f.write(render_plan_md(design))
    return p

def render_plan_md(d):
    L = [f"# 设计方案 — {d['plan']}", "", f"类型: {d.get('genre')} | 一句话: {d.get('one_liner')}", ""]
    L += ["## 核心循环", "```", d.get("core_loop", ""), "```", ""]
    L += ["## 机制"] + [f"- {m}" for m in d.get("mechanics", [])] + [""]
    if d.get("ref_game"):
        L += [f"## 参考游戏: {d['ref_game']['name']}", f"借鉴: {d['ref_game'].get('borrow','')}", ""]
    L += ["## 数值设计", ""]
    for k, v in d.get("numbers", {}).items():
        L.append(f"- **{k}**: {json.dumps(v, ensure_ascii=False)}")
    L += ["", "## 美工风格", ""]
    st = d.get("style")
    if st:
        L += [f"- 风格: {st.get('name')} ({st.get('art_style','')})",
              f"- 配色: {st.get('palette_name','')} {st.get('palette', [])}",
              f"- 情绪: {st.get('mood','')}",
              f"- 参考: {st.get('reference', [])}", ""]
        L += ["## 素材清单 (生图 prompt)", ""]
        for a in d.get("asset_manifest", []):
            L += [f"### {a['need']} ({a['category']})",
                  f"- prompt: `{a['prompt']}`",
                  f"- 规格: {a['size']} / {a['ratio']}", ""]
    L += ["## 长线/变现", ""] + [f"- {x}" for x in d.get("long_term", [])] + \
         [f"- 变现: {json.dumps(d.get('monetization', {}), ensure_ascii=False)}"] + \
         ["", "## 技术选型", json.dumps(d.get("tech", {}), ensure_ascii=False)] + \
         ["", "## MVP 范围", ""] + [f"- {x}" for x in d.get("mvp_scope", [])] + \
         ["", "## 风险", ""] + [f"- {x}" for x in d.get("risks", [])]
    return "\n".join(L)

# ---------- 生成 H5 ----------

def generate_h5(design, out_dir=None):
    """生成单文件零依赖可玩 H5 游戏（玩法骨架 + 风格 token + 数值表注入）。"""
    out_dir = out_dir or OUT
    os.makedirs(out_dir, exist_ok=True)
    plan = design["plan"]
    style = design.get("style") or {}
    # 把风格 token 转 CSS 变量
    css_vars = {
        "--bg": style.get("palette", ["#1a1a2e"])[0] if style.get("palette") else "#1a1a2e",
        "--accent": (style.get("palette") or ["#f5ecd0"])[1] if len(style.get("palette", [])) > 1 else "#f5ecd0",
        "--text": style.get("text_color", "#fff"),
    }
    html = render_h5(plan, design.get("numbers", {}), style, css_vars,
                     design.get("ref_game"), design.get("mechanics", []))
    path = os.path.join(out_dir, f"{_slug(plan)}_game.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path

def render_h5(plan, numbers, style, css_vars, ref_game, mechanics):
    """单文件 H5 游戏骨架：标题页 + 可玩核心循环（自动按方案注入数值）+ 风格化 CSS。"""
    mech_lines = "\n".join(f"<li>{m}</li>" for m in mechanics[:8]) or "<li>（核心机制待填）</li>"
    num_rows = "\n".join(
        f"<tr><td>{k}</td><td>{json.dumps(v, ensure_ascii=False)}</td></tr>"
        for k, v in list(numbers.items())[:12])
    ref = ref_game["name"] if ref_game else "无"
    palette = style.get("palette", [])
    palette_css = " ".join(f"--c{i}:{c};" for i, c in enumerate(palette))
    accent = css_vars.get("--accent", "#f5ecd0")
    template = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{plan}</title>
<style>
:root {{
{palette_css}
--bg:{bg};--accent:{accent};--text:{text}
}}
*{{box-sizing:border-box;margin:0}}
body{{background:var(--bg);color:var(--text);font-family:system-ui,'PingFang SC',sans-serif;
  display:flex;flex-direction:column;align-items:center;min-height:100vh}}
header{{padding:16px;text-align:center}}
h1{{font-size:22px}}
#screen{{width:min(560px,94vw);margin:12px auto;padding:14px;border-radius:12px;
  background:rgba(0,0,0,.25);backdrop-filter:blur(4px)}}
.canvas-wrap{{display:flex;justify-content:center;margin:10px 0}}
canvas{{background:#000;border-radius:8px;image-rendering:pixelated;max-width:100%}}
table{{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}}
td{{border:1px solid var(--accent);padding:4px 8px}}
.btn{{background:var(--accent);color:#111;border:0;border-radius:8px;
  padding:10px 18px;font-size:15px;cursor:pointer;margin:8px}}
.btn:disabled{{opacity:.5;cursor:not-allowed}}
.meta{{font-size:12px;opacity:.7;margin-top:8px;line-height:1.5}}
</style>
</head>
<body>
<header>
  <h1>{plan}</h1>
  <div class="meta">参考游戏: {ref} · 风格: {style_name}</div>
</header>
<div id="screen">
  <div class="canvas-wrap"><canvas id="cv" width="480" height="280"></canvas></div>
  <div class="meta" id="hud">资源: 100 · 等级: 1 · 波次: 0</div>
  <button class="btn" id="go">开始 / 下一波</button>
  <button class="btn" id="shop">商店 (随机)</button>
  <button class="btn" id="up" disabled>升级</button>
  <details><summary>机制与数值</summary>
    <ul>{mech_lines}</ul>
    <table><tr><th>键</th><th>值</th></tr>{num_rows}</table>
  </details>
</div>
<script>
(function(){{
  var cv=document.getElementById('cv'),ctx=cv.getContext('2d');
  var S={{resource:100,level:1,wave:0,items:[],tick:0}};
  var NUM={numbers_json};
  var ACCENT='{accent}';
  function hud(){{
    document.getElementById('hud').textContent=
      '资源: '+S.resource+' · 等级: '+S.level+' · 波次: '+S.wave;
  }}
  function draw(){{
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.fillStyle='rgba(255,255,255,0.04)';
    for(var x=0;x<cv.width;x+=24)
      for(var y=0;y<cv.height;y+=24)
        if((x+y)%48<24) ctx.fillRect(x,y,12,12);
    var px=cv.width/2+Math.sin(S.tick*.05)*40, py=cv.height/2+Math.cos(S.tick*.04)*30;
    ctx.fillStyle=ACCENT;
    ctx.fillRect(px-10,py-10,20,20);
    for(var i=0;i<S.wave;i++){{
      var ex=(i*97)%cv.width, ey=(i*61)%cv.height;
      ctx.fillStyle='#e05050';ctx.fillRect(ex,ey,8,8);
    }}
    S.tick++;hud();requestAnimationFrame(draw);
  }}
  document.getElementById('go').onclick=function(){{
    S.wave++;
    var gain=NUM['wave_gain']?NUM['wave_gain']:10+S.wave*2;
    S.resource+=gain;S.level=Math.floor(S.wave/3)+1;
    document.getElementById('up').disabled=S.resource<50;
  }};
  document.getElementById('shop').onclick=function(){{
    var costs=[10,20,50,100];
    S.items.push(costs[Math.floor(Math.random()*costs.length)]);
  }};
  document.getElementById('up').onclick=function(){{
    if(S.resource>=50){{S.resource-=50;S.level++;document.getElementById('up').disabled=true;}}
  }};
  draw();
}})();
</script>
</body>
</html>"""
    return template.format(
        plan=plan, ref=ref, style_name=style.get("name", "默认"),
        palette_css=palette_css, bg=css_vars.get("--bg", "#1a1a2e"),
        accent=accent, text=css_vars.get("--text", "#fff"),
        mech_lines=mech_lines, num_rows=num_rows,
        numbers_json=json.dumps(numbers, ensure_ascii=False),
    )

# ---------- 生图（可选，调 agnes-image API）----------

def gen_art(design, max_items=6):
    """调 agnes-image-2.5-flash 为素材清单批量生图（离线则只给 prompt 清单）。"""
    import urllib.request, urllib.error, time
    api = os.environ.get("AGNES_API_BASE", "https://apihub.agnes-ai.com/v1").rstrip("/")
    key = os.environ.get("AGNES_API_KEY")
    art_dir = os.path.join(OUT, _slug(design["plan"]), "art")
    os.makedirs(art_dir, exist_ok=True)
    gen_list = []
    for a in design.get("asset_manifest", [])[:max_items]:
        gen_list.append({
            "need": a["need"], "category": a["category"],
            "prompt": a["prompt"], "size": a.get("size", "1K"), "ratio": a.get("ratio", "1:1"),
            "path": os.path.join(art_dir, _slug(a["need"]) + ".png"),
        })
    manifest_path = os.path.join(art_dir, "art_manifest.json")
    if not key:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(gen_list, f, ensure_ascii=False, indent=2)
        print(f"[offline] 未设 AGNES_API_KEY，只写生图清单: {manifest_path}")
        return manifest_path
    # 在线逐张生图（带重试，403/超时短退避）
    for g in gen_list:
        payload = {"model": "agnes-image-2.5-flash", "prompt": g["prompt"],
                   "size": g["size"], "ratio": g["ratio"], "return_base64": True}
        ok = False
        for attempt in range(1, 4):
            req = urllib.request.Request(api + "/images/generations",
                data=json.dumps(payload).encode(),
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                method="POST")
            try:
                with urllib.request.urlopen(req, timeout=300) as resp:
                    data = json.loads(resp.read())
                b64 = data.get("data", [{}])[0].get("b64_json", "")
                if b64:
                    import base64
                    with open(g["path"], "wb") as f:
                        f.write(base64.b64decode(b64))
                    g["status"] = "generated"
                    ok = True
                    break
            except urllib.error.HTTPError as e:
                g["status"] = f"HTTP {e.code}"
                if e.code in (402, 404) or attempt == 3:
                    break
                time.sleep(min(10, 2 ** attempt))
            except Exception as e:
                g["status"] = f"error: {type(e).__name__}"
                if attempt == 3:
                    break
                time.sleep(min(15, 2 ** attempt))
        if not ok and "status" not in g:
            g["status"] = "error"
        print(f"  [art] {g['need']}: {g.get('status')}")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(gen_list, f, ensure_ascii=False, indent=2)
    return manifest_path

def _slug(name):
    s = re.sub(r"[^\w\u4e00-\u9fff]+", "-", str(name).strip())
    return s or "game"

# ---------- 交互 ----------

def _pick(title, options, default_idx=0):
    """打印带序号选项，读 stdin 选择。"""
    print(f"\n{title}")
    for i, o in enumerate(options):
        label = o if isinstance(o, str) else json.dumps(o, ensure_ascii=False)
        print(f"  {i}. {label}")
    raw = input(f"选择 [0-{len(options)-1}] (默认 {default_idx}): ").strip()
    if not raw:
        return default_idx
    try:
        return int(raw)
    except ValueError:
        return default_idx

def interactive(idea=None):
    print("=== game-forge 交互模式 (减少描述, 用选择) ===")
    if not idea:
        idea = input("你的思路 (一句话): ").strip()
    rec = recommend(idea)
    if not rec["candidate_plans"]:
        print("未匹配到方案，请从候选里手动输入方案名或 0=自创")
    # Q2 选方案
    plan_opts = [p["name"] for p in rec["candidate_plans"]] + ["0=自创(跳过, 用思路直接生成)"]
    pi = _pick("Q2 选方案:", plan_opts)
    if pi < len(rec["candidate_plans"]):
        plan = get_plan(rec["candidate_plans"][pi]["id"])
    else:
        plan = {"id": "custom", "name": "自创", "genre": idea, "one_liner": idea,
                "core_loop": idea, "mechanics": [idea], "numbers": {},
                "needs": ["background", "hero", "enemy", "icon"]}
    # Q1 选参考游戏
    ref_opts = [g["name"] for g in rec["similar_games"]] + ["(不用参考)"]
    ri = _pick("Q1 选参考游戏:", ref_opts, default_idx=len(ref_opts) - 1)
    ref_game = get_game(rec["similar_games"][ri]["id"]) if ri < len(rec["similar_games"]) else None
    # Q3 选风格
    st_opts = [st["name"] for st in rec["style_options"]] + ["(用方案默认)"]
    si = _pick("Q3 选风格:", st_opts, default_idx=len(st_opts) - 1)
    style = get_style(rec["style_options"][si]["id"]) if si < len(rec["style_options"]) else (
        get_style(plan.get("default_style", "pixel-warm")) if plan.get("default_style") else None)
    design = build_plan(plan, style, ref_game)
    print(f"\n== 生成 H5 游戏: {plan['name']} ==")
    gp = generate_h5(design)
    print("  游戏:", gp)
    sp = save_plan(design, plan["name"])
    print("  设计:", sp)
    do_art = input("是否生图素材? (y/N): ").strip().lower()
    if do_art == "y":
        print("  生图清单:", gen_art(design))
    print("\n完成。直接浏览器打开:", gp)

# ---------- CLI ----------

def _resolve_plan(flag_val, idea):
    """按 flag 或检索拿方案。"""
    if flag_val:
        p = get_plan(flag_val)
        if p:
            return p
    plans = find_plans(idea)
    return plans[0][1] if plans else None

def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    cmd = args[0]
    rest = args[1:]

    def _flag(name, default=None):
        if name in rest:
            i = rest.index(name)
            if i + 1 < len(rest):
                return rest[i + 1]
        return default

    if cmd == "games":
        print("游戏库:")
        for g in GAMES:
            print(f"  [{g['id']}] {g['name']}  genre={g.get('genre')}  tags={g.get('tags')}")
    elif cmd == "recommend":
        idea = _flag("--idea") or (rest[0] if rest and not rest[0].startswith("--") else "")
        as_json = "--json" in rest
        if not idea and not as_json:
            idea = input("思路: ").strip()
        recommend(idea, as_json=as_json)
    elif cmd == "plan":
        idea = _flag("--idea", "")
        plan_val = _flag("--plan")
        style_val = _flag("--style")
        ref_val = _flag("--ref")
        p = get_plan(plan_val) if plan_val else _resolve_plan(None, idea)
        if not p:
            print("找不到方案，先运行 recommend 看候选"); return
        st = get_style(style_val) if style_val else (get_style(p.get("default_style")) if p.get("default_style") else None)
        ref = get_game(ref_val) if ref_val else None
        d = build_plan(p, st, ref)
        out = save_plan(d, p["name"])
        print("设计:", out)
        if "--json" in rest:
            print(json.dumps(d, ensure_ascii=False, indent=2))
    elif cmd == "generate":
        idea = _flag("--idea", "")
        plan_val = _flag("--plan")
        style_val = _flag("--style")
        ref_val = _flag("--ref")
        if not plan_val and "--interactive" not in rest:
            interactive(idea)
            return
        p = get_plan(plan_val) if plan_val else _resolve_plan(None, idea)
        if not p:
            print("找不到方案，先运行 recommend"); return
        st = get_style(style_val) if style_val else (get_style(p.get("default_style")) if p.get("default_style") else None)
        ref = get_game(ref_val) if ref_val else None
        d = build_plan(p, st, ref)
        gp = generate_h5(d)
        sp = save_plan(d, p["name"])
        print("游戏:", gp)
        print("设计:", sp)
        if "--gen-art" in rest:
            print("生图:", gen_art(d))
        if "--json" in rest:
            print(json.dumps({"game": gp, "plan": sp}, ensure_ascii=False))
    elif cmd in ("style-list", "styles"):
        kw = rest[0] if rest and not rest[0].startswith("--") else ""
        for st in find_styles(kw, top=10):
            s, item = st
            print(f"  [{item['id']}] {item['name']} ({item.get('art_style','')}) — {item.get('mood','')}")
            print(f"      配色: {item.get('palette_name','')} {item.get('palette',[])}")
            print(f"      prompt: {item.get('style_prompt','')[:120]}")
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
