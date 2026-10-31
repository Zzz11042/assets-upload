using System.Collections.Generic;
using UnityEngine;

namespace MallTycoon.Core
{
    public enum ShopType { None, Cafe, Supermarket, Gaming, Cinema }

    [System.Serializable]
    public class ShopDef
    {
        public ShopType type;
        public string displayName;
        public int buildCost;         // 建造费
        public int upgradeCostPerLevel; // 每级升级费
        public int pricePerCustomer;   // 每位顾客贡献的营业额
        public int upkeepPerDay;       // 每日维护费
        public int maxLevel = 5;
        public int attractivityBase = 10; // 对商场整体吸引力的基础加成
    }

    /// <summary>
    /// 铺位:商场网格中的一个格子。built 表示是否已开铺,shopLevel 为当前等级。
    /// </summary>
    [System.Serializable]
    public class ShopSlot
    {
        public bool built;
        public ShopType shopType = ShopType.None;
        public int shopLevel = 0;
        public int customersToday;
        public int todayRevenue;

        public int CurrentCustomersPerHour
        {
            get
            {
                if (!built || shopLevel <= 0) return 0;
                var def = ShopCatalog.Get(shopType);
                if (def == null) return 0;
                return Mathf.RoundToInt(def.attractivityBase * shopLevel * 1.5f);
            }
        }
    }

    /// <summary>
    /// 静态铺位目录。模拟经营数值的核心配置表。
    /// </summary>
    public static class ShopCatalog
    {
        static ShopDef[] _defs =
        {
            new ShopDef { type = ShopType.Cafe, displayName = "咖啡厅",
                buildCost = 2000, upgradeCostPerLevel = 1500, pricePerCustomer = 30,
                upkeepPerDay = 200, maxLevel = 5, attractivityBase = 12 },
            new ShopDef { type = ShopType.Supermarket, displayName = "超市",
                buildCost = 4000, upgradeCostPerLevel = 3000, pricePerCustomer = 80,
                upkeepPerDay = 500, maxLevel = 5, attractivityBase = 18 },
            new ShopDef { type = ShopType.Gaming, displayName = "游戏厅",
                buildCost = 6000, upgradeCostPerLevel = 4500, pricePerCustomer = 120,
                upkeepPerDay = 800, maxLevel = 5, attractivityBase = 25 },
            new ShopDef { type = ShopType.Cinema, displayName = "电影院",
                buildCost = 10000, upgradeCostPerLevel = 7000, pricePerCustomer = 200,
                upkeepPerDay = 1500, maxLevel = 5, attractivityBase = 35 },
        };

        public static ShopDef Get(ShopType t)
        {
            foreach (var d in _defs)
                if (d.type == t) return d;
            return null;
        }

        public static IEnumerable<ShopDef> All()
        {
            foreach (var d in _defs) yield return d;
        }

        /// <summary>商场总吸引力 = 各铺位吸引力之和,决定每天客流。</summary>
        public static int ComputeAttractivity(GameState g)
        {
            int sum = 20; // 商场基础吸引力
            for (int i = 0; i < g.slots.Count; i++)
            {
                var s = g.slots[i];
                if (s.built)
                {
                    var def = Get(s.shopType);
                    if (def != null) sum += def.attractivityBase * s.shopLevel;
                }
            }
            return sum;
        }

        /// <summary>每天进店客流(简化公式):吸引力开方 * 波动系数由调用方传入。</summary>
        public static int DailyCustomers(int attractivity, float wobble = 1f)
        {
            int c = Mathf.RoundToInt(Mathf.Sqrt(attractivity) * 40f * wobble);
            return Mathf.Max(0, c);
        }
    }
}
