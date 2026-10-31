"""生成像素风营地背景 tile (48x48, 无缝平铺):
   - 暖沙土地面 + 草地斑块
   - 篝火(左上)  帐篷(右上)  栅栏段(下边)  木箱+旗帜(中)
   输出 gen/camp_bg.png (48x48), 供 quantize_ui.py 或独立 b64 注入 index.html 作营地地皮
"""
from PIL import Image
import numpy as np, io, base64, os

GEN="/home/zzz/Documents/deepseek-harness/default-workspace/ares-squad/web/gen"
P=48

def ground_layer():
    """暖沙土: 主色 #4a3c2a, 浅沙 #5c4c38, 暗坑 #3a2e20, 草地斑块 #4a5a30"""
    base=np.array(Image.new("RGB",(P,P),(74,60,42))).astype(np.int32)
    rng=np.random.default_rng(7)
    # 细沙颗粒
    for _ in range(300):
        x,y=int(rng.integers(0,P)),int(rng.integers(0,P))
        base[y,x]=rng.choice([[92,76,56],[60,48,34],[82,66,46]])
    # 草地斑块(3 处)
    for (cx,cy,rr) in [(8,30,4),(34,10,3),(26,38,5)]:
        for y in range(P):
            for x in range(P):
                for dx,dy,dd in [(x-cx,y-cy,0),((x-cx+P)%P if (x-cx)<0 else (x-cx)-P,y-cy,0),((x-cx)+P,y-cy,0)]:
                    pass
        # 简单: 斑块以中心+环绕
        for y in range(max(0,cy-rr),min(P,cy+rr+1)):
            for x in range(max(0,cx-rr),min(P,cx+rr+1)):
                d=((x-cx)**2+(y-cy)**2)**0.5
                if d<rr: base[y,x]=[74,90,48]
                elif d<rr+1: base[y,x]=[64,80,40]
    # 石块
    for (sx,sy) in [(2,2),(40,44),(12,42),(44,4),(20,46)]:
        base[sy,sx]=[90,84,70]; base[sy,sx+1]=[80,74,60]
    return base

def put(px,x,y,col):
    if 0<=x<P and 0<=y<P: px[y,x]=col

def draw_tents(px):
    """右上帐篷: 3 顶, 军绿/暗红"""
    for (bx,by,w) in [(30,2,12),(36,10,10),(26,8,8)]:
        for i in range(w):
            x=bx+i
            # 帐篷三角: 顶窄底宽
            h=(i*2//w if i<w//2 else (w-1-i)*2//w)  # 山峰
            for y in range(by+h,by+max(h+1,4)):
                put(px,x,y,(58,74,44) if bx>28 else (86,52,44))
        # 帐篷门(暗)
        put(px,bx+w//2,by+max(w//2,2),(30,36,24))
    # 帐篷杆
    for bx in (30,36,26): put(px,bx,by:=None and 0,(120,110,90)) if False else None

def draw_campfire(px):
    """左上篝火: 石圈 + 火焰(橙红) + 木柴"""
    for y in range(0,9):
        for x in range(0,9):
            d=((x-4.5)**2+(y-5)**2)**0.5
            if 2.6<d<3.6: put(px,x,y,(88,80,70))
    put(px,4,5,(190,90,30)); put(px,3,6,(210,120,40)); put(px,5,6,(210,120,40))
    put(px,4,4,(240,200,80)); put(px,4,3,(250,230,120))
    for x in range(3,7): put(px,6,x,(70,50,30))  # 木柴

def draw_fences(px):
    """下边一段栅栏"""
    for y in range(40,44):
        for x in (2,10,18,26,34,42):
            put(px,x,y,(110,90,60))
    put(px,0,41,(120,100,70))  # 横木(只画可见区)
    for x in range(0,P):
        put(px,x,41,(100,84,56))
    for x in range(0,P):
        put(px,x,43,(90,74,50))

def draw_crate(px):
    """中下木箱 + 旗帜"""
    for y in range(30,38):
        for x in range(20,30):
            if x in(20,29) or y in(30,37): put(px,x,y,(120,94,56))
            else: put(px,x,y,(96,76,48))
    put(px,24,32,(60,48,34)); put(px,24,34,(60,48,34))  # 箱上十字
    # 旗杆
    for y in range(14,30): put(px,32,y,(140,130,110))
    # 旗帜(红色三角)
    for i in range(5):
        for j in range(5-i):
            put(px,33+i,14+j,(180,60,50))
    put(px,32,13,(200,190,150))

def build():
    px=ground_layer()
    draw_campfire(px)
    draw_fences(px)
    draw_crate(px)
    # 帐篷最后画(避免被旗杆遮挡错位)
    for (bx,by) in [(30,2),(36,10),(26,8)]:
        w = 12 if bx==30 else (10 if bx==36 else 8)
        for i in range(w):
            x=bx+i
            hh=(i*2//w) if i<w//2 else ((w-1-i)*2//w)
            for y in range(by+hh, by+max(hh+1,4)):
                put(px,x,y,(58,74,44) if bx>=30 else (96,58,48))
        put(px,bx+w//2, by+max(2, w//2), (28,34,22))
    img=Image.fromarray(px.astype(np.uint8)).convert("RGBA")
    return img

if __name__=="__main__":
    img=build()
    img.save(f"{GEN}/camp_bg.png")
    # 2x 放大预览
    img.resize((P*10,P*10),Image.Resampling.NEAREST).save(f"{GEN}/camp_bg_preview.png")
    buf=io.BytesIO(); img.save(buf,"PNG")
    b64=base64.b64encode(buf.getvalue()).decode()
    open(f"{GEN}/camp_bg_b64.txt","w").write("data:image/png;base64,"+b64)
    print("camp_bg.png 48x48  saved, b64 len=",len(b64))
