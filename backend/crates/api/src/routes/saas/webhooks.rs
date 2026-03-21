use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use chrono::{DateTime, TimeZone, Utc};
use serde_json::Value;

use chronicle_core::event::Event as ChronicleEvent;
use chronicle_domain::{Connection, CreateRunInput, TenantId};
use chronicle_infra::conversion::build_native_event;
use chronicle_sources_core::webhook::{DefaultSignatureVerifier, SignatureVerifier};

use super::error::{ApiError, ApiResult};
use super::integrations::{
    materialize_nango_connection, nango_provider_by_integration_id, nango_provider_by_name,
    persist_connection_metadata,
};
use crate::saas_state::SaasAppState;

// ── Nango Webhook ──

pub async fn nango_webhook(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    body: String,
) -> ApiResult<Json<Value>> {
    verify_nango_webhook_signature(
        &headers,
        &body,
        state.config.nango.webhook_secret.as_deref(),
    )?;

    let payload: Value = serde_json::from_str(&body)
        .map_err(|error| ApiError::bad_request(format!("Invalid JSON: {error}")))?;

    let webhook_type = payload
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("unknown");

    match webhook_type {
        "auth" => handle_nango_auth_webhook(&state, &payload).await,
        "sync" | "sync_error" => handle_nango_sync_webhook(&state, &payload).await,
        _ => Ok(Json(serde_json::json!({
            "received": true,
            "ignored": true,
            "type": webhook_type,
        }))),
    }
}

fn verify_nango_webhook_signature(
    headers: &HeaderMap,
    body: &str,
    webhook_secret: Option<&str>,
) -> ApiResult<()> {
    let Some(webhook_secret) = webhook_secret else {
        tracing::debug!("Skipping Nango webhook signature verification (secret not configured)");
        return Ok(());
    };

    let signature = headers
        .get("x-nango-hmac-sha256")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| {
            tracing::warn!("Missing X-Nango-Hmac-Sha256 header on Nango webhook");
            ApiError::unauthorized()
        })?;

    DefaultSignatureVerifier::verify_hmac_sha256(webhook_secret, body.as_bytes(), signature)
        .map_err(|error| {
            tracing::warn!(%error, "Invalid Nango webhook signature");
            ApiError::unauthorized()
        })
}

fn extract_nango_connection_id<'a>(payload: &'a Value) -> ApiResult<&'a str> {
    payload
        .get("connectionId")
        .or_else(|| payload.get("connection_id"))
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("Missing connectionId"))
}

fn extract_nango_provider_config_key<'a>(payload: &'a Value) -> ApiResult<&'a str> {
    payload
        .get("providerConfigKey")
        .or_else(|| payload.get("provider_config_key"))
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("Missing providerConfigKey"))
}

fn resolve_nango_auth_tenant_id(payload: &Value, existing: Option<&Connection>) -> Option<String> {
    payload
        .get("endUser")
        .and_then(|value| value.get("tags"))
        .and_then(|value| {
            value
                .get("organizationId")
                .or_else(|| value.get("tenantId"))
        })
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .or_else(|| {
            payload
                .get("organization")
                .and_then(|value| value.get("id"))
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .or_else(|| existing.map(|connection| connection.tenant_id.clone()))
}

fn nango_sync_failed(webhook_type: &str, payload: &Value) -> bool {
    webhook_type == "sync_error"
        || payload
            .get("success")
            .and_then(Value::as_bool)
            .is_some_and(|success| !success)
        || payload.get("error").is_some()
}

fn resolve_nango_sync_name<'a>(payload: &'a Value, default_sync_name: &'a str) -> &'a str {
    payload
        .get("syncName")
        .or_else(|| payload.get("sync_name"))
        .and_then(Value::as_str)
        .unwrap_or(default_sync_name)
}

fn nango_sync_bookmark_to_value(bookmark: Option<&NangoSyncBookmark>) -> Value {
    match bookmark {
        Some(bookmark) => serde_json::json!({
            "cursor": bookmark.cursor,
            "modified_after": bookmark.modified_after,
        }),
        None => Value::Null,
    }
}

async fn record_nango_audit_log(
    state: &SaasAppState,
    tenant_id: Option<&str>,
    action: &str,
    run_id: Option<&str>,
    event_id: Option<&str>,
    invocation_id: Option<&str>,
    payload: Value,
) {
    let Some(tenant_id) = tenant_id else {
        return;
    };

    if let Err(error) = state
        .audit_logs
        .create(
            tenant_id,
            action,
            Some("nango"),
            run_id,
            event_id,
            invocation_id,
            Some(payload),
        )
        .await
    {
        tracing::warn!(tenant_id, action, %error, "Failed to store Nango audit log");
    }
}

async fn record_nango_sync_batch_observability(
    state: &SaasAppState,
    tenant_id: &str,
    provider: &str,
    connection_id: &str,
    provider_config_key: &str,
    sync_name: &str,
    model: &str,
    fetched_records: usize,
    built_events: usize,
    inserted_event_ids: &[String],
    bookmark_before: Option<&NangoSyncBookmark>,
    bookmark_after: Option<&NangoSyncBookmark>,
) {
    let Some(first_event_id) = inserted_event_ids.first() else {
        return;
    };

    let invocation_id = format!("nango_sync_{provider}_{model}_{first_event_id}");
    let snapshot = serde_json::json!({
        "provider": provider,
        "connection_id": connection_id,
        "provider_config_key": provider_config_key,
        "sync_name": sync_name,
        "model": model,
        "fetched_records": fetched_records,
        "built_events": built_events,
        "inserted_count": inserted_event_ids.len(),
        "bookmark_before": nango_sync_bookmark_to_value(bookmark_before),
        "bookmark_after": nango_sync_bookmark_to_value(bookmark_after),
        "inserted_event_ids": inserted_event_ids,
    });

    let run = match state
        .runs
        .create(CreateRunInput {
            tenant_id: tenant_id.to_string(),
            workflow_id: None,
            event_id: first_event_id.clone(),
            invocation_id: invocation_id.clone(),
            mode: "shadow".to_string(),
            event_snapshot: Some(snapshot.clone()),
            context_pointers: None,
        })
        .await
    {
        Ok(run) => run,
        Err(error) => {
            tracing::warn!(
                tenant_id,
                provider,
                connection_id,
                model,
                %error,
                "Failed to create Nango shadow run"
            );
            return;
        }
    };

    if let Err(error) = state.runs.update_status(&run.id, "completed").await {
        tracing::warn!(
            tenant_id,
            provider,
            connection_id,
            model,
            %error,
            "Failed to mark Nango shadow run completed"
        );
    }

    record_nango_audit_log(
        state,
        Some(tenant_id),
        "nango_sync_batch_ingested",
        Some(&run.id),
        Some(first_event_id),
        Some(&invocation_id),
        snapshot,
    )
    .await;
}

async fn handle_nango_auth_webhook(
    state: &SaasAppState,
    payload: &Value,
) -> ApiResult<Json<Value>> {
    let success = payload
        .get("success")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let operation = payload
        .get("operation")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let connection_id = extract_nango_connection_id(payload)?;
    let provider_config_key = extract_nango_provider_config_key(payload)?;

    if operation == "deletion" {
        if let Some(connection) = state
            .connections
            .find_by_nango_connection_id(connection_id)
            .await?
        {
            state.connections.delete(&connection.id).await?;
        }

        return Ok(Json(serde_json::json!({
            "received": true,
            "type": "auth",
            "operation": operation,
            "deleted": true,
        })));
    }

    let existing = state
        .connections
        .find_by_nango_connection_id(connection_id)
        .await?;

    if !success {
        let tenant_id = resolve_nango_auth_tenant_id(payload, existing.as_ref());
        let provider_name = existing
            .as_ref()
            .map(|connection| connection.provider.clone())
            .or_else(|| {
                nango_provider_by_integration_id(&state.config, provider_config_key)
                    .map(|provider| provider.provider.to_string())
            })
            .or_else(|| {
                payload
                    .get("provider")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
            });
        let action = if operation == "refresh" {
            "nango_auth_refresh_failed"
        } else {
            "nango_auth_failed"
        };
        tracing::warn!(
            provider = provider_name.as_deref().unwrap_or("unknown"),
            connection_id,
            provider_config_key,
            operation,
            error = ?payload.get("error"),
            "Nango auth webhook reported failure"
        );
        record_nango_audit_log(
            state,
            tenant_id.as_deref(),
            action,
            None,
            None,
            None,
            serde_json::json!({
                "provider": provider_name,
                "connection_id": connection_id,
                "provider_config_key": provider_config_key,
                "operation": operation,
                "error": payload.get("error").cloned(),
                "payload": payload,
            }),
        )
        .await;

        return Ok(Json(serde_json::json!({
            "received": true,
            "type": "auth",
            "operation": operation,
            "success": false,
        })));
    }

    let provider = nango_provider_by_integration_id(&state.config, provider_config_key)
        .or_else(|| {
            payload
                .get("provider")
                .and_then(Value::as_str)
                .and_then(|provider| nango_provider_by_name(&state.config, provider))
        })
        .ok_or_else(|| ApiError::bad_request("Unsupported Nango provider"))?;

    let tenant_id = resolve_nango_auth_tenant_id(payload, existing.as_ref())
        .ok_or_else(|| ApiError::bad_request("Missing tenant mapping for Nango webhook"))?;

    let _connection = materialize_nango_connection(
        state,
        &tenant_id,
        provider.provider,
        connection_id,
        provider_config_key,
        None,
    )
    .await?;

    Ok(Json(serde_json::json!({
        "received": true,
        "type": "auth",
        "operation": operation,
        "provider": provider.provider,
        "connection_id": connection_id,
    })))
}

async fn handle_nango_sync_webhook(
    state: &SaasAppState,
    payload: &Value,
) -> ApiResult<Json<Value>> {
    let webhook_type = payload
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("sync");
    let connection_id = extract_nango_connection_id(payload)?;
    let connection = state
        .connections
        .find_by_nango_connection_id(connection_id)
        .await?;

    if nango_sync_failed(webhook_type, payload) {
        let provider = connection
            .as_ref()
            .map(|connection| connection.provider.clone());
        let provider_descriptor = provider
            .as_deref()
            .and_then(|provider| nango_provider_by_name(&state.config, provider));
        let default_model = provider_descriptor
            .as_ref()
            .map(|provider| provider.model)
            .or_else(|| payload.get("model").and_then(Value::as_str))
            .unwrap_or("unknown");
        let models = extract_sync_models(payload, default_model);
        let sync_name = resolve_nango_sync_name(
            payload,
            provider_descriptor
                .as_ref()
                .map(|provider| provider.sync_name)
                .unwrap_or("unknown"),
        );
        let provider_config_key = payload
            .get("providerConfigKey")
            .or_else(|| payload.get("provider_config_key"))
            .and_then(Value::as_str)
            .unwrap_or_else(|| {
                provider_descriptor
                    .as_ref()
                    .map(|provider| provider.integration_id.as_str())
                    .unwrap_or("unknown")
            });

        tracing::warn!(
            provider = provider.as_deref().unwrap_or("unknown"),
            connection_id,
            provider_config_key,
            sync_name,
            models = ?models,
            error = ?payload.get("error"),
            "Nango sync webhook reported failure"
        );

        record_nango_audit_log(
            state,
            connection
                .as_ref()
                .map(|connection| connection.tenant_id.as_str()),
            "nango_sync_failed",
            None,
            None,
            None,
            serde_json::json!({
                "provider": provider,
                "connection_id": connection_id,
                "provider_config_key": provider_config_key,
                "sync_name": sync_name,
                "models": models,
                "error": payload.get("error").cloned(),
                "payload": payload,
            }),
        )
        .await;

        return Ok(Json(serde_json::json!({
            "received": true,
            "type": webhook_type,
            "success": false,
        })));
    }

    let mut connection = connection.ok_or_else(|| ApiError::not_found("Connection"))?;

    let provider = nango_provider_by_name(&state.config, &connection.provider)
        .ok_or_else(|| ApiError::bad_request("Unsupported Nango provider"))?;
    let provider_config_key = payload
        .get("providerConfigKey")
        .or_else(|| payload.get("provider_config_key"))
        .and_then(Value::as_str)
        .or_else(|| {
            connection
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("provider_config_key"))
                .and_then(Value::as_str)
        })
        .unwrap_or(provider.integration_id.as_str())
        .to_string();
    let modified_after = payload
        .get("modifiedAfter")
        .or_else(|| payload.get("modified_after"))
        .and_then(Value::as_str);
    let sync_type = payload
        .get("syncType")
        .or_else(|| payload.get("sync_type"))
        .and_then(Value::as_str);
    let sync_name = resolve_nango_sync_name(payload, provider.sync_name);
    let models = extract_sync_models(payload, provider.model);
    tracing::info!(
        provider = provider.provider,
        connection_id,
        provider_config_key = %provider_config_key,
        sync_name,
        sync_type,
        payload_model = payload.get("model").and_then(|value| value.as_str()),
        resolved_models = ?models,
        "Processing Nango sync webhook"
    );
    let mut total_records = 0usize;
    let mut total_ingested = 0usize;

    for model in models {
        let bookmark =
            read_nango_sync_bookmark(connection.metadata.as_ref(), &provider_config_key, &model);
        let fetched = fetch_nango_records(
            state,
            connection_id,
            &provider_config_key,
            &model,
            bookmark.as_ref(),
            modified_after,
            sync_type,
        )
        .await?;

        total_records += fetched.records.len();

        let events = match provider.provider {
            "intercom" => normalize_intercom_records(&connection.tenant_id, &fetched.records),
            "slack" => normalize_slack_records(&connection.tenant_id, &fetched.records),
            "front" => normalize_front_records(&connection.tenant_id, &fetched.records),
            other => {
                tracing::warn!(
                    provider = other,
                    model,
                    "Ignoring Nango sync for unsupported provider"
                );
                Vec::new()
            }
        };
        let built_events = events.len();

        let bookmark_after = fetched.bookmark.clone();
        let inserted =
            insert_nango_events(state, &connection.tenant_id, provider.provider, events).await?;
        total_ingested += inserted.ingested;

        tracing::info!(
            provider = provider.provider,
            connection_id,
            model,
            fetched_records = fetched.records.len(),
            built_events,
            ingested = inserted.ingested,
            total_ingested,
            bookmark_before = ?bookmark,
            bookmark_after = ?bookmark_after,
            "Processed Nango sync model"
        );

        if let Some(ref next_bookmark) = bookmark_after {
            let metadata = merge_nango_sync_bookmark(
                connection.metadata.clone(),
                &provider_config_key,
                &model,
                next_bookmark,
            );
            connection = persist_connection_metadata(state, &connection, metadata).await?;
        }

        record_nango_sync_batch_observability(
            state,
            &connection.tenant_id,
            provider.provider,
            connection_id,
            &provider_config_key,
            sync_name,
            &model,
            fetched.records.len(),
            built_events,
            &inserted.inserted_event_ids,
            bookmark.as_ref(),
            bookmark_after.as_ref(),
        )
        .await;
    }

    Ok(Json(serde_json::json!({
        "received": true,
        "type": "sync",
        "provider": provider.provider,
        "connection_id": connection_id,
        "records": total_records,
        "ingested": total_ingested,
    })))
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NangoSyncBookmark {
    cursor: Option<String>,
    modified_after: Option<String>,
}

#[derive(Debug)]
struct FetchedNangoRecords {
    records: Vec<Value>,
    bookmark: Option<NangoSyncBookmark>,
}

#[derive(Debug, Default)]
struct InsertedNangoEvents {
    ingested: usize,
    inserted_event_ids: Vec<String>,
}

fn extract_sync_models(payload: &Value, default_model: &str) -> Vec<String> {
    if let Some(records) = payload.get("records").and_then(Value::as_object) {
        let models = records
            .iter()
            .filter_map(|(model, stats)| {
                let added = stats.get("added").and_then(Value::as_u64).unwrap_or(0);
                let updated = stats.get("updated").and_then(Value::as_u64).unwrap_or(0);
                let deleted = stats.get("deleted").and_then(Value::as_u64).unwrap_or(0);

                if added > 0 || updated > 0 || deleted > 0 {
                    Some(model.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        if !models.is_empty() {
            return models;
        }
    }

    payload
        .get("model")
        .or_else(|| payload.get("modelName"))
        .and_then(Value::as_str)
        .map(|model| vec![model.to_string()])
        .unwrap_or_else(|| vec![default_model.to_string()])
}

async fn fetch_nango_records(
    state: &SaasAppState,
    connection_id: &str,
    provider_config_key: &str,
    model: &str,
    bookmark: Option<&NangoSyncBookmark>,
    modified_after: Option<&str>,
    sync_type: Option<&str>,
) -> ApiResult<FetchedNangoRecords> {
    let nango = state
        .nango
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Nango is not configured"))?;

    let mut cursor = bookmark.and_then(|bookmark| bookmark.cursor.clone());
    let mut latest_cursor = cursor.clone();
    let mut latest_modified_after = bookmark.and_then(|bookmark| bookmark.modified_after.clone());
    let initial_modified_after = if cursor.is_some() || matches!(sync_type, Some("INITIAL")) {
        None
    } else {
        bookmark
            .and_then(|bookmark| bookmark.modified_after.as_deref())
            .or(modified_after)
            .map(ToString::to_string)
    };
    let mut records = Vec::new();

    loop {
        let response = nango
            .get_records(
                connection_id,
                provider_config_key,
                model,
                cursor.as_deref(),
                if cursor.is_none() {
                    initial_modified_after.as_deref()
                } else {
                    None
                },
            )
            .await
            .map_err(|error| {
                tracing::error!(connection_id, provider_config_key, model, %error, "Failed to fetch Nango records");
                ApiError::bad_request(format!("Failed to fetch Nango records: {error}"))
            })?;

        for record in &response.records {
            if let Some(record_cursor) = extract_nango_record_cursor(record) {
                latest_cursor = Some(record_cursor);
            }
            if let Some(record_modified_after) = extract_nango_record_modified_after(record) {
                latest_modified_after = Some(record_modified_after);
            }
        }

        records.extend(response.records);

        match response.next_cursor {
            Some(next_cursor) if !next_cursor.is_empty() => {
                latest_cursor = Some(next_cursor.clone());
                cursor = Some(next_cursor);
            }
            _ => break,
        }
    }

    let bookmark = if records.is_empty() {
        bookmark.cloned().or_else(|| {
            latest_modified_after.map(|modified_after| NangoSyncBookmark {
                cursor: latest_cursor,
                modified_after: Some(modified_after),
            })
        })
    } else {
        Some(NangoSyncBookmark {
            cursor: latest_cursor,
            modified_after: latest_modified_after,
        })
    };

    Ok(FetchedNangoRecords { records, bookmark })
}

fn read_nango_sync_bookmark(
    metadata: Option<&Value>,
    provider_config_key: &str,
    model: &str,
) -> Option<NangoSyncBookmark> {
    let bookmark = metadata?
        .get("nango_sync_bookmarks")?
        .get(provider_config_key)?
        .get(model)?;

    Some(NangoSyncBookmark {
        cursor: bookmark
            .get("cursor")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        modified_after: bookmark
            .get("modified_after")
            .or_else(|| bookmark.get("modifiedAfter"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
    })
}

fn merge_nango_sync_bookmark(
    existing: Option<Value>,
    provider_config_key: &str,
    model: &str,
    bookmark: &NangoSyncBookmark,
) -> Value {
    let mut metadata = match existing {
        Some(Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    };

    let bookmarks_value = metadata
        .entry("nango_sync_bookmarks".to_string())
        .or_insert_with(|| serde_json::json!({}));
    let bookmarks_map = match bookmarks_value {
        Value::Object(map) => map,
        other => {
            *other = serde_json::json!({});
            other
                .as_object_mut()
                .expect("bookmark root should be object")
        }
    };

    let provider_value = bookmarks_map
        .entry(provider_config_key.to_string())
        .or_insert_with(|| serde_json::json!({}));
    let provider_map = match provider_value {
        Value::Object(map) => map,
        other => {
            *other = serde_json::json!({});
            other
                .as_object_mut()
                .expect("provider bookmark should be object")
        }
    };

    provider_map.insert(
        model.to_string(),
        serde_json::json!({
            "cursor": bookmark.cursor,
            "modified_after": bookmark.modified_after,
        }),
    );

    Value::Object(metadata)
}

fn extract_nango_record_cursor(record: &Value) -> Option<String> {
    record
        .get("_nango_metadata")
        .and_then(|metadata| metadata.get("cursor"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn extract_nango_record_modified_after(record: &Value) -> Option<String> {
    record
        .get("_nango_metadata")
        .and_then(|metadata| metadata.get("last_modified_at"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn normalize_intercom_records(tenant_id: &str, records: &[Value]) -> Vec<(String, ChronicleEvent)> {
    let mut events = Vec::new();
    for record in records {
        let is_message_record =
            record.get("conversation_id").is_some() && record.get("author").is_some();

        if is_message_record {
            let conversation_id = record.get("conversation_id").and_then(Value::as_str);
            let Some(conversation_id) = conversation_id else {
                continue;
            };

            let message_id = record
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("message");
            let occurred_at = value_to_datetime(record.get("created_at")).unwrap_or_else(Utc::now);
            let author = record.get("author");
            let (actor_type, actor_id, actor_name) = actor_from_author(author, "intercom");
            let message_kind = record
                .get("type")
                .or_else(|| record.get("part_type"))
                .and_then(Value::as_str)
                .unwrap_or("message");
            let event_type = if message_kind.contains("note") || message_kind.contains("comment") {
                "support.note.internal"
            } else if actor_type == "agent" {
                "support.message.agent"
            } else {
                "support.message.customer"
            };

            events.push(build_nango_native_event(
                tenant_id,
                "intercom",
                event_type,
                &format!("intercom:{conversation_id}:message:{message_id}"),
                occurred_at,
                conversation_id,
                None,
                &actor_type,
                &actor_id,
                actor_name.as_deref(),
                serde_json::json!({
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "body": record.get("body").cloned(),
                    "author": author.cloned(),
                    "raw": record,
                }),
            ));

            continue;
        }

        let conversation_id = record.get("id").and_then(Value::as_str);
        let Some(conversation_id) = conversation_id else {
            continue;
        };

        let customer_id = record
            .get("contact")
            .and_then(|value| value.get("id"))
            .and_then(Value::as_str)
            .or_else(|| {
                record
                    .get("contacts")
                    .and_then(Value::as_array)
                    .and_then(|items| items.first())
                    .and_then(|value| value.get("contact_id").or_else(|| value.get("id")))
                    .and_then(Value::as_str)
            });

        let created_at = value_to_datetime(record.get("created_at")).unwrap_or_else(Utc::now);

        events.push(build_nango_native_event(
            tenant_id,
            "intercom",
            "support.conversation.created",
            &format!("intercom:{conversation_id}:conversation"),
            created_at,
            conversation_id,
            customer_id,
            "system",
            "intercom",
            None,
            serde_json::json!({
                "conversation_id": conversation_id,
                "state": record.get("state").cloned(),
                "open": record.get("open").cloned(),
                "read": record.get("read").cloned(),
                "priority": record.get("priority").cloned(),
                "contacts": record.get("contacts").cloned(),
                "raw": record,
            }),
        ));
    }

    events
}

fn normalize_front_records(tenant_id: &str, records: &[Value]) -> Vec<(String, ChronicleEvent)> {
    let mut events = Vec::new();
    for record in records {
        let conversation_id = record
            .get("conversation_id")
            .or_else(|| record.get("id"))
            .and_then(Value::as_str);
        let Some(conversation_id) = conversation_id else {
            continue;
        };

        let customer_id = record
            .get("contacts")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|value| value.get("id"))
            .and_then(Value::as_str);
        let created_at = value_to_datetime(record.get("created_at")).unwrap_or_else(Utc::now);
        let updated_at = value_to_datetime(record.get("updated_at")).unwrap_or(created_at);

        events.push(build_nango_native_event(
            tenant_id,
            "front",
            "front.conversation.created",
            &format!("front:{conversation_id}:created:{}", created_at.timestamp()),
            created_at,
            conversation_id,
            customer_id,
            "system",
            "front",
            None,
            serde_json::json!({
                "conversation_id": conversation_id,
                "subject": record.get("subject").cloned(),
                "status": record.get("status").cloned(),
                "inbox": record.get("inbox").cloned(),
                "raw": record,
            }),
        ));

        if let Some(messages) = record.get("messages").and_then(Value::as_array) {
            for message in messages {
                let message_id = message
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("message");
                let occurred_at =
                    value_to_datetime(message.get("created_at")).unwrap_or(updated_at);
                let is_comment = message
                    .get("is_comment")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                let is_inbound = message
                    .get("is_inbound")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                let (actor_type, actor_id, actor_name) = if is_comment {
                    actor_from_front_author(message.get("author"), false)
                } else {
                    actor_from_front_author(message.get("author"), is_inbound)
                };
                let event_type = if is_comment {
                    "front.comment.added"
                } else if is_inbound {
                    "front.message.received"
                } else {
                    "front.message.sent"
                };

                events.push(build_nango_native_event(
                    tenant_id,
                    "front",
                    event_type,
                    &format!("front:{conversation_id}:message:{message_id}"),
                    occurred_at,
                    conversation_id,
                    customer_id,
                    &actor_type,
                    &actor_id,
                    actor_name.as_deref(),
                    serde_json::json!({
                        "conversation_id": conversation_id,
                        "message_id": message_id,
                        "body": message.get("body_text").or_else(|| message.get("body")).cloned(),
                        "author": message.get("author").cloned(),
                        "raw": message,
                    }),
                ));
            }
        }

        if let Some(assignee) = record.get("assignee") {
            let assignee_id = assignee
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("assignee");
            events.push(build_nango_native_event(
                tenant_id,
                "front",
                "front.conversation.assigned",
                &format!(
                    "front:{conversation_id}:assigned:{assignee_id}:{}",
                    updated_at.timestamp()
                ),
                updated_at,
                conversation_id,
                customer_id,
                "agent",
                assignee_id,
                assignee.get("name").and_then(Value::as_str),
                serde_json::json!({
                    "conversation_id": conversation_id,
                    "assignee": assignee,
                    "raw": record,
                }),
            ));
        }
    }

    events
}

fn normalize_slack_records(tenant_id: &str, records: &[Value]) -> Vec<(String, ChronicleEvent)> {
    let mut events = Vec::new();

    for record in records {
        let channel_id = record.get("channel_id").and_then(Value::as_str);
        let message_id = record.get("id").and_then(Value::as_str).unwrap_or_default();
        let ts = record.get("ts").and_then(Value::as_str);
        let Some(channel_id) = channel_id else {
            continue;
        };
        let Some(ts) = ts else {
            continue;
        };

        let thread_ts = record
            .get("thread_ts")
            .and_then(Value::as_str)
            .unwrap_or(ts);
        let occurred_at = slack_ts_to_datetime(ts).unwrap_or_else(|| {
            value_to_datetime(
                record
                    .get("_nango_metadata")
                    .and_then(|value| value.get("first_seen_at")),
            )
            .unwrap_or_else(Utc::now)
        });
        let user_id = record
            .get("user_id")
            .and_then(Value::as_str)
            .or_else(|| {
                record
                    .get("raw")
                    .and_then(|value| value.get("user"))
                    .and_then(Value::as_str)
            })
            .unwrap_or("slack");
        let user_name = record.get("user_name").and_then(Value::as_str).or_else(|| {
            record
                .get("raw")
                .and_then(|value| value.get("username"))
                .and_then(Value::as_str)
        });
        let subtype = record
            .get("raw")
            .and_then(|value| value.get("subtype"))
            .and_then(Value::as_str);
        let actor_type = if user_id == "slack" || matches!(subtype, Some("bot_message")) {
            "system"
        } else {
            "agent"
        };
        let event_type = match record.get("event_type").and_then(Value::as_str) {
            Some("thread_reply") if thread_ts != ts => "slack.thread_reply",
            _ => "slack.message",
        };

        let mut entities = vec![("channel".to_string(), channel_id.to_string())];
        if thread_ts != ts {
            entities.push(("thread".to_string(), thread_ts.to_string()));
        }
        if user_id != "slack" {
            entities.push(("user".to_string(), user_id.to_string()));
        }

        events.push(build_nango_native_event_with_entities(
            tenant_id,
            "slack",
            event_type,
            &format!("slack:{message_id}"),
            occurred_at,
            entities.clone(),
            actor_type,
            user_id,
            user_name,
            serde_json::json!({
                "channel_id": channel_id,
                "channel_name": record.get("channel_name").cloned(),
                "message_id": message_id,
                "text": record.get("text").cloned(),
                "ts": ts,
                "thread_ts": thread_ts,
                "reactions": record.get("reactions").cloned(),
                "raw": record,
            }),
        ));

        if let Some(reactions) = record.get("reactions").and_then(Value::as_array) {
            for reaction in reactions {
                let Some(reaction_name) = reaction.get("name").and_then(Value::as_str) else {
                    continue;
                };

                let users = reaction
                    .get("users")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();

                for reactor in users {
                    let Some(reactor_id) = reactor.as_str() else {
                        continue;
                    };

                    let mut reaction_entities = entities.clone();
                    reaction_entities.push(("reaction".to_string(), reaction_name.to_string()));

                    events.push(build_nango_native_event_with_entities(
                        tenant_id,
                        "slack",
                        "slack.reaction_added",
                        &format!("slack:{channel_id}:reaction:{ts}:{reaction_name}:{reactor_id}"),
                        occurred_at,
                        reaction_entities,
                        "agent",
                        reactor_id,
                        None,
                        serde_json::json!({
                            "channel_id": channel_id,
                            "channel_name": record.get("channel_name").cloned(),
                            "message_id": message_id,
                            "message_ts": ts,
                            "thread_ts": thread_ts,
                            "reaction": reaction_name,
                            "reactor_id": reactor_id,
                            "raw": reaction,
                        }),
                    ));
                }
            }
        }
    }

    events
}

fn build_nango_native_event(
    tenant_id: &str,
    provider: &str,
    event_type: &str,
    source_event_id: &str,
    occurred_at: DateTime<Utc>,
    conversation_id: &str,
    customer_id: Option<&str>,
    actor_type: &str,
    actor_id: &str,
    actor_name: Option<&str>,
    payload: Value,
) -> (String, ChronicleEvent) {
    let mut entities = vec![("conversation".to_string(), conversation_id.to_string())];
    if let Some(customer_id) = customer_id {
        entities.push(("customer".to_string(), customer_id.to_string()));
    }

    build_nango_native_event_with_entities(
        tenant_id,
        provider,
        event_type,
        source_event_id,
        occurred_at,
        entities,
        actor_type,
        actor_id,
        actor_name,
        payload,
    )
}

fn build_nango_native_event_with_entities(
    tenant_id: &str,
    provider: &str,
    event_type: &str,
    source_event_id: &str,
    occurred_at: DateTime<Utc>,
    entities: Vec<(String, String)>,
    actor_type: &str,
    actor_id: &str,
    actor_name: Option<&str>,
    payload: Value,
) -> (String, ChronicleEvent) {
    (
        source_event_id.to_string(),
        build_native_event(
            tenant_id,
            provider,
            event_type,
            occurred_at,
            None,
            payload,
            entities,
            None,
            Some(serde_json::json!({
                "actor": {
                    "actor_type": actor_type,
                    "actor_id": actor_id,
                    "name": actor_name,
                },
                "provider": provider,
            })),
            Some(serde_json::json!({
                "source_event_id": source_event_id,
            })),
        ),
    )
}

async fn insert_nango_events(
    state: &SaasAppState,
    tenant_id: &str,
    provider: &str,
    events: Vec<(String, ChronicleEvent)>,
) -> ApiResult<InsertedNangoEvents> {
    let mut ingested = 0usize;
    let mut inserted_event_ids = Vec::new();
    let tenant_id = TenantId::new(tenant_id);

    for (source_event_id, event) in events {
        let exists = state
            .event_store
            .exists(&tenant_id, provider, &source_event_id)
            .await
            .map_err(|error| {
                tracing::error!(provider, %source_event_id, %error, "Failed to check existing Chronicle event");
                ApiError::internal()
            })?;

        if exists {
            continue;
        }

        let event_id = state
            .event_store
            .insert_events(&[event])
            .await
            .map_err(|error| {
                tracing::error!(provider, %source_event_id, %error, "Failed to store Chronicle event from Nango");
                ApiError::internal()
            })?
            .into_iter()
            .next()
            .map(|event_id| event_id.to_string())
            .ok_or_else(ApiError::internal)?;
        ingested += 1;
        inserted_event_ids.push(event_id);
    }

    Ok(InsertedNangoEvents {
        ingested,
        inserted_event_ids,
    })
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

fn slack_ts_to_datetime(timestamp: &str) -> Option<DateTime<Utc>> {
    let (seconds, nanos) = timestamp.split_once('.')?;
    let seconds = seconds.parse::<i64>().ok()?;
    let nanos = format!("{:0<9}", nanos).get(0..9)?.parse::<u32>().ok()?;

    Utc.timestamp_opt(seconds, nanos).single()
}

fn actor_from_author(author: Option<&Value>, provider: &str) -> (String, String, Option<String>) {
    let author_type = author
        .and_then(|value| value.get("type"))
        .and_then(Value::as_str)
        .unwrap_or("system");
    let actor_type = if matches!(author_type, "user" | "lead" | "contact") {
        "customer"
    } else if matches!(author_type, "admin" | "teammate") {
        "agent"
    } else {
        "system"
    };
    let actor_id = author
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .unwrap_or(provider)
        .to_string();
    let actor_name = author
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
        .map(ToString::to_string);

    (actor_type.to_string(), actor_id, actor_name)
}

fn actor_from_front_author(
    author: Option<&Value>,
    inbound: bool,
) -> (String, String, Option<String>) {
    let actor_type = if inbound { "customer" } else { "agent" };
    let actor_id = author
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .unwrap_or(if inbound {
            "front-customer"
        } else {
            "front-agent"
        })
        .to_string();
    let actor_name = author
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
        .map(ToString::to_string);

    (actor_type.to_string(), actor_id, actor_name)
}

// ── Stripe Webhook ──

pub async fn stripe_webhook(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> ApiResult<Json<Value>> {
    let webhook_secret = state
        .config
        .stripe_webhook_secret
        .clone()
        .ok_or_else(|| ApiError::bad_request("Stripe webhook secret not configured"))?;

    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::bad_request("Missing stripe-signature header"))?;

    chronicle_stripe::verify_webhook_signature(&body, signature, &webhook_secret)
        .map_err(|e| ApiError::bad_request(format!("Invalid Stripe signature: {e}")))?;

    let body_str = std::str::from_utf8(&body)
        .map_err(|e| ApiError::bad_request(format!("Invalid UTF-8 body: {e}")))?;
    let event: Value = serde_json::from_str(body_str)
        .map_err(|e| ApiError::bad_request(format!("Invalid JSON: {e}")))?;

    let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let data_object = event.get("data").and_then(|d| d.get("object"));
    let tenant_id = resolve_stripe_tenant_id(&state, data_object).await?;
    let stored_event_id = if let Some(ref tenant_id) = tenant_id {
        Some(store_stripe_event(&state, tenant_id, body_str).await?)
    } else {
        tracing::debug!(
            event_type,
            "Skipping Chronicle Stripe ingest because tenant could not be resolved"
        );
        None
    };

    match event_type {
        "checkout.session.completed" => {
            if let Some(session) = data_object {
                let mode = session.get("mode").and_then(|v| v.as_str()).unwrap_or("");
                if mode != "subscription" {
                    return Ok(Json(serde_json::json!({ "received": true })));
                }

                let customer_id = session.get("customer").and_then(|v| v.as_str());
                let sub_id = session.get("subscription").and_then(|v| v.as_str());

                if let (Some(tid), Some(cid)) = (tenant_id.as_deref(), customer_id) {
                    let status = if sub_id.is_some() {
                        "active"
                    } else {
                        "incomplete"
                    };
                    state
                        .tenants
                        .update_stripe_fields(tid, Some(cid), Some(status), None)
                        .await
                        .ok();
                    tracing::info!("Stripe checkout completed for tenant {tid}");
                }
            }
        }
        "customer.subscription.updated" | "customer.subscription.deleted" => {
            if let Some(sub) = data_object {
                let customer_id = sub.get("customer").and_then(|v| v.as_str());
                let status = sub.get("status").and_then(|v| v.as_str());
                let price_id = sub
                    .get("items")
                    .and_then(|i| i.get("data"))
                    .and_then(|d| d.get(0))
                    .and_then(|item| item.get("price"))
                    .and_then(|p| p.get("id"))
                    .and_then(|v| v.as_str());

                if let (Some(tid), Some(cid)) = (tenant_id.as_deref(), customer_id) {
                    state
                        .tenants
                        .update_stripe_fields(tid, None, status, price_id)
                        .await
                        .ok();
                    tracing::info!(
                        "Stripe subscription {event_type} for tenant {tid} customer {cid}: status={}, price={}",
                        status.unwrap_or("unknown"),
                        price_id.unwrap_or("none"),
                    );
                } else if let Some(cid) = customer_id {
                    tracing::info!(
                        "Stripe subscription {event_type} for customer {cid}: status={}, price={}, tenant unresolved",
                        status.unwrap_or("unknown"),
                        price_id.unwrap_or("none"),
                    );
                }
            }
        }
        _ => {
            tracing::debug!("Unhandled Stripe event type: {event_type}");
        }
    }

    Ok(Json(serde_json::json!({
        "received": true,
        "tenant_id": tenant_id,
        "event_id": stored_event_id,
    })))
}

async fn resolve_stripe_tenant_id(
    state: &SaasAppState,
    data_object: Option<&Value>,
) -> ApiResult<Option<String>> {
    if let Some(tenant_id) = data_object.and_then(extract_stripe_tenant_id) {
        return Ok(Some(tenant_id));
    }

    if let Some(customer_id) = data_object.and_then(extract_stripe_customer_id) {
        let tenant = state
            .tenants
            .find_by_stripe_customer_id(customer_id)
            .await?;
        return Ok(tenant.map(|tenant| tenant.id));
    }

    Ok(None)
}

fn extract_stripe_tenant_id(data_object: &Value) -> Option<String> {
    data_object
        .get("metadata")
        .and_then(|metadata| metadata.get("tenantId"))
        .or_else(|| data_object.get("client_reference_id"))
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
}

fn extract_stripe_customer_id(data_object: &Value) -> Option<&str> {
    data_object.get("customer").and_then(|value| {
        value
            .as_str()
            .or_else(|| value.get("id").and_then(|id| id.as_str()))
    })
}

async fn store_stripe_event(
    state: &SaasAppState,
    tenant_id: &str,
    body: &str,
) -> ApiResult<String> {
    let native_event = chronicle_stripe::convert_webhook(body, tenant_id)
        .map_err(|e| ApiError::bad_request(format!("Invalid Stripe webhook payload: {e}")))?;

    state
        .event_store
        .insert_events(&[native_event])
        .await
        .map_err(|e| {
            tracing::error!("Failed to store Chronicle Stripe event: {e}");
            ApiError::internal()
        })?
        .into_iter()
        .next()
        .map(|id| id.to_string())
        .ok_or_else(ApiError::internal)
}

#[cfg(test)]
mod tests {
    use super::{
        fetch_nango_records, handle_nango_auth_webhook, handle_nango_sync_webhook,
        normalize_slack_records, verify_nango_webhook_signature, NangoSyncBookmark,
    };
    use std::sync::Arc;

    use async_trait::async_trait;
    use axum::{
        http::{HeaderMap, HeaderValue},
        response::IntoResponse,
        Json,
    };
    use chronicle_domain::{CreateConnectionInput, Run};
    use chronicle_infra::{
        memory::{
            InMemoryAgentEndpointConfigRepo, InMemoryAuditLogRepo, InMemoryConnectionRepo,
            InMemoryFeatureFlagRepo, InMemoryInvitationRepo, InMemoryPasswordResetRepo,
            InMemoryIntegrationSyncRepo, InMemoryRunRepo, InMemoryTenantRepo, InMemoryUserRepo,
            MemoryStore, MemoryStream,
        },
        StoreBackend, StreamBackend,
    };
    use chronicle_interfaces::email::{EmailError, EmailService, TemplateEmailParams};
    use chronicle_interfaces::{AuditLogRepository, ConnectionRepository, RunRepository};
    use hmac::{Hmac, Mac};
    use serde_json::json;
    use sha2::Sha256;
    use wiremock::{
        matchers::{header, method, path, query_param},
        Mock, MockServer, ResponseTemplate,
    };

    use crate::{runtime_config::SaasRuntimeConfig, saas_state::SaasAppState};

    #[derive(Default)]
    struct TestEmailService;

    #[async_trait]
    impl EmailService for TestEmailService {
        async fn send_template_email(
            &self,
            _params: TemplateEmailParams,
        ) -> Result<String, EmailError> {
            Ok("test-email".to_string())
        }
    }

    struct TestState {
        state: SaasAppState,
        connections: Arc<InMemoryConnectionRepo>,
        runs: Arc<InMemoryRunRepo>,
        audit_logs: Arc<InMemoryAuditLogRepo>,
    }

    fn build_test_state(
        nango: Option<chronicle_nango::NangoClient>,
        webhook_secret: Option<&str>,
    ) -> TestState {
        let tenants = Arc::new(InMemoryTenantRepo::default());
        let users = Arc::new(InMemoryUserRepo::default());
        let runs = Arc::new(InMemoryRunRepo::default());
        let connections = Arc::new(InMemoryConnectionRepo::default());
        let audit_logs = Arc::new(InMemoryAuditLogRepo::default());
        let agent_configs = Arc::new(InMemoryAgentEndpointConfigRepo::default());
        let feature_flags = Arc::new(InMemoryFeatureFlagRepo::default());
        let invitations = Arc::new(InMemoryInvitationRepo::default());
        let password_resets = Arc::new(InMemoryPasswordResetRepo::default());
        let integration_syncs = Arc::new(InMemoryIntegrationSyncRepo::default());
        let event_store = Arc::new(StoreBackend::Memory(MemoryStore::new()));
        let event_stream = Arc::new(StreamBackend::Memory(MemoryStream::new(16, 16)));
        let mut config = SaasRuntimeConfig::default();
        config.nango.webhook_secret = webhook_secret.map(ToString::to_string);

        let state = SaasAppState::new(
            "test-secret-change-me",
            tenants,
            users,
            runs.clone(),
            connections.clone(),
            audit_logs.clone(),
            agent_configs,
            integration_syncs,
            feature_flags,
            invitations,
            password_resets,
            nango.map(Arc::new),
            Arc::new(TestEmailService),
            None,
            event_store,
            event_stream,
            config,
        );

        TestState {
            state,
            connections,
            runs,
            audit_logs,
        }
    }

    async fn create_test_connection(
        test_state: &TestState,
        tenant_id: &str,
        provider: &str,
        connection_id: &str,
        metadata: Option<serde_json::Value>,
    ) {
        test_state
            .connections
            .create(CreateConnectionInput {
                tenant_id: tenant_id.to_string(),
                provider: provider.to_string(),
                access_token: None,
                refresh_token: None,
                expires_at: None,
                nango_connection_id: Some(connection_id.to_string()),
                metadata,
            })
            .await
            .unwrap();
    }

    fn sign_nango_body(secret: &str, body: &str) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body.as_bytes());
        format!("sha256={}", hex::encode(mac.finalize().into_bytes()))
    }

    fn run_ids(runs: &[Run]) -> Vec<&str> {
        runs.iter().map(|run| run.id.as_str()).collect()
    }

    #[test]
    fn normalizes_slack_messages_replies_and_reactions() {
        let records = vec![
            json!({
                "id": "C123:1710000000.000100",
                "channel_id": "C123",
                "channel_name": "eng",
                "user_id": "U123",
                "user_name": "Alice",
                "text": "hello",
                "ts": "1710000000.000100",
                "thread_ts": "1710000000.000100",
                "event_type": "message",
                "reactions": [{
                    "name": "thumbsup",
                    "users": ["U456"]
                }],
                "raw": {
                    "ts": "1710000000.000100",
                    "user": "U123"
                }
            }),
            json!({
                "id": "C123:1710000000.000100:1710000005.000200",
                "channel_id": "C123",
                "channel_name": "eng",
                "user_id": "U456",
                "user_name": "Bob",
                "text": "reply",
                "ts": "1710000005.000200",
                "thread_ts": "1710000000.000100",
                "event_type": "thread_reply",
                "raw": {
                    "ts": "1710000005.000200",
                    "thread_ts": "1710000000.000100",
                    "user": "U456"
                }
            }),
        ];

        let events = normalize_slack_records("tenant_test", &records);
        let source_ids = events.iter().map(|(id, _)| id.as_str()).collect::<Vec<_>>();

        assert_eq!(events.len(), 3);
        assert!(source_ids.contains(&"slack:C123:1710000000.000100"));
        assert!(source_ids.contains(&"slack:C123:1710000000.000100:1710000005.000200"));
        assert!(source_ids.contains(&"slack:C123:reaction:1710000000.000100:thumbsup:U456"));
    }

    #[test]
    fn verifies_valid_nango_signature() {
        let body = r#"{"type":"sync","connectionId":"conn_123"}"#;
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-nango-hmac-sha256",
            HeaderValue::from_str(&sign_nango_body("webhook-secret", body)).unwrap(),
        );

        assert!(verify_nango_webhook_signature(&headers, body, Some("webhook-secret")).is_ok());
    }

    #[test]
    fn rejects_invalid_nango_signature() {
        let body = r#"{"type":"sync","connectionId":"conn_123"}"#;
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-nango-hmac-sha256",
            HeaderValue::from_static("sha256=deadbeef"),
        );

        let response = verify_nango_webhook_signature(&headers, body, Some("webhook-secret"))
            .unwrap_err()
            .into_response();
        assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn skips_signature_verification_without_secret() {
        let body = r#"{"type":"sync","connectionId":"conn_123"}"#;
        let headers = HeaderMap::new();

        assert!(verify_nango_webhook_signature(&headers, body, None).is_ok());
    }

    #[tokio::test]
    async fn fetch_nango_records_prefers_bookmark_cursor() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/records"))
            .and(query_param("model", "SlackMessage"))
            .and(query_param("cursor", "cursor_123"))
            .and(header("connection-id", "conn_123"))
            .and(header("provider-config-key", "slack"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "records": [{
                    "id": "C123:1710000000.000100",
                    "_nango_metadata": {
                        "cursor": "cursor_456",
                        "last_modified_at": "2026-03-20T10:00:00Z"
                    }
                }],
                "next_cursor": null
            })))
            .expect(1)
            .mount(&server)
            .await;

        let test_state = build_test_state(
            Some(chronicle_nango::NangoClient::new("nango-secret").with_base_url(server.uri())),
            None,
        );

        let fetched = match fetch_nango_records(
            &test_state.state,
            "conn_123",
            "slack",
            "SlackMessage",
            Some(&NangoSyncBookmark {
                cursor: Some("cursor_123".to_string()),
                modified_after: Some("2026-03-19T10:00:00Z".to_string()),
            }),
            Some("2026-03-18T10:00:00Z"),
            Some("INCREMENTAL"),
        )
        .await
        {
            Ok(fetched) => fetched,
            Err(_) => panic!("cursor-first fetch should succeed"),
        };

        assert_eq!(fetched.records.len(), 1);
        assert_eq!(
            fetched.bookmark.unwrap(),
            NangoSyncBookmark {
                cursor: Some("cursor_456".to_string()),
                modified_after: Some("2026-03-20T10:00:00Z".to_string()),
            }
        );
    }

    #[tokio::test]
    async fn successful_sync_creates_shadow_run_and_audit_log() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/records"))
            .and(query_param("model", "SlackMessage"))
            .and(header("connection-id", "conn_123"))
            .and(header("provider-config-key", "slack"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "records": [{
                    "id": "C123:1710000000.000100",
                    "channel_id": "C123",
                    "channel_name": "eng",
                    "user_id": "U123",
                    "user_name": "Alice",
                    "text": "hello",
                    "ts": "1710000000.000100",
                    "thread_ts": "1710000000.000100",
                    "event_type": "message",
                    "raw": {
                        "ts": "1710000000.000100",
                        "user": "U123"
                    },
                    "_nango_metadata": {
                        "cursor": "cursor_123",
                        "last_modified_at": "2026-03-20T11:00:00Z"
                    }
                }],
                "next_cursor": null
            })))
            .expect(1)
            .mount(&server)
            .await;

        let test_state = build_test_state(
            Some(chronicle_nango::NangoClient::new("nango-secret").with_base_url(server.uri())),
            None,
        );
        create_test_connection(
            &test_state,
            "tenant_1",
            "slack",
            "conn_123",
            Some(json!({ "provider_config_key": "slack" })),
        )
        .await;

        let Json(response) = match handle_nango_sync_webhook(
            &test_state.state,
            &json!({
                "type": "sync",
                "success": true,
                "connectionId": "conn_123",
                "providerConfigKey": "slack",
                "model": "SlackMessage"
            }),
        )
        .await
        {
            Ok(response) => response,
            Err(_) => panic!("successful sync webhook should succeed"),
        };

        assert_eq!(
            response.get("ingested").and_then(|value| value.as_u64()),
            Some(1)
        );

        let runs = test_state
            .runs
            .list_by_tenant("tenant_1", None, 10, 0)
            .await
            .unwrap();
        assert_eq!(runs.len(), 1, "run ids: {:?}", run_ids(&runs));
        assert_eq!(runs[0].mode, "shadow");
        assert_eq!(runs[0].status, "completed");

        let audit_logs = test_state
            .audit_logs
            .list_by_tenant("tenant_1", 10, 0)
            .await
            .unwrap();
        assert_eq!(audit_logs.len(), 1);
        assert_eq!(audit_logs[0].action, "nango_sync_batch_ingested");

        let connection = test_state
            .connections
            .find_by_tenant_provider("tenant_1", "slack")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            connection.metadata,
            Some(json!({
                "provider_config_key": "slack",
                "nango_sync_bookmarks": {
                    "slack": {
                        "SlackMessage": {
                            "cursor": "cursor_123",
                            "modified_after": "2026-03-20T11:00:00Z"
                        }
                    }
                }
            }))
        );
    }

    #[tokio::test]
    async fn failed_sync_records_audit_log_without_fetching_records() {
        let test_state = build_test_state(None, None);
        create_test_connection(
            &test_state,
            "tenant_1",
            "intercom",
            "conn_123",
            Some(json!({ "provider_config_key": "intercom" })),
        )
        .await;

        let Json(response) = match handle_nango_sync_webhook(
            &test_state.state,
            &json!({
                "type": "sync",
                "success": false,
                "connectionId": "conn_123",
                "providerConfigKey": "intercom",
                "model": "Conversation",
                "error": {
                    "message": "sync failed"
                }
            }),
        )
        .await
        {
            Ok(response) => response,
            Err(_) => panic!("failed sync webhook should still return 200"),
        };

        assert_eq!(
            response.get("success").and_then(|value| value.as_bool()),
            Some(false)
        );
        let runs = test_state
            .runs
            .list_by_tenant("tenant_1", None, 10, 0)
            .await
            .unwrap();
        assert!(runs.is_empty());

        let audit_logs = test_state
            .audit_logs
            .list_by_tenant("tenant_1", 10, 0)
            .await
            .unwrap();
        assert_eq!(audit_logs.len(), 1);
        assert_eq!(audit_logs[0].action, "nango_sync_failed");
    }

    #[tokio::test]
    async fn auth_refresh_failure_preserves_connection_and_records_audit_log() {
        let test_state = build_test_state(None, None);
        create_test_connection(
            &test_state,
            "tenant_1",
            "slack",
            "conn_123",
            Some(json!({ "provider_config_key": "slack" })),
        )
        .await;

        let Json(response) = match handle_nango_auth_webhook(
            &test_state.state,
            &json!({
                "type": "auth",
                "success": false,
                "operation": "refresh",
                "connectionId": "conn_123",
                "providerConfigKey": "slack",
                "error": {
                    "message": "refresh failed"
                }
            }),
        )
        .await
        {
            Ok(response) => response,
            Err(_) => panic!("failed auth refresh should still return 200"),
        };

        assert_eq!(
            response.get("operation").and_then(|value| value.as_str()),
            Some("refresh")
        );
        assert!(test_state
            .connections
            .find_by_tenant_provider("tenant_1", "slack")
            .await
            .unwrap()
            .is_some());

        let audit_logs = test_state
            .audit_logs
            .list_by_tenant("tenant_1", 10, 0)
            .await
            .unwrap();
        assert_eq!(audit_logs.len(), 1);
        assert_eq!(audit_logs[0].action, "nango_auth_refresh_failed");
    }
}
