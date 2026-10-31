import fs from 'fs';
const expr = '(async function(){' +
  'var results={}; ' +
  'var names={9:"南郊",10:"北岭"}; ' +
  'for(var k in names){ ' +
  '  location.href="https://fanqienovel.com/main/writer/chapter-manage/7608584053549190169&雾夜列车?type=1"; ' +
  '  await new Promise(function(r){setTimeout(r,5000);}); ' +
  '  var t=document.body.innerText; ' +
  '  results[k]=t.indexOf(names[k])>-1; ' +
  '  break; ' +
  '} ' +
  'return JSON.stringify(results);' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2222, op:'eval', expr: expr}));
