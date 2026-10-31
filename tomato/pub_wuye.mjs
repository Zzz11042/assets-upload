// 发布已有草稿：填入序号+标题 → 下一步 → 处理弹窗 → 确认发布
import fs from 'fs';
const num = process.argv[2];
const title = process.argv[3];
const file = process.argv[4];
const txt = fs.readFileSync(file, 'utf8');
let id = 4530;

function cmd(op, data) { fs.writeFileSync('cmd.json', JSON.stringify({id:id++, op, ...data})); return new Promise(r=>setTimeout(r,8000)); }
async function run(expr) {
  const i = id; id++;
  fs.writeFileSync('cmd.json', JSON.stringify({id:i, op:'eval', expr}));
  await new Promise(r=>setTimeout(r,9000));
  const out = JSON.parse(fs.readFileSync('out.json','utf8'));
  if(out.cmdId!==i) throw new Error('MISMATCH: expected '+i+' got '+out.cmdId);
  return out.result;
}

// 1. 进入新章节编辑页
await cmd('goto', {url:'https://fanqienovel.com/main/writer/7608584053549190169/publish/?enter_from=newchapter_1', wait:8000});
await new Promise(r=>setTimeout(r,3000));

// 2. 填序号+标题+正文
const r1 = await run('(async function(){' +
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
  'await new Promise(function(r){setTimeout(r,3000);});' +
  'return {num:num.value, title:t.value, len:ed.innerText.length};' +
  '})()');
console.log('filled:', r1);

// 3. 点"下一步"
const r2 = await run('(async function(){' +
  'var btns=Array.from(document.querySelectorAll("button")).filter(function(b){return b.innerText.trim()==="下一步"&&b.getBoundingClientRect().width>0;});' +
  'if(btns[0]){btns[0].click(); await new Promise(function(r){setTimeout(r,4000);});}' +
  'var modals=document.querySelectorAll(".arco-modal");' +
  'var text=""; modals.forEach(function(m){text+=m.innerText+"|";});' +
  'return {clicked:!!btns[0], modalText:text.slice(0,600)};' +
  '})()');
console.log('next-step:', r2);

// 4. 如有错别字弹窗，点"提交"
const r3 = await run('(async function(){' +
  'var btn=Array.from(document.querySelectorAll(".arco-modal button")).find(function(b){return b.innerText.trim()==="提交";});' +
  'if(btn){btn.click(); await new Promise(function(r){setTimeout(r,3000);});}' +
  'var modals=document.querySelectorAll(".arco-modal");' +
  'var text=""; modals.forEach(function(m){text+=m.innerText+"|";});' +
  'return {clickedTypo:!!btn, modalText:text.slice(0,600), bodyTail:document.body.innerText.slice(-400)};' +
  '})()');
console.log('typo-modal:', r3);

// 5. 勾选 AI="是"
const r4 = await run('(async function(){' +
  'var label=document.querySelector(".arco-modal label.arco-radio:has-text(\\"是\\")")||Array.from(document.querySelectorAll(".arco-modal label")).find(function(l){return l.innerText.trim().indexOf("是")===0||l.innerText.trim().indexOf("是否使用AI")>-1;});' +
  'if(label){var inp=label.querySelector("input")||document.querySelector(".arco-modal input[type=radio]"); if(inp){inp.click();} else {label.click();} await new Promise(function(r){setTimeout(r,2000);});}' +
  'return {clickedAI:!!label};' +
  '})()');
console.log('ai-radio:', r4);

// 6. 点"确认发布"
const r5 = await run('(async function(){' +
  'var btn=Array.from(document.querySelectorAll(".arco-modal button, button")).find(function(b){return b.innerText.trim()==="确认发布";});' +
  'if(btn){btn.click(); await new Promise(function(r){setTimeout(r,4000);});}' +
  'return {clickedPublish:!!btn, bodyTail:document.body.innerText.slice(-300)};' +
  '})()');
console.log('confirm:', r5);
