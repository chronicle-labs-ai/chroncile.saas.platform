//! HTTP handlers for `/api/platform/backtests/*`.
//!
//! Tenant scoping comes through the `AuthUser` extractor (the
//! `protected` router slice in `saas/mod.rs` injects it via WorkOS JWT
//! middleware). Every read returns rows scoped to `user.tenant_id`;
//! every write stamps `tenant_id` from the same place.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chronicle_auth::types::AuthUser;
use chronicle_domain::{
    BacktestDataKind, BacktestJobMode, BacktestRunSummary, CreateBacktestJobInput,
    CreateBacktestTrialInput, JobStatus, RetryConfig, SandboxDriver,
};
use chronicle_orchestrator::TrialTimeouts;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::routes::saas::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

use super::{
    mappers::job_record_to_run_summary,
    recipe_builder::{build_plan, BuildPlanOptions, RecipeCase},
    service::BacktestService,
    trace_projector::derive_cases_from_snapshot,
};

/* ── Wire shapes for the create endpoint ──────────────────── */

/// `POST /api/platform/backtests/jobs` request body. Carries the
/// recipe + caller-supplied case enumeration.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobRequest {
    pub name: String,
    pub recipe: chronicle_domain::BacktestRecipe,
    /// One per dataset case the caller wants to run.
    pub cases: Vec<CreateJobCase>,
    /// Bounded parallelism; defaults to 4.
    #[serde(default)]
    pub n_concurrent: Option<u32>,
    /// Sandbox driver — defaults to `daytona`.
    #[serde(default)]
    pub sandbox_driver: Option<SandboxDriver>,
    /// Optional retry policy override.
    #[serde(default)]
    pub retry_config: Option<RetryConfig>,
    /// Local path to the orchestrator host where the test script
    /// lives. Required for now; Phase 3.5 will move dataset-side.
    pub tests_dir: String,
    /// Optional sandbox image override.
    #[serde(default)]
    pub sandbox_image: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobCase {
    pub case_id: String,
    #[serde(default)]
    pub case_cluster: Option<String>,
    pub instruction: String,
    /// Optional gold reference (the original agent's response /
    /// expected behaviour). Surfaced to rubric graders via
    /// `GraderContext.expected_outcome`. Phase 7 lets the CLI /
    /// trace projector populate this; explicit cases without a gold
    /// reference still work.
    #[serde(default)]
    pub expected_outcome: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobResponse {
    pub job_id: String,
    pub run: BacktestRunSummary,
}

/* ── List query params ────────────────────────────────────── */

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListJobsParams {
    #[serde(default)]
    pub mode: Option<BacktestJobMode>,
    #[serde(default)]
    pub status: Option<JobStatus>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListJobsResponse {
    pub runs: Vec<BacktestRunSummary>,
}

/* ── Detail response ──────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobDetailResponse {
    pub run: BacktestRunSummary,
    pub job: chronicle_domain::BacktestJobRecord,
    pub trials: Vec<chronicle_domain::BacktestTrialRecord>,
    /// Per-trial rewards. Outer key = trial id, inner map = reward
    /// key → numeric value (matches the multi-key `reward.json`
    /// shape; single-value `reward.txt` produces a `{"reward": …}`
    /// entry). Trials that produced no reward are omitted, not
    /// represented as empty maps.
    pub rewards: HashMap<String, HashMap<String, f64>>,
}

/* ── Handlers ─────────────────────────────────────────────── */

pub async fn list_jobs(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Query(params): Query<ListJobsParams>,
) -> ApiResult<Json<ListJobsResponse>> {
    let service = require_service(&state)?;
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    let records = service
        .jobs_repo
        .list_by_tenant(&user.tenant_id, params.mode, params.status, limit, offset)
        .await?;

    let runs = records
        .iter()
        .map(|r| job_record_to_run_summary(r, None))
        .collect();
    Ok(Json(ListJobsResponse { runs }))
}

pub async fn get_job(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Path(job_id): Path<String>,
) -> ApiResult<Json<JobDetailResponse>> {
    let service = require_service(&state)?;
    let record = service
        .jobs_repo
        .find_by_id(&job_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Backtest job"))?;
    if record.tenant_id != user.tenant_id {
        return Err(ApiError::not_found("Backtest job"));
    }

    let trials = service.trials_repo.list_by_job(&job_id).await?;
    let trial_count = Some(trials.len() as u32);
    let summary = job_record_to_run_summary(&record, trial_count);

    // Pull rewards per trial. Sequential is fine for typical job
    // sizes (<= a few hundred trials); larger fan-out would warrant
    // `futures::future::try_join_all` here.
    let mut rewards: HashMap<String, HashMap<String, f64>> = HashMap::new();
    for trial in &trials {
        let r = service
            .trials_repo
            .list_rewards(&trial.id)
            .await
            .unwrap_or_default();
        if !r.is_empty() {
            rewards.insert(trial.id.clone(), r);
        }
    }

    Ok(Json(JobDetailResponse {
        run: summary,
        job: record,
        trials,
        rewards,
    }))
}

pub async fn create_job(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(req): Json<CreateJobRequest>,
) -> ApiResult<(StatusCode, Json<CreateJobResponse>)> {
    let service = require_service(&state)?;

    if req.recipe.agents.is_empty() {
        return Err(ApiError::bad_request("recipe.agents must be non-empty"));
    }

    // ── Resolve cases ─────────────────────────────────────────
    //
    // Three paths:
    //   1. Caller supplied explicit cases → use them verbatim.
    //   2. Caller supplied no cases AND recipe.data.kind == Dataset
    //      → derive one case per trace from the dataset snapshot
    //        held in `BacktestService.availability`.
    //   3. Anything else → 400.
    let recipe_cases = if req.cases.is_empty() {
        match req.recipe.data.kind {
            BacktestDataKind::Dataset => {
                derive_cases_from_dataset(&service, &req.recipe)?
            }
            _ => {
                return Err(ApiError::bad_request(
                    "cases must be non-empty unless recipe.data.kind = \"dataset\" \
                     (auto-derive from snapshot)",
                ));
            }
        }
    } else {
        req.cases
            .iter()
            .map(|c| RecipeCase {
                case_id: c.case_id.clone(),
                case_cluster: c.case_cluster.clone(),
                instruction: c.instruction.clone(),
                expected_outcome: c.expected_outcome.clone(),
                agent_trial_ids: HashMap::new(),
            })
            .collect()
    };

    if recipe_cases.is_empty() {
        return Err(ApiError::bad_request(
            "no runnable cases — dataset snapshot is empty or lacks events with a \
             trace_id; supply explicit `cases` or pick a populated dataset",
        ));
    }

    let recipe_json = serde_json::to_value(&req.recipe).map_err(|e| {
        ApiError::bad_request(format!("recipe failed to serialize: {e}"))
    })?;
    let n_concurrent = req.n_concurrent.unwrap_or(4).max(1);
    let sandbox_driver = req.sandbox_driver.unwrap_or(SandboxDriver::Daytona);

    let job_record = service
        .create_job_row(CreateBacktestJobInput {
            tenant_id: user.tenant_id.clone(),
            name: req.name.clone(),
            mode: req.recipe.mode,
            recipe: recipe_json,
            n_concurrent,
            sandbox_driver,
            retry_config: req.retry_config.clone(),
            created_by: Some(user.id.clone()),
            scheduled_for: None,
        })
        .await?;

    // Pre-create trial rows so the dashboard can reference them
    // immediately. We ask the trial repo to mint ids and fold them
    // into the recipe builder so the orchestrator uses the same ids.
    let mut trial_ids_per_case: HashMap<String, HashMap<String, String>> = HashMap::new();
    for case in &recipe_cases {
        for agent in &req.recipe.agents {
            let trial_record = service
                .trials_repo
                .create(CreateBacktestTrialInput {
                    job_id: job_record.id.clone(),
                    tenant_id: user.tenant_id.clone(),
                    agent_id: agent.id.clone(),
                    agent_label: agent.label.clone(),
                    is_baseline: req
                        .recipe
                        .agents
                        .first()
                        .map(|a| a.id == agent.id)
                        .unwrap_or(false),
                    case_id: case.case_id.clone(),
                    case_cluster: case.case_cluster.clone(),
                })
                .await?;
            trial_ids_per_case
                .entry(case.case_id.clone())
                .or_default()
                .insert(agent.id.clone(), trial_record.id);
        }
    }

    let recipe_cases: Vec<RecipeCase> = recipe_cases
        .into_iter()
        .map(|mut c| {
            c.agent_trial_ids = trial_ids_per_case
                .get(&c.case_id)
                .cloned()
                .unwrap_or_default();
            c
        })
        .collect();

    let plan = build_plan(
        req.recipe.clone(),
        BuildPlanOptions {
            job_id: job_record.id.clone(),
            tenant_id: user.tenant_id.clone(),
            n_concurrent,
            sandbox_driver,
            retry_config: req.retry_config.unwrap_or_default(),
            cases: recipe_cases,
            tests_dir: PathBuf::from(req.tests_dir),
            sandbox_image: req.sandbox_image,
            timeouts: TrialTimeouts::default(),
        },
    );

    // Refresh the row count now that all trials exist.
    let total = plan.trials.len() as u32;
    let _ = service
        .jobs_repo
        .update_summary(&job_record.id, Some(total), 0, 0, None)
        .await;

    service.start_run(plan);

    let trial_count = Some(total);
    let summary = job_record_to_run_summary(&job_record, trial_count);
    Ok((
        StatusCode::ACCEPTED,
        Json(CreateJobResponse {
            job_id: job_record.id,
            run: summary,
        }),
    ))
}

pub async fn cancel_job(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Path(job_id): Path<String>,
) -> ApiResult<Json<CancelJobResponse>> {
    let service = require_service(&state)?;
    // Verify tenant ownership before touching the runtime table.
    let record = service
        .jobs_repo
        .find_by_id(&job_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Backtest job"))?;
    if record.tenant_id != user.tenant_id {
        return Err(ApiError::not_found("Backtest job"));
    }

    let aborted = service.cancel(&job_id);
    if aborted {
        let _ = service
            .jobs_repo
            .update_status(
                &job_id,
                JobStatus::Cancelled,
                None,
                Some(chrono::Utc::now()),
            )
            .await;
    }
    Ok(Json(CancelJobResponse {
        job_id,
        aborted,
        previous_status: record.status,
    }))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelJobResponse {
    pub job_id: String,
    /// `true` iff the job had a live in-process task that was aborted.
    /// `false` means the job had already finished — calling cancel
    /// is a no-op and the persisted status is unchanged.
    pub aborted: bool,
    /// What the job's status was just before this call. Useful for
    /// CLI / dashboard so they can show "already done" instead of
    /// "cancelled successfully".
    pub previous_status: JobStatus,
}

/* ── Helpers ──────────────────────────────────────────────── */

pub(super) fn require_service(state: &SaasAppState) -> ApiResult<&BacktestService> {
    state
        .backtests
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Backtests service is not enabled in this build"))
}

/// Look up the dataset snapshot referenced by `recipe.data.dataset`
/// in the service's availability cache and project its traces into
/// `RecipeCase`s. Returns a 400-style error when the dataset id is
/// missing, unknown, or has no usable snapshot.
fn derive_cases_from_dataset(
    service: &BacktestService,
    recipe: &chronicle_domain::BacktestRecipe,
) -> ApiResult<Vec<RecipeCase>> {
    let dataset_id = recipe.data.dataset.as_deref().ok_or_else(|| {
        ApiError::bad_request(
            "recipe.data.kind = \"dataset\" but recipe.data.dataset is missing",
        )
    })?;

    let snapshot = service
        .availability
        .dataset_snapshots
        .get(dataset_id)
        .ok_or_else(|| {
            ApiError::bad_request(format!(
                "no snapshot found for dataset '{dataset_id}'; available datasets: {:?}",
                service
                    .availability
                    .dataset_snapshots
                    .keys()
                    .collect::<Vec<_>>()
            ))
        })?;

    let (cases, skipped) = derive_cases_from_snapshot(snapshot);
    if !skipped.is_empty() {
        tracing::warn!(
            dataset_id = %dataset_id,
            skipped = skipped.len(),
            cases = cases.len(),
            "trace_projector: skipped some traces while deriving cases"
        );
        for s in &skipped {
            tracing::debug!(
                trace_id = %s.trace_id,
                reason = %s.reason,
                "skipped trace"
            );
        }
    }
    Ok(cases)
}
