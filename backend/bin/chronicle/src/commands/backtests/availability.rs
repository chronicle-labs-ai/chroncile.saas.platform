//! `chronicle backtests {datasets,agents,envs} ls` — read-only views
//! into the recipe picker's catalog.
//!
//! All three commands hit the same `GET /api/platform/backtests/availability`
//! endpoint and project a different slice. Cheap; the response is small.

use crate::client::ChronicleClient;
use crate::error::Result;
use crate::output::Format;
use chronicle_domain::{
    AgentSummary, BacktestEnvironmentRef, BacktestsAvailability, Dataset,
};
use clap::Subcommand;
use colored::Colorize;
use comfy_table::{presets::UTF8_FULL_CONDENSED, Cell, ContentArrangement, Table};

#[derive(Debug, Subcommand)]
pub enum DatasetsCmd {
    /// List datasets the recipe picker can target.
    Ls,
}

#[derive(Debug, Subcommand)]
pub enum AgentsCmd {
    /// List agents available for runs in this tenant.
    Ls,
}

#[derive(Debug, Subcommand)]
pub enum EnvsCmd {
    /// List sandbox environments the recipe picker can target.
    Ls,
}

const PATH: &str = "/api/platform/backtests/availability";

pub async fn run_datasets(
    client: &ChronicleClient,
    cmd: DatasetsCmd,
    format: Format,
) -> Result<()> {
    match cmd {
        DatasetsCmd::Ls => {
            let avail: BacktestsAvailability = client.get_json(PATH).await?;
            render(&avail.datasets, format, render_datasets_table)
        }
    }
}

pub async fn run_agents(
    client: &ChronicleClient,
    cmd: AgentsCmd,
    format: Format,
) -> Result<()> {
    match cmd {
        AgentsCmd::Ls => {
            let avail: BacktestsAvailability = client.get_json(PATH).await?;
            render(&avail.agents, format, render_agents_table)
        }
    }
}

pub async fn run_envs(client: &ChronicleClient, cmd: EnvsCmd, format: Format) -> Result<()> {
    match cmd {
        EnvsCmd::Ls => {
            let avail: BacktestsAvailability = client.get_json(PATH).await?;
            render(&avail.environments, format, render_envs_table)
        }
    }
}

/* ── Render helpers ──────────────────────────────────────── */

fn render<T: serde::Serialize>(
    value: &T,
    format: Format,
    table: impl FnOnce(&T) -> String,
) -> Result<()> {
    match format {
        Format::Json => println!("{}", serde_json::to_string_pretty(value)?),
        Format::Table => println!("{}", table(value)),
    }
    Ok(())
}

fn render_datasets_table(datasets: &Vec<Dataset>) -> String {
    if datasets.is_empty() {
        return "no datasets available".dimmed().to_string();
    }
    let mut t = build_table();
    t.set_header(vec![
        Cell::new("ID"),
        Cell::new("NAME"),
        Cell::new("PURPOSE"),
        Cell::new("TRACES"),
        Cell::new("EVENTS"),
        Cell::new("UPDATED"),
    ]);
    for d in datasets {
        t.add_row(vec![
            Cell::new(&d.id),
            Cell::new(&d.name),
            Cell::new(
                d.purpose
                    .map(|p| format!("{p:?}").to_lowercase())
                    .unwrap_or_else(|| "—".to_string()),
            ),
            Cell::new(d.trace_count.to_string()),
            Cell::new(
                d.event_count
                    .map(|n| n.to_string())
                    .unwrap_or_else(|| "—".to_string()),
            ),
            Cell::new(
                d.updated_at
                    .map(|t| t.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_else(|| "—".to_string()),
            ),
        ]);
    }
    t.to_string()
}

fn render_agents_table(agents: &Vec<AgentSummary>) -> String {
    if agents.is_empty() {
        return "no agents available".dimmed().to_string();
    }
    let mut t = build_table();
    t.set_header(vec![
        Cell::new("NAME"),
        Cell::new("VERSION"),
        Cell::new("MODEL"),
        Cell::new("FRAMEWORK"),
        Cell::new("RUNS"),
        Cell::new("SUCCESS"),
    ]);
    for a in agents {
        t.add_row(vec![
            Cell::new(&a.name),
            Cell::new(&a.latest_version),
            Cell::new(&a.model_label),
            Cell::new(format!("{:?}", a.framework).to_lowercase()),
            Cell::new(a.total_runs.to_string()),
            Cell::new(format!("{:.1}%", a.success_rate * 100.0)),
        ]);
    }
    t.to_string()
}

fn render_envs_table(envs: &Vec<BacktestEnvironmentRef>) -> String {
    if envs.is_empty() {
        return "no environments available".dimmed().to_string();
    }
    let mut t = build_table();
    t.set_header(vec![
        Cell::new("ID"),
        Cell::new("LABEL"),
        Cell::new("STATUS"),
        Cell::new("EPHEMERAL"),
        Cell::new("SNAPSHOT"),
    ]);
    for e in envs {
        t.add_row(vec![
            Cell::new(&e.id),
            Cell::new(&e.label),
            Cell::new(e.status.as_deref().unwrap_or("—")),
            Cell::new(
                e.ephemeral
                    .map(|b| if b { "yes" } else { "no" })
                    .unwrap_or("—"),
            ),
            Cell::new(e.snapshot_label.as_deref().unwrap_or("—")),
        ]);
    }
    t.to_string()
}

fn build_table() -> Table {
    let mut t = Table::new();
    t.load_preset(UTF8_FULL_CONDENSED);
    t.set_content_arrangement(ContentArrangement::Dynamic);
    t
}
