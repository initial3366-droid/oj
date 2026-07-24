"""HTTP adapter for QOJ authentication, CAPTCHA, refresh, and immutable DRAFT-only export."""

from __future__ import annotations

from typing import Any

import httpx

from .models import GeneratedProblemCandidate, QojExportRequest, VerificationReport


class QojApiError(RuntimeError):
    """Describe a QOJ API failure with status and message while excluding bearer tokens from text."""


class QojClient:
    """Call QOJ's public HTTP API without importing, querying, or modifying QOJ source or database state."""

    async def getCaptcha(self, qojBaseUrl: str) -> dict[str, Any]:
        """Fetch the QOJ teacher-login CAPTCHA image and identifier for human completion in the browser."""

        # The QOJ captcha endpoint is public and returns an ApiResponse data object.
        captchaPayload = await self._request("GET", qojBaseUrl, "/api/v1/captcha/image")
        return captchaPayload

    async def loginTeacher(
        self,
        qojBaseUrl: str,
        username: str,
        password: str,
        captchaId: str,
        captcha: str,
    ) -> dict[str, Any]:
        """Authenticate the dedicated AI teacher account and return tokens without persisting them."""

        # The request body is forwarded once to QOJ and never included in job persistence.
        loginPayload = {
            "username": username,
            "password": password,
            "captchaId": captchaId,
            "captcha": captcha,
        }
        # Teacher login produces the role capable of creating a QOJ problem draft.
        tokenPayload = await self._request(
            "POST",
            qojBaseUrl,
            "/api/teacher/v1/auth/login",
            jsonBody=loginPayload,
        )
        return tokenPayload

    async def refreshAccessToken(self, qojBaseUrl: str, refreshToken: str) -> dict[str, Any]:
        """Rotate a browser-memory QOJ refresh token through QOJ's standard refresh endpoint."""

        # The refresh body contains a secret but is not logged or written to SQLite.
        refreshPayload = {"refreshToken": refreshToken}
        # QOJ returns a new access token and a rotated refresh token.
        tokenPayload = await self._request(
            "POST",
            qojBaseUrl,
            "/api/v1/auth/refresh",
            jsonBody=refreshPayload,
        )
        return tokenPayload

    async def verifyTeacherSession(self, qojBaseUrl: str, accessToken: str) -> dict[str, Any]:
        """Check that the supplied token is a valid QOJ teacher session before an export attempt."""

        # The teacher profile endpoint verifies authentication without changing QOJ state.
        profilePayload = await self._request(
            "GET",
            qojBaseUrl,
            "/api/teacher/v1/me",
            accessToken=accessToken,
        )
        return profilePayload

    async def exportDraft(
        self,
        qojBaseUrl: str,
        accessToken: str,
        exportRequest: QojExportRequest,
        candidate: GeneratedProblemCandidate,
        referenceReport: VerificationReport,
    ) -> dict[str, Any]:
        """Create, populate, and commit a QOJ problem while hard-coding a non-public DRAFT state."""

        if referenceReport.status != "PASSED":
            raise QojApiError("Reference verification must pass before QOJ export")
        if len(referenceReport.verifiedSamples) != len(candidate.samples):
            raise QojApiError("Verified sample count does not match the generated candidate")
        if not referenceReport.verifiedTestCases:
            raise QojApiError("No verified hidden test cases are available for QOJ export")
        # This read-only request catches expired or wrong-role tokens before QOJ creates a draft.
        await self.verifyTeacherSession(qojBaseUrl, accessToken)
        # The draft ID is scoped to the authenticated QOJ account and expires according to QOJ policy.
        draftPayload = await self._request(
            "POST",
            qojBaseUrl,
            "/api/admin/v1/problem-drafts",
            accessToken=accessToken,
            jsonBody={},
        )
        # QOJ returns the draft ID in the standardized ApiResponse data object.
        draftId = draftPayload.get("draftId")
        if not isinstance(draftId, str) or not draftId:
            raise QojApiError("QOJ did not return a usable problem draft ID")
        # QOJ samples always use outputs calculated by the compiled standard solution.
        qojSamples = [
            {
                "input": candidateSample.input,
                "output": verifiedSample.output,
                "explanation": candidateSample.explanationMarkdown,
            }
            for candidateSample, verifiedSample in zip(candidate.samples, referenceReport.verifiedSamples, strict=True)
        ]
        # The explicit DRAFT flags prevent QOJ's legacy default from publishing a newly created problem.
        basicPayload = {
            "title": exportRequest.title.strip() if exportRequest.title and exportRequest.title.strip() else candidate.title,
            "timeLimit": candidate.timeLimit,
            "memoryLimit": candidate.memoryLimit,
            "statement": candidate.statementMarkdown,
            "inputFormat": candidate.inputFormatMarkdown,
            "outputFormat": candidate.outputFormatMarkdown,
            "tags": candidate.tags,
            "difficulty": candidate.difficulty,
            "folderId": exportRequest.folderId,
            "isPublic": False,
            "accessScope": exportRequest.accessScope,
            "majorId": exportRequest.majorId if exportRequest.accessScope == "MAJOR" else None,
            "studentPublishStatus": "DRAFT",
            "samples": qojSamples,
        }
        await self._request(
            "PUT",
            qojBaseUrl,
            f"/api/admin/v1/problem-drafts/{draftId}/basic",
            accessToken=accessToken,
            jsonBody=basicPayload,
        )
        # Every hidden expected output originates from an isolated reference program execution.
        qojTestCases = [
            {"caseNo": verifiedCase.caseNo, "input": verifiedCase.input, "output": verifiedCase.output}
            for verifiedCase in referenceReport.verifiedTestCases
        ]
        await self._request(
            "PUT",
            qojBaseUrl,
            f"/api/admin/v1/problem-drafts/{draftId}/test-cases",
            accessToken=accessToken,
            jsonBody={"testCases": qojTestCases},
        )
        # Commit creates the QOJ problem under the AI account while the explicit basic flags retain DRAFT status.
        problemPayload = await self._request(
            "POST",
            qojBaseUrl,
            f"/api/admin/v1/problem-drafts/{draftId}/commit",
            accessToken=accessToken,
            jsonBody={},
        )
        # The return payload records QOJ identifiers for the human audit trail.
        exportResult = {"draftId": draftId, "problem": problemPayload, "publishStatus": "DRAFT"}
        return exportResult

    async def _request(
        self,
        method: str,
        qojBaseUrl: str,
        path: str,
        accessToken: str | None = None,
        jsonBody: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send one QOJ request, unwrap its standard response envelope, and map failures to safe errors."""

        # The normalized URL allows the operator to paste an endpoint with or without a trailing slash.
        normalizedBaseUrl = self._normalizeBaseUrl(qojBaseUrl)
        # The concrete path is controlled by this adapter rather than a model-generated string.
        requestUrl = f"{normalizedBaseUrl}{path}"
        # The header collection begins with JSON compatibility and conditionally includes the transient token.
        requestHeaders = {"Accept": "application/json"}
        if accessToken:
            requestHeaders["Authorization"] = f"Bearer {accessToken}"
        try:
            # A short-lived client guarantees bearer tokens are not retained by a reusable connection object.
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as httpClient:
                # jsonBody remains None for GET calls so the QOJ request shape matches its controller contract.
                response = await httpClient.request(
                    method,
                    requestUrl,
                    headers=requestHeaders,
                    json=jsonBody,
                )
        except httpx.HTTPError as error:
            raise QojApiError(f"Could not reach QOJ at {normalizedBaseUrl}: {error}") from error
        # QOJ uses both HTTP status and an ApiResponse business code, so both must be checked.
        responseText = response.text[:4000]
        try:
            # QOJ serializes standard responses as {code, message, data}.
            responseEnvelope = response.json()
        except ValueError as error:
            raise QojApiError(
                f"QOJ returned non-JSON HTTP {response.status_code}: {responseText}"
            ) from error
        if response.status_code >= 400:
            # The message is bounded and contains no request headers or authorization token.
            responseMessage = responseEnvelope.get("message", responseText)
            raise QojApiError(f"QOJ rejected the request with HTTP {response.status_code}: {responseMessage}")
        # QOJ success code is 200 according to its ErrorCode.SUCCESS API contract.
        responseCode = responseEnvelope.get("code")
        if responseCode != 200:
            responseMessage = responseEnvelope.get("message", "Unknown QOJ business error")
            raise QojApiError(f"QOJ business error {responseCode}: {responseMessage}")
        # A null data value is represented as an empty dictionary for endpoints that intentionally return void.
        responseData = responseEnvelope.get("data")
        if responseData is None:
            return {}
        if not isinstance(responseData, dict):
            raise QojApiError("QOJ response data has an unexpected non-object shape")
        return responseData

    def _normalizeBaseUrl(self, qojBaseUrl: str) -> str:
        """Validate an operator-provided QOJ base URL before using it in an outbound request."""

        # The normalized value avoids accidental double slashes in QOJ endpoint paths.
        normalizedUrl = qojBaseUrl.strip().rstrip("/")
        if not normalizedUrl.startswith(("http://", "https://")):
            raise QojApiError("QOJ API address must start with http:// or https://")
        return normalizedUrl
