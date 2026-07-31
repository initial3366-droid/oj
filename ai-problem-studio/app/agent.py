"""LangGraph workflow for planning, generating, criticizing, repairing, and verifying QOJ problems."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Awaitable, Callable, Literal, Protocol, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from .codex_client import CodexAgentError
from .deepseek_client import DeepSeekApiError
from .models import CriticReview, GeneratedProblemCandidate, ProblemBrief, ProblemPlan, RuntimeSettings, VerificationReport
from .reference_runner import ReferenceSolutionRunner
from .validators import CandidateStaticValidator


ProgressCallback = Callable[[str, Literal["INFO", "SUCCESS", "WARNING", "ERROR"], str], Awaitable[None]]


class AgentGenerationError(RuntimeError):
    """Describe a failed agent phase with enough context for a human author to correct configuration or brief."""


class JsonCompletionClient(Protocol):
    """Define the structured completion contract shared by Codex and the legacy compatible client in tests."""

    async def completeJson(
        self,
        baseUrl: str,
        modelName: str,
        systemPrompt: str,
        userPrompt: str,
        temperature: float,
        reasoningEffort: str | None = None,
        progressCallback: ProgressCallback | None = None,
        progressPhase: str = "model",
    ) -> dict[str, Any]:
        """Return one JSON object for a LangGraph model phase."""


class AgentState(TypedDict, total=False):
    """LangGraph state carried through deterministic/model nodes plus an in-process progress callback."""

    # The original author intent that remains immutable throughout generation.
    brief: dict[str, Any]
    # The endpoint and model selection applied to this one job.
    runtimeSettings: dict[str, Any]
    # The agent's planned algorithmic design before it writes user-facing content.
    plan: dict[str, Any]
    # The current structured candidate, replaced only by an explicit repair node.
    candidate: dict[str, Any]
    # The latest static report for QOJ structure and Markdown/LaTeX constraints.
    staticReport: dict[str, Any]
    # The independent LLM critique for statement, standard solution, and tests.
    criticReview: dict[str, Any]
    # The Docker reference-solution execution report and QOJ-ready output pairs.
    referenceReport: dict[str, Any]
    # The number of repair iterations already consumed by the graph.
    revisionCount: int
    # The current actionable issues supplied to the repair prompt.
    currentIssues: list[str]
    # The final state used by the API to choose READY_FOR_REVIEW or FAILED.
    finalStatus: str
    # The ephemeral callback persists actual node outcomes without entering the final job artifact.
    progressCallback: ProgressCallback | None


class ProblemGenerationAgent:
    """Use LangGraph to keep AI problem creation explicit, bounded, auditable, and verification-gated."""

    def __init__(
        self,
        modelClient: JsonCompletionClient,
        staticValidator: CandidateStaticValidator,
        referenceRunner: ReferenceSolutionRunner,
    ) -> None:
        """Inject external provider and deterministic tools so workflow behavior is easy to test and replace."""

        # The Codex Agent client performs JSON-only completion turns while the protocol keeps tests provider-neutral.
        self.modelClient = modelClient
        # The validator catches formatting defects before a model-generated binary is compiled.
        self.staticValidator = staticValidator
        # The runner computes all expected outputs in a hardened Docker boundary.
        self.referenceRunner = referenceRunner
        # The bounded loop prevents a malformed prompt response from spending unbounded model budget.
        self.maximumRevisions = 2
        # The compiled graph is immutable after construction and safely reusable across FastAPI requests.
        self.workflow = self._buildWorkflow()

    async def generate(
        self,
        brief: ProblemBrief,
        runtimeSettings: RuntimeSettings,
        progressCallback: ProgressCallback | None = None,
    ) -> dict[str, Any]:
        """Run one complete LangGraph generation attempt and return its terminal artifact state."""

        # The initial state includes only non-secret job input and starts with no prior repair issues.
        initialState: AgentState = {
            "brief": brief.model_dump(),
            "runtimeSettings": runtimeSettings.model_dump(),
            "revisionCount": 0,
            "currentIssues": [],
            "progressCallback": progressCallback,
        }
        try:
            # LangGraph awaits all asynchronous model nodes and returns the terminal state dictionary.
            finalState = await self.workflow.ainvoke(initialState)
        except (CodexAgentError, DeepSeekApiError, ValidationError, AgentGenerationError) as error:
            raise AgentGenerationError(str(error)) from error
        except Exception as error:
            raise AgentGenerationError(f"Agent workflow failed unexpectedly: {error}") from error
        return dict(finalState)

    def _buildWorkflow(self):
        """Create the bounded state graph that enforces checks before review and export become possible."""

        # The state graph tracks a single candidate through plan, generation, validation, repair, and finish nodes.
        workflowBuilder = StateGraph(AgentState)
        workflowBuilder.add_node("planProblem", self._planProblem)
        workflowBuilder.add_node("generateCandidate", self._generateCandidate)
        workflowBuilder.add_node("validateCandidate", self._validateCandidate)
        workflowBuilder.add_node("criticCandidate", self._criticCandidate)
        workflowBuilder.add_node("verifyReference", self._verifyReference)
        workflowBuilder.add_node("reviseCandidate", self._reviseCandidate)
        workflowBuilder.add_node("finish", self._finish)
        workflowBuilder.add_edge(START, "planProblem")
        workflowBuilder.add_edge("planProblem", "generateCandidate")
        workflowBuilder.add_edge("generateCandidate", "validateCandidate")
        workflowBuilder.add_conditional_edges(
            "validateCandidate",
            self._routeAfterStaticValidation,
            {
                "criticCandidate": "criticCandidate",
                "reviseCandidate": "reviseCandidate",
                "finish": "finish",
            },
        )
        workflowBuilder.add_conditional_edges(
            "criticCandidate",
            self._routeAfterCriticReview,
            {
                "verifyReference": "verifyReference",
                "reviseCandidate": "reviseCandidate",
                "finish": "finish",
            },
        )
        workflowBuilder.add_conditional_edges(
            "verifyReference",
            self._routeAfterReferenceVerification,
            {"reviseCandidate": "reviseCandidate", "finish": "finish"},
        )
        workflowBuilder.add_edge("reviseCandidate", "validateCandidate")
        workflowBuilder.add_edge("finish", END)
        # Compilation catches malformed edge maps during application startup rather than during a user request.
        compiledWorkflow = workflowBuilder.compile()
        return compiledWorkflow

    async def _planProblem(self, state: AgentState) -> dict[str, Any]:
        """Translate the mandatory teaching brief into an algorithmic plan before writing the problem statement."""

        # The typed brief restores validation at the boundary between LangGraph state and prompt construction.
        brief = ProblemBrief.model_validate(state["brief"])
        # The runtime settings choose the model and provider endpoint for this individual job.
        runtimeSettings = RuntimeSettings.model_validate(state["runtimeSettings"])
        # The event reports the actual author-input dimensions before the first provider request begins.
        await self._emitProgress(
            state,
            "plan",
            "INFO",
            (
                f"正在依据 {len(brief.algorithmRequirements)} 项算法要求、"
                f"{len(brief.assessmentPoints)} 项考察点制定出题方案"
            ),
        )
        # The system prompt defines the non-negotiable role and output discipline of the planning phase.
        systemPrompt = (
            "You are a senior competitive-programming problem setter and pedagogy designer. "
            "Create a rigorous plan before writing any final problem. Return only a JSON object. "
            "Do not invent requirements absent from the author brief."
        )
        # The user prompt includes the exact plan schema so a JSON-mode gateway still receives field semantics.
        userPrompt = (
            "Author brief:\n"
            f"{json.dumps(brief.model_dump(), ensure_ascii=False, indent=2)}\n\n"
            "Return exactly this JSON object shape:\n"
            "{\n"
            '  "coreIdea": "string",\n'
            '  "solutionApproach": "string",\n'
            '  "timeComplexity": "string",\n'
            '  "memoryComplexity": "string",\n'
            '  "requiredEdgeCases": ["string"],\n'
            '  "sampleTeachingPlan": "string"\n'
            "}\n"
            "The plan must make every requested algorithm, assessment point, and sample assessment point observable."
        )
        # A low temperature makes the planning stage stable and easier to audit.
        planPayload = await self.modelClient.completeJson(
            runtimeSettings.deepseekBaseUrl,
            runtimeSettings.deepseekModel,
            systemPrompt,
            userPrompt,
            temperature=0.2,
            reasoningEffort=runtimeSettings.reasoningEffort,
            progressCallback=state.get("progressCallback"),
            progressPhase="plan",
        )
        # Pydantic turns loose JSON into a strict plan before later prompts rely on it.
        problemPlan = ProblemPlan.model_validate(planPayload)
        # The returned core idea gives the author concrete evidence that planning completed before candidate generation.
        await self._emitProgress(
            state,
            "plan",
            "SUCCESS",
            f"出题方案已完成：{self._compactText(problemPlan.coreIdea)}",
        )
        return {"plan": problemPlan.model_dump()}

    async def _generateCandidate(self, state: AgentState) -> dict[str, Any]:
        """Generate one complete QOJ candidate including C++17 standard solution and input-only tests."""

        # The typed values make prompt content safe from missing keys after the planning phase.
        brief = ProblemBrief.model_validate(state["brief"])
        # The plan is a required design contract for the candidate generation phase.
        problemPlan = ProblemPlan.model_validate(state["plan"])
        # Runtime configuration remains attached to the job rather than global mutable state.
        runtimeSettings = RuntimeSettings.model_validate(state["runtimeSettings"])
        # Candidate creation begins only after the validated plan is present in workflow state.
        await self._emitProgress(
            state,
            "candidate",
            "INFO",
            "正在依据已确认的方案生成 QOJ 题面、标程、样例和隐藏测试输入",
        )
        # The system prompt embeds QOJ-specific quality requirements that the static validator subsequently enforces.
        systemPrompt = (
            "You are an expert Chinese competitive-programming problem setter. Produce a complete, original, "
            "self-contained QOJ problem candidate. Return only one JSON object, never Markdown fencing. "
            "The problem must use exact-output judging: avoid interactive tasks, special judges, and floating-point "
            "comparisons unless an exact integer transformation removes ambiguity. The C++17 reference solution must "
            "compile independently and match every written constraint. All hidden inputs must be valid and diverse."
        )
        # The detailed schema makes field names unambiguous for a generic OpenAI-compatible JSON endpoint.
        userPrompt = self._candidatePrompt(brief, problemPlan)
        # Moderate temperature allows fresh problem instances while schema validation and review contain risk.
        candidatePayload = await self.modelClient.completeJson(
            runtimeSettings.deepseekBaseUrl,
            runtimeSettings.deepseekModel,
            systemPrompt,
            userPrompt,
            temperature=0.45,
            reasoningEffort=runtimeSettings.reasoningEffort,
            progressCallback=state.get("progressCallback"),
            progressPhase="candidate",
        )
        # Pydantic rejects omissions and oversized generated artifacts before the candidate enters Docker.
        candidate = GeneratedProblemCandidate.model_validate(candidatePayload)
        # The title and generated case counts are derived from the candidate rather than a frontend progress template.
        await self._emitProgress(
            state,
            "candidate",
            "SUCCESS",
            (
                f"候选题目《{self._compactText(candidate.title, 200)}》已生成，"
                f"包含 {len(candidate.samples)} 个样例和 {len(candidate.hiddenTestInputs)} 个隐藏测试输入"
            ),
        )
        return {"candidate": candidate.model_dump()}

    async def _validateCandidate(self, state: AgentState) -> dict[str, Any]:
        """Run deterministic structural checks before any critic prompt or untrusted C++ execution occurs."""

        # The current candidate is revalidated after initial generation or a repair iteration.
        candidate = GeneratedProblemCandidate.model_validate(state["candidate"])
        # The event identifies the exact candidate that is being checked after generation or a revision.
        await self._emitProgress(
            state,
            "static-validation",
            "INFO",
            f"正在校验《{self._compactText(candidate.title, 200)}》的 Markdown、LaTeX 和 QOJ 字段结构",
        )
        # The static report contains no external side effects and is immediately persisted by the API caller.
        staticReport = self.staticValidator.validate(candidate)
        # Errors become the only repair instructions when structure is invalid.
        currentIssues = staticReport.errors if staticReport.status != "PASSED" else []
        # The reported counts come directly from deterministic validator output.
        if staticReport.status == "PASSED":
            await self._emitProgress(
                state,
                "static-validation",
                "SUCCESS",
                f"结构校验通过，发现 {len(staticReport.warnings)} 条非阻断提示",
            )
        else:
            await self._emitProgress(
                state,
                "static-validation",
                "WARNING",
                f"结构校验发现 {len(staticReport.errors)} 个阻断项，将根据这些实际问题修订",
            )
        return {"staticReport": staticReport.model_dump(), "currentIssues": currentIssues}

    async def _criticCandidate(self, state: AgentState) -> dict[str, Any]:
        """Ask a separate low-temperature model pass to find specification, solution, sample, and test contradictions."""

        # The typed brief keeps the critic grounded in original teaching objectives rather than only generated text.
        brief = ProblemBrief.model_validate(state["brief"])
        # The plan helps the critic detect a candidate that drifts away from intended algorithms.
        problemPlan = ProblemPlan.model_validate(state["plan"])
        # The candidate includes standard solution and all inputs so the critic can inspect cross-field consistency.
        candidate = GeneratedProblemCandidate.model_validate(state["candidate"])
        # The provider settings match the original job so an operator can reproduce a review result later.
        runtimeSettings = RuntimeSettings.model_validate(state["runtimeSettings"])
        # Independent review begins only after structural validation has allowed the candidate forward.
        await self._emitProgress(
            state,
            "critic",
            "INFO",
            f"正在独立审查《{self._compactText(candidate.title, 200)}》的题面、标程、样例和测试一致性",
        )
        # The critic is deliberately not asked to revise content; that separation keeps audit history comprehensible.
        systemPrompt = (
            "You are an adversarial competitive-programming problem reviewer. Return only JSON. "
            "Find contradictions among the author brief, statement, input/output formats, C++17 solution, samples, "
            "and hidden inputs. Mark a problem critical only when it could produce wrong judging, impossible input, "
            "an unsound algorithm, an ambiguous specification, or a mismatch with the declared teaching goal."
        )
        # The full candidate is intentional: shallow reviews that omit code or tests cannot establish consistency.
        userPrompt = (
            "Author brief:\n"
            f"{json.dumps(brief.model_dump(), ensure_ascii=False)}\n\n"
            "Problem plan:\n"
            f"{json.dumps(problemPlan.model_dump(), ensure_ascii=False)}\n\n"
            "Candidate:\n"
            f"{json.dumps(candidate.model_dump(), ensure_ascii=False)}\n\n"
            "Return exactly:\n"
            "{\n"
            '  "hasCriticalIssues": true,\n'
            '  "criticalIssues": ["specific actionable issue"],\n'
            '  "suggestions": ["optional improvement"]\n'
            "}"
        )
        # Near-deterministic review reduces noise in the gate that decides whether the candidate is repaired.
        criticPayload = await self.modelClient.completeJson(
            runtimeSettings.deepseekBaseUrl,
            runtimeSettings.deepseekModel,
            systemPrompt,
            userPrompt,
            temperature=0.1,
            reasoningEffort=runtimeSettings.reasoningEffort,
            progressCallback=state.get("progressCallback"),
            progressPhase="critic",
        )
        # Pydantic gives the routing node a strict boolean and lists instead of untrusted arbitrary JSON.
        criticReview = CriticReview.model_validate(criticPayload)
        # Critical issues, not optional suggestions, become repair input to avoid unnecessary content churn.
        currentIssues = criticReview.criticalIssues if criticReview.hasCriticalIssues else []
        # Critical issue and suggestion totals are derived from the critic's structured response.
        if criticReview.hasCriticalIssues:
            await self._emitProgress(
                state,
                "critic",
                "WARNING",
                f"独立审题发现 {len(criticReview.criticalIssues)} 个关键问题，将进入修订",
            )
        else:
            await self._emitProgress(
                state,
                "critic",
                "SUCCESS",
                f"独立审题通过，发现 {len(criticReview.suggestions)} 条非阻断建议",
            )
        return {"criticReview": criticReview.model_dump(), "currentIssues": currentIssues}

    async def _verifyReference(self, state: AgentState) -> dict[str, Any]:
        """Compile and execute the candidate C++17 standard solution in Docker to obtain canonical outputs."""

        # The candidate is validated once more before passing model-generated code to the isolated runner.
        candidate = GeneratedProblemCandidate.model_validate(state["candidate"])
        # The case counts identify exactly what the isolated reference run is about to execute.
        await self._emitProgress(
            state,
            "reference-runner",
            "INFO",
            (
                "正在隔离环境中编译标程并执行 "
                f"{len(candidate.samples)} 个样例和 {len(candidate.hiddenTestInputs)} 个隐藏测试"
            ),
        )
        # The measurement includes compilation and all executions performed by the runner call.
        startedAt = time.perf_counter()
        # Running subprocess work in a worker thread keeps FastAPI's asynchronous event loop responsive.
        referenceReport = await asyncio.to_thread(self.referenceRunner.verify, candidate)
        elapsedMilliseconds = int((time.perf_counter() - startedAt) * 1000)
        # Runner failures are returned as repair issues rather than silently allowing human approval.
        currentIssues = referenceReport.errors if referenceReport.status != "PASSED" else []
        # The persisted duration uses the runner's own report when present and the local timing as a fallback.
        durationMilliseconds = referenceReport.durationMilliseconds or elapsedMilliseconds
        if referenceReport.status == "PASSED":
            await self._emitProgress(
                state,
                "reference-runner",
                "SUCCESS",
                (
                    "标程验证通过：已得到 "
                    f"{len(referenceReport.verifiedSamples)} 个样例和 "
                    f"{len(referenceReport.verifiedTestCases)} 个隐藏测试的标准输出，耗时 {durationMilliseconds}ms"
                ),
            )
        else:
            await self._emitProgress(
                state,
                "reference-runner",
                "WARNING",
                f"标程验证发现 {len(referenceReport.errors)} 个阻断项，耗时 {durationMilliseconds}ms，将进入修订",
            )
        return {"referenceReport": referenceReport.model_dump(), "currentIssues": currentIssues}

    async def _reviseCandidate(self, state: AgentState) -> dict[str, Any]:
        """Repair the current structured candidate using only explicit failed-gate issues and the immutable brief."""

        # The original intent prevents repairs from solving validation defects by changing learning objectives.
        brief = ProblemBrief.model_validate(state["brief"])
        # The plan remains the original design contract throughout all repair cycles.
        problemPlan = ProblemPlan.model_validate(state["plan"])
        # The previous candidate gives the model a concrete revision target instead of asking it to start over blindly.
        candidate = GeneratedProblemCandidate.model_validate(state["candidate"])
        # The runtime selection remains stable so repair calls use the same configured provider and model.
        runtimeSettings = RuntimeSettings.model_validate(state["runtimeSettings"])
        # Current issues originate only from static validation, critic review, or Docker verification.
        currentIssues = state.get("currentIssues", [])
        # The new count is checked by routes before this node is reached and is retained for auditability.
        nextRevisionCount = state.get("revisionCount", 0) + 1
        # The short issue summary is sourced from the failed gate and makes each repair cause auditable.
        issueSummary = self._compactText(currentIssues[0], 240) if currentIssues else "未提供具体阻断项"
        await self._emitProgress(
            state,
            "revision",
            "INFO",
            (
                f"开始第 {nextRevisionCount}/{self.maximumRevisions} 轮修订，处理 "
                f"{len(currentIssues)} 项阻断问题：{issueSummary}"
            ),
        )
        # The system prompt forces complete JSON replacement so Pydantic can validate the repaired result uniformly.
        systemPrompt = (
            "You are repairing a competitive-programming problem candidate. Return only the complete replacement JSON "
            "object with exactly the original candidate schema. Preserve valid content where possible, but fix every "
            "listed issue. Keep QOJ Markdown plus LaTeX, exact-output judging, valid hidden inputs, and a complete "
            "C++17 reference solution. Do not merely describe fixes."
        )
        # The repair prompt exposes all relevant artifacts without permitting it to rewrite the user intent.
        userPrompt = (
            "Immutable author brief:\n"
            f"{json.dumps(brief.model_dump(), ensure_ascii=False)}\n\n"
            "Immutable plan:\n"
            f"{json.dumps(problemPlan.model_dump(), ensure_ascii=False)}\n\n"
            "Candidate to repair:\n"
            f"{json.dumps(candidate.model_dump(), ensure_ascii=False)}\n\n"
            "Blocking issues:\n"
            f"{json.dumps(currentIssues, ensure_ascii=False)}\n\n"
            "Return the full candidate object with these fields exactly: title, statementMarkdown, "
            "inputFormatMarkdown, outputFormatMarkdown, referenceSolutionCpp17, solutionExplanationMarkdown, tags, "
            "timeLimit, memoryLimit, difficulty, samples, hiddenTestInputs."
        )
        # Lower temperature makes correction more literal after an evidence-based validation failure.
        revisedPayload = await self.modelClient.completeJson(
            runtimeSettings.deepseekBaseUrl,
            runtimeSettings.deepseekModel,
            systemPrompt,
            userPrompt,
            temperature=0.2,
            reasoningEffort=runtimeSettings.reasoningEffort,
            progressCallback=state.get("progressCallback"),
            progressPhase="revision",
        )
        # A repaired object is held to the same schema as the first generation.
        revisedCandidate = GeneratedProblemCandidate.model_validate(revisedPayload)
        # The replacement title makes it clear that a complete candidate, not a partial patch, was generated.
        await self._emitProgress(
            state,
            "revision",
            "SUCCESS",
            f"第 {nextRevisionCount} 轮修订已生成新的完整候选题目《{self._compactText(revisedCandidate.title, 200)}》",
        )
        return {
            "candidate": revisedCandidate.model_dump(),
            "revisionCount": nextRevisionCount,
            "currentIssues": [],
        }

    async def _finish(self, state: AgentState) -> dict[str, Any]:
        """Derive the terminal lifecycle status; only a fully verified candidate reaches human review."""

        # The static report is absent only when an upstream provider or schema failure interrupted the graph.
        staticReport = VerificationReport.model_validate(state["staticReport"]) if state.get("staticReport") else None
        # The critic review is absent when static validation exhausted repair budget before critique.
        criticReview = CriticReview.model_validate(state["criticReview"]) if state.get("criticReview") else None
        # The reference report is absent when prior gates failed or exhausted their repair budget.
        referenceReport = (
            VerificationReport.model_validate(state["referenceReport"]) if state.get("referenceReport") else None
        )
        # All three gates must be affirmative before a human can approve and export the problem.
        canReview = (
            staticReport is not None
            and staticReport.status == "PASSED"
            and criticReview is not None
            and not criticReview.hasCriticalIssues
            and referenceReport is not None
            and referenceReport.status == "PASSED"
        )
        # A failed state is preserved for audit but cannot be approved or exported through the API.
        finalStatus = "READY_FOR_REVIEW" if canReview else "FAILED"
        # The terminal text reports the actual gate outcome that determines whether human review can begin.
        if canReview:
            await self._emitProgress(state, "finish", "SUCCESS", "自动校验完成，题目已进入人工审核")
        else:
            failedPhases = []
            if staticReport is None or staticReport.status != "PASSED":
                failedPhases.append("结构校验")
            if criticReview is None or criticReview.hasCriticalIssues:
                failedPhases.append("独立审题")
            if referenceReport is None or referenceReport.status != "PASSED":
                failedPhases.append("标程验证")
            await self._emitProgress(
                state,
                "finish",
                "ERROR",
                f"自动校验结束，未通过的节点：{'、'.join(failedPhases) or '未知节点'}",
            )
        return {"finalStatus": finalStatus}

    async def _emitProgress(
        self,
        state: AgentState,
        phase: str,
        level: Literal["INFO", "SUCCESS", "WARNING", "ERROR"],
        message: str,
    ) -> None:
        """Forward one actual workflow event to the caller when this generation run registered a callback."""

        # The callback stays in per-run state so simultaneous jobs cannot send events to one another.
        progressCallback = state.get("progressCallback")
        if progressCallback is not None:
            await progressCallback(phase, level, message)

    def _compactText(self, sourceText: str, maximumLength: int = 500) -> str:
        """Normalize model text into a bounded one-line progress fragment suitable for event storage and UI rendering."""

        # Whitespace compaction prevents a model-generated newline from turning one progress record into many visual rows.
        compactText = " ".join(sourceText.split())
        if len(compactText) <= maximumLength:
            return compactText
        # The suffix preserves an explicit signal that only the event summary, never the stored artifact, was shortened.
        return f"{compactText[: maximumLength - 3]}..."

    def _routeAfterStaticValidation(self, state: AgentState) -> str:
        """Send structural failures to bounded repair, otherwise continue to independent critic review."""

        # Static validation is strict and is always present after the validation node executes.
        staticReport = VerificationReport.model_validate(state["staticReport"])
        if staticReport.status == "PASSED":
            return "criticCandidate"
        # Only a finite number of revisions can consume model calls in one user-triggered job.
        if state.get("revisionCount", 0) < self.maximumRevisions:
            return "reviseCandidate"
        return "finish"

    def _routeAfterCriticReview(self, state: AgentState) -> str:
        """Send critical contradictions to repair, otherwise allow Docker standard-solution verification."""

        # The critic returns a schema-validated boolean rather than free-form prose routing instructions.
        criticReview = CriticReview.model_validate(state["criticReview"])
        if not criticReview.hasCriticalIssues:
            return "verifyReference"
        # Bounded repair preserves an audit trail and prevents infinite critic-repair oscillation.
        if state.get("revisionCount", 0) < self.maximumRevisions:
            return "reviseCandidate"
        return "finish"

    def _routeAfterReferenceVerification(self, state: AgentState) -> str:
        """Repair compilation/output failures when budget remains, otherwise finish as an unexportable failure."""

        # The runner report is the mandatory executable correctness gate for expected outputs.
        referenceReport = VerificationReport.model_validate(state["referenceReport"])
        if referenceReport.status == "PASSED":
            return "finish"
        # Generated code errors are routed through the same complete-candidate repair path as other defects.
        if state.get("revisionCount", 0) < self.maximumRevisions:
            return "reviseCandidate"
        return "finish"

    def _candidatePrompt(self, brief: ProblemBrief, problemPlan: ProblemPlan) -> str:
        """Build the detailed candidate contract so generated content maps directly to QOJ fields and checks."""

        # The schema explanation is compact enough for a model prompt but explicit enough for Pydantic fields.
        schemaDescription = (
            "Return exactly these fields: "
            "title (string), statementMarkdown (string), inputFormatMarkdown (string), "
            "outputFormatMarkdown (string), referenceSolutionCpp17 (string), "
            "solutionExplanationMarkdown (string), tags (string array), timeLimit (integer milliseconds), "
            "memoryLimit (integer MB), difficulty (1..5), samples (array), hiddenTestInputs (array). "
            "Each samples item has input, expectedOutput, explanationMarkdown, assessmentFocus. "
            "Each hiddenTestInputs item has unique caseNo starting at 1, input, purpose."
        )
        # The production requirements make later deterministic checks understandable to the provider model.
        productionRequirements = (
            "Use Chinese. statementMarkdown must start with `## 题目描述`, include `## 数据范围`, and use Markdown "
            "and LaTeX such as `$n$`. inputFormatMarkdown must start with `## 输入格式` and use LaTeX. "
            "outputFormatMarkdown must start with `## 输出格式` and use LaTeX. Include at least two samples and "
            "8 to 30 hidden inputs covering boundaries, ordinary values, adversarial structures, and maximum-scale "
            "representatives. The reference solution must be full C++17 source with `int main`. Do not use external "
            "files, random behavior, or nonstandard libraries. Hidden inputs must contain input only; their outputs "
            "will be calculated by a sandboxed reference run."
        )
        # The prompt data is serialized rather than formatted manually to preserve all author-provided constraints.
        prompt = (
            "Author brief:\n"
            f"{json.dumps(brief.model_dump(), ensure_ascii=False, indent=2)}\n\n"
            "Approved problem plan:\n"
            f"{json.dumps(problemPlan.model_dump(), ensure_ascii=False, indent=2)}\n\n"
            f"{schemaDescription}\n\n{productionRequirements}"
        )
        return prompt
