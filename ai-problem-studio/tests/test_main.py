"""Background-generation tests for durable progress and terminal provider configuration failures."""

import asyncio

from app import main
from app.agent import ProblemGenerationAgent
from app.deepseek_client import DeepSeekClient
from app.models import ProblemBrief, RuntimeSettings
from app.storage import StudioRepository
from app.validators import CandidateStaticValidator


class UnusedReferenceRunner:
    """Provide the agent constructor contract while a missing API key fails before Docker verification can begin."""

    def verify(self, candidate):
        """Reject accidental runner use because this test must fail during the first provider call instead."""

        # The argument is intentionally accepted so the fake follows the real runner's method shape.
        del candidate
        raise AssertionError("Reference runner must not execute when DEEPSEEK_API_KEY is missing")


class ConnectedSseRequest:
    """Provide the minimal request-disconnect contract needed to consume an SSE response without an HTTP server."""

    async def is_disconnected(self) -> bool:
        """Keep the synthetic browser connected until the terminal SSE record has been yielded."""

        # This test intentionally models one stable browser connection rather than a disconnect race.
        return False


def testBackgroundJobRecordsMissingApiKeyFailure(monkeypatch, tmp_path) -> None:
    """Confirm an immediately returned job becomes FAILED with durable plan and terminal progress events."""

    # An isolated SQLite file keeps this test independent from the developer's local job audit history.
    temporaryRepository = StudioRepository(tmp_path / "problem_studio.sqlite3")
    runtimeSettings = RuntimeSettings(
        deepseekBaseUrl="https://api.deepseek.example",
        deepseekModel="deepseek-v4-pro",
        qojBaseUrl="http://qoj.example",
    )
    temporaryRepository.initialize(runtimeSettings)
    # The empty-key real client exercises the production configuration error without a network request.
    missingKeyAgent = ProblemGenerationAgent(
        DeepSeekClient(""),
        CandidateStaticValidator(),
        UnusedReferenceRunner(),
    )
    # Task references are replaced per test so the test can await the exact background task created by the endpoint.
    backgroundTasks: set[asyncio.Task[None]] = set()
    monkeypatch.setattr(main, "studioRepository", temporaryRepository)
    monkeypatch.setattr(main, "problemGenerationAgent", missingKeyAgent)
    monkeypatch.setattr(main, "activeGenerationTasks", backgroundTasks)
    # The brief has all mandatory first-step pedagogical fields, so failure occurs only at provider configuration.
    brief = ProblemBrief(
        algorithmRequirements=["math"],
        background="用于验证缺失模型密钥时任务状态和事件是否能够完整写入本地数据库。",
        assessmentPoints=["错误诊断"],
        sampleAssessmentPoints=["状态反馈"],
        constraints="输入一个非负整数并输出其后继，范围足以满足最简单的整数计算练习。",
        difficulty=1,
    )

    async def runBackgroundJob() -> None:
        """Create a job through the API function and await its scheduled worker without external HTTP machinery."""

        # The route returns before the first provider call, which is the behavior the browser/SSE integration needs.
        createdJob = await main.createGenerationJob(brief)
        assert createdJob.status == "GENERATING"
        assert [event.sequence for event in createdJob.progressEvents] == [1]
        # The task has not run until this coroutine yields, so it can be captured before its done callback removes it.
        assert len(backgroundTasks) == 1
        generationTask = next(iter(backgroundTasks))
        await generationTask
        completedJob = temporaryRepository.getJob(createdJob.id)
        assert completedJob is not None
        assert completedJob.status == "FAILED"
        assert completedJob.failureReason == "模型 API Key 尚未配置，请在连接设置中填写"
        assert [event.sequence for event in completedJob.progressEvents] == [1, 2, 3]
        assert [(event.phase, event.level) for event in completedJob.progressEvents] == [
            ("queued", "INFO"),
            ("plan", "INFO"),
            ("finish", "ERROR"),
        ]
        assert completedJob.progressEvents[-1].message.startswith("任务执行失败：模型 API Key")
        # The SSE route reads the same persisted rows and emits their sequence-bearing event records before done.
        sseResponse = await main.streamGenerationJobEvents(createdJob.id, ConnectedSseRequest(), afterSequence=0)
        sseChunks = []
        async for sseChunk in sseResponse.body_iterator:
            # StreamingResponse may preserve a yielded string or encode it to bytes depending on the Starlette version.
            decodedChunk = sseChunk.decode() if isinstance(sseChunk, bytes) else sseChunk
            sseChunks.append(decodedChunk)
        sseText = "".join(sseChunks)
        assert sseText.count("event: progress") == 3
        assert '"sequence":3' in sseText
        assert "event: done" in sseText

    asyncio.run(runBackgroundJob())


def testRetryInputCreatesIndependentJobWithoutReplacingFailure(monkeypatch, tmp_path) -> None:
    """Confirm retrying a failed brief through the existing create route allocates a new durable job record."""

    # The isolated repository makes the two attempts independent from any local browser-created jobs.
    temporaryRepository = StudioRepository(tmp_path / "retry_problem_studio.sqlite3")
    # Runtime values are valid but the omitted provider key forces both background attempts to fail before network I/O.
    runtimeSettings = RuntimeSettings(
        deepseekBaseUrl="https://api.deepseek.example",
        deepseekModel="deepseek-v4-pro",
        qojBaseUrl="http://qoj.example",
    )
    temporaryRepository.initialize(runtimeSettings)
    # The production client keeps failure behavior realistic while the runner remains unreachable in this test.
    missingKeyAgent = ProblemGenerationAgent(
        DeepSeekClient(""),
        CandidateStaticValidator(),
        UnusedReferenceRunner(),
    )
    # Active tasks are captured so both asynchronous attempts can reach their final persisted state deterministically.
    backgroundTasks: set[asyncio.Task[None]] = set()
    monkeypatch.setattr(main, "studioRepository", temporaryRepository)
    monkeypatch.setattr(main, "problemGenerationAgent", missingKeyAgent)
    monkeypatch.setattr(main, "activeGenerationTasks", backgroundTasks)
    # This single immutable brief represents the data sent by the browser retry button instead of live form controls.
    retryBrief = ProblemBrief(
        algorithmRequirements=["math"],
        background="验证失败任务再次执行会保留原始教学需求，同时生成独立的审计记录。",
        assessmentPoints=["任务隔离"],
        sampleAssessmentPoints=["失败重试"],
        constraints="输入一个非负整数并输出它的后继，约束足以满足基础整数运算练习。",
        difficulty=1,
    )

    async def createRetryAttempts() -> None:
        """Create two attempts from the same brief and await their local terminal failure records."""

        # The first attempt represents the task currently displayed as FAILED in the browser.
        failedJob = await main.createGenerationJob(retryBrief)
        # The second request is exactly the operation made by the retry handler and must not mutate the first ID.
        replacementJob = await main.createGenerationJob(retryBrief)
        assert failedJob.id != replacementJob.id
        assert failedJob.brief == retryBrief
        assert replacementJob.brief == retryBrief
        # Both scheduled workers are awaited so state assertions observe durable terminal records rather than queued jobs.
        scheduledTasks = list(backgroundTasks)
        await asyncio.gather(*scheduledTasks)
        persistedFailedJob = temporaryRepository.getJob(failedJob.id)
        persistedReplacementJob = temporaryRepository.getJob(replacementJob.id)
        assert persistedFailedJob is not None
        assert persistedReplacementJob is not None
        assert persistedFailedJob.status == "FAILED"
        assert persistedReplacementJob.status == "FAILED"
        assert persistedFailedJob.failureReason == persistedReplacementJob.failureReason

    asyncio.run(createRetryAttempts())
