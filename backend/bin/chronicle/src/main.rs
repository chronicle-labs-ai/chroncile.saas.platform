//! Chronicle CLI entry point.
//!
//! This binary is the only product-shipped surface for talking to a
//! Chronicle backend without going through the dashboard. It speaks
//! HTTP exclusively — no direct DB access — so anything you can do
//! here, an admin user with a token can also do via curl.
//!
//! Quick start:
//!
//!   chronicle config set base-url https://api.chronicle.example.com
//!   chronicle config set token <jwt>
//!   chronicle health
//!   chronicle recipes init
//!   chronicle jobs run recipe.toml --follow

mod client;
mod commands;
mod config;
mod error;
mod output;

use clap::{Parser, Subcommand};
use colored::Colorize;

use crate::client::ChronicleClient;
use crate::config::Config;
use crate::error::{CliError, Result};
use crate::output::Format;

/// Chronicle CLI — manage backtests and inspect the platform from the
/// terminal.
#[derive(Debug, Parser)]
#[command(name = "chronicle")]
#[command(version, about, long_about = None)]
struct Cli {
    /// Backend base URL (overrides config + CHRONICLE_BASE_URL).
    #[arg(long, global = true)]
    base_url: Option<String>,

    /// Bearer token for the protected API (overrides config + CHRONICLE_AUTH_TOKEN).
    #[arg(long, global = true)]
    token: Option<String>,

    /// Output format. `table` (default, human-readable) or `json`
    /// (script-friendly).
    #[arg(long, value_enum, global = true, default_value_t = OutputFormat::Table)]
    format: OutputFormat,

    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
enum OutputFormat {
    Table,
    Json,
}

impl OutputFormat {
    fn into_format(self) -> Format {
        match self {
            Self::Table => Format::Table,
            Self::Json => Format::Json,
        }
    }
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Smoke-test the backend connection.
    Health,

    /// Inspect or update the persistent config (~/.config/chronicle/config.toml).
    Config {
        #[command(subcommand)]
        cmd: commands::config_cmd::ConfigCmd,
    },

    /// Manage backtest jobs (submit, list, follow, cancel).
    Jobs {
        #[command(subcommand)]
        cmd: commands::backtests::jobs::JobsCmd,
    },

    /// Manage recipes (the input definitions for jobs).
    Recipes {
        #[command(subcommand)]
        cmd: commands::backtests::recipes::RecipesCmd,
    },

    /// List datasets available for runs.
    Datasets {
        #[command(subcommand)]
        cmd: commands::backtests::availability::DatasetsCmd,
    },

    /// List agents available for runs.
    Agents {
        #[command(subcommand)]
        cmd: commands::backtests::availability::AgentsCmd,
    },

    /// List sandbox environments available for runs.
    Envs {
        #[command(subcommand)]
        cmd: commands::backtests::availability::EnvsCmd,
    },
}

#[tokio::main]
async fn main() {
    // colored should respect NO_COLOR / piped output by default.
    colored::control::set_override(should_color());

    let cli = Cli::parse();
    let format = cli.format.into_format();

    if let Err(e) = run(cli).await {
        match format {
            Format::Json => {
                let payload = serde_json::json!({
                    "ok": false,
                    "error": e.to_string(),
                });
                eprintln!("{}", serde_json::to_string_pretty(&payload).unwrap_or_default());
            }
            Format::Table => {
                eprintln!("{} {}", "✗".red().bold(), e.to_string().bold());
                if let Some(hint) = hint_for(&e) {
                    eprintln!("  {}", hint.dimmed());
                }
            }
        }
        std::process::exit(1);
    }
}

async fn run(cli: Cli) -> Result<()> {
    let mut cfg = Config::load_with_env();
    cfg.apply_overrides(cli.base_url.clone(), cli.token.clone());
    let format = cli.format.into_format();

    match cli.command {
        Command::Health => {
            let client = ChronicleClient::new(cfg)?;
            commands::health::run(&client, format).await
        }
        Command::Config { cmd } => commands::config_cmd::run(cmd),
        Command::Jobs { cmd } => {
            let client = ChronicleClient::new(cfg)?;
            commands::backtests::jobs::run(&client, cmd, format).await
        }
        Command::Recipes { cmd } => commands::backtests::recipes::run(cmd),
        Command::Datasets { cmd } => {
            let client = ChronicleClient::new(cfg)?;
            commands::backtests::availability::run_datasets(&client, cmd, format).await
        }
        Command::Agents { cmd } => {
            let client = ChronicleClient::new(cfg)?;
            commands::backtests::availability::run_agents(&client, cmd, format).await
        }
        Command::Envs { cmd } => {
            let client = ChronicleClient::new(cfg)?;
            commands::backtests::availability::run_envs(&client, cmd, format).await
        }
    }
}

/// Disable color when stdout isn't a TTY (piped output) or when
/// NO_COLOR is set per <https://no-color.org>.
fn should_color() -> bool {
    use std::io::IsTerminal;
    if std::env::var_os("NO_COLOR").is_some() {
        return false;
    }
    std::io::stdout().is_terminal()
}

/// Per-error remediation hints for the table-format error path.
fn hint_for(err: &CliError) -> Option<&'static str> {
    match err {
        CliError::Unauthenticated => Some(
            "set the token via `chronicle config set token <jwt>` or CHRONICLE_AUTH_TOKEN",
        ),
        CliError::Network(_) => Some(
            "is the backend running? try `chronicle health` against your local config",
        ),
        CliError::RecipeNotFound(_) => Some(
            "scaffold one with `chronicle backtests recipes init`",
        ),
        CliError::Forbidden(_) => Some(
            "your token is valid but the tenant doesn't grant access to this resource",
        ),
        _ => None,
    }
}
