use async_trait::async_trait;
use thiserror::Error;

use chronicle_domain::{SandboxAiChatRequest, SandboxAiChatResponse};

#[derive(Debug, Error)]
pub enum SandboxAiConfigError {
    #[error("sandbox ai is not configured")]
    NotConfigured,
    #[error("sandbox ai validation failed: {0}")]
    Validation(String),
    #[error("sandbox ai upstream request failed: {0}")]
    Upstream(String),
    #[error("sandbox ai returned an invalid response: {0}")]
    InvalidResponse(String),
    #[error("sandbox ai internal error: {0}")]
    Internal(String),
}

#[async_trait]
pub trait SandboxAiConfigService: Send + Sync {
    async fn generate_graph_edits(
        &self,
        tenant_id: &str,
        request: SandboxAiChatRequest,
    ) -> Result<SandboxAiChatResponse, SandboxAiConfigError>;
}
