"""UI 独立建模: 把生成的 UI 图标接入 index.html"""
import re, os

WEB='web/index.html'
GEN='art/gen'
html=open(WEB).read()

def b64(f):
    import base64
    return 'data:image/png;base64,'+base64.b64encode(open(f,'rb').read()).decode()

# ============ 1. HUD 图标接入 (chip 前缀 emoji → img) ============
# HUD chip: 资金 / 第 N 天 / 👥 客流 / 📋 税率
# 在 hud div 里替换 emoji 为 <img>
hud_icons={
    '资金':'hud_money','第':'hud_day','👥':'hud_cust','📋':'hud_tax','🏅':'hud_level','💼':'hud_invest',
}
# chip markup 在 HTML: <div class="chip">资金 <b id="money">¥0</b></div> 等
# 替换 emoji → img
html=html.replace('<div class="chip sub">👥 <b id="totalCust">0</b></div>',
                  '<div class="chip sub"><img class="hudIcon" src="HUD_CUST" alt="客流"> <b id="totalCust">0</b></div>')
html=html.replace('<div class="chip sub" id="taxChip">📋 税率 <b id="taxRate">5%</b></div>',
                  '<div class="chip sub" id="taxChip"><img class="hudIcon" src="HUD_TAX" alt="税率"> 税率 <b id="taxRate">5%</b></div>')
# toolbar buttons
html=html.replace('<button class="ghost" id="achBtn">🏅 成就</button>',
                  '<button class="ghost" id="achBtn"><img class="hudIcon sm" src="HUD_LEVEL" alt=""> 成就</button>')
html=html.replace('<button class="ghost" id="invBtn">💼 投资</button>',
                  '<button class="ghost" id="invBtn"><img class="hudIcon sm" src="HUD_INVEST" alt=""> 投资</button>')

# ============ 2. Logo 替换 (ARTX.logo 改指新徽标) ============
# ARTX 行里的 logo 字段值会被 ARTX 内联脚本覆盖, 无需改
# 但 injectPix 已处理 lg.src=ARTX.logo, 保持

# ============ 3. 协同徽章 (renderSynergy 里的 ✨ → img) ============
html=html.replace('el.innerHTML=acts.map(g=>\'<div class="syn">✨ \'+g.name+\' <span class="m">×\'+g.mult.toFixed(1)+\'</span></div>\').join(\'\');',
                  'el.innerHTML=acts.map(g=>\'<div class="syn"><img class="synIcon" src="\'+(SYN[ g.id ]||\'\')+\'" alt=""> \'+g.name+\' <span class="m">×\'+g.mult.toFixed(1)+\'</span></div>\').join(\'\');')

# ============ 4. 成就面板 (renderAch 里 ✅/🔒 → img) ============
old_ach='''    name.textContent=(done?'✅ ':'🔒 ')+a.name+' — '+a.desc;'''
new_ach='''    name.innerHTML=\'<img class="achIcon" src="\'+(ACH[ a.id ]||\'\')+\'" alt=""> \'+(done?a.name:esc(a.name)) +\' — \'+a.desc;'''
# 简化: 保留 textContent 不变, 加 img 在前
# 改用: 在 row 里 prepend 一个 img
old_ach_block='''    const row=document.createElement('div');
    row.className='ach'+(done?' unlocked':'');
    const name=document.createElement('div');
    name.className=done?'done':'undone';
    name.textContent=(done?'✅ ':'🔒 ')+a.name+' — '+a.desc;
    row.appendChild(name);'''
new_ach_block='''    const row=document.createElement('div');
    row.className='ach'+(done?' unlocked':'');
    const icon=document.createElement('img');
    icon.className='achIcon'+(done?'':' gray');
    icon.src=ACH[a.id]||'';
    icon.alt=a.name;
    const name=document.createElement('div');
    name.className=done?'done':'undone';
    name.textContent=a.name+' — '+a.desc;
    row.appendChild(icon);
    row.appendChild(name);'''
if old_ach_block in html:
    html=html.replace(old_ach_block,new_ach_block)
    print('✓ renderAch icon 接入')
else:
    print('WARN: renderAch block not found')

# ============ 5. 协同面板 renderSynPanel (synShops 里的 emoji 保留, 顶部 ✨ → img) ============
old_syn_h="h.textContent='✨ 业态组合搭配图鉴';"
new_syn_h="h.innerHTML='<img class=\"synIcon lg\" src=\"'+(SYN._all||'')+'"  # 不用, 保留纯文字
# 协同面板里每行没有图标, 只保留文字; 不加图

# ============ 6. CSS: 新增 .hudIcon / .synIcon / .achIcon ============
css_block='''  .hudIcon{width:18px;height:18px;image-rendering:pixelated;vertical-align:middle;margin-right:2px}
  .hudIcon.sm{width:14px;height:14px}
  .synIcon{width:22px;height:22px;image-rendering:pixelated;vertical-align:middle;margin-right:4px}
  .synIcon.lg{width:28px;height:28px}
  .achIcon{width:22px;height:22px;image-rendering:pixelated;margin-right:6px;flex-shrink:0}
  .achIcon.gray{opacity:.4;filter:grayscale(.8)}
  .ach{display:flex;align-items:center}
  .syn{display:flex;align-items:center}
'''
html=html.replace('  .chip{', css_block+'  .chip{')

# ============ 7. JS: 定义 SYN / ACH 图标表 (放在 ART 定义之后) ============
syn_table='''
// UI 独立建模: 协同组合徽章
const SYN = {
  sy_onestop:"SYN_ONESTOP", sy_family:"SYN_FAMILY", sy_work:"SYN_WORK", sy_shop:"SYN_SHOP",
  sy_health:"SYN_HEALTH", sy_fin:"SYN_FIN", sy_lux:"SYN_LUX", sy_kids:"SYN_KIDS",
};
// 成就徽章
const ACH = {
  a_first:"ACH_A_FIRST", a_ten:"ACH_A_TEN", a_maxed:"ACH_A_MAXED",
  a_expand1:"ACH_A_EXPAND1", a_expand2:"ACH_A_EXPAND2", a_expand3:"ACH_A_EXPAND3", a_expand4:"ACH_A_EXPAND4",
  a_50k:"ACH_A_50K", a_100k:"ACH_A_100K", a_500k:"ACH_A_500K",
  a_10day:"ACH_A_10DAY", a_30day:"ACH_A_30DAY", a_20k:"ACH_A_20K", a_50k_c:"ACH_A_50K_C",
  a_all9:"ACH_A_ALL9", a_lv3:"ACH_A_LV3", a_synergy:"ACH_A_SYNERGY", a_allshop:"ACH_A_ALLSHOP",
  a_5syn:"ACH_A_5SYN", a_chain:"ACH_A_CHAIN", a_invest3:"ACH_A_INVEST3", a_20k_new:"ACH_A_20K_NEW",
};
'''
# 插到 "const state" 之前
anchor='// ============ 状态 ============'
if anchor in html:
    html=html.replace(anchor, syn_table+'\n'+anchor, 1)
else:
    # 找 const state
    m=re.search(r'const state\s*=', html)
    if m:
        html=html[:m.start()]+syn_table+'\n'+html[m.start():]
    print('ach/syn table inserted before state')

# 替换占位符为真实 base64
for key,f in [('HUD_CUST','hud_cust_32.png'),('HUD_TAX','hud_tax_32.png'),
              ('HUD_LEVEL','hud_level_32.png'),('HUD_INVEST','hud_invest_32.png')]:
    html=html.replace(key, b64(os.path.join(GEN,f)))
for key,f in [('SYN_ONESTOP','syn_onestop_40.png'),('SYN_FAMILY','syn_family_40.png'),
              ('SYN_WORK','syn_work_40.png'),('SYN_SHOP','syn_shop_40.png'),
              ('SYN_HEALTH','syn_health_40.png'),('SYN_FIN','syn_fin_40.png'),
              ('SYN_LUX','syn_lux_40.png'),('SYN_KIDS','syn_kids_40.png')]:
    html=html.replace(key, b64(os.path.join(GEN,f)))
for key,f in [('ACH_A_FIRST','ach_a_first_40.png'),('ACH_A_TEN','ach_a_ten_40.png'),
              ('ACH_A_MAXED','ach_a_maxed_40.png'),('ACH_A_EXPAND1','ach_a_expand1_40.png'),
              ('ACH_A_EXPAND2','ach_a_expand2_40.png'),('ACH_A_EXPAND3','ach_a_expand3_40.png'),
              ('ACH_A_EXPAND4','ach_a_expand4_40.png'),('ACH_A_50K','ach_a_50k_40.png'),
              ('ACH_A_100K','ach_a_100k_40.png'),('ACH_A_500K','ach_a_500k_40.png'),
              ('ACH_A_10DAY','ach_a_10day_40.png'),('ACH_A_30DAY','ach_a_30day_40.png'),
              ('ACH_A_20K','ach_a_20k_40.png'),('ACH_A_50K_C','ach_a_50k_c_40.png'),
              ('ACH_A_ALL9','ach_a_all9_40.png'),('ACH_A_LV3','ach_a_lv3_40.png'),
              ('ACH_A_SYNERGY','ach_a_synergy_40.png'),('ACH_A_ALLSHOP','ach_a_allshop_40.png'),
              ('ACH_A_5SYN','ach_a_5syn_40.png'),('ACH_A_CHAIN','ach_a_chain_40.png'),
              ('ACH_A_INVEST3','ach_a_invest3_40.png'),('ACH_A_20K_NEW','ach_a_20k_new_40.png')]:
    html=html.replace(key, b64(os.path.join(GEN,f)))

# Logo: ARTX 里的 logo 字段用新徽标 (替换 build 时内联的 ARTX)
# ARTX 是 build 时内联的, 所以改 art/stardew/skyline.png 不行 (那是天际线)
# 直接替换 ARTX 行里的 logo:"data:..." 为新的
m=re.search(r'const ARTX=\{logo:"(data:image/png;base64,[^"]+)"', html)
if m:
    new_logo=b64(os.path.join(GEN,'logo_stardew_64.png'))
    html=html.replace(m.group(1), new_logo)
    print('✓ ARTX.logo 换成星露谷徽标')

open(WEB,'w').write(html)
print('UI 独立建模接入完成, 文件', len(html), 'B')

# 验证占位符清零
leftovers=re.findall(r'HUD_\w+|SYN_(ONESTOP|FAMILY|WORK|SHOP|HEALTH|FIN|LUX|KIDS)|ACH_(A_\w+)', html)
leftovers=[x for x in leftovers if 'data:image' not in html.split(x)[0][-200:]]
print('残留占位符:', len(leftovers), leftovers[:10])
print('含 .hudIcon CSS:', '.hudIcon{' in html)
print('含 .achIcon CSS:', '.achIcon{' in html)
print('含 SYN 表:', 'const SYN = {' in html)
print('含 ACH 表:', 'const ACH = {' in html)
print('renderAch 用 ACH:', 'icon.src=ACH[a.id]' in html)
print('renderSynergy 用 SYN:', 'SYN[ g.id ]' in html or 'SYN[g.id]' in html)
