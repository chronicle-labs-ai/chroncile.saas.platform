//! Projections from the runtime DB rows (`BacktestJobRecord`,
//! `BacktestTrialRecord`) to the wire shapes the dashboard already
//! consumes (`BacktestRunSummary`, `BacktestRecipe`).
//!
//! Lives next to the routes because these projections are read-only
//! and don't belong on the domain types themselves (they collapse
//! per-trial counts, derive verdicts, etc.).

use chronicle_domain::{
    BacktestJobRecord, BacktestRecipe, BacktestRunStatus, BacktestRunSummary,
    BacktestTrialRecord, JobStatus, TrialStatus,
};

/// Project a `BacktestJobRecord` + its trial records into the dashboard
/// list-view summary the frontend already renders. Trial count
/// derivation is best-effort: the orchestrator stamps `total_trials`
/// after the run starts, so freshly-pending jobs return `None`.
pub fn job_record_to_run_summary(
    job: &BacktestJobRecord,
    trial_count: Option<u32>,
) -> BacktestRunSummary {
    // The recipe was persisted as an opaque JSONB blob. We deserialize
    // back into the typed shape so the projection can read agent ids,
    // dataset label, environment label. On failure, we surface a
    // best-effort row — the dashboard will still render the lifecycle
    // bits even if recipe parsing fails.
    let parsed_recipe: Option<BacktestRecipe> = serde_json::from_value(job.recipe.clone()).ok();

    let agent_ids = parsed_recipe
        .as_ref()
        .map(|r| r.agents.iter().map(|a| a.id.clone()).collect())
        .unwrap_or_default();

    let dataset_label = parsed_recipe
        .as_ref()
        .and_then(|r| r.data.dataset_label.clone())
        .unwrap_or_else(|| "—".to_string());

    let environment_label = parsed_recipe
        .as_ref()
        .and_then(|r| r.environment.as_ref().map(|e| e.label.clone()));

    let hue = parsed_recipe
        .as_ref()
        .and_then(|r| r.agents.first().map(|a| a.hue.clone()));

    let total_runs = trial_count.or(job.total_trials);

    BacktestRunSummary {
        id: job.id.clone(),
        name: job.name.clone(),
        mode: job.mode,
        status: job_status_to_run_status(job.status),
        updated_at: job.updated_at,
        scheduled_for: job.scheduled_for,
        dataset_label,
        environment_label,
        agent_ids,
        total_runs,
        verdict: job.verdict.clone(),
        hue,
        // Phase 3 doesn't surface divergences yet — that's a Phase 3.5
        // computation against the trials table. The dashboard
        // gracefully renders a `—` for missing values.
        divergences: None,
        owner: job.created_by.clone(),
    }
}

/// Translate the orchestrator's `JobStatus` to the dashboard's
/// `BacktestRunStatus`. The two enums diverge: orchestrator never
/// emits `paused` / `draft` / `scheduled`; we collapse `succeeded` and
/// `failed` to `done` / `failed` accordingly. Pending jobs surface as
/// `scheduled` so the list view's status pill matches user expectation.
pub fn job_status_to_run_status(s: JobStatus) -> BacktestRunStatus {
    match s {
        JobStatus::Pending => BacktestRunStatus::Scheduled,
        JobStatus::Running => BacktestRunStatus::Running,
        JobStatus::Succeeded => BacktestRunStatus::Done,
        JobStatus::Failed => BacktestRunStatus::Failed,
        JobStatus::Cancelled => BacktestRunStatus::Failed,
    }
}

/// True iff a trial is in a terminal state. Used by the divergence
/// counter Phase 3.5 will add.
pub fn trial_is_terminal(s: TrialStatus) -> bool {
    matches!(
        s,
        TrialStatus::Succeeded | TrialStatus::Failed | TrialStatus::Cancelled
    )
}

/// Derived "completed / total" tuple for the dashboard's progress bar.
/// `None` when total is not yet known.
pub fn completion_pair(job: &BacktestJobRecord) -> Option<(u32, u32)> {
    job.total_trials.map(|t| (job.completed_trials, t))
}

#[allow(dead_code)]
pub fn _trial_record_keep_dep(_: &BacktestTrialRecord) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_status_collapses_into_run_status() {
        assert_eq!(
            job_status_to_run_status(JobStatus::Pending),
            BacktestRunStatus::Scheduled
        );
        assert_eq!(
            job_status_to_run_status(JobStatus::Running),
            BacktestRunStatus::Running
        );
        assert_eq!(
            job_status_to_run_status(JobStatus::Succeeded),
            BacktestRunStatus::Done
        );
        assert_eq!(
            job_status_to_run_status(JobStatus::Failed),
            BacktestRunStatus::Failed
        );
        assert_eq!(
            job_status_to_run_status(JobStatus::Cancelled),
            BacktestRunStatus::Failed
        );
    }

    #[test]
    fn trial_terminal_check() {
        assert!(trial_is_terminal(TrialStatus::Succeeded));
        assert!(trial_is_terminal(TrialStatus::Failed));
        assert!(trial_is_terminal(TrialStatus::Cancelled));
        assert!(!trial_is_terminal(TrialStatus::Running));
        assert!(!trial_is_terminal(TrialStatus::Pending));
    }
}
