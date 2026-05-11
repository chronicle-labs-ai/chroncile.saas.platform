//! Shared error-to-HTTP-response conversion.
//!
//! Converts [`ChronicleError`] into appropriate HTTP status codes
//! and JSON error bodies. DRY: all handlers use this, none does
//! its own error formatting.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chronicle_core::error::{ChronicleError, StoreError};

/// Wrapper that implements `IntoResponse` for `ChronicleError`.
pub struct ApiError {
    error: ChronicleError,
    status_override: Option<StatusCode>,
}

impl ApiError {
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            error: ChronicleError::External(message.into()),
            status_override: Some(StatusCode::UNAUTHORIZED),
        }
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self {
            error: ChronicleError::External(message.into()),
            status_override: Some(StatusCode::FORBIDDEN),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (default_status, message) = match &self.error {
            ChronicleError::Store(StoreError::NotFound { entity, id }) => {
                (StatusCode::NOT_FOUND, format!("{entity} not found: {id}"))
            }
            ChronicleError::Store(StoreError::Duplicate { entity, id }) => (
                StatusCode::CONFLICT,
                format!("{entity} already exists: {id}"),
            ),
            ChronicleError::Validation(e) => (StatusCode::BAD_REQUEST, e.to_string()),
            ChronicleError::Store(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            ChronicleError::Serialization(e) => (StatusCode::BAD_REQUEST, e.clone()),
            ChronicleError::External(e) => (StatusCode::BAD_GATEWAY, e.clone()),
        };
        let status = self.status_override.unwrap_or(default_status);

        let body = serde_json::json!({
            "error": message,
            "status": status.as_u16(),
        });

        (status, Json(body)).into_response()
    }
}

impl From<ChronicleError> for ApiError {
    fn from(e: ChronicleError) -> Self {
        Self {
            error: e,
            status_override: None,
        }
    }
}
