import fs from 'fs';
let id = 4550;
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

// 点"仅基础检测"
let r = await run('(function(){' +
  'var btn=Array.from(document.querySelectorAll(".arco-modal button")).find(function(b){return b.innerText.trim().indexOf("仅基础")===0||b.innerText.trim()==="仅基础检测";});' +
  'if(btn){btn.click();}' +
  'return {clickedBasic:!!btn, text:document.querySelector(".arco-modal")?.innerText?.slice(0,400)};' +
  '})()');
console.log('basic-check:', r);

// 勾选 AI=是
await new Promise(res => setTimeout(res, 4000));
r = await run('(function(){' +
  'var labels=Array.from(document.querySelectorAll(".arco-modal label, .arco-modal span, .arco-modal div"));' +
  'var aiLabel=labels.find(function(l){return l.innerText&&l.innerText.indexOf("是否使用AI")>-1&&l.innerText.indexOf("是")>-1;});' +
  'if(aiLabel){var inp=aiLabel.querySelector("input[type=radio]"); if(inp){inp.click();} else {aiLabel.click();}}' +
  'return {clickedAI:!!aiLabel, modalText:document.querySelector(".arco-modal")?.innerText?.slice(0,600)};' +
  '})()');
console.log('ai-radio:', r);

// 点"确认发布"
await new Promise(res => setTimeout(res, 3000));
r = await run('(async function(){' +
  'var btn=Array.from(document.querySelectorAll(".arco-modal button, button")).find(function(b){return b.innerText.trim()==="确认发布";});' +
  'if(btn){btn.click(); await new Promise(function(res2){setTimeout(res2,4000);});}' +
  'return {clickedPublish:!!btn, bodyTail:document.body.innerText.slice(-400)};' +
  '})()');
console.log('confirm:', r);
