import fs from 'fs';
const expr = '(function(){var t=document.body.innerText; var lines=t.split("\\n").filter(function(l){return l.match(/第\\d+章/)&&l.length<40;}); var m=t.match(/共(\\d+)篇草稿/); return JSON.stringify({lines:lines, total:m?m[1]:null});})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2212, op:'eval', expr: expr}));
