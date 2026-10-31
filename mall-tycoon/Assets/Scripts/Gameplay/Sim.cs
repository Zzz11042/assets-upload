using MallTycoon.Core;
using UnityEngine;

namespace MallTycoon
{
    /// <summary>
    /// 每日模拟节拍:把"每天"压缩成 30 秒。开始时按商场吸引力生成当日客流,
    /// 客流逐小时分摊进各铺位;玩家可随时点"结束今天"立即结算。
    /// </summary>
    public class Sim : MonoBehaviour
    {
        public const float DayLengthSec = 30f;
        const float HourStep = DayLengthSec / 24f;

        float _acc;
        int _hoursElapsed;

        public static Sim Instance { get; private set; }

        void Awake()
        {
            Instance = this;
            _acc = 0f;
            _hoursElapsed = 0;
        }

        void Update()
        {
            if (GameState.Instance == null) return;
            GameState.Instance.dayTime = Mathf.Clamp01(_acc / DayLengthSec);
            _acc += Time.deltaTime;
            _hoursElapsed = Mathf.Clamp01((int)(_acc / HourStep)) - 1;
            if (_hoursElapsed < 0) _hoursElapsed = 0;

            // 每经过一小时,按各铺位分流生成客流
            if ((int)(_acc / HourStep) > _hoursElapsed + 1)
            {
                DistributeHourCustomers();
                _hoursElapsed = Mathf.Min((int)(_acc / HourStep), 24);
            }

            if (_acc >= DayLengthSec) EndDay();
        }

        static void DistributeHourCustomers()
        {
            var g = GameState.Instance;
            int total = 0;
            foreach (var s in g.slots) total += s.CurrentCustomersPerHour;
            if (total == 0) return;
            foreach (var s in g.slots)
            {
                int c = s.CurrentCustomersPerHour;
                if (c <= 0) continue;
                int share = Mathf.RoundToInt(c * Mathf.Range(0.85f, 1.15f)); // 随机波动
                s.customersToday += share;
                var def = ShopCatalog.Get(s.shopType);
                s.todayRevenue += share * def.pricePerCustomer;
            }
        }

        /// <summary>玩家点"结束今天"按钮时调用,或自然过完一天。</summary>
        public void EndDay()
        {
            var report = GameState.Instance.EndDay();
            Debug.Log($"[Day {report.day}] 顾客 {report.customerCount},收入 {report.totalIncome},支出 {report.totalExpense},结余 {report.totalIncome - report.totalExpense},资金 {GameState.Instance.money}");
            _acc = 0f;
            _hoursElapsed = -1;
        }

        public void TickNewDay()
        {
            _acc = 0f;
            _hoursElapsed = -1;
        }

        public float DayProgress => GameState.Instance != null ? GameState.Instance.dayTime : 0f;
    }
}
