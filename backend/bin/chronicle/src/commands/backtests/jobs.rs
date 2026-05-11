//! `chronicle backtests jobs ...` — list, show, run, follow, cancel.

use crate::client::ChronicleClient;
use crate::error::{CliError, Result};
use crate::output::{
    render, render_create_response, render_run_detail, render_runs_table, run_status_from_job,
    Format,
};
use chronicle_domain::{
    BacktestJobMode, BacktestRecipe, BacktestRunStatus, BacktestRunSummary, BacktestTrialRecord,
    JobStatus, RetryConfig, SandboxDriver, TrialEvent, TrialPhase, TrialStatus,
};
use clap::{Subcommand, ValueEnum};
use colored::Colorize;
use eventsource_stream::Eventsource;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Subcommand)]
pub enum JobsCmd {
    /// List recent runs in this tenant.
    Ls {
        /// Filter by status.
        #[arg(long, value_enum)]
        status: Option<RunStatusFilter>,
        /// Filter by job mode.
        #[arg(long, value_enum)]
        mode: Option<JobModeArg>,
        #[arg(long, default_value_t = 50)]
        limit: usize,
        #[arg(long, default_value_t = 0)]
        offset: usize,
    },
    /// Show a single run + its trials.
    Show {
        job_id: String,
    },
    /// Submit a job from a `recipe.toml` file.
    Run {
        /// Path to a recipe TOML file. Generate a starter with
        /// `chronicle backtests recipes init`.
        recipe: PathBuf,
        /// Override n_concurrent from the recipe.
        #[arg(long)]
        n_concurrent: Option<u32>,
        /// Override the sandbox driver.
        #[arg(long, value_enum)]
        sandbox_driver: Option<SandboxDriverArg>,
        /// After submit, attach to the SSE stream.
        #[arg(long, default_value_t = false)]
        follow: bool,
    },
    /// Stream live progress for a running job.
    Follow {
        job_id: String,
    },
    /// Cancel a running job.
    Cancel {
        job_id: String,
    },
}

/// CLI-side mirror of `JobStatus`. Kept local so `chronicle_domain`
/// stays free of clap dependencies.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum RunStatusFilter {
    Pending,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

impl RunStatusFilter {
    fn as_status(self) -> JobStatus {
        match self {
            Self::Pending => JobStatus::Pending,
            Self::Running => JobStatus::Running,
            Self::Succeeded => JobStatus::Succeeded,
            Self::Failed => JobStatus::Failed,
            Self::Cancelled => JobStatus::Cancelled,
        }
    }
}

/// CLI-side mirror of `BacktestJobMode`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum JobModeArg {
    Replay,
    Compare,
    Regression,
    Suite,
}

impl JobModeArg {
    fn as_mode(self) -> BacktestJobMode {
        match self {
            Self::Replay => BacktestJobMode::Replay,
            Self::Compare => BacktestJobMode::Compare,
            Self::Regression => BacktestJobMode::Regression,
            Self::Suite => BacktestJobMode::Suite,
        }
    }
}

/// CLI-side mirror of `SandboxDriver`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum SandboxDriverArg {
    Daytona,
    Docker,
    Mock,
}

impl SandboxDriverArg {
    fn as_driver(self) -> SandboxDriver {
        match self {
            Self::Daytona => SandboxDriver::Daytona,
            Self::Docker => SandboxDriver::Docker,
            Self::Mock => SandboxDriver::Mock,
        }
    }
}

/* ── Recipe TOML shape ────────────────────────────────────── */

/// On-disk recipe file. Mirrors `CreateJobRequest` on the server but
/// carries the recipe + cases inline. Fields are flat where the server
/// shape allows so users don't need to write `[recipe]` everywhere.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
struct RecipeFile {
    name: String,
    #[serde(default)]
    n_concurrent: Option<u32>,
    #[serde(default)]
    sandbox_driver: Option<SandboxDriver>,
    #[serde(default)]
    sandbox_image: Option<String>,
    tests_dir: String,
    #[serde(default)]
    retry_config: Option<RetryConfig>,
    recipe: BacktestRecipe,
    /// Optional. When omitted (or empty) the backend auto-derives
    /// cases from the dataset snapshot — one case per trace — as
    /// long as `recipe.data.kind = "dataset"` and the referenced
    /// dataset has a snapshot. Phase 7 ships this for `ds_demo`;
    /// other datasets need explicit cases for now.
    #[serde(default)]
    cases: Vec<RecipeFileCase>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
struct RecipeFileCase {
    case_id: String,
    #[serde(default)]
    case_cluster: Option<String>,
    instruction: String,
    /// Optional gold reference for graders. Forwarded verbatim to
    /// `GraderContext.expected_outcome` and read by rubric / trace
    /// graders.
    #[serde(default)]
    expected_outcome: Option<String>,
}

/* ── Wire shapes (mirror the server's request/response) ──── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobRequest<'a> {
    name: &'a str,
    recipe: &'a BacktestRecipe,
    cases: Vec<CreateJobCase<'a>>,
    n_concurrent: u32,
    sandbox_driver: SandboxDriver,
    #[serde(skip_serializing_if = "Option::is_none")]
    retry_config: Option<&'a RetryConfig>,
    tests_dir: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    sandbox_image: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobCase<'a> {
    case_id: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    case_cluster: Option<&'a str>,
    instruction: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    expected_outcome: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobResponse {
    job_id: String,
    run: BacktestRunSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListJobsResponse {
    runs: Vec<BacktestRunSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobDetailResponse {
    run: BacktestRunSummary,
    trials: Vec<BacktestTrialRecord>,
    /// Per-trial rewards. Outer key = trial id; inner map = reward
    /// key → score. Trials with no rewards (e.g. failed before the
    /// verifier ran) are absent.
    #[serde(default)]
    rewards: HashMap<String, HashMap<String, f64>>,
}

/* ── Dispatch ────────────────────────────────────────────── */

pub async fn run(client: &ChronicleClient, cmd: JobsCmd, format: Format) -> Result<()> {
    match cmd {
        JobsCmd::Ls {
            status,
            mode,
            limit,
            offset,
        } => list(client, status, mode.map(JobModeArg::as_mode), limit, offset, format).await,
        JobsCmd::Show { job_id } => show(client, &job_id, format).await,
        JobsCmd::Run {
            recipe,
            n_concurrent,
            sandbox_driver,
            follow,
        } => {
            submit(
                client,
                recipe,
                n_concurrent,
                sandbox_driver.map(SandboxDriverArg::as_driver),
                follow,
                format,
            )
            .await
        }
        JobsCmd::Follow { job_id } => follow(client, &job_id).await,
        JobsCmd::Cancel { job_id } => cancel(client, &job_id, format).await,
    }
}

async fn list(
    client: &ChronicleClient,
    status: Option<RunStatusFilter>,
    mode: Option<BacktestJobMode>,
    limit: usize,
    offset: usize,
    format: Format,
) -> Result<()> {
    let mut path = format!("/api/platform/backtests/jobs?limit={limit}&offset={offset}");
    if let Some(s) = status {
        path.push_str(&format!(
            "&status={}",
            serde_plain_status(s.as_status())
        ));
    }
    if let Some(m) = mode {
        path.push_str(&format!(
            "&mode={}",
            serde_json::to_string(&m).unwrap_or_default().trim_matches('"')
        ));
    }
    let resp: ListJobsResponse = client.get_json(&path).await?;
    render(&resp.runs, format, |runs| {
        if runs.is_empty() {
            "no runs found".dimmed().to_string()
        } else {
            render_runs_table(runs)
        }
    })
}

async fn show(client: &ChronicleClient, job_id: &str, format: Format) -> Result<()> {
    let path = format!("/api/platform/backtests/jobs/{job_id}");
    let resp: JobDetailResponse = client.get_json(&path).await?;
    render(&resp, format, |r| render_run_detail(&r.run, &r.trials, &r.rewards))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CancelJobResponse {
    job_id: String,
    aborted: bool,
    previous_status: JobStatus,
}

async fn cancel(client: &ChronicleClient, job_id: &str, format: Format) -> Result<()> {
    let path = format!("/api/platform/backtests/jobs/{job_id}/cancel");
    let resp: CancelJobResponse = client
        .post_json::<serde_json::Value, _>(&path, &serde_json::json!({}))
        .await?;
    if matches!(format, Format::Json) {
        println!("{}", serde_json::to_string_pretty(&resp)?);
        return Ok(());
    }
    if resp.aborted {
        println!("{} job {} cancelled", "✓".green().bold(), job_id);
    } else {
        println!(
            "{} job {} was already {} — nothing to cancel",
            "·".dimmed(),
            job_id,
            format!("{:?}", resp.previous_status).to_lowercase()
        );
    }
    Ok(())
}

async fn submit(
    client: &ChronicleClient,
    recipe_path: PathBuf,
    n_concurrent_override: Option<u32>,
    sandbox_driver_override: Option<SandboxDriver>,
    do_follow: bool,
    format: Format,
) -> Result<()> {
    let raw = std::fs::read_to_string(&recipe_path)
        .map_err(|_| CliError::RecipeNotFound(recipe_path.clone()))?;
    let parsed: RecipeFile = toml::from_str(&raw).map_err(|e| CliError::RecipeParse {
        path: recipe_path.clone(),
        message: e.to_string(),
    })?;

    // Empty `cases` is permitted when `recipe.data.kind = "dataset"`
    // — the backend will auto-derive one case per trace from the
    // dataset snapshot. Reject only when neither path is available.
    if parsed.cases.is_empty()
        && !matches!(
            parsed.recipe.data.kind,
            chronicle_domain::BacktestDataKind::Dataset
        )
    {
        return Err(CliError::RecipeParse {
            path: recipe_path.clone(),
            message: "cases array is empty AND recipe.data.kind is not \"dataset\" — \
                      either supply [[cases]] explicitly, or point recipe.data at a \
                      dataset (kind = \"dataset\", dataset = \"ds_xxx\") so cases can \
                      be derived from its trace snapshot."
                .to_string(),
        });
    }
    if parsed.recipe.agents.is_empty() {
        return Err(CliError::RecipeParse {
            path: recipe_path.clone(),
            message: "recipe.agents must be non-empty".to_string(),
        });
    }

    // Pre-flight: catch the most common footguns before we spin up
    // sandboxes that will fail at the verifier-upload step.
    if parsed.tests_dir.trim().is_empty() {
        return Err(CliError::RecipeParse {
            path: recipe_path.clone(),
            message: "tests-dir is empty — set it to an absolute path \
                      with a test.sh, or scaffold one via `chronicle recipes init`"
                .to_string(),
        });
    }
    if parsed.tests_dir.contains("{{") || parsed.tests_dir.contains("}}") {
        return Err(CliError::RecipeParse {
            path: recipe_path.clone(),
            message: format!(
                "tests-dir contains an unresolved placeholder ({}). \
                 Did you run the template directly? Use `chronicle recipes init` \
                 to scaffold a working recipe + tests dir.",
                parsed.tests_dir
            ),
        });
    }
    let tests_dir_path = std::path::Path::new(&parsed.tests_dir);
    if !tests_dir_path.is_dir() {
        return Err(CliError::RecipeParse {
            path: recipe_path.clone(),
            message: format!(
                "tests-dir does not exist on this host: {}. \
                 The orchestrator reads this directory to upload into the sandbox; \
                 it must point at a real local directory containing your test.sh.",
                parsed.tests_dir
            ),
        });
    }
    if !tests_dir_path.join("test.sh").is_file() {
        return Err(CliError::RecipeParse {
            path: recipe_path.clone(),
            message: format!(
                "tests-dir {} exists but contains no test.sh. \
                 The verifier expects to run `bash test.sh` inside the sandbox.",
                parsed.tests_dir
            ),
        });
    }

    let n_concurrent = n_concurrent_override
        .or(parsed.n_concurrent)
        .unwrap_or(4)
        .max(1);
    let sandbox_driver = sandbox_driver_override
        .or(parsed.sandbox_driver)
        .unwrap_or(SandboxDriver::Daytona);

    let cases: Vec<CreateJobCase<'_>> = parsed
        .cases
        .iter()
        .map(|c| CreateJobCase {
            case_id: &c.case_id,
            case_cluster: c.case_cluster.as_deref(),
            instruction: &c.instruction,
            expected_outcome: c.expected_outcome.as_deref(),
        })
        .collect();

    let req = CreateJobRequest {
        name: &parsed.name,
        recipe: &parsed.recipe,
        cases,
        n_concurrent,
        sandbox_driver,
        retry_config: parsed.retry_config.as_ref(),
        tests_dir: &parsed.tests_dir,
        sandbox_image: parsed.sandbox_image.as_deref(),
    };

    let resp: CreateJobResponse = client.post_json("/api/platform/backtests/jobs", &req).await?;

    if matches!(format, Format::Json) && !do_follow {
        println!("{}", serde_json::to_string_pretty(&resp)?);
        return Ok(());
    }
    println!("{}", render_create_response(&resp.run));

    if do_follow {
        // Brief blank line so the live stream is visually separated.
        println!();
        follow(client, &resp.job_id).await?;
    }
    Ok(())
}

async fn follow(client: &ChronicleClient, job_id: &str) -> Result<()> {
    let path = format!("/api/platform/backtests/jobs/{job_id}/stream");
    let response = client.sse_get(&path).await?;
    let mut events = response.bytes_stream().eventsource();

    println!(
        "{} streaming events for job {}…  (Ctrl-C to detach)",
        "→".cyan().bold(),
        job_id
    );

    let mut counts: HashMap<&'static str, u32> = HashMap::new();

    while let Some(event) = events.next().await {
        let event = match event {
            Ok(e) => e,
            Err(e) => {
                eprintln!("{} sse stream errored: {e}", "✗".red().bold());
                return Err(CliError::Network(e.to_string()));
            }
        };

        // The connection-ready / stream-done events are server-emitted
        // labels (see api/.../sse.rs). Treat them as ambient.
        match event.event.as_str() {
            "ready" => {
                println!("{} stream ready", "·".dimmed());
                continue;
            }
            "done" => {
                println!("{} stream closed", "·".dimmed());
                return Ok(());
            }
            _ => {}
        }

        let parsed: TrialEvent = match serde_json::from_str(&event.data) {
            Ok(p) => p,
            Err(e) => {
                eprintln!(
                    "{} could not parse event: {e}\nraw: {}",
                    "!".yellow().bold(),
                    event.data
                );
                continue;
            }
        };

        print_event(&parsed, &mut counts);

        // Auto-disconnect once the job's terminal event lands so
        // `chronicle jobs run --follow` exits cleanly.
        if matches!(parsed, TrialEvent::JobFinished { .. }) {
            return Ok(());
        }
    }
    Err(CliError::StreamClosed)
}

fn print_event(event: &TrialEvent, counts: &mut HashMap<&'static str, u32>) {
    match event {
        TrialEvent::JobStarted { job_id } => {
            println!(
                "{} {} {}",
                "•".cyan(),
                "job started".bold(),
                job_id.dimmed()
            );
        }
        TrialEvent::TrialPhaseChanged {
            trial_id, phase, ..
        } => {
            *counts.entry(phase_key(*phase)).or_insert(0) += 1;
            println!(
                "  {} {} {}",
                phase_glyph(*phase),
                phase_label(*phase),
                trial_id.dimmed()
            );
        }
        TrialEvent::TrialRewardsRecorded {
            trial_id, rewards, ..
        } => {
            let formatted: Vec<String> = rewards
                .iter()
                .map(|(k, v)| format!("{k}={v}"))
                .collect();
            println!(
                "  {} {} [{}] {}",
                "Σ".magenta().bold(),
                "rewards".bold(),
                formatted.join(", "),
                trial_id.dimmed()
            );
        }
        TrialEvent::TrialFinished {
            trial_id,
            status,
            exception,
            ..
        } => {
            let label = match status {
                TrialStatus::Succeeded => "trial ok".green().to_string(),
                _ => "trial failed".red().to_string(),
            };
            print!(
                "  {} {} {}",
                trial_finish_glyph(*status),
                label,
                trial_id.dimmed()
            );
            if let Some(e) = exception {
                print!("  {} {}", e.kind.red().bold(), e.message.dimmed());
            }
            println!();
        }
        TrialEvent::JobFinished { job_id, status, .. } => {
            let line = match run_status_from_job(*status) {
                BacktestRunStatus::Done => "✓ job done".green().bold(),
                BacktestRunStatus::Failed => "✗ job failed".red().bold(),
                _ => "• job finished".bold(),
            };
            println!();
            println!("{}  {}", line, job_id.dimmed());
        }
    }
}

fn phase_glyph(p: TrialPhase) -> colored::ColoredString {
    match p {
        TrialPhase::Queued => "·".dimmed(),
        TrialPhase::EnvironmentStart | TrialPhase::EnvironmentReady => "▲".yellow(),
        TrialPhase::AgentSetup => "·".cyan(),
        TrialPhase::AgentRunning => "▸".cyan(),
        TrialPhase::VerifierRunning => "▸".magenta(),
        TrialPhase::ArtifactCollection => "·".dimmed(),
        TrialPhase::Cleanup => "·".dimmed(),
        TrialPhase::Done => "·".dimmed(),
    }
}

fn phase_label(p: TrialPhase) -> &'static str {
    match p {
        TrialPhase::Queued => "queued",
        TrialPhase::EnvironmentStart => "env start",
        TrialPhase::EnvironmentReady => "env ready",
        TrialPhase::AgentSetup => "agent setup",
        TrialPhase::AgentRunning => "agent run",
        TrialPhase::VerifierRunning => "verifying",
        TrialPhase::ArtifactCollection => "collecting",
        TrialPhase::Cleanup => "cleanup",
        TrialPhase::Done => "done",
    }
}

fn phase_key(p: TrialPhase) -> &'static str {
    phase_label(p)
}

fn trial_finish_glyph(s: TrialStatus) -> colored::ColoredString {
    match s {
        TrialStatus::Succeeded => "✓".green().bold(),
        TrialStatus::Failed | TrialStatus::Cancelled => "✗".red().bold(),
        _ => "·".dimmed(),
    }
}

fn serde_plain_status(s: JobStatus) -> &'static str {
    match s {
        JobStatus::Pending => "pending",
        JobStatus::Running => "running",
        JobStatus::Succeeded => "succeeded",
        JobStatus::Failed => "failed",
        JobStatus::Cancelled => "cancelled",
    }
}
