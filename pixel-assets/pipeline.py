#!/usr/bin/env python3
"""
免费像素素材流水线:
1. veida.ai 匿名档文生图 (无 key, 每 client_id 1 张, 每 IP 每日 ~7 张, 1K 带水印)
2. 后处理: 背景移除(可选) -> 像素化 32x32 -> 调色板量化 -> 最近邻放大预览 -> 网格拼装
用法:
  python3 pipeline.py            # 跑一批示例素材
"""
import json, time, uuid, urllib.request, urllib.parse, os, sys, random
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
RAW, FINAL = os.path.join(BASE, 'raw'), os.path.join(BASE, 'final')
os.makedirs(RAW, exist_ok=True); os.makedirs(FINAL, exist_ok=True)

STARDW_PALETTE = [
    (0,0,0),(44,32,58),(89,33,81),(129,36,92),(166,43,99),
    (193,64,95),(197,94,84),(163,103,117),(138,78,100),(92,54,56),
    (36,48,31),(60,80,46),(97,108,45),(135,139,45),(153,158,70),
    (164,174,96),(162,181,113),(133,169,94),(115,151,69),(88,122,74),
    (67,76,60),(42,37,22),(79,67,38),(114,98,60),(140,113,61),
    (161,134,58),(192,175,101),(227,217,168),(239,239,239),(170,172,178),
    (102,98,123),(51,47,85),(255,255,255),(155,186,221),(84,100,125),
    (54,56,86),(31,30,54),
]

def veida_generate(prompt, model='veida-image-v1', timeout=90):
    cid = str(uuid.uuid4())
    body = {
        'mediaType': 'image',
        'scene': 'text-to-image',
        'provider': 'veida',
        'model': model,
        'prompt': prompt,
        'options': {'size': '1:1', 'output_format': 'png', 'n': 1},
    }
    req = urllib.request.Request(
        'https://veida.ai/api/ai/generate',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'x-anon-id': cid},
        method='POST',
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read())
    except Exception as e:
        print(f'  [!] generate 请求失败: {e}')
        return None, cid
    print(f"  raw response: {json.dumps(data, ensure_ascii=False)[:400]}")
    if data.get('code') != 0 or "id" not in data.get("data", {}):
        print(f'  [!] 提交失败: {data.get("message")}')
        return None, cid
    task_id = data['data']['id']
    provider = data['data'].get('provider', 'replicate')
    print(f'  ... task={task_id} charged={data["data"].get("charged")} remaining={data["data"].get("remaining")}')
    # 轮询
    for i in range(60):
        time.sleep(5)
        qurl = f'https://veida.ai/api/ai/anon-query?taskId={urllib.parse.quote(task_id)}&provider={urllib.parse.quote(provider)}'
        qr = urllib.request.Request(qurl, headers={'x-anon-id': cid})
        try:
            qd = json.loads(urllib.request.urlopen(qr, timeout=30).read())
        except Exception:
            continue
        st = qd.get('data', {}).get('status')
        if st in ('success',):
            imgs = qd['data'].get('images') or []
            if not imgs:
                print('  [!] success 但无图')
                return None, cid
            # 下载
            out = os.path.join(RAW, f'{uuid.uuid4().hex}.webp')
            dr = urllib.request.Request(imgs[0])
            with open(out, 'wb') as f:
                f.write(urllib.request.urlopen(dr, timeout=60).read())
            print(f'  ok -> {out}')
            return out, cid
        if st in ('failed', 'blocked'):
            print(f'  [!] 任务 {st}: {json.dumps(qd.get("data"), ensure_ascii=False)[:300]}')
            return None, cid
        else:
            print(f'  ... status={st} ({i+1})')
    print('  [!] 轮询超时')
    return None, cid

def pixelate(src, out, size=32, palette=STARDW_PALETTE, bg_remove=True, pad=4):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    # 正方形裁剪到中心
    s = min(w, h)
    im = im.crop(((w-s)//2, (h-s)//2, (w+s)//2, (h+s)//2))
    # 背景移除: 取四角+边缘众数为背景色
    if bg_remove:
        samples = []
        for x in range(0, s, max(1, s//20)):
            for y in [0, s-1, s//2]:
                samples.append(im.getpixel((x, y)))
        from collections import Counter
        bg = Counter(samples).most_common(1)[0][0]
        px = im.load()
        for yy in range(s):
            for xx in range(s):
                r,g,b = px[xx,yy]
                if abs(r-bg[0])<28 and abs(g-bg[1])<28 and abs(b-bg[2])<28:
                    px[xx,yy] = (0,0,0)
        im.putalpha(Image.eval(im.convert('L'), lambda v: 0))
        im = im.convert('RGBA')
        # 按亮度>35 保留
        a = im.getchannel('A')
        for yy in range(s):
            for xx in range(s):
                l = im.getpixel((xx,yy))
                if l[0]==0 and l[1]==0 and l[2]==0:
                    a.putpixel((xx,yy), 0)
        im.putalpha(a)
    else:
        im = im.convert('RGBA')
    small = im.resize((size, size), Image.LANCZOS)
    # 调色板量化: 每个像素映射到最近色
    ppx = small.load()
    for yy in range(size):
        for xx in range(size):
            r,g,b,al = ppx[xx,yy]
            if al == 0:
                ppx[xx,yy] = (0,0,0,0); continue
            best, bd = None, 1e9
            for c in palette:
                d = (r-c[0])**2 + (g-c[1])**2 + (b-c[2])**2
                if d < bd: bd, best = d, c
            ppx[xx,yy] = (*best, 255)
    # 最近邻放大预览
    preview = small.resize((size*8, size*8), Image.NEAREST)
    preview.save(out)
    small.save(out.replace('.png', '_32.png'))
    return out

def grid_sheet(frames, out, cols=None, cell=256, pad=8):
    n = len(frames)
    cols = cols or int(n**0.5) or 1
    rows = (n + cols - 1)//cols
    sheet = Image.new('RGBA', (cols*cell + (cols+1)*pad, rows*cell + (rows+1)*pad), (0,0,0,0))
    for i, f in enumerate(frames):
        img = Image.open(f).convert('RGBA')
        x = pad + (i%cols)*(cell+pad)
        y = pad + (i//cols)*(cell+pad)
        sheet.paste(img, (x,y), img)
    sheet.save(out)
    print(f'  sheet -> {out} ({cols}x{rows})')

if __name__ == '__main__':
    tasks = [
        ('knight', '32x32 pixel art knight sprite, stardew valley style, game asset, clean pixels, simple dark outline, centered'),
        ('slime', '32x32 pixel art slime enemy, cute green blob with face, retro rpg style, game asset, centered'),
        ('potion', '32x32 pixel art red potion bottle item icon, retro rpg style, game asset, centered'),
        ('grass', 'seamless 32x32 pixel art grass ground tile, stardew valley style, uniform texture, no objects, tileable'),
    ]
    results = []
    for name, prompt in tasks:
        print(f'== {name} ==')
        path, cid = veida_generate(prompt)
        if not path:
            print(f'  [skip] {name} 生成失败')
            continue
        out = os.path.join(FINAL, f'{name}_32.png')
        bg = name != 'grass'
        pixelate(path, out, size=32, bg_remove=bg)
        results.append(out)
        time.sleep(2)
    if results:
        grid_sheet(results, os.path.join(FINAL, 'sprite_sheet.png'), cols=2, cell=256)
    print('done:', results)
