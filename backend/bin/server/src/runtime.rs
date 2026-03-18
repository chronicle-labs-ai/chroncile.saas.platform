use std::sync::Arc;

use anyhow::Result;
use chronicle_api::{
    AppState, EventsRuntimeConfig, FeatureAccessRuntimeConfig, HealthMetadata, SaasAppState,
    NangoRuntimeConfig, SaasRuntimeConfig,
};
use chronicle_infra::{StoreBackend, StreamBackend};

use crate::{config, simulation};

#[derive(Clone)]
pub struct ChroniclePlatformRuntime {
    pub events_state: AppState,
    pub saas_state: SaasAppState,
    pub store_backend: Arc<StoreBackend>,
    pub stream_backend: Arc<StreamBackend>,
}

pub async fn build_platform_runtime(
    launch_config: &config::LaunchConfig,
) -> Result<ChroniclePlatformRuntime> {
    tracing::info!(
        events_backend = ?launch_config.storage.events.backend,
        saas_backend = ?launch_config.storage.saas.backend,
        "Launch configuration resolved"
    );

    maybe_run_saas_migrations(launch_config).await?;

    let stream_backend = Arc::new(StreamBackend::Memory(
        chronicle_infra::memory::MemoryStream::new(
            launch_config.stream.channel_capacity,
            launch_config.stream.buffer_capacity,
        ),
    ));

    let store_backend = match launch_config.storage.events.backend {
        #[cfg(feature = "postgres")]
        config::BackendKind::Postgres => {
            let postgres_store = build_postgres_event_store(launch_config).await?;
            Arc::new(StoreBackend::Postgres(postgres_store))
        }
        #[cfg(not(feature = "postgres"))]
        config::BackendKind::Postgres => {
            anyhow::bail!("storage.events.backend=postgres requires the `postgres` feature");
        }
        #[cfg(feature = "helix")]
        config::BackendKind::Helix => {
            let postgres_store = build_postgres_event_store(launch_config).await?;
            let helix_config = chronicle_infra::helix::HelixConnectionConfig {
                endpoint: launch_config.integrations.helix.endpoint.clone(),
                port: launch_config.integrations.helix.port,
                api_key: launch_config.integrations.helix.api_key.clone(),
                project_dir: std::path::PathBuf::from(
                    launch_config.integrations.helix.project_dir.as_str(),
                ),
            };

            tracing::info!(
                helix_endpoint = %helix_config.endpoint,
                helix_port = helix_config.port,
                project_dir = %helix_config.project_dir.display(),
                "Using Helix-backed event store with Postgres canonical storage"
            );

            Arc::new(StoreBackend::Helix(chronicle_infra::helix::HelixStore::new(
                postgres_store,
                helix_config,
            )))
        }
        #[cfg(not(feature = "helix"))]
        config::BackendKind::Helix => {
            anyhow::bail!("storage.events.backend=helix requires the `helix` feature");
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
        feature_access: FeatureAccessRuntimeConfig {
            plan_price_ids: launch_config.feature_access.plan_price_ids.clone(),
        },
        nango: NangoRuntimeConfig {
            intercom_integration_id: launch_config
                .integrations
                .nango
                .intercom_integration_id
                .clone(),
            front_integration_id: launch_config.integrations.nango.front_integration_id.clone(),
            webhook_secret: launch_config.integrations.nango.webhook_secret.clone(),
        },
    };

    let saas_state = match launch_config.storage.saas.backend {
        config::BackendKind::Postgres => {
            let db_url = require_database_url("storage.saas", &launch_config.storage.saas)?;
            tracing::info!("Using Postgres SaaS repositories");
            let pool = chronicle_infra::postgres::TracedPgPool::from(
                sqlx::PgPool::connect(db_url).await.map_err(|error| {
                    anyhow::anyhow!("Failed to create SaaS connection pool: {error}")
                })?,
            );
            build_saas_state_postgres(
                pool,
                Arc::clone(&store_backend),
                Arc::clone(&stream_backend),
                launch_config,
                saas_runtime.clone(),
            )
        }
        config::BackendKind::Memory => {
            tracing::info!("Using in-memory SaaS repositories");
            build_saas_state_memory(
                Arc::clone(&store_backend),
                Arc::clone(&stream_backend),
                launch_config,
                saas_runtime,
            )
        }
        config::BackendKind::Helix => {
            anyhow::bail!("storage.saas.backend=helix is not supported");
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

    Ok(ChroniclePlatformRuntime {
        events_state,
        saas_state,
        store_backend,
        stream_backend,
    })
}

pub fn maybe_start_simulation(
    runtime: &ChroniclePlatformRuntime,
    sim_config: simulation::SimulationConfig,
) -> Option<tokio::task::JoinHandle<()>> {
    if !sim_config.enabled {
        return None;
    }

    tracing::info!(
        mode = ?sim_config.mode,
        rate = sim_config.events_per_second,
        scenarios = ?sim_config.scenarios,
        sources = ?sim_config.sources,
        "Starting simulation mode"
    );

    Some(simulation::start_simulation(
        Arc::clone(&runtime.events_state.store),
        Arc::clone(&runtime.events_state.event_stream),
        sim_config,
    ))
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

fn build_nango_client(
    launch_config: &config::LaunchConfig,
) -> Option<Arc<chronicle_nango::NangoClient>> {
    let secret_key = launch_config.integrations.nango.secret_key.clone()?;
    if secret_key.is_empty() {
        return None;
    }

    tracing::info!(
        base_url = %launch_config.integrations.nango.base_url,
        intercom_integration_id = %launch_config.integrations.nango.intercom_integration_id,
        front_integration_id = %launch_config.integrations.nango.front_integration_id,
        "Nango integration configured"
    );

    Some(Arc::new(
        chronicle_nango::NangoClient::new(secret_key)
            .with_base_url(launch_config.integrations.nango.base_url.clone()),
    ))
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

fn build_sandbox_ai_service(
    launch_config: &config::LaunchConfig,
) -> Option<Arc<dyn chronicle_interfaces::SandboxAiConfigService>> {
    let api_key = launch_config.integrations.sandbox_ai.api_key.clone()?;
    let config = chronicle_integrations::sandbox_ai::AnthropicSandboxAiConfig {
        api_key,
        api_url: launch_config.integrations.sandbox_ai.api_url.clone(),
        model: launch_config.integrations.sandbox_ai.model.clone(),
        max_tokens: launch_config.integrations.sandbox_ai.max_tokens,
        temperature: launch_config.integrations.sandbox_ai.temperature,
        timeout_ms: launch_config.integrations.sandbox_ai.timeout_ms,
    };

    match chronicle_integrations::sandbox_ai::AnthropicSandboxAiConfigService::new(config) {
        Ok(service) => Some(Arc::new(service)),
        Err(error) => {
            tracing::warn!(error = %error, "Sandbox AI service configuration is invalid");
            None
        }
    }
}

fn build_saas_state_postgres(
    pool: chronicle_infra::postgres::TracedPgPool,
    event_store: Arc<StoreBackend>,
    event_stream: Arc<StreamBackend>,
    launch_config: &config::LaunchConfig,
    runtime_config: SaasRuntimeConfig,
) -> SaasAppState {
    use chronicle_infra::postgres::{repositories::*, PgFeatureFlagRepo};

    SaasAppState::new(
        &launch_config.security.auth_secret,
        Arc::new(PgTenantRepo::new(pool.clone())),
        Arc::new(PgUserRepo::new(pool.clone())),
        Arc::new(PgRunRepo::new(pool.clone())),
        Arc::new(PgConnectionRepo::new(pool.clone())),
        Arc::new(PgAuditLogRepo::new(pool.clone())),
        Arc::new(PgAgentEndpointConfigRepo::new(pool.clone())),
        Arc::new(PgPipedreamTriggerRepo::new(pool.clone())),
        Arc::new(PgFeatureFlagRepo::new(pool.clone())),
        Arc::new(PgInvitationRepo::new(pool.clone())),
        Arc::new(PgPasswordResetRepo::new(pool)),
        build_pipedream_client(launch_config),
        build_nango_client(launch_config),
        build_email_service(launch_config),
        build_sandbox_ai_service(launch_config),
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
    use chronicle_infra::memory::{repositories::*, InMemoryFeatureFlagRepo};

    SaasAppState::new(
        &launch_config.security.auth_secret,
        Arc::new(InMemoryTenantRepo::default()),
        Arc::new(InMemoryUserRepo::default()),
        Arc::new(InMemoryRunRepo::default()),
        Arc::new(InMemoryConnectionRepo::default()),
        Arc::new(InMemoryAuditLogRepo::default()),
        Arc::new(InMemoryAgentEndpointConfigRepo::default()),
        Arc::new(InMemoryPipedreamTriggerRepo::default()),
        Arc::new(InMemoryFeatureFlagRepo::default()),
        Arc::new(InMemoryInvitationRepo::default()),
        Arc::new(InMemoryPasswordResetRepo::default()),
        build_pipedream_client(launch_config),
        build_nango_client(launch_config),
        build_email_service(launch_config),
        build_sandbox_ai_service(launch_config),
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
        .ok_or_else(|| anyhow::anyhow!("{section}.database_url must be set for the selected backend"))
}

#[cfg(feature = "postgres")]
async fn build_postgres_event_store(
    launch_config: &config::LaunchConfig,
) -> Result<chronicle_infra::postgres::PostgresStore> {
    let db_url = require_database_url("storage.events", &launch_config.storage.events)?;
    tracing::info!("Using Postgres canonical event store");

    let postgres_store = chronicle_infra::postgres::PostgresStore::new(db_url)
        .await
        .map_err(|error| anyhow::anyhow!("Failed to connect to Postgres event store: {error}"))?;

    if launch_config.storage.events.run_migrations {
        tracing::info!("Running Chronicle-native event migrations...");
        postgres_store
            .migrate()
            .await
            .map_err(|error| anyhow::anyhow!("Failed to run event migrations: {error}"))?;
    } else {
        tracing::info!("Chronicle-native event migrations disabled");
    }

    Ok(postgres_store)
}

async fn run_saas_migrations(database_url: &str) -> Result<()> {
    let pool = sqlx::PgPool::connect(database_url)
        .await
        .map_err(|error| anyhow::anyhow!("Migration pool connect failed: {error}"))?;

    let migrations_dir = std::path::Path::new("migrations");
    if !migrations_dir.exists() {
        tracing::warn!("No migrations directory found, skipping migrations");
        return Ok(());
    }

    let mut migration_files: Vec<_> = std::fs::read_dir(migrations_dir)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "sql"))
        .filter(|entry| entry.file_name() != "001_create_events.sql")
        .collect();
    migration_files.sort_by_key(|entry| entry.file_name());

    for entry in migration_files {
        let path = entry.path();
        let sql = std::fs::read_to_string(&path)?;
        tracing::info!("Running migration: {}", path.display());
        sqlx::raw_sql(&sql)
            .execute(&pool)
            .await
            .map_err(|error| anyhow::anyhow!("Migration {} failed: {error}", path.display()))?;
    }

    tracing::info!("Migrations complete");
    pool.close().await;
    Ok(())
}
