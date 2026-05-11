//! Chronicle Backend Server binary.

use anyhow::Result;
use axum::{body::Body, http::Request};
use chronicle_api::{build_router, build_saas_router};
use chronicle_backend::{config, runtime, telemetry};
use sentry_tower::{NewSentryLayer, SentryHttpLayer};
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::cors::{Any, AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config::CliArgs {
        config_path: cli_config_path,
        print_config,
    } = config::CliArgs::parse()?;
    let config_path = config::LaunchConfig::config_path(cli_config_path);
    let launch_config = config::LaunchConfig::load(config_path.as_deref())?;

    if print_config {
        println!("{}", toml::to_string_pretty(&launch_config)?);
        return Ok(());
    }

    let _sentry_guard = telemetry::init_sentry(&launch_config)?;
    telemetry::init_tracing(&launch_config);
    telemetry::log_sentry_configuration(&launch_config);

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(run(launch_config, config_path))
}

async fn run(launch_config: config::LaunchConfig, config_path: Option<PathBuf>) -> Result<()> {
    chronicle_api::init_metrics_start_time();
    tracing::info!("Starting Chronicle backend");
    if let Some(path) = config_path.as_ref() {
        tracing::info!(path = %path.display(), "Loaded launch configuration file");
    } else {
        tracing::info!("Using env/default launch configuration");
    }
    let platform_runtime = runtime::build_platform_runtime(&launch_config).await?;
    let _sim_handle =
        runtime::maybe_start_simulation(&platform_runtime, launch_config.simulation.clone());

    let events_router = build_router(platform_runtime.events_state);
    let saas_router = build_saas_router(platform_runtime.saas_state);

    // CORS allow-list. The dashboard's `chronicle` data-provider mode
    // calls this server directly from the browser with a bearer token
    // and `credentials: "omit"`, so wide-open `Any` is safe — the
    // bearer is the only sensitive material on the wire and it's
    // explicitly allowed via `allow_headers(Any)`.
    //
    // Production deployments can pin origins by setting
    // `CHRONICLE_CORS_ALLOWED_ORIGINS` to a comma-separated list
    // (e.g. `https://app.chronicle.co,https://staging.chronicle.co`).
    // When unset we keep the permissive default so dev — including
    // localhost dashboard tabs hitting the server on a different port —
    // works out of the box.
    let cors_origins = std::env::var("CHRONICLE_CORS_ALLOWED_ORIGINS").ok();
    let cors = match cors_origins {
        Some(raw) if !raw.trim().is_empty() => {
            let origins: Vec<axum::http::HeaderValue> = raw
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .filter_map(|s| s.parse().ok())
                .collect();
            tracing::info!(
                count = origins.len(),
                "CORS allow-list pinned to explicit origins"
            );
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(origins))
                .allow_methods(Any)
                .allow_headers(Any)
        }
        _ => CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any),
    };
    let sentry_layer = ServiceBuilder::new()
        .layer(NewSentryLayer::<Request<Body>>::new_from_top())
        .layer(SentryHttpLayer::new().enable_transaction());

    let app = axum::Router::new()
        .merge(saas_router)
        .merge(events_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(sentry_layer);

    let addr: SocketAddr = format!(
        "{}:{}",
        launch_config.server.host, launch_config.server.port
    )
    .parse()?;
    let listener = TcpListener::bind(addr).await?;
    tracing::info!("Listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
