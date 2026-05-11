//! Error types for web event ingestion.

/// Errors from converting or validating incoming web events.
#[derive(Debug, thiserror::Error)]
pub enum WebError {
    #[error("missing required field: {0}")]
    MissingField(&'static str),

    #[error("invalid value for {field}: {reason}")]
    InvalidValue { field: &'static str, reason: String },

    #[error("invalid JSON: {0}")]
    InvalidJson(#[from] serde_json::Error),
}

impl From<WebError> for chronicle_core::error::ChronicleError {
    fn from(e: WebError) -> Self {
        match e {
            WebError::MissingField(f) => {
                chronicle_core::error::ValidationError::MissingField(f).into()
            }
            WebError::InvalidValue { field, reason } => {
                chronicle_core::error::ValidationError::InvalidValue { field, reason }.into()
            }
            WebError::InvalidJson(e) => {
                chronicle_core::error::ChronicleError::Serialization(e.to_string())
            }
        }
    }
}
