//! `chronicle config` — manage the on-disk config file.
//!
//! Commands:
//!   chronicle config show
//!   chronicle config set base-url <url>
//!   chronicle config set token <jwt>
//!   chronicle config clear-token
//!   chronicle config path

use crate::config::{fmt_for_display, Config};
use crate::error::{CliError, Result};
use clap::Subcommand;
use colored::Colorize;

#[derive(Debug, Subcommand)]
pub enum ConfigCmd {
    /// Print the active config (token redacted).
    Show,
    /// Update one of the config fields and persist it.
    Set {
        #[command(subcommand)]
        what: ConfigSetCmd,
    },
    /// Print the path to the config file.
    Path,
    /// Forget the auth token (leaves base_url alone).
    ClearToken,
}

#[derive(Debug, Subcommand)]
pub enum ConfigSetCmd {
    /// Backend base URL (e.g. https://api.chronicle.example.com).
    BaseUrl { url: String },
    /// Auth token — a WorkOS-issued Chronicle JWT.
    Token { token: String },
}

pub fn run(cmd: ConfigCmd) -> Result<()> {
    match cmd {
        ConfigCmd::Show => {
            let cfg = Config::load_with_env();
            println!("{}", fmt_for_display(&cfg));
        }
        ConfigCmd::Set { what } => {
            let mut cfg = Config::load_with_env();
            match what {
                ConfigSetCmd::BaseUrl { url } => {
                    cfg.base_url = url.clone();
                    cfg.save()?;
                    println!("{} base_url → {}", "✓".green().bold(), url);
                }
                ConfigSetCmd::Token { token } => {
                    if token.trim().is_empty() {
                        return Err(CliError::config("token cannot be empty"));
                    }
                    cfg.auth_token = Some(token);
                    cfg.save()?;
                    println!("{} auth_token saved", "✓".green().bold());
                }
            }
        }
        ConfigCmd::Path => {
            let path = Config::config_file()
                .ok_or_else(|| CliError::config("config dir unavailable on this OS"))?;
            println!("{}", path.display());
        }
        ConfigCmd::ClearToken => {
            let mut cfg = Config::load_with_env();
            cfg.auth_token = None;
            cfg.save()?;
            println!("{} auth_token cleared", "✓".green().bold());
        }
    }
    Ok(())
}
