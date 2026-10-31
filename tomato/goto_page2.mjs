import fs from 'fs';
const expr = '(async function(){' +
  'var p=Array.from(document.querySelectorAll(".arco-pagination-item")).find(function(e){return e.innerText.trim()==="2";}); ' +
  'if(p){p.click(); await new Promise(function(r){setTimeout(r,1500);});} ' +
  'var lines=document.body.innerText.split("\\n").filter(function(l){return l.match(/^第\\d+章/);}); ' +
  'return JSON.stringify({lines:lines});' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2217, op:'eval', expr: expr}));
