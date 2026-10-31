import os, collections
from PIL import Image

def remove_bg(src, threshold=220):
    im=Image.open(src).convert('RGBA')
    w,h=im.size
    px=im.load()
    visited=set(); q=collections.deque()
    for x in range(w):
        for y in (0,h-1): q.append((x,y)); visited.add((x,y))
    for y in range(h):
        for x in (0,w-1): q.append((x,y)); visited.add((x,y))
    while q:
        x,y=q.popleft()
        r,g,b,a=px[x,y]
        if a>200 and r>threshold and g>threshold and b>threshold and abs(r-g)<25 and abs(g-b)<25:
            px[x,y]=(255,255,255,0)
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny=x+dx,y+dy
                if 0<=nx<w and 0<=ny<h and (nx,ny) not in visited:
                    visited.add((nx,ny)); q.append((nx,ny))
    return im

def make_out(src, out, size, colors=48):
    im=remove_bg(src)
    bbox=im.getchannel('A').getbbox()
    if bbox: im=im.crop(bbox)
    im=im.resize(size,Image.LANCZOS)
    q=im.quantize(colors=colors,method=Image.Quantize.FASTOCTREE)
    q.save(out,optimize=True)
    return os.path.getsize(out)

# HUD 6 个 -> 32x32
for f in ['hud_money','hud_day','hud_cust','hud_tax','hud_level','hud_invest']:
    sz=make_out(f+'.png', f'{f}_32.png', (32,32), 32)
    print(f'{f}_32: {sz}B')

# 8 协同 -> 40x40
for f in ['syn_onestop','syn_family','syn_work','syn_shop','syn_health','syn_fin','syn_lux','syn_kids']:
    sz=make_out(f+'.png', f'{f}_40.png', (40,40), 40)
    print(f'{f}_40: {sz}B')

# 22 成就 -> 40x40
for i,name in enumerate(['a_first','a_ten','a_maxed','a_expand1','a_expand2','a_expand3','a_expand4','a_50k','a_100k','a_500k','a_10day','a_30day','a_20k','a_50k_c','a_all9','a_lv3','a_synergy','a_allshop','a_5syn','a_chain','a_invest3','a_20k_new']):
    sz=make_out(f'ach_{name}.png', f'ach_{name}_40.png', (40,40), 40)
    print(f'ach_{name}_40: {sz}B')

# logo -> 64x64
sz=make_out('logo_new.png','logo_stardew_64.png',(64,64),64)
print(f'logo_stardew_64: {sz}B')

# 统计
total=0
import glob
for f in glob.glob('hud_*_32.png')+glob.glob('syn_*_40.png')+glob.glob('ach_*_40.png')+['logo_stardew_64.png']:
    total+=os.path.getsize(f)
print(f'UI 素材总计: {total}B ({total/1024:.1f}KB)')
