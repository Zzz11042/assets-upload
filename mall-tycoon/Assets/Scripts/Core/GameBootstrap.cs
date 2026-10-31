using UnityEngine;
using MallTycoon.Core;

namespace MallTycoon
{
    /// <summary>
    /// 场景加载后初始化:读档或新建,补齐铺位网格,生成初始客流。
    /// 挂到 Main 场景任意 GameObject 上即可。
    /// </summary>
    public class GameBootstrap : MonoBehaviour
    {
        void Start()
        {
            GameState.Init();
            if (GameState.Instance == null || !GameState.Instance.EnsureSlots())
                GameState.Instance = new GameState();
            GameState.Instance.EnsureSlots();

            var loaded = SaveSystem.Load();
            if (loaded != null)
                GameState.Instance = loaded;

            GameState.Instance.EnsureSlots();
            Sim.TickNewDay(); // 新的一天:按吸引力生成今日客流
        }
    }
}
