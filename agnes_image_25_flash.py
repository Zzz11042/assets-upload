#!/usr/bin/env python3
"""Agnes Image 2.5 Flash — 按官方文档实现（文生图 / 图生图 / 多图合成 / URL / Base64）

参考文档: https://www.agnes-ai.cn/zh-Hans/docs/agnes-image-25-flash

端点:     POST https://apihub.agnes-ai.com/v1/images/generations
模型:     agnes-image-2.5-flash
计费:     所有分辨率档与输入参考图当前均免费（¥0）

文档"1. 设置环境变量"（本实现严格遵守）:
    export AGNES_API_KEY="sk-..."      # 密钥只放服务端，不写进代码/前端/公开仓库
    export AGNES_API_BASE="https://apihub.agnes-ai.com/v1"

端点:     POST https://apihub.agnes-ai.com/v1/images/generations
模型:     agnes-image-2.5-flash
计费:     所有分辨率档与输入参考图当前均免费（¥0）

文档规则（本实现严格遵守）:
- 文生图必填: model, prompt, size
- size 档位: 1K / 2K / 3K / 4K；ratio: 1:1 3:4 4:3 16:9 9:16 2:3 3:2 21:9（默认 1:1）
- 图生图: extra_body.image = [URL 或 Data URI Base64]，不传 tags
- 多图合成: extra_body.image 传多张
- URL 输出: extra_body.response_format = "url"  （勿放顶层）
- 文生图 Base64: return_base64 = true
- 图生图 Base64: extra_body.response_format = "b64_json"
- 超时建议: 60s–360s
"""
import base64, json, os, sys, time, urllib.request, urllib.parse

def _require_env(name):
    val = os.environ.get(name)
    if not val:
        sys.stderr.write(
            f"[error] 环境变量 {name} 未设置。按文档请先执行：\n"
            f'  export {name}="..."\n'
            f"  （密钥文件示例: source ~/.config/agnes/env）\n")
        raise SystemExit(1)
    return val

def _base():
    return os.environ.get("AGNES_API_BASE", "https://apihub.agnes-ai.com/v1").rstrip("/").removesuffix("/v1")

SIZES = {"1K", "2K", "3K", "4K"}
RATIOS = {"1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"}
# 文档输出尺寸参考表
SIZE_TABLE = {
    "1K":  {"1:1": "1024x1024", "3:4": "864x1152", "4:3": "1152x864",
            "16:9": "1312x736", "9:16": "736x1312", "2:3": "832x1248",
            "3:2": "1248x832", "21:9": "1568x672"},
    "2K":  {"1:1": "2048x2048", "3:4": "1728x2304", "4:3": "2304x1728",
            "16:9": "2624x1472", "9:16": "1472x2624", "2:3": "1664x2496",
            "3:2": "2496x1664", "21:9": "3136x1344"},
    "3K":  {"1:1": "3072x3072", "3:4": "2592x3456", "4:3": "3456x2592",
            "16:9": "3936x2208", "9:16": "2208x3936", "2:3": "2496x3744",
            "3:2": "3744x2496", "21:9": "4704x2016"},
    "4K":  {"1:1": "4096x4096", "3:4": "3456x4608", "4:3": "4608x3456",
            "16:9": "5248x2944", "9:16": "2944x5248", "2:3": "3328x4992",
            "3:2": "4992x3328", "21:9": "6272x2688"},
}


def generate(prompt, size="1K", ratio="1:1", images=None,
             return_base64=False, out_path=None, timeout=360, verbose=True):
    """核心生成函数。

    images: 图生图/多图合成用，元素为 URL 或 data:URI 或本地文件路径(自动转 data URI)
    返回: dict(url/b64_json/task_id)
    """
    # 校验（按文档，不支持的精确尺寸会被服务标准化，此处只做档位提示）
    if size in SIZES and ratio in RATIOS:
        expected = SIZE_TABLE[size][ratio]
        if verbose:
            print(f"[param-check] size={size} ratio={ratio} 预期输出 {expected}", file=sys.stderr)

    extra_body = {}
    if images:
        extra_body["image"] = [_to_data_uri_or_url(i) for i in images]

    body = {
        "model": "agnes-image-2.5-flash",
        "prompt": prompt,
        "size": size,
    }
    if ratio:
        body["ratio"] = ratio

    if return_base64 and not images:
        body["return_base64"] = True          # 文生图 Base64
    if extra_body.get("image"):
        extra_body["response_format"] = "b64_json"   # 图生图 Base64（文档规定）
    elif return_base64:
        pass  # 文生图用 return_base64
    else:
        extra_body["response_format"] = "url"    # URL 输出（勿放顶层）

    body["extra_body"] = extra_body

    if verbose:
        safe = {k: (v if k != "extra_body" else {kk: ("<data-uri>" if any(x and len(x) > 80 for x in (vv if isinstance(vv, list) else [vv])) else vv) for kk, vv in v.items()}) for k, v in body.items()}
        print(f"[request] {json.dumps(safe, ensure_ascii=False)}", file=sys.stderr)

    req = urllib.request.Request(
        f"{_base()}/v1/images/generations",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {_require_env('AGNES_API_KEY')}",
            "Content-Type": "application/json",
        },
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        result = json.loads(resp.read().decode())
    dt = time.time() - t0
    item = result["data"][0]
    out = {
        "url": item.get("url"),
        "b64_json": item.get("b64_json") or None,
        "task_id": result.get("task_id"),
        "revised_prompt": item.get("revised_prompt"),
        "elapsed_sec": round(dt, 1),
    }
    if out_path and out["b64_json"]:
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(out["b64_json"]))
        del out["b64_json"]
        out["saved_to"] = out_path
        if verbose:
            print(f"[saved] {out_path}", file=sys.stderr)
    if verbose:
        shown = {k: (v[:80] + "..." if isinstance(v, str) and len(v) > 80 else v) for k, v in out.items()}
        print(f"[result] {json.dumps(shown, ensure_ascii=False)}", file=sys.stderr)
    return out


def _to_data_uri_or_url(src):
    """本地文件 -> data URI；URL / data URI 原样返回。"""
    if src.startswith("http://") or src.startswith("https://") or src.startswith("data:"):
        return src
    mime = "image/png" if src.lower().endswith(".png") else "image/jpeg"
    with open(src, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:{mime};base64,{b64}"


if __name__ == "__main__":
    # CLI: 文生图示例
    gen = generate(
        prompt="日出时分薄雾峡谷上方的发光浮空城市，电影级写实风格，广角构图，丰富的建筑细节，柔和的金色光线，高视觉密度",
        size="1K",
        ratio="16:9",
        out_path="agnes_image_demo.png",
    )
    print("DONE:", json.dumps({k: (v[:60] + "..." if isinstance(v, str) and len(v) > 60 else v) for k, v in gen.items()}, ensure_ascii=False))
