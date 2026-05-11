use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use chronicle_auth::types::AuthUser;
use chronicle_core::event::Event as ChronicleEvent;
use chronicle_domain::{Connection, CreateConnectionInput, TenantId};
use chronicle_infra::conversion::build_native_event;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

const TRELLUS_PROVIDER: &str = "trellus";
const TRELLUS_DISPLAY_NAME: &str = "Trellus.ai";
const TRELLUS_DESCRIPTION: &str = "Receive Trellus call events via direct webhook.";
const TRELLUS_TRANSPORT: &str = "webhook";
const TRELLUS_HEADER_NAME: &str = "x-chronicle-webhook-secret";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrellusIntegrationResponse {
    pub provider: String,
    pub display_name: String,
    pub description: String,
    pub transport: String,
    pub connection: Option<Connection>,
    pub webhook_url: Option<String>,
    pub header_name: String,
    pub header_value: Option<String>,
    pub setup_status: String,
    pub last_received_at: Option<String>,
    pub event_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrellusSetupBody {
    pub rotate_secret: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrellusWebhookResponse {
    pub received: bool,
    pub ingested: bool,
    pub duplicate: bool,
    pub event_id: Option<String>,
}

pub async fn get_integration(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<TrellusIntegrationResponse>> {
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, TRELLUS_PROVIDER)
        .await?;

    Ok(Json(build_integration_response(&state, connection, None)))
}

pub async fn setup(
    user: AuthUser,
    State(state): State<SaasAppState>,
    body: Option<Json<TrellusSetupBody>>,
) -> ApiResult<Json<TrellusIntegrationResponse>> {
    let existing = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, TRELLUS_PROVIDER)
        .await?;
    let should_rotate = body
        .as_ref()
        .and_then(|Json(body)| body.rotate_secret)
        .unwrap_or_else(|| trellus_secret_hash(existing.as_ref()).is_none());

    if existing.is_some() && !should_rotate {
        return Ok(Json(build_integration_response(&state, existing, None)));
    }

    let header_value = should_rotate.then(generate_trellus_secret);

    let metadata = merge_trellus_metadata(
        existing
            .as_ref()
            .and_then(|connection| connection.metadata.clone()),
        header_value.as_deref().map(hash_secret),
        serde_json::json!({
            "setup_status": "awaiting_test_event",
            "setup_started_at": Utc::now().to_rfc3339(),
            "webhook_header_name": TRELLUS_HEADER_NAME,
        }),
    );

    let connection = state
        .connections
        .upsert_by_tenant_provider(
            CreateConnectionInput {
                tenant_id: user.tenant_id,
                provider: TRELLUS_PROVIDER.to_string(),
                access_token: existing
                    .as_ref()
                    .and_then(|connection| connection.access_token.clone()),
                refresh_token: existing
                    .as_ref()
                    .and_then(|connection| connection.refresh_token.clone()),
                expires_at: existing
                    .as_ref()
                    .and_then(|connection| connection.expires_at),
                nango_connection_id: None,
                metadata: Some(metadata),
            },
            "awaiting_test_event",
        )
        .await?;

    Ok(Json(build_integration_response(
        &state,
        Some(connection),
        header_value,
    )))
}

pub async fn rotate_secret(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<TrellusIntegrationResponse>> {
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, TRELLUS_PROVIDER)
        .await?
        .ok_or_else(|| ApiError::not_found("Trellus connection"))?;
    let header_value = generate_trellus_secret();
    let metadata = merge_trellus_metadata(
        connection.metadata.clone(),
        Some(hash_secret(&header_value)),
        serde_json::json!({
            "setup_status": "awaiting_test_event",
            "secret_rotated_at": Utc::now().to_rfc3339(),
            "webhook_header_name": TRELLUS_HEADER_NAME,
        }),
    );
    let connection =
        upsert_trellus_metadata(&state, &connection, metadata, "awaiting_test_event").await?;

    Ok(Json(build_integration_response(
        &state,
        Some(connection),
        Some(header_value),
    )))
}

pub async fn disconnect(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<TrellusIntegrationResponse>> {
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, TRELLUS_PROVIDER)
        .await?
        .ok_or_else(|| ApiError::not_found("Trellus connection"))?;

    state.connections.delete(&connection.id).await?;

    Ok(Json(build_integration_response(&state, None, None)))
}

pub async fn webhook(
    State(state): State<SaasAppState>,
    Path(connection_id): Path<String>,
    headers: HeaderMap,
    body: String,
) -> ApiResult<Json<TrellusWebhookResponse>> {
    let connection = state
        .connections
        .find_by_id(&connection_id)
        .await?
        .filter(|connection| connection.provider == TRELLUS_PROVIDER)
        .ok_or_else(|| ApiError::not_found("Trellus connection"))?;

    verify_trellus_secret(&headers, &connection)?;

    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        tracing::warn!(connection_id, %error, "Invalid Trellus webhook JSON");
        ApiError::bad_request(format!("Invalid JSON: {error}"))
    })?;

    let (source_event_id, event) =
        normalize_trellus_payload(&connection.tenant_id, &payload, &body);
    let tenant_id = TenantId::new(connection.tenant_id.clone());
    let bypass_dedup = trellus_should_bypass_dedup(&connection);
    let duplicate = if bypass_dedup {
        false
    } else {
        state
            .event_store
            .exists(&tenant_id, TRELLUS_PROVIDER, &source_event_id)
            .await
            .map_err(|error| {
                tracing::error!(connection_id, %source_event_id, %error, "Failed to check Trellus duplicate event");
                ApiError::internal()
            })?
    };

    let mut event_id = None;
    if !duplicate {
        event_id = state
            .event_store
            .insert_events(&[event])
            .await
            .map_err(|error| {
                tracing::error!(connection_id, %source_event_id, %error, "Failed to store Trellus event");
                ApiError::internal()
            })?
            .into_iter()
            .next()
            .map(|id| id.to_string());
    }

    let metadata = merge_trellus_metadata(
        connection.metadata.clone(),
        None,
        serde_json::json!({
            "setup_status": "active",
            "last_received_at": Utc::now().to_rfc3339(),
            "last_source_event_id": source_event_id,
            "last_event_id": event_id,
            "event_count": trellus_event_count(connection.metadata.as_ref()) + if duplicate { 0 } else { 1 },
            "last_error": Value::Null,
        }),
    );
    let _connection = upsert_trellus_metadata(&state, &connection, metadata, "active").await?;

    Ok(Json(TrellusWebhookResponse {
        received: true,
        ingested: !duplicate,
        duplicate,
        event_id,
    }))
}

fn build_integration_response(
    state: &SaasAppState,
    connection: Option<Connection>,
    header_value: Option<String>,
) -> TrellusIntegrationResponse {
    let webhook_url = connection
        .as_ref()
        .map(|connection| build_webhook_url(&state.config.app_url, &connection.id));
    let setup_status = connection
        .as_ref()
        .and_then(|connection| {
            trellus_metadata_string(connection.metadata.as_ref(), "setup_status")
        })
        .unwrap_or_else(|| {
            if connection.is_some() {
                "awaiting_test_event".to_string()
            } else {
                "not_configured".to_string()
            }
        });
    let last_received_at = connection.as_ref().and_then(|connection| {
        trellus_metadata_string(connection.metadata.as_ref(), "last_received_at")
    });
    let event_count = connection
        .as_ref()
        .map(|connection| trellus_event_count(connection.metadata.as_ref()));

    TrellusIntegrationResponse {
        provider: TRELLUS_PROVIDER.to_string(),
        display_name: TRELLUS_DISPLAY_NAME.to_string(),
        description: TRELLUS_DESCRIPTION.to_string(),
        transport: TRELLUS_TRANSPORT.to_string(),
        connection,
        webhook_url,
        header_name: TRELLUS_HEADER_NAME.to_string(),
        header_value,
        setup_status,
        last_received_at,
        event_count,
    }
}

fn build_webhook_url(app_url: &str, connection_id: &str) -> String {
    format!(
        "{}/api/webhooks/trellus/{}",
        app_url.trim_end_matches('/'),
        connection_id
    )
}

fn generate_trellus_secret() -> String {
    format!("trsec_{}_{}", cuid2::create_id(), cuid2::create_id())
}

fn hash_secret(secret: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hex::encode(hasher.finalize())
}

fn merge_trellus_metadata(
    existing: Option<Value>,
    secret_hash: Option<String>,
    patch: Value,
) -> Value {
    let mut metadata = match existing {
        Some(Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    };

    metadata.insert(
        "connected_via".to_string(),
        Value::String("direct_webhook".to_string()),
    );
    metadata.insert(
        "provider".to_string(),
        Value::String(TRELLUS_PROVIDER.to_string()),
    );
    metadata.insert(
        "webhook_header_name".to_string(),
        Value::String(TRELLUS_HEADER_NAME.to_string()),
    );

    if let Some(secret_hash) = secret_hash {
        metadata.insert(
            "webhook_secret_hash".to_string(),
            Value::String(secret_hash),
        );
    }

    if let Value::Object(patch) = patch {
        for (key, value) in patch {
            metadata.insert(key, value);
        }
    }

    Value::Object(metadata)
}

async fn upsert_trellus_metadata(
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
                provider: TRELLUS_PROVIDER.to_string(),
                access_token: connection.access_token.clone(),
                refresh_token: connection.refresh_token.clone(),
                expires_at: connection.expires_at,
                nango_connection_id: None,
                metadata: Some(metadata),
            },
            status,
        )
        .await
        .map_err(Into::into)
}

fn verify_trellus_secret(headers: &HeaderMap, connection: &Connection) -> ApiResult<()> {
    let expected = trellus_secret_hash(Some(connection))
        .ok_or_else(|| ApiError::bad_request("Trellus webhook secret is not configured"))?;
    let provided = headers
        .get(TRELLUS_HEADER_NAME)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;

    if constant_time_eq(hash_secret(provided).as_bytes(), expected.as_bytes()) {
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

fn trellus_secret_hash(connection: Option<&Connection>) -> Option<String> {
    trellus_metadata_string(
        connection.and_then(|connection| connection.metadata.as_ref()),
        "webhook_secret_hash",
    )
}

fn trellus_metadata_string(metadata: Option<&Value>, key: &str) -> Option<String> {
    metadata?
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn trellus_event_count(metadata: Option<&Value>) -> u64 {
    metadata
        .and_then(|metadata| metadata.get("event_count"))
        .and_then(Value::as_u64)
        .unwrap_or(0)
}

fn trellus_should_bypass_dedup(connection: &Connection) -> bool {
    connection.status == "awaiting_test_event"
        || trellus_metadata_string(connection.metadata.as_ref(), "setup_status").as_deref()
            == Some("awaiting_test_event")
}

fn normalize_trellus_payload(
    tenant_id: &str,
    payload: &Value,
    raw_body: &str,
) -> (String, ChronicleEvent) {
    let session_id = value_as_non_empty_string(payload.get("session_id"));
    let source_event_id = session_id
        .as_ref()
        .map(|session_id| format!("trellus:{session_id}"))
        .unwrap_or_else(|| format!("trellus:body:{}", &hash_secret(raw_body)[..32]));
    let occurred_at = value_to_datetime(payload.get("timestamp")).unwrap_or_else(Utc::now);
    let event_type = resolve_trellus_event_type(payload);
    let entities = trellus_entities(payload, session_id.as_deref());
    let (actor_type, actor_id, actor_name) = trellus_actor(payload);

    (
        source_event_id.clone(),
        build_native_event(
            tenant_id,
            TRELLUS_PROVIDER,
            &event_type,
            occurred_at,
            None,
            payload.clone(),
            entities,
            Some(raw_body.to_string()),
            Some(serde_json::json!({
                "actor": {
                    "actor_type": actor_type,
                    "actor_id": actor_id,
                    "name": actor_name,
                },
                "provider": TRELLUS_PROVIDER,
            })),
            Some(serde_json::json!({
                "source_event_id": source_event_id,
            })),
        ),
    )
}

fn resolve_trellus_event_type(payload: &Value) -> String {
    let Some(status) = value_as_non_empty_string(payload.get("call_status")) else {
        return "trellus.call.completed".to_string();
    };
    let status = status.to_ascii_lowercase();
    if matches!(
        status.as_str(),
        "completed" | "complete" | "finished" | "ended" | "done" | "success" | "successful"
    ) || status.contains("complete")
        || status.contains("finish")
        || status.contains("end")
    {
        "trellus.call.completed".to_string()
    } else {
        "trellus.call.updated".to_string()
    }
}

fn trellus_entities(payload: &Value, session_id: Option<&str>) -> Vec<(String, String)> {
    let mut entities = Vec::new();
    push_entity(&mut entities, "session", session_id);
    push_entity(
        &mut entities,
        "contact",
        value_as_non_empty_string(payload.get("contact_id")).as_deref(),
    );
    push_entity(
        &mut entities,
        "rep",
        value_as_non_empty_string(payload.get("rep_id")).as_deref(),
    );
    push_entity(
        &mut entities,
        "company",
        value_as_non_empty_string(payload.get("company_name")).as_deref(),
    );
    push_entity(
        &mut entities,
        "phone",
        value_as_non_empty_string(payload.get("rep_number")).as_deref(),
    );
    push_entity(
        &mut entities,
        "phone",
        value_as_non_empty_string(payload.get("target_number")).as_deref(),
    );
    entities
}

fn push_entity(entities: &mut Vec<(String, String)>, entity_type: &str, entity_id: Option<&str>) {
    if let Some(entity_id) = entity_id {
        entities.push((entity_type.to_string(), entity_id.to_string()));
    }
}

fn trellus_actor(payload: &Value) -> (&'static str, String, Option<String>) {
    let inbound = payload
        .get("is_inbound")
        .and_then(Value::as_bool)
        .or_else(|| {
            value_as_non_empty_string(payload.get("direction"))
                .map(|direction| direction.eq_ignore_ascii_case("inbound"))
        })
        .unwrap_or(false);

    if inbound {
        (
            "customer",
            value_as_non_empty_string(payload.get("contact_id"))
                .or_else(|| value_as_non_empty_string(payload.get("target_number")))
                .unwrap_or_else(|| "trellus-customer".to_string()),
            value_as_non_empty_string(payload.get("contact_name")),
        )
    } else {
        (
            "agent",
            value_as_non_empty_string(payload.get("rep_id"))
                .or_else(|| value_as_non_empty_string(payload.get("rep_number")))
                .unwrap_or_else(|| "trellus-agent".to_string()),
            value_as_non_empty_string(payload.get("rep_name")),
        )
    }
}

fn value_as_non_empty_string(value: Option<&Value>) -> Option<String> {
    let value = match value? {
        Value::String(value) => value.trim().to_string(),
        Value::Number(value) => value.to_string(),
        Value::Bool(value) => value.to_string(),
        _ => return None,
    };

    (!value.is_empty()).then_some(value)
}

fn value_to_datetime(value: Option<&Value>) -> Option<DateTime<Utc>> {
    match value {
        Some(Value::String(value)) => DateTime::parse_from_rfc3339(value)
            .ok()
            .map(|date| date.with_timezone(&Utc)),
        Some(Value::Number(value)) => value.as_i64().and_then(timestamp_to_datetime),
        _ => None,
    }
}

fn timestamp_to_datetime(timestamp: i64) -> Option<DateTime<Utc>> {
    let (secs, nanos) = if timestamp > 1_000_000_000_000 {
        (timestamp / 1_000, ((timestamp % 1_000) * 1_000_000) as u32)
    } else {
        (timestamp, 0)
    };
    Utc.timestamp_opt(secs, nanos).single()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn normalizes_trellus_completed_call() {
        let payload = serde_json::json!({
            "session_id": "sess_123",
            "timestamp": "2026-04-07T20:00:00Z",
            "call_status": "completed",
            "is_inbound": true,
            "contact_id": "contact_1",
            "contact_name": "Jane Customer",
            "rep_id": "rep_1",
            "rep_name": "Sam Rep",
            "company_name": "Acme",
            "target_number": "+15555550001",
            "summary": "Customer asked about pricing."
        });

        let (source_event_id, event) =
            normalize_trellus_payload("tenant_1", &payload, &payload.to_string());

        assert_eq!(source_event_id, "trellus:sess_123");
        assert_eq!(event.source.as_str(), TRELLUS_PROVIDER);
        assert_eq!(event.event_type.as_str(), "trellus.call.completed");
        assert_eq!(event.event_time.to_rfc3339(), "2026-04-07T20:00:00+00:00");
        assert!(event.raw_body.is_some());
        assert!(event
            .entity_refs
            .iter()
            .any(|entity| entity.entity_type.as_str() == "session"
                && entity.entity_id.as_str() == "sess_123"));
    }

    #[test]
    fn normalizes_trellus_payload_without_session_id() {
        let payload = serde_json::json!({
            "timestamp": 1775592000000i64,
            "call_status": "in_progress",
            "direction": "outbound",
            "rep_number": "+15555550002"
        });

        let (source_event_id, event) =
            normalize_trellus_payload("tenant_1", &payload, &payload.to_string());

        assert!(source_event_id.starts_with("trellus:body:"));
        assert_eq!(event.event_type.as_str(), "trellus.call.updated");
        assert_eq!(event.event_time.to_rfc3339(), "2026-04-07T20:00:00+00:00");
    }

    #[test]
    fn hashes_trellus_secret_deterministically() {
        let secret = "trsec_test";

        assert_eq!(hash_secret(secret), hash_secret(secret));
        assert!(constant_time_eq(
            hash_secret(secret).as_bytes(),
            hash_secret(secret).as_bytes()
        ));
        assert!(!constant_time_eq(
            hash_secret(secret).as_bytes(),
            hash_secret("different").as_bytes()
        ));
    }

    #[test]
    fn builds_webhook_url_from_app_url() {
        assert_eq!(
            build_webhook_url("https://app.example.com/", "conn_123"),
            "https://app.example.com/api/webhooks/trellus/conn_123"
        );
    }

    #[test]
    fn bypasses_dedup_while_awaiting_test_event() {
        let connection = Connection {
            id: "conn_1".to_string(),
            tenant_id: "tenant_1".to_string(),
            provider: TRELLUS_PROVIDER.to_string(),
            access_token: None,
            refresh_token: None,
            expires_at: None,
            nango_connection_id: None,
            metadata: Some(serde_json::json!({
                "setup_status": "awaiting_test_event"
            })),
            status: "awaiting_test_event".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(trellus_should_bypass_dedup(&connection));
    }

    #[test]
    fn does_not_bypass_dedup_after_activation() {
        let connection = Connection {
            id: "conn_1".to_string(),
            tenant_id: "tenant_1".to_string(),
            provider: TRELLUS_PROVIDER.to_string(),
            access_token: None,
            refresh_token: None,
            expires_at: None,
            nango_connection_id: None,
            metadata: Some(serde_json::json!({
                "setup_status": "active"
            })),
            status: "active".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(!trellus_should_bypass_dedup(&connection));
    }
}
