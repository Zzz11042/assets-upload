import json, subprocess, time, sys
KEY="sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol"
OUT="/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"
PIX="16-bit pixel art character portrait, upper body bust, thick dark outline, clean flat colors, retro game sprite style, centered, isolated on pure solid white background, no text, no watermark, facing viewer, confident expression, soft vignette"
items=[
 ("portrait_infantry","an infantry soldier with olive drab helmet and M9 rifle slung, upper body, confident"),
 ("portrait_gunner","a heavy machine-gunner in blue armor with twin MGs, upper body, battle-worn"),
 ("portrait_sniper","a sniper in orange camo with scoped rifle and goggled face, upper body, focused"),
 ("portrait_medic","a medic in white armor with red cross armband and med kit, upper body, calm"),
 ("portrait_engineer","an engineer in steel gray work gear with wrench and toolbox, upper body, sturdy"),
 ("portrait_bounty","a bounty hunter in golden armor with rocket launcher on shoulder, upper body, swagger"),
 ("portrait_ghost","a ghost operative in violet stealth suit with gauss rifle, upper body, hooded shadow"),
]
def gen(name,desc):
    prompt=PIX.format(desc)
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
