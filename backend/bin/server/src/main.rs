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

use chronicle_api::{build_router, build_saas_router, escalation, AppState, SaasAppState};
use chronicle_infra::{StoreBackend, StreamBackend};

mod simulation;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let host = std::env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port: u16 = std::env::var("API_PORT")
        .unwrap_or_else(|_| "8080".into())
        .parse()?;
    let backend_mode = std::env::var("BACKEND_MODE").unwrap_or_else(|_| "memory".into());

    tracing::info!("Starting Chronicle backend");
    tracing::info!("Backend mode: {}", backend_mode);

    let database_url = std::env::var("DATABASE_URL").ok();

    let channel_capacity: usize = std::env::var("STREAM_CHANNEL_CAPACITY")
        .unwrap_or_else(|_| "10000".into())
        .parse()?;
    let buffer_capacity: usize = std::env::var("STREAM_BUFFER_CAPACITY")
        .unwrap_or_else(|_| "100000".into())
        .parse()?;

    let (store_backend, stream_backend, saas_state) = match backend_mode.as_str() {
        #[cfg(feature = "postgres")]
        "real" | "postgres" => {
            let db_url = database_url.expect("DATABASE_URL must be set when BACKEND_MODE=real");
            tracing::info!("Using Postgres backend");

            let postgres_store = chronicle_infra::postgres::PostgresStore::new(&db_url)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to connect to Postgres: {e}"))?;

            tracing::info!("Running event store migrations...");
            postgres_store.migrate().await
                .map_err(|e| anyhow::anyhow!("Failed to run migrations: {e}"))?;

            tracing::info!("Running SaaS schema migrations...");
            run_saas_migrations(&db_url).await?;

            let memory_stream =
                chronicle_infra::memory::MemoryStream::new(channel_capacity, buffer_capacity);

            let store = Arc::new(StoreBackend::Postgres(postgres_store));
            let stream = Arc::new(StreamBackend::Memory(memory_stream));

            let pool = sqlx::PgPool::connect(&db_url).await
                .map_err(|e| anyhow::anyhow!("Failed to create connection pool: {e}"))?;

            let saas = build_saas_state_postgres(pool, Arc::clone(&store), Arc::clone(&stream));

            (store, stream, saas)
        }
        _ => {
            tracing::info!("Using in-memory backends");

            if let Some(ref db_url) = database_url {
                tracing::info!("DATABASE_URL set -- running SaaS migrations and using Postgres repos");
                run_saas_migrations(db_url).await?;

                let pool = sqlx::PgPool::connect(db_url).await
                    .map_err(|e| anyhow::anyhow!("Failed to create connection pool: {e}"))?;

                let memory_stream =
                    chronicle_infra::memory::MemoryStream::new(channel_capacity, buffer_capacity);
                let memory_store = chronicle_infra::memory::MemoryStore::new();

                let store = Arc::new(StoreBackend::Memory(memory_store));
                let stream = Arc::new(StreamBackend::Memory(memory_stream));

                let saas = build_saas_state_postgres(pool, Arc::clone(&store), Arc::clone(&stream));

                (store, stream, saas)
            } else {
                tracing::info!("No DATABASE_URL -- using in-memory repos for SaaS");

                let memory_stream =
                    chronicle_infra::memory::MemoryStream::new(channel_capacity, buffer_capacity);
                let memory_store = chronicle_infra::memory::MemoryStore::new();

                let store = Arc::new(StoreBackend::Memory(memory_store));
                let stream = Arc::new(StreamBackend::Memory(memory_stream));

                let saas = build_saas_state_memory(Arc::clone(&store), Arc::clone(&stream));

                (store, stream, saas)
            }
        }
    };

    let events_state = AppState::new_from_arcs(Arc::clone(&store_backend), Arc::clone(&stream_backend));

    let sim_config = simulation::SimulationConfig::from_env();
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

    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    let listener = TcpListener::bind(addr).await?;
    tracing::info!("Listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

fn build_pipedream_client() -> Option<Arc<pipedream_connect::PipedreamClient>> {
    let client_id = std::env::var("PIPEDREAM_CLIENT_ID").ok()?;
    let client_secret = std::env::var("PIPEDREAM_CLIENT_SECRET").ok()?;
    let project_id = std::env::var("PIPEDREAM_PROJECT_ID").ok()?;

    if client_id.is_empty() || client_secret.is_empty() {
        return None;
    }

    tracing::info!("Pipedream integration configured (project: {project_id})");
    Some(Arc::new(pipedream_connect::PipedreamClient::new(
        client_id,
        client_secret,
        project_id,
        pipedream_connect::Environment::Development,
    )))
}

fn build_email_service() -> Arc<dyn chronicle_interfaces::EmailService> {
    let template_map = parse_template_map();
    Arc::from(chronicle_integrations::resend::build_email_service(template_map))
}

fn parse_template_map() -> std::collections::HashMap<String, String> {
    std::env::var("RESEND_TEMPLATES_JSON")
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

fn build_saas_state_postgres(
    pool: sqlx::PgPool,
    event_store: Arc<StoreBackend>,
    event_stream: Arc<StreamBackend>,
) -> SaasAppState {
    use chronicle_infra::postgres::repositories::*;

    let jwt_secret = std::env::var("AUTH_SECRET")
        .unwrap_or_else(|_| "dev-secret-change-in-production-min-32-chars!!".into());

    SaasAppState::new(
        &jwt_secret,
        Arc::new(PgTenantRepo::new(pool.clone())),
        Arc::new(PgUserRepo::new(pool.clone())),
        Arc::new(PgRunRepo::new(pool.clone())),
        Arc::new(PgConnectionRepo::new(pool.clone())),
        Arc::new(PgAuditLogRepo::new(pool.clone())),
        Arc::new(PgAgentEndpointConfigRepo::new(pool.clone())),
        Arc::new(PgPipedreamTriggerRepo::new(pool.clone())),
        Arc::new(PgInvitationRepo::new(pool)),
        build_pipedream_client(),
        build_email_service(),
        event_store,
        event_stream,
        escalation::new_escalation_log(),
    )
}

fn build_saas_state_memory(
    event_store: Arc<StoreBackend>,
    event_stream: Arc<StreamBackend>,
) -> SaasAppState {
    use chronicle_infra::memory::repositories::*;

    let jwt_secret = std::env::var("AUTH_SECRET")
        .unwrap_or_else(|_| "dev-secret-change-in-production-min-32-chars!!".into());

    SaasAppState::new(
        &jwt_secret,
        Arc::new(InMemoryTenantRepo::default()),
        Arc::new(InMemoryUserRepo::default()),
        Arc::new(InMemoryRunRepo::default()),
        Arc::new(InMemoryConnectionRepo::default()),
        Arc::new(InMemoryAuditLogRepo::default()),
        Arc::new(InMemoryAgentEndpointConfigRepo::default()),
        Arc::new(InMemoryPipedreamTriggerRepo::default()),
        Arc::new(InMemoryInvitationRepo::default()),
        build_pipedream_client(),
        build_email_service(),
        event_store,
        event_stream,
        escalation::new_escalation_log(),
    )
}

async fn run_saas_migrations(database_url: &str) -> Result<()> {
    let pool = sqlx::PgPool::connect(database_url).await
        .map_err(|e| anyhow::anyhow!("Migration pool connect failed: {e}"))?;

    let migrations_dir = std::path::Path::new("migrations");
    if !migrations_dir.exists() {
        tracing::warn!("No migrations directory found, skipping migrations");
        return Ok(());
    }

    let mut migration_files: Vec<_> = std::fs::read_dir(migrations_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "sql"))
        .collect();
    migration_files.sort_by_key(|e| e.file_name());

    for entry in migration_files {
        let path = entry.path();
        let sql = std::fs::read_to_string(&path)?;
        tracing::info!("Running migration: {}", path.display());
        sqlx::raw_sql(&sql).execute(&pool).await
            .map_err(|e| anyhow::anyhow!("Migration {} failed: {e}", path.display()))?;
    }

    tracing::info!("Migrations complete");
    pool.close().await;
    Ok(())
}
