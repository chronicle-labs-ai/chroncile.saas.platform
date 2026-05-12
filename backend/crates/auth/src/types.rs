use serde::{Deserialize, Serialize};

/// Authenticated user as resolved by the `AuthUser` extractor (in
/// `middleware.rs`). The shape is flat for convenience — every handler
/// that takes `user: AuthUser` reads fields like `user.tenant_id`
/// directly. Internally it's now built from the WorkOS JWT + local User +
/// local Tenant rows; the legacy HS256 self-issued JWT path is gone.
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
