"""Focused tests for refresh-safe, server-side QOJ session handling."""

import asyncio

from fastapi import Response
from starlette.requests import Request

from app import main
from app.models import QojLoginRequest
from app.qoj_session import QojSessionStore


class FakeQojSessionClient:
    """Provide a deterministic QOJ login/profile adapter without retaining a real credential in a test."""

    def __init__(self) -> None:
        """Initialize the profile-call counter used to prove login and refresh restoration both verify QOJ."""

        # The counter provides evidence that the restored browser session was independently checked.
        self.profileCallCount = 0

    async def loginTeacher(
        self,
        qojBaseUrl: str,
        username: str,
        password: str,
        captchaId: str,
        captcha: str,
    ) -> dict[str, str]:
        """Return disposable tokens while accepting the production login contract."""

        # The fake consumes all sensitive-looking test values so the signature stays aligned with the real client.
        del qojBaseUrl, username, password, captchaId, captcha
        return {"accessToken": "server-only-access", "refreshToken": "server-only-refresh"}

    async def verifyTeacherSession(self, qojBaseUrl: str, accessToken: str) -> dict[str, str]:
        """Return the same teacher profile for both initial login validation and page-refresh restoration."""

        # The assertions prove that only the server-side session store supplies the access token after refresh.
        assert qojBaseUrl == "http://qoj.example"
        assert accessToken == "server-only-access"
        self.profileCallCount += 1
        return {"username": "ai_problem_teacher"}


def buildRequest(cookieHeader: str = "") -> Request:
    """Create the minimum HTTP request object needed to exercise cookie-backed route functions directly."""

    # Headers remain byte pairs because Starlette's low-level ASGI request contract uses bytes.
    requestHeaders = [(b"host", b"testserver")]
    if cookieHeader:
        requestHeaders.append((b"cookie", cookieHeader.encode("ascii")))
    requestScope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/qoj/session",
        "raw_path": b"/api/qoj/session",
        "query_string": b"",
        "headers": requestHeaders,
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }
    return Request(requestScope)


def testQojLoginCreatesHttpOnlySessionThatSurvivesRefresh(monkeypatch) -> None:
    """Confirm browser refresh restoration uses an opaque cookie rather than returning QOJ tokens to JavaScript."""

    # The test-local store prevents a request from observing any developer login state from the running app.
    isolatedSessionStore = QojSessionStore()
    fakeQojClient = FakeQojSessionClient()
    monkeypatch.setattr(main, "qojSessionStore", isolatedSessionStore)
    monkeypatch.setattr(main, "qojClient", fakeQojClient)
    loginRequest = QojLoginRequest(
        username="ai_problem_teacher",
        password="unused-test-password",
        captchaId="captcha-1",
        captcha="1234",
        qojBaseUrl="http://qoj.example",
    )

    async def runSessionFlow() -> None:
        """Log in once, read the opaque cookie, then restore the session through a fresh request object."""

        loginResponse = Response()
        loginPayload = await main.loginQojTeacher(loginRequest, buildRequest(), loginResponse)
        assert loginPayload == {
            "profile": {"username": "ai_problem_teacher"},
            "qojBaseUrl": "http://qoj.example",
        }
        # The Set-Cookie header contains only an opaque ID, never either QOJ token value.
        setCookieHeader = loginResponse.headers["set-cookie"]
        assert "HttpOnly" in setCookieHeader
        assert "server-only-access" not in setCookieHeader
        assert "server-only-refresh" not in setCookieHeader
        cookieHeader = setCookieHeader.split(";", maxsplit=1)[0]
        restoredPayload = await main.getQojSession(buildRequest(cookieHeader))
        assert restoredPayload == loginPayload
        assert fakeQojClient.profileCallCount == 2

    asyncio.run(runSessionFlow())
