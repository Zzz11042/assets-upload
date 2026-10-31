#!/usr/bin/env python3
"""PVRTC 纹理解码器（Tiny Troopers 2 等 Unity PVR1/PVR2 压缩纹理）。

解码 PVR1 4bpp/5bpp 与 PVR2 4bpp/5bpp 的 RGB(A) 块格式，输出 PNG。
从解压后的 Unity .assets 二进制文件中按 PVR 容器头定位纹理。
用法:
  python3 -m analyzer.parsing.pvr_extract [--data-dir DIR] [--out DIR] [--max N]

仅依赖标准库 + PIL。
"""
import argparse, glob, os, struct
from PIL import Image


# ---------- PVR 容器 ----------

PVR1_MAGIC = 0x0312B11A
PVR2_MAGIC = 0x21507652  # "PVR\x21"

# PVR1 压缩格式编号: pvrTC14Bpp=0(4bpp), pvrTC15Bpp=1(5bpp), pvrTC24Bpp=2(4bpp+alpha), pvrTC25Bpp=3(5bpp+alpha)
# PVR2 压缩格式编号: pvr2_4Bpp=0, pvr2_5Bpp=1, pvr2_4Bpp_A=2, pvr2_5Bpp_A=3
PVR1_COMPRESSED = {0: 4, 1: 5, 2: 4, 3: 5}
PVR2_COMPRESSED = {0: 4, 1: 5, 2: 4, 3: 5}


def _find_data_files(data_dir: str) -> list:
    """收集 Unity 解包目录下的 .assets / .resS 数据文件。"""
    files = set()
    if not os.path.isdir(data_dir):
        return list(files)
    # 1) 直接子文件
    for pattern in ("*.assets", "sharedassets*.assets", "*.resS"):
        files.update(glob.glob(os.path.join(data_dir, pattern)))
    # 2) 常见子目录
    for sub in ("assets", "Data", "Resources"):
        p = os.path.join(data_dir, sub)
        if os.path.isdir(p):
            for pattern in ("*.assets", "sharedassets*.assets", "*.resS"):
                files.update(glob.glob(os.path.join(p, pattern)))
    # 3) 递归兜底（跳过 lib/arm 等大目录）
    skip = {"arm64-v8a", "armeabi-v7a", "armeabi", "lib", "lib64", ".git"}
    for base, dirs, _f in os.walk(data_dir):
        dirs[:] = [d for d in dirs if d not in skip]
        for pattern in ("*.assets", "sharedassets*.assets", "*.resS"):
            files.update(glob.glob(os.path.join(base, pattern)))
    return sorted(files)


def find_pvr_blocks(data: bytes):
    """在任意二进制里扫描 PVR 容器头（Unity .assets 内嵌纹理 blob）。"""
    blocks = []
    i = 0
    n = len(data)
    while i < n - 32:
        magic = struct.unpack_from("<I", data, i)[0]
        if magic == PVR1_MAGIC:
            # PVR1: u32 magic, u32 data_size, u16 height, u16 width, u32 pixel_data_size, u32 num_channels
            off = i + 4
            data_size, h, w = struct.unpack_from("<IhH", data, off)[0], struct.unpack_from("<H", data, off + 4)[0], struct.unpack_from("<H", data, off + 6)[0]
            pixel_data_size = struct.unpack_from("<I", data, off + 8)[0]
            channels = struct.unpack_from("<I", data, off + 12)[0]
            comps = struct.unpack_from("<I", data, off + 16)[0]
            block = data[i + 20: i + 20 + pixel_data_size]
            has_alpha = bool(channels & 0b10)  # pvrNumChans: pvrRGB=1, pvrRGBA=2? 简化：用 comps
            blocks.append({"container": 1, "format": comps, "has_alpha": comps in (2, 3),
                           "width": w, "height": h, "data": block, "offset": i})
            i += 20 + max(pixel_data_size, 1)
        elif magic == PVR2_MAGIC:
            # PVR2 头: u32 magic, u32 version, u16 file_size, u16 header_size, u32 meta_size, u32 data_size, u32 num_faces, u32 flags
            off = i + 4
            ver, file_size, header_size, meta_size, data_size, num_faces, flags = struct.unpack_from("<IIHHIIII", data, off)
            if header_size < 4 or header_size > 4096:
                i += 1
                continue
            w = struct.unpack_from("<I", data, off + 16)[0]
            h = struct.unpack_from("<I", data, off + 20)[0]
            fmt = struct.unpack_from("<I", data, off + 32)[0]
            block_start = i + 4 + header_size
            block = data[block_start: block_start + data_size]
            has_alpha = fmt in (2, 3)
            blocks.append({"container": 2, "format": fmt, "has_alpha": has_alpha,
                           "width": w, "height": h, "data": block, "offset": i})
            i = block_start + max(data_size, 1)
        else:
            i += 1
    return blocks


# ---------- PVRTC1 4bpp 块解码 ----------

def _expand4(v: int) -> int:
    v &= 0xF
    return v << 4 | v


def _block_colors_4bpp(block: bytes):
    """PVR1 4bpp 块头 2 字节: c0..c7 (2bit 索引)，随后 4 字节平面。
    返回 6 个 4bit 分量 (r0,g0,b0,r1,g1,b1)。"""
    b0, b1 = block[0], block[1]
    p = block[2:6]
    r0 = (p[0] >> 4) | ((p[1] & 0xF0) >> 4)
    g0 = (p[2] >> 4) | ((p[3] & 0xF0) >> 4)
    b0 = p[0] & 0x0F
    r1 = p[1] & 0x0F
    g1 = p[2] & 0x0F
    b1 = p[3] & 0x0F
    return r0, g0, b0, r1, g1, b1


def decode_pvr1_4bpp(data: bytes, w: int, h: int, has_alpha: bool) -> Image.Image:
    """PVR1 4bpp: 每个 4x4 块 8 字节。块头 2 字节含颜色对索引，
    随后 4 字节为颜色平面（视觉近似：按 4 个 4bit 组轮询颜色）。"""
    if w % 4 != 0 or h % 4 != 0:
        return None
    bw, bh = w // 4, h // 4
    px = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    load = px.load()
    for by in range(bh):
        for bx in range(bw):
            block = data[(by * bw + bx) * 8:(by * bw + bx) * 8 + 8]
            if len(block) < 8:
                continue
            r0, g0, b0, r1, g1, b1 = _block_colors_4bpp(block)
            for y in range(4):
                for x in range(4):
                    # 简化 2bit 像素索引：用 4 字节平面中对应 4bit 组轮询
                    byte_idx = (y >> 1) * 4 + ((y & 1) << 2)
                    nibble = block[byte_idx + ((x & 3) >> 1)] >> ((x & 1) * 4) & 0xF
                    idx = nibble % 4
                    if idx < 2:
                        r, g, b = _expand4(r0), _expand4(g0), _expand4(b0)
                    else:
                        r, g, b = _expand4(r1), _expand4(g1), _expand4(b1)
                    a = 255 if not has_alpha else (255 if idx < 2 else 160)
                    load[bx * 4 + x, by * 4 + y] = (r, g, b, a)
    return px


def decode_pvr1_5bpp(data: bytes, w: int, h: int, has_alpha: bool) -> Image.Image:
    """PVR1 5bpp: 每个 4x4 块 10 字节。简化为 4bpp 解码 + 丢弃最后 2 字节。"""
    if w % 4 != 0 or h % 4 != 0:
        return None
    return decode_pvr1_4bpp(data, w, h, has_alpha)


def decode_pvr2_4bpp(data: bytes, w: int, h: int, has_alpha: bool) -> Image.Image:
    """PVR2 4bpp: 每个 4x4 块 8 字节，RGBA 4444。简化解码（R/G 平面直读）。"""
    if w % 4 != 0 or h % 4 != 0:
        return None
    bw, bh = w // 4, h // 4
    px = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    load = px.load()
    for by in range(bh):
        for bx in range(bw):
            block = data[(by * bw + bx) * 8:(by * bw + bx) * 8 + 8]
            if len(block) < 8:
                continue
            # PVR2 4bpp: 块头 1 字节 (c0..c1, 各 2bit 索引) + 7 字节平面
            b0 = block[0]
            c0, c1 = (b0 >> 6) & 3, (b0 >> 4) & 3
            p = block[1:8]
            r0 = p[0] | (p[1] >> 1) & 0xF
            g0 = p[1] << 7 | p[2] >> 1
            b0_ = p[2] << 7 | p[3] >> 1
            r1 = p[4] | (p[5] >> 1) & 0xF
            g1 = p[5] << 7 | p[6] >> 1
            b1_ = p[6] << 7 | p[7] >> 1
            # 简化：颜色对 (c0,c1) 各映射到 r0g0b0 / r1g1b1，按 2bit 轮询
            for y in range(4):
                for x in range(4):
                    idx = ((block[(y >> 1) * 4 + ((y & 1) << 2) + (x & 3)] >> ((x & 1) * 4) & 0xF) % 4)
                    if idx in (0, 1):
                        r, g, b = _expand4(r0 & 0xF), _expand4(g0 & 0xF), _expand4(b0_ & 0xF)
                    else:
                        r, g, b = _expand4(r1 & 0xF), _expand4(g1 & 0xF), _expand4(b1_ & 0xF)
                    a = 255 if not has_alpha else (128 if idx >= 2 else 255)
                    load[bx * 4 + x, by * 4 + y] = (r, g, b, a)
    return px


def decode_block(block: dict):
    fmt = block["format"]
    w, h = block["width"], block["height"]
    data = block["data"]
    if block["container"] == 1:
        if fmt in (0, 2):
            return decode_pvr1_4bpp(data, w, h, block["has_alpha"])
        if fmt in (1, 3):
            return decode_pvr1_5bpp(data, w, h, block["has_alpha"])
    if block["container"] == 2:
        if fmt in (0, 2):
            return decode_pvr2_4bpp(data, w, h, block["has_alpha"])
        if fmt in (1, 3):
            return decode_pvr1_5bpp(data, w, h, block["has_alpha"])
    # 兜底: 未压缩 RGBA
    n = w * h * 4
    if len(data) >= n:
        try:
            return Image.frombytes("RGBA", (w, h), data[:n])
        except Exception:
            return None
    return None


def extract(data_dir: str, out_dir: str, max_blocks: int = 400) -> int:
    os.makedirs(out_dir, exist_ok=True)
    out = 0
    for fp in _find_data_files(data_dir):
        try:
            with open(fp, "rb") as fh:
                blob = fh.read()
        except OSError:
            continue
        found = 0
        for blk in find_pvr_blocks(blob):
            if found >= max_blocks:
                break
            try:
                img = decode_block(blk)
            except Exception:
                img = None
            if img is None or img.size[0] < 4 or img.size[1] < 4:
                continue
            tag = f"c{blk['container']}_f{blk['format']}" + ("_a" if blk["has_alpha"] else "")
            name = f"pvr_{tag}_{blk['width']}x{blk['height']}_{blk['offset']:08x}.png"
            img.save(os.path.join(out_dir, name))
            found += 1
            out += 1
        if out >= max_blocks:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="/home/zzz/Documents/deepseek-harness/default-workspace/apk_extract")
    ap.add_argument("--out", default="/home/zzz/Documents/deepseek-harness/default-workspace/extracted_art/pvr_decoded")
    ap.add_argument("--max", type=int, default=400)
    args = ap.parse_args()
    n = extract(args.data_dir, args.out, args.max)
    print(f"解码 PVRTC 纹理 {n} 张 → {args.out}")


if __name__ == "__main__":
    main()
