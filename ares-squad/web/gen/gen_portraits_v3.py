import json, subprocess, time, sys
KEY="sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol"
OUT="/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"
PIX=("16-bit pixel art character portrait, UPPER BODY BUST, full military uniform with heavy tactical equipment, "
     "armor vest, helmet, backpack, ammo pouches, dog tags, visible weapon slung or held, "
     "thick dark outline, clean flat colors, retro game sprite style, centered, "
     "isolated on pure solid white background, no text, no watermark, facing viewer, "
     "confident determined expression, soft vignette, high detail uniform with equipment")
items=[
 ("portrait_infantry","olive drab army uniform with camo pattern, ballistic helmet, tactical vest with 4 ammo pouches, M9 rifle slung across chest, ammo belt, dog tags"),
 ("portrait_gunner","blue heavy combat armor plates, combat helmet with chinstrap, twin machine guns held in front, shoulder ammo packs, radio on chest"),
 ("portrait_sniper","orange camo field uniform, boonie hat and goggled face, long scoped sniper rifle held across body, sniper pack with optics, laser sight"),
 ("portrait_medic","white and red combat medical uniform, helmet with red cross, med kit strapped to chest, syringe pouch, red cross armband, plasma pack"),
 ("portrait_engineer","steel gray work uniform and hard hat with lamp, tool belt with wrench screwdriver and parts, welding torch and gas canister on back"),
 ("portrait_bounty","golden armored combat suit with shoulder pauldrons, combat helmet, rocket launcher slung on back, ammo clips on chest, energy cells"),
 ("portrait_ghost","violet stealth uniform with hood, gauss rifle held across body, energy cells and backpack with glowing cores, tattered cloak over one shoulder"),
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
