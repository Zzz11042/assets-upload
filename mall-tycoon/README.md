# 商场大亨 (Mall Tycoon)

模拟经营类手游:经营你的商场,建铺、招客、赚钱、扩张。目标平台 Android,通过 TapTap 上架。

> **TapTap 进度**:草稿已创建 app-id **988611**(厂商「喜欢摸鱼工作室」484472),
> 资料 5 字段(简介/宣传图/图标/3 张截图/首页素材)已写入。
> 唯一阻塞:主包体未绑定——占位 APK 被服务端解析为空。执行记录与待办见 [TAPTAP_PLAN.md](TAPTAP_PLAN.md)。

## 引擎与工具

- Unity 2022.3 LTS (C#),项目结构可直接用 Unity Hub 打开本目录
- 构建 Android APK:需要 Android Studio + Unity 的 Android 模块
- 接入 TapTap 后,通过 `taptap-cli` 完成上架全流程(见根目录 `TAPTAP_PLAN.md`)

## 核心循环

```
建铺(花钱) → 铺位产生吸引力 → 每天客流分配 → 顾客消费(赚钱)
      ↑                                            ↓
    升级铺位 ← 每日财报结算 ← 维护费(持续花费)
```

一天被压缩成 30 秒,玩家可点"结束今天"立即结算。

## 操作

- 点击空地:建造第一个买得起的铺位
- 点击铺位:升级(每级加价)
- 长按 2 秒铺位:拆除(返还 50% 建造费)
- 底部"结束今天"按钮:立即结算当天并生成财报

## 目录

```
Assets/Scripts/
  Core/       GameState / SaveSystem / ShopCatalog / GameBootstrap
  Gameplay/   Sim(每日节拍) / ShopManager(建铺升级拆除)
  UI/         MainUI + SlotController(UGUI)
Assets/Scenes/Main.unity   主场景(需 Unity 编辑器内创建 Canvas 网格)
Assets/Taptap/             TapSDK 接入桩(先占位,建好游戏后拿 ClientId 再填)
```

## 数值配置

全部集中在 `Assets/Scripts/Core/ShopCatalog.cs` 的 `ShopDef[]` 里:建造费 / 维护费 /
单价 / 吸引力。调数值只改这一张表。

## 已知 demo 限制

- 客流是"小时节拍"模拟,没有顾客实体动画(后续加表现层)
- 存档在 `persistentDataPath/mall_save.json`
- TapSDK 是桩代码:游戏创建到 TapTap 后,在开发者中心拿 ClientId/Key 填到 `Assets/Taptap/TapTapInit.cs`
