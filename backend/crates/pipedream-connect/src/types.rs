use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Development,
    Production,
}

impl Environment {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Production => "production",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PageInfo {
    pub count: Option<u64>,
    pub total_count: Option<u64>,
    pub start_cursor: Option<String>,
    pub end_cursor: Option<String>,
}

// === Apps ===

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct App {
    pub id: Option<String>,
    pub name_slug: String,
    pub name: String,
    pub auth_type: Option<String>,
    pub description: Option<String>,
    pub img_src: Option<String>,
    #[serde(default)]
    pub categories: Vec<String>,
    pub featured_weight: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AppsResponse {
    pub data: Vec<App>,
    pub page_info: Option<PageInfo>,
}

// === Connect Tokens ===

#[derive(Debug, Clone, Serialize)]
pub struct CreateTokenRequest {
    pub external_user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success_redirect_uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_redirect_uri: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectToken {
    pub token: String,
    #[serde(alias = "connect_link_url", rename = "connectLinkUrl")]
    pub connect_link_url: Option<String>,
    #[serde(alias = "expires_at", rename = "expiresAt")]
    pub expires_at: Option<String>,
}

// === Triggers ===

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TriggerComponent {
    pub key: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    #[serde(default)]
    pub configurable_props: Vec<ConfigurableProp>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConfigurableProp {
    pub name: String,
    #[serde(rename = "type")]
    pub prop_type: Option<String>,
    pub label: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub optional: bool,
    #[serde(rename = "remoteOptions", default)]
    pub remote_options: bool,
    #[serde(default)]
    pub options: Vec<PropOption>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PropOption {
    pub label: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TriggersResponse {
    pub data: Vec<TriggerComponent>,
    pub page_info: Option<PageInfo>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TriggerResponse {
    pub data: TriggerComponent,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PropOptionsResponse {
    pub options: Vec<PropOption>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeployTriggerRequest {
    pub id: String,
    pub external_user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub configured_props: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
}

// === Deployed Triggers ===

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DeployedTrigger {
    pub id: String,
    pub owner_id: Option<String>,
    pub component_id: Option<String>,
    pub component_key: Option<String>,
    pub configured_props: Option<serde_json::Value>,
    pub active: Option<bool>,
    pub created_at: Option<serde_json::Value>,
    pub updated_at: Option<serde_json::Value>,
    pub name: Option<String>,
    pub name_slug: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeployedTriggerResponse {
    pub data: DeployedTrigger,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeployedTriggersResponse {
    pub data: Vec<DeployedTrigger>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDeploymentRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub configured_props: Option<serde_json::Value>,
}

// === Accounts ===

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Account {
    pub id: String,
    pub name: Option<String>,
    pub external_id: Option<String>,
    pub healthy: Option<bool>,
    pub dead: Option<bool>,
    pub app: Option<AccountApp>,
    pub data: Option<serde_json::Value>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AccountApp {
    pub id: Option<String>,
    pub name_slug: Option<String>,
    pub name: Option<String>,
    pub auth_type: Option<String>,
    pub description: Option<String>,
    pub img_src: Option<String>,
    #[serde(default)]
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AccountsResponse {
    pub data: Vec<Account>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AccountResponse {
    pub data: Account,
}

// === OAuth Token (internal) ===

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct OAuthTokenResponse {
    pub access_token: String,
    pub expires_in: Option<i64>,
}
