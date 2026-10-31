# 生图素材集成计划（本轮）

## 素材来源
Pollinations.ai（免费、免 key、45s/张 限频）生成 24 张 64×64 像素风美工素材，存 `web/art-gen/*.png`：

| 类别 | key | 用途 |
|------|-----|------|
| 店铺门面 | cafe/supermarket/bakery/food/cinema/arcade/bookstore/fashion/hotel/gym/pet/pharmacy/bank/tech/gallery | 15 种业态的像素门脸（替换或叠加 emoji 图标） |
| 主角 | hero/heroMoped/heroBike | 3 个主角造型（像素生图版，替代 hand-crafted 16×16） |
| 地图 | street/plaza/campus | 3 张地图背景（俯视小地图） |
| 装饰 | sign/plant/lamp | 装饰位素材 |

## 集成方式（保持单文件 bundle）
1. `web/art-gen/ART_MANIFEST.js`：把 24 张 png 读成 base64 内联（生成时自动写入），输出 `window.ART_GEN = {cafe:dataURI,...}`
2. `build.js` 注入第 5 个源码
3. `index.html` 铺位格子：在 emoji 图标后叠加 `ART_GEN[shopKey]` 小图（16-20px, pixelated）
4. 主角面板：`ART_GEN.hero/heroMoped/heroBike` 替换/补充 HERO_MODELS
5. 地图 Tab：背景图缩略

## 执行节奏
后台生成 24 张（约 18-20 分钟）→ 生成 ART_MANIFEST → 集成 → 3-way md5 验证
