use std::collections::{BTreeMap, HashMap};

use axum::{
    extract::{OriginalUri, Query, State},
    http::HeaderMap,
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Duration, TimeZone, Utc};
use hmac::{Hmac, Mac};
use reqwest::Client;
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

const SHOPIFY_PROVIDER: &str = "shopify";
const SHOPIFY_DISPLAY_NAME: &str = "Shopify";
const SHOPIFY_DESCRIPTION: &str =
    "Connect Shopify directly via OAuth with Chronicle-managed webhook subscriptions.";
const SHOPIFY_TRANSPORT: &str = "direct";
const SHOPIFY_ADMIN_API_VERSION: &str = "2025-07";
const SHOPIFY_OAUTH_SCOPES: &str = "read_orders,read_customers";
const SHOPIFY_OAUTH_STATE_MAX_AGE_MINUTES: i64 = 15;
const SHOPIFY_WEBHOOK_HMAC_HEADER: &str = "x-shopify-hmac-sha256";
const SHOPIFY_WEBHOOK_TOPIC_HEADER: &str = "x-shopify-topic";
const SHOPIFY_WEBHOOK_SHOP_HEADER: &str = "x-shopify-shop-domain";
const SHOPIFY_WEBHOOK_ID_HEADER: &str = "x-shopify-webhook-id";
const SHOPIFY_EVENT_ID_HEADER: &str = "x-shopify-event-id";

const MANAGED_TOPICS: [&str; 7] = [
    "ORDERS_CREATE",
    "ORDERS_UPDATED",
    "ORDERS_PAID",
    "CUSTOMERS_CREATE",
    "CUSTOMERS_UPDATE",
    "SHOP_UPDATE",
    "APP_UNINSTALLED",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopifyIntegrationResponse {
    pub provider: String,
    pub display_name: String,
    pub description: String,
    pub transport: String,
    pub is_available: bool,
    pub connection: Option<Connection>,
    pub setup_status: String,
    pub shop_domain: Option<String>,
    pub shop_name: Option<String>,
    pub connected_at: Option<String>,
    pub last_received_at: Option<String>,
    pub subscribed_topic_count: Option<u64>,
    pub event_count: Option<u64>,
    pub webhook_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopifyAuthorizeRequest {
    pub shop_domain: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopifyAuthorizeResponse {
    pub authorize_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopifyWebhookResponse {
    pub received: bool,
    pub ingested: bool,
    pub duplicate: bool,
    pub event_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct ShopifyCallbackQuery {
    pub code: String,
    pub state: String,
    pub hmac: String,
    pub shop: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ShopifyOAuthState {
    tenant_id: String,
    user_id: String,
    shop_domain: String,
    nonce: String,
    issued_at: String,
}

#[derive(Debug, Deserialize)]
struct ShopifyTokenResponse {
    access_token: String,
    scope: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

#[derive(Debug, Clone)]
struct ShopifyShopDetails {
    shop_domain: String,
    shop_name: Option<String>,
}

#[derive(Debug, Clone)]
struct ShopifyRemoteWebhook {
    id: String,
    topic: String,
    callback_url: Option<String>,
}

#[derive(Debug)]
struct ShopifyWebhookProvisioningResult {
    subscriptions: BTreeMap<String, String>,
}

struct ShopifyNormalizedEvent {
    source_event_id: String,
    event: ChronicleEvent,
}

pub async fn get_integration(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<ShopifyIntegrationResponse>> {
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, SHOPIFY_PROVIDER)
        .await?;

    Ok(Json(build_integration_response(&state, connection)))
}

pub async fn authorize(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(body): Json<ShopifyAuthorizeRequest>,
) -> ApiResult<Json<ShopifyAuthorizeResponse>> {
    let client_id = state
        .config
        .shopify_client_id
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Shopify direct integration is not configured"))?;
    let state_secret = shopify_state_secret(&state)
        .ok_or_else(|| ApiError::bad_request("Shopify OAuth state secret is not configured"))?;
    let shop_domain = normalize_shop_domain(&body.shop_domain)?;
    let callback_url = shopify_callback_url(&state.config.app_url);

    let oauth_state = encode_oauth_state(
        &ShopifyOAuthState {
            tenant_id: user.tenant_id,
            user_id: user.id,
            shop_domain: shop_domain.clone(),
            nonce: cuid2::create_id(),
            issued_at: Utc::now().to_rfc3339(),
        },
        state_secret,
    )?;

    let authorize_url = format!(
        "https://{shop_domain}/admin/oauth/authorize?client_id={client_id}&scope={scope}&redirect_uri={redirect_uri}&state={state}",
        shop_domain = shop_domain,
        client_id = urlencoding::encode(client_id),
        scope = urlencoding::encode(SHOPIFY_OAUTH_SCOPES),
        redirect_uri = urlencoding::encode(&callback_url),
        state = urlencoding::encode(&oauth_state),
    );

    Ok(Json(ShopifyAuthorizeResponse { authorize_url }))
}

pub async fn callback(
    user: AuthUser,
    State(state): State<SaasAppState>,
    OriginalUri(uri): OriginalUri,
    Query(query): Query<ShopifyCallbackQuery>,
) -> ApiResult<Json<ShopifyIntegrationResponse>> {
    let client_id = state
        .config
        .shopify_client_id
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Shopify direct integration is not configured"))?;
    let client_secret = state
        .config
        .shopify_client_secret
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Shopify direct integration is not configured"))?;
    let state_secret = shopify_state_secret(&state)
        .ok_or_else(|| ApiError::bad_request("Shopify OAuth state secret is not configured"))?;
    let callback_url = shopify_callback_url(&state.config.app_url);
    let shop_domain = normalize_shop_domain(&query.shop)?;
    let webhook_url = shopify_webhook_url(&state.config.app_url);
    ensure_https_url(&webhook_url, "Shopify webhook URL")?;

    verify_shopify_callback_hmac(uri.query().unwrap_or_default(), &query.hmac, client_secret)?;

    let oauth_state = decode_oauth_state(&query.state, state_secret)?;
    ensure_oauth_state_matches_user(&oauth_state, &user)?;
    if oauth_state.shop_domain != shop_domain {
        return Err(ApiError::forbidden(
            "Shopify OAuth callback did not match the requested store",
        ));
    }

    let token = exchange_code_for_access_token(
        &shop_domain,
        client_id,
        client_secret,
        &query.code,
        &callback_url,
    )
    .await?;
    let shop = fetch_shop_details(&shop_domain, &token.access_token)
        .await
        .unwrap_or(ShopifyShopDetails {
            shop_domain: shop_domain.clone(),
            shop_name: None,
        });
    let subscriptions =
        reconcile_remote_webhooks(&shop_domain, &token.access_token, &webhook_url).await?;

    let existing_connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, SHOPIFY_PROVIDER)
        .await?;
    let connected_at = Utc::now().to_rfc3339();
    let expires_at = token
        .expires_in
        .map(|seconds| Utc::now() + Duration::seconds(seconds));
    let metadata = merge_shopify_metadata(
        existing_connection
            .as_ref()
            .and_then(|connection| connection.metadata.clone()),
        serde_json::json!({
            "provider": SHOPIFY_PROVIDER,
            "transport": SHOPIFY_TRANSPORT,
            "connected_via": "oauth_webhook",
            "shop_domain": shop.shop_domain,
            "shop_name": shop.shop_name,
            "connected_at": connected_at,
            "scopes": split_scopes(token.scope.as_deref()),
            "webhook_subscriptions": subscriptions_value(&subscriptions.subscriptions),
            "subscribed_topic_count": subscriptions.subscriptions.len(),
            "webhook_url": webhook_url,
            "last_error": Value::Null,
        }),
    );

    let connection = state
        .connections
        .upsert_by_tenant_provider(
            CreateConnectionInput {
                tenant_id: user.tenant_id,
                provider: SHOPIFY_PROVIDER.to_string(),
                access_token: Some(token.access_token),
                refresh_token: token.refresh_token,
                expires_at,
                nango_connection_id: Some(shop_domain),
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
) -> ApiResult<Json<ShopifyIntegrationResponse>> {
    let Some(connection) = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, SHOPIFY_PROVIDER)
        .await?
    else {
        return Ok(Json(build_integration_response(&state, None)));
    };

    let shop_domain = connection.nango_connection_id.clone();
    let access_token = connection.access_token.clone();
    let subscriptions = shopify_webhook_subscriptions(connection.metadata.as_ref());

    if let (Some(shop_domain), Some(access_token)) =
        (shop_domain.as_deref(), access_token.as_deref())
    {
        for webhook_id in subscriptions.values() {
            if delete_remote_webhook(shop_domain, access_token, webhook_id)
                .await
                .is_err()
            {
                tracing::warn!(
                    shop_domain,
                    webhook_id,
                    "Failed to delete Shopify webhook during disconnect"
                );
            }
        }
    }

    state.connections.delete(&connection.id).await?;
    Ok(Json(build_integration_response(&state, None)))
}

pub async fn webhook(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    body: String,
) -> ApiResult<Json<ShopifyWebhookResponse>> {
    let client_secret = state
        .config
        .shopify_client_secret
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Shopify direct integration is not configured"))?;
    verify_shopify_webhook_signature(&headers, &body, client_secret)?;

    let shop_domain = headers
        .get(SHOPIFY_WEBHOOK_SHOP_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)
        .and_then(normalize_shop_domain)?;
    let topic = headers
        .get(SHOPIFY_WEBHOOK_TOPIC_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?
        .to_ascii_lowercase();

    let Some(connection) = state
        .connections
        .find_by_nango_connection_id(&shop_domain)
        .await?
        .filter(|connection| connection.provider == SHOPIFY_PROVIDER)
    else {
        tracing::warn!(
            shop_domain,
            topic,
            "Received Shopify webhook for store without Chronicle connection"
        );
        return Ok(Json(ShopifyWebhookResponse {
            received: true,
            ingested: false,
            duplicate: false,
            event_id: None,
            message: "No matching Chronicle Shopify connection for this store".to_string(),
        }));
    };

    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        tracing::warn!(%error, "Invalid Shopify webhook JSON");
        ApiError::bad_request(format!("Invalid JSON: {error}"))
    })?;
    let normalized = normalize_shopify_event(
        &connection.tenant_id,
        &shop_domain,
        &topic,
        &payload,
        &body,
        &headers,
    );

    let tenant_id = TenantId::new(connection.tenant_id.clone());
    let duplicate = state
        .event_store
        .exists(&tenant_id, SHOPIFY_PROVIDER, &normalized.source_event_id)
        .await
        .map_err(|error| {
            tracing::error!(
                shop_domain,
                source_event_id = %normalized.source_event_id,
                %error,
                "Failed to check Shopify duplicate event"
            );
            ApiError::internal()
        })?;

    if duplicate {
        return Ok(Json(ShopifyWebhookResponse {
            received: true,
            ingested: false,
            duplicate: true,
            event_id: None,
            message: "Shopify webhook delivery was already processed".to_string(),
        }));
    }

    let inserted = state
        .event_store
        .insert_events(&[normalized.event])
        .await
        .map_err(|error| {
            tracing::error!(shop_domain, %error, "Failed to store Shopify event");
            ApiError::internal()
        })?;
    let event_id = inserted.first().map(ToString::to_string);

    if topic == "app/uninstalled" {
        state.connections.delete(&connection.id).await?;
        return Ok(Json(ShopifyWebhookResponse {
            received: true,
            ingested: true,
            duplicate: false,
            event_id,
            message: "Shopify uninstall event ingested and connection removed".to_string(),
        }));
    }

    let metadata = merge_shopify_metadata(
        connection.metadata.clone(),
        serde_json::json!({
            "last_received_at": Utc::now().to_rfc3339(),
            "last_topic": topic,
            "last_event_id": event_id,
            "event_count": shopify_event_count(connection.metadata.as_ref()) + 1,
            "last_error": Value::Null,
        }),
    );
    let _connection = upsert_shopify_metadata(&state, &connection, metadata, "active").await?;

    Ok(Json(ShopifyWebhookResponse {
        received: true,
        ingested: true,
        duplicate: false,
        event_id,
        message: "Shopify webhook ingested".to_string(),
    }))
}

fn build_integration_response(
    state: &SaasAppState,
    connection: Option<Connection>,
) -> ShopifyIntegrationResponse {
    let is_available =
        state.config.shopify_client_id.is_some() && state.config.shopify_client_secret.is_some();
    let setup_status = if !is_available {
        "unavailable".to_string()
    } else if connection.is_some() {
        "active".to_string()
    } else {
        "not_configured".to_string()
    };

    ShopifyIntegrationResponse {
        provider: SHOPIFY_PROVIDER.to_string(),
        display_name: SHOPIFY_DISPLAY_NAME.to_string(),
        description: SHOPIFY_DESCRIPTION.to_string(),
        transport: SHOPIFY_TRANSPORT.to_string(),
        is_available,
        shop_domain: connection
            .as_ref()
            .and_then(|connection| connection.nango_connection_id.clone())
            .or_else(|| shopify_metadata_string(connection.as_ref(), "shop_domain")),
        shop_name: shopify_metadata_string(connection.as_ref(), "shop_name"),
        connected_at: shopify_metadata_string(connection.as_ref(), "connected_at"),
        last_received_at: shopify_metadata_string(connection.as_ref(), "last_received_at"),
        subscribed_topic_count: connection.as_ref().map(|connection| {
            shopify_metadata_u64(connection.metadata.as_ref(), "subscribed_topic_count")
        }),
        event_count: connection
            .as_ref()
            .map(|connection| shopify_event_count(connection.metadata.as_ref())),
        webhook_url: shopify_webhook_url(&state.config.app_url),
        connection,
        setup_status,
    }
}

fn shopify_callback_url(app_url: &str) -> String {
    format!(
        "{}/api/integrations/shopify/callback",
        app_url.trim_end_matches('/')
    )
}

fn shopify_webhook_url(app_url: &str) -> String {
    format!("{}/api/webhooks/shopify", app_url.trim_end_matches('/'))
}

fn shopify_state_secret(state: &SaasAppState) -> Option<&str> {
    state
        .config
        .service_secret
        .as_deref()
        .or(state.config.shopify_client_secret.as_deref())
}

fn ensure_https_url(url: &str, label: &str) -> ApiResult<()> {
    if url.starts_with("https://") {
        Ok(())
    } else {
        Err(ApiError::bad_request(format!(
            "{label} must be an https URL"
        )))
    }
}

fn normalize_shop_domain(input: &str) -> ApiResult<String> {
    let mut value = input.trim().to_ascii_lowercase();
    if let Some(stripped) = value.strip_prefix("https://") {
        value = stripped.to_string();
    } else if let Some(stripped) = value.strip_prefix("http://") {
        value = stripped.to_string();
    }

    if let Some((host, _)) = value.split_once('/') {
        value = host.to_string();
    }

    value = value.trim_end_matches('.').to_string();

    if value.is_empty()
        || !value.ends_with(".myshopify.com")
        || value.starts_with('.')
        || value.contains("..")
        || !value
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '.')
    {
        return Err(ApiError::bad_request(
            "Shopify store domain must be a valid *.myshopify.com hostname",
        ));
    }

    Ok(value)
}

fn encode_oauth_state(payload: &ShopifyOAuthState, secret: &str) -> ApiResult<String> {
    let serialized = serde_json::to_vec(payload).map_err(|error| {
        tracing::error!(%error, "Failed to serialize Shopify OAuth state");
        ApiError::internal()
    })?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Shopify OAuth state signature");
        ApiError::internal()
    })?;
    mac.update(&serialized);
    Ok(format!(
        "{}.{}",
        hex::encode(serialized),
        hex::encode(mac.finalize().into_bytes())
    ))
}

fn decode_oauth_state(state: &str, secret: &str) -> ApiResult<ShopifyOAuthState> {
    let (payload_hex, signature_hex) = state
        .split_once('.')
        .ok_or_else(|| ApiError::bad_request("Invalid Shopify OAuth state"))?;
    let payload = hex::decode(payload_hex)
        .map_err(|_| ApiError::bad_request("Invalid Shopify OAuth state"))?;
    let signature = hex::decode(signature_hex)
        .map_err(|_| ApiError::bad_request("Invalid Shopify OAuth state"))?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Shopify OAuth state verifier");
        ApiError::internal()
    })?;
    mac.update(&payload);
    mac.verify_slice(&signature)
        .map_err(|_| ApiError::bad_request("Invalid Shopify OAuth state"))?;

    serde_json::from_slice(&payload).map_err(|error| {
        tracing::warn!(%error, "Failed to parse Shopify OAuth state");
        ApiError::bad_request("Invalid Shopify OAuth state")
    })
}

fn ensure_oauth_state_matches_user(
    oauth_state: &ShopifyOAuthState,
    user: &AuthUser,
) -> ApiResult<()> {
    if oauth_state.tenant_id != user.tenant_id || oauth_state.user_id != user.id {
        return Err(ApiError::forbidden(
            "Shopify OAuth state does not match the current user",
        ));
    }

    let issued_at = DateTime::parse_from_rfc3339(&oauth_state.issued_at)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| ApiError::bad_request("Invalid Shopify OAuth state timestamp"))?;
    if Utc::now().signed_duration_since(issued_at)
        > Duration::minutes(SHOPIFY_OAUTH_STATE_MAX_AGE_MINUTES)
    {
        return Err(ApiError::bad_request("Shopify OAuth session expired"));
    }

    Ok(())
}

fn verify_shopify_callback_hmac(
    raw_query: &str,
    provided_hmac: &str,
    client_secret: &str,
) -> ApiResult<()> {
    let mut pairs = raw_query
        .split('&')
        .filter(|pair| !pair.is_empty())
        .filter_map(|pair| {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            if key == "hmac" || key == "signature" {
                return None;
            }

            Some((decode_query_fragment(key), decode_query_fragment(value)))
        })
        .collect::<Vec<_>>();

    pairs.sort_by(|left, right| left.cmp(right));
    let message = pairs
        .into_iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("&");

    let mut mac = HmacSha256::new_from_slice(client_secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Shopify callback verifier");
        ApiError::internal()
    })?;
    mac.update(message.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    if constant_time_eq(expected.as_bytes(), provided_hmac.as_bytes()) {
        Ok(())
    } else {
        Err(ApiError::unauthorized())
    }
}

fn decode_query_fragment(value: &str) -> String {
    urlencoding::decode(value)
        .map(|decoded| decoded.into_owned())
        .unwrap_or_else(|_| value.to_string())
}

async fn exchange_code_for_access_token(
    shop_domain: &str,
    client_id: &str,
    client_secret: &str,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<ShopifyTokenResponse> {
    let client = Client::new();
    let response = client
        .post(format!("https://{shop_domain}/admin/oauth/access_token"))
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code),
            ("redirect_uri", redirect_uri),
        ])
        .send()
        .await
        .map_err(|error| {
            tracing::error!(shop_domain, %error, "Failed to exchange Shopify OAuth code");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(shop_domain, %status, body, "Shopify OAuth token exchange failed");
        return Err(ApiError::bad_request("Shopify authorization failed"));
    }

    response
        .json::<ShopifyTokenResponse>()
        .await
        .map_err(|error| {
            tracing::error!(shop_domain, %error, "Failed to parse Shopify OAuth token response");
            ApiError::internal()
        })
}

async fn fetch_shop_details(
    shop_domain: &str,
    access_token: &str,
) -> ApiResult<ShopifyShopDetails> {
    let payload = shopify_graphql_request(
        shop_domain,
        access_token,
        "query ChronicleShopDetails { shop { name myshopifyDomain } }",
        Value::Null,
    )
    .await?;

    Ok(ShopifyShopDetails {
        shop_domain: payload
            .pointer("/data/shop/myshopifyDomain")
            .and_then(Value::as_str)
            .map(ToString::to_string)
            .unwrap_or_else(|| shop_domain.to_string()),
        shop_name: payload
            .pointer("/data/shop/name")
            .and_then(Value::as_str)
            .map(ToString::to_string),
    })
}

async fn reconcile_remote_webhooks(
    shop_domain: &str,
    access_token: &str,
    callback_url: &str,
) -> ApiResult<ShopifyWebhookProvisioningResult> {
    let existing = list_remote_webhooks(shop_domain, access_token).await?;
    let mut subscriptions = BTreeMap::new();

    for topic in MANAGED_TOPICS {
        let existing_topic = existing.iter().find(|webhook| webhook.topic == topic);
        let webhook = match existing_topic {
            Some(existing_topic)
                if existing_topic.callback_url.as_deref() == Some(callback_url) =>
            {
                existing_topic.clone()
            }
            Some(existing_topic) => {
                update_remote_webhook(shop_domain, access_token, &existing_topic.id, callback_url)
                    .await?
            }
            None => create_remote_webhook(shop_domain, access_token, topic, callback_url).await?,
        };
        subscriptions.insert(topic.to_string(), webhook.id);
    }

    Ok(ShopifyWebhookProvisioningResult { subscriptions })
}

async fn list_remote_webhooks(
    shop_domain: &str,
    access_token: &str,
) -> ApiResult<Vec<ShopifyRemoteWebhook>> {
    let query = r#"
        query ChronicleWebhookSubscriptions($first: Int!) {
          webhookSubscriptions(first: $first) {
            edges {
              node {
                id
                topic
                endpoint {
                  __typename
                  ... on WebhookHttpEndpoint {
                    callbackUrl
                  }
                }
              }
            }
          }
        }
    "#;
    let payload = shopify_graphql_request(
        shop_domain,
        access_token,
        query,
        serde_json::json!({ "first": 100 }),
    )
    .await?;

    let webhooks = payload
        .pointer("/data/webhookSubscriptions/edges")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|edge| edge.get("node").cloned())
        .filter_map(|node| {
            let topic = node.get("topic").and_then(Value::as_str)?;
            if !MANAGED_TOPICS.contains(&topic) {
                return None;
            }

            Some(ShopifyRemoteWebhook {
                id: node.get("id")?.as_str()?.to_string(),
                topic: topic.to_string(),
                callback_url: node
                    .pointer("/endpoint/callbackUrl")
                    .and_then(Value::as_str)
                    .map(ToString::to_string),
            })
        })
        .collect();

    Ok(webhooks)
}

async fn create_remote_webhook(
    shop_domain: &str,
    access_token: &str,
    topic: &str,
    callback_url: &str,
) -> ApiResult<ShopifyRemoteWebhook> {
    let query = r#"
        mutation ChronicleWebhookSubscriptionCreate(
          $topic: WebhookSubscriptionTopic!,
          $webhookSubscription: WebhookSubscriptionInput!
        ) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            userErrors {
              field
              message
            }
            webhookSubscription {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
    "#;
    let payload = shopify_graphql_request(
        shop_domain,
        access_token,
        query,
        serde_json::json!({
            "topic": topic,
            "webhookSubscription": {
                "callbackUrl": callback_url,
                "format": "JSON",
            }
        }),
    )
    .await?;
    parse_webhook_mutation_response(
        &payload,
        "/data/webhookSubscriptionCreate",
        "Failed to create the Shopify webhook",
    )
}

async fn update_remote_webhook(
    shop_domain: &str,
    access_token: &str,
    webhook_id: &str,
    callback_url: &str,
) -> ApiResult<ShopifyRemoteWebhook> {
    let query = r#"
        mutation ChronicleWebhookSubscriptionUpdate(
          $id: ID!,
          $webhookSubscription: WebhookSubscriptionInput!
        ) {
          webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhookSubscription) {
            userErrors {
              field
              message
            }
            webhookSubscription {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
    "#;
    let payload = shopify_graphql_request(
        shop_domain,
        access_token,
        query,
        serde_json::json!({
            "id": webhook_id,
            "webhookSubscription": {
                "callbackUrl": callback_url,
                "format": "JSON",
            }
        }),
    )
    .await?;
    parse_webhook_mutation_response(
        &payload,
        "/data/webhookSubscriptionUpdate",
        "Failed to update the Shopify webhook",
    )
}

async fn delete_remote_webhook(
    shop_domain: &str,
    access_token: &str,
    webhook_id: &str,
) -> ApiResult<()> {
    let query = r#"
        mutation ChronicleWebhookSubscriptionDelete($id: ID!) {
          webhookSubscriptionDelete(id: $id) {
            userErrors {
              field
              message
            }
            deletedWebhookSubscriptionId
          }
        }
    "#;
    let payload = shopify_graphql_request(
        shop_domain,
        access_token,
        query,
        serde_json::json!({ "id": webhook_id }),
    )
    .await?;

    let container = payload
        .pointer("/data/webhookSubscriptionDelete")
        .ok_or_else(|| ApiError::bad_request("Failed to delete the Shopify webhook"))?;

    let errors = graphql_user_errors(container.get("userErrors"));
    if !errors.is_empty() {
        return Err(ApiError::bad_request(errors.join("; ")));
    }

    Ok(())
}

async fn shopify_graphql_request(
    shop_domain: &str,
    access_token: &str,
    query: &str,
    variables: Value,
) -> ApiResult<Value> {
    let client = Client::new();
    let response = client
        .post(format!(
            "https://{shop_domain}/admin/api/{SHOPIFY_ADMIN_API_VERSION}/graphql.json"
        ))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("X-Shopify-Access-Token", access_token)
        .json(&serde_json::json!({
            "query": query,
            "variables": variables,
        }))
        .send()
        .await
        .map_err(|error| {
            tracing::error!(shop_domain, %error, "Failed to call Shopify Admin GraphQL API");
            ApiError::internal()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(shop_domain, %status, body, "Shopify GraphQL request failed");
        return Err(ApiError::bad_request("Shopify API request failed"));
    }

    let payload = response.json::<Value>().await.map_err(|error| {
        tracing::error!(shop_domain, %error, "Failed to parse Shopify GraphQL response");
        ApiError::internal()
    })?;

    if let Some(errors) = payload.get("errors") {
        tracing::warn!(shop_domain, errors = %errors, "Shopify GraphQL returned top-level errors");
        return Err(ApiError::bad_request("Shopify API request failed"));
    }

    Ok(payload)
}

fn parse_webhook_mutation_response(
    payload: &Value,
    pointer: &str,
    error_message: &str,
) -> ApiResult<ShopifyRemoteWebhook> {
    let container = payload
        .pointer(pointer)
        .ok_or_else(|| ApiError::bad_request(error_message))?;
    let errors = graphql_user_errors(container.get("userErrors"));
    if !errors.is_empty() {
        return Err(ApiError::bad_request(errors.join("; ")));
    }

    let webhook = container
        .get("webhookSubscription")
        .ok_or_else(|| ApiError::bad_request(error_message))?;
    let id = webhook
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request(error_message))?;
    let topic = webhook
        .get("topic")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request(error_message))?;

    Ok(ShopifyRemoteWebhook {
        id: id.to_string(),
        topic: topic.to_string(),
        callback_url: webhook
            .pointer("/endpoint/callbackUrl")
            .and_then(Value::as_str)
            .map(ToString::to_string),
    })
}

fn graphql_user_errors(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|error| {
            error
                .get("message")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect()
}

fn verify_shopify_webhook_signature(
    headers: &HeaderMap,
    body: &str,
    client_secret: &str,
) -> ApiResult<()> {
    let provided = headers
        .get(SHOPIFY_WEBHOOK_HMAC_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;

    let mut mac = HmacSha256::new_from_slice(client_secret.as_bytes()).map_err(|error| {
        tracing::error!(%error, "Failed to initialize Shopify webhook verifier");
        ApiError::internal()
    })?;
    mac.update(body.as_bytes());
    let expected = STANDARD.encode(mac.finalize().into_bytes());

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

fn normalize_shopify_event(
    tenant_id: &str,
    shop_domain: &str,
    topic: &str,
    payload: &Value,
    raw_body: &str,
    headers: &HeaderMap,
) -> ShopifyNormalizedEvent {
    let external_id = shopify_external_id(payload)
        .or_else(|| {
            headers
                .get(SHOPIFY_EVENT_ID_HEADER)
                .and_then(|value| value.to_str().ok())
                .map(ToString::to_string)
        })
        .or_else(|| {
            headers
                .get(SHOPIFY_WEBHOOK_ID_HEADER)
                .and_then(|value| value.to_str().ok())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| format!("payload:{}", &hash_json_value(payload)[..24]));
    let source_event_id = format!("shopify:{shop_domain}:{topic}:{external_id}");
    let occurred_at = shopify_occurred_at(payload).unwrap_or_else(Utc::now);
    let event_type = shopify_event_type(topic);
    let entities = shopify_entities(shop_domain, topic, payload);
    let actor = shopify_actor(topic, payload);

    let payload_value = serde_json::json!({
        "shop_domain": shop_domain,
        "topic": topic,
        "payload": payload,
    });

    ShopifyNormalizedEvent {
        source_event_id: source_event_id.clone(),
        event: build_native_event(
            tenant_id,
            SHOPIFY_PROVIDER,
            &event_type,
            occurred_at,
            None,
            payload_value,
            entities,
            Some(raw_body.to_string()),
            Some(serde_json::json!({
                "actor": actor,
                "provider": SHOPIFY_PROVIDER,
                "shop_domain": shop_domain,
                "topic": topic,
                "external_id": external_id,
            })),
            Some(serde_json::json!({
                "source_event_id": source_event_id,
                "webhook_id": headers
                    .get(SHOPIFY_WEBHOOK_ID_HEADER)
                    .and_then(|value| value.to_str().ok()),
            })),
        ),
    }
}

fn shopify_external_id(payload: &Value) -> Option<String> {
    payload
        .get("admin_graphql_api_id")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .or_else(|| {
            payload.get("id").and_then(|value| match value {
                Value::String(value) => Some(value.to_string()),
                Value::Number(value) => Some(value.to_string()),
                _ => None,
            })
        })
}

fn shopify_occurred_at(payload: &Value) -> Option<DateTime<Utc>> {
    ["processed_at", "updated_at", "created_at"]
        .iter()
        .find_map(|field| payload.get(*field).and_then(shopify_value_to_datetime))
}

fn shopify_value_to_datetime(value: &Value) -> Option<DateTime<Utc>> {
    match value {
        Value::String(value) => DateTime::parse_from_rfc3339(value)
            .ok()
            .map(|value| value.with_timezone(&Utc)),
        Value::Number(value) => value.as_i64().and_then(shopify_timestamp_to_datetime),
        _ => None,
    }
}

fn shopify_timestamp_to_datetime(timestamp: i64) -> Option<DateTime<Utc>> {
    let (seconds, nanos) = if timestamp > 1_000_000_000_000 {
        (timestamp / 1_000, ((timestamp % 1_000) * 1_000_000) as u32)
    } else {
        (timestamp, 0)
    };
    Utc.timestamp_opt(seconds, nanos).single()
}

fn shopify_event_type(topic: &str) -> String {
    match topic {
        "orders/create" => "shopify.order.created".to_string(),
        "orders/updated" => "shopify.order.updated".to_string(),
        "orders/paid" => "shopify.order.paid".to_string(),
        "customers/create" => "shopify.customer.created".to_string(),
        "customers/update" => "shopify.customer.updated".to_string(),
        "shop/update" => "shopify.shop.updated".to_string(),
        "app/uninstalled" => "shopify.app.uninstalled".to_string(),
        _ => format!("shopify.{}", topic.replace('/', ".")),
    }
}

fn shopify_entities(shop_domain: &str, topic: &str, payload: &Value) -> Vec<(String, String)> {
    let mut entities = vec![("shop".to_string(), shop_domain.to_string())];
    if topic.starts_with("orders/") {
        if let Some(order_id) = shopify_external_id(payload) {
            entities.push(("order".to_string(), order_id));
        }
    } else if topic.starts_with("customers/") {
        if let Some(customer_id) = shopify_external_id(payload) {
            entities.push(("customer".to_string(), customer_id));
        }
    }
    entities
}

fn shopify_actor(topic: &str, payload: &Value) -> Value {
    if topic.starts_with("customers/") {
        return serde_json::json!({
            "actor_type": "customer",
            "actor_id": shopify_external_id(payload),
            "name": payload.get("email").and_then(Value::as_str),
        });
    }

    serde_json::json!({
        "actor_type": "system",
        "actor_id": SHOPIFY_PROVIDER,
        "name": Value::Null,
    })
}

fn hash_json_value(value: &Value) -> String {
    let serialized = serde_json::to_string(value).unwrap_or_else(|_| "null".to_string());
    let mut digest = Sha256::new();
    digest.update(serialized.as_bytes());
    hex::encode(digest.finalize())
}

fn split_scopes(scope: Option<&str>) -> Value {
    let scopes = scope
        .unwrap_or_default()
        .split(',')
        .filter(|scope| !scope.trim().is_empty())
        .map(|scope| Value::String(scope.trim().to_string()))
        .collect::<Vec<_>>();
    Value::Array(scopes)
}

fn subscriptions_value(subscriptions: &BTreeMap<String, String>) -> Value {
    Value::Object(
        subscriptions
            .iter()
            .map(|(topic, webhook_id)| (topic.clone(), Value::String(webhook_id.clone())))
            .collect(),
    )
}

fn shopify_webhook_subscriptions(metadata: Option<&Value>) -> HashMap<String, String> {
    metadata
        .and_then(|metadata| metadata.get("webhook_subscriptions"))
        .and_then(Value::as_object)
        .map(|subscriptions| {
            subscriptions
                .iter()
                .filter_map(|(topic, webhook_id)| {
                    webhook_id
                        .as_str()
                        .map(|webhook_id| (topic.clone(), webhook_id.to_string()))
                })
                .collect::<HashMap<_, _>>()
        })
        .unwrap_or_default()
}

fn merge_shopify_metadata(existing: Option<Value>, patch: Value) -> Value {
    let mut metadata = match existing {
        Some(Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    };

    metadata.insert(
        "provider".to_string(),
        Value::String(SHOPIFY_PROVIDER.to_string()),
    );
    metadata.insert(
        "transport".to_string(),
        Value::String(SHOPIFY_TRANSPORT.to_string()),
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

async fn upsert_shopify_metadata(
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
                provider: SHOPIFY_PROVIDER.to_string(),
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

fn shopify_metadata_string(connection: Option<&Connection>, key: &str) -> Option<String> {
    connection?
        .metadata
        .as_ref()?
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn shopify_metadata_u64(metadata: Option<&Value>, key: &str) -> u64 {
    metadata
        .and_then(|metadata| metadata.get(key))
        .and_then(Value::as_u64)
        .unwrap_or(0)
}

fn shopify_event_count(metadata: Option<&Value>) -> u64 {
    shopify_metadata_u64(metadata, "event_count")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_shop_domain() {
        assert_eq!(
            normalize_shop_domain("https://Example-Shop.myshopify.com/admin").unwrap(),
            "example-shop.myshopify.com"
        );
        assert!(normalize_shop_domain("example.com").is_err());
    }

    #[test]
    fn verifies_callback_hmac() {
        let raw_query = "code=abc&shop=test-shop.myshopify.com&state=state123&timestamp=1700000000";
        let mut mac = HmacSha256::new_from_slice(b"secret").unwrap();
        mac.update(raw_query.as_bytes());
        let hmac = hex::encode(mac.finalize().into_bytes());

        assert!(verify_shopify_callback_hmac(raw_query, &hmac, "secret").is_ok());
        assert!(verify_shopify_callback_hmac(raw_query, "bad", "secret").is_err());
    }

    #[test]
    fn verifies_webhook_signature() {
        let body = r#"{"id":1}"#;
        let mut mac = HmacSha256::new_from_slice(b"secret").unwrap();
        mac.update(body.as_bytes());
        let signature = STANDARD.encode(mac.finalize().into_bytes());
        let mut headers = HeaderMap::new();
        headers.insert(SHOPIFY_WEBHOOK_HMAC_HEADER, signature.parse().unwrap());

        assert!(verify_shopify_webhook_signature(&headers, body, "secret").is_ok());
        assert!(verify_shopify_webhook_signature(&headers, body, "wrong").is_err());
    }

    #[test]
    fn normalizes_shopify_topics() {
        assert_eq!(shopify_event_type("orders/create"), "shopify.order.created");
        assert_eq!(
            shopify_event_type("app/uninstalled"),
            "shopify.app.uninstalled"
        );
        assert_eq!(
            shopify_event_type("products/create"),
            "shopify.products.create"
        );
    }

    #[test]
    fn builds_dedupe_key_from_domain_topic_and_external_id() {
        let headers = HeaderMap::new();
        let payload = serde_json::json!({
            "admin_graphql_api_id": "gid://shopify/Order/1",
            "created_at": "2026-04-14T12:00:00Z"
        });

        let normalized = normalize_shopify_event(
            "tenant_1",
            "test-store.myshopify.com",
            "orders/create",
            &payload,
            "{}",
            &headers,
        );

        assert_eq!(
            normalized.source_event_id,
            "shopify:test-store.myshopify.com:orders/create:gid://shopify/Order/1"
        );
    }
}
