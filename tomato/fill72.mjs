import fs from 'fs';
const intro = '病毒爆发第七天，全市断电。我住进了一栋还在供电的楼——七十二层，是全市最后一座灯塔。但灯塔有守则：第72层，是禁区。每晚十一点，全楼熄灯，只剩72层的灯还亮着。我，一个建筑工程师，发现了这栋楼的秘密：72层的灯不是给人照的，是给「它」的。它，住在72层。而「它」每晚都会下楼。我，必须让它上来。';
const expr = '(function(){' +
  'var t=document.querySelector("input[placeholder=\\"请输入作品名称\\"]");' +
  'if(!t) return "no form fields (view mode)";' +
  'var s1=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;' +
  'var s2=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;' +
  't.focus(); s1.call(t,"七十二楼"); t.dispatchEvent(new Event("input",{bubbles:true}));' +
  'var p1=document.querySelector("input[placeholder=\\"请输入主角名1\\"]");' +
  'p1.focus(); s1.call(p1,"林深"); p1.dispatchEvent(new Event("input",{bubbles:true}));' +
  'var p2=document.querySelector("input[placeholder=\\"请输入主角名2\\"]");' +
  'if(p2){p2.focus(); s1.call(p2,"老周"); p2.dispatchEvent(new Event("input",{bubbles:true}));}' +
  'var tas=document.querySelectorAll("textarea");' +
  'var ta=tas[0];' +
  'ta.focus(); s2.call(ta,' + JSON.stringify(intro) + '); ta.dispatchEvent(new Event("input",{bubbles:true}));' +
  'var btn=Array.from(document.querySelectorAll("button")).find(function(b){return b.innerText.trim()==="立即修改" && b.getBoundingClientRect().width>0;});' +
  'if(btn){btn.click(); return "clicked 立即修改";} else {return "no 立即修改 btn, all buttons: "+Array.from(document.querySelectorAll("button")).filter(function(b){return b.getBoundingClientRect().width>0}).map(function(b){return b.innerText.trim()}).filter(Boolean).slice(0,15).join("|");}' +
  '})()';
fs.writeFileSync('cmd.json', JSON.stringify({id:1372, op:'eval', expr: expr}));
