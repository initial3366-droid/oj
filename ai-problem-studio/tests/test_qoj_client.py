"""Focused contract tests ensuring every exported QOJ problem stays a private DRAFT."""

import asyncio
from typing import Any

from app.models import QojExportRequest, VerificationCase, VerificationReport
from app.qoj_client import QojClient
from tests.test_validators import buildCandidate


class RecordingQojClient(QojClient):
    """In-memory QOJ adapter that records the contract calls without contacting a real QOJ server."""

    def __init__(self) -> None:
        """Initialize the request array used to assert method, path, and payload details."""

        # The recorded calls replace network I/O for this unit test.
        self.recordedCalls: list[dict[str, Any]] = []

    async def _request(
        self,
        method: str,
        qojBaseUrl: str,
        path: str,
        accessToken: str | None = None,
        jsonBody: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Record each controlled QOJ API request and return minimal successful response data."""

        # The copy avoids later caller mutations changing the recorded assertion evidence.
        requestRecord = {
            "method": method,
            "baseUrl": qojBaseUrl,
            "path": path,
            "accessToken": accessToken,
            "jsonBody": dict(jsonBody or {}),
        }
        self.recordedCalls.append(requestRecord)
        if path == "/api/teacher/v1/me":
            return {"username": "ai_problem_bot"}
        if path == "/api/admin/v1/problem-drafts":
            return {"draftId": "draft-123"}
        if path.endswith("/commit"):
            return {"id": 42, "studentPublishStatus": "DRAFT", "isPublic": False}
        return {}


def testExportHardCodesPrivateDraftPayload() -> None:
    """Confirm QOJ export uses all four draft endpoints and cannot accidentally publish a problem."""

    # The recording client prevents any accidental network request or QOJ mutation during the test.
    qojClient = RecordingQojClient()
    # Export metadata is entered only after review and remains separate from the AI generation brief.
    exportRequest = QojExportRequest(
        title="人工确认的 QOJ 题目名",
        folderId=7,
        accessScope="MAJOR",
        majorId=3,
    )
    # The candidate contains two samples and eight hidden inputs from a valid local fixture.
    candidate = buildCandidate()
    # Visible output pairs are calculated artifacts rather than model-provided expectedOutput values.
    verifiedSamples = [
        VerificationCase(caseNo=1, input="1\n", output="2\n"),
        VerificationCase(caseNo=2, input="9\n", output="10\n"),
    ]
    # Hidden output pairs supply one deterministic QOJ expected output for every generated hidden input.
    verifiedTestCases = [
        VerificationCase(caseNo=caseNumber, input=f"{caseNumber}\n", output=f"{caseNumber + 1}\n")
        for caseNumber in range(1, 9)
    ]
    # A PASSED report is the only report shape allowed through the export precondition.
    referenceReport = VerificationReport(
        status="PASSED",
        verifiedSamples=verifiedSamples,
        verifiedTestCases=verifiedTestCases,
    )
    # The coroutine makes only recording-client calls and therefore remains safe in unit tests.
    exportResult = asyncio.run(
        qojClient.exportDraft(
            "http://qoj.example",
            "temporary-token",
            exportRequest,
            candidate,
            referenceReport,
        )
    )
    # QOJ receives a draft ID followed by basic, tests, and commit calls.
    assert exportResult["draftId"] == "draft-123"
    assert len(qojClient.recordedCalls) == 5
    # The third call stores basic fields after the session check and draft creation requests.
    basicRequest = qojClient.recordedCalls[2]
    # The private flags are hard-coded by the client and cannot be changed by candidate content.
    assert basicRequest["jsonBody"]["studentPublishStatus"] == "DRAFT"
    assert basicRequest["jsonBody"]["isPublic"] is False
    assert basicRequest["jsonBody"]["title"] == "人工确认的 QOJ 题目名"
    assert basicRequest["jsonBody"]["folderId"] == 7
    assert basicRequest["jsonBody"]["accessScope"] == "MAJOR"
    assert basicRequest["jsonBody"]["majorId"] == 3
    # The fourth call sends test output from the reference report, not the LLM candidate.
    testRequest = qojClient.recordedCalls[3]
    assert testRequest["jsonBody"]["testCases"][0]["output"] == "2\n"
