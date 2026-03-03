use async_trait::async_trait;
use chronicle_interfaces::email::{
    EmailError, EmailService, EmailTag, HtmlEmailParams, TemplateEmailParams,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

const RESEND_API_URL: &str = "https://api.resend.com/emails";
const MAX_RETRIES: u32 = 3;
const DEFAULT_FROM: &str = "Chronicle Labs <noreply@notify.chronicle-labs.com>";

#[derive(Serialize)]
struct ResendSendRequest {
    from: String,
    to: Vec<String>,
    subject: String,
    template: ResendTemplate,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tags: Vec<ResendTag>,
}

#[derive(Serialize)]
struct ResendHtmlSendRequest {
    from: String,
    to: Vec<String>,
    subject: String,
    html: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tags: Vec<ResendTag>,
}

#[derive(Serialize)]
struct ResendTemplate {
    id: String,
    variables: HashMap<String, String>,
}

#[derive(Serialize)]
struct ResendTag {
    name: String,
    value: String,
}

#[derive(Deserialize)]
struct ResendSendResponse {
    id: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct ResendErrorResponse {
    message: Option<String>,
    name: Option<String>,
}

pub struct ResendEmailService {
    client: Client,
    api_key: String,
    from_address: String,
    template_map: HashMap<String, String>,
}

impl ResendEmailService {
    pub fn new(api_key: String, from_address: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
            from_address: from_address.unwrap_or_else(|| DEFAULT_FROM.to_string()),
            template_map: HashMap::new(),
        }
    }

    pub fn with_template_map(mut self, map: HashMap<String, String>) -> Self {
        self.template_map = map;
        self
    }

    fn resolve_template_id(&self, key: &str) -> Result<String, EmailError> {
        self.template_map
            .get(key)
            .cloned()
            .ok_or_else(|| EmailError::TemplateNotConfigured(key.to_string()))
    }

    async fn send_with_retry(&self, params: &TemplateEmailParams) -> Result<String, EmailError> {
        let template_id = self.resolve_template_id(&params.template_key)?;

        let tags: Vec<ResendTag> = params
            .tags
            .iter()
            .map(|t| ResendTag {
                name: t.name.clone(),
                value: t.value.clone(),
            })
            .collect();

        let body = ResendSendRequest {
            from: self.from_address.clone(),
            to: vec![params.to.clone()],
            subject: params.subject.clone(),
            template: ResendTemplate {
                id: template_id,
                variables: params.variables.clone(),
            },
            tags,
        };

        let mut last_error = EmailError::Other("no attempts made".to_string());

        for attempt in 0..=MAX_RETRIES {
            let mut request = self
                .client
                .post(RESEND_API_URL)
                .bearer_auth(&self.api_key)
                .json(&body);

            if let Some(key) = &params.idempotency_key {
                request = request.header("Idempotency-Key", key.as_str());
            }

            let response = match request.send().await {
                Ok(r) => r,
                Err(e) => {
                    last_error = EmailError::Other(format!("request failed: {e}"));
                    if attempt < MAX_RETRIES {
                        let delay = std::time::Duration::from_secs(1 << attempt);
                        warn!(attempt, ?delay, "Resend request failed, retrying");
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    break;
                }
            };

            let status = response.status().as_u16();

            if status == 200 || status == 201 {
                let data: ResendSendResponse = response
                    .json()
                    .await
                    .map_err(|e| EmailError::Other(format!("failed to parse response: {e}")))?;
                return Ok(data.id);
            }

            let error_body =
                response
                    .json::<ResendErrorResponse>()
                    .await
                    .unwrap_or(ResendErrorResponse {
                        message: Some("unknown error".to_string()),
                        name: None,
                    });
            let msg = error_body
                .message
                .unwrap_or_else(|| "unknown error".to_string());

            last_error = match status {
                400 | 422 => return Err(EmailError::Validation(msg)),
                401 | 403 => return Err(EmailError::Auth(msg)),
                409 => return Err(EmailError::IdempotencyConflict(msg)),
                429 => EmailError::RateLimit,
                500..=599 => EmailError::Server(msg),
                _ => {
                    return Err(EmailError::Other(format!(
                        "unexpected status {status}: {msg}"
                    )))
                }
            };

            if attempt < MAX_RETRIES && matches!(status, 429 | 500..=599) {
                let delay = std::time::Duration::from_secs(1 << attempt);
                warn!(
                    attempt,
                    status,
                    ?delay,
                    "Resend returned retryable error, retrying"
                );
                tokio::time::sleep(delay).await;
                continue;
            }

            break;
        }

        Err(last_error)
    }

    pub async fn send_html(&self, params: &HtmlEmailParams) -> Result<String, EmailError> {
        let tags: Vec<ResendTag> = params
            .tags
            .iter()
            .map(|t| ResendTag {
                name: t.name.clone(),
                value: t.value.clone(),
            })
            .collect();
        let body = ResendHtmlSendRequest {
            from: self.from_address.clone(),
            to: vec![params.to.clone()],
            subject: params.subject.clone(),
            html: params.html.clone(),
            tags,
        };
        let mut request = self
            .client
            .post(RESEND_API_URL)
            .bearer_auth(&self.api_key)
            .json(&body);
        if let Some(key) = &params.idempotency_key {
            request = request.header("Idempotency-Key", key.as_str());
        }
        let response = request
            .send()
            .await
            .map_err(|e| EmailError::Other(format!("request failed: {e}")))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(EmailError::Server(format!("{} {}", status, text)));
        }
        let res: ResendSendResponse = response
            .json()
            .await
            .map_err(|e| EmailError::Other(format!("parse response: {e}")))?;
        Ok(res.id)
    }
}

#[async_trait]
impl EmailService for ResendEmailService {
    async fn send_template_email(&self, params: TemplateEmailParams) -> Result<String, EmailError> {
        self.send_with_retry(&params).await
    }

    async fn send_html_email(&self, params: HtmlEmailParams) -> Result<String, EmailError> {
        self.send_html(&params).await
    }
}

pub struct NoopEmailService;

#[async_trait]
impl EmailService for NoopEmailService {
    async fn send_template_email(&self, params: TemplateEmailParams) -> Result<String, EmailError> {
        info!(
            to = %params.to,
            template_key = %params.template_key,
            idempotency_key = ?params.idempotency_key,
            variables = ?params.variables,
            "NoopEmailService: would send template email"
        );
        Ok(format!("noop-{}", chrono::Utc::now().timestamp_millis()))
    }

    async fn send_html_email(&self, params: HtmlEmailParams) -> Result<String, EmailError> {
        info!(
            to = %params.to,
            subject = %params.subject,
            "NoopEmailService: would send html email"
        );
        Ok(format!("noop-{}", chrono::Utc::now().timestamp_millis()))
    }
}

pub fn build_email_service(template_map: HashMap<String, String>) -> Box<dyn EmailService> {
    match std::env::var("RESEND_API_KEY") {
        Ok(api_key) if !api_key.is_empty() => {
            let from = std::env::var("RESEND_FROM_ADDRESS").ok();
            info!("Resend email service configured");
            Box::new(ResendEmailService::new(api_key, from).with_template_map(template_map))
        }
        _ => {
            info!("RESEND_API_KEY not set, using NoopEmailService");
            Box::new(NoopEmailService)
        }
    }
}

pub fn email_tags(pairs: &[(&str, &str)]) -> Vec<EmailTag> {
    pairs
        .iter()
        .map(|(name, value)| EmailTag {
            name: name.to_string(),
            value: value.to_string(),
        })
        .collect()
}
