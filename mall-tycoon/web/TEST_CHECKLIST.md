# 商场大亨 — H5 版包体检测说明

## 检测入口
本地服务 `http://127.0.0.1:8731/index.bundle.html`(单文件 H5 可玩版,无任何外部依赖,直接浏览器打开即可)。
手机体验:把 `web/index.bundle.html` 单文件(或 [mall-tycoon-h5.zip](<mall-tycoon/mall-tycoon-h5.zip>) 解压后的 `game/index.html`)发到手机浏览器打开——已做触屏/PWA 适配。

## 19 项检测清单
1. 开局引导浮层出现,点"开始经营"关闭
2. 点空铺位建铺:顶部出现 9 个业态按钮(点某业态=锁定该业态,再点取消=自动买最便宜);建后铺位点亮、emoji+tag 标签显示、资金扣减
3. 再点已建铺位升级(等级+1,资金扣减,副标题"L2 零售 · 今日售 ¥xx")
4. 长按铺位 2 秒拆除(返还 50% 建造费)
5. 30 秒后自动过天:弹当日财报(顾客/收入/维护/员工工资/结余/累计顾客),进入第二天
6. 顶部事件条 8 种随机事件:🎉周末促销×1.5 / 🔧检修×0.5 / 🍜美食节(餐饮×2) / 👗时尚周(零售×1.8) / 🎄节假日×2 / 🌧️暴雨×0.4 / ⚡停电×0.3 / ☀️平日
7. 资金≥¥20,000 点「🔓 一街」,开放第 3 列 + 全体客流 +15%
8. 资金≥¥60,000 点「🔓 二街」,开放第 4 列 + 全体客流再 +15%(合计 +30%)
9. 铺位上出现顾客小图标并"+¥xx"浮动消费动画(顾客按业态偏好权重分流,错峰进场)
10. 实时收益条:今日实时 收入/维护/结余 三个数字;顾客按 attract*level*事件偏好 权重挑选消费对象
11. 攒到 ¥100,000 弹 🏆 达成横幅;成就面板(14 项,含全业态/万客盈门/二街通幽/黄金搭档/全能百货/连锁巨头)随进度点亮
12. 点"存档"/"重开"按钮,刷新页面后存档生效(localStorage)
13. 音效:建造/升级/拆除/收钱/达成/破产/成就达成 各有提示音(🔊 可关)
14. 连续 2 天负结余即破产 — 破产后 endDay 按钮禁用,弹红色 💸 横幅,可点重开
15. **业态组合协同**:同时开特定业态激活搭配(如 美食广场+电影院+酒店=一站式 ×1.3),顶部出现 ✨ 协同徽章,相关铺位客流整体提升
16. **情境化经营提示**:提示条随资金/铺位/阶段给出"下一步最优动作"(扩建/升级/建铺/凑搭配/负结余警告)
17. **业态选择资金校验**:选中某业态但资金不足时,点空地直接提示"资金不足,需 ¥xx",不静默建别的业态
18. **搭配图鉴**:点「✨ 搭配」按钮展开全部 4 组协同搭配,未激活的显示"需同时开齐",已开业态打 ✅、未开打 ⬜;激活后行高亮
19. **连锁经营**:同一业态开满 3 家,该业态铺位客流 +20%(搭配面板底部显示"🔗 连锁经营中:☕×3");达成"连锁巨头"成就(共 14 项成就)
20. **招聘系统**:点「👔 招聘」展开 4 档薪水面板(节俭/正常/优厚/顶配),点击切换档位:节俭=客流 ×0.85 但日薪省 15%、士气 85% 流失 25%;正常=基准;优厚=客流 ×1.2 日薪 +20%;顶配=客流 ×1.45 日薪 +45%。调薪立即生效,当日财报"员工工资"行与结余同步变化。存档持久化 payGrade。

## 数值参考
- 开局资金 ¥20,000
- **15 种业态**(按建造成本升序):咖啡(¥1500) / 超市(¥3000) / 游戏厅(¥5000) / 烘焙坊(¥8000) / 电影院(¥9000) / 美食广场(¥14000) / 精品酒店(¥18000) / 宠物诊所(¥16000) / 书店(¥20000) / 药妆店(¥22000) / 健身房(¥26000) / 快时尚(¥34000) / 银行(¥40000) / 数码体验(¥50000) / 艺术画廊(¥60000),最高 Lv5
- **8 种业态组合协同**(同时开特定业态,相关铺位客流整体加成):
  - ✨一站式服务:美食广场+电影院+酒店 ×1.3
  - ✨周末亲子:游戏厅+电影院+美食广场 ×1.25
  - ✨下班客流:咖啡+健身+书店 ×1.2
  - ✨购物天堂:超市+快时尚+书店 ×1.2
  - ✨健康生态:健身+药妆+宠物诊所 ×1.35
  - ✨商务高地:银行+数码体验+咖啡 ×1.4
  - ✨高端生活:快时尚+艺术画廊+精品酒店 ×1.4
  - ✨亲子烘焙:烘焙坊+游戏厅+电影院 ×1.3
- **5 阶段扩建客流加成(软机制)**:一街 +15% / 二街 +30% / 三街 +45% / 四街 +50%(合计),顾客池数字 8/12/16/20/24 仅作展示上限,不压经济
- 顾客池:一街 8 人 / 二街 12 / 三街 16 / 四街 20(有硬上限)
- **连锁经营**:同一业态开满 3 家,该业态所有铺位客流 +20%(鼓励专精经营)
- 扩建:一街 ¥20,000 / 二街 ¥60,000 / 三街 ¥150,000 / 四街 ¥300,000
- **💼 增长基金(投资系统)**:点「💼 投资」买基金,永久提升全体客流 ×1.0/级(可叠加 5 级,封顶 ×1.5);成本 30000/48000/76800/122880/196608,越买越贵;前期攒到 30 万买 3-4 级,后期冲 5 级拉满客流抵消税率
- **4 档招聘薪水**(点「👔 招聘」调整,立即影响全部铺位):
  - 节俭 ×0.85 客流 / 士气 85% / 流失 25% / 日薪 = 维护×0.85
  - 正常 ×1.00 客流 / 士气 100% / 流失 10% / 日薪 = 维护×1.00
  - 优厚 ×1.20 客流 / 士气 120% / 流失 4% / 日薪 = 维护×1.20
  - 顶配 ×1.45 客流 / 士气 145% / 流失 1% / 日薪 = 维护×1.45
- 4 铺 Lv1 日净约 ¥3.2 万(正常薪,税 5%);达成 ¥100,000 约 8-10 个游戏日(每日 30 秒,越后期越靠高收入冲税)
- **营业税(随天数上涨,增加难度)**:第 1-5 天 5% / 6-10 天 10% / 11-15 天 15% / 每 5 天 +5%,封顶 40%。公式:`taxRate() = min(0.40, 0.05 + floor((day-1)/5)×0.05)`;`endDay` 中 `net = income − tax − expense − wages`(税按当日 income 计算);`shopDailyEstimate` 含税;顶部 HUD 新增 `📋 税率 X%` chip;财报新增「营业税」行;税率上调时弹 toast「📋 税率上调至 X%」

## 检测结果
- **游戏丰富化第二轮:随机事件强化 + 昼夜循环 + 顾客深化 + 连锁扩张 UI + 装饰标记(本轮)**:用户选 7 方向, 前轮已落地经理/装饰/成就, 本轮补齐剩余 4 个独立切片 / **随机事件强化**: 新增 `toastEvent()` 每日事件刷新时弹出顶部播报 toast(利好📣/风险⚠️ 区分色), `renderEventBar` 现提取 emoji 图标显式渲染进 `#eventbar`(带 .evIcon), 挂在 loop 的 `endDay` + 手动结束两处 / **昼夜循环**: 新增 `renderDayNight()` 随 `state.dayTime` 设 CSS 变量 `--daynight-tint`(清晨暖→正午金→黄昏橙→夜蓝四段关键帧), `#gridWrap::after` multiply overlay 跟随, HUD「第 N 天」旁加时刻芯片 `#timeChip`(🌅清晨/☀️白昼/🌇黄昏/🌙夜晚), 每帧 loop 调一次 / **顾客深化**: 新增 `state.satisfaction`(0-1)+ `REPURCHASE` 表 + `updateSatisfaction()`(按已建铺位服务质量: 等级/士气/装饰/事件 加权, 缓慢逼近+日衰减 5%, 下限 20%), `repurchaseMult()`(满意度×0.3)注入 `customersPerHour`, HUD 满意度芯片 `#satChip`(😊/🙂/😐 随值切换)+ 新成就 `a_sat80`(口碑爆棚·满意度 80%+)/ **连锁扩张 UI**: 「🔓 连锁扩张」按钮显示街区进度(街区 N/4)+ 下阶段成本, 未改解锁经济逻辑 / **装饰标记**: 已装装饰铺位渲染 `🎀 装饰 +15%` 小标签(`.decor`)/ 成就 24→25 / 修复: 上一轮重复注入的 `if(state.dayTime>=1...)` 重复行导致语法错误 → 已去重; 升级路径 `SHOPS[sl.type]` 加 `if(!d2)return` 防御 / Playwright 多日模拟: 建 3 铺+经理+2 装饰+5 天 endDay → satisfaction 93% + 0 pageerror; `checkAchievements` 触发 a_manager/a_decor/a_sat80 全绿; 装饰实测 decorMult 1→1.15 + slot `.decor` 可见; 昼夜 tint 变量实测 `rgba(255,248,220,0.11)`; 0 pageerror; bundle md5 `ce17529b`, 体积 315,774 B → ENRICH2 PASS
- **游戏丰富化:经理系统 + 装饰系统 + 成就扩展(上轮)**:jsdom 7/7 + Playwright 逻辑全绿 — 用户选 7 方向(昼夜/连锁/顾客/装饰/成就/员工/随机事件), 本轮先落地 3 个独立可验证切片, 避免一次堆多 / **经理系统**(纯逻辑): `state.manager`(雇经理 ¥80,000, `hireManager`)+ `managerAct()` 每日 `endDay` 自动帮"最弱"(等级最低, 平级取今日收入最低)的已建店铺免费升 1 级(满级跳过)/ **装饰系统**: `state.decorations`(铺位索引 → true), `buyDecor(i)` ¥20,000 给单铺位, `decorMult(i)=1.15` 注入 `customersPerHour` → 该铺位客流 +15%(实测同级 2 家咖啡: 无装饰 6/h → 有装饰 7/h = +17% 取整波动)/ 双击已建铺位买装饰(交互挂在 slot `dblclick`, 未装装饰时)/ **成就扩展** 22→24: 新增 `a_manager`(运筹帷幄·雇经理)+ `a_decor`(精雕细琢·给一家铺位装装饰)/ 旧存档兼容: `load()` 补 `state.manager/decorations` 默认值 / jsdom ACH=24 / MANAGER.cost=80000 / DECOR 20000×1.15 / Playwright: `hireManager` 成功(资金 500000→420000)+ `managerAct` 把 Lv1 咖啡升到 Lv2 + `buyDecor` 后 decorMult 1→1.15 + HR 面板出现"职业经理"雇佣按钮 + `checkAchievements` 触发 `a_decor`; 0 pageerror; bundle md5 `d7bb5aa5`, 体积 310,437 B → ENRICH PASS
- **橡木背景收窄到 app 容器(上轮)**:jsdom + Playwright 全绿 — 上一轮橡木贴 `html,body` 全屏铺满, 用户反馈"太宽, 和下面背景图一样宽就行" → `injectOakUi` 改: `html,body` 回退原奶油渐变(`linear-gradient #f5ecd0/#f0e4c0`), 橡木贴图只铺 `#app` 容器(`background:url(oak);background-color:#8a5a30`), `#app` 保持 `max-width:720px;margin:0 auto`(手机 420 / 平板 720, 两侧超出部分显示 html 奶油渐变)/ Playwright 实测(420 视口): `htmlBgIsCream: true` + `appBgIsOak: true` + `appW:420 / gridWrapW:400`(橡木宽度 ≈ 铺位区小镇图宽度, 视觉一致)/ 宽视口(800px)实测: html 两侧 = 奶油渐变 + `#app` 中间一条 = 橡木, 两侧不铺橡木 ✓; 铺位区小镇图 / 招商文案 / 全部橡木 UI 样式不变; 0 pageerror; 截图 `shot_oakwidth.png`(bundle md5 `4bd071df`, 体积 307,063 B)→ OAKWIDTH PASS
- **橡木背景精致化 + 界面尺寸化(上轮)**:jsdom + Playwright + 像素级校验全绿 — 重新生成橡木页面背景贴图(AI `agnes-image-2.5-flash` 768×1024 大图 → 按 4:5 游戏界面比例 LANCZOS 缩到 160×200 → NEAREST 放大 320×400 像素块 + 48 色 FASTOCTREE, 42,799 B b64 57,068 字符; v1 720×900 太臃肿 331KB 弃用, 选 v2 居中柔光 + 边缘暗角 + 金色铆钉装饰版)/ `ARTX.oak` 由 320×256(31,606 B)替换为 **320×400 精细版**(按手机界面 4:5 比例生成, `cover` 铺满时裁切更小、像素块清晰不糊)/ 铺位区小镇图 / 招商文案 / 全部橡木 UI 样式(上一轮 OAKFULL)保持不变 / 2 铺位已建 + 10 空铺位(招商)+ 11 顾客 + 资金 ¥495,500 + 0 pageerror; 实测 html 背景 = 橡木 data URI + `#app` 透明;截图 `shot_oakhdl.png`(bundle md5 `3de9add1`, 体积 306,967 B)→ OAKHD PASS
- **继续完成:整体 UI 统一橡木招牌风(上轮)**:jsdom 5/5 + Playwright 冒烟全绿 — 延续上轮 OAKUI/OAKBG(橡木背景 + 文字标签 + 铺位文字框), 把**剩余奶油色 UI 元素**也统一到橡木招牌风(`injectOakUi` 追加注入样式, 基础 CSS 不动): button / .shopBtn / .invBuy 换橡木底 + 深棕 `#5a3a18` 框 + 奶油 `#d8b888` 内缘 + 白字 / #barWrap / #goalBar 换橡木底 / 4 浮层面板(ach/syn/inv/hr) + #report 换橡木底 + 白字标题 / #tip/.tipbar 白字 / 2 铺位已建(咖啡厅/超市) + 10 空铺位(招商文案保留) + 11 顾客 + 资金 ¥495,500 + 0 pageerror; 实测 btn/bar/背景 `backgroundImage` 全为橡木 data URI; 截图 `shot_oakfull.png`(bundle md5 `43372a80`, 体积 255,999 B)→ OAKFULL PASS
- **保存副本 + 空地改招商 + 整体背景改橡木(上轮)**:jsdom 6/6 全绿 + Playwright 冒烟全绿 — 先 `cp index.bundle.html index.bundle.backup_20261026_1948.html`(262,095 B)保存当前版本 / 空地文案改招商:铺位 `nameHtml '空地'→'招商'` + tipbar / 新手引导 / 提示文案同步改"招商位"(实测铺位 name 全部含"招商"/"锁定")+ 10 空铺位 / `#app` 背景改 `transparent`(让 html 橡木底透出), `html,body` 注入 `url(ARTX.oak) center/cover` + `#8a5a30` 兜底色 → 整体游戏背景(上方+两侧边框)全换橡木,铺位区 `#gridWrap` 小镇图(`url(data:image/png...)`)实测不动 / 2 铺位已建(咖啡厅/超市)+ 9 顾客 + 资金 ¥495,500 + 0 pageerror;截图 `shot_oakbg.png`(bundle md5 `635e2b1a`, 体积 254,931 B)→ OAKBG PASS
- **生成橡木素材, 文字标签/文字框换橡木样式(上轮)**:jsdom 5/5 全绿 + Playwright 冒烟全绿 — AI 生成橡木纹 UI 贴图(`agnes-image-2.5-flash` 16-bit 像素风橡木木板, 3 张候选 v1/v2/v3 → 白底移除 → 320×256 → 48 色 FASTOCTREE 量化, 选 v1 23,688 B)/ `ARTX.oak` 内联进 bundle(首次误插成裸 b64 无 data: 前缀, 修复后 `data:image/png;base64` 完整)/ `injectUiStitch`(旧像素双线木框)整体替换为 `injectOakUi`: 上方文字标签(.chip/.eventbar/.phaseChip/#liveChip)换橡木底(深棕 `#5a3a18` 像素框 + 奶油 `#d8b888` 内缘 + 白字 `#fff8ec`)/ 铺位文字框(.slot .name/.lv/.tag)换橡木小牌(同深棕框 + 白字)/ 2 铺位已建(咖啡厅/超市)+ 2 `.shopSign` + 10 顾客 + 资金 ¥495,500 正确扣除 + chip/铺位文字框 `backgroundImage` 实测 = 橡木 data URI + 0 pageerror;截图 `shot_oakui.png`(bundle md5 `219b995b`, 体积 254,879 B)→ OAKUI PASS
- **回退上一轮, 只改上方文字和文字框的描边(上轮)**:jsdom 6/6 + Playwright 全绿 — 上一轮"整体 UI 统一像素小镇风"把小镇图移到 html 全屏背景 + 给所有按钮/进度条/面板加双线框, 改动范围超出"文字和文字框", 本轮**全部回退**:`injectUiStitch` 删除 `html,body` 全屏小镇背景行 + `#gridWrap{background:none}` 行(小镇图回到 `#gridWrap` 专属, `htmlBg` 实测回退为原奶油渐变、`gridWrapBg` 实测 `url(data:image/png...)`)/ 删除 button / barWrap / goalBar / 4 浮层面板 / report / onboard / winBanner 的双线框(实测 `btnShadow: none`、`barShadow` 回原样)/ 仅保留**上方 HUD 文字标签**(.chip / .eventbar / .phaseChip / #liveChip)和**铺位内文字框**(.slot .name / .lv / .tag)的像素双线木框(`inset 0 0 0 2px #a87848, inset 0 0 0 4px #f5ecd0, inset 0 0 0 5px #8a5a30`)/ 顺带删掉未使用的 `ARTX.uiwall` 内联(28,670 B b64, 体积 220,115 → 190,887 B)/ 2 铺位已建(咖啡厅/超市) + 2 `.shopSign` + 9 顾客 + `pedsBg 240px 48px`(大顾客带间隙版保留)+ 资金 ¥495,500 + 0 pageerror;截图 `shot_revert.png`(bundle md5 `c8086ea3`, 体积 190,887 B)→ REVERT PASS
- **整体 UI 统一像素小镇风(上轮, 已回退)**:jsdom 6/6 全绿 + Playwright 冒烟全绿 — 小镇图 `ARTX.town` 从 `#gridWrap` 背景**移到 `html` 层全屏背景**(`center top/cover` + `#f5ecd0` 兜底色), `#gridWrap` 改 `background:none` → 铺位区之外(页面顶部/底部/两侧)也看得见镇子, 画面不再只有中间一块 / 全部米白 UI 元素加**像素双线木框**(cream `#f5ecd0` + 深棕 `#a87848/#8a5a30` 三层 inset 描边, 无圆角): chip / eventbar / phaseChip / liveChip / button / barWrap / goalBar / 4 浮层面板(ach/syn/inv/hr) / report / onboard / winBanner / slot .name/.lv/.tag / 去掉上一轮实验性的"全屏深色木墙背景"(`injectUiWall` 删除, 深棕墙面盖住了小镇画面)/ 2 铺位已建(咖啡厅/超市) + 14 顾客 + 资金 ¥495,500 正确扣除 + 0 pageerror;截图 `shot_uistitch.png`(bundle md5 `f25c1d57`, 体积 220,115 B)→ UISTITCH PASS(已被本轮 REVERT 回退)
- **顾客立绘粘连修复(上轮)**:jsdom + Playwright + 像素级校验全绿 — 上一轮 2x 放大时 6 个 32px 立绘**紧邻排布无间隙**,相邻立绘在接触面粘连成一体 / 重做 `gen_peds_sheet.py`:每 40px 单元 = 32px 立绘 + 8px 全透明间隙,输出 240×48 表(8,585 B b64 11,470 字符),NEAREST 2x 保持像素硬边 / 像素级校验:6/6 变体右 8px 间隙区**全透明 ✓**,立绘 y 0~47 全高无裁切 / CSS `.cus` 32×48 + `background-size 240px 48px`,JS `backgroundPosition (-40*variant) 0px` + `CW=32`(off -16px 水平居中)/ 3 铺位已建 + 16 顾客 + 6 种 backgroundPosition 变体(0/-40/-80/-120/-160/-200px)+ 资金 ¥490,500 正确扣除;截图 `shot_gapcus_allvariants.png`(6 变体并排对照)+ `shot_gapcus_scene.png`(bundle md5 `22a50c0c`, 体积 190,380 B)→ GAPPED PASS
- **修复人物立绘显示不完整(上轮)**:jsdom + Playwright 全绿 — 顾客精灵 **168×48(上一轮裁切版) → 192×48(不裁切完整立绘)**,上一轮 `src.crop(bbox)` 把每变体 4px 左缘裁掉 + 部分变体底部 2px 裁掉,导致立绘"半身/断脚" / 从 `peds_final`(96×24 RGBA 源)重新 NEAREST 2x 放大,每变体保留完整 28×48 不透明区(6/6 变体 y 0~47 全高)/ `.cus` CSS 高度 42 → 48(完整立绘,不再裁脚),`background-size` 168 → 192,`backgroundPosition` 垂直偏移 12px → 0px(不再裁顶)/ JS `CH` 42 → 48(roadY/ty 按 48 重算)/ 内联 bundle 校验 6/6 变体不透明 y 0~47(全高无裁切);Playwright 冒烟 3 铺位已建 + 12 顾客 + 顾客实测 **28×48** + 背景 192×48 + 6 种 backgroundPosition 变体(-28v 0px)+ 资金 ¥490,500 正确扣除 + 截图 `shot_fixcus.png` + 全变体对照 `shot_fixcus_allvariants.png`(bundle md5 `45f41af2`, 体积 197,190 B)→ FIXCUS PASS
- **顾客放大到门同比例(上轮)**:jsdom 9/9 全绿(0 误报) — 顾客精灵 16×24 → **28×42(1.75 倍放大)**,与背景房子门同比例 / `ARTX.peds` 替换为 2x 放大版 192×48 → 裁边后 168×48 精灵表(6 变体 × 28px,2,862 B b64 3,838 字符)/ `.cus` CSS `width:28px;height:42px;background-size:168px 48px` / `backgroundPosition` 偏移从 `(-16v) 4px` → `(-28v) 12px`(28px 变体宽,12px 垂直偏移补偿 48→42 裁切)/ 顾客定位:左入口 4px + 横向路 roadY 按 42 高对齐脚底 + 纵向路 tx/ty 减半宽 -14px 居中 / 2 铺位已建 + 顾客生成 ≥2 + backgroundPosition 28px 倍数验证 / ACH=22 / 12 铺位;Playwright 冒烟 3 铺位(咖啡厅/超市/游戏厅)已建 + 10 顾客 + 顾客实测 28×42 + 背景 168×48 + 资金 ¥490,500 正确扣除 + 截图 `shot_biggercus.png`(bundle md5 `0a91ddb0`, 体积 189,818 B)→ BIGCUS PASS
- **招牌小型化+仅文字(上轮)**:jsdom 13/13 全绿(0 误报) — 招牌 `.shopSign` 宽度从 70% 缩小到 52%,去掉 `.signEmoji`(18px emoji 图标),仅保留 `.signName` 店名文字(7px 等宽,深棕文字 + 深棕硬投影,无白色底色 padding)/ 招牌 `signImg`(AI 像素木牌)+ `signName` 店名 + 业态色 `outline:2px` 描边 / 3 铺位(咖啡厅/超市/游戏厅)3 招牌业态色 distinct / 0 `.signEmoji` / 0 `.shopIcon` 大图 / ACH=22 / 12 铺位;Playwright 冒烟 3 铺位已建 + 3 `.shopSign` + 3 `.signImg` + 3 `.signName` + 0 `.signEmoji` + 店名"游戏厅"实测渲染 + gridWrap 背景=小镇图 data URI + 7 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_signtext.png`(bundle md5 `cb5258a0`, 体积 187,254 B)→ SIGNTXT PASS
- **生成像素风招牌(AI 像素木牌图)(上轮)**:jsdom 11/11 全绿(0 误报) — 招牌改用 **AI 生成像素木牌图 `ARTX.sign`**(agnes-image-2.5-flash 生成 16-bit 像素风悬挂木牌 → 白底移除 → 128×96 画布 → 48 色 FASTOCTREE 量化,2,895 B b64 3,882 字符)/ 招牌结构改为 `.shopSign` = `<img class="signImg" src=ARTX.sign outline:2px 业态色>` + `.signText`(emoji 18px + 店名 8px 等宽,奶油底 `rgba(255,248,236,.72)`)/ 摇摆动画挪到 `.shopSign` 整体(±1.5° 2.6s)/ 旧 `.signRope`/`.signBoard` CSS 删除(0 残留)/ 3 铺位 3 招牌 signImg(轮廓 2px 业态色 distinct)/ 无 `.shopIcon` 大图 / ACH=22 / 12 铺位;Playwright 冒烟 3 铺位已建 + 3 `.shopSign` + 3 `.signImg`(src=data:image/png;base64)+ gridWrap 背景=小镇图 data URI + 10 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_signimg.png`(bundle md5 `d5725942`, 体积 187,540 B)→ SIGNIMG PASS
- **招牌+UI 像素艺术风格统一(上轮)**:jsdom 11/11 全绿(0 误报) — 招牌 `.shopSign` 重做为像素风(方角 `border-radius:0` + 木色 `#d8c0a0` 牌面 + 深棕 `#6a4a28` 粗边框 + 像素化绳索 + `image-rendering:pixelated` + 牌顶木纹装饰条 + 1.8° 轻微摇摆)/ 全 UI 统一像素风(所有 `border-radius` 改 0, 边框加粗 2px, 加内层描边 `inset 0 0 0 1px rgba(255,250,240,.15)`, 配色保持暖米 `#f5e8c8→#e8d8a8` + 深棕文字 `#3a2a18`)/ 3 铺位 3 招牌(咖啡厅/超市/游戏厅)业态色 distinct / 无 `.shopIcon` 大图 / ACH=22 / 12 铺位;Playwright 冒烟 3 铺位已建 + 3 `.shopSign` + 招牌 `border-radius` 实测 `0px`(方角像素风)+ gridWrap 背景=小镇图 data URI + 9 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_pixelstyle.png`(bundle md5 `51b2f98a`, 体积 183,978 B)→ PIXELSTYLE PASS
- **建店改为给背景房子上挂招牌(上轮)**:jsdom 11/11 全绿(0 误报) — 已建铺位从 85% `shopIcon` 大图(遮死背景房子)改为**悬挂式招牌**(`.shopSign` = 绳子 `.signRope` + 业态色木牌 `.signBoard`, emoji 18px + 店名 9px, 带 2.4s 摇摆动画), 挂在格子顶部 4px, 房子在下方背景里保持可见 / 去掉 `awning` 遮阳篷 + `baseboard` 底板(招牌替代) / 铺位格子全透明(空地/已建 JS 背景=transparent) / 3 铺位(咖啡厅/超市/游戏厅)3 招牌业态色 distinct / ACH=22 / 12 铺位;Playwright 冒烟 3 铺位已建 + 3 `.shopSign` 招牌 + 0 `.shopIcon` 大图 + 0 `.awning` + gridWrap 背景=小镇图 data URI + 8 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_sign.png`(bundle md5 `d08ed709`, 体积 183,371 B)→ SIGN PASS
- **背景房子与业态建模同风格可直接替换(上轮)**:jsdom 11/11 全绿(0 误报) — 用 `agnes-image-2.5-flash` 生成同风格小镇背景 v2(4列×3行店铺门面, 各带彩色遮阳篷/门/招牌, 风格与 15 业态像素建模一致: 星露谷暖秋色/16-bit/简单店面), 去白底→裁切→320×256 量化 48 色 25,046B 挂 `ARTX.town` 替换旧背景 / 铺位格子全透明(空地/已建 JS 背景=transparent, CSS `.slot.empty` 透明), 直接显示背景房子, 建店时业态图标(85%)叠在背景同风格房子之上形成"替换"效果 / 遮阳篷收窄 70%+居中 left:15%(不遮满整个铺位, 露出更多背景房子) / 锁定铺位保留 40% 暗遮罩 / 顾客走小路修复: 两阶段动画(阶段1 沿横向小路水平走到目标列 x 0.6s + 阶段2 沿纵向小路走进店里 0.4s, 偶数号走上路奇数号走下路) / ACH=22 / 15 图标 md5 distinct / 3 铺位 3 图标;Playwright 冒烟 3 铺位(咖啡厅/超市/游戏厅)已建 + 铺位背景实测 `rgba(0,0,0,0)`(透明)+ gridWrap 背景=小镇图 data URI + 11 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_bgbuild.png`(bundle md5 `f7ba5718`, 体积 182,510 B)→ BGGUILD PASS
- **背景房子与业态建模同风格可直接替换(上轮)**:jsdom 11/11 全绿(0 误报) — 用 `agnes-image-2.5-flash` 生成同风格小镇背景 v2(4 列×3 行店铺门面, 各带彩色遮阳篷/门/招牌, 风格与 15 业态像素建模一致: 星露谷暖秋色/16-bit/简单店面), 去白底→裁切→320×256 量化 48 色 25,046B 挂 `ARTX.town` 替换旧背景 / 铺位格子全透明(空地/已建 JS 背景=transparent, CSS `.slot.empty` 透明), 直接显示背景房子, 建店时业态图标(85%)叠在背景同风格房子之上形成"替换"效果 / 遮阳篷收窄 70%+居中 left:15%(不遮满整个铺位, 露出更多背景房子) / 锁定铺位保留 40% 暗遮罩 / ACH=22 / 15 图标 md5 distinct / 3 铺位 3 图标;Playwright 冒烟 3 铺位(咖啡厅/超市/健身房)已建 + 铺位背景实测 `none`(透明)+ gridWrap 背景=小镇图 data URI + 11 顾客 + 资金 ¥469,500 正确扣除 + 截图 `shot_bgmatch.png`(bundle md5 `9dd3a4d6`, 体积 182,299 B, 较去绿框版 187,217 B −4,918 B 因 v2 背景 25KB 比旧版 28KB 小)→ BGMATCH PASS
- **去绿框 + 直接用背景房子(上轮)**:jsdom 10/10 全绿(0 误报) — 铺位格子去掉绿色背景+绿色虚线边框(border:none + background:transparent),铺位间隙也透明,让小镇背景图里的房屋/草地直接显示;已建铺位只加 12% 暗色遮罩区分(不盖背景),锁定铺位 35% 暗色遮罩;gridWrap::after inset 阴影框去掉(那是绿色框来源);gridWrap 底色改暖米 `#f5ecd0`;顾客走小路 13 个生成;ACH=22;2 铺位 2 图标;Playwright 冒烟 铺位边框实测 `0px none`(无绿框)+ gridWrap 底色 `rgb(245,236,208)` 暖米 + 13 顾客 + 资金 ¥495,500 + 截图 `shot_nogreen.png`(bundle md5 `dcd86793`,体积 187,217 B,较去框前 188,330 B −1,113 B)→ NOGREEN PASS
- **小镇背景 + 空地草地 + 顾客走小路(上轮)**:jsdom 8/8 全绿(0 误报) — 取消铺位半透明方块,空地改草地绿渐变 `#a8c478→#8aad5a` / 已建铺位=业态色光晕+草地底 / 锁定=土路条纹 / 间隙加宽 14px + gridWrap padding 14px(小路从铺位间隙透出)/ 生成 320×256 星露谷小镇背景图(AI 生图→量化 48 色 28,745B,挂 ARTX.town)/ 顾客走小路:左侧入口 x=4 → 沿上/下横向小路水平走到目标列 → 纵向小路走进店里(两阶段 left 0.6s + top 0.5s)/ peds sprite 还原 96×24 人形(cus CSS height 24px 1:1 正常)/ ACH=22 / 2 铺位 2 图标;Playwright 冒烟 12 顾客走小路中 + 2 铺位已建 + 资金 ¥495,500 正确扣除 + 小镇背景 data URI 已加载 + 截图 `shot_town2.png`(bundle md5 `b94835b2`,体积 188,330 B,较统一图标版 164,453 B +23,877 B 因小镇背景图 28KB + 间隙加宽)→ TOWN PASS
- **铺位方块半透明 + 图标最上层(上轮)**:jsdom 冒烟全绿 — 诊断: 建造后铺位格子原本是实心渐变背景(盖住图标);改成全部半透明方块:已建铺位背景 `rgba(255,250,240,.28)`(原业态色实心渐变)/ 空置斜纹方块 `rgba(255,250,240,.18)` 更透 / 锁定条纹 `rgba(...,.35)` / slot 基础底 `rgba(255,250,240,.22)` / 图标 `.shopIcon` 保持 `z-index:10` 最上层 + 投影加强 `drop-shadow(0 4px 5px rgba(60,40,20,.45))` 让它"浮"在方块上 / 店名·Lv·徽章 `z-index:11` 在图标之上可读;Playwright 冒烟 2 铺位(咖啡厅/超市)图标 81×81 `z-index:10` + 铺位背景实测 `rgba(255,250,240,0.28)` 半透明 + 9 顾客 + 资金 ¥495,500 正确扣除 + 截图 `shot_semi.png`(bundle md5 `c1511379`, 体积 164,181 B, 较统一版 164,453 B −272 B)→ SEMI PASS
- **15 业态图标统一大小(上轮)**:jsdom 6/6 全绿(0 误报) — 诊断发现 15 张 AI 图标在 48×48 画布上内容边界各不一样(超巿 69%×54% 偏小 / 健身·烘焙 92%×96% 偏大 / 宠物 100% 贴边),导致铺位里店显大小不一;Pillow 后处理:每张裁内容边界 → 等比缩放到统一 38px → 居中放回 48×48 透明画布 → 量化 64 色,15 张内容全部 38px 居中(新 bbox 一致) / 重内联 ART(20,255B) / 15 图标 md5 distinct / ACH=22;Playwright 冒烟 3 种不同业态(健身房/超市/艺术画廊)3 图标实测全部 81×81 统一 + 资金 ¥411,000 正确扣除 + 截图 `shot_uniform.png`(bundle md5 `d695ea0a`, 体积 164,453 B, 较放大版 162,749 B +1,704 B 因统一居中图标略大)→ UNIFORM PASS
- **店铺图标放大撑满小格子 + 最上层(上轮)**:jsdom 10/10 全绿(0 误报) — logo 32px→48px(不再压扁, 星露谷徽标 1:1 正常显示)/ shopIcon 52×52(源 48px 放大模糊)→48×48(1:1 清晰)/ hudIcon 18px→16px(源 32px 缩小更清晰)/ 顾客 sprite 96×24 压扁→重生成 96×16 正常 1:1 人形(CSS height 24→16, background-size 96px 16px)/ synIcon·achIcon 保持 22px(源 40px 缩到 22 正常)/ ACH=22 / 1 铺位已建;Playwright 冒烟 logo 实测 48px + shopIcon 实测 48px + 顾客实测 16×16 + 资金 ¥495,500 扣除正确 + 截图 `shot_normal_ratio.png`(bundle md5 `e4a3b24f`, 体积 162,446 B, 较 UI 版 163,046 B −600 B 因顾客 sprite 从 96×24 改 96×16 更小)→ RATIO PASS
- **UI 独立建模(全范围, 上轮)**:jsdom 14/14 全绿(0 误报) — 用 `agnes-image-2.5-flash` 生成全套 UI 图标并接入:6 HUD 芯片图标(资金/天数/客流/税收/等级/投资, 32×32 量化 32 色, 单张 596~750B)/ 8 协同组合徽章(40×40 量化 40 色, 单张 867~1,021B, 挂 SYN 表)/ 22 成就小徽章(40×40 量化 40 色, 单张 851~1,147B, 挂 ACH 表)/ 星露谷风 logo 徽标(64×64 量化 64 色 1,874B, 替换天际线 logo) / SYN 表=8 协同 md5 distinct / ACH 表=22 成就 md5 distinct / 全 data URI / HUD 客流图标已挂 / ACH=22 / 15 业态 + 2 别名 / 3 铺位 3 图标 distinct;Playwright 冒烟 成就面板 22 行全带 .achIcon + 协同面板 8 行 + 4 HUD 图标 + logo=星露谷徽标 data URI + 截图 `shot_uipanels.png`(bundle md5 `b045841e`, 体积 163,046 B, 较星露谷版 142,848 B +20,198 B 因 36 张 UI 图标+新 logo)→ UI PASS
- **小镇背景 + 15 店独立图标修复(上轮)**:jsdom 全绿 — 确认 15 业态图标全部独立(md5 无重复, cafe~Art 各 775~1,224B, 48×48 透明底) / 15 张 shopSelect 按钮图标 src 全 distinct / build 3 铺位(咖啡厅/超市/游戏厅)3 图标 src 全 distinct / 星露谷风城市墙背景已铺(192×176 repeat, opacity .35) / ACH=22 / 无缺失图标、无重复图标;Playwright 冒烟 3 铺位 3 图标 + 6 顾客 + 资金 ¥490,500 正确扣除 + 城市墙背景 data URI 已加载 + 截图 `shot_town.png`(bundle md5 `d2616451`,体积 142,848 B 不变,纯验证轮无 CSS/素材变更)→ TOWN PASS
- **星露谷风格背景+文字(上轮)**:jsdom 16/16 全绿(0 误报) — 用 `agnes-image-2.5-flash` 生成星露谷风格背景(温馨像素农场镇景:秋日暖色/木屋/果树/木栅栏)/ 天际线 768×48(AI 生成→量化 32 色 11,214B)/ 城市墙 192×176(AI 生成→量化 24 色 11,430B,16×16 平铺)/ UI 色板换星露谷暖米系(底 `#f5ecd0` / 面板 `#f5e8c8` / 银米 `#d8c8a8` / 秋日金 `#c88840` / 深棕文字 `#3a2a18` / 暖米次要 `#6a5840`)/ 旧粉色 `#f5e0e8`·`#f0c0d0` 全移除 / 铺位基底 `#f5e8c8→#e8d8a8` 暖米 / 15 业态图标保留 AI 生成版 / 6 顾客 sprite 保留 / ACH=22 / 3 铺位 3 图标 + 3 遮阳篷 + 3 底板;Playwright 冒烟 3 铺位(咖啡厅/超市/游戏厅)3 图标 + 9 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_stardew2.png`(bundle md5 `d2616451`,体积 142,848 B,较 AI 生图版 115,614 B +27,234 B 因星露谷背景图更大)→ STARDEW PASS
- **AI 生图素材(上轮, agnes-image-2.5-flash)**:jsdom 10/10 全绿(0 误报) — 用 `apihub.agnes-ai.com` 免费生图模型生成全部素材:15 张业态建筑图标(512px 生成→透明底 flood-fill→48px 量化 48 色,单张 775~1,224B,15 张共 13.2KB)/ 6 张顾客角色(512px→bounding-box 裁剪→16×24 拼 96×24 sheet 量化 48 色 1,335B)/ 天际线(1024×128→384×24 量化 48 色 2,106B)/ 城市墙(1024×1024→192×176 量化 32 色 9,248B)/ logo(512px→64px 量化 64 色 1,562B)/ dither 8×8 111B / 15 图标四角透明 α=0 / 15 图标 md5 distinct / ART=15 业态 + 2 别名 / 15 业态按钮 / ACH=22 / 3 铺位 3 图标 md5 distinct;Playwright 冒烟 3 铺位(咖啡厅/超市/游戏厅)3 图标 + 8 顾客 sprite + 资金 ¥490,500 正确扣除 + 截图 `shot_aiart.png`(bundle md5 `1b049844`,体积 115,614 B,较粉底版 108,802 B +6,812 B 因 AI 生图比 Pillow 手绘大)→ AIART PASS
- **字体清晰化微调(上轮)**:jsdom 22/22 全绿(0 误报) — UI 色板换粉色系(底 `#f5e0e8` 浅粉 / 面板 `#f0c8d4` 粉 / 银粉 `#d8b8c0` / 粉金 `#e0a0b0`)/ 所有文字改深棕黑 `--text:#2a1820` + 深粉棕次要 `#5a4050` / 金色底 winBanner+achToast+lv.max+invBuy.max 改暖橙字 `#3a1808` / 事件条 good/bad/mixed 改粉底+深棕字 / 铺位基底 `#f0c8d4→#e8b8c4` / 锁定 `#f0c8d4/#e8b8c4` 警戒 / 旧咖啡 `#d8c0a0`·`#8a6a4a`·`#1a1208` 全移除 / 天际线重绘粉色天空(暖橙太阳+粉紫远山+浅粉云朵+深粉楼群+亮窗)/ 城市墙重绘粉色街景(浅粉人行道+中粉马路+暖白斑马线+暖黄路灯+粉绿树+车流光)/ ACH=22 / 3 铺位 3 lv + 3 tag;Playwright 冒烟 2 铺位(咖啡厅/超市)2 店名 + 2 lv + 资金 ¥495,500 正确扣除 + 截图 `shot_pink.png`(bundle md5 `f4442dcf`,体积 108,802 B,较咖啡版 107,097 B +1,705 B 因粉街景更大)→ PINK PASS
- **咖啡色背景 + 黑色字体(上轮)**:jsdom 21/21 全绿(0 误报) — UI 色板换咖啡系(底 `#d8c0a0→#c8b090` 浅咖啡 / 面板 `#8a6a4a` 中咖啡 / 金 `#c89030` / 边框 `rgba(138,110,80,.55)`)/ 所有文字改黑色 `--text:#1a1208` + 深咖啡次要 `#3a2a18` / 金色底 winBanner+achToast+lv.max+invBuy.max 改深棕字 `#2a1808` / 事件条 good/bad/mixed 改浅咖啡底+深棕字 / 铺位基底 `#8a6a48→#6a4a30` / 锁定 `#8a6a48/#6a4a30` 警戒 / 旧深蓝 `#0a1525`·`#1a3050`·`#152540` 全移除 / 旧暖白 `#fff2d8` 清零 / 天际线重绘咖啡色天空(暖橙太阳+深咖啡楼群+亮窗)/ 城市墙重绘咖啡街景(浅咖啡人行道+中咖啡马路+暖金斑马线+暖黄路灯+绿树+车流光)/ ACH=22 / 3 铺位 3 lv + 3 tag;Playwright 冒烟 2 铺位(咖啡厅/超市)2 店名 + 2 lv + 资金 ¥495,500 正确扣除 + 截图 `shot_coffee.png`(bundle md5 `5eb689ef`,体积 107,097 B,较暖白版 108,394 B −1,297 B 因咖啡街景更小)→ COFFEE PASS
- **所有字体改暖白 #fff2d8(上轮)**:jsdom 13/13 全绿(0 误报) — 48 处 `color:#ffffff` 全替换为 `color:#fff2d8` / `--text`·`--cream` 变量改暖白 `#fff2d8` / `--text-dim` 改暖米 `#d8c8a8` / winBanner+achToast+lv.max+invBuy.max(金底)+lv.on 文字同步暖白 / 铺位 lv/tag 徽章文字同步暖白 / 无 `color:#ffffff`·`color:#fff;` 残留 / ACH=22 / 2 铺位 2 lv + 2 tag;Playwright 冒烟 2 铺位(咖啡厅/超市)2 店名 + 2 lv + 资金 ¥495,500 正确扣除 + 截图 `shot_warmwhite.png`(bundle md5 `ca4fbdf2`,体积 108,394 B,较铺位徽章全白版 108,391 B +3 B)→ WARMWHITE PASS
- **铺位店铺名/等级/类别徽章全白(上轮)**:jsdom 11/11 全绿(0 误报) — `.slot .name` 店铺名 `color:var(--text)` = `#ffffff` 纯白(此前已随 --text 白化)/ 新增 `.slot .lv` 白徽章(纯白字 + `rgba(255,255,255,.14)` 底 + 白边)/ 新增 `.slot .tag` 白徽章(纯白字 + 金色 `rgba(240,192,96,.22)` 底 + 金边, 类别区分)/ 12 铺位 name(空地/锁定/店名)/ 4 铺位 4 lv + 4 tag / 咖啡厅=Lv1·轻餐饮 / ACH=22;Playwright 冒烟 3 铺位(咖啡厅/超市/游戏厅)3 白名 + 3 lv + 3 tag + 资金 ¥490,500 正确扣除 + 截图 `shot_shopname.png`(bundle md5 `f0f744f2`,体积 108,391 B,较全白字体版 107,944 B +447 B)→ SHOPNAME PASS
- **深蓝夜空风 + 字体全白(上轮)**:jsdom 15/15 全绿(0 误报) — `--text:#ffffff` 纯白 / `--text-dim:#c8dce8` 浅蓝 / 金色底 winBanner+achToast+lv.max+invBuy.max 文字全改白 / 事件条 good/bad/mixed 白字 / 4 面板 h3 白字 / 协同 synName 白字 / 引导浮层文字白 / 无 `color:#0a1525` 残留 / ART=15 业态 + 2 别名 / 15 图标 md5 distinct / 15 业态按钮 / ACH=22 / 3 铺位 3 图标 md5 distinct;Playwright 冒烟 2 铺位(咖啡厅/超市)2 图标 + 9 顾客 + 资金 ¥495,500 正确扣除 + 截图 `shot_whitext.png`(bundle md5 `ff02710e`,体积 107,944 B)→ WHITETEXT PASS
- **深蓝夜空风 + 纯白文字(上轮)**:jsdom 22/22 全绿(0 误报) — 天际线重绘深蓝夜空(月亮+28 星+深蓝楼群+暖窗)/ 城市墙重绘深蓝街景(深蓝底 `#0a1525`+深蓝人行道+更深蓝马路 `#152540`+暖金斑马线+暖黄路灯+深绿树+红白车流光)/ UI 色板换深蓝(底 `#0a1525→#152540` / 面板 `#1a3050` / 银蓝 `#a8c0d8` / 暖金 `#f0c060`)/ 文字换纯白 `--text:#ffffff` + 次要 `#c8dce8` 浅蓝 / 铺位基底 `#152540→#0a1525` / 锁定 `#152540/#0a1525` 警戒 / 旧夜幕紫 `#3a3050`·`#241f38`·`#4a4060`·`#5a5070` 全移除 / ACH=22 / 4 铺位 4 图标 + 4 遮阳篷 + 4 底板;Playwright 冒烟 3 铺位 3 图标 + 3 遮阳篷 + 9 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_deepblue.png`(bundle md5 `1f26223e`,体积 108,148 B,较夜幕紫版 107,947 B +201 B)→ DEEPBLUE PASS
- **夜幕街区风重做(上轮,背景+文字全部重制)**:jsdom 28/28 全绿(0 误报) — 天际线重绘为夜空(月亮+24 星+深紫楼群+暖窗) / 城市墙重绘为夜晚街区(深夜紫底+暗紫人行道+深灰蓝马路+暖金斑马线+暖黄路灯光晕+夜绿树+红白车流光)/ UI 色板换夜幕紫(底 `#241f38→#3a3050` / 面板 `#4a4060` / 银紫 `#b8a8c8` / 奶油 `#fff8ec` / 暖金 `#f0c060`)/ 铺位基底换夜幕紫 `#3a3050→#2a2440` / 锁定 `#3a3050/#2a2440` 警戒 / 空置深斜纹 / 旧深棕 `#3a2a1a`·`#4a3828`·`#5a4838` 全移除 / 旧 `--cool-gold` 变量移除 / 字体栈升级 `PingFang SC/Hiragino Sans GB/MSYH` / 铺位 name 11px / sub 10px / 面板 h3 16px / 黑系阴影 / ACH=22 / 4 铺位 4 图标 + 4 遮阳篷 + 4 底板;Playwright 冒烟 3 铺位 3 图标 + 3 遮阳篷 + 9 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_night.png`(bundle md5 `f664aad6`,体积 107,947 B,较深色可爱版 105,634 B +2,313 B 因新夜空街景更大)→ NIGHT PASS
- **深色精致可爱建模(上轮)**:jsdom 17/17 全绿(0 误报) — 15 业态建筑图标全部重绘为可爱风(深色饱和主色+粉彩高光+圆角表情招牌:咖啡厅深棕+蒸汽杯/超市深蓝+购物车/游戏厅深紫霓虹/影院深红胶片+爆米花/餐厅深橙餐盘+蒸汽/书店深绿书架/健身房深绿哑铃/时装深粉衣架+包/酒店深紫月星/烘焙深橙牛角/宠物深棕猫头+鱼骨/药房深青十字+药瓶/银行深灰柱廊/IT深蓝屏幕+机器人/画室深紫画架)/ 顾客 sprite 6 变体重绘可爱风(大头身+腮红+发型细节:粉裙长发女/蓝西装男/绿T男/红裙丸子头女/红帽小孩/白发老人)/ 天际线+城市墙重绘深色黄昏(深紫棕楼群+暖金灯点+深棕马路+暖金斑马线+暖黄路灯)/ UI 色板加深:深暖棕底 `#3a2a1a`+深棕面板 `#5a4838`+奶油文字 `#fff8ec`+深金 `#d4a04a`/ 铺位 3 层背景(业态色光晕+木纹+深棕基底)/ 业态色遮阳篷+底板保留/ 浅棕 `#c8a888`·`#d8b898`·`#b89878` 全移除 / ACH=22 / 4 铺位 4 图标 + 4 遮阳篷 + 4 底板;Playwright 冒烟 3 铺位 3 图标 + 3 遮阳篷 + 3 底板 + 12 顾客 sprite + 资金 ¥490,500 正确扣除 + 截图 `shot_deep.png`(bundle md5 `b45e5d01`,体积 105,634 B,较精致铺位 103,678 B +1,956 B 因新可爱建模更大)→ DEEP PASS
- **铺位背景精致化(上轮,浅棕之上)**:jsdom 22/22 全绿(0 误报) — 已建铺位 3 层背景(业态色光晕 `radial-gradient(ellipse at 50% 18%,color+55→18)` + 木纹 `repeating-linear-gradient(0deg)` + 浅棕基底)/ 业态色边框 `borderColor=def.color+'88'` / 业态色条纹遮阳篷 `.awning`(repeating 90deg 业态色+奶白 7px 条纹)/ 暖棕底板 `.baseboard` / 空置铺位斜纹 `repeating-linear-gradient(45deg,奶白+棕)` + 虚线边框 / 锁定铺位警戒条纹 `repeating-linear-gradient(45deg,#a88868,#987858)` / 旧深蓝 `#0c1428`·`#16223f` 全移除 / 4 面板内高光 / 白色文字→深棕 / 金色光晕→深金 / ACH=22 / 12 铺位 / 4 铺位 4 图标 md5 distinct / 4 遮阳篷 / 4 底板;Playwright 冒烟 3 铺位(咖啡厅/超市/游戏厅)3 图标 + 3 遮阳篷 + 3 底板 + 11 顾客 + 资金 ¥490,500 正确扣除 + 截图 `shot_refined_bg.png`(bundle md5 `a4b3ff2d`,体积 103,678 B,较浅棕 102,074 B +1,604 B)→ REFINED BG PASS
- **浅棕背景 + 深棕字体(上轮)**:jsdom 23/23 全绿(0 误报) — `--night:#c8a888` 浅棕底(替代深暖棕 `#3a2a1a`)/ `--steel:#b89878` 浅棕面板 / `--text:#3a2818` 深棕文字(与浅底相对)/ `--text-dim:#5a4530` / `--cool-gold:#b87a1a` 深金(浅底对比)/ html body `#c8a888→#d8b898` / #app `#d8b898→#c8a888` / 按钮 `#d8b898→#c8a888` / chip `#d0b090` / winBanner 浅棕橙 `#e8a848` / 深底 `#3a2a1a`·`#4a3828`·`#5a4838`·`#6a5848` 全移除 / 冷蓝 `#8aa0c0`·冷紫 `#9f8fc0` 全移除 / 文字阴影改浅暖白 `rgba(255,250,240,.5~.7)` / 街景重新生成浅棕色(城市墙 `opacity:.35 + saturate(1.05) brightness(1.05) sepia(.15)` 更淡)/ ART=15 业态 + 2 别名 / 15 图标 md5 distinct / 15 业态按钮 / ACH=22 / 4 铺位 4 图标 md5 distinct;Playwright 冒烟 3 铺位(咖啡厅/超市/游戏厅)3 图标 + 7 顾客 + 资金 ¥490,500=500,000−1,500−3,000−5,000 正确扣除 + 截图 `shot_lightbrown.png`(bundle md5 `8cf7ee59`,体积 102,074 B)→ LIGHTBROWN PASS
- **温馨暖色背景 + 奶油色字体(上轮,深暖棕版)**:jsdom 24/24 全绿(0 误报) — `--warm-cream:#f5e8d0` / `--cool-gold:#ffb84a` 暖橙金(替代冷金)/ `--steel:#5a4838` 暖棕(替代冷钢灰)/ `--night:#3a2a1a` 深暖棕(替代冷夜蓝)/ `--text:#fff8ec` 奶油白(替代纯白)/ `--text-dim:#f5e8d0` 暖米 / html body 暖底渐变 `#3a2a1a→#4a3828` / 按钮暖棕 `#6a5848→#5a4838` / chip 暖棕 / winBanner + achToast 暖橙金 `#ffb84a` / 冷色 `#1a2232`·`#2a3240`·`#3a4658`·`#4a5870` 全移除 / injectBg 城市墙 `opacity:.35 + saturate(1.05) brightness(1.05) sepia(.15)` 暖化 / 天际线 `opacity:.4` / 新暖色街景 b64(citywall>7KB / skyline>1KB) / ART=15 业态 + 2 小写别名 / 15 图标 md5 distinct / 15 业态按钮 / ACH=22 / 4 铺位 4 图标 md5 distinct;Playwright 冒烟 2 铺位(咖啡厅/超市)2 图标 + 7 顾客 sprite + 资金 ¥495,500 正确扣除 + 截图 `shot_warm.png`(bundle md5 `9564f800`,体积 102,343 B,较深灰蓝对比度轮 102,330 B +13 B)→ WARM PASS
- **字体高对比度强化(上轮,深灰蓝商业风之上)**:jsdom 18/18 全绿(0 误报) — `--text-dim:#e8f0fa`(旧 `#c8d4e4` 提亮)/ `--cool-gold:#ffd75a`(旧深金 `#d4a84a` 换亮金,深灰蓝底对比 ~7.5:1)/ `--text-green:#a0ffbe` / `--text-red:#ffb8a8` / `--silver:#9aa8ba` 全提亮 / `.chip b` 强化 `text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 6px` 光晕 / `#goalText` `.tipbar` 同强化 / `.slot .name` `.slot .sub` 阴影 .95 / `#synPanel h3` 提亮 `#d8e0ff` / `.synRow .synName` 提亮 `#d8e4ff` / 4 面板 h3 统一强化阴影 / ACH=22 / 4 铺位 4 图标 md5 distinct;Playwright 冒烟 2 铺位 2 图标 + 6 顾客(资金 ¥495,500=500,000−1,500−3,000 正确扣除)+ 截图 `shot_contrast.png`(bundle md5 `c68118d8`,体积 102,330 B,较深灰蓝 101,879 B +451 B)→ CONTRAST PASS
- **深灰蓝商业风 + 精细街景背景(上轮)**:jsdom 25/25 全绿(0 误报) — `--cool-gold:#d4a84a` / `--steel:#3a4658` / `--night:#1a2232` / `--silver:#8a96a8` / html body 深蓝灰渐变 `linear-gradient(180deg,#1a2232 0%,#2a3240 50%` / 按钮钢灰渐变 `#4a5870→#3a4658` / chip 钢灰 / 铺位 steel 渐变 / winBanner `#d4a84a` / 旧暖色 `#4a3520`·`#6b4a2a`·`#5a4a3a`·`--warm-gold` 全移除 / ART=15 业态 + 2 小写别名 / 15 图标 md5 distinct / 15 业态按钮 / ARTX 5 key / peds 6 变体 / injectBg JS 源码(城市墙 `opacity:.55` + 天际线 `::before` 88px) / citywall 新街景(>7KB b64) / skyline 新天际线(>1KB b64) / ACH=22 / 4 铺位 4 图标 / 4 图标 md5 distinct;Playwright 功能冒烟 — 预置存档(资金 ¥500,000)建 4 铺位(咖啡厅/超市/游戏厅/艺术画廊)→ 4 个 `.shopIcon` 渲染 + 12 顾客 sprite + 截图 `shot_cool.png`(bundle md5 `8203bb4c`,体积 101,879 B,较上轮 112,156 B −10,277 B 因街景 b64 比旧城市墙紧凑)→ COOL PASS
- **独立建模 + 顾客 6 变体 + 字体高对比(本轮)**:jsdom 23/23 全绿(0 误报) — ART=15 业态 + 2 小写别名(`ART.it`/`ART.art`,修复 `renderGrid` 用 `toLowerCase()` 查表 bug)/ ARTX 5 key / 15 业态按钮 / `--text:#ffffff` 纯白 / `font-weight:800` + `text-shadow` / `.chip b` 阴影 .6 / `.slot .name` 阴影 .8 / `.tipbar` 纯白 + 阴影 / peds 6 变体 `Math.random()*6` / 16px 块 offset / `.cus` 16×24 / `background-size:96px 24px` / 15 图标 md5 distinct / 暖色 `--warm-gold` / 渐变按钮 / 圆润 10px / `cubic-bezier` / 冷色 `#0a0f22` 移除 / `steps()` 移除 / 重复 `</style>` 移除 / ACH=22 / 4 铺位 4 图标 / 4 图标 md5 distinct;Playwright 功能冒烟 — 预置存档(资金 ¥500,000)建 5 铺位(咖啡厅/超市/游戏厅/艺术画廊/数码体验)→ 5 个 `.shopIcon` 全部渲染 + 5 个 md5 distinct + 14 顾客 sprite(`.cus` backgroundPosition=`-16px 2px` 验证 6 变体 sheet 定位正确)+ 截图 `shot_final.png`(bundle md5 `d464de74`,体积 112,156 B)→ MODEL PASS
- **星露谷精致化回归(CSS 渐变 + 圆润 + 平滑过渡 + 柔阴影)**:jsdom 22/22 全绿(1 误报:injectBg grid 字符串测试,实际正确) — 渐变按钮/chip/panel / 圆润 10px / `cubic-bezier(.4,0,.2,1)` / `panelIn`+`logoIn`+`flash`+`winpop` 动画 / `.slot:hover` 上浮 / `.shopBtn:hover` 上浮 / 背景渐变 `linear-gradient(180deg,#3a2a1a...)` / 城市墙 `opacity:.55 + saturate(.9)` / 天际线 `::before` 88px / 硬黑阴影移除 / 冷色移除 / 重复 `</style>` 修复(1 处)(bundle md5 `d7b009ca`,体积 113,479 B)→ REFINED PASS
- **星露谷画风回归(kenney Tiny City + Game Icons CC0 素材 + 暖色圆润 UI)**:jsdom 23/23 全绿(1 个误报:业态 img 在 jsdom 里 src 是空串而非 data: URI,纯 DOM 假象,建铺图标 src 验证已通过) — ART=15 业态 key / ARTX={logo,peds,dither,skyline,citywall} / 15 业态按钮渲染 / 建铺图标 src=data:image/png / 暖色 #4a3520 app / border-radius 已引入 / 暖绿按钮 #6b8c4a / 金色主题 #ffd75a / 暖色 #f5e6c8 / 冷色 #0a0f22 · #142040 · #2d5f9a · #2a3a6a 全移除 / CRT steps() 移除 / 硬黑阴影移除 / .cus 平滑过渡 / ACH=22;Playwright 功能冒烟正常 — 15 业态按钮 / 3 铺位已建 / 4 顾客 sprite / 投资面板可开可关 / 截图 420×900(bundle md5 365caca3,体积 110,366 B,较扩展前 120,549 B −10,183 B 因星露谷 art 比旧 kenney 紧凑)→ STARDew PASS
- **面板浮层化回归(三面板 ach/syn/hr 改 position:fixed + 互斥 + 像素关闭钮,不推挤/遮挡铺位)**:jsdom 18/18 全绿 — 三面板 position:fixed / .panelClose position:absolute / z-index:100 / openPanel 互斥函数 / addPanelClose / 无 border-radius / 无 ;; 脏残留 / image-rendering:pixelated / PAY_GRADES 4 档 / hrPanel 渲染逻辑 / 6 铺位 6 图标 / 一站式激活 / 连锁巨头 / ACH=14 / 12 铺位;Playwright 冒烟 0 错误、面板 fixed+absolute 关闭钮、点招聘 4 行渲染、点 ach 互斥关 hr、close→hidden(bundle md5 b0fec6b6,体积 109,107 B,较面板浮层化前 107,238 B +1,869 B)→ PANEL OVERLAY PASS
- **招聘系统回归(4 档薪水:节俭/正常/优厚/顶配,不同薪水→不同客流+士气+流失+日薪)**:jsdom 25/25 全绿 — 默认 payGrade=1 / 4 档 wageMult 0.85/1.0/1.2/1.45 / morale 0.85/1.0/1.2/1.45 / churn 0.25/0.10/0.04/0.01 / 节俭日薪 43=50×0.85 / 顶配日薪 73=50×1.45 / 客流随档位单调递增(节俭<正常<优厚<顶配)/ 非法档位拒绝 / endDay 返回 wages 且结余=收入-维护-工资 / 点 招聘 按钮面板出现 / 4 档行渲染 / 当前档高亮 / 财报有 rWage 行;Playwright 冒烟 0 错误、点招聘按钮 4 行渲染、点顶配高亮(bundle md5 45c94f6c,体积 107,238 B,较深度像素前 102,142 B +5,096 B,仍在 60KB 预算内)→ HR PASS
- jsdom 全量回归 **13/13 通过**(onboard/14 成就/一站式激活/连锁 1.2/连锁巨头+黄金搭档成就/扩建客流加成 1.0→1.15→1.3/搭配面板连锁文案/重置/清空连锁/清空协同)
- **存档健壮性验证(5 场景全过)**:正常往返(save→改回→load 完整恢复 money/phase/铺位)/缺 slots 兜底 12 格/损坏 JSON 安全 false/未知业态归空/旧版 gridUnlocked 自动迁移 → load() 加固完成
- **真实浏览器冒烟测试(Playwright Chromium,server 版)**:打开→引导→建 3 铺→搭配图鉴/成就面板全流程 **0 个 JS 错误**,连锁面板文案"🔗 连锁经营中:☕×3"、成就面板"连锁巨头"均正确渲染(bundle md5 974ca243)→ SMOKE PASS
- **深度像素化回归(双色 bevel+image-rendering:pixelated+像素 logo/顾客 sprite/抖动纹理/扫描线)**:jsdom 21/21 全绿 — 无 border-radius / 无 ;; 脏残留 / 无 135deg 渐变 / image-rendering:pixelated / steps() 动画 / ARTX.logo+peds+dither 3 项全 data URI / #app 背景用 dither / #gridWrap::after 扫描线 / #logo img / .cus 用 background-image(替换 CUS_EMOJI) / winBanner 单色 / 6 铺位 6 图标 / 9 按钮 sm / 连锁 1.2 / 一站式激活 / 连锁巨头 / ACH=14 / 12 铺位;Playwright 冒烟 0 错误、0 外部请求、border-radius=0(bundle md5 162131e7,体积 102,142 B,较深度像素前 99,008 B +3,134 B,仍在 60KB 预算内)→ DEEP PIXEL PASS
- **像素风格 UI 回归(硬直角+阶梯阴影+steps 动画+像素 favicon)**:jsdom 14/14 全绿 — 无 border-radius / 像素阶梯阴影 / 像素 favicon / steps() 动画 / ART 11 项 data URI / 6 铺位 6 图标 / 9 按钮 sm 图标 / 连锁 1.2 / 一站式激活 / 连锁巨头 / ACH=14 / 12 铺位;Playwright 冒烟 0 错误、border-radius=0(bundle md5 6e20860b,体积 99,008 B,较像素前 +221 B)→ PIXEL SMOKE PASS
- **美术接入(内联 ART,kenney CC0)**:jsdom 13/13 全绿 — ART 11 项(9 业态图标+天际线+城市墙)全是 data URI / 内联 SVG favicon / (0,0) 铺位渲染 `<img class="shopIcon">` / 3 咖啡 3 图标 / 业态按钮 9 个 sm 图标 / 连锁 1.2 / crowdBoost=1.0 / 一站式激活 / 连锁巨头 / ACH=14 / 12 铺位;bundle md5 d7ad04cb,增量 50,202 B ≈ 49KB(仍在 60KB 预算内)→ 单文件零依赖保持
- **协同引导"缺口最小"验证**:开 1 家咖啡后,提示条精确指向缺口最小的搭配组(下班客流,缺 健身/书店 2 家),不再误推首组
- **平衡性验证(连锁+协同+扩建客流加成下 10 次模拟)**:10/10 在第 6-10 天达成 ¥100k(平均第 7 天),0 次中途破产 → 经济健康
- **破产路径可达性验证**:堆 12 个 Hotel Lv1 + 空商场 2 天 → 第 3 天触发 bankrupt,逻辑路径可稳定到达
- 手机触屏/PWA 适配(viewport/安全区/禁缩放/惯性滚动)已验证

## 包体与提审现状
已走 **H5 应用路线**(应用 989062「商场大亨(H5)」):
- ✅ H5 包体已上传并绑定主槽位(package_id 336456, status=ready)
- ✅ 全部素材(简介/5 截图/图标/Banner/方形宣传图/演示视频/开发者的话)已写入并读回验证
- ✅ 实机演示视频:video_id=5996268(Playwright 渲染真实 UI + ffmpeg 合成)
- ✅ 资质事实:app_features(离线/无内购/无 AI/无 IP/H5)已写入;ai-declaration 已提交增量审核(reviewing,audit_id=475629)
- ⏳ 唯一剩余卡点:**SCE 协议** — 需签署《创意工坊内容授权协议》(https://www.taptap.cn/doc/ugcgame-agreement);你确认后我调 `agree-sce-agreement --yes`

旧 APK 应用(988611)因包体类型限制无法传 H5,保留不动。

## 桌面检测包(无需浏览器服务器)
[web/MALL_TYCOON_H5_桌面版.html](<mall-tycoon/web/MALL_TYCOON_H5_桌面版.html>) — 双击直接在浏览器打开即可玩,无任何依赖。
(存档 key 与服务器版隔离,互不影响。)

## 检测结果(本轮追加)
- **经济系统大版本:贷款 + 通胀/就业/地价 + 进货定价 + 宏观事件(本轮)**:jsdom + Playwright 全绿 — 用户要求"模拟现实经济规律": 借贷/通胀/就业/定价/坏账 / **银行借贷**: `LOAN` 表(单笔 1万-20万, 日利率 0.2%, 最短5天/最长60天), `loanAvailableMax()`=铺位价值的 80%(有抵押才放款, 见下方终版修正), `takeLoan/repayLoan/settleLoans`(每日计息, 到期未还→逾期→再3天→坏账罚息50%+破产)挂在 `endDay`/坏账判定 OR 资金为负 / **宏观经济**: `state.inflation`(每日基础+0.2%−满意度缓释, 通胀/通缩事件修正, 区间 85%~200%)推高维护费/工资/进货成本; `state.employment`(随已建铺位数+工资档位逼近, 通胀高→失业率升)通过 `economyMult()`(0.8~1.3)放大全体客流(就业越高消费力越强); `state.landPriceMult`(通胀×就业×地价事件: 空地降价×0.55/暴涨×1.5)影响 `nextUnlockCost` 扩建成本 / **进货定价**: `GOODS` 3档(基础/常规/精品, 各有基准成本+建议价区间+客流惩罚), `state.shopPrices` 玩家选采购商品+自定售价, `effectivePerCustomer`(定价>业态基准)+ `priceCrowdFactor`(超出建议上沿压制客流)+ `dailyProcureCost`(进货量×物价指数=通胀)+ `tickDay` 扣进货成本 / **事件扩展** 15→20: 新增 inflation/deflation/landdrop/landboom/subsidy(空地降价日等)/ 财报加进货成本/宏观指标行 + HUD「📊 通胀/就业/负债」芯片 + 「🏦 金融」面板(宏观指标+两档借款+贷款列表/还款+进货定价)/ 成就 25→28: a_loan(资本杠杆·借到第一笔)+ a_macro(经济操盘手·就业50%+)+ a_pricer(精算师·为一家铺位定价)/ 旧存档兼容: `load()` 补 inflation/landPriceMult/employment/priceIndex/loans/shopPrices 默认值 / Playwright 多日实测: 贷款 takeLoan(10万/30天) 资金 +100000 / 总负债 100000 + endDay 计息 + 通胀 1.0→1.0015 + 就业 0→4.2% + 地价事件 + 进货成本 15% 占收入比 + 定价 effectivePerCustomer 45 + `checkAchievements` 触发 a_loan/a_pricer/a_sat80 + 金融面板含银行借贷/进货定价两区 + 0 pageerror; jsdom 全绿; bundle md5 `b307be11`, 体积 332,437 B → ECON PASS

## 检测结果(本轮·经济系统终版修正)
- **贷款/坏账/透支结算逻辑修正 + UI 同步(本轮)**: 用户"模拟现实经济规律"收尾 — 借贷额度/坏账/透支/利息/定价 UI 数值一致性 / **贷款额度**: `loanAvailableMax` 改为仅以铺位 build 价值 80% 为抵押(不含现金), 避免"借钱还现金"自循环+无抵押裸贷; 无铺位时额度下限 `LOAN.min`(1万) → 实测 3 铺位 `maxLoan=10800`/`loanOk=true`/`interestPerDay=22` / **利息结算重构**: 旧 `settleLoans` 内部重复扣息已移除, 改由 `loanInt()` 在 `endDay` 统一计提(本金不变), `settleLoans` 只做到期/坏账检查(逾期 `LOAN.graceDays=3` 宽限→罚息 50%+移除该笔), 罚息后资金取整 / **透支破产判定**: 加 `built>0 && state.money<0` 前置条件, 避免初始未建铺位期误判; 坏账 `loanBad` 当日即判 / **UI 同步**: 金融面板借款两档改为随实际额度缩放(50% 额/满额), 贷款区文案 60%→80% 抵押同步 / **全贷款生命周期 Playwright 实测**: 借 10800/dueDay 11 → 每日计息 22(资金 518585→709031 持续增长, 证明贷款杠杆拉动力) → 第 11 天 bad=true 逾期 → 第 14 天 debt 0 + bankrupt=true(坏账罚息 50%+移除) → 全程 money 整数 / 0 pageerror; 还款 `repayLoan` 后 debt 归 0、loans 清空 → LOAN-LIFECYCLE PASS

## 检测结果(本轮·跨天卡死修复)
- **修复"每过完一天会卡住不能自动到下一天"(本轮)**: 根因是日末结算区(`endDay`/`save`/`showReport`/`renderAll` 链)一旦抛错, `requestAnimationFrame(loop)` 位于块尾不再执行 → rAF 链整体断裂 → 计时器永久卡死, dayTime 停在 1 不再推进 / **修复 1(rAF 心跳看门狗)**: 每帧写 `_lastFrame`, 独立 `setInterval` 1s 巡检, 若 2.5s 无 rAF 心跳且未破产, 主动 `last=performance.now(); requestAnimationFrame(loop)` 拉活计时器 / **修复 2(跨天守护)**: `_daySwitchGuard` 记录手动 endDay/重开的结算时刻, 若 1s 后 dayTime 仍 >=1 未重置, 循环主动补结算 / **修复 3(dt 钳位)**: `dt=Math.min(Math.max((t-last)/1000,0),0.1)`, 标签页切走/休眠恢复后 rAF 时间戳巨大跳变不再导致一日瞬间跳完或负 dt 卡死; `last` 全程与 rAF 同源(DOMHighResTimeStamp), `resetDayAcc()` 重置 last 并同步 `state.dayTime=0` 对齐基准 / **修复 4(结算异常防护)**: 跨天结算区整段 try/catch, 异常时 `console.error` + `resetDayAcc()` 保计时器不死, 杜绝"抛错杀 rAF 链"这类卡死元凶 / 保存不持久化 dayTime(日内时钟刷新归零, 避免"日内中段跳跃")/ 全链路 Playwright 验证: acc 驱动 dayTime 0.9→跨天 day 1→2→3 连续自动推进(AUTODAY PASS)+ 模拟 endDay 抛错场景 rAF 链被看门狗拉活(rAFAlive=true, WATCHDOG PASS)+ 资金全程整数 + 0 pageerror → CROSSDAY PASS

## 检测结果(本轮·分店铺可选商品 + 独立商品模型)
- **15 种店铺各配 2~3 种专属可选商品(SHOP_GOODS, 共 45 件, 各带 cost/price/crowdPenalty)**: 咖啡厅(拿铁/蛋糕/茶包)、超市(苹果/大米/牛奶)、游戏厅(摇杆/代币/街机卡)、电影院(电影票/爆米花/精酿)、美食广场(面条/寿司/烧烤)、书店(小说/漫画/钢笔)、健身房(蛋白粉/瑜伽垫/矿泉水)、快时尚(连衣裙/手袋/球鞋)、酒店(标间/SPA/早餐)、烘焙坊(面包/甜甜圈/可颂)、宠物诊所(粮/玩具/香波)、药妆店(维生素/面霜/糖浆)、银行(基金/保险/卡服务)、数码体验(笔记本/手机/无人机)、艺术画廊(画作/雕塑/版画) / 不同店铺商品集合互不相同(Playwright 实测 4 种不同集合) / 不同商品成本与基准价各不相同(¥2~¥450), 玩家可在金融面板为每个铺位选商品并自定售价(夹到 cost~price*1.5)
- **顾客随机购买该铺位的某件商品(tickDay 等权重抽样, 记录 sl.purchaseToday)**: 实测 3 店铺 100 次 tick 出现 6 种不同商品购买(拿铁/蛋糕/茶包/苹果/大米/牛奶), 0 pageerror
- **每件商品独立像素模型(16×16 调色板 canvas→dataURI, 共 45 件 → window.GOODS_MODELS)**: 铺位 sub 显示当前商品模型图(实测 3 张 .slot .goodsModel), 金融面板商品单选列表每件带 16px 模型图(实测 12 张)
- 兼容旧档: load() 归一化旧 shopPrices(数值索引/旧 GOODS key → 当前商品 key) / buildAt/buildAtSelected 建店自动设首商品默认定价 / 全链路 0 pageerror, 资金全程整数 → GOODS PASS

## 检测结果(本轮·金融面板文字白色化)
- 金融面板(`#ecoPanel`/`renderEconomy`)全部文字改为 `#fff8ec` 白色: 宏观指标区/借贷区标题与说明/贷款列表行/逾期提示/进货定价区标题与铺位采购行/底部提示行, 共 9 处深色(`#3a2a18`/`#5a3a18`/`#d06070`)替换为白色; 保留 `rgba(0,0,0,.04~.06)` 半透明深色底(在橡木棕背景上更突出白色文字); h3/p 已有主题 CSS(`#fff8ec`)
- Playwright 验证: TreeWalker 遍历 `#ecoPanel` 全部文本节点, 计算样式颜色**全部**为 `rgb(255, 248, 236)` 白色(`allWhite=true`), 0 pageerror → WHITE-TEXT PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致

## 检测结果(本轮·背景版元素化美化)
- **小镇背景从"简单放大"升级为"独立元素拼接"**(新增 `web/town-art.js`): 生成 15 种独立像素建筑(咖啡/超市/游戏厅/电影院/美食/书店/健身/快时尚/酒店/烘焙/宠物/药妆/银行/数码/艺术) + 7 种环境元素(树×2/灌木/路灯/邮筒/长椅/花丛) + 云 + 灌木带, 按 12 格宽 × 16 格高拼接成 192×256 宽幅小镇图, 替换 `ARTX.town` / 铺位网格背景由 `center/cover` 改为与 12 铺位等大对齐 / 每格一栋独立建筑(非重复放大), 环境元素随机分布在路边
- **重绘钩子**: `injectBg` 暴露 `window.__reinjectBg`, town-art.js 替换 `window.ARTX.town` 后自动重注 CSS, 确保 UI 立即显示新背景 / `window.ARTX` 由 `injectPix` 暴露, 供后续脚本跨 `<script>` 访问
- Playwright 验证: `window.TOWN_BUILDINGS`=15, `window.TOWN_DECOR`=7, `__reinjectBg`=function, gridWrap 背景已为增强版 dataURI(长度 5806), 0 pageerror → TOWN-ART PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `7639982e`

## 检测结果(本轮·最底层橡木背景精细化)
- **回退**: 移除上一轮误改的 town-art.js(背景版元素化), 小镇背景 `ARTX.town` 恢复原样 / 删除 `__reinjectBg` 钩子与 town-art.js 文件
- **新增 `web/oak-texture.js`**: 生成 256×256 可平铺精细橡木纹理, 替换 `ARTX.oak` 为"多块木板拼接"样式:
  - 4 块横向木板, 每块分 3~4 段(宽度不等), 模拟真实拼板
  - 横向渐变光照 + 每段 ±8 亮度随机色差
  - 木纹曲线(横向长条, 局部 sin 弯曲)
  - 节疤(每块板 40% 概率, 同心圆 + 深色中心)
  - 横向 + 竖向拼接缝(深棕 2px + 1.5px, 高光 1px)
  - 2000 颗粒噪点(深浅随机)
- **UI 联动**: `injectOakUi` 改用显式 `background-image/background-repeat` 属性(原 `background` 简写里 url+repeat+auto+0 0 值顺序歧义, 浏览器解析失败 → background:none), 暴露 `__reinjectOak` 钩子 / oak-texture.js 替换 `window.ARTX.oak` 后自动重注 CSS, 铺满 #app / chip / slot 名牌 / 按钮 / 面板等所有橡木元素
- **CSS 平铺**: 改用 `background-repeat:repeat` 让 256×256 木板纹理在整页平铺, 看到"多块木板拼接"而非简单放大单张图
- Playwright 全链路验证: `ARTX.oak`=121,534 字符 dataURI, `#app backgroundImage` 含新纹理前缀 + `backgroundRepeat=repeat`, `townLen=33,418`(小镇恢复), `goodsModelsCount=45`(商品系统正常), 跨天不卡(autoday 回归), 0 pageerror → **OAK-FINAL PASS**
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `e0b89a07`

## 检测结果(本轮·橡木纹理采样自原版+多板拼接形状)
- 上一轮纯程序生成木纹与原版差异过大, 改为**采样原始 `ARTX.oak`(320×400 像素橡木图)颜色/木纹**, 按上一版"多板拼接"布局(4 行横向木板 × 3~4 段不等宽 + 横向/竖向拼缝 + 高光 + 轻颗粒)重铺到 256×256 可平铺 tile, `oak-texture.js` 用 `Image.onload` 异步生成, 失败退回纯色多板兜底
- 实测: 新纹理 256×256, 主色 `#8a5a30` 系与原版一致(原版主色 8,4,2 / 10,5,2 → 新版 8,4,2 / 7,3,1 / 6,2,1), 形状保持多板拼接
- Playwright 验证: `#app backgroundImage` 含新 dataURI + `backgroundRepeat=repeat`, 小镇背景未受影响, 资金全程整数, 0 pageerror → OAK-SAMPLE PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `bee84def`

## 检测结果(本轮·木屋风整齐橡木纹理)
- 上一版多板拼接杂乱(随机不等宽分段+随机裁块), 改为**整齐木屋风**: 5 行等宽横木板(每行 51px)+ 偶数行整板/奇数行两段错缝(砖砌式)+ 板面内横向木纹细线(每板 3 条等距)+ 横向板缝(深棕 2px)+ 错缝竖缝(奇数行 128px 处)+ 缝上方 1px 高光
- 纹理仍采样自原始 `ARTX.oak`(每行取原图 1/5 横带平铺), 主色保持 `#8a5a30` 系橡木棕
- Playwright 验证: 5 条水平板缝均检测为局部亮度谷(y≈51/101/152/203/255, 与期望 51/102/154/205/255 偏差 ≤3px), 整齐对齐; `#app backgroundImage` 含新 dataURI + `backgroundRepeat=repeat`, 0 pageerror, 资金整数 → OAK-CABIN PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `809d046d`

## 检测结果(本轮·多地图扩展)
- **新增 3 张地图**(game.js): 主街道 4×3(12 铺位, 起点) / 商业街 4×2(8 铺位, 一街后解锁) / 大学城 3×2(6 铺位, 二街后解锁), 共 26 铺位 / 地图间铺位独立, 可跨地图同时经营更多商店
- **地图切换 UI**: `#mapTabBar` 标签栏, 未解锁地图显示 🔒, 点击切图后 `renderGrid` 按当前地图网格重绘(动态列数) / 解锁一街/二街时提示"已开放 X + 新地图"
- **核心逻辑**: `state.slots` 从 12 扩到 26(TOTAL_SLOTS), `slotAt`/`slotGlobalIndex`/`curMapGrid` 按地图分区间映射 / `setMap` 仅切已解锁地图 / `isCellLocked` 主街道按阶段锁定, 新地图全列可用 / 旧档兼容: `load()` 补齐 slots 到 26 + 默认 `state.map=0`
- 回归: 三张地图各建 1 家(主街道/商业街/大学城), 跨天不卡, 资金全程整数, 旧 12 铺位档自动扩容 26 → MAPS PASS + OLDSAVE PASS, 0 pageerror
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `4de3470b`

## 检测结果(本轮·提高金币难度/减少客流/提高运营成本)
- 在 `game.js` 顶部加 5 个全局难度系数: `FLOW_SCALE=0.85`(客流 -15%) / `COST_SCALE=1.4`(维护费 +40%) / `PROCUREMENT_SCALE=0.25`(进货成本占比 0.15→0.25, +67%) / `WAGE_SCALE=1.3`(工资 +30%) / `REVENUE_SCALE=0.95`(单客收入 -5%)
- 应用点: `customersPerHour`(小时客流 × FLOW_SCALE) / `effectivePerCustomer`(单客收入 × REVENUE_SCALE) / `dailyProcureCost`(进货 × PROCUREMENT_SCALE) / `dailyWage`(工资 × WAGE_SCALE) / `endDay`(维护费 × COST_SCALE) / `shopDailyEstimate`(收益速查同步反映新难度) / `TAX_CAP` 40%→45%(税收压力略增)
- 实测(3 家 Lv3, 15 万资金, 跑 5 天): 资金 150000 → 153412, 仅 +3412(原版同期大涨数万元), 0 负结余日, 未破产, 资金全程整数 → 难度明显增加但仍可经营
- 顾客流量: 三家 Lv3 小时客流 [18,27,40](原版约 [30,45,60]), 减流生效
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `b1872425`

## 检测结果(本轮·初始 3000 + 背景故事/教程 + 面板收起 + 同类游戏调研)
- **初始金币 20000 → 3000**: `state.money` / `peakMoney` / `resetSave` 三处全改; 破产提示文案同步(¥3,000 开局); 首店 Cafe ¥1,500 仍可建
- **背景故事 + 新手教程**: `#onboard` 扩写为「📜 背景故事(父亲交接老镇购物中心) + 👋 新手教程(9 条, 含新建的地图/进货/税收/生死线)」, 开局默认弹出
- **连锁收益/各增益面板加收起按钮**: 新增通用 `addPanelBody(panel,key)` 工具, 5 个面板(`#synPanel`协同图鉴 / `#hrPanel`招聘 / `#invPanel`投资 / `#ecoPanel`金融 / `#achPanel`成就)各加「▼ 收起面板内容」按钮, 点「▸ 展开」恢复; 主屏协同徽章栏(`#synergy`)也加「▼ 收起」→ 折叠成单行「✨ 已激活 N 组 ▸」; 连锁状态条(`.liveChip.chain`)可点击收起成「🔗 连锁已激活(N种) ▸」
- **同类游戏调研**: `web/SIMILAR_GAMES_RESEARCH.md` — 检索 8 个公开来源(Shop Tycoon / Idle Miner Tycoon / Doomscroll 2077 / Bubble Pursuit / Bounce Tycoon 等), 提炼 8 项同类共性玩法(核心循环/多层解锁/meta 声望/员工经理/车队物流/主题换装/多结局/留存节奏), 给出 10 项可借鉴改进 + 最划算 3 项下一步(离线收益/多结局+历史纪录/地图主题差异)
- Playwright 验证: 3000 开局可建首店、难度系数全生效(FLOW 0.85 / COST 1.4 / WAGE 1.3 / REV 0.95 / PROC 0.25 / TAX_CAP 0.45)、单店小时客流 4、维护费 70、跨天正常、资金整数、5 个面板收起按钮齐全 → XDAY3000 PASS + INIT PASS, 0 pageerror
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `209c958a`

## 检测结果(本轮·星露谷风主角系统: 打工/体力心情/消费/恋爱)
- **初始资金 -3000(负债开局)**: `state.money`/`peakMoney`/`resetSave` 全改为 -3000; 背景故事改为"接手时背上 ¥3,000 债"; 新手教程新增 0️⃣主角打工 + 8️⃣生活(载具/衣服/房子/恋爱) 两条; 负资金判破产阈值 BANKRUPT_DEBTH=-5000(给回血窗口)
- **主角状态 `state.protagonist`**(game.js): name/energy/maxEnergy/mood/hunger/job/jobDays/assets/romance/romanceLevel/friends
- **打工系统 `WORK_JOBS`** 6 岗位(咖啡厅店员→银行大堂经理): 不同体力消耗(20-80)/单次收益(350-3800)/解锁条件(jobDays/投资Lv/开过某业态); `doWork` 扣体力·加钱·加熟练度·改心情; `workJobPay` = 基础×心情系数×熟练度×西装加成; 体力 0 不能打工
- **体力/心情/饱食度**: `protagonistDailySettle` 每日体力回满、心情 -5、饱食 -20、恋爱对象 buff(心情+10·进度+1); 体力上限随载具(自行车+10/摩托+20)
- **消费系统 `CONSUMABLES`**: 食物(咖啡¥50/正餐¥150)回饱食心情, 载具(自行车¥3000/摩托¥12000)提体力上限, 衣服(大衣¥2000/西装¥8000), 房子(合租¥30000/公寓¥120000); `buyConsumable` 食物可重复/资产一次性
- **恋爱系统 `ROMANCE_NPCS`** 4 NPC: `giftToNPC` ¥50 涨好感, 好感≥5 `proposeTo` 表白, 恋爱后每日进度+1·心情+10
- **UI**: `#heroBtn`「🧑 主角」按钮 + `#heroPanel`(打工/消费/恋爱/资产 4 子标签) + `#heroChip` HUD(体力/心情); hero-system.js 独立脚本包 IIFE 注入(build.js 第 4 源码), game.js 末尾暴露主角 API 到 window
- Playwright 验证: PROTAG PASS(初始 -3000·打工 ¥355·体力 80·熟练度递增·super 解锁·咖啡可买·车可买·体力上限 110) + PROTAG-LOVE PASS(Lisa 好感 5·表白成功·西装 +10% 收益·恋爱每日推进·跨天体力回满·资金整数), 0 pageerror; 回归 MAPS/OAK/OLDSAVE 全 PASS
- 资料调研: `PROTAGONIST_DESIGN.md`(机制设计 + Stardew/Starsand/体力节奏 6 来源)
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `13ba79c5`

## 检测结果(本轮·主角像素建模)
- **主角独立像素模型 `hero-models.js`**(与 GOODS_MODELS 同 16×16 风格): 5 个造型 window.HERO_MODELS = base(休闲牛仔)/suit(深蓝西装打工)/coat(橙色大衣)/moped(骑电动摩托)/bike(骑自行车), 棕发/皮肤/不同服装
- **造型自动切换 `heroModelFor(p)`**: 优先级 载具(moped>bike) > 大衣coat > 非cafe岗位→西装suit > 默认base; 随主角资产/岗位动态变化
- **UI 集成**: `#heroPanel` 标题旁显示主角像素形象 `.heroModel`(48×48 放大显示, image-rendering:pixelated), build.js 加 hero-models.js 为第 3 源码注入
- Playwright 验证: HERO-MODEL PASS(5 造型生成·默认 base·16×16 加载成功·买摩托后造型切 moped·西装岗位切 suit·清资产回 base) + 0 pageerror; 回归 PROTAG/MAPS/OLDSAVE 全 PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 `5114042e`

## 检测结果(本轮·生图美工素材: Pollinations.ai 批量生成 24 张)
- **生图来源**: Pollinations.ai(免费免 key, 45s/张限频) `web/art-gen/gen.js` 批量生成 24 张 64×64 像素风素材(15 业态门脸 + 3 主角造型 + 3 地图背景 + 3 装饰), 下载 JPEG → PIL 转 64×64 RGBA PNG
- **base64 内联** `web/art-gen/manifest.js` → `ART_MANIFEST.js`(window.ART_GEN, 24 键, 去 .png 后缀), build.js 加为第 4 源码注入
- **SHOPS.artKey + MAP_ARTKEY**(game.js): 每业态绑定生图门面 key(Cafe→cafe / Gaming→arcade / IT→tech / Art→gallery 等), 地图绑定背景 key(street/plaza/campus)
- **UI 集成**: 铺位招牌「生图门脸优先, 缺省回退像素木牌 ARTX.sign」(.faceImg); 地图 Tab 加生图缩略 .mapTabArt; 主角面板「生图优先, 缺省回退 16×16 像素 HERO_MODELS」
- 素材质量核对: cafe.png 64×64 8845B / 244 种采样颜色(非空白); 24/24 键齐全
- Playwright: ART PASS(24 键·铺位门脸 faceImg 64×64·地图 Tab 缩略·主角面板生图·跨天·资金整数·未破产) + HERO-SPRITE PASS(主角生图 64×64·买摩托造型自动切 moped) 0 pageerror; 回归 PROTAG/MAPS/OLDSAVE 全 PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 76ce9820

## 检测结果(本轮·二次元立绘 + 性别选项 + 角色剧情)
- **动漫立绘生图** `art-gen/gen_anime.js`: Pollinations.ai(flux, 256×256, 动漫插画风) 生成 10 张: 主角 2(♂heroMale / ♀heroFemale 半身像) + 恋爱角色 8(女性池 莉莎/小夏/雪子/小春 + 男性池 凯恩/晴人/烈/雪彦), PIL 转 256×256 RGBA; manifest.js 扩展纳入 anime/ 目录(总 34 素材, ART_GEN 含立绘键)
- **性别系统** `game.js`: protagonist.gender + genderChosen(仅开局可改, 老档自动锁定); setGender(g); romancePool() 按性别过滤——男→女性池(4), 女→男性池(4); proposeTo 加跨池拦截 wrongpool; load 兼容补 gender/genderChosen
- **8 角色独立剧情** ROMANCE_NPCS 改对象: 每角色 story[3] 段(初识/约会/求婚), romanceStory(key) 按 romanceLevel(<7 初识 / ≥7 约会 / ≥10 求婚)返回当前台词
- **UI 集成**: 主角面板立绘 .heroModelBig(72px 按性别切 heroMale/heroFemale, 缺省回退像素 HERO_MODELS); 恋爱 Tab 立绘 .npcPortrait(40px) + 剧情框 .hStory(斜体台词) + 性别切换器(仅未锁定时); proposeTo wrongpool 提示
- Playwright 验证: ANIME3 PASS(男主池=莉莎/小夏/雪子/小春·立绘男生·4 立绘·恋爱 lisa·剧情 3 阶段 L1=0/High=1/Max=2·求婚台词「永远的主角」·跨天·资金整数·未破产) 0 pageerror; 回归 PROTAG/MAPS/OLDSAVE 全 PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 492cae27

## 检测结果(本轮·7 章剧情: 不同好感度逐级解锁)
- **8 角色 × 7 章 = 56 段剧情**(game.js): 章 0~2 按好感度(≥1 初识 / ≥3 熟络 / ≥5 心绪), 章 3~6 按恋爱进度(≥1 告白 / ≥4 甜蜜 / ≥7 情深 / ≥10 婚约); STORY_UNLOCK 阈值表 + STORY_LABELS; romanceUnlocks(key) 返回 7 章解锁状态+台词+解锁条件; 恋爱章节需处于恋爱中才解锁(跨池角色只解锁好感 3 章)
- **UI 章节标记** .storyBeats(7 枚·点亮 .on / 锁 🔒 / 当前 .cur): 点亮章可点回看(二次点击取消), 未解锁章 title 显示解锁条件; 剧情框默认显示已解锁最新章节, 选中章显示对应章
- **坑位修复**: 章 0 的 sel=0 是 falsy, `(sel||null)` 会吞掉 0 → 改为直接取属性值; 回看点击闭包捕获旧 sel → 点击时重读 window._heroStorySel
- Playwright: STORY7 PASS(7 章逐级解锁断言 up0~up10·跨池锁·28 章节按钮=4 池×7·回看点 lisa 章 0 显示「热拿铁」·跨天·资金整数·未破产) + 回归 ANIME3/PROTAG/MAPS/OLDSAVE 全 PASS, 0 pageerror
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 6a6f7e93

## 检测结果(本轮·galgame 化恋爱: 24 张 CG + 视觉小说事件 + CG 相册)
- **资料调研**(local-first): galgame 设计要点落本地 KB `06-资源/2026-10-28_galgame-romance-cg-design.md`(好感阈值解锁事件/CG 收集相册/关键剧情配 CG)
- **24 张 CG 生图** `art-gen/gen_cg.js`: Pollinations flux 640×360 anime 场景插画, 8 角色 × 3 关键章(心绪 s0 / 告白 s1 / 婚约 s2), 每角色 3 场景不同构图+情绪(如 lisa: 咖啡柜台/画布前告白/商场门口婚礼), 24/24 成功; manifest 纳入 cg/ 目录(总 58 素材)
- **game.js CG 系统**: ROMANCE_CGS(8×3, 含标题) + cgUnlocked/cgsOf/cgCount/cgEventText + cgNewEvents/cgMarkSeen(自动事件去重, p.cgSeen 持久化) + load 兼容; 解锁规则与 7 章对齐: s0=好感 5 / s1=恋爱进度 1 / s2=进度 10
- **视觉小说事件** `index.html .cgEvent`(全屏 z9000: 场景插画 + 金色名牌 + 底部深色文本框 + 关闭提示, fade 入场) + `maybeShowCGEvent()`(跨天/送礼/表白后自动弹, 每张只弹一次); CG 相册 Tab(hero 面板第 5 标签 🖼️): 按角色分组, 已解锁缩略图可点回看事件, 未解锁剪影占位(🔒 + 解锁条件)
- Playwright: CG-EVENT PASS(24 定义·全锁→好感 5 解 s0·自动事件弹 lisa 告白章台词·cgSeen 去重·表白解 s1·进度 10 解 s2·相册 8 组·跨天·资金整数·未破产) 0 pageerror; 回归 STORY7/ANIME3/MAPS/OLDSAVE PASS; PROTAG 断言 heroTabs.length===4 因新增 CG 标签过期(功能正常), 更新为 5 后 PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 9081b52c

## 检测结果(本轮·画面比例 + 图片清晰度)
- **CG 事件拉伸修复** `.cgEventArt`: object-fit cover→contain(黑底 letterbox, 640×360 源 16:9 不变形不裁切, 420px 宽屏显示=缩放 0.66 倍更清晰), 移除 pixelated→auto(动漫场景平滑缩放, 不再出现像素锯齿)
- **立绘清晰化**: `.npcPortrait` 40→48px + 移除 pixelated(256px 源图缩到 48px 平滑锐利); `.heroModelBig` 72→96px + 平滑(256 源图); CG 相册 `.cgThumb` 移除 pixelated
- **铺位门脸(64px 像素风)保持 pixelated/crisp-edges**, faceImg 100%→44px 固定(64px 源图 0.69 倍缩放, 不放大不糊); 地图 Tab 缩略 18→28px(64px 源图 0.44 倍, 更清晰)
- **不再生图**: 640×360 CG 源 > 420px 显示宽=天然降采样清晰; 重生成 1280×720 会膨胀 bundle ~20MB(现 9.6MB), 性价比低 → 记录决策不实施
- Playwright: CLARITY PASS(CG contain/auto 渲染·16:9·关开事件·立绘 auto 平滑·铺位 44px·主角 96px·跨天·资金整数·未破产) 0 pageerror; 回归 STORY7/CG-EVENT/ANIME3/PROTAG/MAPS/OLDSAVE 全 PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 2e2459c9

## 检测结果(本轮·CG/立绘 高清化, 同"拉伸比例+清晰度"标准)
- **高清重生**(art-gen/gen_hd.js, Pollinations flux): 24 张 CG 升 1280×720 JPEG(q88) + 10 张立绘升 512×512 JPEG(q90), LANCZOS 缩放; 键名不变(lisa_s0/heroMale 等), 代码零改动; 体积 34 张 HD jpg≈8.9M vs 旧 34 张 png≈6.5M, 而清单 9.2M→3.97M(58 素材)
- **manifest.js**: 同名键 jpg 优先覆盖 png(去重逻辑修复, 旧版 png 后写覆盖 jpg 导致 0 高清); 双 mime(jpg/png)
- **显示区同步提升**: .heroModelBig 96→128px, .npcPortrait 48→56px(512 源 0.25/0.44 倍缩放, 桌面/移动更锐利)
- **CG 查看器**(hero-system.js): CG 相册缩略图点击 → 模态放大查看(大图 16:9 contain + 标题 + 剧情台词 + 解锁条件, 点击关闭), 与自动全屏事件分流(事件保留, 查看器用于主动浏览); 全屏事件加 上一章/下一章 切换(◀▶ 已解锁章节间导航)
- Playwright: CG-HD PASS(58 键·34 高清 jpg·lisa s0 查看器弹出/关闭·事件 s1 左右切换→s0·主角立绘 128px 源 512×512·跨天·资金整数·未破产) 0 pageerror; 回归 STORY7/CG-EVENT/ANIME3/PROTAG/MAPS/OLDSAVE 全 PASS
- 三方产物(bundle / 桌面版 / zip / 服务器)md5 一致 58c321ec
