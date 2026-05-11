use axum::{extract::State, Json};

use chronicle_auth::types::AuthUser;
use chronicle_domain::{SandboxAiChatRequest, SandboxAiChatResponse};
use chronicle_interfaces::SandboxAiConfigError;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

pub async fn chat_graph(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<SandboxAiChatRequest>,
) -> ApiResult<Json<SandboxAiChatResponse>> {
    let service = state
        .sandbox_ai
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Sandbox AI service is not configured"))?;

    service
        .generate_graph_edits(&user.tenant_id, input)
        .await
        .map(Json)
        .map_err(map_sandbox_ai_error)
}

fn map_sandbox_ai_error(error: SandboxAiConfigError) -> ApiError {
    match error {
        SandboxAiConfigError::NotConfigured => {
            ApiError::bad_request("Sandbox AI service is not configured")
        }
        SandboxAiConfigError::Validation(message) => ApiError::bad_request(message),
        SandboxAiConfigError::Upstream(detail)
        | SandboxAiConfigError::InvalidResponse(detail)
        | SandboxAiConfigError::Internal(detail) => {
            tracing::error!(error = %detail, "Sandbox AI request failed");
            ApiError::internal()
        }
    }
}
