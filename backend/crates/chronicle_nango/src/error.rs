pub type Result<T> = std::result::Result<T, NangoError>;

#[derive(Debug, thiserror::Error)]
pub enum NangoError {
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("unauthorized")]
    Unauthorized,
    #[error("not found")]
    NotFound,
    #[error("api error ({status}): {message}")]
    ApiError { status: u16, message: String },
    #[error("deserialize error: {0}")]
    Deserialize(String),
}
