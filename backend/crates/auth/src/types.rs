use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub role: String,
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub name: Option<String>,
    pub role: String,
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_slug: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "generated/")]
pub struct AuthResponse {
    pub token: String,
    pub user: AuthUserResponse,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "generated/")]
pub struct AuthUserResponse {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub role: String,
    #[serde(rename = "tenantId")]
    pub tenant_id: String,
    #[serde(rename = "tenantName")]
    pub tenant_name: String,
    #[serde(rename = "tenantSlug")]
    pub tenant_slug: String,
}
