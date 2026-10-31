import fs from 'fs';
const expr = '(function(){var t=document.body.innerText; var lines=t.split("\\n").filter(function(l){return l.indexOf("临江的灯")>-1||l.indexOf("雾南站")>-1||l.indexOf("铁栅")>-1||l.indexOf("灰河")>-1||l.indexOf("门缝那只手")>-1||l.indexOf("临江车组")>-1;}); return JSON.stringify(lines.slice(0,12));})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2013, op:'eval', expr: expr}));
