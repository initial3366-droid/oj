"""Optional Docker integration test for the isolated C++17 reference-solution runner."""

import shutil
import subprocess

import pytest

from app.config import getSettings
from app.reference_runner import ReferenceSolutionRunner
from tests.test_validators import buildCandidate


def dockerImageIsAvailable() -> bool:
    """Return whether Docker and the configured compiler image are already available without pulling anything."""

    # The Docker executable check keeps this test optional on developer machines without Docker Desktop.
    dockerExecutable = shutil.which("docker")
    if dockerExecutable is None:
        return False
    # The project setting allows an operator to replace gcc:13 with a pinned private image.
    compilerImage = getSettings().referenceRunnerImage
    # Image inspection is read-only and deliberately does not trigger a Docker pull during ordinary unit tests.
    inspectionResult = subprocess.run(
        [dockerExecutable, "image", "inspect", compilerImage],
        capture_output=True,
        check=False,
    )
    return inspectionResult.returncode == 0


@pytest.mark.skipif(not dockerImageIsAvailable(), reason="Docker compiler image is not available locally")
def testReferenceRunnerCompilesAndCalculatesOutputs() -> None:
    """Confirm Docker compiles the fixture and derives both sample and hidden output pairs correctly."""

    # The runner reads image and resource limits from local project settings.
    runner = ReferenceSolutionRunner(getSettings())
    # The small increment fixture has deterministic sample and hidden expected outputs.
    candidate = buildCandidate()
    # Actual Docker execution should be the only source of verified output values.
    report = runner.verify(candidate)
    assert report.status == "PASSED", report.errors
    assert [sampleCase.output for sampleCase in report.verifiedSamples] == ["2\n", "10\n"]
    assert report.verifiedTestCases[0].output == "2\n"
    assert len(report.verifiedTestCases) == 8

