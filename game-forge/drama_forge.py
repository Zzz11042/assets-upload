#!/usr/bin/env python3
"""drama_forge — Pavo 式一键 AI 短剧引导创作 CLI

学 Pavo（Agnes AI 短剧平台）的"一键生成"模式：用户给一句话，系统引导式
一步步把创作做完，每步有确认 checkpoint，支持定向返工（只改指定镜头，
不推倒重来），最后合成成片。

引导式流程（每步输出 → 确认 → 下一步）:
  0. 需求卡片  一句话 → 标题/概梗/时长/画幅/拆分镜模式/视觉风格/补充说明
  1. 角色设计  自动出角色设定+图（素材快速引用，保证跨镜头一致性）
  2. 分镜拆解  拆 N 镜，每镜一句描述+运镜提示
  3. 关键帧    每镜出关键帧图（在线 agnes-image / 离线 prompt 清单）
  4. 逐镜视频  智能路由: 关键帧镜→keyframe模式, 角色镜→reference模式, 常规→text
  5. 定向返工  rework --shot N [--reason ...] 只重做第 N 镜
  6. 合成成片  ffmpeg 拼接 N 段 mp4 → 完整竖屏片（无 ffmpeg 则出拼接清单）
引导完善: new 后自动逐项检查需求缺口并提问；随时 `guide <项目名>` 复查/补全。

子命令:
  python3 drama_forge.py new "一句话创意" [--json]      # 走完 0-2 步到分镜
  python3 drama_forge.py show <项目名>                  # 看当前状态
  python3 drama_forge.py guide <项目名> [--json]        # 引导完善需求（缺口检查+逐项提问）
  python3 drama_forge.py keyframes <项目名> [--online]  # 步3: 出关键帧
  python3 drama_forge.py videos <项目名> [--online]     # 步4: 逐镜生成视频
  python3 drama_forge.py rework <项目名> --shot 2 --reason "头发要先好再吹跑"
  python3 drama_forge.py stitch <项目名>                # 步6: 合成
  python3 drama_forge.py card <一句话> [--json]         # 只出需求卡片
  python3 drama_forge.py list                           # 列项目

在线需: source ~/.config/agnes/env (AGNES_API_KEY/AGNES_API_BASE)
离线: 所有步退化为 prompt/清单输出，不阻断流程。
"""
import json, os, re, sys, datetime, argparse, hashlib, base64, shutil, subprocess, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECTS = os.path.join(HERE, "projects")
ROOT = os.path.dirname(HERE)  # workspace root，放 agnes_video_25_flash.py

# ---------- 通用 ----------
def _now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

def _slug(s):
    s = re.sub(r"[^\w\u4e00-\u9fff]+", "-", s).strip("-")
    return s[:24] or "project"

def _has_key():
    return bool(os.environ.get("AGNES_API_KEY"))

def _api_base():
    return os.environ.get("AGNES_API_BASE", "https://apihub.agnes-ai.com/v1").rstrip("/")

def _post_json(url, payload, key, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

# ---------- 注册到 forge_common (供统一入口 forge.py) ----------
import forge_common as fc
DRAMA_SPEC = {
    "fields": [
        ("title", "标题", "10字内", True),
        ("synopsis", "概梗", "30字内讲清谁在哪做什么", True),
        ("duration_sec", "时长(秒)", "4-60秒", True),
        ("aspect", "画幅", "9:16竖屏/16:9横屏/1:1", True),
        ("visual_style", "视觉风格", "电影感/日系动漫/水墨/像素…", True),
        ("content_type", "内容类型", "搞笑/情绪/反转/宣传/广告/爽剧", True),
        ("notes", "补充说明", "参考作品/目标平台/禁忌", False),
    ],
    "defaults": {"aspect": "9:16", "content_type": "通用短剧", "duration_sec": 6},
    "llm": {
        "card": '把下面一句话需求整理成短剧制作需求卡片,只输出JSON对象:{"title":标题,"synopsis":30字内概梗,"duration_sec":总时长秒数4-60整数,"aspect":画幅如9:16,"shot_mode":拆分镜模式,"visual_style":视觉风格一句话,"content_type":内容类型,"notes":补充说明}。一句话需求: {idea}',
        "design": '为这个短剧设计主要角色/场景/道具,只输出JSON对象:{"characters":[{"name":名,"look":外形描述}],"scenes":[{"name":名,"desc":描述}],"props":[{"name":名,"desc":描述}]}。需求卡片: {card}',
    },
    "design_fallback": {
        "characters": [{"name": "主角", "look": "（离线占位）"}],
        "scenes": [{"name": "主场景", "desc": "（离线占位）"}], "props": [],
    },
}
fc.register("drama", DRAMA_SPEC)

# ---------- LLM (可选, 用来把一句话展开成需求卡片/分镜) ----------
def _llm_expand(idea, kind):
    """kind: card|storyboard|character。在线用 agnes-3.0-flash 展开；离线返回 None。
    带重试 + 兼容 {"data":{...}} 包装与直接 {...} 两种返回。"""
    if not _has_key():
        return None
    prompts = {
        "card": f"把下面一句话需求整理成短剧制作需求卡片,只输出JSON对象(不要解释):{{\"title\":标题,\"synopsis\":30字内概梗,\"duration_sec\":总时长秒数4-60整数,\"aspect\":画幅如9:16,\"shot_mode\":拆分镜模式,\"visual_style\":视觉风格一句话,\"content_type\":内容类型如搞笑短剧/情绪剧情/反转故事/宣传片/广告片/爽剧,\"notes\":补充说明\"}}。一句话需求: {idea}",
        "storyboard": f"把这个短剧需求拆成镜头分镜脚本,只输出JSON对象:{{\"shots\":[{{\"id\":1,\"desc\":一句镜头描述,\"camera\":运镜提示,\"style\":画面风格词}}]}}共4-8镜。需求: {idea}",
        "character": f"为这个短剧设计主要角色/场景/道具,只输出JSON对象:{{\"characters\":[{{\"name\":名,\"look\":外形描述\"}}],\"scenes\":[{{\"name\":名,\"desc\":描述\"}}],\"props\":[{{\"name\":名,\"desc\":描述\"}}]}}。需求: {idea}",
    }
    p = prompts.get(kind, prompts["card"])
    import time
    for attempt in range(3):
        try:
            d = _post_json(_api_base() + "/chat/completions",
                {"model": "agnes-3.0-flash", "messages": [{"role": "user", "content": p}]},
                os.environ["AGNES_API_KEY"], timeout=90)
            content = d["choices"][0]["message"]["content"]
            if isinstance(content, list):
                content = " ".join(x.get("text", "") for x in content if isinstance(x, dict))
            # 兼容外层 {"status":"ok","data":{...}} 包装
            m = re.search(r"\{.*\}", content, re.S)
            if not m:
                continue
            obj = json.loads(m.group(0))
            if "data" in obj and isinstance(obj["data"], dict):
                obj = obj["data"]
            return obj
        except Exception:
            time.sleep(min(10, 2 ** attempt))
    return None

# ---------- 步0: 需求卡片 ----------
TYPE_HINTS = [
    ("搞笑短剧", "搞笑", "夸张,反差,梗"),
    ("情绪剧情", "情绪", "节奏慢,留白,配乐"),
    ("反转故事", "反转", "前铺垫,后反转,伏笔"),
    ("宣传片", "宣传", "大气,品牌调性,收束干净"),
    ("广告片", "广告", "产品露出,卖点前置,CTA结尾"),
    ("爽剧", "爽", "打脸,逆袭,节奏快"),
]

def make_card(idea):
    """一句话 → 制作需求卡片。在线 LLM 展开；离线按关键词推断。"""
    card = _llm_expand(idea, "card") if _has_key() else None
    if not card:
        dur = 6
        for d in range(4, 61, 2):
            if idea.count("秒") and str(d) in idea:
                dur = d
                break
        mood = "通用"
        for name, kw, tag in TYPE_HINTS:
            if any(c in idea for c in [kw]):
                mood = name
                break
        card = {
            "title": _slug(idea) or idea[:12],
            "synopsis": idea[:40],
            "duration_sec": dur,
            "aspect": "9:16",
            "shot_mode": "自动4-6镜",
            "visual_style": "电影感写实",
            "content_type": mood,
            "notes": "（离线卡片，建议在线用 LLM 细化）",
        }
    card.setdefault("content_type", mood_hint(idea))
    card["generated_at"] = _now()
    return card

def mood_hint(idea):
    for name, kw, _ in TYPE_HINTS:
        if kw in idea:
            return name
    return "通用短剧"

# ---------- 步1: 角色/场景/道具设计 ----------
def make_character_design(idea, card):
    d = _llm_expand(idea, "character") if _has_key() else None
    if not d:
        d = {"characters": [{"name": "主角", "look": "（离线占位，在线用 LLM 生成角色外形）"}],
             "scenes": [{"name": "主场景", "desc": "（离线占位）"}],
             "props": []}
    d["_source"] = "llm" if _has_key() else "fallback"
    # 每个角色给出生图 prompt（素材快速引用: 同一角色图被多镜复用）
    for c in d.get("characters", []):
        c["image_prompt"] = f"short drama character design sheet, {c.get('look','generic character')}, full body front view, consistent appearance, {card.get('visual_style','cinematic')}, game/short-drama asset"
    for s in d.get("scenes", []):
        s["image_prompt"] = f"short drama scene key art, {s.get('desc','generic scene')}, {card.get('visual_style','cinematic')}, wide establishing shot"
    for p in d.get("props", []):
        p["image_prompt"] = f"short drama prop, {p.get('desc','generic prop')}, product close-up, {card.get('visual_style','cinematic')}"
    return d

# ---------- 步2: 分镜拆解 ----------
def make_storyboard(idea, card):
    sb = _llm_expand(idea, "storyboard") if _has_key() else None
    shots = sb.get("shots") if sb and isinstance(sb, dict) and "shots" in sb else None
    if not shots:
        n = 5
        dur = int(card.get("duration_sec", 6))
        per = max(4, dur // n)
        shots = [{"id": i + 1,
                  "desc": f"镜头{i+1}: {card.get('synopsis', idea)}第{i+1}段",
                  "camera": "固定/缓推", "style": card.get("visual_style", "")}
                 for i in range(n)]
    for sh in shots:
        sh.setdefault("camera", "缓推")
        sh.setdefault("style", card.get("visual_style", ""))
        sh["video_mode"] = _route_mode(sh)
    return shots

def _route_mode(shot):
    """智能模型路由: 按镜头描述选生成方式（Pavo 的智能路由借鉴）。
    角色/连续动作→keyframe(首尾帧); 多角色参考→reference; 常规→text。"""
    desc = (shot.get("desc", "") + shot.get("camera", "")).lower()
    if any(k in desc for k in ("跑", "跳", "追", "打斗", "挥", "动作", "运镜", "move", "run", "fight")):
        return "keyframe"   # 强调运动衔接
    if any(k in desc for k in ("角色", "人物", "主角", "一致", "character", "consist")):
        return "reference"  # 角色一致性优先
    return "text"

# ---------- 引导完善: 检查需求缺口 + 针对性提问 ----------
CARD_FIELDS = [
    ("title", "标题", "10字内吸引眼球的短剧标题"),
    ("synopsis", "概梗", "30字内讲清: 谁在什么场景做什么，冲突/卖点是什么"),
    ("duration_sec", "时长(秒)", "单镜4-12秒，4-60秒区间，影响拆镜数量"),
    ("aspect", "画幅", "9:16竖屏(抖音) / 16:9横屏 / 1:1方屏"),
    ("shot_mode", "拆分镜模式", "自动 / 手动指定镜头数"),
    ("visual_style", "视觉风格", "电影感写实 / 日系动漫 / 水墨国风 / 像素 / 赛博霓虹…"),
    ("content_type", "内容类型", "搞笑短剧 / 情绪剧情 / 反转故事 / 宣传片 / 广告片 / 爽剧"),
    ("notes", "补充说明", "参考作品、禁忌、目标平台(抖音/视频号/B站)、投放预算"),
]

def _needs_input(v, default_hint=""):
    """需求是否还需要创作者补充（Pavo 的"确认无误再往下"原则）。
    只有 None/空串/明确的占位标记才算缺口；正常内容再短也不追问。"""
    if v is None:
        return True
    s = str(v).strip()
    if not s:
        return True
    return ("占位" in s) or ("离线卡片" in s) or ("（未定" in s)

def card_gaps(proj):
    """返回 [(field, 标签, 引导问句), ...] 缺失或不完整的卡片字段。"""
    c = proj.get("card", {})
    gaps = []
    for f, label, hint in CARD_FIELDS:
        if _needs_input(c.get(f)):
            gaps.append((f, label, f"请明确{label}: {hint}"))
    return gaps

def shot_gaps(proj):
    """分镜层面: 缺运镜提示 / 角色未定义的镜头。"""
    gaps = []
    defined = {c.get("name", "") for c in proj.get("characters", {}).get("characters", [])}
    for s in proj.get("shots", []):
        if not s.get("camera") or s.get("camera") == "缓推":
            gaps.append(f"镜{s['id']} 运镜太笼统，建议指定: 特写/中景/远景 + 推/拉/摇/固定/手持")
        # 角色一致性: 镜头提到角色但角色表没定义
        for d in defined:
            if d and d not in str(s.get("desc", "")):
                pass
    return gaps[:8]

def guide_refine(proj, interactive=True, json_out=False):
    """引导式完善需求: 显示已定/未定，逐项问创作者，写回卡片。"""
    gaps = card_gaps(proj)
    shot_gs = shot_gaps(proj)
    status = "完整" if not gaps else f"缺 {len(gaps)} 项"
    if json_out:
        print(json.dumps({"card_status": status, "card_gaps": [g[2] for g in gaps],
                          "shot_gaps": shot_gs}, ensure_ascii=False, indent=2))
        return
    print("\n== 需求完善检查 ==")
    c = proj["card"]
    for f, label, _h in CARD_FIELDS:
        v = c.get(f)
        mark = "✗" if _needs_input(v) else "✓"
        print(f"  {mark} {label}: {v if v else '（未定）'}")
    if shot_gs:
        print("  [分镜] " + " | ".join(shot_gs[:3]))
    if not gaps:
        print("  需求已完整，可直接进入关键帧/视频生成。")
        return
    if not interactive:
        print(f"  → 请回答以上 {len(gaps)} 项，或: {os.path.basename(__file__)} card <新需求> --json 看当前卡片")
        return
    # 逐项引导（创作者可输入答案 或 回车保留当前值）；EOF(管道断)不崩溃
    print("\n逐项完善（输入你的答案，回车保留当前值）:")
    for f, label, hint in gaps:
        cur = proj["card"].get(f, "")
        q = f"  ? {label} — {hint}"
        if cur:
            q += f"\n    当前: {cur}"
        try:
            ans = input(q + "\n  > ").strip()
        except EOFError:
            break
        if ans:
            proj["card"][f] = ans
            proj.setdefault("refine_log", []).append({"field": f, "value": ans, "at": _now()})
    # 分镜运镜细化（可选）
    try:
        do_camera = input("\n是否细化各镜运镜? [y/N]: ").strip().lower() == "y"
    except EOFError:
        do_camera = False
    if do_camera:
        for s in proj["shots"]:
            cur = s.get("camera", "")
            try:
                ans = input(f"  镜{s['id']} 运镜（当前: {cur}），回车保留: ").strip()
            except EOFError:
                break
            if ans:
                s["camera"] = ans
                s["video_mode"] = _route_mode(s)
    _save(_pdir(proj), proj)
    proj["status"] = "refined"
    print("需求已完善并保存。可继续: keyframes --online / videos --online / rework")

# ---------- 项目存取 ----------
def new_project(idea, online=False, json_out=False, guide=True):
    slug = _slug(idea)
    pdir = os.path.join(PROJECTS, slug)
    os.makedirs(pdir, exist_ok=True)
    card = make_card(idea)
    char = make_character_design(idea, card)
    shots = make_storyboard(idea, card)
    proj = {"idea": idea, "slug": slug, "card": card, "characters": char,
            "shots": shots, "keyframes": {}, "videos": {},
            "rework": [], "status": "storyboard", "created": _now()}
    _save(pdir, proj)
    _print_card(proj, json_out)
    _print_shots(proj, json_out)
    if guide and not json_out:
        guide_refine(proj, interactive=True)
    return proj

def _save(pdir, proj):
    with open(os.path.join(pdir, "project.json"), "w", encoding="utf-8") as f:
        json.dump(proj, f, ensure_ascii=False, indent=2)

def _load(name):
    pdir = os.path.join(PROJECTS, _slug(name) if not os.path.exists(os.path.join(PROJECTS, name)) else name)
    if not os.path.isdir(pdir):
        for d in os.listdir(PROJECTS) if os.path.isdir(PROJECTS) else []:
            f = os.path.join(d, "project.json")
            if os.path.exists(f) and json.load(open(f, encoding="utf-8")).get("idea", "").startswith(name[:6]):
                pdir = os.path.join(PROJECTS, d)
                break
    p = os.path.join(pdir, "project.json")
    if not os.path.exists(p):
        sys.exit(f"[error] 项目 {name} 不存在（可用 drama_forge.py list 看）")
    return json.load(open(p, encoding="utf-8"))

def _pdir(proj):
    return os.path.join(PROJECTS, proj["slug"])

def _print_card(proj, json_out):
    c = proj["card"]
    if json_out:
        print(json.dumps({"card": c, "characters": proj["characters"]}, ensure_ascii=False, indent=2))
        return
    print("\n== 制作需求卡片 ==")
    for k, label in [("title", "标题"), ("synopsis", "概梗"), ("duration_sec", "时长(秒)"),
                     ("aspect", "画幅"), ("shot_mode", "拆分镜模式"), ("visual_style", "视觉风格"),
                     ("content_type", "内容类型"), ("notes", "补充")]:
        if c.get(k) is not None:
            print(f"  {label}: {c[k]}")
    print("\n== 角色/场景/道具设计 ==")
    for c0 in proj["characters"].get("characters", []):
        print(f"  角色[{c0['name']}]: {c0.get('look','')}")
        print(f"    生图prompt: {c0.get('image_prompt','')[:70]}")

def _print_shots(proj, json_out):
    if json_out:
        return
    print(f"\n== 分镜脚本 ({len(proj['shots'])} 镜) ==")
    for s in proj["shots"]:
        print(f"  镜{s['id']} [{s.get('video_mode','text')}]: {s.get('desc','')}")
        print(f"       运镜: {s.get('camera','')}  风格: {s.get('style','')}")

# ---------- 步3: 关键帧 ----------
def gen_keyframes(proj, online=True):
    pdir = _pdir(proj)
    kf_dir = os.path.join(pdir, "keyframes")
    os.makedirs(kf_dir, exist_ok=True)
    if "shots" not in proj or not proj["shots"]:
        proj["shots"] = make_storyboard(proj.get("idea", ""), proj.get("card", {}))
        proj.setdefault("keyframes", {})
        proj.setdefault("videos", {})
        _save(pdir, proj)
    results = []
    for s in proj["shots"]:
        prompt = f"short drama keyframe, shot {s['id']}: {s.get('desc','')}, {s.get('style','cinematic')}, {proj['card'].get('aspect','9:16')}, 16:9 frame"
        path = os.path.join(kf_dir, f"shot_{s['id']}.png")
        item = {"shot": s["id"], "prompt": prompt, "path": path}
        if online and _has_key():
            import time as _t
            for _att in range(1, 4):
                try:
                    d = _post_json(_api_base() + "/images/generations",
                        {"model": "agnes-image-2.5-flash", "prompt": prompt,
                         "size": "1K", "ratio": "16:9", "return_base64": True},
                        os.environ["AGNES_API_KEY"], timeout=300)
                    b64 = d.get("data", [{}])[0].get("b64_json", "")
                    if b64:
                        with open(path, "wb") as f:
                            f.write(base64.b64decode(b64))
                        item["status"] = "generated"
                        break
                    item["status"] = "no-b64"
                    break
                except Exception as e:
                    item["status"] = f"error:{type(e).__name__}"
                    if _att == 3:
                        break
                    _t.sleep(min(10, 2 ** _att))
        else:
            item["status"] = "prompt-only"
        results.append(item)
        print(f"  [kf] 镜{s['id']}: {item['status']}")
    proj["keyframes"] = {str(r["shot"]): r for r in results}
    proj["status"] = "keyframes"
    _save(pdir, proj)
    return proj

# ---------- 步4: 逐镜视频 ----------
def gen_videos(proj, online=True):
    pdir = _pdir(proj)
    vdir = os.path.join(pdir, "videos")
    os.makedirs(vdir, exist_ok=True)
    if "shots" not in proj or not proj["shots"]:
        proj["shots"] = make_storyboard(proj.get("idea", ""), proj.get("card", {}))
        proj.setdefault("keyframes", {})
        proj.setdefault("videos", {})
        _save(pdir, proj)

    sys.path.insert(0, ROOT)
    import agnes_video_25_flash as av
    results = []
    for s in proj["shots"]:
        path = os.path.join(vdir, f"shot_{s['id']}.mp4")
        item = {"shot": s["id"], "path": path, "mode": s.get("video_mode", "text"),
                 "prompt": f"shot {s['id']}: {s.get('desc','')}, {s.get('camera','')}, {s.get('style','cinematic')}"}
        if online and _has_key():
            mode = s.get("video_mode", "text")
            try:
                if mode == "keyframe":
                    kf = proj.get("keyframes", {}).get(str(s["id"]), {})
                    ff = kf.get("path")
                    lf = proj.get("keyframes", {}).get(str(s["id"] + 1), {}).get("path")
                    r = av.generate(item["prompt"], seconds="5", aspect_ratio=proj["card"].get("aspect", "9:16").replace(":", ":"),
                                    mode="keyframe" if ff else "text",
                                    first_frame=ff, last_frame=lf, out_path=path, download=True)
                else:
                    r = av.generate(item["prompt"], seconds="5",
                                    aspect_ratio=proj["card"].get("aspect", "9:16").replace(":", ":"),
                                    mode="text", out_path=path, download=True)
                item["status"] = r.get("status")
                item["video_id"] = r.get("video_id")
            except Exception as e:
                item["status"] = f"error:{type(e).__name__}"
        else:
            item["status"] = "prompt-only"
        results.append(item)
        print(f"  [vid] 镜{s['id']}({item['mode']}): {item['status']}")
    proj["videos"] = {str(r["shot"]): r for r in results}
    proj["status"] = "videos"
    _save(pdir, proj)
    return proj

# ---------- 步5: 定向返工 ----------
def rework_shot(proj, shot_id, reason, online=True):
    pdir = _pdir(proj)
    if "shots" not in proj or not proj["shots"]:
        proj["shots"] = make_storyboard(proj.get("idea", ""), proj.get("card", {}))
        proj.setdefault("keyframes", {})
        proj.setdefault("videos", {})
        _save(pdir, proj)
    s = next((x for x in proj["shots"] if x["id"] == shot_id), None)
    if not s:
        sys.exit(f"[error] 镜{shot_id} 不存在")
    old = s.get("desc", "")
    s["desc"] = f"{old}。返工要求: {reason}"
    if reason:
        s.setdefault("rework_reasons", []).append({"reason": reason, "at": _now()})
    proj.setdefault("rework", []).append({"shot": shot_id, "reason": reason, "at": _now(), "old": old})
    # 只重做这一镜的关键帧+视频
    for key in ("keyframes", "videos"):
        proj[key].pop(str(shot_id), None)
    _save(pdir, proj)
    if online:
        print(f"[rework] 重做 镜{shot_id}: 关键帧+视频")
        _regen_one(proj, shot_id, keyframes=True)
        _regen_one(proj, shot_id, keyframes=False, online=online)
    else:
        print(f"[rework] 镜{shot_id} 已标记返工（离线，在线跑 keyframes/videos 时自动重做）")
    return proj

def _regen_one(proj, shot_id, keyframes, online=True):
    pdir = _pdir(proj)
    s = next((x for x in proj["shots"] if x["id"] == shot_id), None)
    if keyframes:
        prompt = f"short drama keyframe, shot {s['id']} (rework): {s.get('desc','')}, {s.get('style','cinematic')}"
        path = os.path.join(pdir, "keyframes", f"shot_{shot_id}.png")
        item = {"shot": shot_id, "prompt": prompt, "path": path}
        if online and _has_key():
            try:
                d = _post_json(_api_base() + "/images/generations",
                    {"model": "agnes-image-2.5-flash", "prompt": prompt, "size": "1K", "ratio": "16:9", "return_base64": True},
                    os.environ["AGNES_API_KEY"], timeout=300)
                b64 = d.get("data", [{}])[0].get("b64_json", "")
                if b64:
                    open(path, "wb").write(base64.b64decode(b64))
                    item["status"] = "generated"
                else:
                    item["status"] = "no-b64"
            except Exception as e:
                item["status"] = f"error:{type(e).__name__}"
        else:
            item["status"] = "prompt-only"
        proj["keyframes"][str(shot_id)] = item
    else:
        pdir = _pdir(proj)
        import agnes_video_25_flash as av
        path = os.path.join(pdir, "videos", f"shot_{shot_id}.mp4")
        item = {"shot": shot_id, "path": path, "mode": s.get("video_mode", "text"),
                "prompt": f"shot {s['id']}: {s.get('desc','')} (rework)"}
        if online and _has_key():
            try:
                r = av.generate(item["prompt"], seconds="5", mode="text", out_path=path, download=True)
                item["status"] = r.get("status")
            except Exception as e:
                item["status"] = f"error:{type(e).__name__}"
        else:
            item["status"] = "prompt-only"
        proj["videos"][str(shot_id)] = item
    _save(pdir, proj)
    return item

# ---------- 步6: 合成成片 ----------
def stitch(proj):
    pdir = _pdir(proj)
    vdir = os.path.join(pdir, "videos")
    if "shots" not in proj or not proj["shots"]:
        proj["shots"] = make_storyboard(proj.get("idea", ""), proj.get("card", {}))
        _save(pdir, proj)
    mp4s = [os.path.join(vdir, f"shot_{s['id']}.mp4") for s in proj["shots"]
            if os.path.exists(os.path.join(vdir, f"shot_{s['id']}.mp4"))]
    out = os.path.join(pdir, "final.mp4")
    if not mp4s:
        print(f"[stitch] 没有可用 mp4（先跑 videos 在线生成）。已列拼接清单:")
        lst = os.path.join(pdir, "stitch_list.txt")
        with open(lst, "w") as f:
            for s in proj["shots"]:
                f.write(f"shot_{s['id']}.mp4\n")
        print("  " + lst)
        proj["status"] = "stitch-manifest"
        _save(pdir, proj)
        return proj
    if shutil.which("ffmpeg"):
        concat = os.path.join(pdir, "concat.txt")
        with open(concat, "w") as f:
            for m in mp4s:
                f.write(f"file '{m}'\n")
        subprocess.run(["ffmpeg", "-y", "-f", "concat", "-i", concat, "-c", "copy", out],
                       check=True, capture_output=True)
        proj["final"] = out
        proj["status"] = "stitched"
        print(f"[stitch] 成片: {out} ({len(mp4s)} 镜)")
    else:
        lst = os.path.join(pdir, "stitch_list.txt")
        with open(lst, "w") as f:
            for m in mp4s:
                f.write(m + "\n")
        proj["status"] = "stitch-manifest"
        print(f"[stitch] 无 ffmpeg，已列拼接清单: {lst}\n  手动: ffmpeg -f concat -i stitch_list.txt -c copy final.mp4")
    _save(pdir, proj)
    return proj

# ---------- CLI ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="list")
    ap.add_argument("arg", nargs="?", default="")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--online", action="store_true")
    ap.add_argument("--shot", type=int)
    ap.add_argument("--reason", default="")
    args = ap.parse_args()

    if args.cmd == "new":
        if not args.arg:
            sys.exit("用法: drama_forge.py new <一句话创意>")
        new_project(args.arg, online=args.online, json_out=args.json)
    elif args.cmd == "card":
        c = make_card(args.arg)
        print(json.dumps(c, ensure_ascii=False, indent=2) if args.json else
              "\n".join(f"  {k}: {v}" for k, v in c.items()))
    elif args.cmd == "show":
        p = _load(args.arg)
        _print_card(p, args.json)
        _print_shots(p, args.json)
        print(f"\n状态: {p['status']} | 关键帧: {len(p.get('keyframes', {}))} | 视频: {len(p.get('videos', {}))}")
        for r in p.get("rework", []):
            print(f"  返工: 镜{r.get('shot')} ({r.get('at')}) {r.get('reason','')}")
    elif args.cmd == "guide":
        p = _load(args.arg)
        guide_refine(p, interactive=not args.json, json_out=args.json)
    elif args.cmd == "keyframes":
        p = gen_keyframes(_load(args.arg), online=args.online or _has_key())
        print("关键帧完成")
    elif args.cmd == "videos":
        p = gen_videos(_load(args.arg), online=args.online or _has_key())
        print("逐镜视频完成")
    elif args.cmd == "rework":
        p = _load(args.arg)
        rework_shot(p, args.shot, args.reason, online=args.online or _has_key())
    elif args.cmd == "stitch":
        p = _load(args.arg)
        stitch(p)
    elif args.cmd == "list":
        if not os.path.isdir(PROJECTS):
            print("（暂无项目）")
            return
        for d in sorted(os.listdir(PROJECTS)):
            f = os.path.join(PROJECTS, d, "project.json")
            if os.path.exists(f):
                p = json.load(open(f, encoding="utf-8"))
                print(f"  {d}  [{p.get('status','?')}]  {p.get('idea','')[:30]}")
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
