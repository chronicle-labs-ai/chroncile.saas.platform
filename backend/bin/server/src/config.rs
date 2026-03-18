use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

use crate::simulation::SimulationConfig;

#[derive(Debug, Clone)]
pub struct CliArgs {
    pub config_path: Option<PathBuf>,
    pub print_config: bool,
}

impl CliArgs {
    pub fn parse() -> Result<Self> {
        let mut config_path = None;
        let mut print_config = false;
        let mut args = std::env::args().skip(1);

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--config" | "-c" => {
                    let Some(path) = args.next() else {
                        bail!("missing value for {arg}");
                    };
                    config_path = Some(PathBuf::from(path));
                }
                "--print-config" => {
                    print_config = true;
                }
                _ if arg.starts_with("--config=") => {
                    let path = arg
                        .split_once('=')
                        .map(|(_, value)| value)
                        .filter(|value| !value.is_empty())
                        .ok_or_else(|| anyhow::anyhow!("missing value for --config"))?;
                    config_path = Some(PathBuf::from(path));
                }
                _ => bail!("unrecognized argument: {arg}"),
            }
        }

        Ok(Self {
            config_path,
            print_config,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LaunchConfig {
    pub server: ServerConfig,
    pub storage: StorageConfig,
    pub stream: StreamConfig,
    pub events: EventsConfig,
    pub feature_access: FeatureAccessConfig,
    pub security: SecurityConfig,
    pub urls: UrlsConfig,
    pub integrations: IntegrationsConfig,
    pub webhooks: WebhooksConfig,
    pub health: HealthConfig,
    pub simulation: SimulationConfig,
}

impl Default for LaunchConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            storage: StorageConfig::default(),
            stream: StreamConfig::default(),
            events: EventsConfig::default(),
            feature_access: FeatureAccessConfig::default(),
            security: SecurityConfig::default(),
            urls: UrlsConfig::default(),
            integrations: IntegrationsConfig::default(),
            webhooks: WebhooksConfig::default(),
            health: HealthConfig::default(),
            simulation: SimulationConfig::default(),
        }
    }
}

impl LaunchConfig {
    pub fn load(config_path: Option<&Path>) -> Result<Self> {
        let mut config = Self::default();

        if let Some(path) = config_path {
            let file = load_config_file(path)?;
            file.merge_into(&mut config);
        }

        config.apply_env_overrides()?;
        Ok(config)
    }

    pub fn config_path(cli_path: Option<PathBuf>) -> Option<PathBuf> {
        cli_path.or_else(|| std::env::var("CHRONICLE_CONFIG").ok().map(PathBuf::from))
    }

    fn apply_env_overrides(&mut self) -> Result<()> {
        if let Some(value) = non_empty_env("API_HOST") {
            self.server.host = value;
        }
        if let Some(value) = parse_env::<u16>("API_PORT")? {
            self.server.port = value;
        }
        if let Some(value) = non_empty_env("RUST_LOG") {
            self.server.rust_log = value;
        }

        if let Some(value) = parse_env::<usize>("STREAM_CHANNEL_CAPACITY")? {
            self.stream.channel_capacity = value;
        }
        if let Some(value) = parse_env::<usize>("STREAM_BUFFER_CAPACITY")? {
            self.stream.buffer_capacity = value;
        }

        if let Some(value) = non_empty_env("DEFAULT_TENANT_ID") {
            self.events.default_tenant_id = value;
        }

        if let Some(value) = non_empty_env("FEATURE_ACCESS_PLAN_PRICE_IDS_JSON") {
            self.feature_access.plan_price_ids = serde_json::from_str(&value)
                .context("failed to parse FEATURE_ACCESS_PLAN_PRICE_IDS_JSON as JSON object")?;
        }

        if let Some(value) = non_empty_env("AUTH_SECRET") {
            self.security.auth_secret = value;
        }
        if let Some(value) = non_empty_env("SERVICE_SECRET") {
            self.security.service_secret = Some(value);
        }

        if let Some(value) = non_empty_env("NEXT_PUBLIC_APP_URL") {
            self.urls.app_url = value;
        }

        if let Some(value) = non_empty_env("PIPEDREAM_CLIENT_ID") {
            self.integrations.pipedream.client_id = Some(value);
        }
        if let Some(value) = non_empty_env("PIPEDREAM_CLIENT_SECRET") {
            self.integrations.pipedream.client_secret = Some(value);
        }
        if let Some(value) = non_empty_env("PIPEDREAM_PROJECT_ID") {
            self.integrations.pipedream.project_id = Some(value);
        }
        if let Some(value) = non_empty_env("PIPEDREAM_ENVIRONMENT") {
            self.integrations.pipedream.environment = PipedreamEnvironment::parse(&value)?;
        }
        if let Some(value) = non_empty_env("NANGO_SECRET_KEY") {
            self.integrations.nango.secret_key = Some(value);
        }
        if let Some(value) = non_empty_env("NANGO_BASE_URL") {
            self.integrations.nango.base_url = value;
        }
        if let Some(value) = non_empty_env("NANGO_WEBHOOK_SECRET") {
            self.integrations.nango.webhook_secret = Some(value);
        }
        if let Some(value) = non_empty_env("NANGO_INTERCOM_INTEGRATION_ID") {
            self.integrations.nango.intercom_integration_id = value;
        }
        if let Some(value) = non_empty_env("NANGO_FRONT_INTEGRATION_ID") {
            self.integrations.nango.front_integration_id = value;
        }


        if let Some(value) = non_empty_env("RESEND_API_KEY") {
            self.integrations.resend.api_key = Some(value);
        }
        if let Some(value) = non_empty_env("RESEND_FROM_ADDRESS") {
            self.integrations.resend.from_address = Some(value);
        }
        if let Some(value) = non_empty_env("RESEND_TEMPLATES_JSON") {
            self.integrations.resend.templates = serde_json::from_str(&value)
                .context("failed to parse RESEND_TEMPLATES_JSON as JSON object")?;
        }
        if let Some(value) = non_empty_env("SANDBOX_AI_API_KEY") {
            self.integrations.sandbox_ai.api_key = Some(value);
        }
        if let Some(value) = non_empty_env("SANDBOX_AI_API_URL") {
            self.integrations.sandbox_ai.api_url = value;
        }
        if let Some(value) = non_empty_env("SANDBOX_AI_MODEL") {
            self.integrations.sandbox_ai.model = value;
        }
        if let Some(value) = parse_env::<u32>("SANDBOX_AI_MAX_TOKENS")? {
            self.integrations.sandbox_ai.max_tokens = value;
        }
        if let Some(value) = parse_env::<f32>("SANDBOX_AI_TEMPERATURE")? {
            self.integrations.sandbox_ai.temperature = value;
        }
        if let Some(value) = parse_env::<u64>("SANDBOX_AI_TIMEOUT_MS")? {
            self.integrations.sandbox_ai.timeout_ms = value;
        }
        if let Some(value) = non_empty_env("SENTRY_DSN") {
            self.integrations.sentry.dsn = Some(value);
        }
        if let Some(value) = non_empty_env("SENTRY_ENVIRONMENT") {
            self.integrations.sentry.environment = Some(value);
        }
        if let Some(value) = parse_env::<f32>("SENTRY_TRACES_SAMPLE_RATE")? {
            self.integrations.sentry.traces_sample_rate = value;
        }
        if let Some(value) = non_empty_env("HELIX_BASE_URL") {
            self.integrations.helix.endpoint = value;
        }
        if let Some(value) = parse_env::<u16>("HELIX_PORT")? {
            self.integrations.helix.port = value;
        }
        if let Some(value) = non_empty_env("HELIX_API_KEY") {
            self.integrations.helix.api_key = Some(value);
        }
        if let Some(value) = non_empty_env("HELIX_PROJECT_PATH") {
            self.integrations.helix.project_dir = value;
        }

        if let Some(value) = non_empty_env("STRIPE_WEBHOOK_SECRET") {
            self.webhooks.stripe_secret = Some(value);
        }

        if let Some(value) = non_empty_env("GIT_SHA") {
            self.health.git_sha = Some(value);
        }
        if let Some(value) = non_empty_env("GIT_TAG") {
            self.health.git_tag = Some(value);
        }
        if let Some(value) = non_empty_env("ENVIRONMENT") {
            self.health.environment = Some(value);
        }

        if let Some(value) = parse_bool_env("SIM_MODE")? {
            self.simulation.enabled = value;
        }
        if let Some(value) = non_empty_env("SIM_TIMING") {
            self.simulation.mode = crate::simulation::SimMode::from_str(&value);
        }
        if let Some(value) = parse_env::<f64>("SIM_RATE")? {
            self.simulation.events_per_second = value;
        }
        if let Some(value) = parse_csv_env("SIM_SCENARIOS") {
            self.simulation.scenarios = value;
        }
        if let Some(value) = parse_csv_env("SIM_SOURCES") {
            self.simulation.sources = value;
        }
        if let Some(value) = parse_bool_env("SIM_LOOP")? {
            self.simulation.loop_forever = value;
        }
        if let Some(value) = non_empty_env("SIM_TENANT") {
            self.simulation.tenant_id = value;
        }

        self.apply_storage_env_overrides()?;
        Ok(())
    }

    fn apply_storage_env_overrides(&mut self) -> Result<()> {
        let legacy_backend_mode = non_empty_env("BACKEND_MODE");
        let legacy_database_url = non_empty_env("DATABASE_URL");

        if let Some(value) = non_empty_env("EVENTS_BACKEND_MODE") {
            self.storage.events.backend = BackendKind::parse(&value)?;
        } else if let Some(value) = legacy_backend_mode.as_deref() {
            self.storage.events.backend = BackendKind::parse_legacy(value)?;
        }

        if let Some(value) = non_empty_env("SAAS_BACKEND_MODE") {
            self.storage.saas.backend = BackendKind::parse(&value)?;
        } else if let Some(value) = legacy_backend_mode.as_deref() {
            self.storage.saas.backend = if BackendKind::parse_legacy(value)?
                == BackendKind::Postgres
                || legacy_database_url.is_some()
            {
                BackendKind::Postgres
            } else {
                BackendKind::Memory
            };
        } else if legacy_database_url.is_some() {
            self.storage.saas.backend = BackendKind::Postgres;
        }

        if let Some(value) = non_empty_env("EVENTS_DATABASE_URL") {
            self.storage.events.database_url = Some(value);
        } else if self.storage.events.database_url.is_none() {
            self.storage.events.database_url = legacy_database_url.clone();
        }

        if let Some(value) = non_empty_env("SAAS_DATABASE_URL") {
            self.storage.saas.database_url = Some(value);
        } else if self.storage.saas.database_url.is_none() {
            self.storage.saas.database_url = legacy_database_url;
        }

        if let Some(value) = parse_bool_env("RUN_EVENT_MIGRATIONS")? {
            self.storage.events.run_migrations = value;
        }
        if let Some(value) = parse_bool_env("RUN_SAAS_MIGRATIONS")? {
            self.storage.saas.run_migrations = value;
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub rust_log: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 8080,
            rust_log: "info,tower_http=debug".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamConfig {
    pub channel_capacity: usize,
    pub buffer_capacity: usize,
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self {
            channel_capacity: 10_000,
            buffer_capacity: 100_000,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct EventsConfig {
    pub default_tenant_id: String,
}

impl Default for EventsConfig {
    fn default() -> Self {
        Self {
            default_tenant_id: "demo_tenant".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct FeatureAccessConfig {
    pub plan_price_ids: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SecurityConfig {
    pub auth_secret: String,
    pub service_secret: Option<String>,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            auth_secret: "dev-secret-change-in-production-min-32-chars!!".to_string(),
            service_secret: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct UrlsConfig {
    pub app_url: String,
}

impl Default for UrlsConfig {
    fn default() -> Self {
        Self {
            app_url: "https://app.chronicle-labs.com".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct HealthConfig {
    pub environment: Option<String>,
    pub git_sha: Option<String>,
    pub git_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IntegrationsConfig {
    pub pipedream: PipedreamConfig,
    pub nango: NangoConfig,
    pub resend: ResendConfig,
    pub sandbox_ai: SandboxAiConfig,
    pub sentry: SentryConfig,
    pub helix: HelixConfig,
}

impl Default for IntegrationsConfig {
    fn default() -> Self {
        Self {
            pipedream: PipedreamConfig::default(),
            nango: NangoConfig::default(),
            resend: ResendConfig::default(),
            sandbox_ai: SandboxAiConfig::default(),
            sentry: SentryConfig::default(),
            helix: HelixConfig::default(),
        }
    }
}


#[derive(Debug, Clone, Serialize)]
pub struct PipedreamConfig {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub project_id: Option<String>,
    pub environment: PipedreamEnvironment,
}

impl Default for PipedreamConfig {
    fn default() -> Self {
        Self {
            client_id: None,
            client_secret: None,
            project_id: None,
            environment: PipedreamEnvironment::Development,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct NangoConfig {
    pub secret_key: Option<String>,
    pub base_url: String,
    pub webhook_secret: Option<String>,
    pub intercom_integration_id: String,
    pub front_integration_id: String,
}

impl Default for NangoConfig {
    fn default() -> Self {
        Self {
            secret_key: None,
            base_url: "https://api.nango.dev".to_string(),
            webhook_secret: None,
            intercom_integration_id: "intercom".to_string(),
            front_integration_id: "front".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct ResendConfig {
    pub api_key: Option<String>,
    pub from_address: Option<String>,
    pub templates: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SandboxAiConfig {
    pub api_key: Option<String>,
    pub api_url: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_ms: u64,
}

impl Default for SandboxAiConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            api_url: "https://api.anthropic.com/v1/messages".to_string(),
            model: "claude-sonnet-4-6".to_string(),
            max_tokens: 1_024,
            temperature: 0.0,
            timeout_ms: 30_000,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SentryConfig {
    pub dsn: Option<String>,
    pub environment: Option<String>,
    pub traces_sample_rate: f32,
}

impl Default for SentryConfig {
    fn default() -> Self {
        Self {
            dsn: None,
            environment: None,
            traces_sample_rate: 0.1,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct HelixConfig {
    pub endpoint: String,
    pub port: u16,
    pub api_key: Option<String>,
    pub project_dir: String,
}

impl Default for HelixConfig {
    fn default() -> Self {
        Self {
            endpoint: "http://localhost".to_string(),
            port: 6969,
            api_key: None,
            project_dir: "backend/helix/event-graph".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct WebhooksConfig {
    pub stripe_secret: Option<String>,
    pub source_secrets: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageConfig {
    pub events: StoreConfig,
    pub saas: StoreConfig,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            events: StoreConfig::default(),
            saas: StoreConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct StoreConfig {
    pub backend: BackendKind,
    pub database_url: Option<String>,
    pub run_migrations: bool,
}

impl Default for StoreConfig {
    fn default() -> Self {
        Self {
            backend: BackendKind::Memory,
            database_url: None,
            run_migrations: true,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackendKind {
    Memory,
    Postgres,
    Helix,
}

impl BackendKind {
    pub fn parse(value: &str) -> Result<Self> {
        match value.trim().to_lowercase().as_str() {
            "memory" => Ok(Self::Memory),
            "postgres" | "real" => Ok(Self::Postgres),
            "helix" => Ok(Self::Helix),
            other => bail!("invalid backend mode: {other}"),
        }
    }

    pub fn parse_legacy(value: &str) -> Result<Self> {
        Self::parse(value)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PipedreamEnvironment {
    Development,
    Production,
}

impl PipedreamEnvironment {
    pub fn parse(value: &str) -> Result<Self> {
        match value.trim().to_lowercase().as_str() {
            "development" | "dev" => Ok(Self::Development),
            "production" | "prod" => Ok(Self::Production),
            other => bail!("invalid pipedream environment: {other}"),
        }
    }

    pub fn to_sdk(self) -> chronicle_pipedream_connect::Environment {
        match self {
            Self::Development => chronicle_pipedream_connect::Environment::Development,
            Self::Production => chronicle_pipedream_connect::Environment::Production,
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileConfig {
    server: FileServerConfig,
    storage: FileStorageConfig,
    stream: FileStreamConfig,
    events: FileEventsConfig,
    feature_access: FileFeatureAccessConfig,
    security: FileSecurityConfig,
    urls: FileUrlsConfig,
    integrations: FileIntegrationsConfig,
    webhooks: FileWebhooksConfig,
    health: FileHealthConfig,
    simulation: Option<SimulationConfig>,
}

impl FileConfig {
    fn merge_into(self, config: &mut LaunchConfig) {
        if let Some(value) = self.server.host {
            config.server.host = value;
        }
        if let Some(value) = self.server.port {
            config.server.port = value;
        }
        if let Some(value) = self.server.rust_log {
            config.server.rust_log = value;
        }

        if let Some(value) = self.storage.events.backend {
            config.storage.events.backend = value;
        }
        if let Some(value) = self.storage.events.database_url {
            config.storage.events.database_url = Some(value);
        }
        if let Some(value) = self.storage.events.run_migrations {
            config.storage.events.run_migrations = value;
        }

        if let Some(value) = self.storage.saas.backend {
            config.storage.saas.backend = value;
        }
        if let Some(value) = self.storage.saas.database_url {
            config.storage.saas.database_url = Some(value);
        }
        if let Some(value) = self.storage.saas.run_migrations {
            config.storage.saas.run_migrations = value;
        }

        if let Some(value) = self.stream.channel_capacity {
            config.stream.channel_capacity = value;
        }
        if let Some(value) = self.stream.buffer_capacity {
            config.stream.buffer_capacity = value;
        }

        if let Some(value) = self.events.default_tenant_id {
            config.events.default_tenant_id = value;
        }

        if !self.feature_access.plan_price_ids.is_empty() {
            config.feature_access.plan_price_ids = self.feature_access.plan_price_ids;
        }

        if let Some(value) = self.security.auth_secret {
            config.security.auth_secret = value;
        }
        if let Some(value) = self.security.service_secret {
            config.security.service_secret = Some(value);
        }

        if let Some(value) = self.urls.app_url {
            config.urls.app_url = value;
        }

        if let Some(value) = self.integrations.pipedream.client_id {
            config.integrations.pipedream.client_id = Some(value);
        }
        if let Some(value) = self.integrations.pipedream.client_secret {
            config.integrations.pipedream.client_secret = Some(value);
        }
        if let Some(value) = self.integrations.pipedream.project_id {
            config.integrations.pipedream.project_id = Some(value);
        }
        if let Some(value) = self.integrations.pipedream.environment {
            config.integrations.pipedream.environment = value;
        }

        if let Some(value) = self.integrations.resend.api_key {
            config.integrations.resend.api_key = Some(value);
        }
        if let Some(value) = self.integrations.resend.from_address {
            config.integrations.resend.from_address = Some(value);
        }
        if !self.integrations.resend.templates.is_empty() {
            config.integrations.resend.templates = self.integrations.resend.templates;
        }
        if let Some(value) = self.integrations.sandbox_ai.api_key {
            config.integrations.sandbox_ai.api_key = Some(value);
        }
        if let Some(value) = self.integrations.sandbox_ai.api_url {
            config.integrations.sandbox_ai.api_url = value;
        }
        if let Some(value) = self.integrations.sandbox_ai.model {
            config.integrations.sandbox_ai.model = value;
        }
        if let Some(value) = self.integrations.sandbox_ai.max_tokens {
            config.integrations.sandbox_ai.max_tokens = value;
        }
        if let Some(value) = self.integrations.sandbox_ai.temperature {
            config.integrations.sandbox_ai.temperature = value;
        }
        if let Some(value) = self.integrations.sandbox_ai.timeout_ms {
            config.integrations.sandbox_ai.timeout_ms = value;
        }
        if let Some(value) = self.integrations.sentry.dsn {
            config.integrations.sentry.dsn = Some(value);
        }
        if let Some(value) = self.integrations.sentry.environment {
            config.integrations.sentry.environment = Some(value);
        }
        if let Some(value) = self.integrations.sentry.traces_sample_rate {
            config.integrations.sentry.traces_sample_rate = value;
        }
        if let Some(value) = self.integrations.helix.endpoint {
            config.integrations.helix.endpoint = value;
        }
        if let Some(value) = self.integrations.helix.port {
            config.integrations.helix.port = value;
        }
        if let Some(value) = self.integrations.helix.api_key {
            config.integrations.helix.api_key = Some(value);
        }
        if let Some(value) = self.integrations.helix.project_dir {
            config.integrations.helix.project_dir = value;
        }

        if let Some(value) = self.webhooks.stripe_secret {
            config.webhooks.stripe_secret = Some(value);
        }
        if !self.webhooks.source_secrets.is_empty() {
            config.webhooks.source_secrets = self
                .webhooks
                .source_secrets
                .into_iter()
                .map(|(key, value)| (key.to_lowercase(), value))
                .collect();
        }

        if let Some(value) = self.health.environment {
            config.health.environment = Some(value);
        }
        if let Some(value) = self.health.git_sha {
            config.health.git_sha = Some(value);
        }
        if let Some(value) = self.health.git_tag {
            config.health.git_tag = Some(value);
        }

        if let Some(value) = self.simulation {
            config.simulation = value;
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileServerConfig {
    host: Option<String>,
    port: Option<u16>,
    rust_log: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileStreamConfig {
    channel_capacity: Option<usize>,
    buffer_capacity: Option<usize>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileEventsConfig {
    default_tenant_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileFeatureAccessConfig {
    plan_price_ids: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileSecurityConfig {
    auth_secret: Option<String>,
    service_secret: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileUrlsConfig {
    app_url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileHealthConfig {
    environment: Option<String>,
    git_sha: Option<String>,
    git_tag: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileIntegrationsConfig {
    pipedream: FilePipedreamConfig,
    resend: FileResendConfig,
    sandbox_ai: FileSandboxAiConfig,
    sentry: FileSentryConfig,
    helix: FileHelixConfig,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FilePipedreamConfig {
    client_id: Option<String>,
    client_secret: Option<String>,
    project_id: Option<String>,
    environment: Option<PipedreamEnvironment>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileResendConfig {
    api_key: Option<String>,
    from_address: Option<String>,
    templates: HashMap<String, String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileSandboxAiConfig {
    api_key: Option<String>,
    api_url: Option<String>,
    model: Option<String>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileSentryConfig {
    dsn: Option<String>,
    environment: Option<String>,
    traces_sample_rate: Option<f32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileHelixConfig {
    endpoint: Option<String>,
    port: Option<u16>,
    api_key: Option<String>,
    project_dir: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileWebhooksConfig {
    stripe_secret: Option<String>,
    source_secrets: HashMap<String, String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileStorageConfig {
    events: FileStoreConfig,
    saas: FileStoreConfig,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct FileStoreConfig {
    backend: Option<BackendKind>,
    database_url: Option<String>,
    run_migrations: Option<bool>,
}

fn load_config_file(path: &Path) -> Result<FileConfig> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read config file {}", path.display()))?;
    toml::from_str(&raw).with_context(|| format!("failed to parse config file {}", path.display()))
}

fn non_empty_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn parse_env<T>(key: &str) -> Result<Option<T>>
where
    T: std::str::FromStr,
    T::Err: std::error::Error + Send + Sync + 'static,
{
    match non_empty_env(key) {
        Some(value) => value
            .parse::<T>()
            .map(Some)
            .with_context(|| format!("failed to parse {key}={value}")),
        None => Ok(None),
    }
}

fn parse_csv_env(key: &str) -> Option<Vec<String>> {
    non_empty_env(key).map(|value| {
        value
            .split(',')
            .map(|item| item.trim().to_lowercase())
            .filter(|item| !item.is_empty())
            .collect()
    })
}

fn parse_bool_env(key: &str) -> Result<Option<bool>> {
    match non_empty_env(key) {
        Some(value) => match value.trim().to_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Ok(Some(true)),
            "0" | "false" | "no" | "off" => Ok(Some(false)),
            _ => bail!("failed to parse {key}={value} as boolean"),
        },
        None => Ok(None),
    }
}
