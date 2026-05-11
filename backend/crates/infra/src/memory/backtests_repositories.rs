//! In-memory implementations of the backtest repository traits. Used
//! by `BACKEND_MODE=memory` for dev work without Postgres + by
//! integration tests that don't want a fixture container.
//!
//! Keeps the same observable behaviour as the Postgres repos
//! (timestamps stamped on first call, multi-key reward upsert, attempt
//! bumping). Storage is `Arc<DashMap>` so multiple `Arc<dyn Repo>`
//! handles share the same data — matches the postgres pattern where
//! every clone points at the same connection pool.

use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use std::collections::HashMap;
use std::sync::Arc;

use chronicle_domain::{
    BacktestArtifactKind, BacktestArtifactRecord, BacktestJobMode, BacktestJobRecord,
    BacktestTrialRecord, CreateBacktestJobInput, CreateBacktestTrialInput, JobStatus,
    TrialException, TrialStatus, TrialTimings,
};
use chronicle_interfaces::{
    BacktestArtifactRepository, BacktestJobRepository, BacktestTrialRepository, RepoError,
    RepoResult, TrialTimingMarker,
};

fn new_id() -> String {
    cuid2::create_id()
}

/* ── Job repo ───────────────────────────────────────────── */

#[derive(Clone, Default)]
pub struct InMemoryBacktestJobRepo {
    store: Arc<DashMap<String, BacktestJobRecord>>,
}

#[async_trait]
impl BacktestJobRepository for InMemoryBacktestJobRepo {
    async fn create(&self, input: CreateBacktestJobInput) -> RepoResult<BacktestJobRecord> {
        let id = new_id();
        let now = Utc::now();
        let rec = BacktestJobRecord {
            id: id.clone(),
            tenant_id: input.tenant_id,
            name: input.name,
            mode: input.mode,
            recipe: input.recipe,
            status: JobStatus::Pending,
            verdict: None,
            n_concurrent: input.n_concurrent,
            sandbox_driver: input.sandbox_driver,
            retry_config: input.retry_config,
            created_by: input.created_by,
            scheduled_for: input.scheduled_for,
            created_at: now,
            started_at: None,
            finished_at: None,
            total_trials: None,
            completed_trials: 0,
            failed_trials: 0,
            exception_kind: None,
            updated_at: now,
        };
        self.store.insert(id, rec.clone());
        Ok(rec)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestJobRecord>> {
        Ok(self.store.get(id).map(|e| e.clone()))
    }

    async fn list_by_tenant(
        &self,
        tenant_id: &str,
        mode: Option<BacktestJobMode>,
        status: Option<JobStatus>,
        limit: usize,
        offset: usize,
    ) -> RepoResult<Vec<BacktestJobRecord>> {
        let mut rows: Vec<BacktestJobRecord> = self
            .store
            .iter()
            .map(|e| e.value().clone())
            .filter(|r| r.tenant_id == tenant_id)
            .filter(|r| mode.map_or(true, |m| r.mode == m))
            .filter(|r| status.map_or(true, |s| r.status == s))
            .collect();
        rows.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(rows.into_iter().skip(offset).take(limit).collect())
    }

    async fn count_by_tenant(&self, tenant_id: &str) -> RepoResult<usize> {
        Ok(self
            .store
            .iter()
            .filter(|e| e.value().tenant_id == tenant_id)
            .count())
    }

    async fn update_status(
        &self,
        id: &str,
        status: JobStatus,
        started_at: Option<chrono::DateTime<Utc>>,
        finished_at: Option<chrono::DateTime<Utc>>,
    ) -> RepoResult<BacktestJobRecord> {
        let mut entry = self
            .store
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        entry.status = status;
        if let Some(t) = started_at {
            entry.started_at = Some(t);
        }
        if let Some(t) = finished_at {
            entry.finished_at = Some(t);
        }
        entry.updated_at = Utc::now();
        Ok(entry.clone())
    }

    async fn update_summary(
        &self,
        id: &str,
        total_trials: Option<u32>,
        completed_trials: u32,
        failed_trials: u32,
        exception_kind: Option<&str>,
    ) -> RepoResult<BacktestJobRecord> {
        let mut entry = self
            .store
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        if let Some(t) = total_trials {
            entry.total_trials = Some(t);
        }
        entry.completed_trials = completed_trials;
        entry.failed_trials = failed_trials;
        if let Some(k) = exception_kind {
            entry.exception_kind = Some(k.to_string());
        }
        entry.updated_at = Utc::now();
        Ok(entry.clone())
    }

    async fn set_verdict(&self, id: &str, verdict: &str) -> RepoResult<BacktestJobRecord> {
        let mut entry = self
            .store
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        entry.verdict = Some(verdict.to_string());
        entry.updated_at = Utc::now();
        Ok(entry.clone())
    }
}

/* ── Trial repo ─────────────────────────────────────────── */

#[derive(Clone, Default)]
pub struct InMemoryBacktestTrialRepo {
    trials: Arc<DashMap<String, BacktestTrialRecord>>,
    rewards: Arc<DashMap<String, HashMap<String, f64>>>,
}

#[async_trait]
impl BacktestTrialRepository for InMemoryBacktestTrialRepo {
    async fn create(
        &self,
        input: CreateBacktestTrialInput,
    ) -> RepoResult<BacktestTrialRecord> {
        let id = new_id();
        let now = Utc::now();
        let rec = BacktestTrialRecord {
            id: id.clone(),
            job_id: input.job_id,
            tenant_id: input.tenant_id,
            agent_id: input.agent_id,
            agent_label: input.agent_label,
            is_baseline: input.is_baseline,
            case_id: input.case_id,
            case_cluster: input.case_cluster,
            status: TrialStatus::Pending,
            timings: TrialTimings::default(),
            duration_ms: None,
            sandbox_id: None,
            exception: None,
            attempt: 0,
            created_at: now,
            updated_at: now,
        };
        self.trials.insert(id, rec.clone());
        Ok(rec)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestTrialRecord>> {
        Ok(self.trials.get(id).map(|e| e.clone()))
    }

    async fn list_by_job(&self, job_id: &str) -> RepoResult<Vec<BacktestTrialRecord>> {
        let mut rows: Vec<BacktestTrialRecord> = self
            .trials
            .iter()
            .map(|e| e.value().clone())
            .filter(|r| r.job_id == job_id)
            .collect();
        rows.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        Ok(rows)
    }

    async fn list_by_job_status(
        &self,
        job_id: &str,
        status: TrialStatus,
    ) -> RepoResult<Vec<BacktestTrialRecord>> {
        Ok(self
            .trials
            .iter()
            .map(|e| e.value().clone())
            .filter(|r| r.job_id == job_id && r.status == status)
            .collect())
    }

    async fn record_timing(
        &self,
        id: &str,
        marker: TrialTimingMarker,
    ) -> RepoResult<()> {
        let mut entry = self
            .trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        let now = Utc::now();
        // First-write-wins (mirrors the Postgres COALESCE-on-null
        // pattern). The orchestrator's retry path bumps `attempt`
        // separately rather than restamping timings.
        let setter = |slot: &mut Option<chrono::DateTime<Utc>>| {
            if slot.is_none() {
                *slot = Some(now);
            }
        };
        match marker {
            TrialTimingMarker::EnvSetupStarted => {
                setter(&mut entry.timings.env_setup_started_at)
            }
            TrialTimingMarker::EnvSetupFinished => {
                setter(&mut entry.timings.env_setup_finished_at)
            }
            TrialTimingMarker::AgentSetupStarted => {
                setter(&mut entry.timings.agent_setup_started_at)
            }
            TrialTimingMarker::AgentSetupFinished => {
                setter(&mut entry.timings.agent_setup_finished_at)
            }
            TrialTimingMarker::AgentRunStarted => {
                setter(&mut entry.timings.agent_run_started_at)
            }
            TrialTimingMarker::AgentRunFinished => {
                setter(&mut entry.timings.agent_run_finished_at)
            }
            TrialTimingMarker::VerifierStarted => {
                setter(&mut entry.timings.verifier_started_at)
            }
            TrialTimingMarker::VerifierFinished => {
                setter(&mut entry.timings.verifier_finished_at)
            }
        }
        entry.updated_at = now;
        Ok(())
    }

    async fn update_status(&self, id: &str, status: TrialStatus) -> RepoResult<()> {
        let mut entry = self
            .trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        entry.status = status;
        entry.updated_at = Utc::now();
        Ok(())
    }

    async fn mark_terminal(
        &self,
        id: &str,
        status: TrialStatus,
        duration_ms: Option<u32>,
        exception: Option<TrialException>,
    ) -> RepoResult<BacktestTrialRecord> {
        let mut entry = self
            .trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        entry.status = status;
        if let Some(d) = duration_ms {
            entry.duration_ms = Some(d);
        }
        if let Some(e) = exception {
            entry.exception = Some(e);
        }
        entry.updated_at = Utc::now();
        Ok(entry.clone())
    }

    async fn set_sandbox_id(&self, id: &str, sandbox_id: &str) -> RepoResult<()> {
        let mut entry = self
            .trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        entry.sandbox_id = Some(sandbox_id.to_string());
        Ok(())
    }

    async fn bump_attempt(&self, id: &str) -> RepoResult<u32> {
        let mut entry = self
            .trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        entry.attempt = entry.attempt.saturating_add(1);
        Ok(entry.attempt)
    }

    async fn record_rewards(
        &self,
        trial_id: &str,
        rewards: &HashMap<String, f64>,
        _grader_id: Option<&str>,
    ) -> RepoResult<()> {
        let mut entry = self.rewards.entry(trial_id.to_string()).or_default();
        for (k, v) in rewards {
            entry.insert(k.clone(), *v);
        }
        Ok(())
    }

    async fn list_rewards(&self, trial_id: &str) -> RepoResult<HashMap<String, f64>> {
        Ok(self
            .rewards
            .get(trial_id)
            .map(|e| e.clone())
            .unwrap_or_default())
    }
}

/* ── Artifact repo ──────────────────────────────────────── */

#[derive(Clone, Default)]
pub struct InMemoryBacktestArtifactRepo {
    store: Arc<DashMap<String, Vec<BacktestArtifactRecord>>>,
}

#[async_trait]
impl BacktestArtifactRepository for InMemoryBacktestArtifactRepo {
    async fn create(
        &self,
        trial_id: &str,
        kind: BacktestArtifactKind,
        path: &str,
        size_bytes: Option<u64>,
        content_type: Option<&str>,
    ) -> RepoResult<BacktestArtifactRecord> {
        let id = new_id();
        let rec = BacktestArtifactRecord {
            id: id.clone(),
            trial_id: trial_id.to_string(),
            kind,
            path: path.to_string(),
            size_bytes,
            content_type: content_type.map(String::from),
            created_at: Utc::now(),
        };
        self.store
            .entry(trial_id.to_string())
            .or_default()
            .push(rec.clone());
        Ok(rec)
    }

    async fn list_by_trial(&self, trial_id: &str) -> RepoResult<Vec<BacktestArtifactRecord>> {
        Ok(self.store.get(trial_id).map(|e| e.clone()).unwrap_or_default())
    }
}
