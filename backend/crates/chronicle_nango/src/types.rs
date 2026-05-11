use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct CreateConnectSessionRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<serde_json::Value>,
    pub end_user: ConnectEndUser,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization: Option<ConnectOrganization>,
    pub allowed_integrations: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub integrations_config_defaults: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateReconnectSessionRequest {
    pub connection_id: String,
    pub integration_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<serde_json::Value>,
    pub end_user: ConnectEndUser,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization: Option<ConnectOrganization>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub integrations_config_defaults: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overrides: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectEndUser {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectOrganization {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConnectSessionResponse {
    pub data: ConnectSession,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConnectSession {
    pub token: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ListConnectionsQuery {
    pub end_user_id: Option<String>,
    pub end_user_organization_id: Option<String>,
    pub search: Option<String>,
    pub tags: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TriggerSyncRequest {
    pub provider_config_key: String,
    pub connection_id: String,
    pub syncs: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StartSyncRequest {
    pub provider_config_key: String,
    pub connection_id: String,
    pub syncs: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SuccessResponse {
    pub success: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum ScriptsConfigEnvelope {
    Single(ScriptsConfigResponse),
    Many(Vec<ScriptsConfigResponse>),
}

impl ScriptsConfigEnvelope {
    pub fn into_configs(self) -> Vec<ScriptsConfigResponse> {
        match self {
            Self::Single(config) => vec![config],
            Self::Many(configs) => configs,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScriptsConfigResponse {
    #[serde(rename = "providerConfigKey")]
    pub provider_config_key: Option<String>,
    pub provider: Option<String>,
    #[serde(default)]
    pub syncs: Vec<ScriptConfig>,
    #[serde(default)]
    pub actions: Vec<ScriptConfig>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScriptConfig {
    pub name: String,
    pub enabled: Option<bool>,
    #[serde(default)]
    pub returns: Vec<String>,
    #[serde(rename = "sync_type")]
    pub sync_type: Option<String>,
    pub auto_start: Option<bool>,
    pub pre_built: Option<bool>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecordsResponse<T> {
    pub records: Vec<T>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NangoConnection {
    pub connection_id: String,
    pub provider: String,
    pub provider_config_key: String,
    pub metadata: Option<serde_json::Value>,
    pub tags: Option<serde_json::Value>,
    pub end_user: Option<NangoConnectionEndUser>,
    #[serde(alias = "created")]
    pub created_at: Option<String>,
    #[serde(alias = "updated")]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub errors: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NangoConnectionEndUser {
    pub id: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub tags: Option<serde_json::Value>,
    pub organization: Option<ConnectOrganization>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConnectionsResponse {
    pub connections: Vec<NangoConnection>,
}
