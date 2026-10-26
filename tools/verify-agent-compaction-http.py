"""Repeatable HTTP provider-fixture integration; no live provider or credentials required."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
out = root / ".runtime/chat-context"
out.mkdir(parents=True, exist_ok=True)
(out / "backend-e2e-report.json").unlink(missing_ok=True)
with (out / "backend-e2e.log").open("w") as log:
    commands = [
        ["mvn", "-q", "-DskipTests", "compile", "dependency:build-classpath",
         "-Dmdep.outputFile=" + str(out / "classpath.txt")],
    ]
    for command in commands:
        if subprocess.run(command, cwd=root / "backend", stdout=log, stderr=log).returncode:
            sys.exit("Backend compilation failed; see " + str(out / "backend-e2e.log"))
    classpath = str(root / "backend/target/classes") + ":" + (out / "classpath.txt").read_text().strip()
    commands = [
        ["javac", "-cp", classpath, "-d", str(out), str(root / "tools/e2e/AgentCompactionE2e.java")],
        ["java", "-cp", str(out) + ":" + classpath, "AgentCompactionE2e", str(out / "backend-e2e-report.json")],
    ]
    for command in commands:
        if subprocess.run(command, cwd=root, stdout=log, stderr=log).returncode:
            sys.exit("HTTP integration failed; see " + str(out / "backend-e2e.log"))
print("Agent compaction HTTP integration passed: " + str(out / "backend-e2e-report.json"))
