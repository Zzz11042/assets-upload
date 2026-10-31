import json, os, time, urllib.request
API='https://apihub.agnes-ai.com/v1/images/generations'
KEY='sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol'
HDRS={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'}

def gen(desc, out, size='256x256'):
    if os.path.exists(out) and os.path.getsize(out)>1000:
        print(f'{out}: exists'); return
    payload={'model':'agnes-image-2.5-flash','prompt':desc,'size':size,'n':1}
    data=json.dumps(payload).encode()
    r=urllib.request.Request(API,data=data,headers=HDRS,method='POST')
    with urllib.request.urlopen(r,timeout=120) as resp:
        p=json.loads(resp.read())
    if 'error' in p:
        print(f'{out}: API error {p}'); return
    url=p['data'][0]['url']
    with urllib.request.urlopen(url,timeout=60) as resp:
        open(out,'wb').write(resp.read())
    print(f'{out}: {os.path.getsize(out)}B')

STYLE='16-bit pixel art game icon, cozy Stardew Valley style, warm autumn palette, cute, simple, no text, no letters, isolated on solid white background'

# 6 HUD 图标
gen(f"gold coin stack with a small building behind it, {STYLE}", 'hud_money.png')
gen(f"wooden calendar page with sun and moon, {STYLE}", 'hud_day.png')
gen(f"three small cute people figures standing in a row, {STYLE}", 'hud_cust.png')
gen(f"official scroll document with red seal stamp, {STYLE}", 'hud_tax.png')
gen(f"level-up star badge with upward arrow, {STYLE}", 'hud_level.png')
gen(f"growth chart with rising bars and gold coins, {STYLE}", 'hud_invest.png')
time.sleep(1)

# 8 协同徽章 (每组合一张)
gen(f"combination of food bowl, film reel and hotel bed icon in a circle, {STYLE}", 'syn_onestop.png')
gen(f"combination of gamepad, movie ticket and snack bowl, {STYLE}", 'syn_family.png')
gen(f"combination of coffee cup, dumbbell and book, {STYLE}", 'syn_work.png')
gen(f"combination of shopping bags, hanger and book, {STYLE}", 'syn_shop.png')
gen(f"combination of heart, pill bottle and paw print, {STYLE}", 'syn_health.png')
gen(f"combination of gold briefcase, laptop and coffee cup, {STYLE}", 'syn_fin.png')
gen(f"combination of diamond, painting easel and star, {STYLE}", 'syn_lux.png')
gen(f"combination of croissant, gamepad and popcorn, {STYLE}", 'syn_kids.png')
time.sleep(1)
print('HUD + SYNERGY done')
