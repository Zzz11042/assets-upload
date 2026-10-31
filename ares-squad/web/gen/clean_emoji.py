import os, re
p = "/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/index.html"
s = open(p, encoding="utf-8").read()

reps = [
    (r'toast("资源不足(需\u{1F519}"', r'toast("资源不足(需零件 "'),
    (r'{id:"campaign",nm:"\u{1F3AF} 主线剧情",desc:', r'{id:"campaign",nm:"主线剧情",desc:'),
    (r'{id:"defense",nm:"\u{1F6E1} 保卫战",desc:', r'{id:"defense",nm:"保卫战",desc:'),
    (r'{id:"endless",nm:"\u{2771} 无尽模式",desc:', r'{id:"endless",nm:"无尽模式",desc:'),
    (r'toast("\u{1F52B} 哨戒机枪已布置', r'toast("哨戒机枪已布置'),
    (r'toast("\u{1F9E8} 手雷引爆!', r'toast("手雷引爆!'),
    (r'toast("\u{1F680} 火箭齐射!', r'toast("火箭齐射!'),
    (r'toast("已选 "+md.nm.slice(2)+"(再点 \u{1F681} 出击开战)")', r'toast("已选 "+md.nm+"(再点 出击 开战)")'),
    (r'<div style="font-size:14px;color:#ff9f9f">\u{274C} 小队全阵亡,无法出击</div>', r'<div style="font-size:14px;color:#ff9f9f">小队全阵亡,无法出击</div>'),
]

def norm(o):
    return re.sub(r'\\u\{([0-9A-Fa-f]+)\}', lambda m: chr(int(m.group(1),16)), o)

for o, n in reps:
    o2, n2 = norm(o), norm(n)
    cnt = s.count(o2)
    if cnt:
        s = s.replace(o2, n2)
        print(f"[{cnt}]", o2[:32])
    else:
        print("[MISS]", o2[:32])

open(p, "w", encoding="utf-8").write(s)
print("done, total", len(s))
