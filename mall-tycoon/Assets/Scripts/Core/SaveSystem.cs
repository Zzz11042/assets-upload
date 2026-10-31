using System.IO;
using UnityEngine;

namespace MallTycoon.Core
{
    /// <summary>
    /// 本地 JSON 存档。预留云存档接口:未来接入 TapTap SDK 云存档后,
    /// 把本地 Save 路径替换为远端同步即可,GameState 数据结构不变。
    /// </summary>
    public static class SaveSystem
    {
        static string SavePath => Path.Combine(Application.persistentDataPath, "mall_save.json");

        public static void Save(GameState state)
        {
            string json = JsonUtility.ToJson(state);
            File.WriteAllText(SavePath, json);
            Debug.Log($"[Save] 已保存 {SavePath}");
        }

        public static GameState Load()
        {
            if (File.Exists(SavePath))
            {
                string json = File.ReadAllText(SavePath);
                var loaded = JsonUtility.FromJson<GameState>(json);
                Debug.Log($"[Save] 已读取,当前第 {loaded.day} 天,资金 {loaded.money}");
                return loaded;
            }
            return null;
        }

        public static void Delete()
        {
            if (File.Exists(SavePath)) File.Delete(SavePath);
        }
    }
}
