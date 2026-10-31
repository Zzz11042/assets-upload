import fs from 'fs';
const expr = '(async function(){' +
  'var total=document.body.innerText.match(/共(\\d+)篇草稿/); ' +
  'var pager=Array.from(document.querySelectorAll(".arco-pagination-item,.next-pagination-item")).map(function(p){return p.innerText.trim();}).filter(Boolean); ' +
  'var input=document.querySelector("input[placeholder*=章节],input[placeholder*=搜索],input[placeholder*=请输入]"); ' +
  'var inputVal=input?input.value:null; ' +
  'var allDraftLines=document.body.innerText.split("\\n").filter(function(l){return l.match(/^第\\d+章/);}); ' +
  'return JSON.stringify({total:total?total[1]:null, pager:pager, inputVal:inputVal, count:allDraftLines.length});' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2216, op:'eval', expr: expr}));
