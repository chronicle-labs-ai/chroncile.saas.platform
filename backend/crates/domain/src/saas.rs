use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub tenant_id: String,
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

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(Self::Pending),
            "processing" => Some(Self::Processing),
            "completed" => Some(Self::Completed),
            "failed" => Some(Self::Failed),
            "requires_human" => Some(Self::RequiresHuman),
            _ => None,
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
    pub pipedream_auth_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct PipedreamTrigger {
    pub id: String,
    pub tenant_id: String,
    pub connection_id: String,
    pub trigger_id: String,
    pub deployment_id: String,
    pub configured_props: Option<serde_json::Value>,
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
    pub tenant_id: String,
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
    pub pipedream_auth_id: Option<String>,
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
            let parsed = RunStatus::from_str(s).unwrap();
            assert_eq!(parsed, status);
        }
    }

    #[test]
    fn test_run_status_unknown_returns_none() {
        assert!(RunStatus::from_str("unknown").is_none());
    }

    #[test]
    fn test_user_password_not_serialized() {
        let user = User {
            id: "u1".to_string(),
            email: "test@example.com".to_string(),
            name: Some("Test".to_string()),
            password: Some("hashed_secret".to_string()),
            auth_provider: "credentials".to_string(),
            tenant_id: "t1".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&user).unwrap();
        assert!(!json.contains("hashed_secret"));
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
