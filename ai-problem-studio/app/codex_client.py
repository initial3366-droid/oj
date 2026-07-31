"""Codex CLI adapter for structured, non-interactive problem-generation agent calls."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Awaitable, Callable

from .provider_credentials import ProviderCredentialStore


ProgressCallback = Callable[[str, str, str], Awaitable[None]]


class CodexAgentError(RuntimeError):
    """Describe a Codex Agent process or structured-output failure without exposing credentials."""


class CodexAgentClient:
    """Run one read-only Codex Agent turn and return its schema-constrained JSON response."""

    def __init__(
        self,
        apiKey: str | ProviderCredentialStore,
        codexCommand: str = "codex",
        workingDirectory: Path | None = None,
    ) -> None:
        """Configure the process-local credential source, Codex executable, workspace, and five-minute limit."""

        # The credential source is resolved immediately before each process so visual updates apply without restart.
        self.apiKey = apiKey
        # The command is configurable for virtual environments, CI images, and pinned Codex installations.
        self.codexCommand = codexCommand.strip() or "codex"
        # Read-only project context lets Codex inspect applicable guidance without modifying the QOJ repository.
        self.workingDirectory = workingDirectory or Path.cwd()
        # A complete problem candidate can contain code, tests, and long Markdown; this is the local outer limit.
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
        progressPhase: str = "codex-agent",
    ) -> dict[str, Any]:
        """Run one Codex Agent turn with a JSON-object contract compatible with the LangGraph nodes."""

        # The temperature remains part of the shared client contract; Codex controls reasoning rather than sampling.
        del temperature
        # Codex exec uses a dedicated environment variable when supplied; otherwise it may use its saved CLI login.
        apiKey = self._currentApiKey()
        # A missing executable is a local installation problem, not a model response failure.
        codexExecutable = self._resolveCodexExecutable()
        # The prompt preserves the existing system/user separation while making the Codex tool boundary explicit.
        agentPrompt = self._buildAgentPrompt(systemPrompt, userPrompt)
        with tempfile.TemporaryDirectory(prefix="ai-problem-studio-codex-") as temporaryDirectory:
            # The schema is intentionally object-only; each LangGraph node validates its own stricter Pydantic shape.
            schemaPath = Path(temporaryDirectory) / "output-schema.json"
            schemaPath.write_text(
                json.dumps(
                    {"type": "object", "additionalProperties": True},
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            # Codex writes its final answer separately from JSONL progress events, avoiding fragile stdout scraping.
            outputPath = Path(temporaryDirectory) / "last-message.json"
            commandArguments = self._buildCommand(
                codexExecutable,
                baseUrl,
                modelName,
                schemaPath,
                outputPath,
                reasoningEffort,
            )
            # A fresh state root prevents a stale user model cache or plugin catalog from affecting this job.
            processEnvironment = os.environ.copy()
            codexHomePath = Path(temporaryDirectory) / "codex-home"
            codexHomePath.mkdir()
            self._writeIsolatedCodexConfig(codexHomePath)
            self._copySavedAuthIfNeeded(codexHomePath, apiKey)
            processEnvironment["CODEX_HOME"] = str(codexHomePath)
            processEnvironment["CODEX_SQLITE_HOME"] = str(codexHomePath)
            # Startup warnings from the desktop application are not relevant to a headless generation turn.
            processEnvironment["RUST_LOG"] = "error"
            # Only the Codex child process receives the visual key; an empty store falls back to copied CLI auth.
            if apiKey:
                processEnvironment["CODEX_API_KEY"] = apiKey
            else:
                # Clearing an in-memory key must not accidentally inherit an older process environment value.
                processEnvironment.pop("CODEX_API_KEY", None)
            try:
                # No shell is involved, so the configured URL/model cannot become executable command syntax.
                process = await asyncio.create_subprocess_exec(
                    *commandArguments,
                    cwd=self.workingDirectory,
                    env=processEnvironment,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                if progressCallback is None:
                    # Direct unit callers can use the compact communicate path without needing stream fakes.
                    processResult = process.communicate(agentPrompt.encode("utf-8"))
                else:
                    # Production jobs consume JSONL events as they arrive so SSE progress stays live during reasoning.
                    processResult = self._communicateWithProgress(process, agentPrompt.encode("utf-8"), progressCallback, progressPhase)
                stdoutBytes, stderrBytes = await asyncio.wait_for(processResult, timeout=self.requestTimeoutSeconds)
            except asyncio.TimeoutError as error:
                # Termination prevents a timed-out Codex child from continuing to spend model/API resources.
                process.kill()
                await process.wait()
                raise CodexAgentError(
                    f"Codex Agent 执行超时：已等待 {int(self.requestTimeoutSeconds)} 秒，请检查模型响应或 API 网关"
                ) from error
            except OSError as error:
                # The exception class remains visible while paths and credentials stay out of the user-facing error.
                errorType = type(error).__name__
                errorDetail = str(error).strip() or "未提供额外错误信息"
                raise CodexAgentError(f"Codex Agent 进程无法启动（{errorType}）：{errorDetail}") from error
            if process.returncode != 0:
                # Codex can emit startup warnings before the terminal provider error, so summarize the complete tail.
                stderrText = stderrBytes.decode("utf-8", errors="replace").strip()
                errorDetail = self._summarizeProcessError(stderrText)
                raise CodexAgentError(
                    f"Codex Agent 执行失败（退出码 {process.returncode}）：{errorDetail}"
                )
            # The final message file is the stable contract; JSONL stdout remains available only for diagnostics.
            del stdoutBytes
            if not outputPath.exists():
                raise CodexAgentError("Codex Agent 未生成最终结构化响应")
            responseText = outputPath.read_text(encoding="utf-8").strip()
        if not responseText:
            raise CodexAgentError("Codex Agent 返回了空响应")
        return self._parseJsonObject(responseText)

    async def _communicateWithProgress(
        self,
        process: asyncio.subprocess.Process,
        promptBytes: bytes,
        progressCallback: ProgressCallback,
        progressPhase: str,
    ) -> tuple[bytes, bytes]:
        """Write the prompt, consume Codex JSONL events, and return complete stdout/stderr after process exit."""

        # The stdin stream is closed after one prompt because each Codex exec invocation represents one bounded turn.
        if process.stdin is None or process.stdout is None or process.stderr is None:
            raise CodexAgentError("Codex Agent 进程缺少可用的标准输入输出管道")
        process.stdin.write(promptBytes)
        await process.stdin.drain()
        process.stdin.close()
        stdoutChunks: list[bytes] = []
        lastProgressMessage = ""
        while True:
            outputLine = await process.stdout.readline()
            if not outputLine:
                break
            stdoutChunks.append(outputLine)
            progressMessage = self._progressMessageFromJsonLine(outputLine)
            if progressMessage and progressMessage != lastProgressMessage:
                await progressCallback(progressPhase, "INFO", progressMessage)
                lastProgressMessage = progressMessage
        stderrBytes = await process.stderr.read()
        await process.wait()
        return b"".join(stdoutChunks), stderrBytes

    def _progressMessageFromJsonLine(self, outputLine: bytes) -> str:
        """Map one Codex JSONL event to a short human-readable progress message or an empty string."""

        # Malformed diagnostic lines are ignored because the final output file remains the structured contract.
        try:
            eventPayload = json.loads(outputLine.decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            return ""
        if not isinstance(eventPayload, dict):
            return ""
        # Thread and turn events prove the external Agent is alive without exposing its internal transcript.
        eventType = eventPayload.get("type")
        if eventType == "thread.started":
            return "Codex Agent 已建立任务会话"
        if eventType == "turn.started":
            return "Codex Agent 已开始推理"
        # Item events distinguish read-only tool use from model reasoning in the visible task timeline.
        itemPayload = eventPayload.get("item")
        itemType = itemPayload.get("type") if isinstance(itemPayload, dict) else None
        if itemType == "command_execution":
            return "Codex Agent 正在执行只读分析工具"
        if itemType == "reasoning":
            return "Codex Agent 正在分析题目约束与算法一致性"
        if itemType == "agent_message":
            return "Codex Agent 正在整理结构化题目响应"
        return ""

    def _currentApiKey(self) -> str:
        """Resolve the active process-only credential while retaining direct-string test compatibility."""

        # The store is production-safe; a direct string keeps subprocess behavior unit-testable without global state.
        if isinstance(self.apiKey, ProviderCredentialStore):
            return self.apiKey.getApiKey()
        return self.apiKey.strip()

    def _copySavedAuthIfNeeded(self, codexHomePath: Path, apiKey: str) -> None:
        """Copy only the existing CLI auth file into the temporary state root when no UI key is configured."""

        # An explicit UI key is injected directly, so copying a second credential is unnecessary.
        if apiKey:
            return
        # CODEX_HOME may already point at a non-default login directory used by a deployment or shell profile.
        configuredHome = os.getenv("CODEX_HOME", "").strip()
        sourceHome = Path(configuredHome).expanduser() if configuredHome else Path.home() / ".codex"
        sourceAuthPath = sourceHome / "auth.json"
        # Keyring-backed logins need no file copy; a file-backed login is copied only for this child lifetime.
        if sourceAuthPath.is_file():
            shutil.copy2(sourceAuthPath, codexHomePath / "auth.json")

    def _writeIsolatedCodexConfig(self, codexHomePath: Path) -> None:
        """Write the minimal per-job Codex configuration before the CLI initializes plugins or integrations."""

        # This configuration is intentionally limited to capabilities the problem agent does not need.
        configPath = codexHomePath / "config.toml"
        configPath.write_text(
            "[features]\n"
            "remote_plugin = false\n"
            "apps = false\n"
            "hooks = false\n",
            encoding="utf-8",
        )

    def _summarizeProcessError(self, stderrText: str) -> str:
        """Preserve the terminal Codex failure while removing known non-fatal startup diagnostics."""

        # A provider error is usually printed after verbose startup logs, so keep the meaningful tail instead of the head.
        meaningfulLines = [
            errorLine
            for errorLine in stderrText.splitlines()
            if not self._isKnownStartupDiagnostic(errorLine)
        ]
        if meaningfulLines:
            return "\n".join(meaningfulLines)[-2000:]
        # This field was added to the model cache after older CLI versions; an isolated home normally avoids it.
        if "supports_reasoning_summaries" in stderrText:
            return "Codex 本地模型缓存版本不兼容；请确认服务已重启后再执行任务"
        # API-key runs cannot use the ChatGPT-only remote plugin catalog; it is now disabled for each job.
        if "remote plugin" in stderrText.lower() or "plugin" in stderrText.lower():
            return "Codex 在启动阶段退出，远程插件诊断已被隔离；请检查 API 地址、模型名称和访问令牌"
        return "未提供额外错误信息"

    def _isKnownStartupDiagnostic(self, errorLine: str) -> bool:
        """Identify warnings that must not hide the later provider or authentication failure."""

        # These diagnostics arise from the desktop Codex state and do not describe the requested model turn itself.
        ignoredFragments = (
            "codex_core_plugins::remote",
            "remote featured plugin request",
            "chatgpt authentication required for remote plugin catalog",
            "codex_models_manager::cache: failed to load models cache",
            "supports_reasoning_summaries",
            "codex_core_skills::loader",
            "codex_core_plugins::manifest: ignoring",
            "codex_rollout::list: state db discrepancy",
        )
        normalizedLine = errorLine.lower()
        return any(ignoredFragment in normalizedLine for ignoredFragment in ignoredFragments)

    def _resolveCodexExecutable(self) -> str:
        """Resolve a configured executable or fail with an installation-oriented message."""

        # Absolute paths and PATH names are both supported by Codex CLI installations.
        resolvedExecutable = shutil.which(self.codexCommand)
        if resolvedExecutable:
            return resolvedExecutable
        raise CodexAgentError(
            f"找不到 Codex CLI：{self.codexCommand}。请安装 Codex CLI，或在 CODEX_COMMAND 中配置可执行文件路径"
        )

    def _buildCommand(
        self,
        codexExecutable: str,
        baseUrl: str,
        modelName: str,
        schemaPath: Path,
        outputPath: Path,
        reasoningEffort: str | None,
    ) -> list[str]:
        """Build a shell-free Codex exec command with read-only sandbox and runtime provider settings."""

        # JSON quoting produces valid TOML string values for Codex's repeated --config option.
        quotedBaseUrl = json.dumps(baseUrl.strip().rstrip("/"), ensure_ascii=False)
        commandArguments = [
            codexExecutable,
            "exec",
            "--json",
            "--ephemeral",
            "--disable",
            "remote_plugin",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--output-schema",
            str(schemaPath),
            "--output-last-message",
            str(outputPath),
            "-C",
            str(self.workingDirectory),
            "-m",
            modelName,
            "-c",
            f"approval_policy=\"never\"",
            "-c",
            f"openai_base_url={quotedBaseUrl}",
        ]
        # `none` means use the model default in the existing UI and is not passed as a Codex override.
        if reasoningEffort and reasoningEffort != "none":
            commandArguments.extend(["-c", f"model_reasoning_effort={json.dumps(reasoningEffort)}"])
        # A dash makes Codex read the complete combined prompt from stdin instead of shell argument parsing.
        commandArguments.append("-")
        return commandArguments

    def _buildAgentPrompt(self, systemPrompt: str, userPrompt: str) -> str:
        """Combine phase instructions into one Codex prompt while prohibiting repository and QOJ mutations."""

        # The outer contract prevents a coding agent from treating generated problem content as a file-edit request.
        return (
            "You are the Codex Agent inside a competitive-programming problem generation service. "
            "Use read-only tools only when they improve reasoning; do not modify files, call QOJ, or create external side effects. "
            "Return exactly one JSON object matching the requested phase contract, with no Markdown fence or explanatory prose.\n\n"
            "System instructions:\n"
            f"{systemPrompt}\n\n"
            "Task instructions:\n"
            f"{userPrompt}"
        )

    def _parseJsonObject(self, responseText: str) -> dict[str, Any]:
        """Parse the final Codex message as one JSON object and reject prose or non-object values."""

        # A defensive fence cleanup handles a provider that wraps a valid output despite the explicit contract.
        normalizedText = responseText.strip()
        if normalizedText.startswith("```") and normalizedText.endswith("```"):
            fencedLines = normalizedText.splitlines()
            normalizedText = "\n".join(fencedLines[1:-1]).strip()
        try:
            # JSON decoding keeps schema validation in the existing LangGraph node boundary.
            parsedValue = json.loads(normalizedText)
        except json.JSONDecodeError as error:
            raise CodexAgentError("Codex Agent 最终响应不是有效 JSON") from error
        if not isinstance(parsedValue, dict):
            raise CodexAgentError("Codex Agent JSON 响应必须是对象")
        return parsedValue
