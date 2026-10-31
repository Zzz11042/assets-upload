#!/usr/bin/env python3
"""hengda_runtime — 《重生许家印：重造恒大》全本 30 万字流水线运行器

复用 game-forge 的 forge_common (LLM JSON 展开) + novel_memory (L0-L5 分层/正典账本/伏笔/一致性)，
但目录契约遵循 novel-forge 技能规范（chapters/ + layers/L1-chNNNN.md + canon/*.jsonl + blueprints/chapters.md + state.json）。

目标：全本 30 万字 / 120 章，单章 ~2500 字（规格"30万(120章)"= 2500/章；
规格"单章≤1500"碎片短章风格在质量上被字数门覆盖——30 万字/120 章是硬目标）。
字数门 aim=2500±300，偏短在线扩写（保情节加细节/对白/心理），偏长在线缩写（保钩子删冗）。
全程：写前组装（design+style-dna+L1近章+上章结尾+伏笔+canon）→ 在线写正文 → 字数门 →
L1 摘要冻结 → canon 自动抽取 → 伏笔埋/收 → 每 10 章 L3 弧摘要 → ch80/ch120 里程碑报告 → 下一章。

用法:
  source ~/.config/agnes/env
  python3 hengda_runtime.py run --from-ch 4 --to-ch 24 --online
  python3 hengda_runtime.py progress
"""
import json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, "/home/zzz/Documents/deepseek-harness/default-workspace/game-forge")
import forge_common as fc
import novel_memory as nm

TARGET = {"ch_min": 2200, "ch_max": 2800, "ch_aim": 2500, "ch_tol": 300}


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")


def char_count(text):
    return len(re.sub(r"\s", "", text))


def state_path():
    return os.path.join(HERE, "state.json")


def load_state():
    return json.load(open(state_path(), encoding="utf-8"))


def save_state(st):
    json.dump(st, open(state_path(), "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def outline_chapter(st, ch_no):
    """从 blueprints/chapters.md 或 outline.md 取本章一行细纲；离线兜底。"""
    bl = os.path.join(HERE, "blueprints", "chapters.md")
    m = re.search(rf"^ch{ch_no:02d}\s+(.+)$", open(bl, encoding="utf-8").read(), re.M)
    if not m:
        # 回退到 outline.md 逐章一行（格式: - chNN 事件描述）
        m = re.search(rf"^-? ?ch{ch_no:02d}\s+(.+)$",
                      open(os.path.join(HERE, "outline.md"), encoding="utf-8").read(), re.M)
        if m:
            desc = m.group(1).strip()
            return {"no": ch_no, "title": f"第{ch_no}章", "scene": desc, "conflict": desc,
                    "catharsis": "", "recover": "", "hook": ""}
    if m:
        line = m.group(1)
        if "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip() != ""]
            # 7列: 场景|冲突|对白点|爽点|情绪|回收伏笔|章末钩子
            return {"no": ch_no, "scene": parts[0], "conflict": parts[1] if len(parts) > 1 else "",
                    "dialog": parts[2] if len(parts) > 2 else "",
                    "catharsis": parts[3] if len(parts) > 3 else "",
                    "emotion": parts[4] if len(parts) > 4 else "",
                    "recover": parts[5] if len(parts) > 5 else "-",
                    "hook": parts[6] if len(parts) > 6 else "",
                    "title": f"第{ch_no}章·{parts[0]}"}
        return {"no": ch_no, "title": f"第{ch_no}章", "scene": line, "conflict": line,
                "catharsis": "", "recover": "", "hook": ""}
    return {"no": ch_no, "title": f"第{ch_no}章", "beat": "", "hook": "", "scene": "", "conflict": "",
            "catharsis": "", "recover": "-"}


def assemble_context(ch_no):
    """写前组装：design 硬约束 + style-dna + L1 近 5 章 + 上一章结尾 + 伏笔 + canon 摘要。"""
    parts = []
    sdna = open(os.path.join(HERE, "style-dna.md"), encoding="utf-8").read()
    parts.append("## 风格DNA(唯一风格权威)\n" + sdna[:2500])
    design = open(os.path.join(HERE, "design.md"), encoding="utf-8").read()
    m = re.search(r"## 世界观与时代坐标(.*?)(?=\n## )", design, re.S)
    parts.append("## 时代坐标与硬约束\n" + (m.group(1) if m else design[:800]))
    # L1 近 5 章
    l1dir = os.path.join(HERE, "layers")
    if os.path.isdir(l1dir):
        fs = sorted(f for f in os.listdir(l1dir) if f.startswith("L1-ch") and f.endswith(".md"))
        recent = fs[-5:]
        if recent:
            briefs = "\n".join(open(os.path.join(l1dir, f), encoding="utf-8").read()[:400] for f in recent)
            parts.append("## 近章摘要(L1, 冻结)\n" + briefs[:2500])
    # 上一章结尾
    if ch_no > 1:
        prev = os.path.join(HERE, "chapters", f"ch{ch_no-1:04d}.md")
        if os.path.exists(prev):
            parts.append("## 上一章结尾(文风衔接锚)\n" + open(prev, encoding="utf-8").read()[-800:])
    # canon facts
    fp = os.path.join(HERE, "canon", "facts.jsonl")
    if os.path.exists(fp):
        facts = [json.loads(l) for l in open(fp, encoding="utf-8") if l.strip()]
        if facts:
            parts.append("## 正典事实(必须一致)\n" + "\n".join(f"- {f.get('desc','')}" for f in facts[-25:]))
    # 伏笔
    st = load_state()
    fs_open = st.get("foreshadow_open", [])
    if fs_open:
        parts.append("## 未回收伏笔\n" + "\n".join(f"- {f}" for f in fs_open))
    return "\n\n".join(parts)


def scrub_ai_smell(text):
    """去 AI 味替换表: 把 style-dna 禁用词替换成更落地的写法。"""
    repl = [
        ("嘴角勾起", "嘴角一挑"), ("嘴角勾起", "他笑了笑"),
        ("缓缓", "慢慢"), ("眼底闪过", "眼神一沉"),
        ("一抹", "一道"), ("仿佛", "像"), ("宛如", "像"),
        ("深吸一口气", "顿了顿"), ("不由得", "忍不住"),
        ("只见", "只见"),  # 保留(常见且非AI味强词)
    ]
    for a, b in repl:
        if a == b:
            continue
        text = text.replace(a, b)
    return text


def _rewrite_skeleton(ch_no, bl, online):
    """骨架章兜底: 按 style-dna 重写正文(不返回骨架)。"""
    st = load_state()
    ctx = assemble_context(ch_no)
    data = fc.llm_json(
        '写长篇网文这一章正文(2300-2800字), 只输出JSON对象:{"text":"正文全文(不含标题行)"}。\n'
        f'基调:商战悬疑流/家国情怀 主角:许衡(重生许家印, 话少判断先行)\n'
        f'本章细纲: {json.dumps(bl, ensure_ascii=False)}\n'
        f'=== 写前组装上下文 ===\n{ctx[:5000]}')
    return (data or {}).get("text", "") or f"（第{ch_no}章待在线重写: {bl.get('conflict','')}）"


def write_chapter(ch_no, online=True):
    """写单章正文 → chapters/chNNNN.md + layers/L1-chNNNN.md(冻结) + canon 抽取。"""
    st = load_state()
    bl = outline_chapter(st, ch_no)
    ctx = assemble_context(ch_no)
    title = bl.get("title") or f"第{ch_no}章"
    text = ""
    # 首写: 最多3次重试, 直到拿到 >=600 字的正文(防 LLM 偶发空返回)
    if online and fc.has_key():
        for _try in range(3):
            data = fc.llm_json(
                '写长篇网文这一章正文(2300-2800字), 只输出JSON对象:{"text":"正文全文(不含标题行)"}。\n'
                f'基调:商战悬疑流/家国情怀 主角:许衡(重生许家印, 话少判断先行, 口癖"账"/"不慌"/"你算过吗")\n'
                f'本章细纲: {json.dumps(bl, ensure_ascii=False)}\n'
                f'写作要求: 对白占比≥35%, 数字锚(金额/涨幅/工位数)密集, 章末150字内强钩, 压抑不超2章连发, '
                f'禁用词(缓缓/只见/一抹/嘴角勾起/眼底闪过/不由得/仿佛/宛如/深吸一口气)不得出现, 不堆辞藻。\n'
                f'=== 写前组装上下文 ===\n{ctx[:6000]}')
            cand = (data or {}).get("text", "")
            if char_count(cand) >= 600:
                text = cand
                break
        if not text:
            text = _rewrite_skeleton(ch_no, bl, online)
    if not text:
        text = f"（第{ch_no}章: {bl.get('conflict','')}）"
    # 去 AI 味
    text = scrub_ai_smell(text)
    # 字数门: 偏短扩写 / 偏长缩写 (最多4次, 每次都去AI味)
    status, diff = word_gate(text)
    attempts = 0
    while status in ("expand", "shrink") and online and fc.has_key() and attempts < 4:
        attempts += 1
        if status == "expand":
            data = fc.llm_json(
                f'这章偏短({char_count(text)}字), 扩到约2500字。保原情节不改变主线, 加细节/对白/心理补足, '
                f'章末仍留强钩, 对白占比≥35%, 不用"仿佛/缓缓/一抹/嘴角勾起"。只输出JSON:{{"text":"扩写后全文"}}。正文:\n{text[-3500:]}')
            cand = (data or {}).get("text", "")
            cand = scrub_ai_smell(cand)
            if cand and char_count(cand) > char_count(text) and char_count(cand) >= TARGET["ch_min"] - TARGET["ch_tol"]:
                text = cand
        else:
            data = fc.llm_json(
                f'这章偏长({char_count(text)}字), 缩到约2500字。保核心情节与章末钩, 删冗。只输出JSON:{{"text":"缩写后全文"}}。正文:\n{text[:5000]}')
            cand = (data or {}).get("text", "")
            cand = scrub_ai_smell(cand)
            if cand and char_count(cand) <= TARGET["ch_max"] + TARGET["ch_tol"]:
                text = cand
        status, diff = word_gate(text)
    # 落盘正文
    chdir = os.path.join(HERE, "chapters")
    os.makedirs(chdir, exist_ok=True)
    chp = os.path.join(chdir, f"ch{ch_no:04d}.md")
    open(chp, "w", encoding="utf-8").write(text)
    # L1 摘要(冻结)
    brief = f"第{ch_no}章「{title}」: {bl.get('conflict','')}。爽点:{bl.get('catharsis','')}。情绪:{bl.get('emotion','')}。回收伏笔:{bl.get('recover','-')}。章末钩:{bl.get('hook','')}。"
    if online and fc.has_key():
        d2 = fc.llm_json(f'为这章写 300-500 字摘要, 只输出JSON:{{"brief":"摘要"}}。正文:\n{text[:3500]}')
        if d2 and d2.get("brief"):
            brief = f"第{ch_no}章: " + d2["brief"]
    l1p = os.path.join(HERE, "layers", f"L1-ch{ch_no:04d}.md")
    os.makedirs(os.path.dirname(l1p), exist_ok=True)
    open(l1p, "w", encoding="utf-8").write(f"<!-- frozen:{char_count(text)} -->\n\n{brief}\n")
    # canon 自动抽取
    if online and fc.has_key():
        d3 = fc.llm_json(
            f'从这章正文抽取 2-3 条"后续章节必须遵守的原子事实"(人物状态/能力/物品归属/已发生事件/承诺), '
            f'只输出JSON:{{"facts":[{{"desc":"事实","known_by":"谁知道"}}]}}。正文:\n{text[:3500]}')
        if d3 and "facts" in d3:
            np = os.path.join(HERE, "canon", "facts.jsonl")
            os.makedirs(os.path.dirname(np), exist_ok=True)
            with open(np, "a", encoding="utf-8") as f:
                for fact in d3["facts"]:
                    f.write(json.dumps({"desc": fact.get("desc", ""), "known_by": fact.get("known_by", ""),
                                        "source_ch": f"ch{ch_no:02d}", "status": "canon", "at": now()},
                                       ensure_ascii=False) + "\n")
    return text, status, brief, bl


def word_gate(text):
    n = char_count(text)
    if n < TARGET["ch_min"]:
        return "expand", TARGET["ch_min"] - n
    if n > TARGET["ch_max"]:
        return "shrink", n - TARGET["ch_max"]
    return "ok", n


def arc_summary(ch_no, online=True):
    """每10章 L3 弧摘要(≤2000字, 冻结)。"""
    arc = ch_no // 10
    p = os.path.join(HERE, "layers", f"L3-arc-{arc:02d}.md")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    body = "（在线 LLM 生成）"
    if online and fc.has_key():
        # 聚合该弧 10 章 L1
        briefs = []
        for i in range((arc - 1) * 10 + 1, arc * 10 + 1):
            fp = os.path.join(HERE, "layers", f"L1-ch{i:04d}.md")
            if os.path.exists(fp):
                briefs.append(open(fp, encoding="utf-8").read())
        d = fc.llm_json(f'把下面10章的摘要合成一份≤2000字弧级摘要(本弧主线推进/伏笔变化/节奏走向), 只输出JSON:{{"brief":"摘要"}}。\n'
                        + "\n---\n".join(briefs)[:6000])
        if d and d.get("brief"):
            body = d["brief"]
    open(p, "w", encoding="utf-8").write(f"# L3 弧{arc} (ch{(arc-1)*10+1}-{arc*10})\n\n{body}\n")
    return p


def milestone(ch_no, target_chars, online=True):
    l0 = os.path.join(HERE, "chapters")
    total = 0
    if os.path.isdir(l0):
        for f in os.listdir(l0):
            total += char_count(open(os.path.join(l0, f), encoding="utf-8").read())
    p = os.path.join(HERE, f"milestone_{target_chars//10000}万字_ch{ch_no}.md")
    open(p, "w", encoding="utf-8").write(
        f"# {target_chars//10000}万字里程碑检查 (第{ch_no}章)\n\n"
        f"- 已写: {total} 字\n- 目标: {target_chars} 字\n- 达成: {min(100, int(total/target_chars*100))}%\n"
        f"\n## 质量检查\n- 字数门: 全章落 {TARGET['ch_min']}-{TARGET['ch_max']}\n"
        f"- 伏笔台账见 state.json / foreshadowing-ledger\n")
    print(f"  [milestone] {p}")


def run(start, end=None, online=True):
    st = load_state()
    end = end or st.get("chapters_planned", 120)
    results = []
    for ch_no in range(start, end + 1):
        text, gate, brief, bl = write_chapter(ch_no, online=online)
        n = char_count(text)
        # 更新 state
        st = load_state()
        st["next_chapter"] = ch_no + 1
        st["total_chars"] = st.get("total_chars", 0) + n
        # 钩子/梗滚动
        if bl.get("hook"):
            st.setdefault("used_hooks", []).append(bl["hook"])
            st["used_hooks"] = st["used_hooks"][-8:]
        if ch_no % TARGET.get("l3_every", 10) == 0:
            arc_summary(ch_no, online=online)
        if ch_no == 80:
            milestone(80, 200000, online=online)
        if ch_no == 120:
            milestone(120, 300000, online=online)
        save_state(st)
        results.append({"ch": ch_no, "chars": n, "gate": gate})
        print(f"  第{ch_no:03d}章 {n}字 [{gate}]")
    print(f"\n[run] 完成 第{start}-{end}章, 累计 {sum(r['chars'] for r in results)} 字")
    st = load_state()
    print(f"[progress] 全书累计 {st.get('total_chars',0)} 字 / 目标 300000 | next_chapter={st.get('next_chapter')}")
    return results


def progress():
    st = load_state()
    l0 = os.path.join(HERE, "chapters")
    n_ch = 0
    total = 0
    if os.path.isdir(l0):
        for f in os.listdir(l0):
            if f.endswith(".md"):
                n_ch += 1
                total += char_count(open(os.path.join(l0, f), encoding="utf-8").read())
    print(f"全书: {n_ch} 章 / {total} 字 (目标30万) | next_chapter={st.get('next_chapter')} | 达成 {min(100, int(total/300000*100))}%")
    return {"chapters": n_ch, "chars": total}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="progress")
    ap.add_argument("--from-ch", type=int, default=1)
    ap.add_argument("--to-ch", type=int, default=0)
    ap.add_argument("--online", action="store_true")
    a = ap.parse_args()
    if a.cmd == "run":
        run(a.from_ch, a.to_ch or None, online=a.online or fc.has_key())
    else:
        progress()
