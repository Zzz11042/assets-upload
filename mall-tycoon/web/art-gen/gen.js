// 批量生图: Pollinations.ai(免费免 key, 限制 45s/张/IP) → 下载(jpeg) → PIL 转 64×64 PNG
// 断点续传: 输出已存在则跳过
const fs=require('fs');
const https=require('https');
const {execSync}=require('child_process');
const ASSETS=[
  ['cafe','cozy pixel art cafe storefront with warm lights and wood sign, game asset, flat style'],
  ['supermarket','pixel art supermarket storefront with bright entrance and shopping cart, game asset, flat style'],
  ['bakery','pixel art bakery shop with golden bread loaves and croissants in window, game asset, flat style'],
  ['food','pixel art food court restaurant with red lanterns and steam, game asset, flat style'],
  ['cinema','pixel art cinema theater entrance with red carpet and movie ticket, game asset, flat style'],
  ['arcade','pixel art arcade gaming shop with glowing joysticks and neon signs, game asset, flat style'],
  ['bookstore','pixel art bookstore with bookshelves and cozy lamp, game asset, flat style'],
  ['fashion','pixel art fashion boutique with dresses on mannequins, game asset, flat style'],
  ['hotel','pixel art hotel building with glowing entrance and bell, game asset, flat style'],
  ['gym','pixel art gym fitness studio with dumbbells and mirrors, game asset, flat style'],
  ['pet','pixel art pet shop with cages and cute animals, game asset, flat style'],
  ['pharmacy','pixel art pharmacy with green cross sign, game asset, flat style'],
  ['bank','pixel art bank building with columns and gold sign, game asset, flat style'],
  ['tech','pixel art electronics store with laptops and glowing screens, game asset, flat style'],
  ['gallery','pixel art art gallery with paintings on walls, game asset, flat style'],
  ['hero','cute pixel art young shopkeeper character with brown hair and apron, standing front view, game sprite'],
  ['heroMoped','cute pixel art young shopkeeper riding scooter, side view, game sprite'],
  ['heroBike','cute pixel art young shopkeeper riding bicycle, side view, game sprite'],
  ['street','top down pixel art small town shopping street with shops and cobblestones, game background'],
  ['plaza','top down pixel art commercial plaza with kiosks and trees, game background'],
  ['campus','top down pixel art university campus street with students and maple trees, game background'],
  ['sign','pixel art wooden shop sign hanging on wood, game asset, flat style'],
  ['plant','pixel art potted plant decoration, game asset, flat style'],
  ['lamp','pixel art hanging brass street lamp, game asset, flat style'],
];
function get(url,out){return new Promise((res,rej)=>{
  const f=fs.createWriteStream(out);
  https.get(url,{headers:{'User-Agent':'mall-tycoon-art/1.0'}},r=>{
    if(r.statusCode!==200) return rej(new Error('HTTP '+r.statusCode));
    r.pipe(f); f.on('finish',()=>{f.close();res();});
  }).on('error',rej);
});}
function validImg(file,minBytes=800){
  try{
    if(!fs.existsSync(file)) return false;
    if(fs.statSync(file).size<minBytes) return false;
    const h=fs.readFileSync(file).slice(0,3).toString('hex');
    return h==='ffd8ff'||h.slice(0,4)==='89504e';
  }catch(e){return false;}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let ok=0,skip=0,fail=0,lastTry=Date.now();
  for(const [key,prompt] of ASSETS){
    const out=key+'.png';
    if(fs.existsSync(out)&&validImg(out)){ console.log('skip',key); skip++; continue; }
    const raw='/tmp/poll_'+key+'.bin';
    const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt)+'?width=64&height=64&nologo=true&seed='+key.length*7;
    let got=false;
    for(let a=0;a<6&&a<ASSETS.length*50;a++){
      const waitMs=Math.max(0,lastTry+46000-Date.now());
      if(waitMs>0) await sleep(waitMs);
      lastTry=Date.now();
      try{
        await get(u,raw);
        if(validImg(raw)){ got=true; break; }
      }catch(e){}
      await sleep(5000); // 402/重试 间隔
    }
    if(!got){ console.log('fetch-fail',key); fail++; continue; }
    // PIL: 64x64 RGBA PNG
    execSync('python3 -c "from PIL import Image;im=Image.open(\'/tmp/poll_'+key+'.bin\').convert(\'RGBA\');im=im.resize((64,64));im.save(\''+out+'\')"');
    ok++; console.log('ok',key);
  }
  console.log('done: ok='+ok+' skip='+skip+' fail='+fail);
})();
