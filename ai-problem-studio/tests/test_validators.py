"""Focused deterministic tests for Markdown/LaTeX gates and reference-output normalization."""

from app.models import GeneratedProblemCandidate, GeneratedSample, GeneratedTestInput
from app.reference_runner import ReferenceSolutionRunner
from app.validators import CandidateStaticValidator


def buildCandidate() -> GeneratedProblemCandidate:
    """Create a structurally valid small candidate for deterministic unit tests without calling a model or Docker."""

    # The full C++ source exceeds the schema minimum and includes an executable entry point.
    sourceCode = """#include <iostream>
int main() {
    long long n = 0;
    std::cin >> n;
    std::cout << n + 1 << '\\n';
    return 0;
}
"""
    # Two samples make the sample warning path inactive in the normal validation test.
    sampleCases = [
        GeneratedSample(input="1\n", expectedOutput="2\n", explanationMarkdown="解释 $1+1=2$", assessmentFocus="基础"),
        GeneratedSample(input="9\n", expectedOutput="10\n", explanationMarkdown="解释 $9+1=10$", assessmentFocus="边界"),
    ]
    # Eight inputs satisfy the static runner-coverage recommendation without requiring Docker execution.
    hiddenInputs = [
        GeneratedTestInput(caseNo=caseNumber, input=f"{caseNumber}\n", purpose="基础覆盖")
        for caseNumber in range(1, 9)
    ]
    # The candidate fields use the exact agent JSON schema consumed by QOJ export code.
    candidate = GeneratedProblemCandidate(
        title="后继数",
        statementMarkdown="## 题目描述\n给定整数 $n$，输出它的后继。\n\n## 数据范围\n$0 \\le n \\le 10^9$。",
        inputFormatMarkdown="## 输入格式\n输入一个整数 $n$。",
        outputFormatMarkdown="## 输出格式\n输出整数 $n+1$。",
        referenceSolutionCpp17=sourceCode,
        solutionExplanationMarkdown="使用 $O(1)$ 算术计算即可：读取整数后加一并输出，不需要额外数组或循环。",
        tags=["math"],
        timeLimit=1000,
        memoryLimit=256,
        difficulty=1,
        samples=sampleCases,
        hiddenTestInputs=hiddenInputs,
    )
    return candidate


def testValidCandidatePassesStaticValidation() -> None:
    """Confirm a Markdown/LaTeX-compliant QOJ candidate crosses the deterministic gate."""

    # The validator has no external dependencies and can run in a fast unit test.
    validator = CandidateStaticValidator()
    # The test candidate is structurally valid before it would enter Docker compilation.
    candidate = buildCandidate()
    # The report must remain export-eligible at this purely static stage.
    report = validator.validate(candidate)
    assert report.status == "PASSED"
    assert report.errors == []


def testUnbalancedLatexBlocksCandidate() -> None:
    """Confirm unmatched inline LaTeX delimiters cannot bypass the QOJ formatting gate."""

    # The valid fixture isolates this test to one malformed Markdown/LaTeX field.
    candidate = buildCandidate().model_copy(
        update={"inputFormatMarkdown": "## 输入格式\n输入 $n。"}
    )
    # The validator must convert the delimiter defect into a blocking error.
    report = CandidateStaticValidator().validate(candidate)
    assert report.status == "FAILED"
    assert any("unbalanced LaTeX" in errorMessage for errorMessage in report.errors)


def testOutputNormalizationUsesOneTrailingNewline() -> None:
    """Confirm reference-derived QOJ output is stable despite platform line endings and trailing spaces."""

    # The runner method is independent from Docker settings, so an uninitialized instance is sufficient here.
    runner = object.__new__(ReferenceSolutionRunner)
    # The source output includes CRLF and trailing whitespace that must not leak into QOJ expected output.
    sourceOutput = "1  \r\n2\t\r\n\r\n"
    # Exact comparison should use a single normalized trailing newline.
    normalizedOutput = runner._normalizeOutput(sourceOutput)
    assert normalizedOutput == "1\n2\n"
