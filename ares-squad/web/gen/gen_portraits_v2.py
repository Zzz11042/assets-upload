import json, subprocess, time, sys, base64
KEY="sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol"
OUT="/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"
# 军装+装备 强化版 prompt
PIX=("16-bit pixel art character portrait, UPPER BODY BUST, military uniform with tactical equipment, "
     "armor vest, helmet, backpack and visible weapon slung/carried across the body, "
     "thick dark outline, clean flat colors, retro game sprite style, centered, "
     "isolated on pure solid white background, no text, no watermark, facing viewer, "
     "confident expression, soft vignette")
items=[
 ("portrait_infantry","olive drab army uniform, helmet, tactical vest, M9 rifle slung across chest, pouches and ammo belt"),
 ("portrait_gunner","blue heavy armor plates, combat helmet with chinstrap, twin machine guns held, shoulder ammo packs"),
 ("portrait_sniper","orange camo field uniform, boonie hat and goggles, scoped long rifle held ready, sniper pack"),
 ("portrait_medic","white and red combat medical uniform, med kit strapped to chest, helmet, syringe pouch, red cross armband"),
 ("portrait_engineer","steel gray work uniform and hard hat, tool belt with wrench and parts, welding torch on back"),
 ("portrait_bounty","golden armored combat suit, shoulder pauldrons, rocket launcher on back, ammo clips on chest"),
 ("portrait_ghost","violet stealth uniform with hood, gauss rifle held, energy cells on backpack, tattered cloak over shoulder"),
]
def gen(name,desc):
    prompt=PIX+" . Details: "+desc
    body=json.dumps({"model":"agnes-image-2.1-flash","prompt":prompt,"n":1,"size":"512x512"})
    r=subprocess.run(["curl","-s","-m","90","-X","POST","https://apihub.agnes-ai.com/v1/images/generations","-H",f"Authorization: Bearer {KEY}","-H","Content-Type: application/json","-d",body],capture_output=True,text=True)
    try:
        url=json.loads(r.stdout)["data"][0]["url"]
    except Exception:
        print(f"  [ERR] {name}: {r.stdout[:150]}"); return
    subprocess.run(["curl","-s","-m","30","-o",f"{OUT}/{name}.png",url],check=True)
    print(f"  [ok] {name}")
for n,d in items:
    if len(sys.argv)>1 and n not in sys.argv[1:]: continue
    print(f"[gen] {n}")
    gen(n,d); time.sleep(1)
print("DONE")
