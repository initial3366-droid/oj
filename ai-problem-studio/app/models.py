"""Pydantic models that make agent, review, verification, and QOJ boundaries explicit."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class RuntimeSettings(BaseModel):
    """Non-secret provider and QOJ endpoint settings that the operator may update at runtime."""

    # The OpenAI-compatible model API base URL used for all agent completions.
    deepseekBaseUrl: str = Field(min_length=8, max_length=500)
    # The configurable model identifier, such as `deepseek-v4-pro` or an OpenAI reasoning model.
    deepseekModel: str = Field(min_length=1, max_length=200)
    # A null value preserves the model default; another value becomes Chat Completions reasoning_effort.
    reasoningEffort: Literal["none", "minimal", "low", "medium", "high", "xhigh", "max"] | None = None
    # The QOJ host that receives login and problem-draft API calls.
    qojBaseUrl: str = Field(min_length=8, max_length=500)

    @field_validator("deepseekBaseUrl", "qojBaseUrl")
    @classmethod
    def validateUrl(cls, value: str) -> str:
        """Reject endpoint values that cannot be used as HTTP(S) service URLs."""

        # The normalized URL avoids duplicate slashes when clients append endpoint paths.
        normalizedValue = value.strip().rstrip("/")
        if not normalizedValue.startswith(("http://", "https://")):
            raise ValueError("API address must start with http:// or https://")
        return normalizedValue


class RuntimeSettingsUpdateRequest(RuntimeSettings):
    """Accept editable non-secret settings plus a one-way, process-only API key update."""

    # A supplied key is consumed by the backend credential store and never saved with RuntimeSettings.
    apiKey: str | None = Field(default=None, max_length=5000)
    # The explicit checkbox prevents a blank password field from accidentally clearing an active key.
    clearApiKey: bool = False

    @field_validator("apiKey")
    @classmethod
    def normalizeApiKey(cls, value: str | None) -> str | None:
        """Trim a submitted API key and normalize a blank form field to no key update."""

        # A blank browser password input means preserve the current in-memory credential.
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def validateApiKeyUpdate(self) -> "RuntimeSettingsUpdateRequest":
        """Reject contradictory requests that both set and clear an API key."""

        # A single save has one credential intent, which keeps settings changes easy to audit.
        if self.clearApiKey and self.apiKey:
            raise ValueError("apiKey cannot be set when clearApiKey is true")
        return self

    def toRuntimeSettings(self) -> RuntimeSettings:
        """Build the persistable configuration object after removing all credential-only fields."""

        # Only endpoint, model, and reasoning settings are eligible for SQLite persistence.
        settingsPayload = self.model_dump(exclude={"apiKey", "clearApiKey"})
        return RuntimeSettings.model_validate(settingsPayload)


class RuntimeSettingsResponse(RuntimeSettings):
    """Expose browser-safe runtime settings plus a boolean API-key configuration state."""

    # The badge state informs the UI without exposing the key or a reversible fingerprint.
    apiKeyConfigured: bool


class ProblemBrief(BaseModel):
    """The mandatory first-step teaching intent supplied before the AI creates a problem."""

    # The algorithms or data structures the final problem must require.
    algorithmRequirements: list[str] = Field(min_length=1, max_length=12)
    # The real-world or contest narrative that frames the task.
    background: str = Field(min_length=10, max_length=4000)
    # The concepts a solver should demonstrate to receive credit.
    assessmentPoints: list[str] = Field(min_length=1, max_length=12)
    # The concepts that the samples must make observable to the learner.
    sampleAssessmentPoints: list[str] = Field(min_length=1, max_length=12)
    # The intended input bounds and any domain restrictions written by the author.
    constraints: str = Field(min_length=10, max_length=4000)
    # The intended QOJ difficulty from 1 through 5.
    difficulty: int = Field(ge=1, le=5)
    @field_validator("algorithmRequirements", "assessmentPoints", "sampleAssessmentPoints")
    @classmethod
    def cleanStringList(cls, value: list[str]) -> list[str]:
        """Trim brief arrays and prevent empty entries from entering agent prompts."""

        # The clean list preserves author order while removing blank concepts.
        cleanValues = [item.strip() for item in value if item.strip()]
        if not cleanValues:
            raise ValueError("At least one non-empty item is required")
        return cleanValues


class ProblemPlan(BaseModel):
    """An explicit plan that keeps generated content tied to the author-provided learning goals."""

    # The concise problem idea that bridges intent and implementation.
    coreIdea: str
    # The algorithmic proof obligation expected from a strong solution.
    solutionApproach: str
    # The anticipated time complexity in conventional Big-O notation.
    timeComplexity: str
    # The anticipated memory complexity in conventional Big-O notation.
    memoryComplexity: str
    # The edge cases that must appear in samples or hidden tests.
    requiredEdgeCases: list[str]
    # The teaching outcome that connects samples to the requested assessment points.
    sampleTeachingPlan: str


class GeneratedSample(BaseModel):
    """A candidate visible sample whose output is later verified by the C++ reference solution."""

    # The sample input copied into QOJ after validation.
    input: str = Field(min_length=1, max_length=20000)
    # The LLM-proposed sample output kept temporarily for mismatch detection.
    expectedOutput: str = Field(min_length=1, max_length=20000)
    # The Markdown explanation presented to a human reviewer and then QOJ.
    explanationMarkdown: str = Field(default="", max_length=20000)
    # The learning point illustrated by this sample.
    assessmentFocus: str = Field(default="", max_length=1000)


class GeneratedTestInput(BaseModel):
    """A hidden test input generated by the agent before reference execution calculates its output."""

    # The stable QOJ case number assigned to this hidden test.
    caseNo: int = Field(ge=1, le=200)
    # The untrusted input that must conform to the published constraints.
    input: str = Field(min_length=1, max_length=20000)
    # The reason the case belongs in the test suite, shown to a human reviewer.
    purpose: str = Field(default="", max_length=2000)


class GeneratedProblemCandidate(BaseModel):
    """Structured model output that contains all content required before a QOJ draft is created."""

    # The final title stored in QOJ after human approval.
    title: str = Field(min_length=1, max_length=200)
    # The full Markdown and LaTeX problem statement.
    statementMarkdown: str = Field(min_length=30, max_length=60000)
    # The Markdown and LaTeX input specification stored in QOJ.
    inputFormatMarkdown: str = Field(min_length=10, max_length=20000)
    # The Markdown and LaTeX output specification stored in QOJ.
    outputFormatMarkdown: str = Field(min_length=10, max_length=20000)
    # The C++17 reference solution used as the sole source of expected outputs.
    referenceSolutionCpp17: str = Field(min_length=100, max_length=120000)
    # The Markdown explanation of the standard solution for review and future learning.
    solutionExplanationMarkdown: str = Field(min_length=30, max_length=30000)
    # The tags sent to QOJ after normalization.
    tags: list[str] = Field(min_length=1, max_length=10)
    # The recommended QOJ time limit in milliseconds.
    timeLimit: int = Field(ge=100, le=60000)
    # The recommended QOJ memory limit in megabytes.
    memoryLimit: int = Field(ge=16, le=1024)
    # The QOJ difficulty from 1 through 5.
    difficulty: int = Field(ge=1, le=5)
    # The visible sample inputs and claimed outputs.
    samples: list[GeneratedSample] = Field(min_length=1, max_length=5)
    # The hidden test inputs whose outputs must be generated by the reference solution.
    hiddenTestInputs: list[GeneratedTestInput] = Field(min_length=3, max_length=200)

    @field_validator("tags")
    @classmethod
    def cleanTags(cls, value: list[str]) -> list[str]:
        """Normalize tags so QOJ receives concise, non-empty metadata values."""

        # The unique tag list keeps order and avoids duplicate QOJ tags.
        uniqueTags = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not uniqueTags:
            raise ValueError("At least one non-empty tag is required")
        return uniqueTags


class VerificationCase(BaseModel):
    """A QOJ-ready input/output pair derived from a verified reference solution execution."""

    # The QOJ case number, beginning at one.
    caseNo: int = Field(ge=1, le=200)
    # The normalized input sent to QOJ.
    input: str = Field(min_length=1)
    # The normalized output produced by the isolated reference solution.
    output: str = Field(min_length=1)
    # The hidden test purpose retained for human audit but not sent to QOJ.
    purpose: str = ""


class VerificationReport(BaseModel):
    """Structured quality-gate report persisted with every generated job."""

    # The aggregate status used to allow or block later export.
    status: Literal["PASSED", "FAILED", "BLOCKED", "SKIPPED"]
    # The hard failures that prevent human approval or QOJ export.
    errors: list[str] = Field(default_factory=list)
    # The non-blocking observations a reviewer should inspect.
    warnings: list[str] = Field(default_factory=list)
    # The output pairs that can safely be sent as hidden QOJ test cases.
    verifiedTestCases: list[VerificationCase] = Field(default_factory=list)
    # The output pairs that can safely be sent as visible QOJ samples.
    verifiedSamples: list[VerificationCase] = Field(default_factory=list)
    # The time each verification step took, kept for diagnostic visibility.
    durationMilliseconds: int = 0


class CriticReview(BaseModel):
    """Independent LLM review that checks consistency before the executable verification gate."""

    # Whether the critic found a contradiction serious enough to block export.
    hasCriticalIssues: bool
    # Specific statement, solution, or test-design contradictions.
    criticalIssues: list[str] = Field(default_factory=list)
    # Suggestions that do not automatically invalidate the candidate.
    suggestions: list[str] = Field(default_factory=list)


class ProgressEvent(BaseModel):
    """One persisted, actual workflow event streamed to the browser during a generation job."""

    # The monotonically increasing sequence lets SSE reconnect without rendering duplicate messages.
    sequence: int = Field(ge=1)
    # The UTC timestamp records when the real agent node or verifier emitted this event.
    createdAt: datetime
    # The stable machine-readable stage supports UI grouping without controlling the displayed text.
    phase: str = Field(min_length=1, max_length=100)
    # The event category distinguishes a normal update, repair, terminal failure, or terminal completion.
    level: Literal["INFO", "SUCCESS", "WARNING", "ERROR"]
    # The human-readable text is derived from real plan, candidate, validator, critic, or runner output.
    message: str = Field(min_length=1, max_length=4000)


class GenerationJob(BaseModel):
    """Persisted generation result displayed to the author and carried through manual review."""

    # The UUID used by API routes and SQLite persistence.
    id: str
    # The lifecycle status visible in the HTML application.
    status: Literal["GENERATING", "READY_FOR_REVIEW", "FAILED", "EXPORTED"]
    # The author-provided learning brief.
    brief: ProblemBrief
    # The plan generated before writing the problem statement.
    plan: ProblemPlan | None = None
    # The final candidate available for human review.
    candidate: GeneratedProblemCandidate | None = None
    # The local static, critic, and reference execution outcomes.
    staticReport: VerificationReport | None = None
    # The independent LLM consistency review.
    criticReview: CriticReview | None = None
    # The reference-solution execution outcome and QOJ-ready outputs.
    referenceReport: VerificationReport | None = None
    # Actual workflow events retained for reconnecting browsers and later audit.
    progressEvents: list[ProgressEvent] = Field(default_factory=list)
    # The review record that must approve export.
    humanReview: dict[str, Any] | None = None
    # The QOJ problem metadata returned after a successful DRAFT commit.
    qojExport: dict[str, Any] | None = None
    # A provider, schema, or workflow failure visible to the author without exposing any secret.
    failureReason: str | None = None
    # The UTC time at which the job was first created.
    createdAt: datetime
    # The UTC time of the most recent persistence change.
    updatedAt: datetime


class HumanReviewRequest(BaseModel):
    """Human decision that is mandatory even when all automatic checks have passed."""

    # The reviewer identity recorded beside the final QOJ export.
    reviewerName: str = Field(min_length=1, max_length=200)
    # The explicit approval switch required for export.
    approved: bool
    # Optional evidence, correction instructions, or rejection rationale.
    notes: str = Field(default="", max_length=10000)


class QojLoginRequest(BaseModel):
    """Teacher-account login data proxied to QOJ without persisting credentials or tokens."""

    # The dedicated QOJ teacher account name.
    username: str = Field(min_length=1, max_length=200)
    # The password forwarded once to QOJ over the operator's local backend connection.
    password: str = Field(min_length=1, max_length=500)
    # The QOJ image captcha identifier obtained from the captcha endpoint.
    captchaId: str = Field(min_length=1, max_length=200)
    # The human-entered image captcha value.
    captcha: str = Field(min_length=1, max_length=50)
    # The currently configured or explicitly selected QOJ base URL.
    qojBaseUrl: str = Field(min_length=8, max_length=500)


class QojManualSessionRequest(BaseModel):
    """A manually pasted QOJ access token that becomes a short-lived server-side browser session."""

    # The access token is forwarded once for validation and then kept only in backend process memory.
    accessToken: str = Field(min_length=1, max_length=5000)
    # The selected QOJ host is paired with the token before the server creates a session record.
    qojBaseUrl: str = Field(min_length=8, max_length=500)


class QojExportRequest(BaseModel):
    """Human-entered QOJ metadata submitted only when an approved candidate becomes a draft."""

    # A blank title makes the export retain the reviewed candidate's generated title.
    title: str | None = Field(default=None, max_length=200)
    # The optional QOJ folder is chosen at export time rather than during AI generation.
    folderId: int | None = Field(default=None, ge=1)
    # QOJ supports private, all-student, and major-scoped drafts while the export remains DRAFT-only.
    accessScope: Literal["PRIVATE", "ALL", "MAJOR"] = "PRIVATE"
    # The major ID becomes mandatory only when the selected scope is MAJOR.
    majorId: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validateMajorScope(self) -> "QojExportRequest":
        """Require a major identifier for a major-scoped QOJ draft before any QOJ mutation begins."""

        if self.accessScope == "MAJOR" and self.majorId is None:
            raise ValueError("majorId is required when accessScope is MAJOR")
        return self
