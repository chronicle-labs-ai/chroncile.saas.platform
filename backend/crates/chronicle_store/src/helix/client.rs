use std::path::PathBuf;

use async_trait::async_trait;
use helix_rs::{HelixDB, HelixDBClient};
use serde_json::Value;

use chronicle_core::error::StoreError;

pub const DEFAULT_HELIX_ENDPOINT: &str = "http://localhost";
pub const DEFAULT_HELIX_PORT: u16 = 6969;
pub const DEFAULT_HELIX_PROJECT_DIR: &str = "backend/helix/event-graph";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HelixConnectionConfig {
    pub endpoint: String,
    pub port: u16,
    pub api_key: Option<String>,
    pub project_dir: PathBuf,
}

impl Default for HelixConnectionConfig {
    fn default() -> Self {
        Self {
            endpoint: DEFAULT_HELIX_ENDPOINT.to_string(),
            port: DEFAULT_HELIX_PORT,
            api_key: None,
            project_dir: PathBuf::from(DEFAULT_HELIX_PROJECT_DIR),
        }
    }
}

#[async_trait]
pub trait HelixGraphClient: Send + Sync + 'static {
    async fn query_value(&self, endpoint: &str, data: &Value) -> Result<Value, StoreError>;
}

#[derive(Clone)]
pub struct SdkHelixGraphClient {
    client: HelixDB,
}

impl SdkHelixGraphClient {
    pub fn new(config: &HelixConnectionConfig) -> Self {
        Self {
            client: HelixDB::new(
                Some(config.endpoint.as_str()),
                Some(config.port),
                config.api_key.as_deref(),
            ),
        }
    }
}

#[async_trait]
impl HelixGraphClient for SdkHelixGraphClient {
    async fn query_value(&self, endpoint: &str, data: &Value) -> Result<Value, StoreError> {
        self.client
            .query::<_, Value>(endpoint, data)
            .await
            .map_err(map_helix_error)
    }
}

fn map_helix_error(error: helix_rs::HelixError) -> StoreError {
    match error {
        helix_rs::HelixError::ReqwestError(inner) => StoreError::Connection(inner.to_string()),
        helix_rs::HelixError::RemoteError { details } => StoreError::Query(details),
    }
}
