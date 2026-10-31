import fs from 'fs';
const expr = '(async function(){var t=document.body.innerText; var names=["临江的灯","南郊","北岭","雾南站","铁栅"]; var found={}; names.forEach(function(n){found[n]=(t.split(n).length-1);}); var lines=t.split("\\n").filter(function(l){return l.match(/第\\d+章/)&&l.length<40;}); return JSON.stringify({found:found, lines:lines});})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2215, op:'eval', expr: expr}));
