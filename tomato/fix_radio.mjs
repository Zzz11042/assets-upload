import fs from 'fs';
let id = 4640;
function run(expr, sleepMs=8000) {
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
// React-style click on radio: dispatch click event
let r = await run('(function(){' +
  'var inp=Array.from(document.querySelectorAll(".arco-modal input[type=radio]")).find(function(x){return x.value==="1";});' +
  'if(inp){inp.dispatchEvent(new MouseEvent("click",{bubbles:true})); inp.checked=true; inp.dispatchEvent(new Event("change",{bubbles:true}));}' +
  'return {checked: inp?inp.checked:null};' +
  '})()');
console.log('radio set:', r);
await new Promise(res=>setTimeout(res,2000));
// 确认发布 via real mouse event
r = await run('(async function(){' +
  'var btn=Array.from(document.querySelectorAll(".arco-modal button")).find(function(b){return b.innerText.trim()==="确认发布";});' +
  'if(btn){btn.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window})); await new Promise(function(r2){setTimeout(r2,6000);});}' +
  'return {modalStill:!!document.querySelector(".arco-modal"), bodyTail:document.body.innerText.slice(-400)};' +
  '})()');
console.log('confirm:', r);
