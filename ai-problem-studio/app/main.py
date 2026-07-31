"""FastAPI entry point that serves the standalone HTML app and its AI/QOJ integration API."""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, AsyncIterator
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .agent import AgentGenerationError, ProblemGenerationAgent
from .config import AppSettings, getSettings
from .codex_client import CodexAgentClient
from .models import (
    CriticReview,
    GeneratedProblemCandidate,
    GenerationJob,
    HumanReviewRequest,
    ProblemBrief,
    ProblemPlan,
    ProgressEvent,
    QojExportRequest,
    QojLoginRequest,
    QojManualSessionRequest,
    RuntimeSettings,
    RuntimeSettingsResponse,
    RuntimeSettingsUpdateRequest,
    VerificationReport,
)
from .provider_credentials import ProviderCredentialStore
from .qoj_client import QojApiError, QojClient
from .qoj_session import QojSession, QojSessionStore
from .reference_runner import ReferenceSolutionRunner
from .storage import StudioRepository
from .validators import CandidateStaticValidator


# The immutable process configuration provides optional environment defaults for the compatible model provider.
appSettings: AppSettings = getSettings()
# The runtime defaults become persistent non-secret settings after startup initialization.
defaultRuntimeSettings = RuntimeSettings(
    deepseekBaseUrl=appSettings.codexBaseUrl,
    deepseekModel=appSettings.codexModel,
    qojBaseUrl=appSettings.qojBaseUrl,
)
# The repository persists job data but excludes provider keys, QOJ passwords, and access tokens.
studioRepository = StudioRepository(appSettings.databasePath)
# The credential store begins with the optional environment key and accepts visual, process-only updates.
providerCredentialStore = ProviderCredentialStore(appSettings.codexApiKey)
# The Codex Agent client resolves the active key only from backend process memory and child-process environment.
codexAgentClient = CodexAgentClient(
    providerCredentialStore,
    codexCommand=appSettings.codexCommand,
    workingDirectory=appSettings.projectDirectory,
)
# The deterministic validator protects the Docker boundary from structurally invalid candidate content.
candidateStaticValidator = CandidateStaticValidator()
# The Docker runner derives all expected sample and hidden-test outputs from the generated C++ program.
referenceSolutionRunner = ReferenceSolutionRunner(appSettings)
# The LangGraph instance coordinates generation, critique, repair, and reference verification.
problemGenerationAgent = ProblemGenerationAgent(
    codexAgentClient,
    candidateStaticValidator,
    referenceSolutionRunner,
)
# The QOJ adapter talks only to HTTP endpoints and never imports QOJ implementation code.
qojClient = QojClient()
# QOJ access and refresh tokens remain only in this backend process, keyed by an opaque browser cookie.
qojSessionStore = QojSessionStore()
# The cookie itself contains only a random session identifier and expires with the browser session.
qojSessionCookieName = "ai_problem_studio_qoj_session"
# The API router keeps application endpoints clearly separated from the static HTML route.
apiRouter = APIRouter(prefix="/api")
# The frontend directory is served by this process so the browser and API share an origin.
staticDirectory = Path(__file__).resolve().parent.parent / "static"
# Background tasks are retained so their exceptions are observed and each active generation remains referenced.
activeGenerationTasks: set[asyncio.Task[None]] = set()


@asynccontextmanager
async def appLifespan(application: FastAPI):
    """Initialize non-secret local persistence before accepting HTTP requests."""

    # The repository creates SQLite tables and seeds editable endpoint defaults once.
    studioRepository.initialize(defaultRuntimeSettings)
    yield


# The FastAPI application exposes an OpenAPI contract alongside the raw HTML user interface.
app = FastAPI(
    title="AI Problem Studio",
    version="0.1.0",
    lifespan=appLifespan,
)


@apiRouter.get("/health")
async def getHealth() -> dict[str, Any]:
    """Return local service readiness without exposing whether a provider key is configured."""

    # The returned flag only proves the standalone backend is running.
    healthPayload = {"status": "ok", "service": "ai-problem-studio"}
    return healthPayload


def _runtimeSettingsResponse(runtimeSettings: RuntimeSettings) -> RuntimeSettingsResponse:
    """Combine persisted non-secret settings with a browser-safe API-key configuration indicator."""

    # The boolean intentionally reveals no credential characters, length, provider, or fingerprint.
    responsePayload = runtimeSettings.model_dump()
    responsePayload["apiKeyConfigured"] = providerCredentialStore.isConfigured()
    return RuntimeSettingsResponse.model_validate(responsePayload)


@apiRouter.get("/settings", response_model=RuntimeSettingsResponse)
async def getRuntimeSettings() -> RuntimeSettingsResponse:
    """Read non-secret model and QOJ endpoint settings for the browser configuration panel."""

    # Runtime settings are safe to display because they intentionally contain no key or token field.
    runtimeSettings = studioRepository.getRuntimeSettings()
    return _runtimeSettingsResponse(runtimeSettings)


@apiRouter.put("/settings", response_model=RuntimeSettingsResponse)
async def updateRuntimeSettings(settingsUpdate: RuntimeSettingsUpdateRequest) -> RuntimeSettingsResponse:
    """Persist non-secret settings and update an optional API key in backend memory without a restart."""

    # Credential fields are removed before this save, so SQLite never receives the API key.
    runtimeSettings = settingsUpdate.toRuntimeSettings()
    savedSettings = studioRepository.saveRuntimeSettings(runtimeSettings)
    # The key update happens only after the persisted non-secret configuration has been accepted.
    if settingsUpdate.clearApiKey:
        providerCredentialStore.clearApiKey()
    elif settingsUpdate.apiKey:
        providerCredentialStore.setApiKey(settingsUpdate.apiKey)
    return _runtimeSettingsResponse(savedSettings)


@apiRouter.post("/jobs", response_model=GenerationJob)
async def createGenerationJob(brief: ProblemBrief) -> GenerationJob:
    """Persist a new generating job immediately and start its LangGraph workflow in the background."""

    # The active endpoint configuration is captured at job start for reproducibility.
    runtimeSettings = studioRepository.getRuntimeSettings()
    # A timezone-aware UTC timestamp anchors both lifecycle fields in the initial job record.
    currentTime = datetime.now(UTC)
    # The UUID remains independent from QOJ draft IDs and avoids exposing sequential local data.
    jobId = str(uuid4())
    # The initial event represents a completed persistence action, not a simulated workflow stage.
    initialProgressEvent = ProgressEvent(
        sequence=1,
        createdAt=currentTime,
        phase="queued",
        level="INFO",
        message="生成任务已创建，正在等待 Agent 开始处理",
    )
    # Initial persistence makes provider failures auditable rather than leaving a disappeared user action.
    generationJob = GenerationJob(
        id=jobId,
        status="GENERATING",
        brief=brief,
        progressEvents=[initialProgressEvent],
        createdAt=currentTime,
        updatedAt=currentTime,
    )
    savedJob = studioRepository.createJob(generationJob)
    # The task is scheduled only after its initial event is durable, so an SSE subscriber never observes a missing job.
    generationTask = asyncio.create_task(
        _runGenerationJob(jobId, brief, runtimeSettings),
        name=f"problem-generation-{jobId}",
    )
    activeGenerationTasks.add(generationTask)
    # Completed tasks are removed from the process-local registry while their durable result remains in SQLite.
    generationTask.add_done_callback(activeGenerationTasks.discard)
    return savedJob


@apiRouter.get("/jobs/{jobId}", response_model=GenerationJob)
async def getGenerationJob(jobId: str) -> GenerationJob:
    """Return one persisted job so a browser refresh does not lose the human review artifact."""

    # The repository returns None rather than raising when the UUID does not exist.
    generationJob = studioRepository.getJob(jobId)
    if generationJob is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation job was not found")
    return generationJob


@apiRouter.get("/jobs/{jobId}/events")
async def streamGenerationJobEvents(
    jobId: str,
    request: Request,
    afterSequence: int = Query(default=0, ge=0),
) -> StreamingResponse:
    """Stream persisted, actual generation events and close only after the job reaches a durable terminal state."""

    # A preflight lookup gives a normal 404 response instead of opening a never-ending stream for an unknown UUID.
    _requireJob(jobId)

    async def eventStream() -> AsyncIterator[str]:
        """Poll the durable job audit trail and yield only event records newer than the client cursor."""

        # The cursor advances only after an event has been yielded, allowing browser reconnects to safely deduplicate.
        latestSequence = afterSequence
        while True:
            # Disconnect detection avoids a background database poll after the browser has navigated away.
            if await request.is_disconnected():
                return
            # Reads run in a worker thread because SQLite access is intentionally synchronous and short-lived.
            generationJob = await asyncio.to_thread(studioRepository.getJob, jobId)
            if generationJob is None:
                # The record cannot normally disappear, but ending the stream is safer than looping forever on corruption.
                return
            # Sequence ordering is explicit so SSE behavior remains correct for jobs restored from older JSON documents.
            newEvents = sorted(
                (event for event in generationJob.progressEvents if event.sequence > latestSequence),
                key=lambda event: event.sequence,
            )
            for progressEvent in newEvents:
                # The event payload contains only persisted non-secret audit data from the workflow callback.
                eventPayload = progressEvent.model_dump(mode="json")
                yield _formatSseEvent("progress", eventPayload, progressEvent.sequence)
                latestSequence = progressEvent.sequence
            if generationJob.status != "GENERATING":
                # A terminal event tells the browser to stop its EventSource before it reloads the complete artifact.
                donePayload = {
                    "jobId": generationJob.id,
                    "status": generationJob.status,
                    "lastSequence": latestSequence,
                }
                yield _formatSseEvent("done", donePayload)
                return
            # This is a transport polling interval only; no artificial progress text is generated between real events.
            await asyncio.sleep(0.35)

    # These headers prevent intermediaries from caching or buffering the event stream until task completion.
    responseHeaders = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    return StreamingResponse(eventStream(), media_type="text/event-stream", headers=responseHeaders)


@apiRouter.post("/jobs/{jobId}/review", response_model=GenerationJob)
async def reviewGenerationJob(jobId: str, reviewRequest: HumanReviewRequest) -> GenerationJob:
    """Record a mandatory human decision after all automatic gates have produced a reviewable job."""

    # The job lookup keeps manual decisions tied to exactly one generated candidate.
    generationJob = _requireJob(jobId)
    if generationJob.status not in {"READY_FOR_REVIEW", "EXPORTED"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a fully verified job can receive human review",
        )
    # The audit payload contains a reviewer decision and timestamp but no QOJ credentials.
    reviewPayload = {
        "reviewerName": reviewRequest.reviewerName,
        "approved": reviewRequest.approved,
        "notes": reviewRequest.notes,
        "reviewedAt": datetime.now(UTC).isoformat(),
    }
    # An exported record retains its status while allowing a reviewer to add post-export notes.
    reviewedJob = generationJob.model_copy(update={"humanReview": reviewPayload})
    savedJob = studioRepository.saveJob(reviewedJob)
    return savedJob


@apiRouter.get("/qoj/captcha")
async def getQojCaptcha(qojBaseUrl: str) -> dict[str, Any]:
    """Proxy the QOJ CAPTCHA image so the standalone UI can complete teacher login without CORS coupling."""

    try:
        # The QOJ client calls the exact public image endpoint found in the QOJ API implementation.
        captchaPayload = await qojClient.getCaptcha(qojBaseUrl)
        return captchaPayload
    except QojApiError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@apiRouter.post("/qoj/login")
async def loginQojTeacher(
    loginRequest: QojLoginRequest,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """Authenticate a teacher account and create an HttpOnly local session that survives page refreshes."""

    try:
        # The username, password, CAPTCHA, and QOJ token response are never passed to the repository.
        tokenPayload = await qojClient.loginTeacher(
            loginRequest.qojBaseUrl,
            loginRequest.username,
            loginRequest.password,
            loginRequest.captchaId,
            loginRequest.captcha,
        )
        # A successful QOJ login must still prove that the account can access the teacher profile endpoint.
        accessToken = _requiredQojToken(tokenPayload, "accessToken")
        refreshToken = _optionalQojToken(tokenPayload, "refreshToken")
        profilePayload = await qojClient.verifyTeacherSession(loginRequest.qojBaseUrl, accessToken)
        # A new login supersedes any prior opaque local session presented by this browser.
        qojSessionStore.remove(request.cookies.get(qojSessionCookieName))
        qojSession = qojSessionStore.create(accessToken, refreshToken, loginRequest.qojBaseUrl)
        _setQojSessionCookie(response, request, qojSession.sessionId)
        return _qojSessionResponse(qojSession, profilePayload)
    except QojApiError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@apiRouter.post("/qoj/manual-session")
async def createManualQojSession(
    manualSessionRequest: QojManualSessionRequest,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """Verify a pasted token once and retain it only in the server-side browser session until expiry."""

    try:
        # Manual tokens do not have a refresh token, so their session ends when QOJ rejects the bearer token.
        profilePayload = await qojClient.verifyTeacherSession(
            manualSessionRequest.qojBaseUrl,
            manualSessionRequest.accessToken,
        )
        qojSessionStore.remove(request.cookies.get(qojSessionCookieName))
        qojSession = qojSessionStore.create(
            manualSessionRequest.accessToken,
            None,
            manualSessionRequest.qojBaseUrl,
        )
        _setQojSessionCookie(response, request, qojSession.sessionId)
        return _qojSessionResponse(qojSession, profilePayload)
    except QojApiError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@apiRouter.get("/qoj/session")
async def getQojSession(request: Request) -> dict[str, Any]:
    """Restore and verify the browser's short-lived QOJ session after a normal page refresh."""

    # The resolver verifies the teacher role and rotates a server-held refresh token when QOJ requires it.
    qojSession, profilePayload = await _resolveQojSession(request)
    return _qojSessionResponse(qojSession, profilePayload)


@apiRouter.post("/jobs/{jobId}/export-qoj", response_model=GenerationJob)
async def exportGenerationJobToQoj(
    jobId: str,
    exportRequest: QojExportRequest,
    request: Request,
) -> GenerationJob:
    """Export an approved candidate to QOJ through its draft API and retain a DRAFT-only audit result."""

    # The loaded artifact must retain every automated and human gate before QOJ mutation begins.
    generationJob = _requireJob(jobId)
    _assertExportAllowed(generationJob)
    # Type narrowing is valid because _assertExportAllowed rejects missing candidate and report fields.
    candidate = generationJob.candidate
    referenceReport = generationJob.referenceReport
    if candidate is None or referenceReport is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job is missing export artifacts")
    # The QOJ session is restored from the HttpOnly cookie; no bearer token enters browser JavaScript or job data.
    qojSession, _ = await _resolveQojSession(request)
    try:
        # QOJ receives only the candidate, export-time metadata, and reference-derived outputs.
        exportPayload = await qojClient.exportDraft(
            qojSession.qojBaseUrl,
            qojSession.accessToken,
            exportRequest,
            candidate,
            referenceReport,
        )
    except QojApiError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
    # The completed local job is immutable in content but records the QOJ ID and DRAFT status for audit.
    exportedJob = generationJob.model_copy(update={"status": "EXPORTED", "qojExport": exportPayload})
    savedJob = studioRepository.saveJob(exportedJob)
    return savedJob


async def _runGenerationJob(jobId: str, brief: ProblemBrief, runtimeSettings: RuntimeSettings) -> None:
    """Run one persisted job outside its POST response and save each actual agent event before the final artifact."""

    async def persistProgress(phase: str, level: str, message: str) -> None:
        """Persist one node callback through the repository before SSE readers can observe its sequence."""

        # SQLite work moves off the event loop while the agent waits for provider requests or Docker execution.
        savedProgressJob = await asyncio.to_thread(
            studioRepository.appendProgressEvent,
            jobId,
            phase,
            level,
            message,
        )
        if savedProgressJob is None:
            # Continuing would create an unobservable workflow after unexpected local data loss.
            raise AgentGenerationError("Generation job was not found while saving progress")

    try:
        # The callback is scoped to this invocation, so concurrent jobs retain independent progress histories.
        agentState = await problemGenerationAgent.generate(brief, runtimeSettings, persistProgress)
        # The most recent document includes every progress callback written by the terminal LangGraph node.
        latestJob = await asyncio.to_thread(studioRepository.getJob, jobId)
        if latestJob is None:
            return
        # The conversion reconstructs strict Pydantic nested artifacts while retaining the persisted progress list.
        completedJob = _jobFromAgentState(latestJob, agentState)
        # The final lifecycle transition is durable before SSE sends its terminal done event.
        await asyncio.to_thread(studioRepository.saveJob, completedJob)
    except asyncio.CancelledError:
        # A shutdown must not leave a permanently generating task that cannot be resumed safely after restart.
        await asyncio.to_thread(studioRepository.failGenerationJob, jobId, "服务停止前生成任务被取消")
        raise
    except AgentGenerationError as error:
        # Provider/schema failures receive a terminal event in the same SQLite update as their FAILED state.
        failureReason = _failureReasonFromError(error)
        await asyncio.to_thread(studioRepository.failGenerationJob, jobId, failureReason)
    except Exception as error:
        # Unexpected worker failures are visible without leaking a traceback or any configured secret.
        failureReason = _failureReasonFromError(error, "生成工作流发生未预期错误")
        await asyncio.to_thread(studioRepository.failGenerationJob, jobId, failureReason)


def _requiredQojToken(tokenPayload: dict[str, Any], tokenKey: str) -> str:
    """Read one mandatory string token from a QOJ login or refresh response without logging its value."""

    # QOJ response variants are validated at the server boundary before any token can enter the session store.
    tokenValue = tokenPayload.get(tokenKey)
    if not isinstance(tokenValue, str) or not tokenValue.strip():
        raise QojApiError(f"QOJ response did not include a usable {tokenKey}")
    return tokenValue.strip()


def _optionalQojToken(tokenPayload: dict[str, Any], tokenKey: str) -> str | None:
    """Read one optional QOJ token and normalize omitted or blank values to None."""

    # A manually configured or older QOJ deployment may omit the refresh token while still returning an access token.
    tokenValue = tokenPayload.get(tokenKey)
    if not isinstance(tokenValue, str) or not tokenValue.strip():
        return None
    return tokenValue.strip()


def _setQojSessionCookie(response: Response, request: Request, sessionId: str) -> None:
    """Write an opaque browser-session cookie that JavaScript cannot inspect or persist elsewhere."""

    # Secure is enabled automatically behind HTTPS while local HTTP development remains usable on 127.0.0.1.
    response.set_cookie(
        key=qojSessionCookieName,
        value=sessionId,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )


def _qojSessionResponse(qojSession: QojSession, profilePayload: dict[str, Any]) -> dict[str, Any]:
    """Build a browser-safe session response that exposes account identity but never any QOJ token value."""

    # The profile is supplied by QOJ's teacher endpoint and the base URL helps the UI describe the active host.
    return {"profile": profilePayload, "qojBaseUrl": qojSession.qojBaseUrl}


def _isQojAuthenticationFailure(error: QojApiError) -> bool:
    """Classify an adapter error as an invalid or expired QOJ credential rather than a network failure."""

    # HTTP status text is emitted by QojClient, while several QOJ installations return a business-error phrase instead.
    errorText = str(error).lower()
    return (
        "http 401" in errorText
        or "http 403" in errorText
        or "unauthorized" in errorText
        or "unauthenticated" in errorText
        or "invalid token" in errorText
        or "expired token" in errorText
        or "token" in errorText
        or "登录过期" in errorText
        or "认证失败" in errorText
    )


async def _resolveQojSession(request: Request) -> tuple[QojSession, dict[str, Any]]:
    """Resolve, verify, and when possible refresh the current browser's process-local QOJ session."""

    # The cookie is an opaque lookup key rather than a bearer token and cannot be read by the browser script.
    sessionId = request.cookies.get(qojSessionCookieName)
    qojSession = qojSessionStore.get(sessionId)
    if qojSession is None:
        # Missing and expired sessions both require a fresh teacher login before any QOJ mutation can occur.
        errorDetail = "QOJ 会话已过期，请重新登录" if sessionId else "尚未登录 QOJ AI 教师账号"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=errorDetail)
    try:
        # Verifying the teacher profile makes refresh-state restoration truthful rather than trusting an old local badge.
        profilePayload = await qojClient.verifyTeacherSession(qojSession.qojBaseUrl, qojSession.accessToken)
        return qojSession, profilePayload
    except QojApiError as initialError:
        if not _isQojAuthenticationFailure(initialError):
            # A QOJ network or service failure must not be presented as a revoked user session.
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(initialError)) from initialError
        if not qojSession.refreshToken:
            # Manually pasted access tokens cannot be rotated, so their failed session is removed immediately.
            qojSessionStore.remove(sessionId)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="QOJ 会话已过期，请重新登录或重新验证临时 Access Token",
            ) from initialError
    try:
        # A login-derived refresh token never leaves backend memory while QOJ rotates the access token.
        refreshedPayload = await qojClient.refreshAccessToken(qojSession.qojBaseUrl, qojSession.refreshToken)
        refreshedAccessToken = _requiredQojToken(refreshedPayload, "accessToken")
        # Providers that omit a rotated refresh token leave the still-valid server-held token unchanged.
        refreshedRefreshToken = _optionalQojToken(refreshedPayload, "refreshToken") or qojSession.refreshToken
        refreshedSession = qojSessionStore.replaceTokens(
            qojSession.sessionId,
            refreshedAccessToken,
            refreshedRefreshToken,
        )
        if refreshedSession is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="QOJ 会话已过期，请重新登录")
        profilePayload = await qojClient.verifyTeacherSession(
            refreshedSession.qojBaseUrl,
            refreshedSession.accessToken,
        )
        return refreshedSession, profilePayload
    except HTTPException:
        raise
    except QojApiError as refreshError:
        if _isQojAuthenticationFailure(refreshError):
            # An invalid refresh token means the local session cannot safely be recovered.
            qojSessionStore.remove(sessionId)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="QOJ 会话已过期，请重新登录") from refreshError
        # Infrastructure failures leave the session intact so a later retry can reuse it.
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(refreshError)) from refreshError


def _failureReasonFromError(error: Exception, fallbackMessage: str = "生成工作流失败") -> str:
    """Return a bounded, display-safe failure summary for the persisted job and its terminal progress event."""

    # Exception text is useful for configuration/schema correction, while blank exceptions receive a stable fallback.
    failureReason = str(error).strip() or fallbackMessage
    # The model field and event contract both cap text so provider bodies cannot make a local job document unbounded.
    return failureReason[:4000]


def _formatSseEvent(eventName: str, eventPayload: dict[str, Any], eventId: int | None = None) -> str:
    """Encode one JSON payload as a standards-compliant SSE record without treating model text as protocol syntax."""

    # JSON escapes embedded newlines in model-derived text, keeping every SSE data payload on exactly one protocol line.
    serializedPayload = json.dumps(eventPayload, ensure_ascii=False, separators=(",", ":"))
    # Event IDs let compliant EventSource clients expose the last durable sequence during reconnection diagnostics.
    eventIdLine = f"id: {eventId}\n" if eventId is not None else ""
    return f"{eventIdLine}event: {eventName}\ndata: {serializedPayload}\n\n"


def _jobFromAgentState(generationJob: GenerationJob, agentState: dict[str, Any]) -> GenerationJob:
    """Convert terminal LangGraph JSON state back into the strict persisted GenerationJob representation."""

    # The plan is optional because upstream provider/schema failures may have been caught before terminal state.
    problemPlan = ProblemPlan.model_validate(agentState["plan"]) if agentState.get("plan") else None
    # The candidate remains optional for defensive compatibility with future graph versions.
    candidate = GeneratedProblemCandidate.model_validate(agentState["candidate"]) if agentState.get("candidate") else None
    # Each report is reconstructed independently so a failed gate remains visible to the reviewer.
    staticReport = VerificationReport.model_validate(agentState["staticReport"]) if agentState.get("staticReport") else None
    criticReview = CriticReview.model_validate(agentState["criticReview"]) if agentState.get("criticReview") else None
    referenceReport = (
        VerificationReport.model_validate(agentState["referenceReport"]) if agentState.get("referenceReport") else None
    )
    # The graph output decides whether this artifact reaches mandatory human review or stays failed.
    finalStatus = agentState.get("finalStatus", "FAILED")
    if finalStatus not in {"READY_FOR_REVIEW", "FAILED"}:
        finalStatus = "FAILED"
    # The returned job excludes runtime endpoints and all secrets because they are not durable job data.
    completedJob = generationJob.model_copy(
        update={
            "status": finalStatus,
            "plan": problemPlan,
            "candidate": candidate,
            "staticReport": staticReport,
            "criticReview": criticReview,
            "referenceReport": referenceReport,
        }
    )
    return completedJob


def _requireJob(jobId: str) -> GenerationJob:
    """Load a job or raise a consistent 404 API response for routes that require an existing artifact."""

    # The repository lookup deliberately does not expose whether other local job IDs exist.
    generationJob = studioRepository.getJob(jobId)
    if generationJob is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation job was not found")
    return generationJob


def _assertExportAllowed(generationJob: GenerationJob) -> None:
    """Enforce automatic verification and explicit human approval before any QOJ draft mutation can occur."""

    if generationJob.status != "READY_FOR_REVIEW":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a ready-for-review job can be exported to QOJ",
        )
    # Human review is a structured local audit record rather than a browser-only checkbox.
    humanReview = generationJob.humanReview or {}
    if humanReview.get("approved") is not True:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A human reviewer must explicitly approve the problem before export",
        )
    if generationJob.staticReport is None or generationJob.staticReport.status != "PASSED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Static validation did not pass")
    if generationJob.criticReview is None or generationJob.criticReview.hasCriticalIssues:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Critic review did not pass")
    if generationJob.referenceReport is None or generationJob.referenceReport.status != "PASSED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reference verification did not pass")


# The router is registered before the frontend file route so `/api/*` never falls through to HTML.
app.include_router(apiRouter)
# The static mount serves raw CSS and JavaScript without a frontend framework or bundler.
app.mount("/static", StaticFiles(directory=staticDirectory), name="static")


@app.get("/", include_in_schema=False)
async def getFrontend() -> FileResponse:
    """Serve the raw HTML application without a JavaScript framework or separate frontend build step."""

    # The no-store header prevents an HTML shell from pairing a new control tree with an old cached script.
    frontendFile = staticDirectory / "index.html"
    return FileResponse(frontendFile, headers={"Cache-Control": "no-store"})
