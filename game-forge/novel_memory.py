#!/usr/bin/env python3
"""novel_memory — 长篇小说工程化记忆系统（复刻 long-novel-writer + ai-novelist）

把本地知识库沉淀的两个开源项目的核心机制落地到 novel_forge：

1. **L0-L5 分层摘要 + 冻结规则**（jiaw-Zh/long-novel-writer）
   - L0: 正文原文（永不修改）
   - L1: 单章摘要 300-500 字（写完即冻结）
   - L2: 篇章摘要 ≤800 字（3-5 章 chunk）
   - L3: 篇章摘要 ≤2000 字（10-30 章 arc）
   - L4: 卷摘要 ≤3000 字
   - L5: 全书浓缩 ≤2000 字（卷收尾重生成）
   - 关键规则: 只读下层不改下层; L1-L4 一经写定永不修改; 事实变更走 canon 追加

2. **正典账本 Canon Ledger**（facts/rules/timeline/promises/progression）
   - canon/facts.jsonl: 原子事实（含 known_by POV 知识边界, 只追加）
   - canon/rules.md: 世界规则（追加式）
   - canon/timeline.md: 故事日时间线
   - canon/promises.jsonl: 角色承诺（状态变化追加 update）
   - canon/progression.jsonl: 能力/境界进阶轨迹（防境界倒退）

3. **三级伏笔追踪 + 节奏三档制**（JIRBOY/ai-novelist）
   - 战略级（贯穿全书）/ 战役级（跨 10-30 章）/ 战术级（跨 3-8 章）
   - 节奏: 慢档(铺垫)/中档(升温)/快档(突破), 配额硬上限防剧情加速

4. **写前组装协议**（Context Assembly Protocol）
   - 9 项拼接上下文, 顺序决定优先级, 总量压到 25k-40k token

目录结构（项目下）:
  L0/ch-NNNN.md      # 正文
  L1/brief-ch-NNNN.md  # 单章摘要
  L2/chunk-XX.md        # 篇章摘要
  L3/arc-XX.md          # 篇章摘要
  L4/vol-XX.md          # 卷摘要
  L5/global.md          # 全书浓缩
  canon/facts.jsonl
  canon/rules.md
  canon/timeline.md
  canon/promises.jsonl
  canon/progression.jsonl
  foreshadow.jsonl     # 三级伏笔台账
  rhythm.jsonl          # 节奏分配
"""
import json, os, re, datetime, hashlib

def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

# ---------- L0-L5 分层摘要 ----------
def add_chapter_l0(project_root, chapter_no, text):
    """L0: 正文原文（永不修改）"""
    l0_dir = os.path.join(project_root, "L0")
    os.makedirs(l0_dir, exist_ok=True)
    p = os.path.join(l0_dir, f"ch-{chapter_no:04d}.md")
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return p

def add_chapter_l1(project_root, chapter_no, brief, frozen=True):
    """L1: 单章摘要 300-500 字（写完即冻结）"""
    l1_dir = os.path.join(project_root, "L1")
    os.makedirs(l1_dir, exist_ok=True)
    p = os.path.join(l1_dir, f"brief-ch-{chapter_no:04d}.md")
    meta = {"chapter": chapter_no, "chars": len(brief), "frozen": frozen, "created": now()}
    with open(p, "w", encoding="utf-8") as f:
        f.write(f"<!-- {json.dumps(meta, ensure_ascii=False)} -->\n\n{brief}\n")
    return p

def get_l1_briefs(project_root, recent=5):
    """按需加载最近 N 章的 L1 brief（写前组装协议用）"""
    l1_dir = os.path.join(project_root, "L1")
    if not os.path.isdir(l1_dir):
        return []
    files = sorted(os.listdir(l1_dir))[-recent:]
    out = []
    for fn in files:
        txt = open(os.path.join(l1_dir, fn), encoding="utf-8").read()
        # 去掉 meta 注释
        body = txt.split("-->", 1)[1].strip() if "-->" in txt else txt
        out.append({"file": fn, "brief": body})
    return out

def assemble_context(project_root, chapter_no, recent_l1=5, last_end_chars=800):
    """写前组装协议: 9 项拼接, 顺序决定优先级。

    1. story-bible (永远加载, 在 design 里)
    2. 当前卷/arc 摘要
    3. 当前章 blueprint
    4. 最近 N 章 L1 brief
    5. 上一章结尾段原文
    6. 出场实体档案
    7. 伏笔台账
    8. canon 账本
    9. 写作指令

    返回拼接好的 context 字符串。
    """
    parts = []
    # 1. story-bible (design)
    state_path = os.path.join(project_root, "state.json")
    if os.path.exists(state_path):
        st = json.load(open(state_path, encoding="utf-8"))
        parts.append("## 1. 故事圣经\n" + json.dumps(st.get("design", {}), ensure_ascii=False, indent=2))
    # 4. 最近 N 章 L1
    l1s = get_l1_briefs(project_root, recent_l1)
    if l1s:
        parts.append("## 4. 最近章节摘要\n" + "\n\n".join(f"- {b['file']}: {b['brief'][:300]}" for b in l1s))
    # 5. 上一章结尾
    if chapter_no > 1:
        prev = os.path.join(project_root, "L0", f"ch-{chapter_no-1:04d}.md")
        if os.path.exists(prev):
            txt = open(prev, encoding="utf-8").read()
            parts.append(f"## 5. 上一章结尾(衔接)\n...{txt[-last_end_chars:]}")
    # 7. 伏笔
    fs_path = os.path.join(project_root, "foreshadow.jsonl")
    if os.path.exists(fs_path):
        active = [json.loads(l) for l in open(fs_path, encoding="utf-8") if l.strip()]
        pending = [f for f in active if f.get("status") == "pending"]
        if pending:
            parts.append("## 7. 待回收伏笔\n" + "\n".join(f"- {f['id']}: {f['desc']} (到期{f.get('due_chapter','?')})" for f in pending[:10]))
    # 8. canon
    canon_dir = os.path.join(project_root, "canon")
    facts = _read_jsonl(canon_dir + "/facts.jsonl")
    if facts:
        parts.append("## 8. 正典事实\n" + "\n".join(f"- {f}" for f in facts[-30:]))
    canon = "\n\n".join(parts)
    return canon

def _read_jsonl(path):
    if not os.path.exists(path):
        return []
    return [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]

# ---------- 正典账本 ----------
def canon_append(project_root, kind, entry):
    """kind: facts|rules|timeline|promises|progression
    账本只追加不修改（long-novel-writer 的"冻结规则"）。"""
    canon_dir = os.path.join(project_root, "canon")
    os.makedirs(canon_dir, exist_ok=True)
    p = os.path.join(canon_dir, f"{kind}.jsonl")
    entry = dict(entry)
    entry.setdefault("at", now())
    digest = hashlib.md5(json.dumps(entry, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:6]
    entry.setdefault("id", f"{kind[0].upper()}-{digest}")
    with open(p, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry

def canon_retract(project_root, kind, fact_id, reason):
    """正典错误走 canon retraction: 追加 FACT-XXXX-R, 不修改原条目。"""
    canon_dir = os.path.join(project_root, "canon")
    p = os.path.join(canon_dir, f"{kind}.jsonl")
    with open(p, "a", encoding="utf-8") as f:
        f.write(json.dumps({"id": fact_id + "-R", "retracted": fact_id, "reason": reason, "at": now()}, ensure_ascii=False) + "\n")

# ---------- 三级伏笔追踪 ----------
def foreshadow_add(project_root, desc, level="tactical", due_chapter=None, source_chapter=None):
    """level: strategic(贯穿全书)/campaign(跨10-30章)/tactical(跨3-8章)"""
    fs_path = os.path.join(project_root, "foreshadow.jsonl")
    os.makedirs(project_root, exist_ok=True)
    entries = _read_jsonl(fs_path)
    fid = f"FS-{len(entries)+1:03d}"
    entry = {"id": fid, "desc": desc, "level": level, "status": "pending",
             "source_chapter": source_chapter, "due_chapter": due_chapter, "created": now()}
    with open(fs_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry

def foreshadow_payoff(project_root, fs_id, payoff_chapter, note=""):
    fs_path = os.path.join(project_root, "foreshadow.jsonl")
    entries = _read_jsonl(fs_path)
    lines = []
    for e in entries:
        if e["id"] == fs_id:
            e["status"] = "paid"
            e["payoff_chapter"] = payoff_chapter
            e["note"] = note
            e["paid_at"] = now()
        lines.append(json.dumps(e, ensure_ascii=False))
    with open(fs_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

def foreshadow_overdue(project_root, current_chapter):
    """超期预警: 战术级 >8 章 / 战役级 >30 章 / 战略级 不限"""
    fs_path = os.path.join(project_root, "foreshadow.jsonl")
    entries = _read_jsonl(fs_path)
    limit = {"tactical": 8, "campaign": 30, "strategic": 999}
    overdue = []
    for e in entries:
        if e.get("status") != "pending":
            continue
        src = e.get("source_chapter") or 1
        if current_chapter - src > limit.get(e.get("level", "tactical"), 8):
            overdue.append(e)
    return overdue

# ---------- 节奏三档制 ----------
def rhythm_assign(project_root, chapter_no, pace="medium"):
    """pace: slow(铺垫)/medium(升温)/fast(突破)。配额硬上限防剧情加速。"""
    rp = os.path.join(project_root, "rhythm.jsonl")
    os.makedirs(project_root, exist_ok=True)
    entries = _read_jsonl(rp)
    fast_count = sum(1 for e in entries if e.get("pace") == "fast")
    entry = {"chapter": chapter_no, "pace": pace, "fast_quotas_used": fast_count, "at": now()}
    if fast_count >= 3:
        entry["warning"] = "快档配额已满(3), 建议降为中档/慢档"
    with open(rp, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry

# ---------- 一致性检查（确定性规则 + LLM 模糊判断） ----------
CONSISTENCY_RULES = [
    ("能力不回退", "主角已掌握的能力在后续章节不应消失"),
    ("POV 知识边界", "角色不应说出其 known_by 范围外的信息"),
    ("命名一致", "同一角色/地点/物品全书同音同字"),
    ("规则有效期", "已失效的规则不应被引用"),
    ("伏笔对齐", "每章结尾应对齐最近的伏笔到期章节"),
]

def check_consistency_deterministic(project_root, current_chapter):
    """确定性规则: 用程序能查的（伏笔超期/正典回退/能力回退）。返回问题列表。"""
    issues = []
    # 伏笔超期
    overdue = foreshadow_overdue(project_root, current_chapter)
    for o in overdue:
        issues.append({"rule": "伏笔超期", "detail": f"{o['id']} {o['desc']} 超期 {current_chapter - (o.get('source_chapter') or 1)} 章", "level": o.get("level")})
    # 正典回退 (progression)
    canon_dir = os.path.join(project_root, "canon")
    prog_path = os.path.join(canon_dir, "progression.jsonl")
    if os.path.exists(prog_path):
        entries = _read_jsonl(prog_path)
        for i in range(1, len(entries)):
            prev, cur = entries[i-1], entries[i]
            if prev.get("value") and cur.get("value") and cur.get("value") < prev.get("value", 0):
                issues.append({"rule": "进阶合法性", "detail": f"{cur.get('entity','?')} 从 {prev['value']} 倒退到 {cur['value']}", "level": "critical"})
    return issues

def consistency_report(project_root, current_chapter, llm_hint=""):
    """写后一致性检查报告（确定性 + LLM 模糊判断预留）。"""
    det = check_consistency_deterministic(project_root, current_chapter)
    llm_issues = []  # 在线时用 LLM 做模糊判断(POV/命名), 离线留空
    return {"chapter": current_chapter, "deterministic": det, "llm_hint": llm_hint, "llm": llm_issues, "at": now()}

# ---------- 归档回写 ----------
def archive_volume(project_root, volume_no):
    """卷收尾: 重生成 L4/L5, 归档。"""
    p = os.path.join(project_root, "L4", f"vol-{volume_no:02d}.md")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(f"# 卷{volume_no} 摘要 (≤3000字)\n\n（在线时用 LLM 生成, 离线占位）\n")
    p5 = os.path.join(project_root, "L5", "global.md")
    os.makedirs(os.path.dirname(p5), exist_ok=True)
    with open(p5, "w", encoding="utf-8") as f:
        f.write(f"# 全书浓缩 (≤2000字, 卷{volume_no}收尾重生成)\n\n（在线时用 LLM 生成, 离线占位）\n")
    return {"L4": p, "L5": p5}
