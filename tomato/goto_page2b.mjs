import fs from 'fs';
const expr = '(async function(){' +
  'var p=Array.from(document.querySelectorAll(".arco-pagination-item")).find(function(e){return e.innerText.trim()==="2";}); ' +
  'if(p){p.click(); await new Promise(function(r){setTimeout(r,2500);});} ' +
  'var t=document.body.innerText; var lines=t.split("\\n").filter(function(l){return l.match(/第\\d+章/)&&l.length<40;}); ' +
  'var total=t.match(/共(\\d+)篇草稿/); ' +
  'return JSON.stringify({lines:lines, total:total?total[1]:null});' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2218, op:'eval', expr: expr}));
