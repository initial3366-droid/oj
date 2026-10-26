# Agent service Java style cleanup

Reference: Alibaba Java Coding Guidelines (Huangshan edition), official P3C formatter profile.
See `AGENTS.md` and `tools/java-style/README.md` for the maintained rules and commands.

## Scope

Reviewed all 23 backend agent service files and all 5 standalone agent service files.
Expanded single-statement control bodies, split compact statements and exception handling,
normalized indentation and wrapping, and replaced wildcard imports with explicit imports.
Approval policy argument names now describe their contents; action selection and boolean
value rendering use small named helpers instead of nested conditional expressions.
Tool names, JSON keys, prompt strings, approval groups and evaluation precedence are preserved.
Long protocol strings and text blocks remain intact even where they exceed the formatter margin.

## Verification

- Existing backend suite: 189 tests, 0 failures, 0 errors, 0 skipped.
- Standalone Agent: `mvn package -DskipTests` passed (no standalone tests exist).
- Both packages: `mvn -f tools/java-style/pom.xml formatter:validate` passed.
- `git diff --check` passed.
- Mechanical brace/formatting pass: parsed syntax-tree comparison passed for 28 files,
  ignoring comments/whitespace and normalizing single-statement control-body braces.
  This comparison precedes explicit-import cleanup and approval-policy helper extraction;
  the final source was compiled and checked by the existing regression suite.
- No new unit tests were added. No live E2E flow was run; this report does not claim
  end-to-end verification of Agent model calls or approvals.

Local command logs, AST report and machine-readable results are in `.runtime/agent-style/`.
