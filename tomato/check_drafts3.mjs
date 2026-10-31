import fs from 'fs';
const expr = '(function(){var t=document.body.innerText; var lines=t.split("\\n").filter(function(l){return l.match(/第\\d+章/)&&l.length<40;}); var total=(t.match(/篇草稿/g)||[]); var m=t.match(/共(\\d+)篇草稿/); return JSON.stringify({lines:lines.slice(0,30), totalDrafts:m?m[1]:null});})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2032, op:'eval', expr: expr}));
