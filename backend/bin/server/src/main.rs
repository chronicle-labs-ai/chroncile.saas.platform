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
use tower_http::cors::{Any, CorsLayer};
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

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
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
