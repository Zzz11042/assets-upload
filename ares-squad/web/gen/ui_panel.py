"""像素 UI 面板纹理: 64x64 深木色面板 tile (供 CSS background-image 使用, 平铺)"""
from PIL import Image
import numpy as np, io, base64
rng=np.random.default_rng(42)
P=64
# 深木色面板: 主 #1a140c, 木纹条 #241c12, 高亮缝 #2c2218, 暗缝 #120e08
base=np.full((P,P,3),(26,20,12),dtype=np.uint8)
for y in range(P):
    for x in range(P):
        n=((x*7+y*13)%9)
        if n==0: base[y,x]=[36,28,18]
        elif n==3: base[y,x]=[18,14,8]
# 每 16 行一条横向暗缝(木板缝)
for fy in (15,31,47):
    base[fy,:]=[12,9,5]
    base[fy+1,:]=[40,32,20]  # 缝下亮线
# 少量木节
for (kx,ky) in [(10,8),(50,24),(28,56)]:
    for y in range(ky-2,ky+3):
        for x in range(kx-2,kx+3):
            if 0<=x<P and 0<=y<P:
                d=((x-kx)**2+(y-ky)**2)**0.5
                if d<1.5: base[y,x]=[14,10,6]
img=Image.fromarray(base).convert("RGBA")
# 4x 放大再缩小到 128 让 CSS 平铺块不至于太密
buf=io.BytesIO(); img.save(buf,"PNG")
b64="data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode()
open("ui_panel_b64.txt","w").write(b64)
open("ui_panel.png","wb").write(buf.getvalue())
print("ui_panel.png", img.size, "len=",len(b64))
