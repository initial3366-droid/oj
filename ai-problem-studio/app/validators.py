"""Deterministic checks performed before model-produced code is allowed into the Docker runner."""

from __future__ import annotations

import re

from .models import GeneratedProblemCandidate, VerificationReport


class CandidateStaticValidator:
    """Validate required QOJ fields, Markdown/LaTeX conventions, and basic test-suite integrity."""

    def validate(self, candidate: GeneratedProblemCandidate) -> VerificationReport:
        """Return a blocking report for structural defects that do not require code execution to detect."""

        # The error list contains defects that must be repaired before the agent may continue.
        errorMessages: list[str] = []
        # The warning list contains reviewer-visible concerns that do not automatically block the flow.
        warningMessages: list[str] = []
        # The three QOJ Markdown fields are checked uniformly for delimiter balance and usable structure.
        markdownFields = {
            "statementMarkdown": candidate.statementMarkdown,
            "inputFormatMarkdown": candidate.inputFormatMarkdown,
            "outputFormatMarkdown": candidate.outputFormatMarkdown,
        }
        for fieldName, fieldValue in markdownFields.items():
            self._validateMarkdownField(fieldName, fieldValue, errorMessages)
        # The C++ entry point is a necessary but intentionally shallow precondition before isolated compile.
        if "int main" not in candidate.referenceSolutionCpp17:
            errorMessages.append("Reference solution must define an int main entry point")
        # The source size bound protects the Docker runner from oversized untrusted model responses.
        if len(candidate.referenceSolutionCpp17.encode("utf-8")) > 120000:
            errorMessages.append("Reference solution exceeds the 120 KB source limit")
        # Case numbers must be unique so QOJ test ordering remains deterministic.
        caseNumbers = [testCase.caseNo for testCase in candidate.hiddenTestInputs]
        if len(set(caseNumbers)) != len(caseNumbers):
            errorMessages.append("Hidden test case numbers must be unique")
        # Execution cost is intentionally capped even though QOJ itself accepts up to two hundred cases.
        if len(candidate.hiddenTestInputs) > 50:
            errorMessages.append("At most 50 hidden test inputs may be reference-verified in one job")
        # At least two samples make the requested sample-learning design inspectable by a reviewer.
        if len(candidate.samples) < 2:
            warningMessages.append("Only one visible sample was generated; add an edge-case sample during review")
        # Small generated tests often indicate the agent did not instantiate the requested input scale.
        if len(candidate.hiddenTestInputs) < 8:
            warningMessages.append("Fewer than eight hidden tests were generated; review coverage carefully")
        # The final status determines whether the graph enters critic review or a repair iteration.
        reportStatus = "FAILED" if errorMessages else "PASSED"
        return VerificationReport(status=reportStatus, errors=errorMessages, warnings=warningMessages)

    def _validateMarkdownField(self, fieldName: str, fieldValue: str, errorMessages: list[str]) -> None:
        """Check Markdown heading, code fence, and LaTeX delimiter consistency for one QOJ text field."""

        # A heading is required by the agent prompt to make the exported statement easy to scan in QOJ.
        if "#" not in fieldValue:
            errorMessages.append(f"{fieldName} must contain a Markdown heading")
        # An odd number of fences makes QOJ rendering ambiguous and is always a blocking defect.
        if fieldValue.count("```") % 2 != 0:
            errorMessages.append(f"{fieldName} contains an unmatched Markdown code fence")
        # The requested output contract requires Markdown plus LaTeX notation in each text field.
        if not self._containsLatex(fieldValue):
            errorMessages.append(f"{fieldName} must include LaTeX notation such as $n$ or \\(n\\)")
        # Delimiter imbalance is more likely a broken prompt response than meaningful content.
        if not self._hasBalancedLatexDelimiters(fieldValue):
            errorMessages.append(f"{fieldName} contains unbalanced LaTeX delimiters")

    def _containsLatex(self, fieldValue: str) -> bool:
        """Detect a conventional inline or display LaTeX delimiter in one Markdown field."""

        # The patterns intentionally cover common QOJ Markdown math delimiters.
        latexPatterns = ("$", "\\(", "\\[", "$$")
        return any(pattern in fieldValue for pattern in latexPatterns)

    def _hasBalancedLatexDelimiters(self, fieldValue: str) -> bool:
        """Check simple escaped-dollar and bracket delimiter balance without rewriting user content."""

        # Escaped dollars are removed because they represent literal currency or text rather than math.
        withoutEscapedDollars = re.sub(r"\\\\\$", "", fieldValue)
        # Display delimiters are counted first and removed before single-dollar analysis.
        displayDelimiterCount = withoutEscapedDollars.count("$$")
        if displayDelimiterCount % 2 != 0:
            return False
        # Removing paired display delimiters leaves only potential inline dollar markers.
        withoutDisplayDelimiters = withoutEscapedDollars.replace("$$", "")
        if withoutDisplayDelimiters.count("$") % 2 != 0:
            return False
        # Parenthesized and bracketed LaTeX delimiters require matching open and close counts.
        parenthesisBalanced = withoutDisplayDelimiters.count("\\(") == withoutDisplayDelimiters.count("\\)")
        bracketBalanced = withoutDisplayDelimiters.count("\\[") == withoutDisplayDelimiters.count("\\]")
        return parenthesisBalanced and bracketBalanced

