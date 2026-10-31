import fs from 'fs';
const expr = '(async function(){' +
  'var all=[]; ' +
  'var t1=document.body.innerText; all=all.concat(t1.split("\\n").filter(function(l){return l.match(/第\\d+章/)&&l.length<40;})); ' +
  'var p=Array.from(document.querySelectorAll(".arco-pagination-item")).find(function(e){return e.innerText.trim()==="2";}); ' +
  'if(p){p.click(); await new Promise(function(r){setTimeout(r,3000);});} ' +
  'var t2=document.body.innerText; all=all.concat(t2.split("\\n").filter(function(l){return l.match(/第\\d+章/)&&l.length<40;})); ' +
  'var seen={}, uniq=[]; all.forEach(function(l){if(!seen[l]){seen[l]=1; uniq.push(l);}}); ' +
  'return JSON.stringify({uniq:uniq, total:document.body.innerText.match(/共(\\d+)篇草稿/)[1]});' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2221, op:'eval', expr: expr}));
