//! Chronicle Backend Server
//!
//! Main entry point that wires together all components and starts the HTTP server.
//! Serves both the events-manager API and the SaaS platform API.

use anyhow::Result;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use chronicle_api::{
    build_router, build_saas_router, AppState, EventsRuntimeConfig, HealthMetadata, SaasAppState,
    SaasRuntimeConfig,
};
use chronicle_infra::{StoreBackend, StreamBackend};

mod config;
mod simulation;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config::CliArgs {
        config_path: cli_config_path,
        print_config,
    } = config::CliArgs::parse()?;
    let config_path = config::LaunchConfig::config_path(cli_config_path);
    let launch_config = config::LaunchConfig::load(config_path.as_deref())?;

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            launch_config.server.rust_log.clone(),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    if print_config {
        println!("{}", toml::to_string_pretty(&launch_config)?);
        return Ok(());
    }

    tracing::info!("Starting Chronicle backend");
    if let Some(path) = config_path.as_ref() {
        tracing::info!(path = %path.display(), "Loaded launch configuration file");
    } else {
        tracing::info!("Using env/default launch configuration");
    }
    tracing::info!(
        events_backend = ?launch_config.storage.events.backend,
        saas_backend = ?launch_config.storage.saas.backend,
        "Launch configuration resolved"
    );

    maybe_run_saas_migrations(&launch_config).await?;

    let stream_backend = Arc::new(StreamBackend::Memory(
        chronicle_infra::memory::MemoryStream::new(
            launch_config.stream.channel_capacity,
            launch_config.stream.buffer_capacity,
        ),
    ));

    let store_backend = match launch_config.storage.events.backend {
        #[cfg(feature = "postgres")]
        config::BackendKind::Postgres => {
            let db_url = require_database_url("storage.events", &launch_config.storage.events)?;
            tracing::info!("Using Postgres event store");

            let postgres_store = chronicle_infra::postgres::PostgresStore::new(db_url)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to connect to Postgres event store: {e}"))?;

            if launch_config.storage.events.run_migrations {
                tracing::info!("Running Chronicle-native event migrations...");
                postgres_store
                    .migrate()
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to run event migrations: {e}"))?;
            } else {
                tracing::info!("Chronicle-native event migrations disabled");
            }

            Arc::new(StoreBackend::Postgres(postgres_store))
        }
        #[cfg(not(feature = "postgres"))]
        config::BackendKind::Postgres => {
            anyhow::bail!("storage.events.backend=postgres requires the `postgres` feature");
        }
        config::BackendKind::Memory => {
            tracing::info!("Using in-memory event store");
            Arc::new(StoreBackend::Memory(
                chronicle_infra::memory::MemoryStore::new(),
            ))
        }
    };

    let saas_runtime = SaasRuntimeConfig {
        app_url: launch_config.urls.app_url.clone(),
        service_secret: launch_config.security.service_secret.clone(),
        stripe_webhook_secret: launch_config.webhooks.stripe_secret.clone(),
    };

    let saas_state = match launch_config.storage.saas.backend {
        config::BackendKind::Postgres => {
            let db_url = require_database_url("storage.saas", &launch_config.storage.saas)?;
            tracing::info!("Using Postgres SaaS repositories");
            let pool = sqlx::PgPool::connect(db_url)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to create SaaS connection pool: {e}"))?;
            build_saas_state_postgres(
                pool,
                Arc::clone(&store_backend),
                Arc::clone(&stream_backend),
                &launch_config,
                saas_runtime.clone(),
            )
        }
        config::BackendKind::Memory => {
            tracing::info!("Using in-memory SaaS repositories");
            build_saas_state_memory(
                Arc::clone(&store_backend),
                Arc::clone(&stream_backend),
                &launch_config,
                saas_runtime,
            )
        }
    };

    let events_state = AppState::new_from_arcs_with_config(
        Arc::clone(&store_backend),
        Arc::clone(&stream_backend),
        EventsRuntimeConfig {
            default_tenant_id: launch_config.events.default_tenant_id.clone(),
            health: HealthMetadata {
                environment: launch_config.health.environment.clone(),
                git_sha: launch_config.health.git_sha.clone(),
                git_tag: launch_config.health.git_tag.clone(),
            },
            webhook_secrets: launch_config.webhooks.source_secrets.clone(),
        },
    );

    let sim_config = launch_config.simulation.clone();
    if sim_config.enabled {
        tracing::info!(
            mode = ?sim_config.mode,
            rate = sim_config.events_per_second,
            scenarios = ?sim_config.scenarios,
            sources = ?sim_config.sources,
            "Starting simulation mode"
        );
        let _sim_handle = simulation::start_simulation(
            Arc::clone(&events_state.store),
            Arc::clone(&events_state.event_stream),
            sim_config,
        );
    }

    let events_router = build_router(events_state);
    let saas_router = build_saas_router(saas_state);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = axum::Router::new()
        .merge(saas_router)
        .merge(events_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

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

fn build_pipedream_client(
    launch_config: &config::LaunchConfig,
) -> Option<Arc<chronicle_pipedream_connect::PipedreamClient>> {
    let client_id = launch_config.integrations.pipedream.client_id.clone()?;
    let client_secret = launch_config.integrations.pipedream.client_secret.clone()?;
    let project_id = launch_config.integrations.pipedream.project_id.clone()?;

    if client_id.is_empty() || client_secret.is_empty() {
        return None;
    }

    tracing::info!(
        project_id = %project_id,
        environment = ?launch_config.integrations.pipedream.environment,
        "Pipedream integration configured"
    );
    Some(Arc::new(chronicle_pipedream_connect::PipedreamClient::new(
        client_id,
        client_secret,
        project_id,
        launch_config.integrations.pipedream.environment.to_sdk(),
    )))
}

fn build_email_service(
    launch_config: &config::LaunchConfig,
) -> Arc<dyn chronicle_interfaces::EmailService> {
    Arc::from(
        chronicle_integrations::resend::build_email_service_with_options(
            launch_config.integrations.resend.api_key.clone(),
            launch_config.integrations.resend.from_address.clone(),
            launch_config.integrations.resend.templates.clone(),
        ),
    )
}

fn build_saas_state_postgres(
    pool: sqlx::PgPool,
    event_store: Arc<StoreBackend>,
    event_stream: Arc<StreamBackend>,
    launch_config: &config::LaunchConfig,
    runtime_config: SaasRuntimeConfig,
) -> SaasAppState {
    use chronicle_infra::postgres::repositories::*;

    SaasAppState::new(
        &launch_config.security.auth_secret,
        Arc::new(PgTenantRepo::new(pool.clone())),
        Arc::new(PgUserRepo::new(pool.clone())),
        Arc::new(PgRunRepo::new(pool.clone())),
        Arc::new(PgConnectionRepo::new(pool.clone())),
        Arc::new(PgAuditLogRepo::new(pool.clone())),
        Arc::new(PgAgentEndpointConfigRepo::new(pool.clone())),
        Arc::new(PgPipedreamTriggerRepo::new(pool.clone())),
        Arc::new(PgInvitationRepo::new(pool)),
        build_pipedream_client(launch_config),
        build_email_service(launch_config),
        event_store,
        event_stream,
        runtime_config,
    )
}

fn build_saas_state_memory(
    event_store: Arc<StoreBackend>,
    event_stream: Arc<StreamBackend>,
    launch_config: &config::LaunchConfig,
    runtime_config: SaasRuntimeConfig,
) -> SaasAppState {
    use chronicle_infra::memory::repositories::*;

    SaasAppState::new(
        &launch_config.security.auth_secret,
        Arc::new(InMemoryTenantRepo::default()),
        Arc::new(InMemoryUserRepo::default()),
        Arc::new(InMemoryRunRepo::default()),
        Arc::new(InMemoryConnectionRepo::default()),
        Arc::new(InMemoryAuditLogRepo::default()),
        Arc::new(InMemoryAgentEndpointConfigRepo::default()),
        Arc::new(InMemoryPipedreamTriggerRepo::default()),
        Arc::new(InMemoryInvitationRepo::default()),
        build_pipedream_client(launch_config),
        build_email_service(launch_config),
        event_store,
        event_stream,
        runtime_config,
    )
}

async fn maybe_run_saas_migrations(launch_config: &config::LaunchConfig) -> Result<()> {
    if launch_config.storage.saas.backend != config::BackendKind::Postgres {
        return Ok(());
    }

    let db_url = require_database_url("storage.saas", &launch_config.storage.saas)?;
    if launch_config.storage.saas.run_migrations {
        tracing::info!("Running SaaS schema migrations...");
        run_saas_migrations(db_url).await?;
    } else {
        tracing::info!("SaaS schema migrations disabled");
    }

    Ok(())
}

fn require_database_url<'a>(
    section: &str,
    store_config: &'a config::StoreConfig,
) -> Result<&'a str> {
    store_config
        .database_url
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("{section}.database_url must be set when backend=postgres"))
}

async fn run_saas_migrations(database_url: &str) -> Result<()> {
    let pool = sqlx::PgPool::connect(database_url)
        .await
        .map_err(|e| anyhow::anyhow!("Migration pool connect failed: {e}"))?;

    let migrations_dir = std::path::Path::new("migrations");
    if !migrations_dir.exists() {
        tracing::warn!("No migrations directory found, skipping migrations");
        return Ok(());
    }

    let mut migration_files: Vec<_> = std::fs::read_dir(migrations_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "sql"))
        .filter(|e| e.file_name() != "001_create_events.sql")
        .collect();
    migration_files.sort_by_key(|e| e.file_name());

    for entry in migration_files {
        let path = entry.path();
        let sql = std::fs::read_to_string(&path)?;
        tracing::info!("Running migration: {}", path.display());
        sqlx::raw_sql(&sql)
            .execute(&pool)
            .await
            .map_err(|e| anyhow::anyhow!("Migration {} failed: {e}", path.display()))?;
    }

    tracing::info!("Migrations complete");
    pool.close().await;
    Ok(())
}
