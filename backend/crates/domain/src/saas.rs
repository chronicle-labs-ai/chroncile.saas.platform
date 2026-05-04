use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub enum UserRole {
    #[serde(rename = "owner")]
    Owner,
    #[serde(rename = "admin")]
    Admin,
    #[serde(rename = "member")]
    #[default]
    Member,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Admin => "admin",
            Self::Member => "member",
        }
    }

    pub fn has_admin_access(&self) -> bool {
        matches!(self, Self::Owner | Self::Admin)
    }

    pub fn is_owner(&self) -> bool {
        matches!(self, Self::Owner)
    }
}

impl FromStr for UserRole {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "owner" => Ok(Self::Owner),
            "admin" => Ok(Self::Admin),
            "member" => Ok(Self::Member),
            _ => Err(()),
        }
    }
}

impl fmt::Display for UserRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct Tenant {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub stripe_customer_id: Option<String>,
    pub stripe_subscription_status: Option<String>,
    pub stripe_price_id: Option<String>,
    /// Linked WorkOS Organization id. Populated lazily during the WorkOS
    /// importer (Phase 1) or eagerly via `provisionWorkspace` (Phase 2).
    pub workos_organization_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// TenantMembership — mirrors WorkOS's `organization_membership` resource.
// One User can be a member of zero, one, or many Tenants. Replaces the
// User.tenant_id == Tenant.id check in the WorkosAuthUser extractor.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "generated/")]
pub enum MembershipStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "active")]
    Active,
    #[serde(rename = "inactive")]
    Inactive,
}

impl MembershipStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Active => "active",
            Self::Inactive => "inactive",
        }
    }
}

impl FromStr for MembershipStatus {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "active" => Ok(Self::Active),
            "inactive" => Ok(Self::Inactive),
            _ => Err(()),
        }
    }
}

impl fmt::Display for MembershipStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct TenantMembership {
    pub id: String,
    pub user_id: String,
    pub tenant_id: String,
    pub role: UserRole,
    pub status: MembershipStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTenantMembershipInput {
    pub user_id: String,
    pub tenant_id: String,
    pub role: UserRole,
    pub status: MembershipStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    #[serde(skip_serializing)]
    pub password: Option<String>,
    pub auth_provider: String,
    pub role: UserRole,
    pub tenant_id: String,
    /// Linked WorkOS user id (`user_…`). Populated by the importer for
    /// pre-existing accounts and at JIT-create time for new accounts.
    pub workos_user_id: Option<String>,
    /// Mirror of WorkOS `emailVerified` state. Mirrored at JIT-create and
    /// SCIM-sync time so audit code can answer "did this person ever verify
    /// their email?" without round-tripping to WorkOS.
    pub email_verified_at: Option<DateTime<Utc>>,
    /// Free-form provenance tag. One of `self_serve`, `invite`, `scim`,
    /// `import`. Used by the F.2 admin user-detail surface and to bucket
    /// audit reports across provisioning paths.
    pub created_via: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct AgentEndpointConfig {
    pub id: String,
    pub tenant_id: String,
    pub endpoint_url: Option<String>,
    pub auth_type: String,
    pub auth_header_name: Option<String>,
    pub auth_secret_encrypted: Option<String>,
    pub basic_username: Option<String>,
    pub custom_headers_json: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "generated/")]
pub enum RunStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "processing")]
    Processing,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "requires_human")]
    RequiresHuman,
}

impl RunStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Processing => "processing",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::RequiresHuman => "requires_human",
        }
    }

    pub fn can_transition_to(&self, target: &Self) -> bool {
        matches!(
            (self, target),
            (Self::Pending, Self::Processing)
                | (Self::Processing, Self::Completed)
                | (Self::Processing, Self::Failed)
                | (Self::Processing, Self::RequiresHuman)
                | (Self::RequiresHuman, Self::Completed)
                | (Self::RequiresHuman, Self::Failed)
        )
    }
}

impl FromStr for RunStatus {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "processing" => Ok(Self::Processing),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            "requires_human" => Ok(Self::RequiresHuman),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct Run {
    pub id: String,
    pub tenant_id: String,
    pub workflow_id: Option<String>,
    pub event_id: String,
    pub invocation_id: String,
    pub mode: String,
    pub status: String,
    pub event_snapshot: Option<serde_json::Value>,
    pub context_pointers: Option<serde_json::Value>,
    pub agent_request: Option<serde_json::Value>,
    pub agent_response: Option<serde_json::Value>,
    pub human_decision: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct AuditLog {
    pub id: String,
    pub tenant_id: String,
    pub run_id: Option<String>,
    pub event_id: Option<String>,
    pub invocation_id: Option<String>,
    pub action: String,
    pub actor: Option<String>,
    pub payload: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct Connection {
    pub id: String,
    pub tenant_id: String,
    pub provider: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub nango_connection_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct IntegrationSync {
    pub id: String,
    pub tenant_id: String,
    pub connection_id: String,
    pub sync_name: String,
    pub nango_sync_id: String,
    pub configured_props: Option<serde_json::Value>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub sync_cursor: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CreateTenantInput {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone)]
pub struct CreateUserInput {
    pub email: String,
    pub name: Option<String>,
    pub password_hash: Option<String>,
    pub auth_provider: String,
    pub role: UserRole,
    pub tenant_id: String,
    /// Optional WorkOS user id; populated during JIT-provision paths and the
    /// importer. `None` for pre-WorkOS rows.
    pub workos_user_id: Option<String>,
    /// Provenance tag matching `User.created_via`.
    pub created_via: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct Invitation {
    pub id: String,
    pub tenant_id: String,
    pub email: String,
    pub role: UserRole,
    pub token: String,
    pub invited_by: String,
    pub expires_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CreateInvitationInput {
    pub tenant_id: String,
    pub email: String,
    pub role: UserRole,
    pub invited_by: String,
}

#[derive(Debug, Clone)]
pub struct PasswordResetToken {
    pub id: String,
    pub user_id: String,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CreatePasswordResetTokenInput {
    pub user_id: String,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CreateRunInput {
    pub tenant_id: String,
    pub workflow_id: Option<String>,
    pub event_id: String,
    pub invocation_id: String,
    pub mode: String,
    pub event_snapshot: Option<serde_json::Value>,
    pub context_pointers: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct CreateConnectionInput {
    pub tenant_id: String,
    pub provider: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub nango_connection_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_run_status_transitions() {
        assert!(RunStatus::Pending.can_transition_to(&RunStatus::Processing));
        assert!(RunStatus::Processing.can_transition_to(&RunStatus::Completed));
        assert!(RunStatus::Processing.can_transition_to(&RunStatus::Failed));
        assert!(RunStatus::Processing.can_transition_to(&RunStatus::RequiresHuman));
        assert!(RunStatus::RequiresHuman.can_transition_to(&RunStatus::Completed));

        assert!(!RunStatus::Pending.can_transition_to(&RunStatus::Completed));
        assert!(!RunStatus::Completed.can_transition_to(&RunStatus::Pending));
        assert!(!RunStatus::Failed.can_transition_to(&RunStatus::Processing));
    }

    #[test]
    fn test_run_status_roundtrip() {
        let statuses = vec![
            RunStatus::Pending,
            RunStatus::Processing,
            RunStatus::Completed,
            RunStatus::Failed,
            RunStatus::RequiresHuman,
        ];

        for status in statuses {
            let s = status.as_str();
            let parsed: RunStatus = s.parse().unwrap();
            assert_eq!(parsed, status);
        }
    }

    #[test]
    fn test_run_status_unknown_returns_none() {
        assert!("unknown".parse::<RunStatus>().is_err());
    }

    #[test]
    fn test_user_password_not_serialized() {
        let user = User {
            id: "u1".to_string(),
            email: "test@example.com".to_string(),
            name: Some("Test".to_string()),
            password: Some("hashed_secret".to_string()),
            auth_provider: "credentials".to_string(),
            role: UserRole::Member,
            tenant_id: "t1".to_string(),
            workos_user_id: None,
            email_verified_at: None,
            created_via: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&user).unwrap();
        assert!(!json.contains("hashed_secret"));
        assert!(json.contains("\"role\":\"member\""));
    }

    #[test]
    fn test_user_role_hierarchy() {
        assert!(UserRole::Owner.has_admin_access());
        assert!(UserRole::Admin.has_admin_access());
        assert!(!UserRole::Member.has_admin_access());
        assert!(UserRole::Owner.is_owner());
        assert!(!UserRole::Admin.is_owner());
    }

    #[test]
    fn test_user_role_roundtrip() {
        for role in [UserRole::Owner, UserRole::Admin, UserRole::Member] {
            let s = role.as_str();
            let parsed: UserRole = s.parse().unwrap();
            assert_eq!(parsed, role);
        }
    }

    #[test]
    fn test_tenant_serialization_roundtrip() {
        let tenant = Tenant {
            id: "t1".to_string(),
            name: "Test Org".to_string(),
            slug: "test-org".to_string(),
            stripe_customer_id: Some("cus_123".to_string()),
            stripe_subscription_status: Some("active".to_string()),
            stripe_price_id: None,
            workos_organization_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&tenant).unwrap();
        let parsed: Tenant = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, tenant.id);
        assert_eq!(parsed.slug, tenant.slug);
        assert_eq!(parsed.stripe_customer_id, tenant.stripe_customer_id);
    }
}
