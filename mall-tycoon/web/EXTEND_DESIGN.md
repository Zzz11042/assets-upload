# 多系统扩展设计（主角更多选项 + 打工小游戏 + 市场 + 股市 + 新闻）

## 现状锚点
- WORK_JOBS 6 种(纯数值 doWork), CONSUMABLES 8 种, 宏观 inflation/employment/landPriceMult, EVENTS 22 种(每日 roll), investLevel 0..5, 主角 energy/mood/hunger/romance/friends

## 实现状态: ✅ 全部完成(2026-10-28, 见下方逐项对照)

## 1. 打工小游戏(每岗位 1 个, 完成得全额工资, 失败得 40%) ✅
每日可打工次数不限(体力限制), 点打工 → 弹小游戏 overlay(限时 10s):
- cafe 咖啡拉花: 按序点亮 8 格(错序重置)
- super 理货: 点满 9 格货架(任意顺序)
- courier 跑单: 点完 6 个订单(任意顺序)
- it 装机: 按 1→6 顺序装部件
- artist 讲解: 9 宫格找 5 幅画(随机分布, 点中才计数)
- bank 理财: 3 方案选收益最高
- 新职业自带: streamer 直播冲榜(10s 连点 12 次) / advisor 荐股考验(看 K 线选最强)
- gig 接私活: 8s 内点 5 次
通关率: 10s 内完成 → 全额工资 + 心情 +5; 超时/失败 → 40% 工资 + 心情 -3
实现: hero-system.js `startMinigame(jobKey)` 弹层 + 倒计时条; 结算统一走 game.js `minigameSettle(jobKey, success)`; 体力进入前照扣; 通关记录 state.protagonist.minigames{jobKey:n}

## 2. 市场系统(商品价格波动, 每 3 天波动) ✅
- 6 类商品(MARKET_CATS: 咖啡/零售/餐饮/服务/娱乐/科技), state.marketMult[cat] = 当前倍率
- 每 3 天 marketTick→marketRoll: 每类 回归0.25 + 随机冲击±0.6 + 通胀漂移, 区间 ×0.4~×2.0, 记 7 点走势 state.marketHist
- 作用: dailyProcureCost 接入 shopMarketMult(铺位 tag → 类别, 轻餐饮→coffee / 餐饮→food / 零售·运动·文化·住宿·文教→retail / 服务·金融→service / 娱乐→fun / 科技→tech)
- 面板: ecoPanel「📈 市场」子 Tab, 每类 ×倍率 + 涨跌幅 + 7 点迷你走势条

## 3. 股市系统(6 只股票, 每日涨跌) ✅
- STOCK_DEFS: 咖啡连锁/零售集团/餐饮控股/医疗集团/科技新锐/银行股份(初始 100/100/120/150/80/200)
- 每日 endDay → stockSettle: ±5% 随机 + 事件修正(promo 利好 retail, foodfest 利好 food, bizsummit 利好 tech, inflation 利好 tech/利空 bank, deflation 利好 med, holiday 普涨, 暴雨/停电普跌), 记 7 点走势 state.stockHist
- 玩家买卖: buyStock/sellStock(整数股, state.stockHoldings, 资金直扣/回款), stockValue 总市值
- 面板: ecoPanel「📊 股市」子 Tab, 每只 现价/涨跌%/持有数 + 买1/买10/卖1/卖10 按钮
- 大涨大跌(单日≥4%)自动生成新闻

## 4. 新闻系统(事件→新闻条目, 累积 30 条) ✅
- addNews 倒序保留 30 条; 来源: 每日事件 eventNews(endDay 内 rollDailyEvent 后) / 市场波动≥15% marketNews / 股市±4% stockSettle
- 面板: ecoPanel「📰 新闻」子 Tab, 头条(最新)放大加底色, 影响标签(利好/利空/进货成本/股市)

## 5. 主角更多选项 ✅
- 打工 Tab: 每岗位「🎮 开小游戏(限时挑战)」按钮 + 顶部「📞 接私活」入口(每日 1 次, jobUnlocked 按 sideGigDay 判定)
- 新职业 2 种(EXTRA_JOBS 并入 WORK_JOBS): 网红主播(打工10天+投资Lv≥1, ¥1800/体力35/心情+6), 投资顾问(打工15天+投资Lv≥3, ¥5000/体力70/心情-2)
- 新消费 3 项(EXTRA_CONSUMABLES 并入 CONSUMABLES, 新 cat="service" 🎫 服务): 健身卡(体力上限+15, protagonistMaxEnergy 已接入) / 宠物(心情+15) / 投资课程(打工收益+5%, workJobPay 已接入)
- 接私活: SIDE_GIG(体力15/基础¥800), 走 minigame "gig" 模板, 结算 minigameSettle('gig', ok), sideGigDay 记录当日
- 资产 Tab: 实物资产 + 「🎮 小游戏通关记录」+「📈 股市持仓」(市值/持股/现价)

## 状态
- state.marketMult / marketHist / stocks / stockHoldings / stockHist / news(全部初始化 + load() 旧档兼容 + resetSave 重置)
- state.protagonist.minigames / sideGigDay(load 兼容补默认)
- 旧存档无这些字段时全部兜底, 不迁移不报错

## 面板
- ecoPanel 内加 3 子 Tab(市场/股市/新闻), renderAll 里自动刷新 _renderEcoExtTab; renderEconomy 顶部 TabBar
- heroPanel: work Tab 小游戏 + 接私活; assets Tab 通关记录 + 股市持仓
- .mgEvent 弹层样式在 index.html 注入区

## 验证
- game.js 逻辑层: Node 无头 smoke test 全过(市场 roll/股票结算/买卖/新闻/进货倍率 2.00)
- 整 bundle: 静态符号引用全命中; jsdom 全量跑受 jsdom CSS 解析栈溢出限制(修改前备份 bundle 同样溢出, 与本次改动无关), 浏览器实际打开验证
