"""SQLite persistence for non-secret generation artifacts, endpoint settings, and human reviews."""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from .models import GenerationJob, ProgressEvent, RuntimeSettings


class StudioRepository:
    """Persist jobs locally while deliberately excluding API keys, passwords, and QOJ tokens."""

    def __init__(self, databasePath: Path) -> None:
        """Remember the SQLite file path used to open a short-lived connection for each operation."""

        # The SQLite path is controlled by AppSettings and lives under this standalone project.
        self.databasePath = databasePath

    def initialize(self, defaultSettings: RuntimeSettings) -> None:
        """Create tables once and seed configurable non-secret endpoint settings when absent."""

        # The isolated database connection prevents sharing SQLite state across request threads.
        connection = self._connect()
        try:
            # The cursor performs schema creation and the initial settings insert.
            cursor = connection.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS generation_jobs (
                    id TEXT PRIMARY KEY,
                    job_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS runtime_settings (
                    setting_key TEXT PRIMARY KEY,
                    setting_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            # The stored settings are endpoints and model names only, never credentials.
            currentSettings = cursor.execute(
                "SELECT setting_json FROM runtime_settings WHERE setting_key = ?",
                ("active",),
            ).fetchone()
            if currentSettings is None:
                # The JSON representation remains portable and easy to inspect during local operation.
                settingsJson = defaultSettings.model_dump_json()
                # The UTC timestamp records the initial configuration creation.
                createdAt = self._utcNow().isoformat()
                cursor.execute(
                    "INSERT INTO runtime_settings(setting_key, setting_json, updated_at) VALUES (?, ?, ?)",
                    ("active", settingsJson, createdAt),
                )
            connection.commit()
        finally:
            # The connection is always closed even when schema setup fails.
            connection.close()

    def getRuntimeSettings(self) -> RuntimeSettings:
        """Return the currently active non-secret endpoint configuration."""

        # The connection reads exactly one active settings row.
        connection = self._connect()
        try:
            # The row stores a serialized RuntimeSettings object.
            settingsRow = connection.execute(
                "SELECT setting_json FROM runtime_settings WHERE setting_key = ?",
                ("active",),
            ).fetchone()
            if settingsRow is None:
                raise RuntimeError("Runtime settings have not been initialized")
            # The parsed settings object validates data that may have been written by older local versions.
            runtimeSettings = RuntimeSettings.model_validate_json(settingsRow["setting_json"])
            return runtimeSettings
        finally:
            # The connection owns no long-lived transaction in this read-only operation.
            connection.close()

    def saveRuntimeSettings(self, runtimeSettings: RuntimeSettings) -> RuntimeSettings:
        """Replace only endpoint and model settings while retaining all secrets in process environment."""

        # The connection applies an atomic SQLite upsert.
        connection = self._connect()
        try:
            # The JSON payload is safe to persist because RuntimeSettings has no secret fields.
            settingsJson = runtimeSettings.model_dump_json()
            # The timestamp makes endpoint changes auditable during local development.
            updatedAt = self._utcNow().isoformat()
            connection.execute(
                """
                INSERT INTO runtime_settings(setting_key, setting_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_json = excluded.setting_json,
                    updated_at = excluded.updated_at
                """,
                ("active", settingsJson, updatedAt),
            )
            connection.commit()
            return runtimeSettings
        finally:
            # The connection is released before the API response is created.
            connection.close()

    def createJob(self, job: GenerationJob) -> GenerationJob:
        """Insert a newly allocated generation job before an external model call begins."""

        # The connection makes job creation durable before a potentially long agent invocation.
        connection = self._connect()
        try:
            # The JSON representation includes the brief but never incoming QOJ credentials.
            jobJson = json.dumps(job.model_dump(mode="json"), ensure_ascii=False)
            connection.execute(
                "INSERT INTO generation_jobs(id, job_json, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (job.id, jobJson, job.createdAt.isoformat(), job.updatedAt.isoformat()),
            )
            connection.commit()
            return job
        finally:
            # Closing the connection releases the SQLite write lock promptly.
            connection.close()

    def saveJob(self, job: GenerationJob) -> GenerationJob:
        """Persist a generated result, review decision, or QOJ export state by immutable job ID."""

        # The connection updates the JSON document and indexed timestamp together.
        connection = self._connect()
        try:
            # The current timestamp is copied onto the model before serialization.
            updatedJob = job.model_copy(update={"updatedAt": self._utcNow()})
            # The serialized job remains a complete audit trail for a single generation attempt.
            jobJson = json.dumps(updatedJob.model_dump(mode="json"), ensure_ascii=False)
            connection.execute(
                "UPDATE generation_jobs SET job_json = ?, updated_at = ? WHERE id = ?",
                (jobJson, updatedJob.updatedAt.isoformat(), updatedJob.id),
            )
            connection.commit()
            return updatedJob
        finally:
            # The connection is released regardless of an update failure.
            connection.close()

    def appendProgressEvent(
        self,
        jobId: str,
        phase: str,
        level: Literal["INFO", "SUCCESS", "WARNING", "ERROR"],
        message: str,
    ) -> GenerationJob | None:
        """Atomically append one actual workflow event and return the updated job for optional diagnostics."""

        # The immediate transaction prevents two concurrent callbacks from reusing the same event sequence.
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            # The current document includes every event already observed by reconnecting browser clients.
            jobRow = connection.execute(
                "SELECT job_json FROM generation_jobs WHERE id = ?",
                (jobId,),
            ).fetchone()
            if jobRow is None:
                connection.rollback()
                return None
            # Parsing through Pydantic preserves timestamp and event validation for jobs written by earlier versions.
            generationJob = GenerationJob.model_validate_json(jobRow["job_json"])
            # Event numbers are durable and monotonic within a job, even when a browser reconnects mid-generation.
            nextSequence = self._nextProgressSequence(generationJob)
            progressEvent = ProgressEvent(
                sequence=nextSequence,
                createdAt=self._utcNow(),
                phase=phase,
                level=level,
                message=message,
            )
            # The new immutable list retains the full audit trail rather than replacing prior workflow evidence.
            progressEvents = [*generationJob.progressEvents, progressEvent]
            updatedJob = generationJob.model_copy(
                update={
                    "progressEvents": progressEvents,
                    "updatedAt": self._utcNow(),
                }
            )
            # The job JSON and indexed timestamp are updated in the same transaction as the new event.
            jobJson = json.dumps(updatedJob.model_dump(mode="json"), ensure_ascii=False)
            connection.execute(
                "UPDATE generation_jobs SET job_json = ?, updated_at = ? WHERE id = ?",
                (jobJson, updatedJob.updatedAt.isoformat(), updatedJob.id),
            )
            connection.commit()
            return updatedJob
        except Exception:
            # A failed event write must not leave a half-written JSON document or a held SQLite transaction.
            connection.rollback()
            raise
        finally:
            # The short-lived write connection releases its lock before the next agent node emits an event.
            connection.close()

    def failGenerationJob(self, jobId: str, failureReason: str) -> GenerationJob | None:
        """Atomically mark an active job failed and persist its terminal error event without dropping prior progress."""

        # The immediate transaction makes the terminal state and its visible error event appear together to SSE readers.
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            # The latest document is read inside the transaction so completed callbacks cannot be overwritten.
            jobRow = connection.execute(
                "SELECT job_json FROM generation_jobs WHERE id = ?",
                (jobId,),
            ).fetchone()
            if jobRow is None:
                connection.rollback()
                return None
            generationJob = GenerationJob.model_validate_json(jobRow["job_json"])
            # A job that already reached a terminal state cannot be downgraded by a late task cancellation callback.
            if generationJob.status != "GENERATING":
                connection.rollback()
                return generationJob
            # The terminal event is stored in the same document update as FAILED so clients always receive both together.
            failureMessage = f"任务执行失败：{failureReason}"[:4000]
            failureEvent = ProgressEvent(
                sequence=self._nextProgressSequence(generationJob),
                createdAt=self._utcNow(),
                phase="finish",
                level="ERROR",
                message=failureMessage,
            )
            progressEvents = [*generationJob.progressEvents, failureEvent]
            failedJob = generationJob.model_copy(
                update={
                    "status": "FAILED",
                    "failureReason": failureReason,
                    "progressEvents": progressEvents,
                    "updatedAt": self._utcNow(),
                }
            )
            jobJson = json.dumps(failedJob.model_dump(mode="json"), ensure_ascii=False)
            connection.execute(
                "UPDATE generation_jobs SET job_json = ?, updated_at = ? WHERE id = ?",
                (jobJson, failedJob.updatedAt.isoformat(), failedJob.id),
            )
            connection.commit()
            return failedJob
        except Exception:
            # Rollback keeps an original GENERATING record intact when terminal persistence itself fails.
            connection.rollback()
            raise
        finally:
            # Closing the connection releases the lock before an SSE reader polls for the terminal transition.
            connection.close()

    def getJob(self, jobId: str) -> GenerationJob | None:
        """Load one generation job by UUID or return None when the user supplied an unknown ID."""

        # The connection reads only the target job document.
        connection = self._connect()
        try:
            # The row contains the full Pydantic-compatible JSON representation.
            jobRow = connection.execute(
                "SELECT job_json FROM generation_jobs WHERE id = ?",
                (jobId,),
            ).fetchone()
            if jobRow is None:
                return None
            # The parsed object restores nested brief, candidate, report, and timestamp types.
            generationJob = GenerationJob.model_validate_json(jobRow["job_json"])
            return generationJob
        finally:
            # The short-lived read connection does not hold locks across API work.
            connection.close()

    def _connect(self) -> sqlite3.Connection:
        """Open a row-addressable SQLite connection suitable for the current synchronous operation."""

        # The database parent exists because AppSettings creates the data directory eagerly.
        self.databasePath.parent.mkdir(parents=True, exist_ok=True)
        # The connection stays local to one repository method for thread-safe FastAPI use.
        connection = sqlite3.connect(self.databasePath)
        connection.row_factory = sqlite3.Row
        return connection

    def _nextProgressSequence(self, generationJob: GenerationJob) -> int:
        """Calculate the next durable per-job event sequence from the currently persisted audit trail."""

        # Older rows may have no events, while newer rows may be restored in arbitrary JSON list order.
        highestSequence = max((event.sequence for event in generationJob.progressEvents), default=0)
        return highestSequence + 1

    def _utcNow(self) -> datetime:
        """Return an aware UTC timestamp so persisted lifecycle records are timezone-safe."""

        # The timestamp is intentionally generated at persistence time rather than client request time.
        currentTime = datetime.now(UTC)
        return currentTime
