"""Thread-safe, process-local storage for the active model-provider API key."""

from __future__ import annotations

from threading import RLock


class ProviderCredentialStore:
    """Keep one mutable API key in backend memory without writing it to SQLite or browser storage."""

    def __init__(self, initialApiKey: str = "") -> None:
        """Initialize the store from an optional environment-provided API key."""

        # The lock serializes settings updates with concurrent agent completion requests.
        self._lock = RLock()
        # The initial key is normalized once and remains private to this process.
        self._apiKey = initialApiKey.strip()

    def getApiKey(self) -> str:
        """Return the current API key only for constructing an outbound provider authorization header."""

        with self._lock:
            # Strings are immutable, so the returned value cannot mutate the stored credential.
            return self._apiKey

    def setApiKey(self, apiKey: str) -> None:
        """Replace the current API key after the local settings endpoint validates it."""

        with self._lock:
            # Whitespace is never useful in a bearer key and is removed before retention.
            self._apiKey = apiKey.strip()

    def clearApiKey(self) -> None:
        """Remove the currently active in-memory API key without touching environment files."""

        with self._lock:
            # An empty string causes the provider client to fail before issuing any external request.
            self._apiKey = ""

    def isConfigured(self) -> bool:
        """Report whether a usable key exists without revealing any part of it."""

        with self._lock:
            # The boolean is safe for the browser settings response and UI status badge.
            return bool(self._apiKey)
