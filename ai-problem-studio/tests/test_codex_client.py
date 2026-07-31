"""Unit tests for the non-interactive Codex Agent subprocess contract."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from app import codex_client
from app.codex_client import CodexAgentClient
from app.provider_credentials import ProviderCredentialStore


class FakeCodexProcess:
    """Write one schema-valid final message while matching asyncio subprocess behavior."""

    def __init__(self, commandArguments: tuple[str, ...], capturedRequest: dict[str, Any]) -> None:
        """Keep command metadata and the shared request record supplied by the fake factory."""

        # The output path is a runtime temporary file passed to Codex CLI by the production adapter.
        outputPathIndex = commandArguments.index("--output-last-message") + 1
        self.outputPath = Path(commandArguments[outputPathIndex])
        # The request record lets assertions inspect the exact non-shell command and child environment.
        self.capturedRequest = capturedRequest
        # A zero code follows Codex's successful `codex exec` contract.
        self.returncode = 0

    async def communicate(self, promptBytes: bytes) -> tuple[bytes, bytes]:
        """Persist a final JSON object and return one minimal JSONL event stream."""

        # The prompt is recorded only in memory so the test can prove the API key never enters prompt content.
        self.capturedRequest["prompt"] = promptBytes.decode("utf-8")
        self.outputPath.write_text('{"result":"ok"}', encoding="utf-8")
        return b'{"type":"turn.completed"}\n', b""

    async def wait(self) -> None:
        """Match the subprocess wait method used only by the timeout cleanup branch."""

        return None

    def kill(self) -> None:
        """Match the subprocess kill method used only by the timeout cleanup branch."""

        self.capturedRequest["killed"] = True


class FakeAsyncInput:
    """Capture a prompt written through the streaming subprocess input path."""

    def __init__(self, capturedRequest: dict[str, Any]) -> None:
        """Keep the request record that receives prompt bytes and close state."""

        self.capturedRequest = capturedRequest

    def write(self, promptBytes: bytes) -> None:
        """Store prompt bytes written by the production stream consumer."""

        self.capturedRequest["prompt"] = promptBytes.decode("utf-8")

    async def drain(self) -> None:
        """Match asyncio StreamWriter drain behavior without waiting on an operating-system pipe."""

        return None

    def close(self) -> None:
        """Record that the one-turn prompt stream was closed."""

        self.capturedRequest["stdinClosed"] = True


class FakeAsyncOutput:
    """Yield a finite list of bytes through the async readline/read interface."""

    def __init__(self, outputLines: list[bytes]) -> None:
        """Store event lines in their production arrival order."""

        self.outputLines = outputLines

    async def readline(self) -> bytes:
        """Return one JSONL event or EOF after every event has been consumed."""

        return self.outputLines.pop(0) if self.outputLines else b""

    async def read(self) -> bytes:
        """Return an empty stderr body for the successful fake command."""

        return b""


class StreamingFakeCodexProcess:
    """Expose stdin/stdout/stderr streams to exercise live JSONL progress handling."""

    def __init__(self, commandArguments: tuple[str, ...], capturedRequest: dict[str, Any]) -> None:
        """Create streams and persist the final response at the requested output path."""

        outputPathIndex = commandArguments.index("--output-last-message") + 1
        Path(commandArguments[outputPathIndex]).write_text('{"result":"streamed"}', encoding="utf-8")
        self.stdin = FakeAsyncInput(capturedRequest)
        self.stdout = FakeAsyncOutput(
            [
                b'{"type":"thread.started"}\n',
                b'{"type":"item.completed","item":{"type":"reasoning"}}\n',
                b'{"type":"item.completed","item":{"type":"command_execution"}}\n',
            ]
        )
        self.stderr = FakeAsyncOutput([])
        self.returncode = 0

    async def wait(self) -> None:
        """Match the subprocess wait method after all output streams have reached EOF."""

        return None


def testCodexClientBuildsReadOnlyStructuredExecCommand(monkeypatch, tmp_path) -> None:
    """Confirm model settings and the process-local key reach Codex without shell interpolation."""

    # The captured record remains outside the fake process so assertions survive temporary-directory cleanup.
    capturedRequest: dict[str, Any] = {}

    def resolveFakeCodex(commandName: str) -> str:
        """Resolve the configured command to a deterministic fake executable path."""

        capturedRequest["commandName"] = commandName
        return "/usr/local/bin/codex"

    async def createFakeProcess(*commandArguments: str, **processOptions: Any) -> FakeCodexProcess:
        """Construct a fake process while recording command, environment, and working directory options."""

        capturedRequest["arguments"] = commandArguments
        capturedRequest["options"] = processOptions
        temporaryConfigPath = Path(processOptions["env"]["CODEX_HOME"]) / "config.toml"
        capturedRequest["temporaryConfig"] = temporaryConfigPath.read_text(encoding="utf-8")
        return FakeCodexProcess(commandArguments, capturedRequest)

    monkeypatch.setattr(codex_client.shutil, "which", resolveFakeCodex)
    monkeypatch.setattr(codex_client.asyncio, "create_subprocess_exec", createFakeProcess)
    credentialStore = ProviderCredentialStore("codex-test-key")
    providerClient = CodexAgentClient(credentialStore, workingDirectory=tmp_path)

    async def runRequest() -> None:
        """Issue one fake Codex turn using the same contract as the production LangGraph node."""

        resultPayload = await providerClient.completeJson(
            "https://api.openai.example/v1",
            "gpt-5.6",
            "system instruction",
            "user instruction",
            temperature=0.2,
            reasoningEffort="high",
        )
        assert resultPayload == {"result": "ok"}

    asyncio.run(runRequest())
    commandArguments = capturedRequest["arguments"]
    assert commandArguments[:4] == ("/usr/local/bin/codex", "exec", "--json", "--ephemeral")
    assert "--ignore-user-config" not in commandArguments
    assert "--disable" in commandArguments
    assert commandArguments[commandArguments.index("--disable") + 1] == "remote_plugin"
    assert "--sandbox" in commandArguments
    assert commandArguments[commandArguments.index("--sandbox") + 1] == "read-only"
    assert commandArguments[commandArguments.index("-m") + 1] == "gpt-5.6"
    assert "openai_base_url=\"https://api.openai.example/v1\"" in commandArguments
    assert 'model_reasoning_effort="high"' in commandArguments
    assert capturedRequest["options"]["cwd"] == tmp_path
    assert capturedRequest["options"]["env"]["CODEX_API_KEY"] == "codex-test-key"
    assert "CODEX_HOME" in capturedRequest["options"]["env"]
    assert "CODEX_SQLITE_HOME" in capturedRequest["options"]["env"]
    assert capturedRequest["options"]["env"]["RUST_LOG"] == "error"
    assert "remote_plugin = false" in capturedRequest["temporaryConfig"]
    assert "apps = false" in capturedRequest["temporaryConfig"]
    assert "hooks = false" in capturedRequest["temporaryConfig"]
    assert "codex-test-key" not in capturedRequest["prompt"]


def testCodexClientFallsBackToSavedCliAuthWhenApiKeyIsEmpty(monkeypatch, tmp_path) -> None:
    """Confirm an empty visual key leaves authentication to the configured Codex CLI login."""

    # The source login is isolated from the developer's real Codex home for deterministic credential-copy coverage.
    sourceHome = tmp_path / "saved-codex-home"
    sourceHome.mkdir()
    (sourceHome / "auth.json").write_text('{"OPENAI_API_KEY":"saved-test-key"}', encoding="utf-8")
    monkeypatch.setenv("CODEX_HOME", str(sourceHome))
    # The fake executable proves the process can start without an API key in the child environment.
    monkeypatch.setattr(codex_client.shutil, "which", lambda commandName: "/usr/local/bin/codex")
    capturedRequest: dict[str, Any] = {}

    async def createFakeProcess(*commandArguments: str, **processOptions: Any) -> FakeCodexProcess:
        """Construct a successful fake process while retaining environment evidence for this fallback test."""

        capturedRequest["arguments"] = commandArguments
        capturedRequest["options"] = processOptions
        temporaryAuthPath = Path(processOptions["env"]["CODEX_HOME"]) / "auth.json"
        capturedRequest["temporaryAuth"] = temporaryAuthPath.read_text(encoding="utf-8")
        return FakeCodexProcess(commandArguments, capturedRequest)

    monkeypatch.setattr(codex_client.asyncio, "create_subprocess_exec", createFakeProcess)
    providerClient = CodexAgentClient("")

    async def runRequest() -> None:
        """Issue one request and assert the Codex child receives no stale API-key environment value."""

        resultPayload = await providerClient.completeJson(
            "https://api.openai.example/v1",
            "gpt-5.6",
            "system",
            "user",
            temperature=0.2,
        )
        assert resultPayload == {"result": "ok"}
        assert "CODEX_API_KEY" not in capturedRequest["options"]["env"]
        assert capturedRequest["temporaryAuth"] == '{"OPENAI_API_KEY":"saved-test-key"}'

    asyncio.run(runRequest())


def testCodexClientSummarizesKnownStartupCacheErrors() -> None:
    """Confirm stale local Codex cache errors do not surface as opaque model failures."""

    # This direct-string client is sufficient because error classification does not access credentials or subprocesses.
    providerClient = CodexAgentClient("")

    errorMessage = providerClient._summarizeProcessError(
        "failed to load models cache: missing field `supports_reasoning_summaries`"
    )

    assert "模型缓存版本不兼容" in errorMessage


def testCodexClientKeepsTerminalErrorAfterStartupWarnings() -> None:
    """Confirm verbose plugin and cache logs cannot displace the actual model failure from the UI."""

    # The initial lines imitate the warnings emitted by an older desktop Codex state before a provider error.
    providerClient = CodexAgentClient("")
    stderrText = "\n".join(
        [
            "WARN codex_core_plugins::remote: remote plugin catalog unauthorized",
            "ERROR codex_models_manager::cache: missing field `supports_reasoning_summaries`",
            "ERROR provider request rejected: model is not available for this API key",
        ]
    )

    errorMessage = providerClient._summarizeProcessError(stderrText)

    assert errorMessage == "ERROR provider request rejected: model is not available for this API key"


def testCodexClientForwardsJsonlEventsAsLiveProgress(monkeypatch, tmp_path) -> None:
    """Confirm Codex Agent events become deduplicated phase updates while the process is still running."""

    # The callback list models the repository-backed SSE progress callback used by the production job worker.
    progressEvents: list[tuple[str, str, str]] = []
    capturedRequest: dict[str, Any] = {}

    monkeypatch.setattr(codex_client.shutil, "which", lambda commandName: "/usr/local/bin/codex")

    async def createStreamingProcess(*commandArguments: str, **processOptions: Any) -> StreamingFakeCodexProcess:
        """Construct a streaming fake while accepting the production subprocess options."""

        del processOptions
        return StreamingFakeCodexProcess(commandArguments, capturedRequest)

    monkeypatch.setattr(codex_client.asyncio, "create_subprocess_exec", createStreamingProcess)
    providerClient = CodexAgentClient("streaming-test-key", workingDirectory=tmp_path)

    async def recordProgress(phase: str, level: str, message: str) -> None:
        """Retain each live event exactly as the FastAPI progress callback receives it."""

        progressEvents.append((phase, level, message))

    async def runRequest() -> None:
        """Issue one streaming fake turn and assert its final JSON and progress messages."""

        resultPayload = await providerClient.completeJson(
            "https://api.openai.example/v1",
            "gpt-5.6",
            "system",
            "user",
            temperature=0.2,
            progressCallback=recordProgress,
            progressPhase="candidate",
        )
        assert resultPayload == {"result": "streamed"}

    asyncio.run(runRequest())
    assert capturedRequest["stdinClosed"] is True
    assert [event[0] for event in progressEvents] == ["candidate", "candidate", "candidate"]
    assert [event[1] for event in progressEvents] == ["INFO", "INFO", "INFO"]
    assert progressEvents[0][2] == "Codex Agent 已建立任务会话"
    assert progressEvents[1][2] == "Codex Agent 正在分析题目约束与算法一致性"
    assert progressEvents[2][2] == "Codex Agent 正在执行只读分析工具"
