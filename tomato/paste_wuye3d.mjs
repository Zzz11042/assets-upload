import fs from 'fs';
const txt = fs.readFileSync('books/wuye/chapters/ch03d.txt', 'utf8');
const expr = '(async function(){' +
  'var ed=document.querySelector(".serial-editor-content .ProseMirror"); ed.focus();' +
  'var sel=window.getSelection(); var range=document.createRange(); range.selectNodeContents(ed); sel.removeAllRanges(); sel.addRange(range); document.execCommand("delete");' +
  'var payload=' + JSON.stringify(txt) + ';' +
  'var dt=new DataTransfer(); dt.setData("text/plain", payload);' +
  'var ev=new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:dt}); ed.dispatchEvent(ev);' +
  'await new Promise(function(r){setTimeout(r,2500);});' +
  'return {len:ed.innerText.length};' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:1561, op:'eval', expr: expr}));
