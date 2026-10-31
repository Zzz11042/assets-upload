import os, io, base64, json, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dewhiten import dewhiten, crop_subject

GEN = "/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"
OUT_JS = "/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen/sprites.js"

# (name, target_w, target_h, crop_hint)  按文件名映射
TARGET = {
  "soldier_infantry":(16,20),"soldier_gunner":(16,20),"soldier_sniper":(16,20),
  "soldier_medic":(16,20),"soldier_engineer":(16,20),"soldier_bounty":(16,20),"soldier_ghost":(16,20),
  "zombie_walker":(16,18),"zombie_fatty":(16,18),"zombie_king":(16,18),
  "zombie_screamer":(16,12),"zombie_crawler":(16,10),"zombie_thrower":(16,12),
  "zombie_spore":(16,12),"zombie_tank":(16,14),"zombie_boomer":(16,12),"zombie_dropper":(16,14),
  "zombie_civ":(12,16),
  "bld_barracks":(16,14),"bld_workshop":(16,14),"bld_kitchen":(16,14),
  "bld_medbay":(16,14),"bld_wall":(16,14),"bld_radio":(16,14),
  "turret":(16,14),"ammo_station":(18,16),
}

def crop_subject(im):
    """去白/灰边(白底+灰渐变底→透明, 含羽化) + 非透明包围盒裁剪, 留少量 padding"""
    im = dewhiten(im)
    im = im.convert("RGBA")
    import numpy as np
    arr = np.array(im)
    mask = arr[:,:,3] > 8
    ys, xs = np.where(mask)
    if len(xs)==0: return im
    x0,x1 = xs.min(), xs.max(); y0,y1 = ys.min(), ys.max()
    pad = 2
    x0=max(0,x0-pad); y0=max(0,y0-pad); x1=min(im.width-1,x1+pad); y1=min(im.height-1,y1+pad)
    return im.crop((x0,y0,x1+1,y1+1))

def quantize_16bit(im):
    """降到 ≤16 色调色板, 保持像素风"""
    q = im.convert("RGBA").quantize(colors=16, method=2)
    return q.convert("RGBA")

def _clear_white_residue(q_im, ring=3, mn_th=230):
    """量化后清除纯白残留(254,254,254) → 透明;
    再清除最外层 ring px 环中不透明且近白(mn>mn_th)的边缘残留(保护角色本体)。"""
    import numpy as np
    arr = np.array(q_im).copy()
    r,g,b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    a = arr[:,:,3]
    # 1) 全图纯白 → 透明
    pure_white = (r>250) & (g>250) & (b>250)
    arr[pure_white, 3] = 0
    # 2) 最外层环内近白(角色白衣触边/背景残留) → 透明
    mn = arr[:,:,:3].min(axis=2)
    h,w = a.shape
    e = np.zeros_like(a,bool); e[:ring]=True; e[-ring:]=True; e[:,:ring]=True; e[:,-ring:]=True
    ring_mask = e & (a>0) & (mn>mn_th)
    arr[ring_mask, 3] = 0
    return Image.fromarray(arr, "RGBA")

def make_sprite(name, src):
    tw,th = TARGET[name]
    im = Image.open(src).convert("RGBA")
    im = crop_subject(im)
    # 按目标宽高比裁剪 (center-crop)
    cur_w, cur_h = im.size
    target_ratio = tw/th
    cur_ratio = cur_w/cur_h
    if cur_ratio > target_ratio:
        new_w = int(cur_h*target_ratio)
        off = (cur_w-new_w)//2
        im = im.crop((off,0,off+new_w,cur_h))
    else:
        new_h = int(cur_w/target_ratio)
        off = (cur_h-new_h)//2
        im = im.crop((0,off,cur_w,off+new_h))
    im = im.resize((tw,th), Image.Resampling.NEAREST)
    im = quantize_16bit(im)
    # 量化后清除纯白残留 (254,254,254 等量化白底灰边映射产物) → 透明
    im = _clear_white_residue(im)
    buf = io.BytesIO(); im.save(buf,"PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return tw,th,b64,im

if __name__=="__main__":
    results = {}
    for name,(tw,th) in TARGET.items():
        src = os.path.join(GEN, name+".png")
        if not os.path.exists(src):
            print(f"[skip] {name} missing"); continue
        spw,spH,b64,pil = make_sprite(name,src)
        results[name] = {"w":spw,"h":spH,"b64":b64}
        print(f"[ok] {name} {spw}x{spH} b64={len(b64)}")
    # 写 JS 模块
    with open(OUT_JS,"w") as f:
        f.write("/* 自动生成: agnes-image-2.1-flash 像素风 sprite base64 嵌入表 (27 项)\n")
        f.write("   由 gen/quantize.py 生成; 游戏内 loadAgnesSprites() 解析后替换程序化像素绘 */\n")
        f.write("const AGNES_SPRITES = {")
        for name,r in results.items():
            f.write(f'\n  {json.dumps(name)}:{{w:{r["w"]},h:{r["h"]},d:"data:image/png;base64,{r["b64"]}"}},')
        f.write("\n};\n")
    print("WROTE", OUT_JS, os.path.getsize(OUT_JS), "bytes")
