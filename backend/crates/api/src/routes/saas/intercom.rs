use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Duration, TimeZone, Utc};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::Sha1;
use sha2::Sha256;

use chronicle_auth::types::AuthUser;
use chronicle_core::event::Event as ChronicleEvent;
use chronicle_domain::{Connection, CreateConnectionInput, TenantId};
use chronicle_infra::conversion::build_native_event;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

type HmacSha1 = Hmac<Sha1>;
type HmacSha256 = Hmac<Sha256>;

const INTERCOM_PROVIDER: &str = "intercom";
const INTERCOM_DISPLAY_NAME: &str = "Intercom";
const INTERCOM_DESCRIPTION: &str =
    "Connect Intercom directly via OAuth with Chronicle-managed webhooks.";
const INTERCOM_TRANSPORT: &str = "direct";
const INTERCOM_AUTHORIZE_URL: &str = "https://app.intercom.com/oauth";
const INTERCOM_TOKEN_URL: &str = "https://api.intercom.io/auth/eagle/token";
const INTERCOM_ME_URL: &str = "https://api.intercom.io/me";
const INTERCOM_WEBHOOK_SIGNATURE_HEADER: &str = "x-hub-signature";
const INTERCOM_OAUTH_STATE_MAX_AGE_MINUTES: i64 = 15;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntercomIntegrationResponse {
    pub provider: String,
    pub display_name: String,
    pub description: String,
    pub transport: String,
    pub is_available: bool,
    pub connection: Option<Connection>,
    pub setup_status: String,
    pub workspace_id: Option<String>,
    pub workspace_name: Option<String>,
    pub workspace_region: Option<String>,
    pub connected_at: Option<String>,
    pub last_received_at: Option<String>,
    pub event_count: Option<u64>,
    pub webhook_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntercomAuthorizeResponse {
    pub authorize_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntercomWebhookResponse {
    pub received: bool,
    pub ingested: bool,
    pub duplicate: bool,
    pub event_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntercomCallbackQuery {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct IntercomOAuthState {
    tenant_id: String,
    user_id: String,
    nonce: String,
    issued_at: String,
}

#[derive(Debug, Deserialize)]
struct IntercomTokenResponse {
    access_token: String,
    token_type: Option<String>,
    scope: Option<String>,
}

pub async fn get_integration(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<IntercomIntegrationResponse>> {
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, INTERCOM_PROVIDER)
        .await?;

    Ok(Json(build_integration_response(&state, connection)))
}

pub async fn authorize(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<IntercomAuthorizeResponse>> {
    let client_id =
        state.config.intercom_client_id.as_deref().ok_or_else(|| {
            ApiError::bad_request("Intercom direct integration is not configured")
        })?;
    let state_secret = intercom_state_secret(&state)
        .ok_or_else(|| ApiError::bad_request("Intercom OAuth state secret is not configured"))?;
    let callback_url = intercom_callback_url(&state.config.app_url);
    let oauth_state = encode_oauth_state(
        &IntercomOAuthState {
            tenant_id: user.tenant_id,
            user_id: user.id,
            nonce: cuid2::create_id(),
            issued_at: Utc::now().to_rfc3339(),
        },
        state_secret,
    )?;

    let authorize_url = format!(
        "{}?client_id={}&redirect_uri={}&state={}",
        INTERCOM_AUTHORIZE_URL,
        urlencoding::encode(client_id),
        urlencoding::encode(&callback_url),
        urlencoding::encode(&oauth_state),
    );

    Ok(Json(IntercomAuthorizeResponse { authorize_url }))
}

pub async fn callback(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Query(query): Query<IntercomCallbackQuery>,
) -> ApiResult<Json<IntercomIntegrationResponse>> {
    let client_id =
        state.config.intercom_client_id.as_deref().ok_or_else(|| {
            ApiError::bad_request("Intercom direct integration is not configured")
        })?;
    let client_secret = state
        .config
        .intercom_client_secret
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Intercom direct integration is not configured"))?;
    let state_secret = intercom_state_secret(&state)
        .ok_or_else(|| ApiError::bad_request("Intercom OAuth state secret is not configured"))?;

    let oauth_state = decode_oauth_state(&query.state, state_secret)?;
    ensure_oauth_state_matches_user(&oauth_state, &user)?;

    let token = exchange_code_for_access_token(client_id, client_secret, &query.code).await?;
    let workspace = fetch_workspace_details(&token.access_token).await?;

    let connected_at = Utc::now().to_rfc3339();
    let metadata = serde_json::json!({
        "provider": INTERCOM_PROVIDER,
        "transport": INTERCOM_TRANSPORT,
        "connected_via": "oauth_webhook",
        "workspace_id": workspace.id,
        "workspace_name": workspace.name,
        "workspace_region": workspace.region,
        "connected_at": connected_at,
        "webhook_url": intercom_webhook_url(&state.config.app_url),
        "oauth_token_type": token.token_type,
        "oauth_scope": token.scope,
        "last_error": Value::Null,
    });

    let connection = state
        .connections
        .upsert_by_tenant_provider(
            CreateConnectionInput {
                tenant_id: user.tenant_id,
                provider: INTERCOM_PROVIDER.to_string(),
                access_token: Some(token.access_token),
                refresh_token: None,
                expires_at: None,
                nango_connection_id: Some(workspace.id),
                metadata: Some(metadata),
            },
            "active",
        )
        .await?;

    Ok(Json(build_integration_response(&state, Some(connection))))
}

pub async fn disconnect(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<IntercomIntegrationResponse>> {
    if let Some(connection) = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, INTERCOM_PROVIDER)
        .await?
    {
        state.connections.delete(&connection.id).await?;
    }

    Ok(Json(build_integration_response(&state, None)))
}

pub async fn webhook_head() -> StatusCode {
    StatusCode::OK
}

pub async fn webhook(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    body: String,
) -> ApiResult<Json<IntercomWebhookResponse>> {
    let client_secret = state
        .config
        .intercom_client_secret
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Intercom direct integration is not configured"))?;

    verify_intercom_signature(&headers, &body, client_secret)?;

    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        tracing::warn!(%error, "Invalid Intercom webhook JSON");
        ApiError::bad_request(format!("Invalid JSON: {error}"))
    })?;
    let topic = payload
        .get("topic")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let workspace_id = payload
        .get("app_id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("Missing Intercom workspace id"))?;

    let Some(connection) = state
        .connections
        .find_by_nango_connection_id(workspace_id)
        .await?
        .filter(|connection| connection.provider == INTERCOM_PROVIDER)
    else {
        tracing::warn!(
            workspace_id,
            topic,
            "Received Intercom webhook for workspace without Chronicle connection"
        );
        return Ok(Json(IntercomWebhookResponse {
            received: true,
            ingested: false,
            duplicate: false,
            event_id: None,
            message: "No matching Chronicle Intercom connection for this workspace".to_string(),
        }));
    };

    let (source_event_id, event) =
        normalize_intercom_webhook(&connection.tenant_id, &payload, &body);
    let tenant_id = TenantId::new(connection.tenant_id.clone());
    let duplicate = state
        .event_store
        .exists(&tenant_id, INTERCOM_PROVIDER, &source_event_id)
        .await
        .map_err(|error| {
            tracing::error!(workspace_id, topic, %source_event_id, %error, "Failed to check Intercom duplicate event");
            ApiError::internal()
        })?;

    let mut event_id = None;
    if !duplicate {
        event_id = state
            .event_store
            .insert_events(&[event])
            .await
            .map_err(|error| {
                tracing::error!(workspace_id, topic, %source_event_id, %error, "Failed to store Intercom event");
                ApiError::internal()
            })?
            .into_iter()
            .next()
            .map(|id| id.to_string());
    }

    let metadata = merge_intercom_metadata(
        connection.metadata.clone(),
        serde_json::json!({
            "last_received_at": Utc::now().to_rfc3339(),
            "last_topic": topic,
            "last_source_event_id": source_event_id,
            "last_event_id": event_id,
            "event_count": intercom_event_count(connection.metadata.as_ref()) + if duplicate { 0 } else { 1 },
            "last_error": Value::Null,
        }),
    );
    let _connection = upsert_intercom_metadata(&state, &connection, metadata, "active").await?;

    Ok(Json(IntercomWebhookResponse {
        received: true,
        ingested: !duplicate,
        duplicate,
        event_id,
        message: if duplicate {
            "Duplicate webhook delivery skipped".to_string()
        } else {
            "Webhook ingested".to_string()
        },
    }))
}

fn build_integration_response(
    state: &SaasAppState,
    connection: Option<Connection>,
) -> IntercomIntegrationResponse {
    let is_available =
        state.config.intercom_client_id.is_some() && state.config.intercom_client_secret.is_some();
    let setup_status = if !is_available {
        "unavailable".to_string()
    } else if connection.is_some() {
        "active".to_string()
    } else {
        "not_configured".to_string()
    };

    IntercomIntegrationResponse {
        provider: INTERCOM_PROVIDER.to_string(),
        display_name: INTERCOM_DISPLAY_NAME.to_string(),
        description: INTERCOM_DESCRIPTION.to_string(),
        transport: INTERCOM_TRANSPORT.to_string(),
        is_available,
        workspace_id: intercom_metadata_string(connection.as_ref(), "workspace_id"),
        workspace_name: intercom_metadata_string(connection.as_ref(), "workspace_name"),
        workspace_region: intercom_metadata_string(connection.as_ref(), "workspace_region"),
        connected_at: intercom_metadata_string(connection.as_ref(), "connected_at"),
        last_received_at: intercom_metadata_string(connection.as_ref(), "last_received_at"),
        event_count: connection
            .as_ref()
            .map(|connection| intercom_event_count(connection.metadata.as_ref())),
        webhook_url: intercom_webhook_url(&state.config.app_url),
        connection,
        setup_status,
    }
}

fn intercom_callback_url(app_url: &str) -> String {
    format!(
        "{}/api/integrations/intercom/callback",
        app_url.trim_end_matches('/')
    )
}

fn intercom_webhook_url(app_url: &str) -> String {
    format!("{}/api/webhooks/intercom", app_url.trim_end_matches('/'))
}

fn intercom_state_secret(state: &SaasAppState) -> Option<&str> {
    state
        .config
        .service_secret
        .as_deref()
        .or(state.config.intercom_client_secret.as_deref())
}

fn encode_oauth_state(payload: &IntercomOAuthState, secret: &str) -> ApiResult<String> {
    let serialized = serde_json::to_vec(payload).map_err(|error| {
        tracing::error!(%error, "Failed to serialize Intercom OAuth state");
        ApiError::internal()
    })?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Intercom OAuth state signature");
        ApiError::internal()
    })?;
    mac.update(&serialized);
    Ok(format!(
        "{}.{}",
        hex::encode(serialized),
        hex::encode(mac.finalize().into_bytes())
    ))
}

fn decode_oauth_state(state: &str, secret: &str) -> ApiResult<IntercomOAuthState> {
    let (payload_hex, signature_hex) = state
        .split_once('.')
        .ok_or_else(|| ApiError::bad_request("Invalid Intercom OAuth state"))?;
    let payload = hex::decode(payload_hex)
        .map_err(|_| ApiError::bad_request("Invalid Intercom OAuth state"))?;
    let signature = hex::decode(signature_hex)
        .map_err(|_| ApiError::bad_request("Invalid Intercom OAuth state"))?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Intercom OAuth state verifier");
        ApiError::internal()
    })?;
    mac.update(&payload);
    mac.verify_slice(&signature)
        .map_err(|_| ApiError::bad_request("Invalid Intercom OAuth state"))?;

    serde_json::from_slice(&payload).map_err(|error| {
        tracing::warn!(%error, "Failed to parse Intercom OAuth state");
        ApiError::bad_request("Invalid Intercom OAuth state")
    })
}

fn ensure_oauth_state_matches_user(
    oauth_state: &IntercomOAuthState,
    user: &AuthUser,
) -> ApiResult<()> {
    if oauth_state.tenant_id != user.tenant_id || oauth_state.user_id != user.id {
        return Err(ApiError::forbidden(
            "Intercom OAuth state does not match the current user",
        ));
    }

    let issued_at = DateTime::parse_from_rfc3339(&oauth_state.issued_at)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| ApiError::bad_request("Invalid Intercom OAuth state timestamp"))?;
    if Utc::now().signed_duration_since(issued_at)
        > Duration::minutes(INTERCOM_OAUTH_STATE_MAX_AGE_MINUTES)
    {
        return Err(ApiError::bad_request("Intercom OAuth session expired"));
    }

    Ok(())
}

async fn exchange_code_for_access_token(
    client_id: &str,
    client_secret: &str,
    code: &str,
) -> ApiResult<IntercomTokenResponse> {
    let client = Client::new();
    let response = client
        .post(INTERCOM_TOKEN_URL)
        .json(&serde_json::json!({
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
        }))
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to exchange Intercom OAuth code");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Intercom OAuth token exchange failed");
        return Err(ApiError::bad_request("Intercom authorization failed"));
    }

    response
        .json::<IntercomTokenResponse>()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to parse Intercom OAuth token response");
            ApiError::internal()
        })
}

struct IntercomWorkspace {
    id: String,
    name: String,
    region: Option<String>,
}

async fn fetch_workspace_details(access_token: &str) -> ApiResult<IntercomWorkspace> {
    let client = Client::new();
    let response = client
        .get(INTERCOM_ME_URL)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to fetch Intercom workspace details");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Intercom /me request failed");
        return Err(ApiError::bad_request(
            "Failed to read Intercom workspace details",
        ));
    }

    let payload = response.json::<Value>().await.map_err(|error| {
        tracing::error!(%error, "Failed to parse Intercom /me response");
        ApiError::internal()
    })?;
    let app = payload
        .get("app")
        .and_then(Value::as_object)
        .ok_or_else(|| ApiError::bad_request("Intercom /me response did not include an app"))?;
    let id = app
        .get("id_code")
        .and_then(Value::as_str)
        .or_else(|| payload.get("app_id").and_then(Value::as_str))
        .ok_or_else(|| ApiError::bad_request("Intercom workspace id was missing"))?;
    let name = app
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Intercom workspace");
    let region = app
        .get("region")
        .and_then(Value::as_str)
        .or_else(|| app.get("region_code").and_then(Value::as_str))
        .map(ToString::to_string);

    Ok(IntercomWorkspace {
        id: id.to_string(),
        name: name.to_string(),
        region,
    })
}

fn verify_intercom_signature(
    headers: &HeaderMap,
    body: &str,
    client_secret: &str,
) -> ApiResult<()> {
    let signature_header = headers
        .get(INTERCOM_WEBHOOK_SIGNATURE_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;
    let provided = signature_header
        .strip_prefix("sha1=")
        .unwrap_or(signature_header);

    let signature = hex::decode(provided).map_err(|_| ApiError::unauthorized())?;
    let mut mac = HmacSha1::new_from_slice(client_secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Intercom webhook verifier");
        ApiError::internal()
    })?;
    mac.update(body.as_bytes());
    mac.verify_slice(&signature)
        .map_err(|_| ApiError::unauthorized())
}

fn normalize_intercom_webhook(
    tenant_id: &str,
    payload: &Value,
    raw_body: &str,
) -> (String, ChronicleEvent) {
    let topic = payload
        .get("topic")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let item = payload
        .pointer("/data/item")
        .cloned()
        .unwrap_or(Value::Null);
    let workspace_id = payload
        .get("app_id")
        .and_then(Value::as_str)
        .unwrap_or("unknown-workspace");
    let source_event_id =
        intercom_source_event_id(payload, item.get("id").and_then(Value::as_str), topic);
    let occurred_at =
        intercom_value_to_datetime(payload.get("created_at")).unwrap_or_else(Utc::now);
    let event_type = intercom_event_type(topic);

    let mut entities = Vec::new();
    if let Some(conversation_id) = item.get("id").and_then(Value::as_str) {
        entities.push(("conversation".to_string(), conversation_id.to_string()));
    }
    if let Some(customer_id) = intercom_customer_id(&item) {
        entities.push(("customer".to_string(), customer_id));
    }
    entities.push(("workspace".to_string(), workspace_id.to_string()));

    let selected_part = select_intercom_part(&item, topic);
    let author = selected_part
        .and_then(|part| part.get("author"))
        .or_else(|| item.pointer("/source/author"))
        .or_else(|| item.get("author"));
    let (actor_type, actor_id, actor_name) = intercom_actor(author, &item, topic);
    let body_value = selected_part
        .and_then(|part| part.get("body"))
        .cloned()
        .or_else(|| item.pointer("/source/body").cloned());
    let message_id = selected_part
        .and_then(|part| part.get("id"))
        .and_then(intercom_value_as_string)
        .or_else(|| {
            item.pointer("/source/id")
                .and_then(intercom_value_as_string)
        });

    let payload_value = serde_json::json!({
        "topic": topic,
        "workspace_id": workspace_id,
        "conversation_id": item.get("id").cloned(),
        "message_id": message_id,
        "body": body_value,
        "state": item.get("state").cloned(),
        "open": item.get("open").cloned(),
        "contacts": item.get("contacts").cloned(),
        "source": item.get("source").cloned(),
        "conversation_part": selected_part.cloned(),
        "raw": item,
    });

    (
        source_event_id.clone(),
        build_native_event(
            tenant_id,
            INTERCOM_PROVIDER,
            &event_type,
            occurred_at,
            None,
            payload_value,
            entities,
            Some(raw_body.to_string()),
            Some(serde_json::json!({
                "actor": {
                    "actor_type": actor_type,
                    "actor_id": actor_id,
                    "name": actor_name,
                },
                "provider": INTERCOM_PROVIDER,
                "workspace_id": workspace_id,
                "topic": topic,
            })),
            Some(serde_json::json!({
                "source_event_id": source_event_id,
            })),
        ),
    )
}

fn intercom_source_event_id(payload: &Value, entity_id: Option<&str>, topic: &str) -> String {
    if let Some(webhook_id) = payload.get("id").and_then(Value::as_str) {
        return format!("intercom:{webhook_id}");
    }

    let workspace_id = payload
        .get("app_id")
        .and_then(Value::as_str)
        .unwrap_or("workspace");
    let timestamp = payload
        .get("created_at")
        .and_then(intercom_value_as_string)
        .unwrap_or_else(|| Utc::now().timestamp_millis().to_string());
    let entity_id = entity_id.unwrap_or("event");

    format!("intercom:{workspace_id}:{entity_id}:{topic}:{timestamp}")
}

fn intercom_event_type(topic: &str) -> String {
    match topic {
        "conversation.user.created" => "support.conversation.created".to_string(),
        "conversation.user.replied" => "support.message.customer".to_string(),
        "conversation.admin.replied" => "support.message.agent".to_string(),
        "conversation.admin.noted" => "support.note.internal".to_string(),
        "conversation.admin.closed" => "support.conversation.closed".to_string(),
        "conversation.admin.opened" => "support.conversation.reopened".to_string(),
        "conversation.admin.assigned" => "support.conversation.assigned".to_string(),
        "ping" => "intercom.ping".to_string(),
        _ => format!("intercom.{}", topic.replace('.', "_")),
    }
}

fn select_intercom_part<'a>(item: &'a Value, topic: &str) -> Option<&'a Value> {
    let parts = item
        .pointer("/conversation_parts/conversation_parts")
        .and_then(Value::as_array)?;

    match topic {
        "conversation.user.replied" => parts.iter().rev().find(|part| {
            part.get("author")
                .and_then(|author| author.get("type"))
                .and_then(Value::as_str)
                .is_some_and(|kind| matches!(kind, "user" | "contact" | "lead"))
        }),
        "conversation.admin.replied"
        | "conversation.admin.noted"
        | "conversation.admin.closed"
        | "conversation.admin.opened"
        | "conversation.admin.assigned" => parts.iter().rev().find(|part| {
            part.get("author")
                .and_then(|author| author.get("type"))
                .and_then(Value::as_str)
                .is_some_and(|kind| matches!(kind, "admin" | "teammate"))
        }),
        _ => parts.last(),
    }
}

fn intercom_customer_id(item: &Value) -> Option<String> {
    item.pointer("/contacts/contacts")
        .and_then(Value::as_array)
        .and_then(|contacts| contacts.first())
        .and_then(|contact| contact.get("id"))
        .and_then(intercom_value_as_string)
}

fn intercom_actor(
    author: Option<&Value>,
    item: &Value,
    topic: &str,
) -> (String, String, Option<String>) {
    if let Some(author) = author {
        let author_type = author
            .get("type")
            .or_else(|| author.get("author_type"))
            .and_then(Value::as_str)
            .unwrap_or("system");
        let actor_type = if matches!(author_type, "user" | "contact" | "lead") {
            "customer"
        } else if matches!(author_type, "admin" | "teammate") {
            "agent"
        } else {
            "system"
        };
        let actor_id = author
            .get("id")
            .and_then(intercom_value_as_string)
            .unwrap_or_else(|| INTERCOM_PROVIDER.to_string());
        let actor_name = author
            .get("name")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        return (actor_type.to_string(), actor_id, actor_name);
    }

    if topic == "conversation.admin.assigned" {
        if let Some(assignee) = item.get("assignee") {
            let actor_id = assignee
                .get("id")
                .and_then(intercom_value_as_string)
                .unwrap_or_else(|| "intercom-assignee".to_string());
            let actor_name = assignee
                .get("name")
                .and_then(Value::as_str)
                .map(ToString::to_string);
            return ("agent".to_string(), actor_id, actor_name);
        }
    }

    ("system".to_string(), INTERCOM_PROVIDER.to_string(), None)
}

fn intercom_value_as_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

fn intercom_value_to_datetime(value: Option<&Value>) -> Option<DateTime<Utc>> {
    match value {
        Some(Value::String(value)) => DateTime::parse_from_rfc3339(value)
            .ok()
            .map(|value| value.with_timezone(&Utc)),
        Some(Value::Number(value)) => value.as_i64().and_then(intercom_timestamp_to_datetime),
        _ => None,
    }
}

fn intercom_timestamp_to_datetime(timestamp: i64) -> Option<DateTime<Utc>> {
    let (seconds, nanos) = if timestamp > 1_000_000_000_000 {
        (timestamp / 1_000, ((timestamp % 1_000) * 1_000_000) as u32)
    } else {
        (timestamp, 0)
    };
    Utc.timestamp_opt(seconds, nanos).single()
}

fn merge_intercom_metadata(existing: Option<Value>, patch: Value) -> Value {
    let mut metadata = match existing {
        Some(Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    };

    metadata.insert(
        "provider".to_string(),
        Value::String(INTERCOM_PROVIDER.to_string()),
    );
    metadata.insert(
        "transport".to_string(),
        Value::String(INTERCOM_TRANSPORT.to_string()),
    );
    metadata.insert(
        "connected_via".to_string(),
        Value::String("oauth_webhook".to_string()),
    );

    if let Value::Object(patch) = patch {
        for (key, value) in patch {
            metadata.insert(key, value);
        }
    }

    Value::Object(metadata)
}

async fn upsert_intercom_metadata(
    state: &SaasAppState,
    connection: &Connection,
    metadata: Value,
    status: &str,
) -> ApiResult<Connection> {
    state
        .connections
        .upsert_by_tenant_provider(
            CreateConnectionInput {
                tenant_id: connection.tenant_id.clone(),
                provider: INTERCOM_PROVIDER.to_string(),
                access_token: connection.access_token.clone(),
                refresh_token: connection.refresh_token.clone(),
                expires_at: connection.expires_at,
                nango_connection_id: connection.nango_connection_id.clone(),
                metadata: Some(metadata),
            },
            status,
        )
        .await
        .map_err(Into::into)
}

fn intercom_metadata_string(connection: Option<&Connection>, key: &str) -> Option<String> {
    connection?
        .metadata
        .as_ref()?
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn intercom_event_count(metadata: Option<&Value>) -> u64 {
    metadata
        .and_then(|metadata| metadata.get("event_count"))
        .and_then(Value::as_u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_and_decodes_oauth_state() {
        let payload = IntercomOAuthState {
            tenant_id: "tenant_1".to_string(),
            user_id: "user_1".to_string(),
            nonce: "nonce_1".to_string(),
            issued_at: Utc::now().to_rfc3339(),
        };

        let encoded = encode_oauth_state(&payload, "secret").unwrap();
        let decoded = decode_oauth_state(&encoded, "secret").unwrap();

        assert_eq!(decoded.tenant_id, payload.tenant_id);
        assert_eq!(decoded.user_id, payload.user_id);
        assert_eq!(decoded.nonce, payload.nonce);
    }

    #[test]
    fn rejects_invalid_oauth_state_signature() {
        let payload = IntercomOAuthState {
            tenant_id: "tenant_1".to_string(),
            user_id: "user_1".to_string(),
            nonce: "nonce_1".to_string(),
            issued_at: Utc::now().to_rfc3339(),
        };

        let encoded = encode_oauth_state(&payload, "secret").unwrap();
        assert!(decode_oauth_state(&encoded, "different").is_err());
    }

    #[test]
    fn verifies_valid_intercom_signature() {
        let body = "{\"topic\":\"ping\"}";
        let mut mac = HmacSha1::new_from_slice(b"client-secret").unwrap();
        mac.update(body.as_bytes());
        let signature = format!("sha1={}", hex::encode(mac.finalize().into_bytes()));

        let mut headers = HeaderMap::new();
        headers.insert(
            INTERCOM_WEBHOOK_SIGNATURE_HEADER,
            signature.parse().unwrap(),
        );

        assert!(verify_intercom_signature(&headers, body, "client-secret").is_ok());
    }

    #[test]
    fn normalizes_intercom_reply_webhook() {
        let payload = serde_json::json!({
            "id": "notif_123",
            "app_id": "workspace_1",
            "topic": "conversation.admin.replied",
            "created_at": 1775592000,
            "data": {
                "item": {
                    "id": "conv_123",
                    "contacts": {
                        "contacts": [
                            { "id": "contact_1" }
                        ]
                    },
                    "conversation_parts": {
                        "conversation_parts": [
                            {
                                "id": "part_1",
                                "body": "Hello there",
                                "author": {
                                    "type": "admin",
                                    "id": "admin_1",
                                    "name": "Agent Smith"
                                }
                            }
                        ]
                    }
                }
            }
        });

        let (source_event_id, event) =
            normalize_intercom_webhook("tenant_1", &payload, &payload.to_string());

        assert_eq!(source_event_id, "intercom:notif_123");
        assert_eq!(event.source.as_str(), INTERCOM_PROVIDER);
        assert_eq!(event.event_type.as_str(), "support.message.agent");
        assert!(event
            .entity_refs
            .iter()
            .any(|entity| entity.entity_type.as_str() == "conversation"
                && entity.entity_id.as_str() == "conv_123"));
    }

    #[test]
    fn normalizes_ping_webhook() {
        let payload = serde_json::json!({
            "app_id": "workspace_1",
            "topic": "ping",
            "created_at": "2026-04-10T15:00:00Z",
            "data": { "item": {} }
        });

        let (_source_event_id, event) =
            normalize_intercom_webhook("tenant_1", &payload, &payload.to_string());

        assert_eq!(event.event_type.as_str(), "intercom.ping");
    }
}
