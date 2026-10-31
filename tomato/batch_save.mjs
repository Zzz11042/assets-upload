import fs from 'fs';
const titles = {7:'直升机',8:'七个雇佣兵',9:'金链',10:'账本被偷',11:'门缝的纸',12:'鬼佬走了',13:'据点',14:'白宫的人',15:'防控为零的原因',16:'白衬衫',17:'金表换了主人',18:'最后一笔账',19:'老板来了',20:'收网'};
const start = parseInt(process.argv[2]) || 7;
const end = parseInt(process.argv[3]) || 20;
let id = 1800;
for (let i = start; i <= end; i++) {
  const file = `chapters/ch${i<10?("0"+i):i}-1000.txt`;
  if (!fs.existsSync(file)) { console.log(`skip ${i} (no file)`); continue; }
  const txt = fs.readFileSync(file, 'utf8');
  const title = titles[i];
  const gotoExpr = `(function(){location.href="https://fanqienovel.com/main/writer/7675577063591398462/publish/?enter_from=newchapter_1";return "goto";})()`;
  // step1: goto (handled by server2's goto op)
  fs.writeFileSync('cmd.json', JSON.stringify({id: id, op:'goto', url:`https://fanqienovel.com/main/writer/7675577063591398462/publish/?enter_from=newchapter_1`, wait:8000}));
  await new Promise(r=>setTimeout(r, 10000));
  id++;
  // step2: fill + save
  const expr = '(async function(){' +
    'var num=document.querySelector(".serial-editor-title-left input"); num.focus();' +
    'var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;' +
    's.call(num,' + JSON.stringify(String(i)) + '); num.dispatchEvent(new Event("input",{bubbles:true})); num.dispatchEvent(new Event("change",{bubbles:true})); num.blur();' +
    'var t=document.querySelector("input[placeholder=\\"请输入标题\\"]"); t.focus();' +
    's.call(t,' + JSON.stringify(title) + '); t.dispatchEvent(new Event("input",{bubbles:true})); t.blur();' +
    'var ed=document.querySelector(".serial-editor-content .ProseMirror"); ed.focus();' +
    'var sel=window.getSelection(); var range=document.createRange(); range.selectNodeContents(ed); sel.removeAllRanges(); sel.addRange(range); document.execCommand("delete");' +
    'var payload=' + JSON.stringify(txt) + ';' +
    'var dt=new DataTransfer(); dt.setData("text/plain", payload);' +
    'var ev=new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:dt}); ed.dispatchEvent(ev);' +
    'await new Promise(function(r){setTimeout(r,2500);});' +
    'var btn=Array.from(document.querySelectorAll("button")).find(function(b){return b.innerText.trim()==="存草稿"&&b.getBoundingClientRect().width>0;});' +
    'if(btn){btn.click(); await new Promise(function(r){setTimeout(r,3000);});}' +
    'return {num:num.value, title:t.value, len:ed.innerText.length, saved:document.body.innerText.indexOf("已保存")>-1};' +
    '})()';
  fs.writeFileSync('cmd.json', JSON.stringify({id: id, op:'eval', expr: expr}));
  await new Promise(r=>setTimeout(r, 9000));
  const out = JSON.parse(fs.readFileSync('out.json','utf8'));
  console.log(`ch${i} ${title}:`, out.cmdId===id ? `saved=${out.result?.saved} len=${out.result?.len}` : `MISMATCH cmdId=${out.cmdId}`);
  id++;
}
