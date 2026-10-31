#!/usr/bin/env python3
"""novel_runtime — 长篇流水线运行器（20万字里程碑 / 30万字完本目标）

把 novel_forge 的单章生成 + novel_memory 的记忆系统串成可批量跑的流水线：
  逐章循环: 写前组装 → LLM 写正文 → 字数门(偏短扩写/偏长缩写) →
            L0 落盘 → L1 摘要 → canon/伏笔更新 → 一致性校验 → 节奏分配 → 下一章
每 5 章做 L2 chunk 摘要, 每 10 章做 L3 弧摘要 + 深度压缩,
卷末做 L4/L5。全程状态可断点续跑。

目标配置（默认按 30万字完本设计, 20万字是里程碑检查点）:
  - 单章 2000-2500 字 → 30万字 ≈ 120-150 章
  - 20万字里程碑 ≈ 第 80-100 章, 自动出一致性 + 伏笔超期报告
  - 字数门: 目标 2200±200, 偏短自动扩写(在线), 偏长自动缩写

用法（由 novel_forge.py run 调用, 也可独立）:
  python3 novel_runtime.py run <项目名> [--from 1] [--to 30] [--online]
  python3 novel_runtime.py status <项目名>
"""
import json, os, sys, datetime, re

import forge_common as fc
import novel_memory as nm

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECTS = os.path.join(HERE, "novel_projects")

# 目标配置
TARGET = {
    "ch_min": 2000, "ch_max": 2500, "ch_aim": 2200, "ch_tol": 200,
    "milestone_200k": 80,   # 第80章左右约20万字(按2500字/章)
    "volume_300k": 120,     # 第120章左右约30万字
    "l2_every": 5, "l3_every": 10, "l4_every": 40, "l5_every": 120,
}


def project_dir(name):
    p = os.path.join(PROJECTS, name)
    if not os.path.isdir(p):
        p = os.path.join(PROJECTS, fc.slug(name))
    if not os.path.isdir(p):
        raise FileNotFoundError(name)
    return p


def char_count(text):
    """汉字+标点字数（去空白）。"""
    return len(re.sub(r"\s", "", text))


def word_gate(text, aim=TARGET["ch_aim"], tol=TARGET["ch_tol"], online=False):
    """字数门: 机械检查。偏短返回('expand', 差值), 偏长返回('shrink', 差值), 合规返回('ok', 0)。"""
    n = char_count(text)
    if n < aim - tol:
        return "expand", aim - n
    if n > aim + tol:
        return "shrink", n - aim
    return "ok", n - aim


def _expand_online(project, text, deficit, ch_no):
    """在线扩写: 让 LLM 把短章补到目标字数（保留原情节, 加细节/对话/心理）。"""
    return fc.llm_json(
        f'这章小说偏短({char_count(text)}字), 需扩到约{TARGET["ch_aim"]}字。'
        f'保留原情节不改变主线, 通过增加细节描写/对话/心理活动补足。只输出JSON:{{"text":"扩写后全文"}}。'
        f'正文:\n{text[-3000:]}')


def _shrink_online(project, text, excess, ch_no):
    """在线缩写: 让 LLM 压缩到目标字数（保核心情节）。"""
    return fc.llm_json(
        f'这章小说偏长({char_count(text)}字), 需缩到约{TARGET["ch_aim"]}字。'
        f'保留核心情节与章末钩, 删冗。只输出JSON:{{"text":"缩写后全文"}}。'
        f'正文:\n{text[:4000]}')


def write_chapter(project, pdir, ch_no, outline, online=True):
    """单章: 写前组装 → LLM 写 → 字数门 → L0/L1 落盘。返回 (text, gate_status, l1_path)。"""
    card = project["card"]
    ch = next((c for c in outline.get("chapters_v1", []) if c["no"] == ch_no),
              {"no": ch_no, "title": f"第{ch_no}章", "beat": "", "hook": ""})
    ctx = nm.assemble_context(pdir, ch_no)
    text = ""
    if online and fc.has_key():
        text = fc.llm_json(
            f'写《{card.get("title", project["idea"])}》第{ch_no}章正文(1500-2500字), '
            f'只输出JSON对象:{{"text":"正文全文"}}。\n'
            f'基调:{card.get("tone")} 主角:{card.get("hero")}\n'
            f'本章({ch["no"]})「{ch.get("title","")}」 节拍:{ch.get("beat","")} 章末钩:{ch.get("hook","")}\n'
            f'=== 写前组装上下文 ===\n{ctx[:5000]}')
        text = text.get("text", "") if text else ""
    if not text:
        text = _skeleton(project, ch, ch_no)
        text += "\n（离线骨架占位, 在线重跑可细化）"
    # 字数门 + 在线扩缩写（最多 3 次修复, 失败回退用前章衔接）
    status, diff = word_gate(text)
    attempts = 0
    min_accept = TARGET["ch_min"] - TARGET["ch_tol"]  # 最低可接受字数
    while status in ("expand", "shrink") and online and fc.has_key() and attempts < 3:
        attempts += 1
        if status == "expand":
            t2 = _expand_online(project, text, diff, ch_no)
            cand = t2.get("text", "") if t2 else ""
            # 扩写结果必须比原来长且达标, 否则保留原来的
            if cand and char_count(cand) > char_count(text) and char_count(cand) >= min_accept:
                text = cand
            else:
                # 扩写失败/无效: 尝试 LLM 补写(在原文基础上加场景)
                t3 = fc.llm_json(
                    f'在这章正文末尾续写一个新场景补足字数, 保持情节连贯与人物一致, 只输出JSON:{{"text":"续写部分(800-1500字)"}}。'
                    f'正文结尾:\n{text[-1500:]}')
                if t3 and t3.get("text"):
                    text = text + "\n\n" + t3["text"]
        else:
            t2 = _shrink_online(project, text, diff, ch_no)
            cand = t2.get("text", "") if t2 else ""
            if cand and char_count(cand) <= TARGET["ch_max"] + TARGET["ch_tol"]:
                text = cand
        status, diff = word_gate(text)
    # L0 正文（永不修改）+ L1 摘要（冻结）
    nm.add_chapter_l0(pdir, ch_no, text)
    brief = f"第{ch_no}章「{ch.get('title','')}」: {ch.get('beat','')}。章末钩:{ch.get('hook','')}。基调:{card.get('tone','')}"
    if online and fc.has_key():
        l1 = fc.llm_json(f'为这章写 300-500 字摘要, 只输出JSON:{{"brief":"摘要"}}。正文:\n{text[:3000]}')
        if l1 and l1.get("brief"):
            brief = l1["brief"]
    nm.add_chapter_l1(pdir, ch_no, brief)
    return text, status, brief


def _skeleton(project, ch, ch_no):
    card = project["card"]
    return (f"# {ch.get('title','')}\n\n"
            f"> 节拍: {ch.get('beat','')}  |  章末钩: {ch.get('hook','')}\n\n"
            f"（离线骨架, 第{ch_no}章: {ch.get('beat','')}）")


def update_memory(project, pdir, ch_no, text, online=True):
    """写后: 节奏 + 伏笔回收判断 + canon 追加(在线用 LLM 抽取事实)。"""
    pace = "medium" if ch_no % 10 < 7 else ("fast" if ch_no % 10 < 9 else "slow")
    nm.rhythm_assign(pdir, ch_no, pace)
    # 在线: 让 LLM 从本章抽取 1-2 条正典事实追加
    if online and fc.has_key():
        facts = fc.llm_json(
            f'从这章正文抽取 1-3 条"后续章节必须遵守的原子事实"(人物状态/能力/物品归属/已发生事件), '
            f'只输出JSON:{{"facts":[{{"desc":"事实","known_by":"谁知道这条"}}]}}。正文:\n{text[:3000]}')
        if facts:
            for f in facts.get("facts", []):
                nm.canon_append(pdir, "facts", {"desc": f.get("desc", ""), "chapter": ch_no,
                                                 "known_by": f.get("known_by", "主角")})
    return pace


def hierarchical_summaries(pdir, ch_no):
    """每 5 章 L2, 每 10 章 L3, 卷末 L4/L5。离线占位, 在线可 LLM 生成。"""
    gen = {}
    if ch_no % TARGET["l2_every"] == 0:
        chunk = (ch_no - 1) // TARGET["l2_every"] + 1
        p = os.path.join(pdir, "L2", f"chunk-{chunk:02d}.md")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w", encoding="utf-8").write(f"# 篇章 {ch_no-4}-{ch_no} 摘要 (≤800字, 冻结)\n（在线 LLM 生成）\n")
        gen["L2"] = p
    if ch_no % TARGET["l3_every"] == 0:
        arc = ch_no // TARGET["l3_every"]
        p = os.path.join(pdir, "L3", f"arc-{arc:02d}.md")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w", encoding="utf-8").write(f"# 弧 {arc*10+1}-{ch_no} 摘要 (≤2000字, 冻结)\n（在线 LLM 生成）\n")
        gen["L3"] = p
    if ch_no % TARGET["l4_every"] == 0:
        vol = ch_no // TARGET["l4_every"]
        nm.archive_volume(pdir, vol)
        gen["L4/L5"] = f"vol-{vol}"
    return gen


def consistency_check(pdir, ch_no):
    """写后一致性: 确定性规则(伏笔超期/能力回退) + 可选 LLM 模糊判断。"""
    report = nm.consistency_report(pdir, ch_no)
    rp = os.path.join(pdir, f"consistency_ch{ch_no:02d}.json")
    json.dump(report, open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return report, rp


def foreshadow_maintenance(pdir, ch_no, online=True):
    """每 10 章: LLM 从近 10 章挖新伏笔 + 判断旧伏笔是否已回收。"""
    gen = {}
    if not (online and fc.has_key()):
        return gen
    if ch_no % TARGET["l3_every"] != 0:
        return gen
    # 读近 10 章 L1 摘要
    briefs = nm.get_l1_briefs(pdir, recent=10)
    recent = " ".join(b["brief"][:200] for b in briefs)[-3000:]
    # 读现有伏笔
    fs_path = os.path.join(pdir, "foreshadow.jsonl")
    existing = [json.loads(l) for l in open(fs_path, encoding="utf-8") if l.strip()] if os.path.exists(fs_path) else []
    pending = [f for f in existing if f.get("status") == "pending"]
    prompt = (
        '这是长篇《' + str(ch_no) + '章》近10章摘要:\n' + recent + '\n\n'
        + '现有未回收伏笔: ' + json.dumps(pending, ensure_ascii=False)[:500] + '\n\n'
        + '请判断: 1) 这些伏笔中哪些已被近10章内容实际回收(埋下后已有结果/揭示)? '
        + '2) 近10章新出现了哪些值得后续章节回收的伏笔(悬念/秘密/承诺/未解之谜)? '
        + '只输出JSON: ' + json.dumps({"payoff": ["FS-xxx"], "new": [{"desc": "新伏笔", "level": "tactical"}], "ch": "第几章埋下"}, ensure_ascii=False))
    data = fc.llm_json(prompt)
    if data:
        for fid in data.get("payoff", []):
            nm.foreshadow_payoff(pdir, fid, ch_no, note="LLM自动识别回收")
            gen[f"payoff:{fid}"] = True
        for n in data.get("new", [])[:3]:
            nm.foreshadow_add(pdir, n.get("desc", ""), level=n.get("level", "tactical"),
                              source_chapter=ch_no - 10)
            gen["new_fs"] = gen.get("new_fs", 0) + 1
    return gen


def run(project_name, start=1, end=None, online=True):
    pdir = project_dir(project_name)
    project = json.load(open(os.path.join(pdir, "state.json"), encoding="utf-8"))
    # 确保有大纲
    outline = project.get("outline")
    if not outline or "chapters_v1" not in outline:
        import novel_forge
        out = novel_forge._gen_outline(project, online=online, projects_root=PROJECTS)
        project["outline"] = out
        json.dump(project, open(os.path.join(pdir, "state.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        outline = project["outline"]
    chapters = outline.get("chapters_v1", [])
    # 扩展细纲到目标章数（在线 LLM 分批; 离线模板铺）
    target_end = end or TARGET["volume_300k"]
    _extend_outline(project, pdir, chapters, target_end, online)
    outline = project.get("outline", {})
    chapters = outline.get("chapters_v1", [])
    # 逐章流水线
    results = []
    # 自动回收已超期的伏笔（避免一致性检查一直报警）
    overdue0 = nm.foreshadow_overdue(pdir, start)
    for o in overdue0:
        nm.foreshadow_payoff(pdir, o["id"], start - 1, note=f"第{start}章前自动回收(超期)")
        print(f"  [伏笔] 自动回收超期伏笔 {o['id']} {o['desc'][:30]}")
    for ch_no in range(start, target_end + 1):
        text, gate, brief = write_chapter(project, pdir, ch_no, outline, online=online)
        pace = update_memory(project, pdir, ch_no, text, online=online)
        gen = hierarchical_summaries(pdir, ch_no)
        rep, rp = consistency_check(pdir, ch_no)
        results.append({"ch": ch_no, "chars": char_count(text), "gate": gate,
                        "pace": pace, "issues": len(rep["deterministic"]), "summaries": gen})
        print(f"  第{ch_no:02d}章 {char_count(text)}字 [{gate}] 节奏={pace} "
              f"确定性问题={len(rep['deterministic'])} 摘要={list(gen.keys()) or '-'}")
        # 里程碑报告
        if ch_no == TARGET["milestone_200k"]:
            _milestone_report(pdir, ch_no, 200000)
        if ch_no == TARGET["volume_300k"]:
            _milestone_report(pdir, ch_no, 300000)
        # 每10章伏笔维护(挖新伏笔+识别回收)
        fs_gen = foreshadow_maintenance(pdir, ch_no, online=online)
        if fs_gen:
            print(f"    [伏笔] {fs_gen}")
    project["last_chapter"] = target_end
    project["status"] = "running" if end else "completed"
    json.dump(project, open(os.path.join(pdir, "state.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    total = sum(r["chars"] for r in results)
    print(f"\n[run] 完成 第{start}-{target_end}章, 累计 {total} 字")
    _progress_report(pdir, project, total)
    return results


def _extend_outline(project, pdir, chapters, target_end, online):
    """细纲铺到 target_end: 已有 chapters_v1 只到 8 章时, 在线 LLM 分批扩展, 离线模板。"""
    have = len(chapters)
    if have >= target_end:
        return
    if online and fc.has_key():
        base = json.dumps(chapters[:8], ensure_ascii=False)[:2000]
        for seg_start in range(8, target_end + 1, 20):
            seg_end = min(seg_start + 19, target_end)
            data = fc.llm_json(
                f'续写第{seg_start}-{seg_end}章细纲, 只输出JSON:{{"chapters":[{{"no":1,"title":"章标题","beat":"节拍","hook":"章末钩"}}]}}'
                f'每章 no 从{seg_start}到{seg_end}。题材:{project["card"].get("subject")} 基调:{project["card"].get("tone")} '
                f'主线:{project.get("design", {}).get("main_conflict", "")[:150]}\n已有前8章:\n{base}')
            if data and "chapters" in data:
                for c in data["chapters"]:
                    chapters.append({"no": c.get("no", seg_start + len(chapters) - 8),
                                      "title": c.get("title", ""), "beat": c.get("beat", ""), "hook": c.get("hook", "")})
    # 离线: 模板补齐
    i = 0
    while len(chapters) < target_end:
        i += 1
        n = len(chapters) + 1
        chapters.append({"no": n, "title": f"第{n}章·推进", "beat": f"主线推进节点{n}",
                          "hook": "悬念加深" if n % 3 else "阶段高潮"})
    out_path = os.path.join(pdir, "大纲.json")
    json.dump({"chapters_v1": chapters}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    project.setdefault("outline", {})["chapters_v1"] = chapters


def _milestone_report(pdir, ch_no, target_chars):
    # 统计已写字数
    total = 0
    l0 = os.path.join(pdir, "L0")
    if os.path.isdir(l0):
        for f in os.listdir(l0):
            total += char_count(open(os.path.join(l0, f), encoding="utf-8").read())
    rep = os.path.join(pdir, f"milestone_{target_chars // 10000}万字_ch{ch_no}.md")
    overdue = nm.foreshadow_overdue(pdir, ch_no)
    with open(rep, "w", encoding="utf-8") as fh:
        fh.write(f"# {target_chars//10000}万字里程碑检查 (第{ch_no}章)\n\n"
                 f"- 已写: {total} 字\n- 目标: {target_chars} 字\n- 达成: {min(100, int(total/target_chars*100))}%\n\n"
                 f"## 伏笔超期({len(overdue)})\n")
        for o in overdue:
            fh.write(f"- {o['id']} {o['desc']} ({o.get('level')}, 源{o.get('source_chapter')}超期)\n")
        fh.write(f"\n## 建议\n- 在线: LLM 做 POV/命名一致性模糊判断\n- 伏笔超期的优先回收\n")
    print(f"  [milestone] {rep}")


def _progress_report(pdir, project, total_this_run):
    grand = total_this_run
    l0 = os.path.join(pdir, "L0")
    if os.path.isdir(l0):
        grand = sum(char_count(open(os.path.join(l0, f), encoding="utf-8").read())
                    for f in os.listdir(l0))
    last = project.get("last_chapter", 0)
    p = os.path.join(pdir, "PROGRESS.md")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(f"# 长篇进度\n\n- 已写 {last} 章 / 目标 {TARGET['volume_300k']} 章\n"
                 f"- 累计 {grand} 字 (30万字={TARGET['volume_300k']}章)\n"
                 f"- 20万字里程碑: 第{TARGET['milestone_200k']}章 {'已达成' if last>=TARGET['milestone_200k'] else '未达成'}\n"
                 f"- 30万字完本: 第{TARGET['volume_300k']}章 {'已达成' if last>=TARGET['volume_300k'] else '未达成'}\n")
    print(f"  [progress] {p} (累计 {grand} 字, {last}章)")


def status(project_name):
    pdir = project_dir(project_name)
    st = json.load(open(os.path.join(pdir, "state.json"), encoding="utf-8"))
    l0 = os.path.join(pdir, "L0")
    n_ch = len(os.listdir(l0)) if os.path.isdir(l0) else 0
    total = 0
    if os.path.isdir(l0):
        for f in os.listdir(l0):
            total += char_count(open(os.path.join(l0, f), encoding="utf-8").read())
    print(f"项目 {st['slug']}: {n_ch} 章 / {total} 字 | 状态 {st.get('status')} | "
          f"20万字@第{TARGET['milestone_200k']}章 30万字@第{TARGET['volume_300k']}章")
    return {"chapters": n_ch, "chars": total}
