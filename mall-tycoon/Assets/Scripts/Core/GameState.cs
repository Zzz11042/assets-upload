using System.Collections.Generic;
using UnityEngine;

namespace MallTycoon.Core
{
    /// <summary>
    /// 全局游戏状态单例。持有商场经营的核心数据,由 SaveSystem 负责持久化。
    /// </summary>
    [System.Serializable]
    public class GameState
    {
        public static GameState Instance { get; private set; }

        // ---- 玩家资源 ----
        public long money = 20_000;          // 起始资金
        public int day = 1;                // 经营天数
        public float dayTime = 0f;         // 当天进度 0..1

        // ---- 商场布局 ----
        public int gridWidth = 4;          // 铺位网格宽度
        public int gridHeight = 3;         // 铺位网格高度
        public List<ShopSlot> slots = new List<ShopSlot>();

        public static void Init()
        {
            if (Instance == null)
                Instance = new GameState();
        }

        public ShopSlot GetSlot(int x, int y)
        {
            int i = y * gridWidth + x;
            if (i < 0 || i >= slots.Count) return null;
            return slots[i];
        }

        public bool EnsureSlots()
        {
            int need = gridWidth * gridHeight;
            while (slots.Count < need)
                slots.Add(new ShopSlot());
            return true;
        }

        /// <summary>每天结束时调用:结算收益、推进天数。</summary>
        public DayReport EndDay()
        {
            int income = 0;
            int expense = 0;
            int customers = 0;

            for (int i = 0; i < slots.Count; i++)
            {
                var s = slots[i];
                if (!s.built || s.shopLevel <= 0) continue;
                var def = ShopCatalog.Get(s.shopType);
                if (def == null) continue;

                int dayCustomers = s.customersToday;
                int revenue = dayCustomers * def.pricePerCustomer;
                int upkeep = def.upkeepPerDay;
                income += revenue;
                expense += upkeep;
                customers += dayCustomers;

                s.customersToday = 0;
                s.todayRevenue = 0;
                s.levelXp += dayCustomers / 10;   // 经验:每 10 客流 +1
            }

            money += income - expense;
            day++;
            dayTime = 0f;

            var report = new DayReport
            {
                day = day - 1,
                customerCount = customers,
                totalIncome = income,
                totalExpense = expense
            };
            SaveSystem.Save(this);
            return report;
        }
    }

    [System.Serializable]
    public struct DayReport
    {
        public int day;
        public int customerCount;
        public int totalIncome;
        public int totalExpense;
    }
}
