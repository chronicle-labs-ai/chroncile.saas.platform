//! Mock OAuth Connection
//!
//! Simulates OAuth connections to external services for demo/testing.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use chronicle_domain::{new_connection_id, TenantId};

/// Supported mock services
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MockService {
    /// Zendesk-like support system
    MockZendesk,
    /// Slack-like messaging
    MockSlack,
    /// Intercom-like chat
    MockIntercom,
    /// Custom/internal service
    Custom(String),
}

impl MockService {
    pub fn as_str(&self) -> &str {
        match self {
            Self::MockZendesk => "mock-zendesk",
            Self::MockSlack => "mock-slack",
            Self::MockIntercom => "mock-intercom",
            Self::Custom(name) => name,
        }
    }
}

impl std::fmt::Display for MockService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Connection status
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionStatus {
    Active,
    Inactive,
    Error(String),
}

/// Mock OAuth connection representing a connection to an external service
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MockOAuthConnection {
    /// Unique connection ID
    pub connection_id: String,
    /// Tenant this connection belongs to
    pub tenant_id: TenantId,
    /// Service being connected to
    pub service: MockService,
    /// Display name for the connection
    pub name: String,
    /// Simulated access token
    pub access_token: String,
    /// Simulated refresh token
    pub refresh_token: Option<String>,
    /// When the connection was created
    pub connected_at: DateTime<Utc>,
    /// When the token expires (simulated)
    pub expires_at: Option<DateTime<Utc>>,
    /// Current status
    pub status: ConnectionStatus,
    /// Additional metadata
    #[serde(default)]
    pub metadata: serde_json::Value,
}

impl MockOAuthConnection {
    /// Create a new mock connection
    pub fn new(tenant_id: impl Into<TenantId>, service: MockService) -> Self {
        let connection_id = new_connection_id();
        let now = Utc::now();

        Self {
            connection_id: connection_id.clone(),
            tenant_id: tenant_id.into(),
            service: service.clone(),
            name: format!("{} Connection", service.as_str()),
            access_token: format!("mock_token_{}", connection_id),
            refresh_token: Some(format!("mock_refresh_{}", connection_id)),
            connected_at: now,
            expires_at: Some(now + chrono::Duration::hours(24)),
            status: ConnectionStatus::Active,
            metadata: serde_json::json!({}),
        }
    }

    /// Set a custom name
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = name.into();
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = metadata;
        self
    }

    /// Check if the connection is active
    pub fn is_active(&self) -> bool {
        matches!(self.status, ConnectionStatus::Active)
    }

    /// Check if token is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }

    /// Refresh the token (simulated)
    pub fn refresh(&mut self) {
        let now = Utc::now();
        self.access_token = format!("mock_token_refreshed_{}", now.timestamp());
        self.expires_at = Some(now + chrono::Duration::hours(24));
        self.status = ConnectionStatus::Active;
    }

    /// Disconnect
    pub fn disconnect(&mut self) {
        self.status = ConnectionStatus::Inactive;
    }
}

/// Request to create a new connection
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateConnectionRequest {
    pub tenant_id: String,
    pub service: MockService,
    pub name: Option<String>,
}

/// Response after creating a connection
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectionResponse {
    pub connection_id: String,
    pub tenant_id: String,
    pub service: String,
    pub name: String,
    pub status: ConnectionStatus,
    pub connected_at: DateTime<Utc>,
}

impl From<MockOAuthConnection> for ConnectionResponse {
    fn from(conn: MockOAuthConnection) -> Self {
        Self {
            connection_id: conn.connection_id,
            tenant_id: conn.tenant_id.to_string(),
            service: conn.service.to_string(),
            name: conn.name,
            status: conn.status,
            connected_at: conn.connected_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_creation() {
        let conn = MockOAuthConnection::new("tenant_1", MockService::MockZendesk);

        assert!(conn.connection_id.starts_with("conn_"));
        assert!(conn.is_active());
        assert!(!conn.is_expired());
    }

    #[test]
    fn test_connection_with_name() {
        let conn =
            MockOAuthConnection::new("tenant_1", MockService::MockSlack).with_name("My Slack");

        assert_eq!(conn.name, "My Slack");
    }

    #[test]
    fn test_disconnect() {
        let mut conn = MockOAuthConnection::new("tenant_1", MockService::MockZendesk);
        assert!(conn.is_active());

        conn.disconnect();
        assert!(!conn.is_active());
    }

    #[test]
    fn test_service_display() {
        assert_eq!(MockService::MockZendesk.as_str(), "mock-zendesk");
        assert_eq!(MockService::Custom("my-service".into()).as_str(), "my-service");
    }
}
