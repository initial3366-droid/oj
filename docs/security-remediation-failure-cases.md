# Security Remediation Failure Cases

Recorded before implementation, 2026-10-19. Existing baseline: 189 tests passed.

## Authentication

- Email code guessing is bounded across reset/register/profile/bind; the fifth wrong
  guess invalidates a code. Parallel verification cannot redeem the same code twice.
- A failed mail delivery never leaves an active code. Concurrent sends obey cooldown
  and daily quotas atomically; a delayed sender cannot overwrite a newer code.
- Any image-code attempt consumes the challenge, including wrong guesses; parallel
  requests cannot reuse it. Challenge creation and all authentication entry points
  have source/global budgets that fail closed if Redis is unavailable.
- Omitting captcha fields cannot bypass login. An unrelated source cannot lock a
  username globally. Teacher passwords are never checked by the student endpoint.
- All newly issued sessions expire at a fixed deadline. Old-format tokens and tokens
  issued before a password change fail both access and refresh, for all account types
  and all password-write paths, including bulk reset.
- Imported accounts receive independently random passwords, delivered only in the
  authorized import response. Reimport does not reset an existing account. Historical
  imported accounts using the predictable password cannot authenticate; old sessions
  are invalidated. Import screens expose the returned credentials to the operator.

## Scoreboards

- Anonymous/unregistered users remain forbidden. Approved contestants cannot use
  legacy rank or final snapshots to bypass a freeze; privileged views still work.
- Non-frozen legacy rank response shapes remain compatible.

## Judging

- Live claims renew a lease, dead claims recover after expiry, retries are bounded.
- Each attempt has a unique ownership token; old callbacks/release cannot affect a
  newer claim. Loss of ownership stops execution before the next sandbox command.
- Queue saturation does not accumulate local tasks. Queue selection admits one
  waiting row per user and excludes users already judging; the total execution
  budget bounds occupation even across multiple scheduler instances.
- A submission has a total execution budget, including ordinary/SPJ/communication
  flows. OI partial results remain explicit when the budget is exceeded.
- Per-command timeout cannot exceed the remaining total budget. Files, heartbeat
  registrations and executor state are released on failure/cancellation/shutdown.

## Verification

Prefer HTTP/browser E2E with disposable fixtures, redacted reports and screenshots.
Use a local fake sandbox only to control timing and process results; no contestant
program should execute on the host. Existing unit tests are regression checks, not
the evidence for the new end-to-end behavior. Never run an exhaustion attack against
existing user data. Record any unverified scenario explicitly in the final report.
