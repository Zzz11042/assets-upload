import json, subprocess, time, sys
KEY="sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol"
OUT="/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"
PIX="16-bit pixel art game UI icon, single {obj}, thick dark outline, clean flat colors, simple readable shape, centered, isolated on pure solid white background, no text"
items=[
 ("icon_gold","a stack of gold coins"),
 ("icon_part","a metal gear cog"),
 ("icon_food","a drumstick meat"),
 ("icon_med","a medical cross bandage"),
 ("icon_grenade","a hand grenade"),
 ("icon_rocket","a rocket launcher missile"),
 ("icon_form","a formation arrow icon"),
 ("icon_pause","a pause button"),
]
def gen(name,desc):
    prompt=PIX.format(obj=desc)
    body=json.dumps({"model":"agnes-image-2.1-flash","prompt":prompt,"n":1,"size":"256x256"})
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
