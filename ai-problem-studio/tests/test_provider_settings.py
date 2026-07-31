"""Focused tests for visual provider settings, process-only credentials, and reasoning-effort forwarding."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
import httpx

from app import deepseek_client, main
from app.deepseek_client import DeepSeekClient
from app.models import RuntimeSettings, RuntimeSettingsUpdateRequest
from app.provider_credentials import ProviderCredentialStore
from app.storage import StudioRepository


class FakeProviderResponse:
    """Return one minimal OpenAI-compatible JSON completion without opening a network connection."""

    def raise_for_status(self) -> None:
        """Model a successful HTTP response accepted by the production client."""

        # No exception proves the request reached the expected happy-path response parser.
        return None

    def json(self) -> dict[str, Any]:
        """Return the Chat Completions response shape consumed by DeepSeekClient."""

        # The JSON string lets the production parser validate its usual object-only contract.
        return {"choices": [{"message": {"content": '{"result":"ok"}'}}]}


class FakeProviderHttpClient:
    """Record outgoing provider requests while matching httpx.AsyncClient's async context-manager contract."""

    def __init__(self, recordedRequests: list[dict[str, Any]]) -> None:
        """Keep the shared recording list supplied by the test that created this client."""

        # The list remains outside the fake so assertions can inspect every request after completion.
        self.recordedRequests = recordedRequests

    async def __aenter__(self) -> "FakeProviderHttpClient":
        """Return the fake client from the async context used by DeepSeekClient."""

        # No connection setup is needed because this collaborator is purely in-memory.
        return self

    async def __aexit__(self, exceptionType, exceptionValue, tracebackValue) -> None:
        """Accept normal context-manager cleanup arguments without suppressing an unexpected error."""

        # The accepted values are intentionally unused because the fake owns no external resource.
        del exceptionType, exceptionValue, tracebackValue

    async def post(self, requestUrl: str, *, headers: dict[str, str], json: dict[str, Any]) -> FakeProviderResponse:
        """Record one model request and return a minimal successful response."""

        # The copy makes later mutation of the production payload impossible to hide from test assertions.
        requestRecord = {"url": requestUrl, "headers": dict(headers), "json": dict(json)}
        self.recordedRequests.append(requestRecord)
        return FakeProviderResponse()


def testReasoningEffortAndMemoryKeyReachCompatibleRequest(monkeypatch) -> None:
    """Confirm the visual reasoning choice becomes reasoning_effort and the key remains process-local."""

    # The recording list substitutes for a real network endpoint and retains no secret beyond this test process.
    recordedRequests: list[dict[str, Any]] = []
    # Constructor options prove the production client applies its intended full-response timeout.
    recordedClientOptions: list[dict[str, Any]] = []

    def buildFakeHttpClient(*args: Any, **kwargs: Any) -> FakeProviderHttpClient:
        """Return the request recorder while accepting httpx.AsyncClient constructor arguments."""

        # The option copy lets this test verify the configured timeout without opening a network connection.
        del args
        recordedClientOptions.append(dict(kwargs))
        return FakeProviderHttpClient(recordedRequests)

    monkeypatch.setattr(deepseek_client.httpx, "AsyncClient", buildFakeHttpClient)
    # The store represents the browser-configured key and never serializes it into runtime settings.
    credentialStore = ProviderCredentialStore("visual-api-key")
    providerClient = DeepSeekClient(credentialStore)

    async def runRequest() -> None:
        """Issue a single fake completion using the same arguments as the production agent."""

        # A high setting is sufficient to prove the optional request field is propagated verbatim.
        completionPayload = await providerClient.completeJson(
            "https://api.openai.example/v1",
            "gpt-reasoning-example",
            "system",
            "user",
            0.2,
            reasoningEffort="high",
        )
        assert completionPayload == {"result": "ok"}

    asyncio.run(runRequest())
    # The only record contains OpenAI's Chat Completions field rather than a provider-specific substitute.
    requestRecord = recordedRequests[0]
    assert requestRecord["url"] == "https://api.openai.example/v1/chat/completions"
    assert requestRecord["json"]["reasoning_effort"] == "high"
    assert "stream" not in requestRecord["json"]
    assert requestRecord["headers"]["Authorization"] == "Bearer visual-api-key"
    assert recordedClientOptions[0]["timeout"].read == 300.0


def testProviderReadTimeoutIncludesTypeAndConfiguredLimit(monkeypatch) -> None:
    """Confirm a blank ReadTimeout becomes an actionable message instead of a trailing empty colon."""

    class TimeoutProviderHttpClient:
        """Raise a realistic HTTPX read timeout while following the production async-client contract."""

        async def __aenter__(self) -> "TimeoutProviderHttpClient":
            """Return the fake client to the production request scope."""

            return self

        async def __aexit__(self, exceptionType, exceptionValue, tracebackValue) -> None:
            """Accept async-context cleanup arguments without suppressing the expected timeout."""

            # The fake has no connection to close after presenting its deterministic timeout.
            del exceptionType, exceptionValue, tracebackValue

        async def post(self, requestUrl: str, *, headers: dict[str, str], json: dict[str, Any]) -> FakeProviderResponse:
            """Raise an empty-message ReadTimeout for the configured Chat Completions request."""

            # Request metadata is accepted only to match the production call signature.
            del headers, json
            timeoutRequest = httpx.Request("POST", requestUrl)
            raise httpx.ReadTimeout("", request=timeoutRequest)

    def buildTimeoutHttpClient(*args: Any, **kwargs: Any) -> TimeoutProviderHttpClient:
        """Return the timeout fake while accepting the production HTTP client constructor settings."""

        # Constructor arguments are irrelevant because the fake fails before any network operation.
        del args, kwargs
        return TimeoutProviderHttpClient()

    monkeypatch.setattr(deepseek_client.httpx, "AsyncClient", buildTimeoutHttpClient)
    # A direct key reaches the timeout branch without reading or modifying any runtime settings.
    providerClient = DeepSeekClient("timeout-test-key")

    async def runTimeoutRequest() -> None:
        """Issue one request and assert its operator-facing timeout message retains useful diagnosis."""

        with pytest.raises(deepseek_client.DeepSeekApiError, match=r"ReadTimeout.*300"):
            await providerClient.completeJson(
                "https://api.openai.example/v1",
                "gpt-reasoning-example",
                "system",
                "user",
                0.2,
            )

    asyncio.run(runTimeoutRequest())


def testProviderCloudflareTimeoutIsConciseAndActionable(monkeypatch) -> None:
    """Confirm a Cloudflare HTML timeout becomes a concise operator action instead of raw markup."""

    class CloudflareTimeoutHttpClient:
        """Return an HTTPX response that raises the same 524 error sent by a Cloudflare gateway."""

        async def __aenter__(self) -> "CloudflareTimeoutHttpClient":
            """Return the fake client to the production request scope."""

            return self

        async def __aexit__(self, exceptionType, exceptionValue, tracebackValue) -> None:
            """Accept async-context cleanup arguments without suppressing the expected HTTP failure."""

            # The fake owns no connection after returning its deterministic response.
            del exceptionType, exceptionValue, tracebackValue

        async def post(self, requestUrl: str, *, headers: dict[str, str], json: dict[str, Any]) -> httpx.Response:
            """Return a Cloudflare-style HTML timeout response for the requested completion URL."""

            # Request metadata is accepted only to match the production call signature.
            del headers, json
            timeoutRequest = httpx.Request("POST", requestUrl)
            return httpx.Response(
                524,
                request=timeoutRequest,
                headers={"content-type": "text/html; charset=UTF-8"},
                text="<html><title>524: A timeout occurred</title><body>large gateway error page</body></html>",
            )

    def buildCloudflareTimeoutHttpClient(*args: Any, **kwargs: Any) -> CloudflareTimeoutHttpClient:
        """Return the 524 fake while accepting the production HTTP client constructor settings."""

        # Constructor arguments are irrelevant because the fake returns its fixed gateway response.
        del args, kwargs
        return CloudflareTimeoutHttpClient()

    monkeypatch.setattr(deepseek_client.httpx, "AsyncClient", buildCloudflareTimeoutHttpClient)
    # A direct key reaches the HTTP-status branch without reading or modifying runtime settings.
    providerClient = DeepSeekClient("cloudflare-timeout-test-key")

    async def runCloudflareTimeoutRequest() -> None:
        """Issue one request and assert the persisted failure text excludes raw gateway markup."""

        with pytest.raises(deepseek_client.DeepSeekApiError) as errorInfo:
            await providerClient.completeJson(
                "https://api.openai.example/v1",
                "gpt-reasoning-example",
                "system",
                "user",
                0.2,
            )
        errorMessage = str(errorInfo.value)
        assert "HTTP 524" in errorMessage
        assert "high 或 medium" in errorMessage
        assert "<html>" not in errorMessage

    asyncio.run(runCloudflareTimeoutRequest())


def testSettingsUpdateKeepsApiKeyOutOfSqliteAndResponse(monkeypatch, tmp_path) -> None:
    """Confirm a visual API-key update reaches only the in-memory store while settings remain persistable."""

    # The temporary repository makes the assertion independent from the local application's prior settings.
    temporaryRepository = StudioRepository(tmp_path / "problem_studio.sqlite3")
    initialSettings = RuntimeSettings(
        deepseekBaseUrl="https://api.deepseek.example",
        deepseekModel="deepseek-v4-pro",
        qojBaseUrl="http://qoj.example",
    )
    temporaryRepository.initialize(initialSettings)
    # The isolated credential store begins empty so the test can observe the update transition.
    temporaryCredentialStore = ProviderCredentialStore()
    monkeypatch.setattr(main, "studioRepository", temporaryRepository)
    monkeypatch.setattr(main, "providerCredentialStore", temporaryCredentialStore)
    settingsUpdate = RuntimeSettingsUpdateRequest(
        deepseekBaseUrl="https://api.openai.example/v1",
        deepseekModel="gpt-reasoning-example",
        reasoningEffort="medium",
        qojBaseUrl="http://qoj.example",
        apiKey="new-visual-api-key",
    )

    # The route is called directly so no web server or browser is needed for this security-boundary check.
    settingsResponse = asyncio.run(main.updateRuntimeSettings(settingsUpdate))
    persistedSettings = temporaryRepository.getRuntimeSettings()
    assert settingsResponse.apiKeyConfigured is True
    assert settingsResponse.reasoningEffort == "medium"
    assert temporaryCredentialStore.getApiKey() == "new-visual-api-key"
    assert "apiKey" not in settingsResponse.model_dump()
    assert "new-visual-api-key" not in persistedSettings.model_dump_json()


def testApiKeyUpdateRejectsSetAndClearInOneRequest() -> None:
    """Confirm the UI cannot accidentally submit contradictory replacement and clear actions together."""

    # The base values make the validation failure specifically about credential intent rather than endpoint syntax.
    with pytest.raises(ValueError, match="apiKey cannot be set"):
        RuntimeSettingsUpdateRequest(
            deepseekBaseUrl="https://api.openai.example/v1",
            deepseekModel="gpt-reasoning-example",
            qojBaseUrl="http://qoj.example",
            apiKey="new-visual-api-key",
            clearApiKey=True,
        )
