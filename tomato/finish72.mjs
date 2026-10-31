import fs from 'fs';
let id = 4600;
function run(expr, sleepMs=9000) {
  return new Promise((resolve) => {
    const i = id++;
    fs.writeFileSync('cmd.json', JSON.stringify({id:i, op:'eval', expr}));
    setTimeout(async () => {
      const out = JSON.parse(fs.readFileSync('out.json','utf8'));
      if(out.cmdId===i) resolve(out.result);
      else resolve({MISMATCH: out.cmdId});
    }, sleepMs);
  });
}
// 点 radio value=1（是）
let r = await run('(function(){' +
  'var inp=Array.from(document.querySelectorAll(".arco-modal input[type=radio]")).find(function(x){return x.value==="1";});' +
  'if(inp){inp.click(); var lab=inp.closest("label"); if(lab){lab.click();}}' +
  'return {clicked:!!inp, checked:inp?.checked};' +
  '})()');
console.log('radio:', r);
await new Promise(res=>setTimeout(res,2000));
// 确认发布
r = await run('(async function(){' +
  'var btn=Array.from(document.querySelectorAll(".arco-modal button")).find(function(b){return b.innerText.trim()==="确认发布";});' +
  'if(btn){btn.click(); await new Promise(function(r2){setTimeout(r2,5000);});}' +
  'return {clicked:!!btn, modalStill:!!document.querySelector(".arco-modal"), bodyTail:document.body.innerText.slice(-300)};' +
  '})()');
console.log('confirm:', r);
