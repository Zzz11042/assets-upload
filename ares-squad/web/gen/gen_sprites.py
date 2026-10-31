import json, subprocess, sys, time, os

KEY = "sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol"
OUT = "/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"

# 所有要生成的素材: (name, prompt, target_w, target_h)
# 像素风 prompt 模板: 强调 16-bit pixel art, 粗描边, 纯背景, 居中单体
PIX = "16-bit pixel art game sprite, single {obj}, thick dark outline, clean flat colors, subtle shading, centered, isolated on pure solid white background, no text, no watermark, side view"

items = [
  # 士兵 5 职业 + 赏金 + 幽灵
  ("soldier_infantry",  "an infantry soldier with olive helmet and rifle, side view facing right", 16, 20),
  ("soldier_gunner",    "a heavy machine-gunner soldier in blue armor with twin guns, side view facing right", 16, 20),
  ("soldier_sniper",    "a sniper soldier in orange gear with long rifle scope, side view facing right", 16, 20),
  ("soldier_medic",     "a medic soldier in white armor with red cross and med kit, side view facing right", 16, 20),
  ("soldier_engineer",  "an engineer soldier in steel gray work gear with wrench, side view facing right", 16, 20),
  ("soldier_bounty",    "a bounty hunter soldier in golden armor, side view facing right", 16, 20),
  ("soldier_ghost",     "a ghost operative in violet stealth suit, side view facing right", 16, 20),
  # 僵尸 10 类
  ("zombie_walker",  "a walking zombie in tattered military uniform, green skin, side view facing left", 16, 18),
  ("zombie_fatty",   "a heavy obese zombie in brown tattered clothes, side view facing left", 16, 18),
  ("zombie_king",    "a giant armored zombie king boss with red helmet, side view facing left", 16, 18),
  ("zombie_screamer","a zombie with open screaming mouth, purple aura, side view facing left", 16, 12),
  ("zombie_crawler", "a low crawling quadruped zombie, side view facing left", 16, 10),
  ("zombie_thrower", "a zombie holding a green acid canister to throw, side view facing left", 16, 12),
  ("zombie_spore",   "a bloated zombie with green spores on head, side view facing left", 16, 12),
  ("zombie_tank",    "a heavy armored zombie in steel plates, side view facing left", 16, 14),
  ("zombie_boomer",  "a suicide bomber zombie with orange glowing bomb on chest, side view facing left", 16, 12),
  ("zombie_dropper", "a paratrooper zombie with orange parachute, side view", 16, 14),
  ("zombie_civ",     "a civilian hostage person in gray coat, side view facing right", 12, 16),
  # 建筑 6 类(16x14)
  ("bld_barracks", "a military barracks building hut, pixel top-down isometric", 16, 14),
  ("bld_workshop", "a workshop building with gear and tools, pixel top-down isometric", 16, 14),
  ("bld_kitchen",  "a kitchen/canteen building with pot, pixel top-down isometric", 16, 14),
  ("bld_medbay",   "a medical bay building with red cross, pixel top-down isometric", 16, 14),
  ("bld_wall",     "a short defensive wall segment, gray bricks, pixel top-down isometric", 16, 14),
  ("bld_radio",    "a radio tower building, pixel top-down isometric", 16, 14),
  # 装备/装置
  ("turret",       "a gray sentry machine gun turret with twin barrels and warning light, side view", 16, 14),
  ("ammo_station", "an orange ammo supply crate station with bullets and AMMO sign, side view", 18, 16),
]

def gen(name, obj_desc, w, h):
    prompt = PIX.format(obj=obj_desc)
    body = json.dumps({"model":"agnes-image-2.1-flash","prompt":prompt,"n":1,"size":"512x512"})
    r = subprocess.run(["curl","-s","-m","90","-X","POST",
        "https://apihub.agnes-ai.com/v1/images/generations",
        "-H",f"Authorization: Bearer {KEY}","-H","Content-Type: application/json","-d",body],
        capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
        url = d["data"][0]["url"]
    except Exception as e:
        print(f"  [ERR] {name}: {r.stdout[:200]}"); return None
    # 下载
    subprocess.run(["curl","-s","-m","30","-o",f"{OUT}/{name}.png",url],check=True)
    print(f"  [ok] {name} ({w}x{h}) -> {url[:60]}...")
    return url

if __name__=="__main__":
    only = sys.argv[1:] if len(sys.argv)>1 else None
    for name, obj, w, h in items:
        if only and name not in only: continue
        print(f"[gen] {name}")
        gen(name, obj, w, h)
        time.sleep(1)
    print("DONE")
