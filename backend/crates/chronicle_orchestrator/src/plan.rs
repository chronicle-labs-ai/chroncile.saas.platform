//! Orchestrator-internal "what to run" types.
//!
//! Distinct from `chronicle_domain::JobConfig` — that's the user's
//! recipe; this is the resolved, expanded plan the orchestrator
//! consumes after dataset cases × agents have been enumerated.
//!
//! The translation step (recipe → JobPlan) is intentionally separate
//! and lives in `chronicle_api` (Phase 3), so this crate stays
//! agnostic of how cases are persisted.

use chronicle_domain::{BacktestGrader, BacktestRecipe, RetryConfig, SandboxDriver};
use chronicle_sandbox::{ImageSource, ResourceLimits, StartOpts};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

/// Single (case × agent) cell that the orchestrator will run as one
/// trial. The `case_id` is opaque to the orchestrator; it just gets
/// uploaded to the sandbox alongside the test fixtures.
#[derive(Debug, Clone)]
pub struct TrialPlan {
    /// Pre-allocated trial id (CUID/ULID). The orchestrator persists
    /// this onto `BacktestTrial.id` at create time so the SSE stream
    /// can reference trials before they're picked up.
    pub trial_id: String,

    pub agent_id: String,
    pub agent_label: String,
    pub is_baseline: bool,

    pub case_id: String,
    pub case_cluster: Option<String>,

    /// The instruction shown to the agent. Resolved per-case from the
    /// dataset by the API layer.
    pub instruction: String,

    /// Optional gold reference for graders — e.g. a serialized
    /// trace of how the original (production) agent handled the same
    /// instruction, or a hand-authored expected answer. The value is
    /// opaque to the orchestrator; rubric graders see it via
    /// `GraderContext.expected_outcome` and trace-state-diff /
    /// tool-call-match graders (Phase 7.5+) parse it as JSON.
    ///
    /// `None` means "no gold reference; rubric falls back to scoring
    /// agent output against the rubric text alone."
    pub expected_outcome: Option<String>,

    /// Local path to the directory containing `test.sh` (or
    /// `reward.json` writer). Uploaded to `/tests/` in the sandbox at
    /// the start of the verifier phase.
    pub tests_dir: PathBuf,

    /// Optional env vars baked into the verifier's `bash test.sh`
    /// invocation (e.g. `OPENAI_API_KEY` for LLM-judge graders).
    pub verifier_env: HashMap<String, String>,
}

/// Resolved Job-level config the orchestrator consumes.
#[derive(Debug, Clone)]
pub struct JobPlan {
    pub job_id: String,
    pub tenant_id: String,
    pub recipe: BacktestRecipe,
    pub trials: Vec<TrialPlan>,

    pub n_concurrent: u32,
    pub sandbox_driver: SandboxDriver,
    pub retry_config: RetryConfig,

    pub start_opts_template: TrialStartOpts,
    pub timeouts: TrialTimeouts,

    /// Graders the recipe declared. Cloned from `recipe.graders` so
    /// the orchestrator doesn't have to re-parse the recipe blob per
    /// trial. Phase 6 only consumes `kind = Rubric`; other kinds are
    /// skipped (see `judges::rubric_graders`).
    pub graders: Vec<BacktestGrader>,
}

/// Per-trial sandbox `StartOpts` template. The orchestrator clones
/// this and stamps in `session_id` + label overrides per trial.
///
/// Pulled out as its own struct so the API layer (Phase 3) builds it
/// once per job from the recipe + task config, not per trial.
#[derive(Debug, Clone)]
pub struct TrialStartOpts {
    pub image: ImageSource,
    pub resources: ResourceLimits,
    pub allow_internet: bool,
    pub env: HashMap<String, String>,
    pub labels: HashMap<String, String>,
    pub max_lifetime: Duration,
    pub idle_timeout: Option<Duration>,
}

impl TrialStartOpts {
    /// Build a `StartOpts` for a specific trial inside this job. Stamps
    /// `session_id = "<job_id>__<trial_id>"` and adds standard labels.
    pub fn into_start_opts(
        &self,
        job_id: &str,
        trial: &TrialPlan,
        tenant_id: &str,
    ) -> StartOpts {
        let session_id = format!("{job_id}__{}", trial.trial_id);
        let mut labels = self.labels.clone();
        labels.insert("chronicle.job_id".to_string(), job_id.to_string());
        labels.insert("chronicle.trial_id".to_string(), trial.trial_id.clone());
        labels.insert("chronicle.tenant_id".to_string(), tenant_id.to_string());
        labels.insert("chronicle.agent_id".to_string(), trial.agent_id.clone());

        StartOpts {
            session_id,
            image: self.image.clone(),
            resources: self.resources,
            allow_internet: self.allow_internet,
            env: self.env.clone(),
            labels,
            max_lifetime: self.max_lifetime,
            idle_timeout: self.idle_timeout,
        }
    }
}

/// Per-phase timeouts, mirroring Harbor's
/// `agent_setup_timeout_sec`/`agent_timeout_sec`/`verifier_timeout_sec`/
/// `environment_build_timeout_sec`.
#[derive(Debug, Clone, Copy)]
pub struct TrialTimeouts {
    pub env_setup: Duration,
    pub agent_setup: Duration,
    pub agent_run: Duration,
    pub verifier: Duration,
}

impl Default for TrialTimeouts {
    fn default() -> Self {
        Self {
            env_setup: Duration::from_secs(600),
            agent_setup: Duration::from_secs(360),
            agent_run: Duration::from_secs(30 * 60),
            verifier: Duration::from_secs(600),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn trial(id: &str) -> TrialPlan {
        TrialPlan {
            trial_id: id.to_string(),
            agent_id: "agent_v1".to_string(),
            agent_label: "Agent v1".to_string(),
            is_baseline: false,
            case_id: "case_a".to_string(),
            case_cluster: None,
            instruction: "do the thing".to_string(),
            expected_outcome: None,
            tests_dir: "/tmp/tests".into(),
            verifier_env: HashMap::new(),
        }
    }

    #[test]
    fn into_start_opts_sets_session_id_and_labels() {
        let template = TrialStartOpts {
            image: ImageSource::None,
            resources: ResourceLimits::small(),
            allow_internet: true,
            env: HashMap::new(),
            labels: HashMap::new(),
            max_lifetime: Duration::from_secs(60),
            idle_timeout: None,
        };
        let trial = trial("trial_xyz");
        let opts = template.into_start_opts("job_abc", &trial, "tenant_01");
        assert_eq!(opts.session_id, "job_abc__trial_xyz");
        assert_eq!(
            opts.labels.get("chronicle.job_id").map(String::as_str),
            Some("job_abc")
        );
        assert_eq!(
            opts.labels.get("chronicle.trial_id").map(String::as_str),
            Some("trial_xyz")
        );
        assert_eq!(
            opts.labels.get("chronicle.tenant_id").map(String::as_str),
            Some("tenant_01")
        );
        assert_eq!(
            opts.labels.get("chronicle.agent_id").map(String::as_str),
            Some("agent_v1")
        );
    }
}
