// 高清重生: CG 24 张 1280x720 JPEG(q88) + 立绘 10 张 512x512 JPEG(q90)
// 同 prompt/seed 于 gen_cg.js / gen_anime.js, 断点续传
const fs=require('fs');const https=require('https');const {execSync}=require('child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function get(url,out){return new Promise((res,rej)=>{const f=fs.createWriteStream(out);https.get(url,{headers:{'User-Agent':'mall-tycoon-hd2/1.0'}},r=>{if(r.statusCode!==200)return rej(new Error('HTTP '+r.statusCode));r.pipe(f);f.on('finish',()=>{f.close();res();});}).on('error',rej);});}
function validImg(file,minBytes){try{if(!fs.existsSync(file))return false;if(fs.statSync(file).size<minBytes)return false;const h=fs.readFileSync(file).slice(0,3).toString('hex');return h==='ffd8ff'||h.slice(0,4)==='89504e';}catch(e){return false;}}
// 复用 gen_cg.js 里的 CGS prompt(动态 require 其常量)
let CGS;
try{
  const src=fs.readFileSync('gen_cg.js','utf8');
  const m=src.match(/const CGS=(\{[\s\S]*?\});/);
  CGS=eval('('+m[1]+')');
}catch(e){ console.error('无法解析 gen_cg.js 的 CGS', e.message); process.exit(1); }
const PORTRAITS=[
  ['heroMale','anime manga style, handsome young male shopkeeper, 20s, short brown hair, warm smile, wearing brown apron over blue shirt, holding a coffee cup, half body portrait, soft warm lighting, cel shading, clean background, high quality illustration'],
  ['heroFemale','anime manga style, cute young female shopkeeper, 20s, long black hair with bangs, warm smile, wearing beige apron over pink blouse, holding a coffee cup, half body portrait, soft warm lighting, cel shading, clean background, high quality illustration'],
  ['lisa','anime manga style, beautiful young woman, 24, red hair in loose bun, holding a sketchbook, artist, gentle expression, wearing olive dress with scarf, half body portrait, soft lighting, cel shading, clean background'],
  ['mia','anime manga style, cheerful college girl, 19, long teal hair with star hairclip, holding a camera, playful expression, wearing yellow cardigan, half body portrait, soft lighting, cel shading, clean background'],
  ['yuki','anime manga style, cool elegant woman, 27, black hair in ponytail, confident smile, businesswoman, wearing white blouse with vest, holding a ledger, half body portrait, soft lighting, cel shading, clean background'],
  ['sora','anime manga style, shy gentle girl, 21, light brown hair with ribbon, blushing, wearing cream sweater, holding a potted plant, half body portrait, soft lighting, cel shading, clean background'],
  ['ken','anime manga style, kind middle-aged man, 40, gray beard, warm smile, shop owner, wearing green apron, half body portrait, soft lighting, cel shading, clean background'],
  ['haruto','anime manga style, handsome young man, 24, silver hair, gentle eyes, musician, wearing black turtleneck, holding a guitar, half body portrait, soft lighting, cel shading, clean background'],
  ['rei','anime manga style, athletic young man, 26, black hair with headband, confident grin, wearing white sports jersey, half body portrait, soft lighting, cel shading, clean background'],
  ['shiro','anime manga style, mature refined man, 35, long black hair, calm expression, wearing navy suit with bowtie, holding a book, half body portrait, soft lighting, cel shading, clean background'],
];
(async()=>{
  let lastTry=Date.now();
  // ---- CG: 1280x720 JPEG q88 ----
  let okCg=0,failCg=0;
  for(const [key,scenes] of Object.entries(CGS)){
    for(let i=0;i<scenes.length;i++){
      const out='cg/'+key+'_s'+i+'.jpg';
      if(fs.existsSync(out)&&validImg(out,3000)){okCg++;continue;}
      const raw='/tmp/hd_cg_'+key+'_'+i+'.bin';
      const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(scenes[i])+'&width=1280&height=720&nologo=true&model=flux&seed='+key.charCodeAt(0)*13+i*7;
      let got=false;
      for(let a=0;a<10;a++){
        const waitMs=Math.max(0,lastTry+46000-Date.now());
        if(waitMs>0)await sleep(waitMs);
        lastTry=Date.now();
        try{await get(u,raw);if(validImg(raw,3000)){got=true;break;}}catch(e){}
        await sleep(6000);
      }
      if(!got){console.log('cg-fail',key,i);failCg++;continue;}
      execSync('python3 -c "from PIL import Image;im=Image.open(\''+raw+'\').convert(\'RGB\');im=im.resize((1280,720),Image.LANCZOS);im.save(\''+out+'\',quality=88)"');
      okCg++;console.log('ok',key,i);
    }
  }
  // ---- 立绘: 512x512 JPEG q90 ----
  let okP=0,failP=0;
  for(const [key,prompt] of PORTRAITS){
    const out='anime/'+key+'.jpg';
    if(fs.existsSync(out)&&validImg(out,3000)){okP++;continue;}
    const raw='/tmp/hd_p_'+key+'.bin';
    const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt)+'&width=512&height=512&nologo=true&model=flux&seed='+key.charCodeAt(0)*11+key.charCodeAt(1);
    let got=false;
    for(let a=0;a<10;a++){
      const waitMs=Math.max(0,lastTry+46000-Date.now());
      if(waitMs>0)await sleep(waitMs);
      lastTry=Date.now();
      try{await get(u,raw);if(validImg(raw,3000)){got=true;break;}}catch(e){}
      await sleep(6000);
    }
    if(!got){console.log('portrait-fail',key);failP++;continue;}
    execSync('python3 -c "from PIL import Image;im=Image.open(\''+raw+'\').convert(\'RGB\');im=im.resize((512,512),Image.LANCZOS);im.save(\''+out+'\',quality=90)"');
    okP++;console.log('ok',key);
  }
  console.log('done: cg ok='+okCg+' fail='+failCg+' portrait ok='+okP+' fail='+failP);
})();
