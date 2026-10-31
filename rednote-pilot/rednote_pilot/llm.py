"""LLM 客户端：统一的 OpenAI 兼容接口，支持多家外部 API。

支持的供应商（base_url + model 可自由组合）：
- OpenAI / DeepSeek / Moonshot / 智谱 / 通义 / 任意 OpenAI 兼容端点
- 无 API key 时退化为 echo 模式（仅回显，便于离线调试）
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx


@dataclass
class ChatMessage:
    role: str  # system | user | assistant
    content: str

    def as_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


@dataclass
class LLMConfig:
    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"
    temperature: float = 0.1
    max_tokens: int = 2048
    timeout: float = 120.0
    system_prompt: str = "You are a helpful assistant."
    extra_headers: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_env(cls, provider: str = "deepseek") -> "LLMConfig":
        """按供应商从环境变量装载默认配置。"""
        if provider in ("openai", "deepseek", "moonshot", "zhipu", "dashscope"):
            key_env = "REDNOTE_PILOT_LLM_API_KEY"
        else:
            key_env = "OPENAI_API_KEY"
        return cls(
            api_key=os.environ.get(key_env, "") or os.environ.get("OPENAI_API_KEY", ""),
            base_url=os.environ.get("REDNOTE_PILOT_LLM_BASE_URL", "https://api.deepseek.com/v1"),
            model=os.environ.get("REDNOTE_PILOT_LLM_MODEL", "deepseek-chat"),
        )

    @classmethod
    def echo(cls) -> "LLMConfig":
        """离线回显模式：不调用外部 API。"""
        return cls(api_key="", base_url="", model="echo")


class LLMClient:
    """OpenAI 兼容的 chat.completions 客户端。"""

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig()

    @property
    def is_echo(self) -> bool:
        return self.config.model == "echo" or not self.config.api_key

    def chat(self, messages: list[ChatMessage], json_mode: bool = False, timeout: Optional[float] = None) -> str:
        """单轮 chat，返回助手文本。system_prompt 自动前置。"""
        if self.is_echo:
            return self._echo_reply(messages)
        has_system = any(m.role == "system" for m in messages)
        msgs = [m.as_dict() for m in messages]
        if self.config.system_prompt and not has_system:
            msgs.insert(0, {"role": "system", "content": self.config.system_prompt})
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": msgs,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
            **self.config.extra_headers,
        }
        url = self.config.base_url.rstrip("/") + "/chat/completions"
        with httpx.Client(timeout=timeout or self.config.timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]

    def chat_json(self, messages: list[ChatMessage], timeout: Optional[float] = None) -> dict[str, Any]:
        """让模型返回 JSON 对象。先严格解析，失败再做容错。"""
        raw = self.chat(messages, json_mode=True, timeout=timeout)
        return self._parse_json(raw)

    @staticmethod
    def _parse_json(raw: str) -> dict[str, Any]:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            raw = raw[raw.find("{") : raw.rfind("}") + 1]
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            start, end = raw.find("{"), raw.rfind("}")
            if start != -1 and end != -1:
                return json.loads(raw[start : end + 1])
            raise

    @staticmethod
    def _echo_reply(messages: list[ChatMessage]) -> str:
        user = messages[-1].content if messages else ""
        return json.dumps({"echo": user, "note": "LLM echo mode (no api key configured)"}, ensure_ascii=False)
