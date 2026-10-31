#!/usr/bin/env python3
"""竞品/类似游戏检索层 — 为"寻找市面上类似游戏作参考"提供数据源。

数据源（本地优先）:
1. 知识库 06-资源 下已有调研（本地 grep）
2. 内置速查表（常见类型 → 代表作品 + 核心机制 + 数值特征）
3. web_search 结果（可选，agent 侧调用后把结果喂进来）

输出: 结构化参考清单，写入 reports/competitors.md。
"""
import json, os, re, glob, datetime

KB_DIR = "/home/zzz/Documents/dsh-kb"

# 内置速查表: 玩法标签 → 市面参考
BUILTIN = [
    {
        "tag": "割草/幸存者Like",
        "games": [
            {"name": "Brotato 土豆兄弟", "mechanics": "局内构筑+波次商店, 20波节奏", "notes": "波内只攒不用, 商店自走棋式"},
            {"name": "999秒幸存者", "mechanics": "200+道具, 40+装备, 高随机性", "notes": "爽感来自构筑而非基础数值"},
            {"name": "VA-11 Hall-A", "mechanics": "波次+Roguelite构筑", "notes": "短循环单局<3分钟"},
        ],
    },
    {
        "tag": "末日/基地防御",
        "games": [
            {"name": "Darkwood", "mechanics": "昼夜循环: 白天搜刮修营地→夜晚守家", "notes": "准备-防守-结算三段式"},
            {"name": "Rogue Tower", "mechanics": "45波3模式, 敌人3种防御机制", "notes": "Boss波+刷怪塔"},
            {"name": "Tiny Troopers 2", "mechanics": "Q版军事TD, 兵营/弹药/医疗多线资源", "notes": "3级墙HP, Boomer/Dropper 敌人"},
        ],
    },
    {
        "tag": "模拟经营",
        "games": [
            {"name": "Stardew Valley", "mechanics": "多经营线+季节+社交", "notes": "像素暖色调, 24色量化风格"},
            {"name": "Two Point Hospital", "mechanics": "经营+建设+随机事件", "notes": "Q版卡通, 明亮高饱和"},
            {"name": "游戏内商场经营(自有项目)", "mechanics": "9业态+连锁+昼夜", "notes": "见 mall-tycoon 项目"},
        ],
    },
    {
        "tag": "Roguelike",
        "games": [
            {"name": "Hades", "mechanics": "局内Build+局外叙事推进", "notes": "死亡不惩罚, 对话驱动"},
            {"name": "Slay the Spire", "mechanics": "卡牌构筑+精英/小怪节奏", "notes": "50局内随机性设计"},
        ],
    },
    {
        "tag": "塔防",
        "games": [
            {"name": "Kingdom Rush", "mechanics": "固定点位+波次设计+英雄技能", "notes": "波次曲线先缓后陡"},
            {"name": "Bloons TD 6", "mechanics": "塔协同+猴子升级路线", "notes": "数值深度靠组合而非堆DPS"},
        ],
    },
]


def _kb_search() -> list:
    """从本地知识库 06-资源 检索已有的竞品调研。"""
    found = []
    for f in glob.glob(os.path.join(KB_DIR, "06-资源", "*.md")):
        try:
            with open(f, "r", encoding="utf-8") as fh:
                text = fh.read()
        except OSError:
            continue
        if re.search(r"game|玩法|游戏|机制|mechanic|数值", text, re.I):
            head = ""
            for line in text.splitlines()[:12]:
                if line.startswith("#"):
                    head = line.lstrip("# ").strip()
                    break
            found.append({"file": f, "title": head or os.path.basename(f)})
    return found


def find_similar(game_profile: dict, web_results: list = None) -> dict:
    """根据 GameProfile 的玩法标签挑选相关竞品参考。"""
    text = json.dumps(game_profile.get("play_mechanics", [])) + \
        json.dumps(game_profile.get("sections", []), ensure_ascii=False) + \
        json.dumps(game_profile.get("game_name", ""))
    low = text.lower()

    matched_tags = set()
    rules = [
        (("割草", "survivor", "slasher", "mow", "vampire"), "割草/幸存者Like"),
        (("末日", "zombie", "base", "defense", "night", "camp"), "末日/基地防御"),
        (("经营", "tycoon", "shop", "mall", "management", "模拟"), "模拟经营"),
        (("roguelike", "roguelite", "肉鸽", "spire"), "Roguelike"),
        (("tower", "塔防", "td"), "塔防"),
    ]
    for keys, tag in rules:
        if any(k in low for k in keys):
            matched_tags.add(tag)
    if not matched_tags:
        # 默认给全部内置表
        matched_tags = {b["tag"] for b in BUILTIN}

    similar = []
    for b in BUILTIN:
        if b["tag"] in matched_tags:
            similar.append({"tag": b["tag"], "games": b["games"]})

    # 从知识库补充（本地优先）
    kb = _kb_search()
    out = {
        "matched_tags": sorted(matched_tags),
        "games": similar,
        "kb_resources": kb,
        "web_results": web_results or [],
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    return out


def write_report(report_dir: str, game_name: str, result: dict) -> str:
    os.makedirs(report_dir, exist_ok=True)
    path = os.path.join(report_dir, "competitors.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# 竞品参考 — {game_name}\n\n生成: {result['generated_at']}\n")
        f.write(f"匹配玩法标签: {', '.join(result['matched_tags'])}\n\n")
        for group in result["games"]:
            f.write(f"## {group['tag']}\n\n")
            for g in group["games"]:
                f.write(f"### {g['name']}\n- 机制: {g.get('mechanics','')}\n- 备注: {g.get('notes','')}\n\n")
        if result.get("kb_resources"):
            f.write("## 本地知识库已有调研\n")
            for k in result["kb_resources"]:
                f.write(f"- [{k['title']}]({os.path.relpath(k['file'], KB_DIR)})\n")
        if result.get("web_results"):
            f.write("## 网络检索结果（agent 侧 web_search 喂入）\n")
            for w in result["web_results"]:
                f.write(f"- {w.get('title','')} — {w.get('url','')}\n")
    return path
