use std::time::Instant;

use axum::{extract::State, Json};
use serde::Serialize;

use crate::SaasAppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMetrics {
    pub pid: u32,
    pub uptime_secs: u64,
    pub memory_bytes: Option<u64>,
    pub num_threads: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceProbe {
    pub name: String,
    pub status: String,
    pub latency_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsResponse {
    pub process: ProcessMetrics,
    pub services: Vec<ServiceProbe>,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_sha: Option<String>,
}

fn get_process_memory() -> Option<u64> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("ps")
            .args(["-o", "rss=", "-p", &std::process::id().to_string()])
            .output()
            .ok()?;
        let rss_kb: u64 = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse()
            .ok()?;
        Some(rss_kb * 1024)
    }
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        let status = fs::read_to_string("/proc/self/status").ok()?;
        for line in status.lines() {
            if line.starts_with("VmRSS:") {
                let kb: u64 = line
                    .split_whitespace()
                    .nth(1)?
                    .parse()
                    .ok()?;
                return Some(kb * 1024);
            }
        }
        None
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

fn get_thread_count() -> Option<usize> {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        let status = fs::read_to_string("/proc/self/status").ok()?;
        for line in status.lines() {
            if line.starts_with("Threads:") {
                return line.split_whitespace().nth(1)?.parse().ok();
            }
        }
        None
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("ps")
            .args(["-M", "-p", &std::process::id().to_string()])
            .output()
            .ok()?;
        let lines = String::from_utf8_lossy(&output.stdout);
        let count = lines.lines().count().saturating_sub(1);
        if count > 0 { Some(count) } else { None }
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

async fn probe_service<F, E>(name: &str, fut: F) -> ServiceProbe
where
    F: std::future::Future<Output = Result<(), E>>,
    E: std::fmt::Display,
{
    let start = Instant::now();
    match fut.await {
        Ok(()) => ServiceProbe {
            name: name.to_string(),
            status: "up".to_string(),
            latency_ms: start.elapsed().as_millis() as u64,
            error: None,
        },
        Err(e) => ServiceProbe {
            name: name.to_string(),
            status: "down".to_string(),
            latency_ms: start.elapsed().as_millis() as u64,
            error: Some(e.to_string()),
        },
    }
}

static START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

pub fn init_start_time() {
    START_TIME.get_or_init(Instant::now);
}

pub async fn platform_metrics(State(state): State<SaasAppState>) -> Json<MetricsResponse> {
    let uptime = START_TIME
        .get()
        .map(|t| t.elapsed().as_secs())
        .unwrap_or(0);

    let process = ProcessMetrics {
        pid: std::process::id(),
        uptime_secs: uptime,
        memory_bytes: get_process_memory(),
        num_threads: get_thread_count(),
    };

    let store_probe = probe_service("eventStore", state.event_store.health_check());
    let stream_probe = probe_service("eventStream", state.event_stream.health_check());
    let email_probe = probe_service("email", state.email.health_check());

    let nango_probe = async {
        match state.nango.as_ref() {
            Some(client) => probe_service("nango", client.health_check()).await,
            None => ServiceProbe {
                name: "nango".to_string(),
                status: "unconfigured".to_string(),
                latency_ms: 0,
                error: None,
            },
        }
    };

    let (store, stream, email, nango) =
        tokio::join!(store_probe, stream_probe, email_probe, nango_probe);

    Json(MetricsResponse {
        process,
        services: vec![store, stream, email, nango],
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_sha: state.config.health.git_sha.clone(),
    })
}
