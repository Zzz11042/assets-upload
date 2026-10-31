"""一键演示：连上手机，跑几个安全技能。

用法：
    python examples/quick.py "帮我截个屏"
    python examples/quick.py            # 默认：设备信息 + 当前前台应用 + 截屏
"""

import json
import sys

from rednote_pilot import ADBDevice, LLMClient, LLMConfig, Planner


def main() -> None:
    instruction = " ".join(sys.argv[1:]) or "先看看当前设备，截一张屏幕，再告诉我前台是哪个应用"
    d = ADBDevice()
    info = d.info().as_dict()
    print("设备信息:")
    print(json.dumps(info, ensure_ascii=False, indent=2))

    llm = LLMClient(LLMConfig.from_env())
    print(f"\nLLM 模式: {'echo (离线，未配 key)' if llm.is_echo else llm.config.model}")

    planner = Planner(d, llm)
    res = planner.execute(instruction)
    print("\n--- 动作计划 ---")
    print(json.dumps(
        {"thought": res.plan.thought, "actions": res.plan.actions, "expected": res.plan.expected},
        ensure_ascii=False, indent=2,
    ))
    print("\n--- 执行结果 ---")
    for r in res.results:
        print(f"[{r['index']}] {r['tool']}.{r['method']} {r['args']} -> {r['output'][:200]}")
    print(f"\n整体: {'成功' if res.ok else '有步骤失败'}")


if __name__ == "__main__":
    main()
