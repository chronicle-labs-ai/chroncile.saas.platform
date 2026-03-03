//! API Error Handling
//!
//! Provides consistent error responses for the HTTP API.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

/// API error types
#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Stream error: {0}")]
    Stream(String),

    #[error("Store error: {0}")]
    Store(String),
}

/// Error response body
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match &self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, "not_found", msg.clone()),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "bad_request", msg.clone()),
            ApiError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "unauthorized", msg.clone()),
            ApiError::Validation(msg) => {
                (StatusCode::UNPROCESSABLE_ENTITY, "validation_error", msg.clone())
            }
            ApiError::Stream(msg) => {
                tracing::error!(error = %msg, "stream_error");
                (StatusCode::INTERNAL_SERVER_ERROR, "stream_error", msg.clone())
            }
            ApiError::Store(msg) => {
                tracing::error!(error = %msg, "store_error");
                (StatusCode::INTERNAL_SERVER_ERROR, "store_error", msg.clone())
            }
            ApiError::Internal(msg) => {
                tracing::error!(error = %msg, "internal_error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", msg.clone())
            }
        };

        let body = ErrorResponse {
            error: error_type.to_string(),
            message,
            details: None,
        };

        (status, Json(body)).into_response()
    }
}

impl From<chronicle_domain::StreamError> for ApiError {
    fn from(err: chronicle_domain::StreamError) -> Self {
        ApiError::Stream(err.to_string())
    }
}

impl From<chronicle_domain::StoreError> for ApiError {
    fn from(err: chronicle_domain::StoreError) -> Self {
        ApiError::Store(err.to_string())
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::BadRequest(format!("JSON error: {}", err))
    }
}

/// Result type for API handlers
pub type ApiResult<T> = Result<T, ApiError>;
