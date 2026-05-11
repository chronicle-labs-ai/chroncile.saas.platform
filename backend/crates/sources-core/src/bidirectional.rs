//! Bidirectional Source
//!
//! Trait for sources that support both reading and writing.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::context::IngestContext;
use crate::error::SourceError;

/// Action to perform on the source system
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceAction {
    /// Action type (e.g., "create_ticket", "send_message", "update_status")
    pub action_type: String,
    /// Target entity ID (if applicable)
    pub entity_id: Option<String>,
    /// Action payload
    pub payload: serde_json::Value,
}

/// Result of performing an action
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActionResult {
    /// Whether the action succeeded
    pub success: bool,
    /// ID of the created/updated entity
    pub entity_id: Option<String>,
    /// Response data from the source
    pub data: Option<serde_json::Value>,
    /// Error message if failed
    pub error: Option<String>,
}

/// Entity from the source system
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceEntity {
    /// Entity type (e.g., "conversation", "ticket", "user")
    pub entity_type: String,
    /// Entity ID in the source system
    pub entity_id: String,
    /// Entity data
    pub data: serde_json::Value,
}

/// Trait for bidirectional source integrations
///
/// Implement this trait for sources that support both reading events
/// and performing actions (creating/updating entities).
#[async_trait]
pub trait BidirectionalSource: Send + Sync {
    /// Perform an action on the source system
    ///
    /// E.g., create a ticket, send a message, update status
    async fn perform_action(
        &self,
        action: &SourceAction,
        context: &IngestContext,
    ) -> Result<ActionResult, SourceError>;

    /// Fetch a specific entity from the source
    async fn fetch_entity(
        &self,
        entity_type: &str,
        entity_id: &str,
        context: &IngestContext,
    ) -> Result<SourceEntity, SourceError>;

    /// List supported action types
    fn supported_actions(&self) -> &[&str];

    /// List supported entity types for fetching
    fn supported_entity_types(&self) -> &[&str];

    /// Check if an action type is supported
    fn supports_action(&self, action_type: &str) -> bool {
        self.supported_actions().contains(&action_type)
    }
}
