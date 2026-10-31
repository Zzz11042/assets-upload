#!/usr/bin/env python3
"""生成顾客精灵表: 每个变体独立放大 + 横向 8px 间隙, 防止立绘粘连。

输出: art/gen/peds_sheet_200x48.png (6 变体 × 32px 槽位, 32=28 内容 + 4 间隙)
- 源: art/gen/peds_final.png (96×24 RGBA, 6 变体 × 16px)
- 每变体: 2x NEAREST 放大 28×48 (像素硬边), 放入 32px 槽位 (左侧 28 + 右侧 4 间隙)
- 间隙区全透明, 相邻立绘绝不接触
- FASTOCTREE 48 色量化 + b64 内联 (写入 web/index.html 的 ARTX.peds)
CSS 侧: .cus 28×48, background-size 200px 48px, backgroundPosition -32v px 0
"""
import base64, re, sys
from PIL import Image

SRC = 'art/gen/peds_final.png'
OUT = 'art/gen/peds_sheet_240x48.png'
SCALE = 2
GAP = 8            # 变体间透明间隙
UNIT = 16          # 源变体宽
NVAR = 6

def main():
    src = Image.open(SRC).convert('RGBA')
    assert src.size == (96, 24), f'源图 {src.size} != 96x24'
    srcw, srch = 16, 24
    fig_w = srcw * SCALE        # 32 (2x 放大, 像素硬边)
    unit_w = fig_w + GAP        # 32 + 8 = 40
    out_w = unit_w * NVAR       # 240
    out_h = srch * SCALE        # 48
    sheet = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    for i in range(NVAR):
        cell = src.crop((i * srcw, 0, (i + 1) * srcw, srch))
        big = cell.resize((fig_w, out_h), Image.NEAREST)
        sheet.paste(big, (i * unit_w, 0), big)
    # 校验: 每 40px 单元, 前 32px 为立绘内容区, 后 8px 为全透明间隙
    px = sheet.load()
    for i in range(NVAR):
        gap_ys = []
        for x in range(i * unit_w + fig_w, (i + 1) * unit_w):
            for y in range(out_h):
                if px[x, y][3] > 30: gap_ys.append((x, y))
        assert not gap_ys, f'变体{i} 间隙区有不透明像素 {gap_ys[:5]}'
        # 立绘内容区不透明范围
        cys = [y for x in range(i * unit_w, i * unit_w + fig_w) for y in range(out_h) if px[x, y][3] > 30]
        lo, hi = min(cys), max(cys)
        print(f'变体{i}: 立绘 y {lo}~{hi} (高 {hi - lo + 1}), 右 8px 间隙全透明 ✓')
    sheet.save(OUT, optimize=True)
    b64 = 'data:image/png;base64,' + base64.b64encode(open(OUT, 'rb').read()).decode()
    print(f'{OUT}: {sheet.size}, {len(open(OUT, "rb").read())} B, b64 {len(b64)} 字符')
    ih = open('web/index.html').read()
    nh = re.sub(r'peds:"data:image/png;base64,[A-Za-z0-9+/=]+"',
                'peds:"' + b64 + '"', ih, count=1)
    assert nh != ih, 'ARTX.peds 未找到'
    open('web/index.html', 'w').write(nh)
    print('ARTX.peds 已替换为带间隙版本')
    print(f'CSS: .cus width:{fig_w}px;height:{out_h}px;background-size:{out_w}px {out_h}px')
    print(f'JS:  c.style.backgroundPosition=(-{unit_w}*variant)+\'px 0px\'')

if __name__ == '__main__':
    main()
