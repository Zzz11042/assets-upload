// 二次元立绘批量生成: Pollinations.ai (anime/illustration 风格, 半身像 256x256)
// 输出 anime/*.png (base64 进 manifest), 断点续传
const fs=require('fs');const https=require('https');const {execSync}=require('child_process');
fs.mkdirSync('anime',{recursive:true});
const ASSETS=[
  // 主角立绘(两套)
  ['heroMale','anime manga style, handsome young male shopkeeper, 20s, short brown hair, warm smile, wearing brown apron over blue shirt, holding a coffee cup, half body portrait, soft warm lighting, cel shading, clean background, high quality illustration'],
  ['heroFemale','anime manga style, cute young female shopkeeper, 20s, long black hair with bangs, warm smile, wearing beige apron over pink blouse, holding a coffee cup, half body portrait, soft warm lighting, cel shading, clean background, high quality illustration'],
  // 男性主角的可恋爱女性(4 位)
  ['lisa','anime manga style, beautiful young woman, 24, red hair in loose bun, holding a sketchbook, artist, gentle expression, wearing olive dress with scarf, half body portrait, soft lighting, cel shading, clean background'],
  ['mia','anime manga style, cheerful college girl, 19, long teal hair with star hairclip, holding a camera, playful expression, wearing yellow cardigan, half body portrait, soft lighting, cel shading, clean background'],
  ['yuki','anime manga style, cool elegant woman, 27, black hair in ponytail, confident smile, businesswoman, wearing white blouse with vest, holding a ledger, half body portrait, soft lighting, cel shading, clean background'],
  ['sora','anime manga style, shy gentle girl, 21, light brown hair with ribbon, blushing, wearing cream sweater, holding a potted plant, half body portrait, soft lighting, cel shading, clean background'],
  // 女性主角的可恋爱男性(4 位)
  ['ken','anime manga style, kind middle-aged male, 40, gray beard, warm smile, shop owner, wearing green apron, half body portrait, soft lighting, cel shading, clean background'],
  ['haruto','anime manga style, handsome young man, 24, silver hair, gentle eyes, musician, wearing black turtleneck, holding a guitar, half body portrait, soft lighting, cel shading, clean background'],
  ['rei','anime manga style, athletic young man, 26, black hair with headband, confident grin, wearing white sports jersey, half body portrait, soft lighting, cel shading, clean background'],
  ['shiro','anime manga style, mature refined man, 35, long black hair, calm expression, wearing navy suit with bowtie, holding a book, half body portrait, soft lighting, cel shading, clean background'],
];
function get(url,out){return new Promise((res,rej)=>{const f=fs.createWriteStream(out);https.get(url,{headers:{'User-Agent':'mall-tycoon-anime/1.0'}},r=>{if(r.statusCode!==200)return rej(new Error('HTTP '+r.statusCode));r.pipe(f);f.on('finish',()=>{f.close();res();});}).on('error',rej);});}
function validImg(file,minBytes=1500){try{if(!fs.existsSync(file))return false;if(fs.statSync(file).size<minBytes)return false;const h=fs.readFileSync(file).slice(0,3).toString('hex');return h==='ffd8ff'||h.slice(0,4)==='89504e';}catch(e){return false;}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let ok=0,skip=0,fail=0,lastTry=Date.now();
  for(const [key,prompt] of ASSETS){
    const out='anime/'+key+'.png';
    if(fs.existsSync(out)&&validImg(out)){console.log('skip',key);skip++;continue;}
    const raw='/tmp/anime_'+key+'.bin';
    const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt)+'?width=256&height=256&nologo=true&model=flux&seed='+key.charCodeAt(0)*11+key.charCodeAt(1);
    let got=false;
    for(let a=0;a<8;a++){
      const waitMs=Math.max(0,lastTry+46000-Date.now());
      if(waitMs>0)await sleep(waitMs);
      lastTry=Date.now();
      try{await get(u,raw);if(validImg(raw)){got=true;break;}}catch(e){}
      await sleep(6000);
    }
    if(!got){console.log('fetch-fail',key);fail++;continue;}
    execSync('python3 -c "from PIL import Image;im=Image.open(\''+raw+'\').convert(\'RGBA\');im=im.resize((256,256));im.save(\''+out+'\')"');
    ok++;console.log('ok',key);
  }
  console.log('done: ok='+ok+' skip='+skip+' fail='+fail);
})();
