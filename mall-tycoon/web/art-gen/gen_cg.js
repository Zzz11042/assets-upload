// 恋爱 CG 批量生成: 8 角色 × 3 关键章(心绪/告白/婚约) = 24 张场景插画
// Pollinations.ai (flux, 宽幅 640×360 anime scene), 断点续传
const fs=require('fs');const https=require('https');const {execSync}=require('child_process');
fs.mkdirSync('cg',{recursive:true});
const CGS={
  lisa:["cafe counter at dusk, young female illustrator with red hair in loose bun and shopkeeper (protagonist) leaning over a sketchbook together, warm lamp light, cozy atmosphere, anime illustration, cinematic scene","she kneels holding a small box, blushing, behind her a large unfinished painting of the mall, twilight, petals drifting, anime illustration, romantic moment","wedding at the mall entrance decorated with paintings of their story, both in formal wear standing before a giant canvas, guests around, anime illustration, celebration"],
  mia:["rooftop at golden hour, young photographer girl with teal hair and star hairclip showing the protagonist a polaroid, city lights of a small mall below, wind blowing, anime illustration, nostalgic","she stands on a hill overlooking the town, holding up a printed photo with both hands, the protagonist beside her, sunset, anime illustration, heartfelt","wedding day, she photographs the bride and groom embracing through her camera lens, flashbulbs, flowers, anime illustration, joyful"],
  yuki:["elegant bank office at night, confident woman with black ponytail sliding a small ring box across the desk, dramatic lighting, protagonist sitting across, anime illustration, intense mood","terraced garden, she holds flowers and the protagonist on one knee, fountain behind them, blue hour sky, anime illustration, romantic","modern wedding venue, she in a sleek white dress, the protagonist in suit, both smiling at each other, confetti, anime illustration, elegant"],
  sora:["flower shop interior, girl with light brown hair and ribbon handing a white hyacinth to the protagonist, sunlight through window, plants everywhere, anime illustration, gentle","rooftop garden, she plants a hyacinth bulb beside the protagonist, morning mist, the mall lights in the distance, anime illustration, tender","wedding among blooming hyacinths, both in soft pastel attire, petals in the air, anime illustration, dreamlike"],
  ken:["old warehouse storeroom at night, middle-aged man with gray beard teaching the young protagonist the stock ledger, lantern light, warm, anime illustration, mentorship","he hands over a work badge on a red ribbon at the mall entrance at dawn, steam from coffee cups, anime illustration, sincere","he stands as the best man at a small wedding, wiping a tear, the young couple in the aisle, warm lighting, anime illustration, bittersweet"],
  haruto:["backstage of the mall, silver-haired musician tuning an acoustic guitar, spotlight, the protagonist watching from the doorway, moody purple light, anime illustration, mysterious","he plays a song on a small stage, the protagonist in the front row holding a handwritten sheet music, warm spotlights, audience dimmed, anime illustration, intimate","wedding ceremony with live guitar, he plays while they exchange rings, candles and strings of lights, anime illustration, magical"],
  rei:["outdoor track at dawn, athletic man with headband running beside the protagonist, steam from breath, the mall silhouette behind, anime illustration, energetic","climbing wall, he catches the protagonist mid-way, both laughing, gym chalk dust in the air, anime illustration, dynamic","relay-race wedding theme, they cross the finish line together with a ring box, cheering crowd, anime illustration, triumphant"],
  shiro:["cozy bookstore corner, man with long black hair in navy suit and bowtie recommending a book, rain on the window, warm reading lamps, anime illustration, quiet","he slides a hand-copied poetry book under the store counter, firefly light outside, both reading the same book side by side, anime illustration, poetic","their wedding decorated with bookshelves and candles, he reads vows from the book's last chapter, white flowers, anime illustration, refined"],
};
function get(url,out){return new Promise((res,rej)=>{const f=fs.createWriteStream(out);https.get(url,{headers:{'User-Agent':'mall-tycoon-cg/1.0'}},r=>{if(r.statusCode!==200)return rej(new Error('HTTP '+r.statusCode));r.pipe(f);f.on('finish',()=>{f.close();res();});}).on('error',rej);});}
function validImg(file,minBytes=4000){try{if(!fs.existsSync(file))return false;if(fs.statSync(file).size<minBytes)return false;const h=fs.readFileSync(file).slice(0,3).toString('hex');return h==='ffd8ff'||h.slice(0,4)==='89504e';}catch(e){return false;}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const jobs=[];
  for(const [key,scenes] of Object.entries(CGS)){
    scenes.forEach((prompt,i)=>jobs.push([key,i,prompt]));
  }
  let ok=0,skip=0,fail=0,lastTry=Date.now();
  for(const [key,i,prompt] of jobs){
    const out='cg/'+key+'_s'+i+'.png';
    if(fs.existsSync(out)&&validImg(out)){console.log('skip',key,i);skip++;continue;}
    const raw='/tmp/cg_'+key+'_'+i+'.bin';
    const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt)+'?width=640&height=360&nologo=true&model=flux&seed='+key.charCodeAt(0)*13+i*7;
    let got=false;
    for(let a=0;a<10;a++){
      const waitMs=Math.max(0,lastTry+46000-Date.now());
      if(waitMs>0)await sleep(waitMs);
      lastTry=Date.now();
      try{await get(u,raw);if(validImg(raw)){got=true;break;}}catch(e){}
      await sleep(6000);
    }
    if(!got){console.log('fetch-fail',key,i);fail++;continue;}
    execSync('python3 -c "from PIL import Image;im=Image.open(\''+raw+'\').convert(\'RGBA\');im=im.resize((640,360));im.save(\''+out+'\')"');
    ok++;console.log('ok',key,i);
  }
  console.log('done: ok='+ok+' skip='+skip+' fail='+fail);
})();
