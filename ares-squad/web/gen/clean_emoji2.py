import os, re
p = "/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/index.html"
s = open(p, encoding="utf-8").read()

PAIRS = [
    (r'toast("资源不足(需\u{1F519}"+upCost.part+" \u{1F4B0}"', r'toast("资源不足(需零件 "+upCost.part+" 金币 "'),
    (r'{id:"endless",nm:"\u{267E} 无尽模式",desc:', r'{id:"endless",nm:"无尽模式",desc:'),
]

def norm(o):
    return re.sub(r'\\u\{([0-9A-Fa-f]+)\}', lambda m: chr(int(m.group(1),16)), o)

for o, n in PAIRS:
    o2, n2 = norm(o), norm(n)
    cnt = s.count(o2)
    if cnt:
        s = s.replace(o2, n2)
        print(f"[{cnt}]", o2[:30])
    else:
        print("[MISS]", o2[:30])

open(p, "w", encoding="utf-8").write(s)
print("done, total", len(s))
