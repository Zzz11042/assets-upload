"""修复 icon_pause2 行缺少闭合引号的问题"""
import re
s = open("/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/index.html", encoding="utf-8").read()
m = re.search(r'"icon_pause2":"data:image/png;base64,([A-Za-z0-9+/=]+)(?=\s)', s)
if m:
    b64 = m.group(1)
    bad = '"icon_pause2":"data:image/png;base64,' + b64 + '\n'
    good = '"icon_pause2":"data:image/png;base64,' + b64 + '"\n'
    if bad in s:
        s = s.replace(bad, good)
        open("/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/index.html", "w", encoding="utf-8").write(s)
        print("fixed: added closing quote")
    else:
        # 检查是否已经正常
        if good in s:
            print("already OK")
        else:
            print("state unclear, dumping context")
            i = s.find('icon_pause2')
            print(repr(s[i:i+120]))
else:
    print("pattern not found")
