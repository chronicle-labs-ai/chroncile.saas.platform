//! `chronicle health` — confirm the backend is reachable.

use crate::client::ChronicleClient;
use crate::error::{CliError, Result};
use crate::output::Format;
use colored::Colorize;
use serde::Deserialize;
use std::time::Instant;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    git_sha: Option<String>,
    #[serde(default)]
    environment: Option<String>,
}

pub async fn run(client: &ChronicleClient, format: Format) -> Result<()> {
    let started = Instant::now();
    let resp: HealthResponse = client.get_json("/health").await.map_err(|e| match e {
        CliError::NotFound(_) => CliError::Network(format!(
            "{} returned 404 — is this a Chronicle backend?",
            client.config().base_url
        )),
        other => other,
    })?;
    let elapsed = started.elapsed();

    // Prefer the human-meaningful version label; fall back to the
    // git sha. Both come back from the backend (`version` is the
    // crate version, `gitSha` is the build sha).
    let version_label = resp
        .version
        .clone()
        .or_else(|| resp.git_sha.clone());

    if matches!(format, Format::Json) {
        println!("{}", serde_json::to_string_pretty(&serde_json::json!({
            "ok": true,
            "elapsedMs": elapsed.as_millis(),
            "baseUrl": client.config().base_url,
            "status": resp.status,
            "version": resp.version,
            "gitSha": resp.git_sha,
            "environment": resp.environment,
        }))?);
        return Ok(());
    }

    println!(
        "{} {}",
        "✓".green().bold(),
        "Backend is reachable".bold()
    );
    println!("  url        : {}", client.config().base_url);
    if let Some(s) = &resp.status {
        println!("  status     : {s}");
    }
    if let Some(v) = &version_label {
        println!("  version    : {v}");
    }
    if let Some(env) = &resp.environment {
        println!("  environment: {env}");
    }
    println!("  latency    : {}ms", elapsed.as_millis());
    Ok(())
}
