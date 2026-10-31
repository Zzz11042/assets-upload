// 保存 moshu30 章节草稿
import fs from 'fs';
const num = process.argv[2];
const title = process.argv[3];
const file = process.argv[4];
const txt = fs.readFileSync(file, 'utf8');
let id = parseInt(process.env.CMD_ID)||4700;

fs.writeFileSync('cmd.json', JSON.stringify({id:id, op:'goto', url:'https://fanqienovel.com/main/writer/7700571660746755134/publish/?enter_from=newchapter_1', wait:8000}));
await new Promise(r=>setTimeout(r,10000));
id++;
const expr = '(async function(){' +
  'var num=document.querySelector(".serial-editor-title-left input"); num.focus();' +
  'var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;' +
  's.call(num,' + JSON.stringify(num) + '); num.dispatchEvent(new Event("input",{bubbles:true})); num.dispatchEvent(new Event("change",{bubbles:true})); num.blur();' +
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
fs.writeFileSync('cmd.json', JSON.stringify({id:id, op:'eval', expr}));
await new Promise(r=>setTimeout(r,9000));
const out = JSON.parse(fs.readFileSync('out.json','utf8'));
console.log(`moshu30 ch${num} ${title}:`, out.cmdId===id ? `saved=${out.result?.saved} len=${out.result?.len}` : `MISMATCH cmdId=${out.cmdId}`);
