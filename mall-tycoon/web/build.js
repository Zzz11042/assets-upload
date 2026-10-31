// 构建单文件 bundle: game.js + goods-models.js + hero-models.js + hero-system.js + oak-texture.js + index.html 内联 UI
const fs=require('fs');
const game=fs.readFileSync('game.js','utf8');
const goods=fs.readFileSync('goods-models.js','utf8');
const heroModels=fs.readFileSync('hero-models.js','utf8');
const hero=fs.readFileSync('hero-system.js','utf8');
const artManifest=fs.existsSync('art-gen/ART_MANIFEST.js')?fs.readFileSync('art-gen/ART_MANIFEST.js','utf8'):'// (no art-gen/ART_MANIFEST.js yet)\n';
const oak=fs.readFileSync('oak-texture.js','utf8');
const buildings=fs.existsSync('buildings.js')?fs.readFileSync('buildings.js','utf8'):'window.BUILDINGS={};\n';
let html=fs.readFileSync('index.html','utf8');
// 在 <script src="game.js"> 的位置注入 game + goods
let out=html.replace('<script src="game.js"></script>', '<script>\n'+game+'\n</script>\n<script>\n'+goods+'\n</script>\n<script>\n'+heroModels+'\n</script>\n<script>\n'+artManifest+'\n</script>\n<script>\n'+buildings+'\n</script>');
// hero-system.js 需要 game.js 暴露的 window 主角 API + UI 块的 setTip/floatNum/renderAll/save/fmt
const heroWrapped='(function(){\n'+hero+'\n})();';
// oak-texture.js 需要 ARTX(UI 块 const), 包进 IIFE 后在 hero 之后、</body> 前注入
const oakWrapped='(function(){\n'+oak+'\n})();';
out=out.replace('</body>', '<script>\n'+heroWrapped+'\n</script>\n<script>\n'+oakWrapped+'\n</script>\n</body>');
fs.writeFileSync('index.bundle.html',out);
fs.writeFileSync('MALL_TYCOON_H5_桌面版.html', out.replace(/mall_tycoon_save/g,'mall_tycoon_save_h5_test'));
console.log('rebuilt:', out.length, 'B');
// 三方对齐
const b=fs.readFileSync('index.bundle.html');
const child=fs.readFileSync('MALL_TYCOON_H5_桌面版.html');
console.log('bundle bytes:', b.length);
console.log('desktop bytes:', child.length);
const crypto=require('crypto');
const md5=(buf)=>crypto.createHash('md5').update(buf).digest('hex');
console.log('bundle md5:', md5(b));
console.log('desktop md5:', md5(child));
