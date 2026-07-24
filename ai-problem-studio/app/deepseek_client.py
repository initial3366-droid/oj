"""Minimal OpenAI-compatible client for configurable DeepSeek model endpoints."""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

import httpx

from .provider_credentials import ProviderCredentialStore


class DeepSeekApiError(RuntimeError):
    """Describe a provider failure without exposing the configured API key in logs or responses."""


ProgressCallback = Callable[[str, str, str], Awaitable[None]]


class DeepSeekClient:
    """Request JSON-only completions from a configurable OpenAI-compatible chat endpoint."""

    def __init__(self, apiKey: str | ProviderCredentialStore) -> None:
        """Use a fixed test key or a mutable process-local credential store for provider requests."""

        # The credential source never enters job data, exceptions, logs, or API responses.
        self.apiKey = apiKey
        # Complete problem candidates include statements, C++ code, and tests, so compatible providers receive five minutes.
        self.requestTimeoutSeconds = 300.0

    async def completeJson(
        self,
        baseUrl: str,
        modelName: str,
        systemPrompt: str,
        userPrompt: str,
        temperature: float,
        reasoningEffort: str | None = None,
        progressCallback: ProgressCallback | None = None,
        progressPhase: str = "provider",
    ) -> dict[str, Any]:
        """Call chat completions in JSON mode and parse the returned object defensively."""

        # The optional progress arguments preserve the provider-neutral LangGraph contract for legacy callers.
        del progressCallback, progressPhase
        # The current key is resolved at request time so a visual settings update applies without a restart.
        apiKey = self._currentApiKey()
        if not apiKey:
            raise DeepSeekApiError("模型 API Key 尚未配置，请在连接设置中填写")
        # The endpoint supports both a root base URL and a complete chat-completions URL.
        completionUrl = self._completionUrl(baseUrl)
        # The bearer token stays only in the outbound HTTPS request header.
        requestHeaders = {
            "Authorization": f"Bearer {apiKey}",
            "Content-Type": "application/json",
        }
        # The request asks the model for an object so downstream Pydantic validation has a stable boundary.
        requestPayload = {
            "model": modelName,
            "messages": [
                {"role": "system", "content": systemPrompt},
                {"role": "user", "content": userPrompt},
            ],
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        # OpenAI's Chat Completions API accepts reasoning_effort only when the operator selected a value.
        if reasoningEffort is not None:
            requestPayload["reasoning_effort"] = reasoningEffort
        try:
            # A short-lived client avoids keeping provider connections across test runs or config changes.
            async with httpx.AsyncClient(timeout=httpx.Timeout(self.requestTimeoutSeconds)) as httpClient:
                # The request waits for one complete JSON response from a broadly compatible chat-completions gateway.
                response = await httpClient.post(completionUrl, headers=requestHeaders, json=requestPayload)
                response.raise_for_status()
        except httpx.HTTPStatusError as error:
            # Cloudflare 524 means its upstream did not produce a complete non-streaming response in time.
            if error.response.status_code == 524:
                raise DeepSeekApiError(
                    "模型 API 网关超时（HTTP 524）：上游服务在完整响应返回前被 Cloudflare 断开。"
                    "当前为非流式响应，本机的 300 秒等待不能延长网关限制；请将推理强度调低至 high 或 medium、"
                    "选择更快的模型，或切换到不受该网关限制的 API 地址后再次执行。"
                ) from error
            # The bounded provider body is useful for diagnosis but cannot contain an API key.
            responseText = error.response.text[:2000]
            raise DeepSeekApiError(
                f"模型 API 请求返回 HTTP {error.response.status_code}: {responseText}"
            ) from error
        except httpx.TimeoutException as error:
            # ReadTimeout often has an empty string representation, so the exception type and configured limit stay explicit.
            timeoutType = type(error).__name__
            raise DeepSeekApiError(
                f"模型 API 请求超时（{timeoutType}）：已等待 {int(self.requestTimeoutSeconds)} 秒，请检查模型服务响应速度"
            ) from error
        except httpx.HTTPError as error:
            # Other transport errors retain their class name even when a gateway supplies no diagnostic string.
            transportErrorType = type(error).__name__
            transportErrorDetail = str(error).strip() or "未提供额外错误信息"
            raise DeepSeekApiError(f"模型 API 请求无法完成（{transportErrorType}）：{transportErrorDetail}") from error
        # The OpenAI-compatible response contains choices[0].message.content.
        responsePayload = response.json()
        try:
            # The choices list contains model alternatives, where this application always consumes the first.
            choices = responsePayload["choices"]
            # The selected choice message contains the JSON text requested above.
            message = choices[0]["message"]
            # Some compatible gateways emit an empty string, which is rejected below.
            messageContent = message.get("content")
        except (KeyError, IndexError, TypeError) as error:
            raise DeepSeekApiError("模型 API 响应不包含 choices[0].message.content") from error
        if not isinstance(messageContent, str) or not messageContent.strip():
            raise DeepSeekApiError("模型 API 返回了空 JSON 响应")
        # The helper strips accidental Markdown fences before JSON parsing.
        parsedContent = self._parseJsonObject(messageContent)
        return parsedContent

    def _currentApiKey(self) -> str:
        """Resolve the current process-only credential while retaining string-key test compatibility."""

        # Production uses the store, while a direct string keeps offline unit tests compact.
        if isinstance(self.apiKey, ProviderCredentialStore):
            return self.apiKey.getApiKey()
        return self.apiKey.strip()

    def _completionUrl(self, baseUrl: str) -> str:
        """Normalize compatible endpoint variants into a concrete chat-completions URL."""

        # The trailing slash is removed before appending a well-defined endpoint segment.
        normalizedUrl = baseUrl.strip().rstrip("/")
        if normalizedUrl.endswith("/chat/completions"):
            return normalizedUrl
        return f"{normalizedUrl}/chat/completions"

    def _parseJsonObject(self, messageContent: str) -> dict[str, Any]:
        """Parse exactly one JSON object and reject arrays, prose, or malformed model output."""

        # The text is cleaned because some gateways wrap JSON mode output in a Markdown code fence.
        normalizedContent = messageContent.strip()
        if normalizedContent.startswith("```") and normalizedContent.endswith("```"):
            # The first line may be ```json or a bare fence and is not part of JSON itself.
            fencedLines = normalizedContent.splitlines()
            normalizedContent = "\n".join(fencedLines[1:-1]).strip()
        try:
            # The decoder rejects malformed escapes and returns Python primitives for schema validation.
            parsedValue = json.loads(normalizedContent)
        except json.JSONDecodeError as error:
            raise DeepSeekApiError("模型 API 响应不是有效 JSON") from error
        if not isinstance(parsedValue, dict):
            raise DeepSeekApiError("模型 API JSON 响应必须是对象")
        return parsedValue
