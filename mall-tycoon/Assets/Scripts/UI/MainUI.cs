using System;
using System.Linq;
using MallTycoon;
using MallTycoon.Core;
using UnityEngine;
using UnityEngine.UI;

namespace MallTycoon.UI
{
    /// <summary>
    /// 主界面控制器:顶部 HUD(资金/天数/日进度),中部铺位网格,
    /// 底部反馈文本 + "结束今天"按钮 + 每日财报弹层。
    /// 挂到 Main 场景的 Canvas 根对象上;引用字段可留空(代码做了空判断)。
    /// </summary>
    public class MainUI : MonoBehaviour
    {
        [Header("HUD")]
        public Text moneyText;
        public Text dayText;
        public Slider dayProgress;

        [Header("Grid")]
        public Transform gridRoot;
        public GameObject slotPrefab;          // 单元格:Image + 子 Text + Button

        [Header("Day & Report")]
        public Button endDayButton;
        public GameObject reportPanel;
        public Text reportText;
        public Text feedback;                // 底部操作反馈文本

        SlotController[] _slots;
        GameState _g;

        public static MainUI Instance { get; private set; }

        void Awake()
        {
            Instance = this;
        }

        void Start()
        {
            _g = GameState.Instance;
            _g.EnsureSlots();
            BuildGrid();
            RefreshSlots();
            if (endDayButton != null)
                endDayButton.onClick.AddListener(() =>
                {
                    var r = Sim.Instance.EndDay();
                    ShowDayReport(r);
                });
        }

        void BuildGrid()
        {
            if (gridRoot == null || slotPrefab == null) return;
            // 只销毁上一批铺位实例,不影响 gridRoot 自身
            foreach (var old in gridRoot.GetComponentsInChildren<SlotController>(true))
                if (old.transform.parent == gridRoot) Destroy(old.gameObject);

            _slots = new SlotController[_g.gridWidth * _g.gridHeight];
            for (int y = _g.gridHeight - 1; y >= 0; y--)
            {
                for (int x = 0; x < _g.gridWidth; x++)
                {
                    var go = Instantiate(slotPrefab, gridRoot);
                    go.name = $"Slot_{x},{y}";
                    go.transform.localScale = Vector3.one;
                    var c = go.GetComponent<SlotController>();
                    c.Init(x, y);
                    _slots[y * _g.gridWidth + x] = c;
                }
            }
        }

        void LateUpdate()
        {
            if (_g == null) return;
            if (moneyText != null) moneyText.text = $"资金:¥{_g.money:N0}";
            if (dayText != null) dayText.text = $"第 {_g.day} 天";
            if (dayProgress != null) dayProgress.value = Sim.Instance != null ? Sim.Instance.DayProgress : 0f;
        }

        public void RefreshSlots()
        {
            if (_slots == null) return;
            for (int i = 0; i < _slots.Length; i++)
                _slots[i].Refresh(_g.GetSlot(i % _g.gridWidth, i / _g.gridWidth));
        }

        public void ShowDayReport(DayReport r)
        {
            if (reportPanel != null) reportPanel.SetActive(true);
            if (reportText != null)
                reportText.text =
                    $"第 {r.day} 天 财报\n" +
                    $"顾客 {r.customerCount} 人 | 收入 ¥{r.totalIncome:N0}\n" +
                    $"维护费 ¥{r.totalExpense:N0} | 结余 ¥{r.totalIncome - r.totalExpense:N0}\n" +
                    $"当前资金 ¥{_g.money:N0}";
        }

        public void HideReport()
        {
            if (reportPanel != null) reportPanel.SetActive(false);
        }

        public void Say(string message)
        {
            if (feedback != null) feedback.text = message;
        }
    }

    /// <summary>
    /// 单元格点击行为:
    /// - 空地 → 建造第一个买得起的铺位类型
    /// - 已开铺位 → 升级
    /// - 长按 2 秒 → 拆除
    /// 简化处理:用点击时间戳判断长按,不引入自定义指针扩展。
    /// </summary>
    public class SlotController : MonoBehaviour
    {
        Image _bg; Text _label;
        int _x, _y;
        float _lastPressStart = -999f;

        void Start()
        {
            _bg = GetComponent<Image>();
            _label = GetComponentInChildren<Text>();
            var t = GetComponent<Button>();
            if (t == null) t = gameObject.AddComponent<Button>();
            t.onClick.AddListener(Clicked);
        }

        void Clicked()
        {
            var now = Time.unscaledTime;
            float hold = now - _lastPressStart;
            _lastPressStart = now;

            if (hold > 2f)
            {
                // 长按:拆除
                bool ok = ShopManager.Instance.TryDemolish(_x, _y);
                MainUI.Instance?.Say(ok ? "已拆除,返还 50% 建造费" : "无法拆除");
                return;
            }

            var g = GameState.Instance;
            var slot = g.GetSlot(_x, _y);
            if (slot == null) return;

            if (slot.built)
            {
                bool up = ShopManager.Instance.TryUpgrade(_x, _y);
                MainUI.Instance?.Say(up
                    ? $"{ShopCatalog.Get(slot.shopType).displayName} 升到 Lv{slot.shopLevel}"
                    : "无法升级(满级或资金不足)");
            }
            else
            {
                foreach (var def in ShopCatalog.All())
                {
                    if (g.money < def.buildCost) continue;
                    if (ShopManager.Instance.TryBuild(_x, _y, def.type))
                    {
                        MainUI.Instance?.Say($"已建造 {def.displayName}(¥{def.buildCost})");
                        return;
                    }
                }
                if (!slot.built) MainUI.Instance?.Say("资金不足,无法建造");
            }
            MainUI.Instance?.RefreshSlots();
        }

        public void Init(int x, int y)
        {
            _x = x; _y = y;
        }

        public void Refresh(ShopSlot s)
        {
            if (s == null) return;
            if (_label != null)
                _label.text = s.built
                    ? $"{ShopCatalog.Get(s.shopType)?.displayName}\nLv{s.shopLevel} 客{s.customersToday} 售¥{s.todayRevenue}"
                    : "空地\n点击建造";
            if (_bg != null)
                _bg.color = s.built ? new Color(0.55f, 0.8f, 0.5f) : new Color(0.85f, 0.85f, 0.85f);
        }
    }
}
