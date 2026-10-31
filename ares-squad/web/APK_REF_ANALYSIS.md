# 对标分析：《小小部队2》(Tiny Troopers 2) APK
> 参考附件：`xxbd2gfzb_174720.apk.1`（88MB，sha256 `85835dd2…`），只读分析，未修改。

## 1. 应用身份
- 包名：`com.xiaoao.tinytroopers2.nearme.gamecenter`
- 应用名：小小部队2 / Tiny Troopers 2，版本号 6.1（versionCode 6.0-2438415）
- 构建时间：2020-02-20（APK 内文件时间戳）
- 引擎：**Unity 4.7.0f1 + Mono**（`libunity.so`/`libmono.so`，armeabi-v7a 与 x86 双架构）
- 渠道：Nearme 游戏中心（OPPO）代理壳 + OPPO 账号 + 百度移动广告（BaiduMobAd，统计 ID `a32bd88414`）+ AutoThink 社交通讯/实名认证 SDK

## 2. 包结构
- 顶层是 Android 壳（AndroidManifest.xml 二进制 AXML + classes.dex 5.2MB + 渠道 SDK 资源 res/anim/auto_*）
- 游戏本体在 `assets/bin/Data/`（旧版 Unity 资源，963 个文件，解压后 194MB）：
  - `sharedassets0~46.assets`（部分 .split 分片）+ 同名 `.resS`：老 Unity **非 AssetBundle** 的散资源格式
  - 十六进制 GUID 命名的散资源（贴图/音频/预制体/脚本元数据）
  - `mainData`（745KB）含 `Assembly-CSharp.dll` 脚本程序集元数据

## 3. 游戏内容（从资源字符串还原）
- 类型：2D/2.5D 俯视角战术小队射击 + 生存（与本项目「末日小队」同赛道）
- 关卡：Level6~Level32+，含 cinematic 开场（`cinematic_camera_start1_level19/22`）
- 敌人单位：`EnemyNormalRookie / Elite / Superior / ParatrooperLanding`、`EnemyGatlingGunner`、`EnemyGrenadier`、`EnemyFlamethrower`、`EnemySuicidePath`（自爆路径）、`ZombieAirDropPoint/ZombieDropPoint`
- 我方单位：`Soldier / SoldierParatrooper / CivilianSoldier / WoundedSoldier`，载具 `SoldierTankAmmo / SoldierVehicle / Tank / TankTurret / Helicopter / Plane`
- 武器/装备：Bazooka、Grenade、Flamethrower、Sniper、Turret、ArtilleryAmmo、ExplosiveBarrel、RepairBox
- 玩法机制类名（C#，Assembly-CSharp）：
  - `LevelLoader / LevelEnd / LevelInit / DropIntel / GotoPoint`（关卡驱动）
  - `KillZone / EnemiesTarget / EnemySpawnPoint / AnimalSpawnPoint`（敌人生成与击杀区）
  - `SuicideTrigger / BrokenBuilding / DestructibleFence / DestructibleWeapon`（**可破坏掩体**）
  - `PrisonerActivate / TrainContainer`（人质/护送）
  - `RandomIdleAnimation / RaycastColliders / ShootThrough`（表现与弹道）
  - `HOTween.dll`（动画补间依赖）

## 4. 对本项目（末日小队）的可借鉴点
| 对标特性 | 小小部队2 做法 | 末日小队现状 / 可借鉴方向 |
|---|---|---|
| 可破坏掩体 | `DestructibleFence / BrokenBuilding`：掩体被击破后改变战场 | 第 17 轮已完成围墙阻挡+啃墙破墙，方向一致；可扩展到「掩体被击破后生成残骸地形」 |
| 敌人分层 | Rookie→Elite→Superior + 空降兵落地态 | 现有 5 职业×多波难度梯度；可加「空降/破墙进入」的敌人入场方式 |
| 自爆单位 | `EnemySuicidePath` 按固定路径自爆 | 现有 spore/thrower；可加「冲向基地自爆」的新僵尸类型 |
| 人质护送 | `PrisonerActivate / TrainContainer` | 主线 M2/M5 已有人质护送，对标「多阶段人质」 |
| 载具 | Tank/Helicopter/Plane + 弹药点 | 无载具；如做可扩展为敌方空中单位 |
| 工程实现 | Unity C# 类驱动 + Tween + 事件 | 本项目为零依赖 Canvas 单文件，对标的是**机制设计**而非引擎实现 |

## 5. 结论
该 APK 是同赛道商业成品（小型战术小队射击 + 生存防御），机制复杂度（可破坏掩体、空降、自爆路径、人质）与本项目的围墙阻挡/啃墙设计同源。可作为后续「掩体残骸」「空降入场」「自爆僵尸」等机制的参考；引擎层（Unity 4.7）无需借鉴，保持单文件 Canvas 路线。
