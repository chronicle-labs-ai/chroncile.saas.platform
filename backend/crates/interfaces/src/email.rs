use async_trait::async_trait;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EmailError {
    #[error("validation error: {0}")]
    Validation(String),
    #[error("authentication error: {0}")]
    Auth(String),
    #[error("idempotency conflict: {0}")]
    IdempotencyConflict(String),
    #[error("rate limited")]
    RateLimit,
    #[error("server error: {0}")]
    Server(String),
    #[error("template not configured: {0}")]
    TemplateNotConfigured(String),
    #[error("{0}")]
    Other(String),
}

#[derive(Debug, Clone)]
pub struct EmailTag {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone)]
pub struct TemplateEmailParams {
    pub to: String,
    pub subject: String,
    pub template_key: String,
    pub variables: HashMap<String, String>,
    pub idempotency_key: Option<String>,
    pub tags: Vec<EmailTag>,
}

#[derive(Debug, Clone)]
pub struct HtmlEmailParams {
    pub to: String,
    pub subject: String,
    pub html: String,
    pub idempotency_key: Option<String>,
    pub tags: Vec<EmailTag>,
}

#[async_trait]
pub trait EmailService: Send + Sync {
    async fn send_template_email(&self, params: TemplateEmailParams) -> Result<String, EmailError>;

    /// Send raw HTML (e.g. for trace escalation). Default returns error.
    async fn send_html_email(&self, params: HtmlEmailParams) -> Result<String, EmailError> {
        let _ = params;
        Err(EmailError::Other("send_html_email not supported".to_string()))
    }
}
