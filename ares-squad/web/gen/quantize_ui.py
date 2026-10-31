import os, io, base64, json, sys
from PIL import Image
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dewhiten import crop_subject

GEN="/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"

def _clear_pure_white(im):
    """清除量化后 254,254,254 纯白残留(量化把白底灰边映射成纯白) → 透明"""
    arr = np.array(im.convert("RGBA")).copy()
    r,g,b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    pure = (r>250) & (g>250) & (b>250)
    arr[pure, 3] = 0
    return Image.fromarray(arr, "RGBA")

def _flood_gray_bg(im, tol=45):
    """对灰底立绘做四角泛洪去背景: 从4角开始, 与角色距离<tol的连通块 → 透明"""
    import collections
    a = np.array(im.convert("RGBA")).copy()
    h,w = a.shape[:2]
    if h<4 or w<4: return Image.fromarray(a,"RGBA")
    # 采样4角色
    corners = [a[0,0,:3], a[0,w-1,:3], a[h-1,0,:3], a[h-1,w-1,:3]]
    bg = np.array(corners, dtype=np.float32).mean(axis=0)
    # 从4角BFS
    dist = np.sqrt(((a[:,:,:3].astype(np.float32) - bg)**2).sum(axis=2))
    mask = dist < tol
    seen = np.zeros((h,w), bool)
    q = collections.deque()
    for (sy,sx) in [(0,0),(0,w-1),(h-1,0),(h-1,w-1)]:
        if mask[sy,sx] and not seen[sy,sx]:
            seen[sy,sx]=True; q.append((sy,sx))
    while q:
        y,x = q.popleft()
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                ny,nx = y+dy,x+dx
                if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True; q.append((ny,nx))
    a[seen, 3] = 0
    # 泛洪区外的近白过渡带也清除
    mn = a[:,:,:3].min(axis=2)
    near_white_outside = (~seen) & (mn > 240)
    a[near_white_outside, 3] = 0
    return Image.fromarray(a, "RGBA")

def _ring_clear_white(im, ring=3, mn_th=230):
    """清除立绘最外层 ring px 环中不透明且近白(mn>mn_th)的残留 → 透明
    (保护环内的角色本体, 只清边缘背景残留)"""
    arr = np.array(im.convert("RGBA")).copy()
    a = arr[:,:,3]; mn = arr[:,:,:3].min(axis=2)
    h,w = a.shape
    e = np.zeros_like(a,bool); e[:ring]=True; e[-ring:]=True; e[:,:ring]=True; e[:,-ring:]=True
    mask = e & (a>0) & (mn>mn_th)
    arr[mask,3]=0
    return Image.fromarray(arr,"RGBA")

def fit_square(im,size):
    im=crop_subject(im)
    w,h=im.size
    m=max(w,h)
    canvas=Image.new("RGBA",(m,m),(0,0,0,0))
    canvas.paste(im,((m-w)//2,(m-h)//2))
    return canvas.resize((size,size),Image.Resampling.NEAREST)

def b64(im):
    buf=io.BytesIO(); im.save(buf,"PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

# 立绘: 64x64, 16 色量化 + 清纯白
portraits={}
for name in ["portrait_infantry","portrait_gunner","portrait_sniper","portrait_medic","portrait_engineer","portrait_bounty","portrait_ghost"]:
    src=f"{GEN}/{name}.png"
    if not os.path.exists(src): print("missing",name); continue
    im=Image.open(src)
    im=crop_subject(im)
    # 若 crop 后主体仍然全不透明(dewhiten 没去掉灰底), 用四角泛洪补
    a0 = np.array(im)[:,:,3]
    if (a0==0).mean() < 0.05:
        im=_flood_gray_bg(im, tol=45)
        a0b = np.array(im)[:,:,3]
        print(f"{name}: 灰底泛洪 alpha0 {(a0==0).mean()*100:.0f}%→{(a0b==0).mean()*100:.0f}%")
    im=fit_square(im,64)
    # Pillow quantize() 会把 alpha=0 的透明区填成不透明, 量化前记住透明掩码
    a_pre = np.array(im)[:,:,3]
    im=im.quantize(colors=16,method=2).convert("RGBA")
    # 恢复量化前透明的区域
    arr = np.array(im).copy()
    arr[a_pre==0, 3] = 0
    im = Image.fromarray(arr,"RGBA")
    im=_clear_pure_white(im)
    im=_ring_clear_white(im, ring=3, mn_th=230)
    portraits[name]=im
    print(name, im.size, len(b64(im)), "b64")

# 图标16: 16x16 24 色 (第 12 轮 icons16 表, 不量化 — 16px 源细节够用)
icons16={}
for name in ["icon_gold2","icon_part2","icon_food2","icon_med2","icon_grenade2","icon_rocket2","icon_mode","icon_pause2","icon_make","icon_bld","icon_squad"]:
    src=f"{GEN}/{name}.png"
    if not os.path.exists(src): print("missing16",name); continue
    im=fit_square(Image.open(src),16)
    icons16[name]=im
    print(name, im.size, len(b64(im)), "b64(16)")

# 图标24: 24x24 16 色量化
icons={}
for name in ["icon_gold","icon_part","icon_food","icon_med","icon_grenade","icon_rocket","icon_form","icon_pause"]:
    src=f"{GEN}/{name}.png"
    if not os.path.exists(src): print("missing24",name); continue
    im=fit_square(Image.open(src),24)
    im=im.quantize(colors=16,method=2).convert("RGBA")
    icons[name]=im
    print(name, im.size, len(b64(im)), "b64(24)")

# 写 JS 表
out=[]
out.append("/* 自动生成: agnes 立绘 + UI 图标 base64 (立绘修复+营地背景版) */")
out.append("const AGNES_UI = {")
out.append("  portraits: {")
for k,im in portraits.items():
    out.append(f'    {json.dumps(k)}:"{b64(im)}",')
out.append("  },")
out.append("  icons16: {")
for k,im in icons16.items():
    out.append(f'    {json.dumps(k)}:"{b64(im)}",')
out.append("  },")
out.append("  icons: {")
for k,im in icons.items():
    out.append(f'    {json.dumps(k)}:"{b64(im)}",')
out.append("  },")
# 营地背景 48x48 无缝 tile (gen_camp_bg.py 生成: 暖沙土+帐篷/篝火/栅栏/木箱旗帜)
if os.path.exists(GEN+"/camp_bg.png"):
    _cb = "data:image/png;base64," + base64.b64encode(open(GEN+"/camp_bg.png","rb").read()).decode()
    out.append("  camp_bg: \"" + _cb + "\",")
    out.append("  camp_bg_w: 48,")
    out.append("  camp_bg_h: 48,")
    print("camp_bg: 48x48 tile 已嵌入")
out.append("};")
open(f"{GEN}/ui_sprites.js","w").write("\n".join(out))
print("WROTE", f"{GEN}/ui_sprites.js", os.path.getsize(f"{GEN}/ui_sprites.js"), "bytes")
