use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

use chronicle_domain::CreateRunInput;
use chronicle_infra::conversion::build_native_event;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

// ── Pipedream Webhook ──

pub async fn pipedream_webhook(
    State(state): State<SaasAppState>,
    Path(tenant_id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let _tenant = state
        .tenants
        .find_by_id(&tenant_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Tenant"))?;

    let deployment_id = extract_deployment_id(&headers, &body);

    let mut provider = "unknown".to_string();
    if let Some(ref dep_id) = deployment_id {
        if let Ok(Some(trigger)) = state.pipedream_triggers.find_by_deployment_id(dep_id).await {
            if let Ok(Some(conn)) = state.connections.find_by_id(&trigger.connection_id).await {
                provider = conn.provider;
            }
        }
    }

    let inner_event = body.get("event").cloned().unwrap_or_else(|| body.clone());

    let entity_id = extract_entity_id(&inner_event, &provider);
    let actor = extract_actor(&inner_event, &provider);
    let event_type =
        normalize_event_type(&provider, inner_event.get("type").and_then(|v| v.as_str()));

    let source_event_id = inner_event
        .get("id")
        .and_then(|v| v.as_str())
        .map(|id| format!("pipedream_{id}"))
        .unwrap_or_else(|| format!("pipedream_{}", chrono::Utc::now().timestamp_millis()));

    let mut payload = inner_event.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.insert(
            "_pipedream".to_string(),
            serde_json::json!({
                "deployment_id": deployment_id,
                "received_at": chrono::Utc::now().to_rfc3339(),
            }),
        );
    }

    let native_event = build_native_event(
        &tenant_id,
        &provider,
        &event_type,
        chrono::Utc::now(),
        None,
        payload.clone(),
        vec![(
            entity_type_for_provider(&provider).to_string(),
            entity_id.clone(),
        )],
        None,
        Some(serde_json::json!({
            "actor": {
                "actor_type": actor.actor_type,
                "actor_id": actor.id,
                "name": actor.name,
            },
            "provider": provider.clone(),
            "deployment_id": deployment_id.clone(),
        })),
        Some(serde_json::json!({
            "source_event_id": source_event_id,
        })),
    );

    let event_id = state
        .event_store
        .insert_events(&[native_event])
        .await
        .map_err(|e| {
            tracing::error!("Failed to store Chronicle event: {e}");
            ApiError::internal()
        })?
        .into_iter()
        .next()
        .map(|id| id.to_string())
        .ok_or_else(ApiError::internal)?;

    let invocation_id = format!("inv_{event_id}");
    if let Ok(run) = state
        .runs
        .create(CreateRunInput {
            tenant_id: tenant_id.clone(),
            workflow_id: None,
            event_id: event_id.clone(),
            invocation_id: invocation_id.clone(),
            mode: "shadow".to_string(),
            event_snapshot: Some(payload),
            context_pointers: None,
        })
        .await
    {
        state.audit_logs.create(
            &tenant_id, "run_created", Some("webhook"),
            Some(&run.id), Some(&event_id), Some(&invocation_id),
            Some(serde_json::json!({ "mode": "shadow", "source": "webhook", "provider": provider })),
        ).await.ok();
    }

    Ok(Json(serde_json::json!({
        "received": true,
        "event_id": event_id,
        "tenant_id": tenant_id,
        "provider": provider,
        "event_type": event_type,
    })))
}

fn extract_deployment_id(headers: &HeaderMap, body: &Value) -> Option<String> {
    if let Some(v) = headers
        .get("x-pd-deployment-id")
        .and_then(|v| v.to_str().ok())
    {
        return Some(v.to_string());
    }
    if let Some(v) = headers.get("x-pd-emitter-id").and_then(|v| v.to_str().ok()) {
        return Some(v.to_string());
    }

    for key in &["deployment_id", "deploymentId", "emitter_id"] {
        if let Some(v) = body.get(key).and_then(|v| v.as_str()) {
            return Some(v.to_string());
        }
    }

    if let Some(meta) = body.get("_metadata") {
        for key in &["deployment_id", "deploymentId", "emitter_id"] {
            if let Some(v) = meta.get(key).and_then(|v| v.as_str()) {
                return Some(v.to_string());
            }
        }
    }

    body.get("emitter")
        .and_then(|e| e.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

struct ExtractedActor {
    actor_type: String,
    id: String,
    name: Option<String>,
}

fn extract_actor(event: &Value, provider: &str) -> ExtractedActor {
    match provider {
        "slack" => {
            let id = event
                .get("user")
                .and_then(|v| v.as_str())
                .unwrap_or("slack");
            let name = event
                .get("user_name")
                .or_else(|| event.get("username"))
                .and_then(|v| v.as_str());
            ExtractedActor {
                actor_type: if id != "slack" { "agent" } else { "system" }.to_string(),
                id: id.to_string(),
                name: name.map(|s| s.to_string()),
            }
        }
        "intercom" => {
            let author = event
                .get("author")
                .or_else(|| event.get("source").and_then(|s| s.get("author")));
            if let Some(a) = author {
                let atype = a.get("type").and_then(|v| v.as_str()).unwrap_or("system");
                let is_customer = atype == "user" || atype == "lead";
                ExtractedActor {
                    actor_type: if is_customer { "customer" } else { "agent" }.to_string(),
                    id: a
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    name: a
                        .get("name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                }
            } else {
                ExtractedActor {
                    actor_type: "system".to_string(),
                    id: "intercom".to_string(),
                    name: None,
                }
            }
        }
        _ => ExtractedActor {
            actor_type: "system".to_string(),
            id: provider.to_string(),
            name: None,
        },
    }
}

fn extract_entity_id(event: &Value, provider: &str) -> String {
    let candidates: &[&str] = match provider {
        "slack" => &["channel", "ts"],
        "intercom" => &["conversation_id", "id"],
        "stripe" => &["id"],
        "hubspot" => &["objectId", "id"],
        "zendesk" => &["ticket_id", "id"],
        _ => &["id"],
    };

    for key in candidates {
        if let Some(v) = event.get(key).and_then(|v| v.as_str()) {
            return v.to_string();
        }
    }

    format!("{}_{}", provider, chrono::Utc::now().timestamp_millis())
}

fn entity_type_for_provider(provider: &str) -> &'static str {
    match provider {
        "slack" => "channel",
        "intercom" => "conversation",
        "stripe" => "customer",
        "hubspot" => "contact",
        "zendesk" => "ticket",
        _ => "entity",
    }
}

fn normalize_event_type(provider: &str, event_type: Option<&str>) -> String {
    match event_type {
        Some(t) if t.contains('.') => t.to_string(),
        Some(t) => format!("{provider}.{t}"),
        None => format!("{provider}.event"),
    }
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
