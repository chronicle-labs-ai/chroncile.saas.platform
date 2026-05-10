//! Translate `BacktestRecipe` + caller-supplied cases into a
//! `JobPlan` the orchestrator consumes.
//!
//! Phase 3 takes cases as an explicit list in the request body; Phase
//! 3.5 will move case enumeration server-side once `domain::datasets`
//! gains case storage.
//!
//! Default sandbox image: configurable per-tenant (Phase 3.5). For now
//! we use a small Linux image; the orchestrator's mock driver ignores
//! it. The Daytona driver pulls it on `start()`.

use chronicle_domain::{
    BacktestEnvironmentRef, BacktestRecipe, RetryConfig, SandboxDriver,
};
use chronicle_orchestrator::{JobPlan, TrialPlan, TrialStartOpts, TrialTimeouts};
use chronicle_sandbox::{ImageSource, ResourceLimits};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

/// Tweakable knobs for plan building. Wired through the request body
/// + per-tenant config. Defaults are conservative.
#[derive(Debug, Clone)]
pub struct BuildPlanOptions {
    pub job_id: String,
    pub tenant_id: String,
    pub n_concurrent: u32,
    pub sandbox_driver: SandboxDriver,
    pub retry_config: RetryConfig,
    /// One per case the API caller wants to run. Each becomes one
    /// `TrialPlan` per agent in the recipe.
    pub cases: Vec<RecipeCase>,
    /// Local path on the orchestrator host that contains the test
    /// script (`test.sh`) for this recipe. Phase 3.5 will look this
    /// up from the dataset; for now the API caller passes it.
    pub tests_dir: PathBuf,
    /// Optional sandbox image override (vs the default).
    pub sandbox_image: Option<String>,
    /// Trial-level timeouts.
    pub timeouts: TrialTimeouts,
}

/// Per-case input for plan building. Pre-allocated trial ids let the
/// dashboard reference cells immediately, before the orchestrator
/// picks them up.
#[derive(Debug, Clone)]
pub struct RecipeCase {
    pub case_id: String,
    pub case_cluster: Option<String>,
    pub instruction: String,
    /// Optional gold reference passed through to graders as
    /// `GraderContext.expected_outcome`. For trace-derived cases this
    /// is the serialized "what the original agent did" (events).
    pub expected_outcome: Option<String>,
    /// Optional pre-allocated trial id per (case, agent). When `None`,
    /// the builder generates one per (case × agent) pair.
    pub agent_trial_ids: HashMap<String, String>,
}

pub fn default_image() -> ImageSource {
    // `alpine:3.19` works on Daytona out of the box and is small
    // enough that pulls are fast on dev accounts. Tenants will
    // override per-recipe in Phase 3.5.
    ImageSource::PrebuiltImage("alpine:3.19".to_string())
}

/// Resolve a recipe → executable plan. Returns the job id (echoed
/// from `opts`) plus the JobPlan to feed into `BacktestService::start_run`.
pub fn build_plan(recipe: BacktestRecipe, opts: BuildPlanOptions) -> JobPlan {
    let image = opts
        .sandbox_image
        .clone()
        .map(ImageSource::PrebuiltImage)
        .unwrap_or_else(default_image);

    let trials = enumerate_trials(&recipe, &opts);

    let labels = base_labels(&opts);

    let start_opts_template = TrialStartOpts {
        image,
        // Phase 3 uses the small default; per-recipe resource overrides
        // are Phase 3.5 (need to land in `BacktestRecipe` first).
        resources: ResourceLimits::small(),
        // Recipe doesn't carry an `allow_internet` flag yet — assume
        // unrestricted by default. Phase 3.5 wires this through the
        // recipe / per-tenant policy.
        allow_internet: true,
        env: HashMap::new(),
        labels,
        max_lifetime: Duration::from_secs(60 * 60),
        idle_timeout: Some(Duration::from_secs(60 * 5)),
    };

    let graders = recipe.graders.clone();
    JobPlan {
        job_id: opts.job_id,
        tenant_id: opts.tenant_id,
        recipe,
        trials,
        n_concurrent: opts.n_concurrent.max(1),
        sandbox_driver: opts.sandbox_driver,
        retry_config: opts.retry_config,
        start_opts_template,
        timeouts: opts.timeouts,
        graders,
    }
}

fn enumerate_trials(recipe: &BacktestRecipe, opts: &BuildPlanOptions) -> Vec<TrialPlan> {
    if recipe.agents.is_empty() {
        return Vec::new();
    }

    let mut out = Vec::with_capacity(opts.cases.len() * recipe.agents.len());
    for case in &opts.cases {
        for (idx, agent) in recipe.agents.iter().enumerate() {
            let trial_id = case
                .agent_trial_ids
                .get(&agent.id)
                .cloned()
                .unwrap_or_else(|| format!("{}__{}", case.case_id, agent.id));
            out.push(TrialPlan {
                trial_id,
                agent_id: agent.id.clone(),
                agent_label: agent.label.clone(),
                is_baseline: idx == 0,
                case_id: case.case_id.clone(),
                case_cluster: case.case_cluster.clone(),
                instruction: case.instruction.clone(),
                expected_outcome: case.expected_outcome.clone(),
                tests_dir: opts.tests_dir.clone(),
                verifier_env: HashMap::new(),
            });
        }
    }
    out
}

fn base_labels(opts: &BuildPlanOptions) -> HashMap<String, String> {
    let mut labels = HashMap::new();
    labels.insert("chronicle.product".to_string(), "backtests".to_string());
    labels.insert("chronicle.tenant_id".to_string(), opts.tenant_id.clone());
    labels.insert("chronicle.job_id".to_string(), opts.job_id.clone());
    labels
}

/// Optional helper exposed for tests / CLI: stamp the recipe's
/// environment ref onto a label too. The `BacktestService` doesn't
/// require this.
pub fn maybe_environment_label(env: Option<&BacktestEnvironmentRef>) -> Option<String> {
    env.map(|e| e.label.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chronicle_domain::{
        BacktestAgent, BacktestData, BacktestDataKind, BacktestJobMode, BacktestRecipe,
    };

    fn agent(id: &str) -> BacktestAgent {
        BacktestAgent {
            id: id.to_string(),
            label: id.to_string(),
            notes: String::new(),
            hue: "#000".to_string(),
            role: None,
        }
    }

    fn recipe(agents: Vec<BacktestAgent>) -> BacktestRecipe {
        BacktestRecipe {
            mode: BacktestJobMode::Compare,
            agents,
            data: BacktestData {
                kind: BacktestDataKind::Dataset,
                dataset: Some("ds_x".to_string()),
                dataset_label: Some("X".to_string()),
                sources: vec![],
                scenarios: vec![],
                saved_as: None,
            },
            graders: vec![],
            environment: None,
            name: "r".to_string(),
            seed: None,
        }
    }

    fn opts(job_id: &str, cases: Vec<RecipeCase>) -> BuildPlanOptions {
        BuildPlanOptions {
            job_id: job_id.to_string(),
            tenant_id: "t".to_string(),
            n_concurrent: 2,
            sandbox_driver: SandboxDriver::Mock,
            retry_config: RetryConfig::default(),
            cases,
            tests_dir: "/tmp/tests".into(),
            sandbox_image: None,
            timeouts: TrialTimeouts::default(),
        }
    }

    #[test]
    fn enumerates_one_trial_per_case_per_agent() {
        let r = recipe(vec![agent("a"), agent("b")]);
        let cases = vec![
            RecipeCase {
                case_id: "c1".to_string(),
                case_cluster: None,
                instruction: "do".to_string(),
                expected_outcome: None,
                agent_trial_ids: HashMap::new(),
            },
            RecipeCase {
                case_id: "c2".to_string(),
                case_cluster: None,
                instruction: "do".to_string(),
                expected_outcome: None,
                agent_trial_ids: HashMap::new(),
            },
        ];
        let plan = build_plan(r, opts("j1", cases));
        assert_eq!(plan.trials.len(), 4);
        // First agent in the recipe is baseline.
        assert!(plan.trials[0].is_baseline);
        assert!(!plan.trials[1].is_baseline);
        // Trial id derived deterministically.
        assert_eq!(plan.trials[0].trial_id, "c1__a");
    }

    #[test]
    fn empty_agents_produces_empty_trials() {
        let r = recipe(vec![]);
        let cases = vec![RecipeCase {
            case_id: "c1".to_string(),
            case_cluster: None,
            instruction: "do".to_string(),
            expected_outcome: None,
            agent_trial_ids: HashMap::new(),
        }];
        let plan = build_plan(r, opts("j1", cases));
        assert!(plan.trials.is_empty());
    }

    #[test]
    fn preallocated_trial_ids_take_precedence() {
        let r = recipe(vec![agent("a")]);
        let mut prealloc = HashMap::new();
        prealloc.insert("a".to_string(), "trial_pre_alloced".to_string());
        let cases = vec![RecipeCase {
            case_id: "c1".to_string(),
            case_cluster: None,
            instruction: "do".to_string(),
            expected_outcome: None,
            agent_trial_ids: prealloc,
        }];
        let plan = build_plan(r, opts("j1", cases));
        assert_eq!(plan.trials[0].trial_id, "trial_pre_alloced");
    }
}
