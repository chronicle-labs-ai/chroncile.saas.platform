//! Postgres-backed implementations of the backtest repository traits.
//!
//! Kept in its own file (rather than appended to the 1000-line
//! `repositories.rs`) so the orchestration concern stays reviewable in
//! isolation. Helper functions (`naive_to_utc`, `to_repo_err`, ID
//! minting) are duplicated locally on purpose — the alternative is
//! extracting them into a shared helper module, which is a separate
//! refactor that should land in its own change.
//!
//! Schema reference: `migrations/013_create_backtest_runtime.sql`.
//! Trait definitions: `chronicle_interfaces::repositories`.

use async_trait::async_trait;
use chronicle_domain::{
    BacktestArtifactKind, BacktestArtifactRecord, BacktestJobMode, BacktestJobRecord,
    BacktestTrialRecord, CreateBacktestJobInput, CreateBacktestTrialInput, JobStatus, RetryConfig,
    SandboxDriver, TrialException, TrialStatus, TrialTimings,
};
use chronicle_interfaces::{
    BacktestArtifactRepository, BacktestJobRepository, BacktestTrialRepository, RepoError,
    RepoResult, TrialTimingMarker,
};
use chronicle_store::postgres::TracedPgPool;
use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use sqlx::Row;
use std::collections::HashMap;

/* ── shared helpers ─────────────────────────────────────── */

fn new_id() -> String {
    cuid2::create_id()
}

fn naive_to_utc(naive: NaiveDateTime) -> DateTime<Utc> {
    Utc.from_utc_datetime(&naive)
}

fn to_repo_err(e: sqlx::Error) -> RepoError {
    match &e {
        sqlx::Error::Database(db_err) if db_err.constraint().is_some() => {
            RepoError::AlreadyExists(db_err.to_string())
        }
        sqlx::Error::RowNotFound => RepoError::NotFound("row not found".to_string()),
        _ => RepoError::Internal(e.to_string()),
    }
}

/* ── enum ↔ string round-trip ──────────────────────────── */

fn job_status_str(s: JobStatus) -> &'static str {
    match s {
        JobStatus::Pending => "pending",
        JobStatus::Running => "running",
        JobStatus::Succeeded => "succeeded",
        JobStatus::Failed => "failed",
        JobStatus::Cancelled => "cancelled",
    }
}

fn parse_job_status(s: &str) -> Result<JobStatus, sqlx::Error> {
    Ok(match s {
        "pending" => JobStatus::Pending,
        "running" => JobStatus::Running,
        "succeeded" => JobStatus::Succeeded,
        "failed" => JobStatus::Failed,
        "cancelled" => JobStatus::Cancelled,
        other => {
            return Err(sqlx::Error::Decode(
                format!("unknown JobStatus '{other}'").into(),
            ))
        }
    })
}

fn trial_status_str(s: TrialStatus) -> &'static str {
    match s {
        TrialStatus::Pending => "pending",
        TrialStatus::Setup => "setup",
        TrialStatus::Running => "running",
        TrialStatus::Verifying => "verifying",
        TrialStatus::Succeeded => "succeeded",
        TrialStatus::Failed => "failed",
        TrialStatus::Cancelled => "cancelled",
    }
}

fn parse_trial_status(s: &str) -> Result<TrialStatus, sqlx::Error> {
    Ok(match s {
        "pending" => TrialStatus::Pending,
        "setup" => TrialStatus::Setup,
        "running" => TrialStatus::Running,
        "verifying" => TrialStatus::Verifying,
        "succeeded" => TrialStatus::Succeeded,
        "failed" => TrialStatus::Failed,
        "cancelled" => TrialStatus::Cancelled,
        other => {
            return Err(sqlx::Error::Decode(
                format!("unknown TrialStatus '{other}'").into(),
            ))
        }
    })
}

fn job_mode_str(m: BacktestJobMode) -> &'static str {
    match m {
        BacktestJobMode::Replay => "replay",
        BacktestJobMode::Compare => "compare",
        BacktestJobMode::Regression => "regression",
        BacktestJobMode::Suite => "suite",
    }
}

fn parse_job_mode(s: &str) -> Result<BacktestJobMode, sqlx::Error> {
    Ok(match s {
        "replay" => BacktestJobMode::Replay,
        "compare" => BacktestJobMode::Compare,
        "regression" => BacktestJobMode::Regression,
        "suite" => BacktestJobMode::Suite,
        other => {
            return Err(sqlx::Error::Decode(
                format!("unknown BacktestJobMode '{other}'").into(),
            ))
        }
    })
}

fn sandbox_driver_str(d: SandboxDriver) -> &'static str {
    d.as_str()
}

fn parse_sandbox_driver(s: &str) -> Result<SandboxDriver, sqlx::Error> {
    Ok(match s {
        "docker" => SandboxDriver::Docker,
        "daytona" => SandboxDriver::Daytona,
        "mock" => SandboxDriver::Mock,
        other => {
            return Err(sqlx::Error::Decode(
                format!("unknown SandboxDriver '{other}'").into(),
            ))
        }
    })
}

fn artifact_kind_str(k: BacktestArtifactKind) -> &'static str {
    match k {
        BacktestArtifactKind::AgentLog => "agent-log",
        BacktestArtifactKind::VerifierLog => "verifier-log",
        BacktestArtifactKind::Trajectory => "trajectory",
        BacktestArtifactKind::Screenshot => "screenshot",
        BacktestArtifactKind::RewardJson => "reward-json",
        BacktestArtifactKind::RewardTxt => "reward-txt",
        BacktestArtifactKind::Tar => "tar",
        BacktestArtifactKind::Other => "other",
    }
}

fn parse_artifact_kind(s: &str) -> Result<BacktestArtifactKind, sqlx::Error> {
    Ok(match s {
        "agent-log" => BacktestArtifactKind::AgentLog,
        "verifier-log" => BacktestArtifactKind::VerifierLog,
        "trajectory" => BacktestArtifactKind::Trajectory,
        "screenshot" => BacktestArtifactKind::Screenshot,
        "reward-json" => BacktestArtifactKind::RewardJson,
        "reward-txt" => BacktestArtifactKind::RewardTxt,
        "tar" => BacktestArtifactKind::Tar,
        "other" => BacktestArtifactKind::Other,
        // Unknown kinds fall back to `other` so unfamiliar artifacts in
        // older rows don't poison the listing path.
        _ => BacktestArtifactKind::Other,
    })
}

/* ── row → record helpers ──────────────────────────────── */

fn job_from_row(row: sqlx::postgres::PgRow) -> Result<BacktestJobRecord, sqlx::Error> {
    let mode_str: String = row.try_get("mode")?;
    let status_str: String = row.try_get("status")?;
    let driver_str: String = row.try_get("sandboxDriver")?;
    let recipe: serde_json::Value = row.try_get("recipe")?;
    let retry_config: Option<serde_json::Value> = row.try_get("retryConfig")?;
    let retry_config: Option<RetryConfig> = retry_config
        .map(serde_json::from_value)
        .transpose()
        .map_err(|e| sqlx::Error::Decode(e.to_string().into()))?;

    let n_concurrent: i32 = row.try_get("nConcurrent")?;
    let completed: i32 = row.try_get("completedTrials")?;
    let failed: i32 = row.try_get("failedTrials")?;
    let total: Option<i32> = row.try_get("totalTrials")?;

    let scheduled_for: Option<NaiveDateTime> = row.try_get("scheduledFor")?;
    let created_at: NaiveDateTime = row.try_get("createdAt")?;
    let started_at: Option<NaiveDateTime> = row.try_get("startedAt")?;
    let finished_at: Option<NaiveDateTime> = row.try_get("finishedAt")?;
    let updated_at: NaiveDateTime = row.try_get("updatedAt")?;

    Ok(BacktestJobRecord {
        id: row.try_get("id")?,
        tenant_id: row.try_get("tenantId")?,
        name: row.try_get("name")?,
        mode: parse_job_mode(&mode_str)?,
        recipe,
        status: parse_job_status(&status_str)?,
        verdict: row.try_get("verdict")?,
        n_concurrent: n_concurrent.max(0) as u32,
        sandbox_driver: parse_sandbox_driver(&driver_str)?,
        retry_config,
        created_by: row.try_get("createdBy")?,
        scheduled_for: scheduled_for.map(naive_to_utc),
        created_at: naive_to_utc(created_at),
        started_at: started_at.map(naive_to_utc),
        finished_at: finished_at.map(naive_to_utc),
        total_trials: total.map(|n| n.max(0) as u32),
        completed_trials: completed.max(0) as u32,
        failed_trials: failed.max(0) as u32,
        exception_kind: row.try_get("exceptionKind")?,
        updated_at: naive_to_utc(updated_at),
    })
}

fn trial_from_row(row: sqlx::postgres::PgRow) -> Result<BacktestTrialRecord, sqlx::Error> {
    let status_str: String = row.try_get("status")?;
    let attempt: i32 = row.try_get("attempt")?;
    let duration_ms: Option<i32> = row.try_get("durationMs")?;

    let timings = TrialTimings {
        env_setup_started_at: row
            .try_get::<Option<NaiveDateTime>, _>("envSetupStartedAt")?
            .map(naive_to_utc),
        env_setup_finished_at: row
            .try_get::<Option<NaiveDateTime>, _>("envSetupFinishedAt")?
            .map(naive_to_utc),
        agent_setup_started_at: row
            .try_get::<Option<NaiveDateTime>, _>("agentSetupStartedAt")?
            .map(naive_to_utc),
        agent_setup_finished_at: row
            .try_get::<Option<NaiveDateTime>, _>("agentSetupFinishedAt")?
            .map(naive_to_utc),
        agent_run_started_at: row
            .try_get::<Option<NaiveDateTime>, _>("agentRunStartedAt")?
            .map(naive_to_utc),
        agent_run_finished_at: row
            .try_get::<Option<NaiveDateTime>, _>("agentRunFinishedAt")?
            .map(naive_to_utc),
        verifier_started_at: row
            .try_get::<Option<NaiveDateTime>, _>("verifierStartedAt")?
            .map(naive_to_utc),
        verifier_finished_at: row
            .try_get::<Option<NaiveDateTime>, _>("verifierFinishedAt")?
            .map(naive_to_utc),
    };

    let exception = match (
        row.try_get::<Option<String>, _>("exceptionKind")?,
        row.try_get::<Option<String>, _>("exceptionMessage")?,
    ) {
        (Some(kind), Some(message)) => Some(TrialException { kind, message }),
        // Half-populated rows (kind without message or vice versa) are
        // tolerated — we surface whatever the orchestrator wrote.
        (Some(kind), None) => Some(TrialException {
            kind,
            message: String::new(),
        }),
        (None, Some(message)) => Some(TrialException {
            kind: "Unknown".to_string(),
            message,
        }),
        (None, None) => None,
    };

    let created_at: NaiveDateTime = row.try_get("createdAt")?;
    let updated_at: NaiveDateTime = row.try_get("updatedAt")?;

    Ok(BacktestTrialRecord {
        id: row.try_get("id")?,
        job_id: row.try_get("jobId")?,
        tenant_id: row.try_get("tenantId")?,
        agent_id: row.try_get("agentId")?,
        agent_label: row.try_get("agentLabel")?,
        is_baseline: row.try_get("isBaseline")?,
        case_id: row.try_get("caseId")?,
        case_cluster: row.try_get("caseCluster")?,
        status: parse_trial_status(&status_str)?,
        timings,
        duration_ms: duration_ms.and_then(|n| u32::try_from(n).ok()),
        sandbox_id: row.try_get("sandboxId")?,
        exception,
        attempt: attempt.max(0) as u32,
        created_at: naive_to_utc(created_at),
        updated_at: naive_to_utc(updated_at),
    })
}

fn artifact_from_row(row: sqlx::postgres::PgRow) -> Result<BacktestArtifactRecord, sqlx::Error> {
    let kind_str: String = row.try_get("kind")?;
    let size: Option<i64> = row.try_get("sizeBytes")?;
    let created_at: NaiveDateTime = row.try_get("createdAt")?;
    Ok(BacktestArtifactRecord {
        id: row.try_get("id")?,
        trial_id: row.try_get("trialId")?,
        kind: parse_artifact_kind(&kind_str)?,
        path: row.try_get("path")?,
        size_bytes: size.and_then(|n| u64::try_from(n).ok()),
        content_type: row.try_get("contentType")?,
        created_at: naive_to_utc(created_at),
    })
}

/* ──────────────────────────────────────────────────────── */
/* Job repo                                                  */
/* ──────────────────────────────────────────────────────── */

#[derive(Clone)]
pub struct PgBacktestJobRepo {
    pool: TracedPgPool,
}

impl PgBacktestJobRepo {
    pub fn new(pool: TracedPgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BacktestJobRepository for PgBacktestJobRepo {
    async fn create(&self, input: CreateBacktestJobInput) -> RepoResult<BacktestJobRecord> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        let scheduled_for = input.scheduled_for.map(|t| t.naive_utc());
        let retry_json = input
            .retry_config
            .as_ref()
            .map(serde_json::to_value)
            .transpose()
            .map_err(|e| RepoError::Internal(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO "BacktestJob" (
                id, "tenantId", name, mode, recipe, status, "nConcurrent",
                "sandboxDriver", "retryConfig", "createdBy", "scheduledFor",
                "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $11)
            "#,
        )
        .bind(&id)
        .bind(&input.tenant_id)
        .bind(&input.name)
        .bind(job_mode_str(input.mode))
        .bind(&input.recipe)
        .bind(input.n_concurrent as i32)
        .bind(sandbox_driver_str(input.sandbox_driver))
        .bind(retry_json)
        .bind(input.created_by)
        .bind(scheduled_for)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(to_repo_err)?;

        self.find_by_id(&id)
            .await?
            .ok_or_else(|| RepoError::Internal("backtest job not found after insert".to_string()))
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestJobRecord>> {
        sqlx::query(r#"SELECT * FROM "BacktestJob" WHERE id = $1"#)
            .bind(id)
            .try_map(job_from_row)
            .fetch_optional(&self.pool)
            .await
            .map_err(to_repo_err)
    }

    async fn list_by_tenant(
        &self,
        tenant_id: &str,
        mode: Option<BacktestJobMode>,
        status: Option<JobStatus>,
        limit: usize,
        offset: usize,
    ) -> RepoResult<Vec<BacktestJobRecord>> {
        // Two `IS NULL OR =` predicates keep the query plan flat without
        // a runtime SQL string-build dance.
        sqlx::query(
            r#"
            SELECT * FROM "BacktestJob"
            WHERE "tenantId" = $1
              AND ($2::text IS NULL OR mode = $2)
              AND ($3::text IS NULL OR status = $3)
            ORDER BY "createdAt" DESC
            LIMIT $4 OFFSET $5
            "#,
        )
        .bind(tenant_id)
        .bind(mode.map(job_mode_str))
        .bind(status.map(job_status_str))
        .bind(limit as i64)
        .bind(offset as i64)
        .try_map(job_from_row)
        .fetch_all(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn count_by_tenant(&self, tenant_id: &str) -> RepoResult<usize> {
        let row = sqlx::query(
            r#"SELECT COUNT(*) AS count FROM "BacktestJob" WHERE "tenantId" = $1"#,
        )
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)?;
        let count: i64 = row
            .try_get("count")
            .map_err(|e| RepoError::Internal(e.to_string()))?;
        Ok(count as usize)
    }

    async fn update_status(
        &self,
        id: &str,
        status: JobStatus,
        started_at: Option<DateTime<Utc>>,
        finished_at: Option<DateTime<Utc>>,
    ) -> RepoResult<BacktestJobRecord> {
        let now = Utc::now().naive_utc();
        sqlx::query(
            r#"
            UPDATE "BacktestJob"
            SET status = $2,
                "startedAt"  = COALESCE($3, "startedAt"),
                "finishedAt" = COALESCE($4, "finishedAt"),
                "updatedAt"  = $5
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(job_status_str(status))
        .bind(started_at.map(|t| t.naive_utc()))
        .bind(finished_at.map(|t| t.naive_utc()))
        .bind(now)
        .try_map(job_from_row)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn update_summary(
        &self,
        id: &str,
        total_trials: Option<u32>,
        completed_trials: u32,
        failed_trials: u32,
        exception_kind: Option<&str>,
    ) -> RepoResult<BacktestJobRecord> {
        let now = Utc::now().naive_utc();
        // `totalTrials` uses COALESCE so the orchestrator can keep
        // calling with `None` after the first set without overwriting.
        sqlx::query(
            r#"
            UPDATE "BacktestJob"
            SET "totalTrials"     = COALESCE($2, "totalTrials"),
                "completedTrials" = $3,
                "failedTrials"    = $4,
                "exceptionKind"   = COALESCE($5, "exceptionKind"),
                "updatedAt"       = $6
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(total_trials.map(|n| n as i32))
        .bind(completed_trials as i32)
        .bind(failed_trials as i32)
        .bind(exception_kind)
        .bind(now)
        .try_map(job_from_row)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn set_verdict(&self, id: &str, verdict: &str) -> RepoResult<BacktestJobRecord> {
        let now = Utc::now().naive_utc();
        sqlx::query(
            r#"
            UPDATE "BacktestJob"
            SET verdict = $2, "updatedAt" = $3
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(verdict)
        .bind(now)
        .try_map(job_from_row)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)
    }
}

/* ──────────────────────────────────────────────────────── */
/* Trial repo                                                */
/* ──────────────────────────────────────────────────────── */

#[derive(Clone)]
pub struct PgBacktestTrialRepo {
    pool: TracedPgPool,
}

impl PgBacktestTrialRepo {
    pub fn new(pool: TracedPgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BacktestTrialRepository for PgBacktestTrialRepo {
    async fn create(
        &self,
        input: CreateBacktestTrialInput,
    ) -> RepoResult<BacktestTrialRecord> {
        let id = new_id();
        let now = Utc::now().naive_utc();

        sqlx::query(
            r#"
            INSERT INTO "BacktestTrial" (
                id, "jobId", "tenantId", "agentId", "agentLabel", "isBaseline",
                "caseId", "caseCluster", status, attempt, "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 0, $9, $9)
            "#,
        )
        .bind(&id)
        .bind(&input.job_id)
        .bind(&input.tenant_id)
        .bind(&input.agent_id)
        .bind(&input.agent_label)
        .bind(input.is_baseline)
        .bind(&input.case_id)
        .bind(input.case_cluster)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(to_repo_err)?;

        self.find_by_id(&id)
            .await?
            .ok_or_else(|| RepoError::Internal("backtest trial not found after insert".to_string()))
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestTrialRecord>> {
        sqlx::query(r#"SELECT * FROM "BacktestTrial" WHERE id = $1"#)
            .bind(id)
            .try_map(trial_from_row)
            .fetch_optional(&self.pool)
            .await
            .map_err(to_repo_err)
    }

    async fn list_by_job(&self, job_id: &str) -> RepoResult<Vec<BacktestTrialRecord>> {
        sqlx::query(
            r#"
            SELECT * FROM "BacktestTrial"
            WHERE "jobId" = $1
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(job_id)
        .try_map(trial_from_row)
        .fetch_all(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn list_by_job_status(
        &self,
        job_id: &str,
        status: TrialStatus,
    ) -> RepoResult<Vec<BacktestTrialRecord>> {
        sqlx::query(
            r#"
            SELECT * FROM "BacktestTrial"
            WHERE "jobId" = $1 AND status = $2
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(job_id)
        .bind(trial_status_str(status))
        .try_map(trial_from_row)
        .fetch_all(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn record_timing(&self, id: &str, marker: TrialTimingMarker) -> RepoResult<()> {
        let now = Utc::now().naive_utc();
        // Column name comes from a fixed enum mapping (no user input)
        // — safe to interpolate into the SQL string.
        let column = marker.column();
        let sql = format!(
            r#"
            UPDATE "BacktestTrial"
            SET "{column}" = COALESCE("{column}", $2),
                "updatedAt" = $2
            WHERE id = $1
            "#
        );
        let result = sqlx::query(&sql)
            .bind(id)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(to_repo_err)?;
        if result.rows_affected() == 0 {
            return Err(RepoError::NotFound(format!("backtest trial: {id}")));
        }
        Ok(())
    }

    async fn update_status(&self, id: &str, status: TrialStatus) -> RepoResult<()> {
        let now = Utc::now().naive_utc();
        let result = sqlx::query(
            r#"
            UPDATE "BacktestTrial"
            SET status = $2, "updatedAt" = $3
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(trial_status_str(status))
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(to_repo_err)?;
        if result.rows_affected() == 0 {
            return Err(RepoError::NotFound(format!("backtest trial: {id}")));
        }
        Ok(())
    }

    async fn mark_terminal(
        &self,
        id: &str,
        status: TrialStatus,
        duration_ms: Option<u32>,
        exception: Option<TrialException>,
    ) -> RepoResult<BacktestTrialRecord> {
        let now = Utc::now().naive_utc();
        let (kind, message) = match exception {
            Some(e) => (Some(e.kind), Some(e.message)),
            None => (None, None),
        };
        sqlx::query(
            r#"
            UPDATE "BacktestTrial"
            SET status            = $2,
                "durationMs"      = COALESCE($3, "durationMs"),
                "exceptionKind"   = COALESCE($4, "exceptionKind"),
                "exceptionMessage"= COALESCE($5, "exceptionMessage"),
                "updatedAt"       = $6
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(trial_status_str(status))
        .bind(duration_ms.map(|n| n as i32))
        .bind(kind)
        .bind(message)
        .bind(now)
        .try_map(trial_from_row)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn set_sandbox_id(&self, id: &str, sandbox_id: &str) -> RepoResult<()> {
        let now = Utc::now().naive_utc();
        let result = sqlx::query(
            r#"
            UPDATE "BacktestTrial"
            SET "sandboxId" = $2, "updatedAt" = $3
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(sandbox_id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(to_repo_err)?;
        if result.rows_affected() == 0 {
            return Err(RepoError::NotFound(format!("backtest trial: {id}")));
        }
        Ok(())
    }

    async fn bump_attempt(&self, id: &str) -> RepoResult<u32> {
        let now = Utc::now().naive_utc();
        let row = sqlx::query(
            r#"
            UPDATE "BacktestTrial"
            SET attempt = attempt + 1, "updatedAt" = $2
            WHERE id = $1
            RETURNING attempt
            "#,
        )
        .bind(id)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)?;
        let attempt: i32 = row
            .try_get("attempt")
            .map_err(|e| RepoError::Internal(e.to_string()))?;
        Ok(attempt.max(0) as u32)
    }

    async fn record_rewards(
        &self,
        trial_id: &str,
        rewards: &HashMap<String, f64>,
        grader_id: Option<&str>,
    ) -> RepoResult<()> {
        if rewards.is_empty() {
            return Ok(());
        }

        // ON CONFLICT lets the orchestrator overwrite stale rewards if a
        // grader re-runs (e.g. after a flapping LLM judge stabilizes).
        let mut tx = self.pool.begin().await.map_err(to_repo_err)?;
        for (key, value) in rewards {
            sqlx::query(
                r#"
                INSERT INTO "BacktestTrialReward" ("trialId", key, value, "graderId")
                VALUES ($1, $2, $3, $4)
                ON CONFLICT ("trialId", key) DO UPDATE
                SET value = EXCLUDED.value,
                    "graderId" = COALESCE(EXCLUDED."graderId", "BacktestTrialReward"."graderId")
                "#,
            )
            .bind(trial_id)
            .bind(key)
            .bind(value)
            .bind(grader_id)
            .execute(&mut tx)
            .await
            .map_err(to_repo_err)?;
        }
        tx.commit().await.map_err(to_repo_err)?;
        Ok(())
    }

    async fn list_rewards(&self, trial_id: &str) -> RepoResult<HashMap<String, f64>> {
        let rows = sqlx::query(
            r#"SELECT key, value FROM "BacktestTrialReward" WHERE "trialId" = $1"#,
        )
        .bind(trial_id)
        .fetch_all(&self.pool)
        .await
        .map_err(to_repo_err)?;

        let mut out = HashMap::with_capacity(rows.len());
        for row in rows {
            let key: String = row
                .try_get("key")
                .map_err(|e| RepoError::Internal(e.to_string()))?;
            let value: f64 = row
                .try_get("value")
                .map_err(|e| RepoError::Internal(e.to_string()))?;
            out.insert(key, value);
        }
        Ok(out)
    }
}

/* ──────────────────────────────────────────────────────── */
/* Artifact repo                                             */
/* ──────────────────────────────────────────────────────── */

#[derive(Clone)]
pub struct PgBacktestArtifactRepo {
    pool: TracedPgPool,
}

impl PgBacktestArtifactRepo {
    pub fn new(pool: TracedPgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BacktestArtifactRepository for PgBacktestArtifactRepo {
    async fn create(
        &self,
        trial_id: &str,
        kind: BacktestArtifactKind,
        path: &str,
        size_bytes: Option<u64>,
        content_type: Option<&str>,
    ) -> RepoResult<BacktestArtifactRecord> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        let size_i64 = size_bytes
            .map(i64::try_from)
            .transpose()
            .map_err(|e| RepoError::Internal(format!("size_bytes overflow: {e}")))?;

        sqlx::query(
            r#"
            INSERT INTO "BacktestArtifact"
                (id, "trialId", kind, path, "sizeBytes", "contentType", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(&id)
        .bind(trial_id)
        .bind(artifact_kind_str(kind))
        .bind(path)
        .bind(size_i64)
        .bind(content_type)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(to_repo_err)?;

        sqlx::query(r#"SELECT * FROM "BacktestArtifact" WHERE id = $1"#)
            .bind(&id)
            .try_map(artifact_from_row)
            .fetch_one(&self.pool)
            .await
            .map_err(to_repo_err)
    }

    async fn list_by_trial(&self, trial_id: &str) -> RepoResult<Vec<BacktestArtifactRecord>> {
        sqlx::query(
            r#"
            SELECT * FROM "BacktestArtifact"
            WHERE "trialId" = $1
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(trial_id)
        .try_map(artifact_from_row)
        .fetch_all(&self.pool)
        .await
        .map_err(to_repo_err)
    }
}

/* ──────────────────────────────────────────────────────── */
/* Tests                                                     */
/* ──────────────────────────────────────────────────────── */

#[cfg(test)]
mod tests {
    //! Smoke checks for the helper round-trips. Real DB integration
    //! lives in `tests/backtests_repositories.rs` (Phase 1+) once a
    //! test fixture is wired up — the existing suite spins postgres
    //! through `chronicle_test_fixtures::TestPg`.

    use super::*;

    #[test]
    fn job_status_round_trip() {
        for s in [
            JobStatus::Pending,
            JobStatus::Running,
            JobStatus::Succeeded,
            JobStatus::Failed,
            JobStatus::Cancelled,
        ] {
            assert_eq!(parse_job_status(job_status_str(s)).unwrap(), s);
        }
    }

    #[test]
    fn trial_status_round_trip() {
        for s in [
            TrialStatus::Pending,
            TrialStatus::Setup,
            TrialStatus::Running,
            TrialStatus::Verifying,
            TrialStatus::Succeeded,
            TrialStatus::Failed,
            TrialStatus::Cancelled,
        ] {
            assert_eq!(parse_trial_status(trial_status_str(s)).unwrap(), s);
        }
    }

    #[test]
    fn job_mode_round_trip() {
        for m in [
            BacktestJobMode::Replay,
            BacktestJobMode::Compare,
            BacktestJobMode::Regression,
            BacktestJobMode::Suite,
        ] {
            assert_eq!(parse_job_mode(job_mode_str(m)).unwrap(), m);
        }
    }

    #[test]
    fn sandbox_driver_round_trip() {
        for d in [
            SandboxDriver::Docker,
            SandboxDriver::Daytona,
            SandboxDriver::Mock,
        ] {
            assert_eq!(parse_sandbox_driver(sandbox_driver_str(d)).unwrap(), d);
        }
    }

    #[test]
    fn timing_marker_columns_match_migration() {
        // Lockstep with migrations/013_create_backtest_runtime.sql.
        // If a column is renamed there, this test should be updated in
        // the same change.
        let pairs = [
            (TrialTimingMarker::EnvSetupStarted, "envSetupStartedAt"),
            (TrialTimingMarker::EnvSetupFinished, "envSetupFinishedAt"),
            (TrialTimingMarker::AgentSetupStarted, "agentSetupStartedAt"),
            (
                TrialTimingMarker::AgentSetupFinished,
                "agentSetupFinishedAt",
            ),
            (TrialTimingMarker::AgentRunStarted, "agentRunStartedAt"),
            (TrialTimingMarker::AgentRunFinished, "agentRunFinishedAt"),
            (TrialTimingMarker::VerifierStarted, "verifierStartedAt"),
            (TrialTimingMarker::VerifierFinished, "verifierFinishedAt"),
        ];
        for (marker, expected) in pairs {
            assert_eq!(marker.column(), expected);
        }
    }
}
