use axum::{http::StatusCode, Json};
use chronicle_interfaces::RepoError;

pub type ApiResult<T> = Result<T, ApiError>;

pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: msg.into(),
        }
    }

    pub fn unauthorized() -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: "Invalid credentials".into(),
        }
    }

    pub fn not_found(resource: &str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: format!("{resource} not found"),
        }
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            message: msg.into(),
        }
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            message: msg.into(),
        }
    }

    pub fn internal() -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "Something went wrong. Please try again.".into(),
        }
    }
}

impl From<RepoError> for ApiError {
    fn from(err: RepoError) -> Self {
        match &err {
            RepoError::NotFound(detail) => {
                tracing::warn!("Resource not found: {detail}");
                Self::not_found("Resource")
            }
            RepoError::AlreadyExists(detail) => {
                tracing::warn!("Duplicate: {detail}");
                if detail.contains("email") {
                    Self::conflict("An account with this email already exists")
                } else if detail.contains("slug") || detail.contains("Tenant") {
                    Self::conflict("An organization with this name already exists. Please choose a different name.")
                } else if detail.contains("invocation") {
                    Self::conflict("This operation has already been processed")
                } else if detail.contains("provider") {
                    Self::conflict("A connection for this provider already exists")
                } else if detail.contains("deployment") {
                    Self::conflict("This trigger deployment already exists")
                } else {
                    Self::conflict("This resource already exists")
                }
            }
            RepoError::Internal(detail) => {
                tracing::error!("Internal error: {detail}");
                Self::internal()
            }
        }
    }
}

impl From<chronicle_auth::error::AuthError> for ApiError {
    fn from(err: chronicle_auth::error::AuthError) -> Self {
        match &err {
            chronicle_auth::error::AuthError::InvalidCredentials => Self::unauthorized(),
            chronicle_auth::error::AuthError::TokenExpired => Self {
                status: StatusCode::UNAUTHORIZED,
                message: "Session expired. Please sign in again.".into(),
            },
            chronicle_auth::error::AuthError::InvalidToken(_) => Self {
                status: StatusCode::UNAUTHORIZED,
                message: "Invalid session. Please sign in again.".into(),
            },
            chronicle_auth::error::AuthError::MissingAuth => Self {
                status: StatusCode::UNAUTHORIZED,
                message: "Authentication required".into(),
            },
            chronicle_auth::error::AuthError::Internal(detail) => {
                tracing::error!("Auth internal error: {detail}");
                Self::internal()
            }
        }
    }
}

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let body = serde_json::json!({ "error": self.message });
        (self.status, Json(body)).into_response()
    }
}
