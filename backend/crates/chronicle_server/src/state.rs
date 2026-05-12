//! Server state shared across all route handlers.

use chronicle_link::LinkService;
use chronicle_query::QueryService;
use chronicle_store::StorageEngine;
use serde::Deserialize;
use serde_json::Value;

const DEFAULT_UNKEY_API_ID: &str = "api_yeFHUx8h2p22";
const DEFAULT_UNKEY_BASE_URL: &str = "https://api.unkey.com/v2";

#[derive(Clone)]
pub struct SdkAuthConfig {
    root_key: Option<String>,
    _api_id: String,
    base_url: String,
    http: reqwest::Client,
}

#[derive(Clone, Debug)]
pub struct VerifiedSdkKey {
    pub key_id: Option<String>,
    pub owner_id: Option<String>,
    pub org_id: Option<String>,
    pub scopes: Vec<String>,
    pub rate_limit: Option<Value>,
}

impl SdkAuthConfig {
    pub fn disabled() -> Self {
        Self {
            root_key: None,
            _api_id: DEFAULT_UNKEY_API_ID.to_string(),
            base_url: DEFAULT_UNKEY_BASE_URL.to_string(),
            http: reqwest::Client::new(),
        }
    }

    pub fn with_unkey(root_key: &str, api_id: &str) -> Self {
        Self::with_unkey_base_url(root_key, api_id, None)
    }

    pub fn with_unkey_base_url(root_key: &str, api_id: &str, base_url: Option<&str>) -> Self {
        Self {
            root_key: Some(root_key.to_string()),
            _api_id: api_id.to_string(),
            base_url: base_url.unwrap_or(DEFAULT_UNKEY_BASE_URL).to_string(),
            http: reqwest::Client::new(),
        }
    }

    pub fn from_env() -> Self {
        let api_id =
            std::env::var("UNKEY_API_ID").unwrap_or_else(|_| DEFAULT_UNKEY_API_ID.to_string());
        let base_url =
            std::env::var("UNKEY_BASE_URL").unwrap_or_else(|_| DEFAULT_UNKEY_BASE_URL.to_string());
        let root_key = std::env::var("UNKEY_ROOT_KEY")
            .ok()
            .filter(|key| !key.trim().is_empty());

        Self {
            root_key,
            _api_id: api_id,
            base_url,
            http: reqwest::Client::new(),
        }
    }

    pub fn enabled(&self) -> bool {
        self.root_key.is_some()
    }

    pub async fn verify(&self, key: &str) -> Result<Option<VerifiedSdkKey>, String> {
        let Some(root_key) = &self.root_key else {
            return Ok(None);
        };

        let response = self
            .http
            .post(format!(
                "{}/keys.verifyKey",
                self.base_url.trim_end_matches('/')
            ))
            .bearer_auth(root_key)
            .json(&serde_json::json!({
                "key": key,
            }))
            .send()
            .await
            .map_err(|error| format!("failed to verify Unkey developer key: {error}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Unkey verification failed ({status}): {body}"));
        }

        let response = response
            .json::<UnkeyVerifyEnvelope>()
            .await
            .map_err(|error| format!("failed to parse Unkey verification response: {error}"))?;

        if !response.data.valid {
            return Err(format!("invalid developer key: {}", response.data.code));
        }

        let org_id = response
            .data
            .meta
            .as_ref()
            .and_then(|meta| meta.get("org_id").or_else(|| meta.get("tenant_id")))
            .and_then(Value::as_str)
            .map(ToString::to_string);
        let scopes = response
            .data
            .meta
            .as_ref()
            .and_then(|meta| meta.get("scopes"))
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect()
            })
            .unwrap_or_default();

        Ok(Some(VerifiedSdkKey {
            key_id: response.data.key_id,
            owner_id: response.data.owner_id,
            org_id,
            scopes,
            rate_limit: response.data.ratelimits.or(response.data.remaining),
        }))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UnkeyVerifyEnvelope {
    data: UnkeyVerifyData,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UnkeyVerifyData {
    valid: bool,
    code: String,
    key_id: Option<String>,
    owner_id: Option<String>,
    meta: Option<Value>,
    #[serde(default)]
    ratelimits: Option<Value>,
    #[serde(default)]
    remaining: Option<Value>,
}

/// Shared state for all axum handlers. Passed via `State<ServerState>`.
///
/// Each service is constructed once at startup and shared across all
/// requests via `Arc`.
#[derive(Clone)]
pub struct ServerState {
    pub query: QueryService,
    pub link: LinkService,
    pub engine: StorageEngine,
    pub sdk_auth: SdkAuthConfig,
}

impl ServerState {
    /// Create server state from a storage engine.
    ///
    /// Services are constructed from the engine. The batcher and
    /// embed service are created separately since they need additional
    /// config (batch thresholds, embedding model).
    pub fn new(engine: StorageEngine) -> Self {
        Self::new_with_sdk_auth(engine, SdkAuthConfig::from_env())
    }

    pub fn new_with_sdk_auth(engine: StorageEngine, sdk_auth: SdkAuthConfig) -> Self {
        Self {
            query: QueryService::new(engine.clone()),
            link: LinkService::new(engine.clone()),
            engine,
            sdk_auth,
        }
    }
}
