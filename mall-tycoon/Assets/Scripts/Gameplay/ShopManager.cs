using System.Collections.Generic;
using MallTycoon.Core;
using UnityEngine;

namespace MallTycoon
{
    /// <summary>
    /// 建造与升级操作:在网格上铺设商铺、升级、拆除。所有花费走 GameState.money。
    /// 通过事件通知 UI 刷新(不直接依赖 UI 类)。
    /// </summary>
    public class ShopManager : MonoBehaviour
    {
        public static ShopManager Instance { get; private set; }
        public event System.Action OnChanged;

        void Awake() { Instance = this; }

        public bool TryBuild(int x, int y, ShopType type)
        {
            var g = GameState.Instance;
            var slot = g.GetSlot(x, y);
            if (slot == null || slot.built) return false;
            var def = ShopCatalog.Get(type);
            if (def == null || g.money < def.buildCost) return false;

            g.money -= def.buildCost;
            slot.built = true;
            slot.shopType = type;
            slot.shopLevel = 1;
            SaveSystem.Save(g);
            OnChanged?.Invoke();
            return true;
        }

        public bool TryUpgrade(int x, int y)
        {
            var g = GameState.Instance;
            var slot = g.GetSlot(x, y);
            if (slot == null || !slot.built) return false;
            var def = ShopCatalog.Get(slot.shopType);
            if (def == null || slot.shopLevel >= def.maxLevel) return false;
            int cost = def.upgradeCostPerLevel * slot.shopLevel;
            if (g.money < cost) return false;

            g.money -= cost;
            slot.shopLevel++;
            SaveSystem.Save(g);
            OnChanged?.Invoke();
            return true;
        }

        /// <summary>拆铺:返还 50% 建造费,清除等级。</summary>
        public bool TryDemolish(int x, int y)
        {
            var g = GameState.Instance;
            var slot = g.GetSlot(x, y);
            if (slot == null || !slot.built) return false;
            var def = ShopCatalog.Get(slot.shopType);
            if (def != null)
                g.money += def.buildCost / 2;
            slot.built = false;
            slot.shopType = ShopType.None;
            slot.shopLevel = 0;
            slot.customersToday = 0;
            slot.todayRevenue = 0;
            SaveSystem.Save(g);
            OnChanged?.Invoke();
            return true;
        }

        public int BuildCostOf(ShopType type) => ShopCatalog.Get(type)?.buildCost ?? 0;
    }
}
