"""Application configuration loaded from environment variables without persisting secrets."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class AppSettings:
    """Immutable process settings shared by API, agent, persistence, and runner services."""

    # The path that contains this standalone project and its runtime data directory.
    projectDirectory: Path
    # The secret passed only to the Codex Agent child process through CODEX_API_KEY.
    codexApiKey: str
    # The initial OpenAI-compatible Responses endpoint shown before a user changes runtime settings.
    codexBaseUrl: str
    # The initial Codex model identifier shown before a user changes runtime settings.
    codexModel: str
    # The executable used to launch Codex CLI non-interactively.
    codexCommand: str
    # The initial QOJ endpoint shown before a user changes runtime settings.
    qojBaseUrl: str
    # The Docker image containing the C++17 compiler and runtime.
    referenceRunnerImage: str
    # The maximum wall-clock duration for each Docker compilation or program run.
    referenceRunnerTimeoutSeconds: int
    # The maximum memory exposed to the generated reference solution container.
    referenceRunnerMemoryMb: int

    @property
    def databasePath(self) -> Path:
        """Return the SQLite path used for non-secret jobs, reviews, and endpoint settings."""

        # The directory that holds local runtime state separate from application source.
        dataDirectory = self.projectDirectory / "data"
        dataDirectory.mkdir(parents=True, exist_ok=True)
        # The SQLite file that intentionally excludes provider keys and QOJ tokens.
        databaseFile = dataDirectory / "problem_studio.sqlite3"
        return databaseFile


@lru_cache(maxsize=1)
def getSettings() -> AppSettings:
    """Load validated process settings once so all components share the same defaults."""

    # The project root resolved from this module's package location.
    projectDirectory = Path(__file__).resolve().parent.parent
    # The optional dotenv file makes local configuration explicit and keeps secrets out of Git.
    dotenvPath = projectDirectory / ".env"
    # `dotenv_path` is the third-party library's public parameter name; project-owned names remain camelCase.
    load_dotenv(dotenv_path=dotenvPath)
    # Codex's dedicated name is preferred, while prior generic and DeepSeek names remain compatibility fallbacks.
    codexApiKey = (
        os.getenv("CODEX_API_KEY", "").strip()
        or os.getenv("MODEL_API_KEY", "").strip()
        or os.getenv("DEEPSEEK_API_KEY", "").strip()
    )
    # Codex uses the OpenAI-compatible Responses API; older endpoint variables remain readable for migration.
    codexBaseUrl = (
        os.getenv("CODEX_BASE_URL", "").strip()
        or os.getenv("DEEPSEEK_BASE_URL", "").strip()
        or "https://api.openai.com/v1"
    )
    # A Codex-compatible model can still be overridden by the previous DeepSeek model variable.
    codexModel = os.getenv("CODEX_MODEL", "").strip() or os.getenv("DEEPSEEK_MODEL", "").strip() or "gpt-5.6"
    # The executable can be pinned in a deployment image while local development uses PATH resolution.
    codexCommand = os.getenv("CODEX_COMMAND", "codex").strip() or "codex"
    # The supplied QOJ host is the default, while the UI can change it later.
    qojBaseUrl = os.getenv("QOJ_BASE_URL", "http://124.221.91.212").strip()
    # The compiler image stays configurable for private registries or pinned versions.
    referenceRunnerImage = os.getenv("REFERENCE_RUNNER_IMAGE", "gcc:13").strip()
    # The parse fallback prevents an invalid environment value from crashing configuration load.
    referenceRunnerTimeoutSeconds = int(os.getenv("REFERENCE_RUNNER_TIMEOUT_SECONDS", "5"))
    # The memory budget constrains untrusted generated C++ execution.
    referenceRunnerMemoryMb = int(os.getenv("REFERENCE_RUNNER_MEMORY_MB", "512"))
    return AppSettings(
        projectDirectory=projectDirectory,
        codexApiKey=codexApiKey,
        codexBaseUrl=codexBaseUrl,
        codexModel=codexModel,
        codexCommand=codexCommand,
        qojBaseUrl=qojBaseUrl,
        referenceRunnerImage=referenceRunnerImage,
        referenceRunnerTimeoutSeconds=referenceRunnerTimeoutSeconds,
        referenceRunnerMemoryMb=referenceRunnerMemoryMb,
    )
