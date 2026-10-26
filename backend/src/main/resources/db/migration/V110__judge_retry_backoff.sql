-- Retry eligibility is separate from lease heartbeat and execution timestamps.
ALTER TABLE submissions ADD COLUMN judge_retry_after DATETIME NULL;
