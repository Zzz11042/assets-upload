"""RedNote Pilot —— 控制红米 Note 11 Pro 的 AI 助手。

核心模块：
- adb_device:     通过 adb 控制设备（输入/UI/应用/文件/截屏）
- llm:            OpenAI 兼容的 LLM 客户端（可接 DeepSeek/OpenAI/自定义网关）
- planner:        自然语言 -> 动作计划 -> 执行
- system_prompt:  动态 system prompt 构造器（带设备上下文）
- skills:         确定性技能清单
- server:         FastAPI HTTP 服务
- cli:            命令行入口
"""

from .adb_device import ADBDevice, ADBError, DeviceNotFound, DeviceInfo
from .llm import ChatMessage, LLMClient, LLMConfig
from .planner import ActionPlan, ExecResult, Planner, SYSTEM_PROMPT
from .skills import Skill, SkillRegistry
from .system_prompt import build_system_prompt

__all__ = [
    "ADBDevice", "ADBError", "DeviceNotFound", "DeviceInfo",
    "ChatMessage", "LLMClient", "LLMConfig",
    "ActionPlan", "ExecResult", "Planner", "SYSTEM_PROMPT",
    "Skill", "SkillRegistry",
    "build_system_prompt",
]

__version__ = "0.1.0"
