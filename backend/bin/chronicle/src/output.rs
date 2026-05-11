//! Output formatting helpers: JSON for scripting, tables for humans.

use crate::error::Result;
use chronicle_domain::{
    BacktestRunStatus, BacktestRunSummary, BacktestTrialRecord, JobStatus, TrialStatus,
};
use colored::Colorize;
use comfy_table::{presets::UTF8_FULL_CONDENSED, Cell, ContentArrangement, Table};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Table,
    Json,
}

/// Render the value via the chosen format.
/// `table_render` is a closure that produces the human-readable view.
pub fn render<T: Serialize>(
    value: &T,
    format: Format,
    table_render: impl FnOnce(&T) -> String,
) -> Result<()> {
    match format {
        Format::Json => {
            println!("{}", serde_json::to_string_pretty(value)?);
        }
        Format::Table => {
            println!("{}", table_render(value));
        }
    }
    Ok(())
}

pub fn render_runs_table(runs: &[BacktestRunSummary]) -> String {
    let mut table = build_table();
    table.set_header(vec![
        Cell::new("ID"),
        Cell::new("NAME"),
        Cell::new("MODE"),
        Cell::new("STATUS"),
        Cell::new("DATASET"),
        Cell::new("AGENTS"),
        Cell::new("UPDATED"),
    ]);
    for run in runs {
        table.add_row(vec![
            Cell::new(short_id(&run.id)),
            Cell::new(&run.name),
            Cell::new(format!("{:?}", run.mode).to_lowercase()),
            Cell::new(status_pill(run.status)),
            Cell::new(&run.dataset_label),
            Cell::new(format!("{}", run.agent_ids.len())),
            Cell::new(humanize_when(run.updated_at)),
        ]);
    }
    table.to_string()
}

pub fn render_run_detail(
    run: &BacktestRunSummary,
    trials: &[BacktestTrialRecord],
    rewards: &HashMap<String, HashMap<String, f64>>,
) -> String {
    let mut out = String::new();
    out.push_str(&format!("{}\n", "Run".bold()));
    out.push_str(&format!("  id           : {}\n", run.id));
    out.push_str(&format!("  name         : {}\n", run.name));
    out.push_str(&format!(
        "  mode         : {}\n",
        format!("{:?}", run.mode).to_lowercase()
    ));
    out.push_str(&format!("  status       : {}\n", status_pill(run.status)));
    out.push_str(&format!("  dataset      : {}\n", run.dataset_label));
    if let Some(env) = &run.environment_label {
        out.push_str(&format!("  environment  : {env}\n"));
    }
    out.push_str(&format!("  agents       : {}\n", run.agent_ids.join(", ")));
    if let Some(total) = run.total_runs {
        out.push_str(&format!("  total trials : {total}\n"));
    }
    if let Some(verdict) = &run.verdict {
        out.push_str(&format!("  verdict      : {verdict}\n"));
    }
    out.push_str(&format!(
        "  updated      : {}\n\n",
        humanize_when(run.updated_at)
    ));

    out.push_str(&format!("{}\n", "Trials".bold()));
    if trials.is_empty() {
        out.push_str(&format!("  {}\n", "no trials yet".dimmed()));
    } else {
        let mut table = build_table();
        table.set_header(vec![
            Cell::new("TRIAL"),
            Cell::new("AGENT"),
            Cell::new("CASE"),
            Cell::new("STATUS"),
            Cell::new("DURATION"),
            Cell::new("REWARDS"),
        ]);
        for t in trials {
            table.add_row(vec![
                Cell::new(short_id(&t.id)),
                Cell::new(&t.agent_label),
                Cell::new(&t.case_id),
                Cell::new(trial_pill(t.status)),
                Cell::new(format_duration_ms(t.duration_ms)),
                Cell::new(format_rewards_inline(rewards.get(&t.id))),
            ]);
        }
        out.push_str(&table.to_string());
        out.push('\n');
    }

    // Per-agent metrics rollup. Aggregates rewards across every
    // (agent, reward-key) pair so multi-key reward.json runs render
    // a separate row per metric.
    if !rewards.is_empty() {
        let metrics = render_metrics_table(trials, rewards);
        if !metrics.is_empty() {
            out.push('\n');
            out.push_str(&format!("{}\n", "Metrics by agent".bold()));
            out.push_str(&metrics);
            out.push('\n');
        }
    }

    // Surface trial-level exceptions so failures don't disappear into
    // a "failed" pill. The orchestrator records {kind, message} per
    // failed trial; rendering them inline beats a separate `--logs`
    // command for the common case.
    let failures: Vec<&BacktestTrialRecord> = trials
        .iter()
        .filter(|t| t.exception.is_some())
        .collect();
    if !failures.is_empty() {
        out.push('\n');
        out.push_str(&format!("{}\n", "Failures".bold()));
        for t in failures {
            let e = t.exception.as_ref().unwrap();
            out.push_str(&format!(
                "  {} {} {}\n      {}\n",
                "✗".red().bold(),
                short_id(&t.id).red(),
                e.kind.red().bold(),
                truncate(&e.message, 280).dimmed(),
            ));
        }
    }

    out
}

fn format_rewards_inline(rewards: Option<&HashMap<String, f64>>) -> String {
    let Some(r) = rewards else {
        return "—".dimmed().to_string();
    };
    if r.is_empty() {
        return "—".dimmed().to_string();
    }
    // Single-value `reward` rendering: show just the number.
    if r.len() == 1 {
        if let Some(v) = r.get("reward") {
            return format!("{}", format_score(*v).cyan().bold());
        }
    }
    // Multi-key: comma-separated `key=value`, alphabetical for stability.
    let mut keys: Vec<&String> = r.keys().collect();
    keys.sort();
    let parts: Vec<String> = keys
        .iter()
        .map(|k| format!("{k}={}", format_score(r[*k])))
        .collect();
    parts.join(" ").to_string()
}

fn format_score(v: f64) -> String {
    if v.fract().abs() < 1e-9 {
        format!("{:.0}", v)
    } else if v.abs() < 1.0 {
        format!("{:.3}", v)
    } else {
        format!("{:.2}", v)
    }
}

fn render_metrics_table(
    trials: &[BacktestTrialRecord],
    rewards: &HashMap<String, HashMap<String, f64>>,
) -> String {
    // Group reward values by (agent_label, reward_key).
    let mut bucket: HashMap<(String, String), Vec<f64>> = HashMap::new();
    for t in trials {
        let Some(r) = rewards.get(&t.id) else { continue };
        for (k, v) in r {
            bucket
                .entry((t.agent_label.clone(), k.clone()))
                .or_default()
                .push(*v);
        }
    }
    if bucket.is_empty() {
        return String::new();
    }

    let mut keys: Vec<(String, String)> = bucket.keys().cloned().collect();
    keys.sort();

    let mut table = build_table();
    table.set_header(vec![
        Cell::new("AGENT"),
        Cell::new("METRIC"),
        Cell::new("MEAN"),
        Cell::new("MIN"),
        Cell::new("MAX"),
        Cell::new("N"),
    ]);
    for (agent, metric) in keys {
        let values = &bucket[&(agent.clone(), metric.clone())];
        let n = values.len();
        let mean = values.iter().copied().sum::<f64>() / n as f64;
        let min = values.iter().copied().fold(f64::INFINITY, f64::min);
        let max = values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        table.add_row(vec![
            Cell::new(agent),
            Cell::new(metric),
            Cell::new(format_score(mean)),
            Cell::new(format_score(min)),
            Cell::new(format_score(max)),
            Cell::new(n.to_string()),
        ]);
    }
    table.to_string()
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut clipped: String = s.chars().take(max).collect();
    clipped.push('…');
    clipped
}

pub fn render_create_response(run: &BacktestRunSummary) -> String {
    format!(
        "{} {}\n  job  : {}\n  name : {}\n  status: {}\n",
        "✓".green().bold(),
        "Job submitted".bold(),
        run.id,
        run.name,
        status_pill(run.status),
    )
}

fn build_table() -> Table {
    let mut t = Table::new();
    t.load_preset(UTF8_FULL_CONDENSED);
    t.set_content_arrangement(ContentArrangement::Dynamic);
    t
}

fn short_id(id: &str) -> String {
    if id.len() <= 8 {
        id.to_string()
    } else {
        format!("{}…{}", &id[..6], &id[id.len() - 3..])
    }
}

fn status_pill(s: BacktestRunStatus) -> String {
    let label = format!("{s:?}").to_lowercase();
    match s {
        BacktestRunStatus::Done => label.green().bold().to_string(),
        BacktestRunStatus::Running => label.cyan().bold().to_string(),
        BacktestRunStatus::Scheduled => label.yellow().to_string(),
        BacktestRunStatus::Draft => label.dimmed().to_string(),
        BacktestRunStatus::Paused => label.yellow().to_string(),
        BacktestRunStatus::Failed => label.red().bold().to_string(),
    }
}

fn trial_pill(s: TrialStatus) -> String {
    let label = format!("{s:?}").to_lowercase();
    match s {
        TrialStatus::Succeeded => label.green().to_string(),
        TrialStatus::Failed | TrialStatus::Cancelled => label.red().to_string(),
        TrialStatus::Running | TrialStatus::Verifying => label.cyan().to_string(),
        TrialStatus::Setup => label.yellow().to_string(),
        TrialStatus::Pending => label.dimmed().to_string(),
    }
}

fn format_duration_ms(d: Option<u32>) -> String {
    match d {
        None => "—".to_string(),
        Some(ms) if ms < 1000 => format!("{ms}ms"),
        Some(ms) if ms < 60_000 => format!("{:.1}s", (ms as f64) / 1000.0),
        Some(ms) => format!("{:.1}m", (ms as f64) / 60_000.0),
    }
}

fn humanize_when(t: chrono::DateTime<chrono::Utc>) -> String {
    let now = chrono::Utc::now();
    let delta = now.signed_duration_since(t);
    let secs = delta.num_seconds();
    if secs < 0 {
        return t.format("%Y-%m-%d %H:%M UTC").to_string();
    }
    if secs < 60 {
        return format!("{secs}s ago");
    }
    if secs < 3600 {
        return format!("{}m ago", secs / 60);
    }
    if secs < 86_400 {
        return format!("{}h ago", secs / 3600);
    }
    format!("{}d ago", secs / 86_400)
}

/// Map JobStatus → BacktestRunStatus (mirrors API mappers). Used by
/// the SSE consumer to colorize terminal-status events.
pub fn run_status_from_job(s: JobStatus) -> BacktestRunStatus {
    match s {
        JobStatus::Pending => BacktestRunStatus::Scheduled,
        JobStatus::Running => BacktestRunStatus::Running,
        JobStatus::Succeeded => BacktestRunStatus::Done,
        JobStatus::Failed | JobStatus::Cancelled => BacktestRunStatus::Failed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duration_format_buckets() {
        assert_eq!(format_duration_ms(None), "—");
        assert_eq!(format_duration_ms(Some(42)), "42ms");
        assert_eq!(format_duration_ms(Some(2_500)), "2.5s");
        assert_eq!(format_duration_ms(Some(120_000)), "2.0m");
    }

    #[test]
    fn short_id_keeps_short_strings() {
        assert_eq!(short_id("abc"), "abc");
        assert_eq!(short_id("12345678"), "12345678");
        assert!(short_id("01234567890abcdefg").contains("…"));
    }
}
