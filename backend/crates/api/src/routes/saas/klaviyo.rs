use axum::{
    extract::{Query, State},
    http::HeaderMap,
    Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{DateTime, Duration, TimeZone, Utc};
use hmac::{Hmac, Mac};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use chronicle_auth::types::AuthUser;
use chronicle_core::event::Event as ChronicleEvent;
use chronicle_domain::{Connection, CreateConnectionInput, TenantId};
use chronicle_infra::conversion::build_native_event;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

type HmacSha256 = Hmac<Sha256>;

const KLAVIYO_PROVIDER: &str = "klaviyo";
const KLAVIYO_DISPLAY_NAME: &str = "Klaviyo";
const KLAVIYO_DESCRIPTION: &str =
    "Connect Klaviyo directly via OAuth with Chronicle-managed system webhooks.";
const KLAVIYO_TRANSPORT: &str = "direct";
const KLAVIYO_AUTHORIZE_URL: &str = "https://www.klaviyo.com/oauth/authorize";
const KLAVIYO_TOKEN_URL: &str = "https://a.klaviyo.com/oauth/token";
const KLAVIYO_ACCOUNTS_URL: &str = "https://a.klaviyo.com/api/accounts/";
const KLAVIYO_WEBHOOKS_URL: &str = "https://a.klaviyo.com/api/webhooks/";
const KLAVIYO_WEBHOOK_TOPICS_URL: &str = "https://a.klaviyo.com/api/webhook-topics/";
const KLAVIYO_API_REVISION: &str = "2025-04-15";
const KLAVIYO_OAUTH_SCOPES: &str = "accounts:read events:read webhooks:read webhooks:write";
const KLAVIYO_OAUTH_STATE_MAX_AGE_MINUTES: i64 = 15;
const KLAVIYO_SIGNATURE_HEADER: &str = "klaviyo-signature";
const KLAVIYO_TIMESTAMP_HEADER: &str = "klaviyo-timestamp";
const KLAVIYO_WEBHOOK_ID_HEADER: &str = "klaviyo-webhook-id";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KlaviyoIntegrationResponse {
    pub provider: String,
    pub display_name: String,
    pub description: String,
    pub transport: String,
    pub is_available: bool,
    pub connection: Option<Connection>,
    pub setup_status: String,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub connected_at: Option<String>,
    pub last_received_at: Option<String>,
    pub subscribed_topic_count: Option<u64>,
    pub event_count: Option<u64>,
    pub webhook_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KlaviyoAuthorizeResponse {
    pub authorize_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KlaviyoWebhookResponse {
    pub received: bool,
    pub ingested_count: u64,
    pub duplicate_count: u64,
    pub event_ids: Vec<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KlaviyoCallbackQuery {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct KlaviyoOAuthState {
    tenant_id: String,
    user_id: String,
    nonce: String,
    issued_at: String,
    code_verifier: String,
}

#[derive(Debug, Deserialize)]
struct KlaviyoTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    expires_in: Option<i64>,
}

struct KlaviyoAccount {
    id: String,
    name: Option<String>,
}

struct KlaviyoWebhookUpsertResult {
    webhook_id: String,
    topic_count: u64,
}

struct KlaviyoNormalizedEvent {
    source_event_id: String,
    external_id: String,
    topic: String,
    event: ChronicleEvent,
}

pub async fn get_integration(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<KlaviyoIntegrationResponse>> {
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, KLAVIYO_PROVIDER)
        .await?;

    Ok(Json(build_integration_response(&state, connection)))
}

pub async fn authorize(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<KlaviyoAuthorizeResponse>> {
    let client_id = state
        .config
        .klaviyo_client_id
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Klaviyo direct integration is not configured"))?;
    let state_secret = klaviyo_state_secret(&state)
        .ok_or_else(|| ApiError::bad_request("Klaviyo OAuth state secret is not configured"))?;
    let callback_url = klaviyo_callback_url(&state.config.app_url);
    let code_verifier = generate_code_verifier();
    let code_challenge = code_challenge(&code_verifier);
    let oauth_state = encode_oauth_state(
        &KlaviyoOAuthState {
            tenant_id: user.tenant_id,
            user_id: user.id,
            nonce: cuid2::create_id(),
            issued_at: Utc::now().to_rfc3339(),
            code_verifier,
        },
        state_secret,
    )?;

    let authorize_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge_method=S256&code_challenge={}",
        KLAVIYO_AUTHORIZE_URL,
        urlencoding::encode(client_id),
        urlencoding::encode(&callback_url),
        urlencoding::encode(KLAVIYO_OAUTH_SCOPES),
        urlencoding::encode(&oauth_state),
        urlencoding::encode(&code_challenge),
    );

    Ok(Json(KlaviyoAuthorizeResponse { authorize_url }))
}

pub async fn callback(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Query(query): Query<KlaviyoCallbackQuery>,
) -> ApiResult<Json<KlaviyoIntegrationResponse>> {
    let client_id = state
        .config
        .klaviyo_client_id
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Klaviyo direct integration is not configured"))?;
    let client_secret = state
        .config
        .klaviyo_client_secret
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Klaviyo direct integration is not configured"))?;
    let state_secret = klaviyo_state_secret(&state)
        .ok_or_else(|| ApiError::bad_request("Klaviyo OAuth state secret is not configured"))?;
    let callback_url = klaviyo_callback_url(&state.config.app_url);

    let oauth_state = decode_oauth_state(&query.state, state_secret)?;
    ensure_oauth_state_matches_user(&oauth_state, &user)?;

    let token = exchange_code_for_access_token(
        KLAVIYO_TOKEN_URL,
        client_id,
        client_secret,
        &query.code,
        &callback_url,
        &oauth_state.code_verifier,
    )
    .await?;
    let account = fetch_account_details(KLAVIYO_ACCOUNTS_URL, &token.access_token).await?;
    let topics = fetch_webhook_topics(KLAVIYO_WEBHOOK_TOPICS_URL, &token.access_token).await?;

    let existing_connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, KLAVIYO_PROVIDER)
        .await?;
    let existing_webhook_id = klaviyo_metadata_string(existing_connection.as_ref(), "webhook_id");
    let webhook_secret = generate_webhook_secret();
    let webhook_url = klaviyo_webhook_url(&state.config.app_url);
    let webhook = upsert_remote_webhook(
        KLAVIYO_WEBHOOKS_URL,
        &token.access_token,
        existing_webhook_id.as_deref(),
        &webhook_url,
        &webhook_secret,
        &topics,
    )
    .await?;

    let connected_at = Utc::now().to_rfc3339();
    let expires_at = token
        .expires_in
        .map(|seconds| Utc::now() + Duration::seconds(seconds));
    let metadata = merge_klaviyo_metadata(
        existing_connection
            .as_ref()
            .and_then(|connection| connection.metadata.clone()),
        serde_json::json!({
            "provider": KLAVIYO_PROVIDER,
            "transport": KLAVIYO_TRANSPORT,
            "connected_via": "oauth_webhook",
            "account_id": account.id,
            "account_name": account.name,
            "connected_at": connected_at,
            "oauth_scope": token.scope,
            "oauth_token_type": token.token_type,
            "webhook_id": webhook.webhook_id,
            "webhook_url": webhook_url,
            "webhook_secret": webhook_secret,
            "subscribed_topics": topics,
            "subscribed_topic_count": webhook.topic_count,
            "last_error": Value::Null,
        }),
    );

    let connection = state
        .connections
        .upsert_by_tenant_provider(
            CreateConnectionInput {
                tenant_id: user.tenant_id,
                provider: KLAVIYO_PROVIDER.to_string(),
                access_token: Some(token.access_token),
                refresh_token: token.refresh_token,
                expires_at,
                nango_connection_id: Some(account.id),
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
) -> ApiResult<Json<KlaviyoIntegrationResponse>> {
    let Some(connection) = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, KLAVIYO_PROVIDER)
        .await?
    else {
        return Ok(Json(build_integration_response(&state, None)));
    };

    let access_token = connection.access_token.clone();
    let webhook_id = klaviyo_metadata_string(Some(&connection), "webhook_id");

    if let (Some(access_token), Some(webhook_id)) = (access_token.as_deref(), webhook_id.as_deref())
    {
        delete_remote_webhook(KLAVIYO_WEBHOOKS_URL, access_token, webhook_id).await?;
    }

    state.connections.delete(&connection.id).await?;
    Ok(Json(build_integration_response(&state, None)))
}

pub async fn webhook(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    body: String,
) -> ApiResult<Json<KlaviyoWebhookResponse>> {
    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        tracing::warn!(%error, "Invalid Klaviyo webhook JSON");
        ApiError::bad_request(format!("Invalid JSON: {error}"))
    })?;
    let account_id = payload
        .pointer("/meta/klaviyo_account_id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("Missing Klaviyo account id"))?;

    let Some(connection) = state
        .connections
        .find_by_nango_connection_id(account_id)
        .await?
        .filter(|connection| connection.provider == KLAVIYO_PROVIDER)
    else {
        tracing::warn!(
            account_id,
            "Received Klaviyo webhook for account without Chronicle connection"
        );
        return Ok(Json(KlaviyoWebhookResponse {
            received: true,
            ingested_count: 0,
            duplicate_count: 0,
            event_ids: Vec::new(),
            message: "No matching Chronicle Klaviyo connection for this account".to_string(),
        }));
    };

    let webhook_id_header = headers
        .get(KLAVIYO_WEBHOOK_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;
    let webhook_id_body = payload
        .pointer("/meta/klaviyo_webhook_id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("Missing Klaviyo webhook id"))?;
    if webhook_id_header != webhook_id_body {
        return Err(ApiError::unauthorized());
    }

    let expected_webhook_id = klaviyo_metadata_string(Some(&connection), "webhook_id");
    if let Some(expected_webhook_id) = expected_webhook_id.as_deref() {
        if expected_webhook_id != webhook_id_header {
            tracing::warn!(
                account_id,
                expected = expected_webhook_id,
                received = webhook_id_header,
                "Received Klaviyo webhook for unexpected webhook id"
            );
            return Ok(Json(KlaviyoWebhookResponse {
                received: true,
                ingested_count: 0,
                duplicate_count: 0,
                event_ids: Vec::new(),
                message: "Webhook delivery did not match the active Chronicle subscription"
                    .to_string(),
            }));
        }
    }

    verify_klaviyo_signature(&headers, &body, &connection)?;

    let items = payload
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| ApiError::bad_request("Missing Klaviyo webhook events"))?;

    let tenant_id = TenantId::new(connection.tenant_id.clone());
    let mut ingested_count = 0u64;
    let mut duplicate_count = 0u64;
    let mut event_ids = Vec::new();
    let mut last_topic: Option<String> = None;
    let mut last_external_id: Option<String> = None;
    let mut last_event_id: Option<String> = None;
    let mut events = Vec::new();

    for item in items {
        let normalized = normalize_klaviyo_event(&connection.tenant_id, account_id, item, &body);
        last_topic = Some(normalized.topic.clone());
        last_external_id = Some(normalized.external_id.clone());

        let duplicate = state
            .event_store
            .exists(&tenant_id, KLAVIYO_PROVIDER, &normalized.source_event_id)
            .await
            .map_err(|error| {
                tracing::error!(
                    account_id,
                    source_event_id = %normalized.source_event_id,
                    %error,
                    "Failed to check Klaviyo duplicate event"
                );
                ApiError::internal()
            })?;

        if duplicate {
            duplicate_count += 1;
        } else {
            events.push(normalized.event);
        }
    }

    if !events.is_empty() {
        let inserted = state
            .event_store
            .insert_events(&events)
            .await
            .map_err(|error| {
                tracing::error!(account_id, %error, "Failed to store Klaviyo events");
                ApiError::internal()
            })?;
        ingested_count = inserted.len() as u64;
        event_ids = inserted.into_iter().map(|id| id.to_string()).collect();
        last_event_id = event_ids.last().cloned();
    }

    let metadata = merge_klaviyo_metadata(
        connection.metadata.clone(),
        serde_json::json!({
            "last_received_at": Utc::now().to_rfc3339(),
            "last_topic": last_topic,
            "last_external_id": last_external_id,
            "last_event_id": last_event_id,
            "event_count": klaviyo_event_count(connection.metadata.as_ref()) + ingested_count,
            "last_error": Value::Null,
        }),
    );
    let _connection = upsert_klaviyo_metadata(&state, &connection, metadata, "active").await?;

    Ok(Json(KlaviyoWebhookResponse {
        received: true,
        ingested_count,
        duplicate_count,
        event_ids,
        message: if ingested_count > 0 {
            "Webhook ingested".to_string()
        } else {
            "Webhook delivery did not include any new events".to_string()
        },
    }))
}

fn build_integration_response(
    state: &SaasAppState,
    connection: Option<Connection>,
) -> KlaviyoIntegrationResponse {
    let is_available =
        state.config.klaviyo_client_id.is_some() && state.config.klaviyo_client_secret.is_some();
    let setup_status = if !is_available {
        "unavailable".to_string()
    } else if connection.is_some() {
        "active".to_string()
    } else {
        "not_configured".to_string()
    };

    KlaviyoIntegrationResponse {
        provider: KLAVIYO_PROVIDER.to_string(),
        display_name: KLAVIYO_DISPLAY_NAME.to_string(),
        description: KLAVIYO_DESCRIPTION.to_string(),
        transport: KLAVIYO_TRANSPORT.to_string(),
        is_available,
        account_id: klaviyo_metadata_string(connection.as_ref(), "account_id"),
        account_name: klaviyo_metadata_string(connection.as_ref(), "account_name"),
        connected_at: klaviyo_metadata_string(connection.as_ref(), "connected_at"),
        last_received_at: klaviyo_metadata_string(connection.as_ref(), "last_received_at"),
        subscribed_topic_count: connection.as_ref().map(|connection| {
            klaviyo_metadata_u64(connection.metadata.as_ref(), "subscribed_topic_count")
        }),
        event_count: connection
            .as_ref()
            .map(|connection| klaviyo_event_count(connection.metadata.as_ref())),
        webhook_url: klaviyo_webhook_url(&state.config.app_url),
        connection,
        setup_status,
    }
}

fn klaviyo_callback_url(app_url: &str) -> String {
    format!(
        "{}/api/integrations/klaviyo/callback",
        app_url.trim_end_matches('/')
    )
}

fn klaviyo_webhook_url(app_url: &str) -> String {
    format!("{}/api/webhooks/klaviyo", app_url.trim_end_matches('/'))
}

fn klaviyo_state_secret(state: &SaasAppState) -> Option<&str> {
    state
        .config
        .service_secret
        .as_deref()
        .or(state.config.klaviyo_client_secret.as_deref())
}

fn generate_code_verifier() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(96)
        .map(char::from)
        .collect()
}

fn generate_webhook_secret() -> String {
    cuid2::create_id()
}

fn code_challenge(code_verifier: &str) -> String {
    let digest = Sha256::digest(code_verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn encode_oauth_state(payload: &KlaviyoOAuthState, secret: &str) -> ApiResult<String> {
    let serialized = serde_json::to_vec(payload).map_err(|error| {
        tracing::error!(%error, "Failed to serialize Klaviyo OAuth state");
        ApiError::internal()
    })?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Klaviyo OAuth state signature");
        ApiError::internal()
    })?;
    mac.update(&serialized);
    Ok(format!(
        "{}.{}",
        hex::encode(serialized),
        hex::encode(mac.finalize().into_bytes())
    ))
}

fn decode_oauth_state(state: &str, secret: &str) -> ApiResult<KlaviyoOAuthState> {
    let (payload_hex, signature_hex) = state
        .split_once('.')
        .ok_or_else(|| ApiError::bad_request("Invalid Klaviyo OAuth state"))?;
    let payload = hex::decode(payload_hex)
        .map_err(|_| ApiError::bad_request("Invalid Klaviyo OAuth state"))?;
    let signature = hex::decode(signature_hex)
        .map_err(|_| ApiError::bad_request("Invalid Klaviyo OAuth state"))?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Klaviyo OAuth state verifier");
        ApiError::internal()
    })?;
    mac.update(&payload);
    mac.verify_slice(&signature)
        .map_err(|_| ApiError::bad_request("Invalid Klaviyo OAuth state"))?;

    serde_json::from_slice(&payload).map_err(|error| {
        tracing::warn!(%error, "Failed to parse Klaviyo OAuth state");
        ApiError::bad_request("Invalid Klaviyo OAuth state")
    })
}

fn ensure_oauth_state_matches_user(
    oauth_state: &KlaviyoOAuthState,
    user: &AuthUser,
) -> ApiResult<()> {
    if oauth_state.tenant_id != user.tenant_id || oauth_state.user_id != user.id {
        return Err(ApiError::forbidden(
            "Klaviyo OAuth state does not match the current user",
        ));
    }

    let issued_at = DateTime::parse_from_rfc3339(&oauth_state.issued_at)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| ApiError::bad_request("Invalid Klaviyo OAuth state timestamp"))?;
    if Utc::now().signed_duration_since(issued_at)
        > Duration::minutes(KLAVIYO_OAUTH_STATE_MAX_AGE_MINUTES)
    {
        return Err(ApiError::bad_request("Klaviyo OAuth session expired"));
    }

    Ok(())
}

async fn exchange_code_for_access_token(
    token_url: &str,
    client_id: &str,
    client_secret: &str,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> ApiResult<KlaviyoTokenResponse> {
    let client = Client::new();
    let response = client
        .post(token_url)
        .basic_auth(client_id, Some(client_secret))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to exchange Klaviyo OAuth code");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Klaviyo OAuth token exchange failed");
        return Err(ApiError::bad_request("Klaviyo authorization failed"));
    }

    response
        .json::<KlaviyoTokenResponse>()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to parse Klaviyo OAuth token response");
            ApiError::internal()
        })
}

async fn fetch_account_details(
    accounts_url: &str,
    access_token: &str,
) -> ApiResult<KlaviyoAccount> {
    let client = Client::new();
    let response = client
        .get(accounts_url)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("Revision", KLAVIYO_API_REVISION)
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to fetch Klaviyo accounts");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Klaviyo accounts request failed");
        return Err(ApiError::bad_request(
            "Failed to read Klaviyo account details",
        ));
    }

    let payload = response.json::<Value>().await.map_err(|error| {
        tracing::error!(%error, "Failed to parse Klaviyo accounts response");
        ApiError::internal()
    })?;
    let accounts = payload
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| ApiError::bad_request("Klaviyo accounts response was missing data"))?;

    if accounts.len() != 1 {
        return Err(ApiError::bad_request(
            "Klaviyo authorization must resolve exactly one account",
        ));
    }

    let account = accounts.first().expect("len checked");
    let id = account
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("Klaviyo account id was missing"))?;
    let name = account
        .pointer("/attributes/contact_information/organization_name")
        .and_then(Value::as_str)
        .or_else(|| {
            account
                .pointer("/attributes/organization_name")
                .and_then(Value::as_str)
        })
        .or_else(|| account.pointer("/attributes/name").and_then(Value::as_str))
        .map(ToString::to_string);

    Ok(KlaviyoAccount {
        id: id.to_string(),
        name,
    })
}

async fn fetch_webhook_topics(topics_url: &str, access_token: &str) -> ApiResult<Vec<String>> {
    let client = Client::new();
    let response = client
        .get(topics_url)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("Revision", KLAVIYO_API_REVISION)
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to fetch Klaviyo webhook topics");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Klaviyo webhook topics request failed");
        return Err(ApiError::bad_request(
            "Failed to read Klaviyo webhook topics",
        ));
    }

    let payload = response.json::<Value>().await.map_err(|error| {
        tracing::error!(%error, "Failed to parse Klaviyo webhook topics response");
        ApiError::internal()
    })?;

    let mut topics = payload
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| ApiError::bad_request("Klaviyo webhook topics response was missing data"))?
        .iter()
        .filter_map(|topic| {
            topic
                .get("id")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect::<Vec<_>>();
    topics.sort();
    topics.dedup();

    if topics.is_empty() {
        return Err(ApiError::bad_request(
            "Klaviyo did not return any webhook topics for this account",
        ));
    }

    Ok(topics)
}

async fn upsert_remote_webhook(
    webhooks_url: &str,
    access_token: &str,
    existing_webhook_id: Option<&str>,
    endpoint_url: &str,
    secret_key: &str,
    topics: &[String],
) -> ApiResult<KlaviyoWebhookUpsertResult> {
    if let Some(existing_webhook_id) = existing_webhook_id {
        match update_remote_webhook(
            webhooks_url,
            access_token,
            existing_webhook_id,
            endpoint_url,
            secret_key,
            topics,
        )
        .await?
        {
            Some(webhook) => return Ok(webhook),
            None => {}
        }
    }

    create_remote_webhook(webhooks_url, access_token, endpoint_url, secret_key, topics).await
}

fn build_webhook_upsert_body(endpoint_url: &str, secret_key: &str, topics: &[String]) -> Value {
    serde_json::json!({
        "data": {
            "type": "webhook",
            "attributes": {
                "name": "Chronicle Klaviyo",
                "endpoint_url": endpoint_url,
                "secret_key": secret_key,
            },
            "relationships": {
                "webhook-topics": {
                    "data": topics.iter().map(|topic| serde_json::json!({
                        "type": "webhook-topic",
                        "id": topic,
                    })).collect::<Vec<_>>()
                }
            }
        }
    })
}

async fn create_remote_webhook(
    webhooks_url: &str,
    access_token: &str,
    endpoint_url: &str,
    secret_key: &str,
    topics: &[String],
) -> ApiResult<KlaviyoWebhookUpsertResult> {
    let client = Client::new();
    let response = client
        .post(webhooks_url)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("Revision", KLAVIYO_API_REVISION)
        .json(&build_webhook_upsert_body(endpoint_url, secret_key, topics))
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to create Klaviyo webhook");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Klaviyo webhook create failed");
        return Err(ApiError::bad_request(
            "Failed to create the Klaviyo webhook",
        ));
    }

    let payload = response.json::<Value>().await.map_err(|error| {
        tracing::error!(%error, "Failed to parse Klaviyo webhook create response");
        ApiError::internal()
    })?;
    let webhook_id = payload
        .pointer("/data/id")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            ApiError::bad_request("Klaviyo webhook create response was missing an id")
        })?;

    Ok(KlaviyoWebhookUpsertResult {
        webhook_id: webhook_id.to_string(),
        topic_count: topics.len() as u64,
    })
}

async fn update_remote_webhook(
    webhooks_url: &str,
    access_token: &str,
    webhook_id: &str,
    endpoint_url: &str,
    secret_key: &str,
    topics: &[String],
) -> ApiResult<Option<KlaviyoWebhookUpsertResult>> {
    let client = Client::new();
    let response = client
        .patch(format!("{webhooks_url}{webhook_id}/"))
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("Revision", KLAVIYO_API_REVISION)
        .json(&build_webhook_upsert_body(endpoint_url, secret_key, topics))
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to update Klaviyo webhook");
            ApiError::internal()
        })?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Klaviyo webhook update failed");
        return Err(ApiError::bad_request(
            "Failed to update the Klaviyo webhook",
        ));
    }

    let payload = response.json::<Value>().await.map_err(|error| {
        tracing::error!(%error, "Failed to parse Klaviyo webhook update response");
        ApiError::internal()
    })?;
    let webhook_id = payload
        .pointer("/data/id")
        .and_then(Value::as_str)
        .unwrap_or(webhook_id);

    Ok(Some(KlaviyoWebhookUpsertResult {
        webhook_id: webhook_id.to_string(),
        topic_count: topics.len() as u64,
    }))
}

async fn delete_remote_webhook(
    webhooks_url: &str,
    access_token: &str,
    webhook_id: &str,
) -> ApiResult<()> {
    let client = Client::new();
    let response = client
        .delete(format!("{webhooks_url}{webhook_id}/"))
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("Revision", KLAVIYO_API_REVISION)
        .send()
        .await
        .map_err(|error| {
            tracing::error!(%error, "Failed to delete Klaviyo webhook");
            ApiError::internal()
        })?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(());
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, body, "Klaviyo webhook delete failed");
        return Err(ApiError::bad_request(
            "Failed to delete the Klaviyo webhook",
        ));
    }

    Ok(())
}

fn verify_klaviyo_signature(
    headers: &HeaderMap,
    body: &str,
    connection: &Connection,
) -> ApiResult<()> {
    let secret = klaviyo_metadata_string(Some(connection), "webhook_secret")
        .ok_or_else(|| ApiError::bad_request("Klaviyo webhook secret is not configured"))?;
    let timestamp = headers
        .get(KLAVIYO_TIMESTAMP_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;
    let provided = headers
        .get(KLAVIYO_SIGNATURE_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Klaviyo webhook verifier");
        ApiError::internal()
    })?;
    mac.update(body.as_bytes());
    mac.update(timestamp.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    if constant_time_eq(expected.as_bytes(), provided.as_bytes()) {
        Ok(())
    } else {
        Err(ApiError::unauthorized())
    }
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }

    left.iter()
        .zip(right)
        .fold(0u8, |diff, (left, right)| diff | (left ^ right))
        == 0
}

fn normalize_klaviyo_event(
    tenant_id: &str,
    account_id: &str,
    item: &Value,
    raw_body: &str,
) -> KlaviyoNormalizedEvent {
    let topic = item
        .get("topic")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let external_id = item
        .get("external_id")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .or_else(|| {
            item.pointer("/payload/data/id")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| format!("payload:{}", &hash_json_value(item)[..24]));
    let source_event_id = format!("klaviyo:{account_id}:{external_id}:{topic}");
    let occurred_at = klaviyo_occurred_at(item).unwrap_or_else(Utc::now);
    let event_type = klaviyo_event_type(&topic);
    let payload = item.get("payload").cloned().unwrap_or(Value::Null);
    let profile_id = payload
        .pointer("/data/relationships/profile/data/id")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let metric_id = payload
        .pointer("/data/relationships/metric/data/id")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let event_entity_id = payload
        .pointer("/data/id")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let entities = klaviyo_entities(
        account_id,
        profile_id.as_deref(),
        metric_id.as_deref(),
        event_entity_id.as_deref(),
    );
    let (actor_type, actor_id, actor_name) = if let Some(profile_id) = profile_id.clone() {
        ("customer", profile_id, klaviyo_profile_name(&payload))
    } else {
        ("system", KLAVIYO_PROVIDER.to_string(), None)
    };

    let payload_value = serde_json::json!({
        "topic": topic,
        "external_id": external_id,
        "account_id": account_id,
        "payload": payload,
        "raw": item,
    });

    KlaviyoNormalizedEvent {
        source_event_id: source_event_id.clone(),
        external_id: external_id.clone(),
        topic: topic.clone(),
        event: build_native_event(
            tenant_id,
            KLAVIYO_PROVIDER,
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
                "provider": KLAVIYO_PROVIDER,
                "account_id": account_id,
                "topic": topic,
                "external_id": external_id,
            })),
            Some(serde_json::json!({
                "source_event_id": source_event_id,
            })),
        ),
    }
}

fn klaviyo_occurred_at(item: &Value) -> Option<DateTime<Utc>> {
    if let Some(timestamp) = item
        .pointer("/payload/data/attributes/timestamp")
        .and_then(klaviyo_value_to_datetime)
    {
        return Some(timestamp);
    }

    item.pointer("/payload/data/attributes/datetime")
        .and_then(klaviyo_value_to_datetime)
        .or_else(|| {
            item.pointer("/payload/data/attributes/time")
                .and_then(klaviyo_value_to_datetime)
        })
}

fn klaviyo_value_to_datetime(value: &Value) -> Option<DateTime<Utc>> {
    match value {
        Value::String(value) => DateTime::parse_from_rfc3339(value)
            .ok()
            .map(|value| value.with_timezone(&Utc)),
        Value::Number(value) => value.as_i64().and_then(klaviyo_timestamp_to_datetime),
        _ => None,
    }
}

fn klaviyo_timestamp_to_datetime(timestamp: i64) -> Option<DateTime<Utc>> {
    let (seconds, nanos) = if timestamp > 1_000_000_000_000 {
        (timestamp / 1_000, ((timestamp % 1_000) * 1_000_000) as u32)
    } else {
        (timestamp, 0)
    };
    Utc.timestamp_opt(seconds, nanos).single()
}

fn klaviyo_event_type(topic: &str) -> String {
    if let Some(suffix) = topic.strip_prefix("event:") {
        return format!("klaviyo.event.{}", sanitize_topic_fragment(suffix));
    }

    format!("klaviyo.{}", sanitize_topic_fragment(topic))
}

fn sanitize_topic_fragment(value: &str) -> String {
    let mut sanitized = String::new();
    let mut last_was_separator = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            sanitized.push(ch.to_ascii_lowercase());
            last_was_separator = false;
        } else if !last_was_separator {
            sanitized.push('_');
            last_was_separator = true;
        }
    }

    sanitized.trim_matches('_').to_string()
}

fn klaviyo_entities(
    account_id: &str,
    profile_id: Option<&str>,
    metric_id: Option<&str>,
    event_id: Option<&str>,
) -> Vec<(String, String)> {
    let mut entities = vec![("account".to_string(), account_id.to_string())];
    if let Some(profile_id) = profile_id {
        entities.push(("profile".to_string(), profile_id.to_string()));
    }
    if let Some(metric_id) = metric_id {
        entities.push(("metric".to_string(), metric_id.to_string()));
    }
    if let Some(event_id) = event_id {
        entities.push(("event".to_string(), event_id.to_string()));
    }
    entities
}

fn klaviyo_profile_name(payload: &Value) -> Option<String> {
    payload
        .pointer("/data/attributes/profile/email")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .or_else(|| {
            payload
                .pointer("/data/attributes/profile/phone_number")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
}

fn hash_json_value(value: &Value) -> String {
    let serialized = serde_json::to_string(value).unwrap_or_else(|_| "null".to_string());
    let mut digest = Sha256::new();
    digest.update(serialized.as_bytes());
    hex::encode(digest.finalize())
}

fn merge_klaviyo_metadata(existing: Option<Value>, patch: Value) -> Value {
    let mut metadata = match existing {
        Some(Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    };

    metadata.insert(
        "provider".to_string(),
        Value::String(KLAVIYO_PROVIDER.to_string()),
    );
    metadata.insert(
        "transport".to_string(),
        Value::String(KLAVIYO_TRANSPORT.to_string()),
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

async fn upsert_klaviyo_metadata(
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
                provider: KLAVIYO_PROVIDER.to_string(),
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

fn klaviyo_metadata_string(connection: Option<&Connection>, key: &str) -> Option<String> {
    connection?
        .metadata
        .as_ref()?
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn klaviyo_metadata_u64(metadata: Option<&Value>, key: &str) -> u64 {
    metadata
        .and_then(|metadata| metadata.get(key))
        .and_then(Value::as_u64)
        .unwrap_or(0)
}

fn klaviyo_event_count(metadata: Option<&Value>) -> u64 {
    klaviyo_metadata_u64(metadata, "event_count")
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::{
        matchers::{body_json, header, method, path},
        Mock, MockServer, ResponseTemplate,
    };

    #[test]
    fn encodes_and_decodes_oauth_state_with_code_verifier() {
        let payload = KlaviyoOAuthState {
            tenant_id: "tenant_1".to_string(),
            user_id: "user_1".to_string(),
            nonce: "nonce_1".to_string(),
            issued_at: Utc::now().to_rfc3339(),
            code_verifier: "code-verifier".to_string(),
        };

        let encoded = encode_oauth_state(&payload, "secret").unwrap();
        let decoded = decode_oauth_state(&encoded, "secret").unwrap();

        assert_eq!(decoded.tenant_id, payload.tenant_id);
        assert_eq!(decoded.user_id, payload.user_id);
        assert_eq!(decoded.code_verifier, payload.code_verifier);
    }

    #[test]
    fn rejects_invalid_oauth_state_signature() {
        let payload = KlaviyoOAuthState {
            tenant_id: "tenant_1".to_string(),
            user_id: "user_1".to_string(),
            nonce: "nonce_1".to_string(),
            issued_at: Utc::now().to_rfc3339(),
            code_verifier: "code-verifier".to_string(),
        };

        let encoded = encode_oauth_state(&payload, "secret").unwrap();
        assert!(decode_oauth_state(&encoded, "different").is_err());
    }

    #[test]
    fn verifies_valid_klaviyo_signature() {
        let mut connection = Connection {
            id: "conn_1".to_string(),
            tenant_id: "tenant_1".to_string(),
            provider: KLAVIYO_PROVIDER.to_string(),
            access_token: None,
            refresh_token: None,
            expires_at: None,
            nango_connection_id: Some("acct_1".to_string()),
            metadata: Some(serde_json::json!({
                "webhook_secret": "test-secret",
            })),
            status: "active".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let body = "{\"data\":[],\"meta\":{\"klaviyo_account_id\":\"acct_1\",\"klaviyo_webhook_id\":\"hook_1\"}}";
        let timestamp = "Thu, 04 Jan 2024 18:05:25 GMT";
        let mut mac = HmacSha256::new_from_slice(b"test-secret").unwrap();
        mac.update(body.as_bytes());
        mac.update(timestamp.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        let mut headers = HeaderMap::new();
        headers.insert(KLAVIYO_SIGNATURE_HEADER, signature.parse().unwrap());
        headers.insert(KLAVIYO_TIMESTAMP_HEADER, timestamp.parse().unwrap());

        assert!(verify_klaviyo_signature(&headers, body, &connection).is_ok());
        connection.metadata = Some(serde_json::json!({ "webhook_secret": "wrong" }));
        assert!(verify_klaviyo_signature(&headers, body, &connection).is_err());
    }

    #[test]
    fn normalizes_topic_to_event_type() {
        assert_eq!(
            klaviyo_event_type("event:klaviyo.email_delivered"),
            "klaviyo.event.klaviyo_email_delivered"
        );
        assert_eq!(
            klaviyo_event_type("custom:topic-name"),
            "klaviyo.custom_topic_name"
        );
    }

    #[test]
    fn builds_dedupe_key_from_account_external_id_and_topic() {
        let payload = serde_json::json!({
            "external_id": "evt_123",
            "topic": "event:klaviyo.email_opened",
            "payload": {
                "data": {
                    "id": "evt_123",
                    "attributes": {
                        "timestamp": 1775592000
                    }
                }
            }
        });

        let normalized = normalize_klaviyo_event("tenant_1", "acct_1", &payload, "{}");
        assert_eq!(
            normalized.source_event_id,
            "klaviyo:acct_1:evt_123:event:klaviyo.email_opened"
        );
    }

    #[test]
    fn normalizes_profile_backed_event() {
        let payload = serde_json::json!({
            "external_id": "evt_123",
            "topic": "event:klaviyo.email_opened",
            "payload": {
                "data": {
                    "id": "evt_123",
                    "attributes": {
                        "timestamp": 1775592000,
                        "profile": {
                            "email": "jane@example.com"
                        }
                    },
                    "relationships": {
                        "profile": {
                            "data": {
                                "id": "profile_1"
                            }
                        },
                        "metric": {
                            "data": {
                                "id": "metric_1"
                            }
                        }
                    }
                }
            }
        });

        let normalized = normalize_klaviyo_event("tenant_1", "acct_1", &payload, "{}");
        assert_eq!(
            normalized.event.event_type.as_str(),
            "klaviyo.event.klaviyo_email_opened"
        );
        assert!(normalized
            .event
            .entity_refs
            .iter()
            .any(|entity| entity.entity_type.as_str() == "profile"
                && entity.entity_id.as_str() == "profile_1"));
    }

    #[tokio::test]
    async fn exchanges_token_and_reads_account_and_topics() {
        let server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/oauth/token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "expires_in": 3600,
                "scope": KLAVIYO_OAUTH_SCOPES,
            })))
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/api/accounts/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": [{
                    "type": "account",
                    "id": "acct_1",
                    "attributes": {
                        "contact_information": {
                            "organization_name": "Chronicle Test Account"
                        }
                    }
                }]
            })))
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/api/webhook-topics/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": [
                    { "type": "webhook-topic", "id": "event:klaviyo.email_delivered" },
                    { "type": "webhook-topic", "id": "event:klaviyo.email_opened" }
                ]
            })))
            .mount(&server)
            .await;

        let token = exchange_code_for_access_token(
            &format!("{}/oauth/token", server.uri()),
            "client-id",
            "client-secret",
            "code",
            "https://example.com/callback",
            "code-verifier",
        )
        .await
        .unwrap();
        let account = fetch_account_details(
            &format!("{}/api/accounts/", server.uri()),
            &token.access_token,
        )
        .await
        .unwrap();
        let topics = fetch_webhook_topics(
            &format!("{}/api/webhook-topics/", server.uri()),
            &token.access_token,
        )
        .await
        .unwrap();

        assert_eq!(account.id, "acct_1");
        assert_eq!(account.name.as_deref(), Some("Chronicle Test Account"));
        assert_eq!(topics.len(), 2);
    }

    #[tokio::test]
    async fn creates_updates_and_deletes_remote_webhook() {
        let server = MockServer::start().await;
        let topics = vec![
            "event:klaviyo.email_delivered".to_string(),
            "event:klaviyo.email_opened".to_string(),
        ];

        Mock::given(method("POST"))
            .and(path("/api/webhooks/"))
            .and(header("revision", KLAVIYO_API_REVISION))
            .and(body_json(build_webhook_upsert_body(
                "https://chronicle.test/api/webhooks/klaviyo",
                "secret",
                &topics,
            )))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": { "type": "webhook", "id": "hook_1" }
            })))
            .mount(&server)
            .await;

        Mock::given(method("PATCH"))
            .and(path("/api/webhooks/hook_1/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": { "type": "webhook", "id": "hook_1" }
            })))
            .mount(&server)
            .await;

        Mock::given(method("DELETE"))
            .and(path("/api/webhooks/hook_1/"))
            .respond_with(ResponseTemplate::new(204))
            .mount(&server)
            .await;

        let created = create_remote_webhook(
            &format!("{}/api/webhooks/", server.uri()),
            "access-token",
            "https://chronicle.test/api/webhooks/klaviyo",
            "secret",
            &topics,
        )
        .await
        .unwrap();
        assert_eq!(created.webhook_id, "hook_1");

        let updated = update_remote_webhook(
            &format!("{}/api/webhooks/", server.uri()),
            "access-token",
            "hook_1",
            "https://chronicle.test/api/webhooks/klaviyo",
            "secret",
            &topics,
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(updated.webhook_id, "hook_1");

        delete_remote_webhook(
            &format!("{}/api/webhooks/", server.uri()),
            "access-token",
            "hook_1",
        )
        .await
        .unwrap();
    }
}
