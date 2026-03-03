use axum::{
    extract::{Path, State},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use chronicle_auth::types::AuthUser;
use chronicle_interfaces::email::{EmailTag, HtmlEmailParams};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

use super::error::{ApiError, ApiResult};
use crate::escalation::EscalationEntry;
use crate::saas_state::SaasAppState;

const DUPLICATE_WINDOW_SECS: u64 = 60 * 60; // 1 hour

type HmacSha256 = Hmac<Sha256>;

fn next_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let n = SEQ.fetch_add(1, Ordering::Relaxed);
    format!("esc_{}_{}", std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis(), n)
}

fn find_duplicate<'a>(
    log: &'a [EscalationEntry],
    tenant_id: &str,
    trace_id: &str,
    to_user_id: &str,
    channel: &str,
) -> Option<&'a EscalationEntry> {
    let cutoff = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .saturating_sub(DUPLICATE_WINDOW_SECS);
    log.iter().find(|e| {
        e.tenant_id == tenant_id
            && e.trace_id == trace_id
            && e.to_user_id == to_user_id
            && e.channel == channel
            && (e.status == "sent" || e.status == "claimed")
            && e.created_at.parse::<u64>().unwrap_or(0) >= cutoff
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotifyRequest {
    pub member_id: String,
    pub trace_id: String,
    pub channel: String,
    pub message: Option<String>,
    pub to_email: Option<String>,
    pub subject: Option<String>,
    pub html_content: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotifyResponse {
    pub success: bool,
    pub escalation_id: String,
    pub channel: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub already_sent: Option<bool>,
}

pub async fn notify(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(req): Json<NotifyRequest>,
) -> ApiResult<Json<NotifyResponse>> {
    if req.member_id.is_empty() || req.trace_id.is_empty() || req.channel.is_empty() {
        return Err(ApiError::bad_request("memberId, traceId, and channel are required"));
    }

    let channel_log = match req.channel.as_str() {
        "email" => "email",
        "slack" => "slack_dm",
        _ => return Err(ApiError::bad_request("channel must be 'slack' or 'email'")),
    };

    let log_guard = state.escalation_log.read().await;
    if let Some(dup) = find_duplicate(
        &log_guard,
        &user.tenant_id,
        &req.trace_id,
        &req.member_id,
        channel_log,
    ) {
        return Ok(Json(NotifyResponse {
            success: true,
            already_sent: Some(true),
            escalation_id: dup.id.clone(),
            channel: req.channel,
        }));
    }
    drop(log_guard);

    if channel_log == "email" {
        let to_email = req.to_email.as_deref().ok_or_else(|| {
            ApiError::bad_request("toEmail is required when channel is email")
        })?;
        let subject = req.subject.as_deref().unwrap_or("Trace requires review");
        let html = req.html_content.as_deref().ok_or_else(|| {
            ApiError::bad_request("htmlContent is required when channel is email")
        })?;

        let id = next_id();
        let now = std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs().to_string();

        let message_id = state.email.send_html_email(HtmlEmailParams {
            to: to_email.to_string(),
            subject: subject.to_string(),
            html: html.to_string(),
            idempotency_key: Some(format!("escalation/{}", id)),
            tags: vec![
                EmailTag { name: "type".into(), value: "trace_escalation".into() },
                EmailTag { name: "trace_id".into(), value: req.trace_id.clone() },
                EmailTag { name: "escalation_id".into(), value: id.clone() },
            ],
        }).await.ok();

        let mut log_guard = state.escalation_log.write().await;
        log_guard.push(EscalationEntry {
            id: id.clone(),
            tenant_id: user.tenant_id.clone(),
            trace_id: req.trace_id.clone(),
            to_user_id: req.member_id.clone(),
            channel: "email".to_string(),
            status: "sent".to_string(),
            created_at: now,
            email_message_id: message_id.clone(),
            email_to: Some(to_email.to_string()),
        });

        return Ok(Json(NotifyResponse {
            success: true,
            escalation_id: id,
            channel: "email".to_string(),
            already_sent: None,
        }));
    }

    let id = next_id();
    let now = std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs().to_string();
    let mut log_guard = state.escalation_log.write().await;
    log_guard.push(EscalationEntry {
        id: id.clone(),
        tenant_id: user.tenant_id.clone(),
        trace_id: req.trace_id.clone(),
        to_user_id: req.member_id.clone(),
        channel: "slack_dm".to_string(),
        status: "sent".to_string(),
        created_at: now,
        email_message_id: None,
        email_to: None,
    });

    Ok(Json(NotifyResponse {
        success: true,
        escalation_id: id,
        channel: "slack".to_string(),
        already_sent: None,
    }))
}

fn get_signing_key() -> Result<Vec<u8>, ApiError> {
    use base64::Engine;
    let key = std::env::var("ENCRYPTION_KEY").or_else(|_| std::env::var("EMAIL_ACTION_SECRET"))
        .map_err(|_| ApiError::internal())?;
    if key.len() == 64 {
        hex::decode(&key).map_err(|_| ApiError::internal())
    } else if key.len() == 44 {
        base64::engine::general_purpose::STANDARD
            .decode(&key)
            .or_else(|_| base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(&key))
            .map_err(|_| ApiError::internal())
    } else {
        Err(ApiError::internal())
    }
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionPayload {
    action: String,
    trace_id: String,
    escalation_id: String,
    to_user_id: String,
    exp: u64,
}

fn verify_token(token: &str) -> Result<ActionPayload, ApiError> {
    use base64::Engine;
    let (payload_b64, sig) = token.split_once('.').ok_or_else(ApiError::unauthorized)?;
    let key = get_signing_key()?;
    let mut mac = HmacSha256::new_from_slice(&key).map_err(|_| ApiError::internal())?;
    mac.update(payload_b64.as_bytes());
    let expected = mac.finalize().into_bytes();
    let sig_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(sig)
        .map_err(|_| ApiError::unauthorized())?;
    if sig_bytes != expected.as_slice() {
        return Err(ApiError::unauthorized());
    }
    let payload_json = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| ApiError::unauthorized())?;
    let payload: ActionPayload = serde_json::from_slice(&payload_json).map_err(|_| ApiError::unauthorized())?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    if payload.exp < now {
        return Err(ApiError::unauthorized());
    }
    Ok(payload)
}

pub async fn email_action(
    Path(token): Path<String>,
    State(state): State<SaasAppState>,
) -> Result<Response, ApiError> {
    let base_url = std::env::var("NEXT_PUBLIC_APP_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

    let payload = match verify_token(&token) {
        Ok(p) => p,
        Err(_) => {
            return Ok(Redirect::temporary(&format!("{}/dashboard/labeling?error=invalid_or_expired_link", base_url)).into_response());
        }
    };

    let trace_url = format!("{}/dashboard/labeling/{}", base_url, payload.trace_id);

    match payload.action.as_str() {
        "view" => Ok(Redirect::temporary(&trace_url).into_response()),
        "claim" => {
            let mut log_guard = state.escalation_log.write().await;
            if let Some(e) = log_guard.iter_mut().find(|e| e.id == payload.escalation_id) {
                e.status = "claimed".to_string();
            }
            Ok(Redirect::temporary(&format!("{}?claimed=1", trace_url)).into_response())
        }
        "escalate" => {
            // For now just redirect; manager email could be sent from backend with more context
            Ok(Redirect::temporary(&format!("{}?escalated=1", trace_url)).into_response())
        }
        _ => Ok(Redirect::temporary(&trace_url).into_response()),
    }
}
