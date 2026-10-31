import fs from 'fs';
const expr = '(async function(){' +
  'var box=document.querySelector(".arco-table-body,[class*=scroll],.editor-list,.chapter-list")||document.body; ' +
  'box.scrollTop=box.scrollHeight; ' +
  'await new Promise(function(r){setTimeout(r,2000);}); ' +
  'var t=document.body.innerText; var lines=t.split("\\n").filter(function(l){return l.match(/第\\d+章/)&&l.length<40;}); ' +
  'return JSON.stringify({lines:lines});' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2219, op:'eval', expr: expr}));
