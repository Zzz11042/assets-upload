import fs from 'fs';
const expr = '(function(){var t=document.body.innerText; var m=t.match(/共(\\d+)篇草稿/); var names=["临江的灯","雾南站","铁栅","南郊","北岭"]; var found={}; names.forEach(function(n){found[n]=(t.split(n).length-1);}); return JSON.stringify({total:m?m[1]:null, found:found});})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2213, op:'eval', expr: expr}));
