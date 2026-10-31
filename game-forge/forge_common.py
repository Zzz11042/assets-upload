#!/usr/bin/env python3
"""forge_common — 统一引导式生成框架（跨领域）

把 Pavo 式的引导机制抽象成可复用引擎：
  1. 领域注册: register(kind, spec) 声明该领域的要素清单/选项库/缺口检查
  2. new: 一句话 → 需求卡片(字段按领域) + 设计要素 → 自动进入缺口引导
  3. guide: 缺口检查 → 针对性提问 → 写回 → refined
  4. refine: 按缺口补全字段
  5. generate: 按领域模板生成具体产物（游戏/短剧/小说/...）

各"forge"(drama_forge/game_forge_flow/novel_forge) 复用本引擎，只贡献
自己的 spec(要素定义+选项+生成器)，共享 引导完善 + 缺口检查 + 状态存储 逻辑。
"""
import json, os, re, datetime, sys, base64, urllib.request, urllib.error

def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

def slug(s):
    s = re.sub(r"[^\w\u4e00-\u9fff]+", "-", str(s)).strip("-")
    return s[:24] or "item"

# ---------- 领域注册 ----------
_REGISTRY = {}

def register(kind, spec):
    """spec 需含:
       fields: [(field, label, hint, required)]  需求卡片字段
       options: {field: [候选...]}              选择题选项库
       gaps:   [(field, needs_input_fn)]        缺口判定(哪些值算需补全)
       gen:     generator(state) → {产物名: 内容或路径}
       llm:     {expand_kind: prompt_template}  LLM 展开(可选)
    """
    _REGISTRY[kind] = spec
    return spec

def get(kind):
    return _REGISTRY.get(kind)

def kinds():
    return list(_REGISTRY.keys())

# ---------- LLM 调用 (可选, 离线退化) ----------
def has_key():
    return bool(os.environ.get("AGNES_API_KEY"))

def api_base():
    return os.environ.get("AGNES_API_BASE", "https://apihub.agnes-ai.com/v1").rstrip("/")

def llm_json(prompt):
    """在线: 让 LLM 只输出一个 JSON 对象; 离线/失败返回 None。带重试。"""
    if not has_key():
        return None
    import time
    key = os.environ["AGNES_API_KEY"]
    for att in range(3):
        try:
            req = urllib.request.Request(
                api_base() + "/chat/completions",
                data=json.dumps({"model": "agnes-3.0-flash",
                                 "messages": [{"role": "user", "content": prompt}]}).encode(),
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            d = json.loads(urllib.request.urlopen(req, timeout=90).read())
            c = d["choices"][0]["message"]["content"]
            if isinstance(c, list):
                c = " ".join(x.get("text", "") for x in c if isinstance(x, dict))
            m = re.search(r"\{.*\}", c, re.S)
            if not m:
                continue
            obj = json.loads(m.group(0))
            if "data" in obj and isinstance(obj["data"], dict):
                obj = obj["data"]
            return obj
        except Exception:
            time.sleep(min(10, 2 ** att))
    return None

# ---------- 缺口判定 ----------
def needs_input(v):
    """通用缺口: 空/None/占位标记。领域可覆盖。"""
    if v is None:
        return True
    s = str(v).strip()
    if not s:
        return True
    return ("占位" in s) or ("离线卡片" in s) or ("（未定" in s) or ("待补" in s)

# ---------- 状态存取 ----------
def _pdir(projects_root, item_slug):
    return os.path.join(projects_root, item_slug)

def save_state(projects_root, item_slug, state, state_file="state.json"):
    p = os.path.join(_pdir(projects_root, item_slug), state_file)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(state, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def load_state(projects_root, name, state_file="state.json"):
    """加载项目状态。state_file 允许 drama_forge 的 project.json。"""
    target = os.path.join(projects_root, name)
    if not os.path.isdir(target):
        target = os.path.join(projects_root, slug(name))
    if not os.path.isdir(target):
        for d in os.listdir(projects_root) if os.path.isdir(projects_root) else []:
            f = os.path.join(projects_root, d, state_file)
            if os.path.exists(f):
                st = json.load(open(f, encoding="utf-8"))
                if str(st.get("idea", "")).startswith(name[:6]) or st.get("slug") == name:
                    target = os.path.join(projects_root, d)
                    break
    p = os.path.join(target, state_file)
    if not os.path.exists(p):
        raise FileNotFoundError(f"项目 {name} 不存在（{projects_root} 下找 {state_file}）")
    return json.load(open(p, encoding="utf-8"))

# ---------- 引导完善（核心可复用机制） ----------
def guide(spec, state, interactive=True, json_out=False, projects_root=None, item_slug=None):
    """按领域 spec 检查缺口, 交互式逐项提问补全, 写回 state。
    返回补全后的 state。"""
    card = state.setdefault("card", {})
    gaps = []
    for f, label, hint, req in spec["fields"]:
        val = card.get(f)
        checker = spec.get("gaps", {}).get(f, needs_input)
        if checker(val):
            gaps.append((f, label, hint))
    if json_out:
        print(json.dumps({"card_status": "完整" if not gaps else f"缺 {len(gaps)} 项",
                          "card_gaps": [g[2] for g in gaps]}, ensure_ascii=False, indent=2))
        return state
    print("\n== 需求完善检查 ==")
    for f, label, _h, _r in spec["fields"]:
        v = card.get(f)
        mark = "✗" if any(g[0] == f for g in gaps) else "✓"
        print(f"  {mark} {label}: {v if v else '（未定）'}")
    if not gaps:
        print("  需求已完整，可直接进入生成。")
        return state
    if not interactive:
        print(f"  → 请回答以上 {len(gaps)} 项（或运行不带 --json 的交互引导）")
        return state
    print("\n逐项完善（输入你的答案，回车保留当前值）:")
    for f, label, hint in gaps:
        cur = card.get(f, "")
        q = f"  ? {label} — {hint}"
        if cur:
            q += f"\n    当前: {cur}"
        try:
            ans = input(q + "\n  > ").strip()
        except EOFError:
            break
        if ans:
            card[f] = ans
            state.setdefault("refine_log", []).append({"field": f, "value": ans, "at": now()})
    state["status"] = "refined"
    if projects_root and item_slug:
        sf = state.get("_state_file") or spec.get("_state_file") or "state.json"
        save_state(projects_root, item_slug, state, state_file=sf)
    print("需求已完善并保存。")
    return state

# ---------- 一键 new（卡片 + 设计 + 引导） ----------
def new_item(kind, idea, projects_root, online=False, json_out=False, guide=True, state_file="state.json"):
    spec = get(kind)
    if not spec:
        raise KeyError(f"未注册领域 {kind}, 可用: {kinds()}")
    slugd = slug(idea)
    card = _make_card(spec, idea)
    state = {"kind": kind, "idea": idea, "slug": slugd, "card": card,
             "status": "card", "created": now(), "design": {}, "_state_file": state_file}
    # 设计要素（各领域的 llm 展开或 fallback）
    state["design"] = _design(spec, idea, card)
    save_state(projects_root, slugd, state, state_file=state_file)
    if json_out:
        print(json.dumps({"card": card, "design": state["design"]}, ensure_ascii=False, indent=2))
    else:
        _print_card(spec, state)
        if guide:
            guide(spec, state, interactive=True, projects_root=projects_root, item_slug=slugd)
    return state

def _make_card(spec, idea):
    """LLM 展开卡片；离线按 spec 的 default 填。"""
    card = {}
    llm = spec.get("llm", {}).get("card")
    if llm and has_key():
        data = llm_json(llm.format(idea=idea))
        if data:
            card.update(data)
    # 离线: 从一句话里尽量自填 title/subject/tone/hero/hook，减少引导提问
    card["_idea"] = idea
    for f, label, hint, req in spec["fields"]:
        if f in card and card[f]:
            continue
        d = spec.get("defaults", {}).get(f)
        if f == "title" and not d:
            # 取创意前 10 字做工作标题
            card[f] = idea[:10]
        elif f in ("hero", "hook") and not d:
            # 离线: 用一句话创意本身当占位（不是"离线"标记, 引导不再追问）
            card[f] = idea
        elif req:
            card[f] = d or f"（待补全: {hint}）"
        else:
            card[f] = d or ""
    card["generated_at"] = now()
    return card

def _design(spec, idea, card):
    llm = spec.get("llm", {}).get("design")
    if llm and has_key():
        data = llm_json(llm.format(idea=idea, card=json.dumps(card, ensure_ascii=False)))
        if data:
            data["_source"] = "llm"
            return data
    fb = spec.get("design_fallback", {})
    fb["_source"] = "fallback"
    return fb

def _print_card(spec, state):
    c = state["card"]
    print("\n== 制作需求卡片 ==")
    for f, label, _h, _r in spec["fields"]:
        if c.get(f) is not None:
            print(f"  {label}: {c[f]}")
    if state.get("design"):
        print("\n== 设计要素 ==")
        for k, v in state["design"].items():
            if not k.startswith("_"):
                print(f"  {k}: {v}" if isinstance(v, (str, int, float)) else f"  {k}: {len(v) if hasattr(v,'__len__') else v}")

# ---------- 生成 ----------
def generate(kind, name, projects_root, online=True):
    spec = get(kind)
    state = load_state(projects_root, name)
    out = spec["gen"](state, online=online, projects_root=projects_root)
    state["generated"] = out
    state["status"] = "generated"
    save_state(projects_root, state["slug"], state)
    return out
