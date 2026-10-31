# -*- coding: utf-8 -*-
"""去白边: agnes 生图白/灰底 → 透明
检测策略:
  1. 采样四边 ring 环带平均色 → 背景色估计 (剔除近白 >238 的样本)
  2. 若背景色是"浅色"(RGB 均值 >180) 且接近灰色(|R-G|<25) → 判为背景底
  3. 与背景色距离 <tol 的像素 → 透明; tol~tol+8 → 线性羽化
  4. 纯白底(背景色 >238)走白底分支: 近白 >238 透明, 228~238 羽化
  5. 仅当背景区占画面 >6% 才启用, 防止误伤浅色角色
"""
from PIL import Image
import numpy as np

def _edge_bg_color(a, ring=24):
    h, w = a.shape[:2]
    h2, w2 = max(0, h - ring), max(0, w - ring)
    band = np.concatenate([
        a[:ring, :].reshape(-1, 4), a[h2:, :].reshape(-1, 4),
        a[:, :ring].reshape(-1, 4), a[:, w2:].reshape(-1, 4)
    ])
    m = ~((band[:, 0] > 238) & (band[:, 1] > 238) & (band[:, 2] > 238))
    if m.sum() < 16:
        # 环带全是近白 → 背景就是纯白
        return np.array([255.0, 255.0, 255.0, 255.0])
    return band[m].mean(axis=0)

def _flood_bg(m):
    """从四边 BFS 泛洪: 把"与背景色相似且连到边缘"的连通块判为背景(防止误伤角色内部同色区)"""
    h, w = m.shape
    stack = []
    for x in range(w):
        if m[0, x]: stack.append((0, x))
        if m[h-1, x]: stack.append((h-1, x))
    for y in range(h):
        if m[y, 0]: stack.append((y, 0))
        if m[y, w-1]: stack.append((y, w-1))
    seen2 = np.zeros((h, w), np.bool_)
    while stack:
        y, x = stack.pop()
        if seen2[y, x]: continue
        seen2[y, x] = True
        if x > 0 and m[y, x-1] and not seen2[y, x-1]: stack.append((y, x-1))
        if x+1 < w and m[y, x+1] and not seen2[y, x+1]: stack.append((y, x+1))
        if y > 0 and m[y-1, x] and not seen2[y-1, x]: stack.append((y-1, x))
        if y+1 < h and m[y+1, x] and not seen2[y+1, x]: stack.append((y+1, x))
    return seen2

def dewhiten(im, white_thresh=238, feather=10, tol=30, tol_feather=8):
    im = im.convert("RGBA")
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    bg = _edge_bg_color(a)
    mn_bg = min(bg[0], bg[1], bg[2])

    if mn_bg > 232:
        # ---- 白底分支: 近白 >238 透明, 228~238 羽化; 再用边缘泛洪兜住连到边缘的"浅近白" ----
        r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
        mn = np.minimum(np.minimum(r, g), b)
        near_white = mn > white_thresh
        semi = (mn > white_thresh - feather) & ~near_white
        m_blend = np.zeros((h, w), np.bool_)
        m_blend[near_white] = True
        m_blend[semi] = True
        # 泛洪: 连到边缘的"浅近白"区(mn > white_thresh - tol 且非纯白) 全判背景
        m_flood = (mn > white_thresh - tol) & ~near_white
        bg_flood = _flood_bg(m_flood)
        if bg_flood.sum() > 0.06 * h * w:
            a[bg_flood, 3] = 0.0
        a[near_white, 3] = 0.0
        # 羽化: 泛洪区外的近白过渡带 (228~238)
        a[semi, 3] = a[semi, 3] * (1.0 - ((mn[semi] - (white_thresh - feather)) / float(feather)).clip(0, 1))
    else:
        # ---- 灰/彩底分支(按距离 + 边缘泛洪, 防止误伤角色内同色区) ----
        dist = np.sqrt(((a[:, :, :3] - bg[:3]) ** 2).sum(axis=2))
        is_bg = dist < tol
        m_near = (dist >= tol) & (dist < tol + tol_feather)
        bg_flood = _flood_bg(is_bg)
        # 背景区要够大才判背景, 防止误伤角色内浅色
        if bg_flood.sum() > 0.06 * h * w or is_bg.sum() > 0.12 * h * w:
            a[bg_flood, 3] = 0.0
            near_bg = m_near & ~bg_flood
            # 羽化: 仅泛洪区邻接的过渡带
            tt = ((dist[near_bg] - tol) / float(tol_feather))
            a[near_bg, 3] = a[near_bg, 3] * tt
            # 去白边: 浅色底角色边缘常有白描边/白晕, 按浅色度羽化掉
            r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
            mn = np.minimum(np.minimum(r, g), b)
            semi = (mn > white_thresh - feather) & (a[:, :, 3] > 0)
            t2 = ((mn - (white_thresh - feather)) / float(feather)).clip(0, 1)
            a[semi, 3] = a[semi, 3] * (1.0 - t2[semi])

    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")

def crop_subject(im):
    im = dewhiten(im)
    arr = np.array(im)
    mask = arr[:, :, 3] > 8
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return im
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = 2
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width - 1, x1 + pad), min(im.height - 1, y1 + pad)))
