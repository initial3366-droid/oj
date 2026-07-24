"""Short-lived server-side QOJ sessions protected by an opaque HttpOnly browser cookie."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from threading import RLock


@dataclass(frozen=True)
class QojSession:
    """Represent one in-memory QOJ token pair without exposing it to browser JavaScript or SQLite."""

    # The random cookie value maps a browser to its transient server-side token record.
    sessionId: str
    # The current QOJ bearer token remains in this backend process only.
    accessToken: str
    # A login-derived refresh token is optional because manually pasted access tokens cannot be rotated.
    refreshToken: str | None
    # The QOJ host is fixed when the session is created so later exports cannot mix credentials and servers.
    qojBaseUrl: str
    # The backend refuses to use an abandoned session even if the browser still presents its cookie.
    expiresAt: datetime


class QojSessionStore:
    """Keep bounded, process-local QOJ sessions safe across page refreshes but not service restarts."""

    def __init__(self, lifetime: timedelta = timedelta(hours=8)) -> None:
        """Create an empty synchronized store with a finite login lifetime."""

        # The lifetime bounds the impact of an unattended local browser session.
        self.lifetime = lifetime
        # The lock protects session replacement during concurrent verify, refresh, and export requests.
        self._lock = RLock()
        # The dictionary intentionally remains process-local and is never serialized to disk.
        self._sessions: dict[str, QojSession] = {}

    def create(self, accessToken: str, refreshToken: str | None, qojBaseUrl: str) -> QojSession:
        """Create one opaque session ID for an already authenticated QOJ token pair."""

        # A cryptographically random ID prevents a browser from deriving any QOJ credential from the cookie value.
        sessionId = token_urlsafe(32)
        # A normalized host avoids duplicate session variants caused by a trailing slash.
        normalizedBaseUrl = qojBaseUrl.strip().rstrip("/")
        # The expiry is generated only by the server so a browser cannot extend its own session.
        expiresAt = datetime.now(UTC) + self.lifetime
        session = QojSession(
            sessionId=sessionId,
            accessToken=accessToken,
            refreshToken=refreshToken,
            qojBaseUrl=normalizedBaseUrl,
            expiresAt=expiresAt,
        )
        with self._lock:
            # Expired records are removed whenever the store is touched to keep memory bounded.
            self._purgeExpiredLocked()
            self._sessions[sessionId] = session
        return session

    def get(self, sessionId: str | None) -> QojSession | None:
        """Return one active session or remove and reject an expired or unknown cookie value."""

        if not sessionId:
            return None
        with self._lock:
            # Expired records are never returned to a caller, including an export route.
            self._purgeExpiredLocked()
            return self._sessions.get(sessionId)

    def replaceTokens(
        self,
        sessionId: str,
        accessToken: str,
        refreshToken: str | None,
    ) -> QojSession | None:
        """Store a refreshed token pair and extend the finite server-side session lifetime."""

        with self._lock:
            # A refresh cannot revive a session that has already expired or been explicitly removed.
            self._purgeExpiredLocked()
            currentSession = self._sessions.get(sessionId)
            if currentSession is None:
                return None
            refreshedSession = QojSession(
                sessionId=currentSession.sessionId,
                accessToken=accessToken,
                refreshToken=refreshToken,
                qojBaseUrl=currentSession.qojBaseUrl,
                expiresAt=datetime.now(UTC) + self.lifetime,
            )
            self._sessions[sessionId] = refreshedSession
            return refreshedSession

    def remove(self, sessionId: str | None) -> None:
        """Discard a session after expiry, explicit logout, or an unrecoverable QOJ authentication failure."""

        if not sessionId:
            return
        with self._lock:
            self._sessions.pop(sessionId, None)

    def _purgeExpiredLocked(self) -> None:
        """Remove every record whose server-generated expiry has passed while the lock is held."""

        # A copy of the IDs avoids mutating the dictionary while iterating over its live view.
        currentTime = datetime.now(UTC)
        expiredSessionIds = [
            sessionId
            for sessionId, session in self._sessions.items()
            if session.expiresAt <= currentTime
        ]
        for sessionId in expiredSessionIds:
            self._sessions.pop(sessionId, None)
