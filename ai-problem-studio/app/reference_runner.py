"""Docker-isolated C++17 compilation and execution used to derive every QOJ expected output."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from .config import AppSettings
from .models import GeneratedProblemCandidate, VerificationCase, VerificationReport


class ReferenceRunnerError(RuntimeError):
    """Explain why isolated standard-solution verification could not complete safely."""


class ReferenceSolutionRunner:
    """Compile and run untrusted model-generated C++ only inside a resource-constrained Docker container."""

    def __init__(self, appSettings: AppSettings) -> None:
        """Capture immutable Docker image and resource limits from server-side configuration."""

        # The process settings define all container resource constraints.
        self.appSettings = appSettings

    def verify(self, candidate: GeneratedProblemCandidate) -> VerificationReport:
        """Compile the reference program and calculate outputs for samples and hidden test inputs."""

        # The monotonic start time lets reports show how expensive verification was.
        startedAt = time.monotonic()
        # The accumulated errors block QOJ export rather than trusting a partial test suite.
        errorMessages: list[str] = []
        # The warning list captures mismatch signals that human reviewers should inspect.
        warningMessages: list[str] = []
        # The verified samples are QOJ-ready only after their output comes from compiled code.
        verifiedSamples: list[VerificationCase] = []
        # The verified hidden cases are QOJ-ready only after their output comes from compiled code.
        verifiedTestCases: list[VerificationCase] = []
        try:
            self._assertDockerAvailable()
            # A unique temporary directory prevents generated code from touching project source or job data.
            with tempfile.TemporaryDirectory(prefix="ai-problem-studio-") as temporaryDirectoryName:
                # The bind-mounted work directory is the only writable container-visible host path.
                workDirectory = Path(temporaryDirectoryName)
                # The source file is compiled by Docker rather than by a host compiler.
                sourcePath = workDirectory / "main.cpp"
                sourcePath.write_text(candidate.referenceSolutionCpp17, encoding="utf-8")
                self._compile(workDirectory)
                for sampleIndex, sampleCase in enumerate(candidate.samples, start=1):
                    # The executable output becomes the canonical QOJ output for this visible sample.
                    actualOutput = self._runCase(workDirectory, sampleCase.input)
                    # The normalized output removes insignificant trailing whitespace before comparison.
                    expectedOutput = self._normalizeOutput(sampleCase.expectedOutput)
                    if actualOutput != expectedOutput:
                        errorMessages.append(
                            f"Sample {sampleIndex} claimed output differs from reference solution output: "
                            f"expected {expectedOutput!r}, actual {actualOutput!r}"
                        )
                    verifiedSamples.append(
                        VerificationCase(
                            caseNo=sampleIndex,
                            input=self._normalizeInput(sampleCase.input),
                            output=actualOutput,
                            purpose=sampleCase.assessmentFocus,
                        )
                    )
                for hiddenTest in candidate.hiddenTestInputs:
                    # Each hidden input is executed independently to prevent state leakage between cases.
                    actualOutput = self._runCase(workDirectory, hiddenTest.input)
                    verifiedTestCases.append(
                        VerificationCase(
                            caseNo=hiddenTest.caseNo,
                            input=self._normalizeInput(hiddenTest.input),
                            output=actualOutput,
                            purpose=hiddenTest.purpose,
                        )
                    )
        except ReferenceRunnerError as error:
            errorMessages.append(str(error))
        # The duration is included even after failure to diagnose a timeout or unavailable Docker daemon.
        durationMilliseconds = int((time.monotonic() - startedAt) * 1000)
        # A fully successful report is the only reference status that permits QOJ export.
        reportStatus = "PASSED" if not errorMessages else "FAILED"
        return VerificationReport(
            status=reportStatus,
            errors=errorMessages,
            warnings=warningMessages,
            verifiedSamples=verifiedSamples,
            verifiedTestCases=verifiedTestCases,
            durationMilliseconds=durationMilliseconds,
        )

    def _assertDockerAvailable(self) -> None:
        """Fail closed when Docker is absent or its daemon cannot answer a harmless version request."""

        # The executable lookup avoids constructing a shell command from untrusted input.
        dockerExecutable = shutil.which("docker")
        if dockerExecutable is None:
            raise ReferenceRunnerError("Docker is not installed; reference verification is blocked")
        try:
            # The version command does not alter images, containers, or QOJ state.
            versionResult = subprocess.run(
                [dockerExecutable, "version", "--format", "{{.Server.Version}}"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise ReferenceRunnerError("Docker daemon is unavailable; reference verification is blocked") from error
        if versionResult.returncode != 0:
            raise ReferenceRunnerError("Docker daemon is unavailable; reference verification is blocked")

    def _compile(self, workDirectory: Path) -> None:
        """Compile `main.cpp` into a local bind-mounted executable through the isolated compiler image."""

        # The compiler arguments require portable C++17 and avoid executing an arbitrary shell script.
        compilerArguments = ["g++", "-std=c++17", "-O2", "-pipe", "main.cpp", "-o", "solution"]
        # The Docker command receives a fixed image and fixed compiler arguments only.
        dockerCommand = self._dockerCommand(workDirectory, compilerArguments)
        # Compilation has the same timeout and isolation policy as testcase execution.
        compileResult = self._runDockerCommand(dockerCommand, None)
        if compileResult.returncode != 0:
            # The compiler diagnostics are intentionally truncated before becoming an API-visible error.
            compilerError = compileResult.stderr.decode("utf-8", errors="replace")[-3000:]
            raise ReferenceRunnerError(f"Reference solution failed to compile: {compilerError}")
        # The host filesystem check confirms that the compiler actually emitted the intended binary.
        solutionPath = workDirectory / "solution"
        if not solutionPath.exists():
            raise ReferenceRunnerError("Reference compiler did not create the solution executable")

    def _runCase(self, workDirectory: Path, inputText: str) -> str:
        """Run one test input in a fresh offline container and return normalized non-empty output."""

        # The executable path is fixed and created by the previous isolated compilation step.
        executionArguments = ["/workspace/solution"]
        # The Docker invocation stays free of shell interpolation or model-supplied command arguments.
        dockerCommand = self._dockerCommand(workDirectory, executionArguments)
        # The normalized input protects QOJ and the executable from inconsistent final newlines.
        normalizedInput = self._normalizeInput(inputText)
        # The process receives test input only via standard input, not files or command arguments.
        executionResult = self._runDockerCommand(dockerCommand, normalizedInput.encode("utf-8"))
        if executionResult.returncode != 0:
            # The bounded stderr helps identify crashes while avoiding an unbounded model-generated log.
            executionError = executionResult.stderr.decode("utf-8", errors="replace")[-3000:]
            raise ReferenceRunnerError(f"Reference solution exited abnormally: {executionError}")
        # QOJ requires expected output to be non-blank, so an empty program result blocks export.
        normalizedOutput = self._normalizeOutput(executionResult.stdout.decode("utf-8", errors="replace"))
        if not normalizedOutput.strip():
            raise ReferenceRunnerError("Reference solution produced empty output for a required test case")
        return normalizedOutput

    def _dockerCommand(self, workDirectory: Path, containerArguments: list[str]) -> list[str]:
        """Build a fixed hardened Docker command around a temporary bind-mounted work directory."""

        # The memory string is accepted by Docker and comes only from operator-controlled settings.
        memoryLimit = f"{self.appSettings.referenceRunnerMemoryMb}m"
        # The explicit absolute path avoids host working-directory ambiguity inside Docker Desktop.
        # Docker bind mounts are writable by default; `readonly` is the only access-mode key accepted here.
        mountSpecification = f"type=bind,src={workDirectory.resolve()},dst=/workspace"
        # Docker receives no network, dropped Linux capabilities, a read-only root, and finite resources.
        dockerCommand = [
            "docker",
            "run",
            "--rm",
            # Docker requires interactive stdin attachment for the program to receive each generated test input.
            "-i",
            "--network",
            "none",
            "--memory",
            memoryLimit,
            "--memory-swap",
            memoryLimit,
            "--cpus",
            "1.0",
            "--pids-limit",
            "64",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--read-only",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            "--mount",
            mountSpecification,
            "--workdir",
            "/workspace",
            self.appSettings.referenceRunnerImage,
            *containerArguments,
        ]
        return dockerCommand

    def _runDockerCommand(self, dockerCommand: list[str], inputBytes: bytes | None) -> subprocess.CompletedProcess[bytes]:
        """Execute one hardened Docker command with a finite host-side timeout and captured diagnostics."""

        try:
            # The command is an argument array, so generated code never crosses a shell parsing boundary.
            commandResult = subprocess.run(
                dockerCommand,
                input=inputBytes,
                capture_output=True,
                timeout=self.appSettings.referenceRunnerTimeoutSeconds,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise ReferenceRunnerError(
                f"Reference verification exceeded {self.appSettings.referenceRunnerTimeoutSeconds} seconds"
            ) from error
        except OSError as error:
            raise ReferenceRunnerError("Could not start isolated Docker verification") from error
        # A giant stdout/stderr can otherwise consume too much local disk or UI response space.
        maximumOutputBytes = 1024 * 1024
        if len(commandResult.stdout) > maximumOutputBytes or len(commandResult.stderr) > maximumOutputBytes:
            raise ReferenceRunnerError("Reference verification produced more than 1 MB of output")
        return commandResult

    def _normalizeInput(self, inputText: str) -> str:
        """Normalize line endings and ensure exactly one final newline before execution or QOJ export."""

        # Windows line endings are converted so the local runner and QOJ consume identical input text.
        normalizedText = inputText.replace("\r\n", "\n").replace("\r", "\n").rstrip()
        return f"{normalizedText}\n"

    def _normalizeOutput(self, outputText: str) -> str:
        """Normalize output line endings and insignificant trailing whitespace for deterministic comparisons."""

        # Each output line loses only trailing spaces while meaningful internal whitespace remains untouched.
        normalizedLines = [line.rstrip() for line in outputText.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
        # Empty final lines are removed so every QOJ expected output has one stable trailing newline.
        while normalizedLines and not normalizedLines[-1]:
            normalizedLines.pop()
        # The returned text intentionally has one newline because QOJ exact output comparisons expect text files.
        normalizedOutput = "\n".join(normalizedLines)
        return f"{normalizedOutput}\n" if normalizedOutput else ""
