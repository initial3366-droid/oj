# AI Problem Studio

AI Problem Studio is a standalone Python application. It does not modify or import
QOJ source code. It creates a QOJ problem only through QOJ's existing draft API.
Problem generation runs through the local Codex CLI in non-interactive, read-only
Agent mode; the configured endpoint must support OpenAI's Responses API.

The QOJ export sequence is:

1. Create a problem draft.
2. Save problem metadata, statement, formats, and samples.
3. Save hidden test cases.
4. Commit the result as a QOJ `DRAFT`, never as a published problem.

The agent workflow is implemented with LangGraph:

`brief -> plan -> generate -> static validation -> critic -> reference solution runner -> human review -> QOJ draft export`

## Prerequisites

- Python 3.11 or newer
- Docker Desktop running when reference-solution verification is required
- Codex CLI installed and available as `codex` (or `CODEX_COMMAND`)
- A Codex/OpenAI API key for the selected model, or a configured Codex CLI login
- A QOJ teacher or super-admin account dedicated to the AI agent

## Start

```bash
cd /Users/initial/qoj/ai-problem-studio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Optional: set CODEX_API_KEY in .env as the initial key
uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload
```

Open `http://127.0.0.1:8010`.

## Security and Quality Gates

- Codex API Key configuration is available in the UI. A visual update is retained
  only in backend process memory and injected into the Codex child process; it is
  never written to SQLite, browser storage, prompts, or task data.
- QOJ access and refresh tokens exist only in the local backend process. The browser
  receives an opaque HttpOnly session cookie; tokens are not saved in SQLite, files,
  browser storage, or browser JavaScript memory.
- The generated C++17 reference solution is compiled and executed in a Docker
  container with no network, CPU, memory, process, and wall-clock limits.
- QOJ export is blocked unless static validation, critic review, and reference
  execution pass, and a human explicitly approves the job.
- The exporter always sends `studentPublishStatus: "DRAFT"` and `isPublic: false`.

## QOJ API Contract Used

```text
POST /api/admin/v1/problem-drafts
PUT  /api/admin/v1/problem-drafts/{draftId}/basic
PUT  /api/admin/v1/problem-drafts/{draftId}/test-cases
POST /api/admin/v1/problem-drafts/{draftId}/commit
```

The QOJ account used to export becomes the problem owner. Create a dedicated teacher
account such as `ai_problem_bot`; do not use a personal account for automated exports.

## Notes

The UI accepts any OpenAI-compatible Responses API address, model identifier, and
API Key. The selected reasoning effort is forwarded to Codex as
`model_reasoning_effort` when a value is chosen; available values are
model-dependent. Existing `DEEPSEEK_*` environment variables remain supported as
migration fallbacks, but they no longer select a direct Chat Completions client.
