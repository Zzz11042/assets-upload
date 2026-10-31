// 把 art-gen 全部素材(像素 PNG + 高清 JPEG)打包成 base64 内联 JS: window.ART_GEN = {key:dataURI,...}
// 生成: node manifest.js → ART_MANIFEST.js (供 build.js 注入)
// 高清化: 立绘 anime/*.jpg(512×512) + CG cg/*.jpg(1280×720) 优先于旧 .png(存在同名 jpg 时跳过 png, 键同)
const fs=require('fs');
const path=require('path');
const dir=__dirname;
const animeDir=path.join(dir,'anime');
const cgDir=path.join(dir,'cg');
const allKeys=[];
// 64×64 像素素材(根目录 PNG)
for(const k of fs.readdirSync(dir).filter(f=>f.endsWith('.png')&&fs.statSync(path.join(dir,f)).size>400)){
  allKeys.push(['png', k.replace(/\.png$/,''), path.join(dir,k)]);
}
// 立绘: 优先 512 jpg, 回退 256 png(键相同, jpg 优先)
const portraitByBase={};
const pFiles=fs.readdirSync(animeDir);
for(const k of pFiles){ if(k.endsWith('.png')) portraitByBase[k.replace(/\.png$/,'')]={kind:'png',file:path.join(animeDir,k)}; }
for(const k of pFiles){ if(k.endsWith('.jpg')) portraitByBase[k.replace(/\.jpg$/,'')]={kind:'jpg',file:path.join(animeDir,k)}; } // jpg 覆盖 png
for(const key of Object.keys(portraitByBase)){ const e=portraitByBase[key]; allKeys.push([e.kind,key,e.file]); }
// CG: 优先 1280×720 jpg, 回退 640×360 png(键相同, jpg 优先)
const cgByBase={};
const cFiles=fs.readdirSync(cgDir);
for(const k of cFiles){ if(k.endsWith('.png')) cgByBase[k.replace(/\.png$/,'')]={kind:'png',file:path.join(cgDir,k)}; }
for(const k of cFiles){ if(k.endsWith('.jpg')) cgByBase[k.replace(/\.jpg$/,'')]={kind:'jpg',file:path.join(cgDir,k)}; } // jpg 覆盖 png
for(const key of Object.keys(cgByBase)){ const e=cgByBase[key]; allKeys.push([e.kind,key,e.file]); }
let js='// 生图素材清单(Pollinations.ai 生成, 自动 base64 内联)\nwindow.ART_GEN={';
for(const [kind,key,file] of allKeys){
  const data=fs.readFileSync(file).toString('base64');
  const mime=kind==='jpg'?'image/jpeg':'image/png';
  js+='\n'+JSON.stringify(key)+':'+JSON.stringify('data:'+mime+';base64,'+data)+',';
}
js=js.replace(/,$/,'}\n');
fs.writeFileSync(path.join(dir,'ART_MANIFEST.js'),js);
const jpgCount=allKeys.filter(x=>x[0]==='jpg').length;
console.log('manifest:',allKeys.length,'assets ('+jpgCount+' 高清jpg),',fs.statSync(path.join(dir,'ART_MANIFEST.js')).size,'B');
