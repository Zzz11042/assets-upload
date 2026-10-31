#!/usr/bin/env python3
"""
免费像素素材生成器(无 key/无注册/无每日限额/无水印)
主后端: Pollinations image.pollinations.ai  (sana/flux 模型, 秒级出图)
备选:   veida.ai 匿名档 (带水印, 每 IP 每日约 7 张)

流程: 文生图 -> 中心裁剪 -> 背景移除(可选) -> 32x32 像素化 -> 星露谷调色板量化 -> 最近邻 256 预览 -> sprite sheet 网格
"""
import urllib.request, urllib.parse, time, os, sys
from collections import Counter
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # workspace
FINAL = os.path.join(BASE, 'pixel-assets', 'final')
RAW = os.path.join(BASE, 'pixel-assets', 'raw')
os.makedirs(FINAL, exist_ok=True); os.makedirs(RAW, exist_ok=True)

# 星露谷风格调色板 (38 色)
PALETTE = [
 (0,0,0),(44,32,58),(89,33,81),(129,36,92),(166,43,99),
 (193,64,95),(197,94,84),(163,103,117),(138,78,100),(92,54,56),
 (36,48,31),(60,80,46),(97,108,45),(135,139,45),(153,158,70),
 (164,174,96),(162,181,113),(133,169,94),(115,151,69),(88,122,74),
 (67,76,60),(42,37,22),(79,67,38),(114,98,60),(140,113,61),
 (161,134,58),(192,175,101),(227,217,168),(239,239,239),(170,172,178),
 (102,98,123),(51,47,85),(255,255,255),(155,186,221),(84,100,125),
 (54,56,86),(31,30,54),
]

def pollinations(prompt, out, w=512, h=512, seed=None, model='default', max_retry=4):
    enc = urllib.parse.quote(prompt, safe='')
    params = {'width': w, 'height': h, 'nologo': 'true', 'model': model}
    if seed is not None:
        params['seed'] = seed
    url = f"https://image.pollinations.ai/prompt/{enc}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'pixel-art-pipeline/1.0'})
    for attempt in range(max_retry):
        t0 = time.time()
        try:
            with open(out, 'wb') as f:
                f.write(urllib.request.urlopen(req, timeout=180).read())
            print(f'  pollinations -> {os.path.basename(out)} ({time.time()-t0:.0f}s)')
            return out
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:200]
            if e.code == 402 and attempt < max_retry - 1:
                wait = 50
                print(f'  [rate-limit] 等待 {wait}s 后重试 ({attempt+1}/{max_retry}): {body}')
                time.sleep(wait)
                continue
            raise
    raise RuntimeError('pollinations 重试耗尽')

def pixelate(src, out, size=32, palette=PALETTE, bg_remove=False, preview=8):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w-s)//2, (h-s)//2, (w+s)//2, (h+s)//2))
    if bg_remove:
        samples = []
        for x in range(0, s, max(1, s//12)):
            samples += [im.getpixel((x, 0)), im.getpixel((x, s-1)),
                        im.getpixel((0, x)), im.getpixel((s-1, x))]
        bg = Counter(samples).most_common(1)[0][0]
        a = im.getchannel('A'); px = im.load()
        for yy in range(s):
            for xx in range(s):
                r, g, b, _ = px[xx, yy]
                if abs(r-bg[0]) < 28 and abs(g-bg[1]) < 28 and abs(b-bg[2]) < 28:
                    a.putpixel((xx, yy), 0)
        im.putalpha(a)
    small = im.resize((size, size), Image.LANCZOS)
    ppx = small.load()
    for yy in range(size):
        for xx in range(size):
            r, g, b, al = ppx[xx, yy]
            if al == 0:
                ppx[xx, yy] = (0, 0, 0, 0); continue
            best, bd = None, 1e9
            for c in palette:
                d = (r-c[0])**2 + (g-c[1])**2 + (b-c[2])**2
                if d < bd:
                    bd, best = d, c
            ppx[xx, yy] = (*best, 255)
    small.save(out)
    preview_img = small.resize((size*preview, size*preview), Image.NEAREST)
    preview_img.save(out.replace('.png', '_preview.png'))
    return out

def grid_sheet(frames, out, cell=256, pad=10):
    n = len(frames)
    import math
    cols = int(math.ceil(n ** 0.5)); rows = (n + cols - 1) // cols
    sheet = Image.new('RGBA', (cols*cell+(cols+1)*pad, rows*cell+(rows+1)*pad), (24, 22, 30, 255))
    for i, f in enumerate(frames):
        prev = f.replace('.png', '_preview.png')
        if not os.path.exists(prev):
            im = Image.open(f).convert('RGBA')
            im.resize((im.width*8, im.height*8), Image.NEAREST).save(prev)
        img = Image.open(prev).convert('RGBA')
        x = pad + (i % cols)*(cell+pad); y = pad + (i//cols)*(cell+pad)
        sheet.paste(img, (x, y), img)
    sheet.save(out)
    print(f'  sheet -> {out} ({cols}x{rows})')

if __name__ == '__main__':
    tasks = [
        ('slime',   '32x32 pixel art slime enemy, cute green blob with simple face, retro rpg style, game asset, clean pixels, centered, dark background', 11, True),
        ('potion',  '32x32 pixel art red potion bottle item icon, retro rpg style, game asset, clean pixels, centered, dark background', 22, True),
        ('mushroom','32x32 pixel art red mushroom item, retro rpg style, game asset, clean pixels, centered, dark background', 33, True),
        ('skeleton','32x32 pixel art skeleton warrior enemy, retro rpg style, game asset, clean pixels, centered, dark background', 44, True),
        ('coin',    '32x32 pixel art gold coin item, retro rpg style, game asset, clean pixels, centered, dark background', 55, True),
        ('grass',   'seamless 32x32 pixel art grass ground tile, stardew valley style, uniform texture, tileable, no objects', 66, False),
    ]
    results = []
    for name, prompt, seed, bg in tasks:
        if os.path.exists(os.path.join(FINAL, f'{name}_32.png')):
            print(f'== {name} == (跳过, 已存在)')
            results.append(os.path.join(FINAL, f'{name}_32.png'))
            continue
        print(f'== {name} ==')
        src = os.path.join(RAW, f'poll_{name}.png')
        try:
            pollinations(prompt, src, seed=seed)
            time.sleep(46)  # 遵守 45s/IP 限流
        except Exception as e:
            print(f'  [!] pollinations 失败: {e}'); continue
        out = os.path.join(FINAL, f'{name}_32.png')
        pixelate(src, out, size=32, bg_remove=bg)
        results.append(out)
        time.sleep(1)
    if results:
        grid_sheet(results, os.path.join(FINAL, 'sprite_sheet_all.png'))
    print(f'生成 {len(results)}/{len(tasks)} 张:')
    for r in results:
        print(' ', r)
