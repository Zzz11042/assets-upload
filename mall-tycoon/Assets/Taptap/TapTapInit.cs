using UnityEngine;

namespace MallTycoon.Taptap
{
    /// <summary>
    /// TapTap SDK 初始化桩。
    /// 正式接入流程:
    /// 1. 用 taptap-cli 创建游戏后,到开发者中心拿 TapTap ClientId / AppKey
    /// 2. Unity 中通过 Package Manager 装 TapSDK v4 包(com.taptap.tds.*)
    ///    或用 NPM:manifest.json 加 "com.taptap.tds.login" 等,并声明 scopedRegistries
    /// 3. 把这里替换为真实的 Bootstrap.Init,登录走 TDSUser 内建账户
    /// 4. 内购/云存档等模块按需开启,资质事实(联网/内购/AI)要同步到 CLI 的 qualification 分析
    /// 当前桩版本:只输出日志,保证场景可运行不报缺包错误。
    /// </summary>
    public class TapTapInit : MonoBehaviour
    {
        [SerializeField] string clientId = "REPLACE_WITH_TAPTAP_CLIENT_ID";
        [SerializeField] string appKey = "REPLACE_WITH_TAPTAP_APP_KEY";

        void Start()
        {
            Debug.Log($"[TapTap] 桩初始化 clientId={clientId} key=*** key 已设置)");
        }
    }
}
