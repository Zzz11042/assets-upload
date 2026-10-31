import fs from 'fs';
const expr = '(function(){var t=document.body.innerText; var names=["临江的灯","雾南站","铁栅","灰河","门缝那只手","临江车组","别停是谁","雾夜发车"]; var found={}; names.forEach(function(n){found[n]=(t.split(n).length-1);}); var total=(t.match(/草稿/g)||[]).length; return JSON.stringify({counts:found, draftMentions:total});})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:2014, op:'eval', expr: expr}));
