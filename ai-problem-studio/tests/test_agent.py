"""Offline LangGraph workflow test using deterministic fake provider and reference-runner collaborators."""

import asyncio
from typing import Any

from app.agent import ProblemGenerationAgent
from app.models import ProblemBrief, RuntimeSettings, VerificationCase, VerificationReport
from app.validators import CandidateStaticValidator
from tests.test_validators import buildCandidate


class FakeDeepSeekClient:
    """Return queued JSON objects so LangGraph routing is tested without an external provider call."""

    def __init__(self, queuedPayloads: list[dict[str, Any]]) -> None:
        """Store one plan, one candidate, and one critic response in their expected call order."""

        # The queued responses emulate provider JSON mode while remaining deterministic for test assertions.
        self.queuedPayloads = queuedPayloads
        # The recorded values prove every workflow node receives the configured reasoning effort.
        self.reasoningEfforts: list[str | None] = []

    async def completeJson(
        self,
        baseUrl: str,
        modelName: str,
        systemPrompt: str,
        userPrompt: str,
        temperature: float,
        reasoningEffort: str | None = None,
        progressCallback=None,
        progressPhase: str = "model",
    ) -> dict[str, Any]:
        """Return the next queued payload while accepting the production client method contract."""

        # The call parameters are intentionally accepted to prove the agent can use the real client interface.
        del baseUrl, modelName, systemPrompt, userPrompt, temperature, progressCallback, progressPhase
        # The captured option makes reasoning-strength propagation independently testable.
        self.reasoningEfforts.append(reasoningEffort)
        # The first payload belongs to planning, second to generation, and third to critic review.
        nextPayload = self.queuedPayloads.pop(0)
        return nextPayload


class FakeReferenceRunner:
    """Return reference-derived output pairs for the candidate without compiling or executing Docker."""

    def verify(self, candidate) -> VerificationReport:
        """Produce a passing report with output pairs corresponding to the fixed increment fixture."""

        # Samples retain candidate order so export zipping matches the production runner contract.
        verifiedSamples = [
            VerificationCase(caseNo=1, input="1\n", output="2\n", purpose="基础"),
            VerificationCase(caseNo=2, input="9\n", output="10\n", purpose="边界"),
        ]
        # Each hidden input contains exactly one integer that the fixture solution increments.
        verifiedTestCases = [
            VerificationCase(
                caseNo=testCase.caseNo,
                input=testCase.input,
                output=f"{testCase.caseNo + 1}\n",
                purpose=testCase.purpose,
            )
            for testCase in candidate.hiddenTestInputs
        ]
        # A PASSED report reaches the mandatory human review state in the production workflow.
        report = VerificationReport(
            status="PASSED",
            verifiedSamples=verifiedSamples,
            verifiedTestCases=verifiedTestCases,
        )
        return report


def testLangGraphReachesReadyForReviewWithVerifiedCandidate() -> None:
    """Confirm plan, generation, static validation, critic, and runner nodes reach the human-review terminal state."""

    # The candidate fixture is valid for static checks and has deterministic expected outputs.
    candidate = buildCandidate()
    # The plan payload follows the strict ProblemPlan schema used by the first agent node.
    planPayload = {
        "coreIdea": "读取一个整数并输出其后继。",
        "solutionApproach": "直接加一。",
        "timeComplexity": "O(1)",
        "memoryComplexity": "O(1)",
        "requiredEdgeCases": ["零", "最大值"],
        "sampleTeachingPlan": "样例展示普通值和边界值。",
    }
    # The critic payload has no critical issue, allowing the graph to enter reference verification.
    criticPayload = {"hasCriticalIssues": False, "criticalIssues": [], "suggestions": []}
    # The fake provider serves the exact three model calls made on the no-repair happy path.
    fakeDeepSeekClient = FakeDeepSeekClient([planPayload, candidate.model_dump(), criticPayload])
    # The agent uses production static validation and a deterministic no-Docker reference collaborator.
    agent = ProblemGenerationAgent(fakeDeepSeekClient, CandidateStaticValidator(), FakeReferenceRunner())
    # The required author brief is unchanged throughout the graph and includes all first-step fields.
    brief = ProblemBrief(
        algorithmRequirements=["math"],
        background="构造一个后继数练习题，面向刚开始学习输入输出的学生。",
        assessmentPoints=["整数运算"],
        sampleAssessmentPoints=["基本输入输出"],
        constraints="输入一个范围内的非负整数，并在线性时间内输出后继。",
        difficulty=1,
    )
    # Runtime settings do not call the real endpoint because the fake client replaces network I/O.
    runtimeSettings = RuntimeSettings(
        deepseekBaseUrl="https://api.deepseek.example",
        deepseekModel="deepseek-v4-pro",
        reasoningEffort="high",
        qojBaseUrl="http://qoj.example",
    )
    # The callback captures real node events in the same order that a production job persists them for SSE.
    progressUpdates: list[tuple[str, str, str]] = []

    async def recordProgress(phase: str, level: str, message: str) -> None:
        """Collect one agent callback without introducing network or database I/O into this workflow test."""

        # The tuple preserves the exact event fields required by the standalone backend callback boundary.
        progressUpdates.append((phase, level, message))

    # The full asynchronous graph executes through LangGraph's compiled StateGraph interface.
    finalState = asyncio.run(agent.generate(brief, runtimeSettings, recordProgress))
    assert finalState["finalStatus"] == "READY_FOR_REVIEW"
    assert finalState["referenceReport"]["status"] == "PASSED"
    assert len(finalState["referenceReport"]["verifiedTestCases"]) == 8
    assert fakeDeepSeekClient.reasoningEfforts == ["high", "high", "high"]
    assert [phase for phase, _, _ in progressUpdates] == [
        "plan",
        "plan",
        "candidate",
        "candidate",
        "static-validation",
        "static-validation",
        "critic",
        "critic",
        "reference-runner",
        "reference-runner",
        "finish",
    ]
    assert progressUpdates[3][1] == "SUCCESS"
    assert "后继数" in progressUpdates[3][2]
    assert progressUpdates[-1] == ("finish", "SUCCESS", "自动校验完成，题目已进入人工审核")
