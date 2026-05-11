//! Integration tests for the REST API.
//!
//! Starts a real axum server on a random port, makes HTTP requests
//! with reqwest, and verifies responses. Uses InMemoryBackend
//! so no database is needed.

use std::sync::Arc;

use chronicle_server::rest::build_router;
use chronicle_server::{SdkAuthConfig, ServerState};
use chronicle_store::memory::InMemoryBackend;
use chronicle_store::StorageEngine;

/// Start a test server on a random port and return the base URL.
async fn start_test_server() -> String {
    start_test_server_with_sdk_auth(SdkAuthConfig::disabled()).await
}

async fn start_test_server_with_sdk_auth(sdk_auth: SdkAuthConfig) -> String {
    let backend = Arc::new(InMemoryBackend::new());
    let engine = StorageEngine {
        events: backend.clone(),
        entity_refs: backend.clone(),
        links: backend.clone(),
        embeddings: backend.clone(),
        schemas: backend.clone(),
        subscriptions: Some(backend.clone()),
    };
    let state = ServerState::new_with_sdk_auth(engine, sdk_auth);
    let router = build_router(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    format!("http://{addr}")
}

#[tokio::test]
async fn ingest_and_query_round_trip() {
    let base = start_test_server().await;
    let client = reqwest::Client::new();

    // Ingest an event
    let resp = client
        .post(format!("{base}/v1/events"))
        .json(&serde_json::json!({
            "org_id": "org_test",
            "source": "stripe",
            "topic": "payments",
            "event_type": "payment_intent.succeeded",
            "entities": {"customer": "cust_1"},
            "payload": {"amount": 4999, "currency": "usd"},
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["count"], 1);
    assert!(!body["event_ids"][0].as_str().unwrap().is_empty());

    // Query it back
    let resp = client
        .get(format!("{base}/v1/events"))
        .query(&[("org_id", "org_test"), ("source", "stripe")])
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let results: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0]["event"]["source"], "stripe");
}

#[tokio::test]
async fn batch_ingest() {
    let base = start_test_server().await;
    let client = reqwest::Client::new();

    let events: Vec<serde_json::Value> = (0..5)
        .map(|i| {
            serde_json::json!({
                "org_id": "org_test",
                "source": "stripe",
                "topic": "payments",
                "event_type": "charge.created",
                "entities": {"customer": format!("cust_{i}")},
                "payload": {"amount": i * 1000},
            })
        })
        .collect();

    let resp = client
        .post(format!("{base}/v1/events/batch"))
        .json(&events)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["count"], 5);
}

#[tokio::test]
async fn timeline_query() {
    let base = start_test_server().await;
    let client = reqwest::Client::new();

    // Ingest events for one customer across sources
    for (source, topic, event_type) in &[
        ("stripe", "payments", "charge.created"),
        ("support", "tickets", "ticket.created"),
        ("product", "usage", "page.viewed"),
    ] {
        client
            .post(format!("{base}/v1/events"))
            .json(&serde_json::json!({
                "org_id": "org_test",
                "source": source,
                "topic": topic,
                "event_type": event_type,
                "entities": {"customer": "cust_timeline"},
                "payload": {"test": true},
            }))
            .send()
            .await
            .unwrap();
    }

    let resp = client
        .get(format!("{base}/v1/timeline/customer/cust_timeline"))
        .query(&[("org_id", "org_test")])
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let results: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(
        results.len(),
        3,
        "Timeline should have events from all 3 sources"
    );
}

#[tokio::test]
async fn jit_entity_linking_via_api() {
    let base = start_test_server().await;
    let client = reqwest::Client::new();

    // Ingest anonymous session events
    for url in &["/pricing", "/signup"] {
        client
            .post(format!("{base}/v1/events"))
            .json(&serde_json::json!({
                "org_id": "org_test",
                "source": "product",
                "topic": "usage",
                "event_type": "page.viewed",
                "entities": {"session": "sess_anon"},
                "payload": {"url": url},
            }))
            .send()
            .await
            .unwrap();
    }

    // Before linking: customer timeline is empty
    let resp = client
        .get(format!("{base}/v1/timeline/customer/cust_linked"))
        .query(&[("org_id", "org_test")])
        .send()
        .await
        .unwrap();
    let before: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(before.len(), 0);

    // JIT link session to customer
    let resp = client
        .post(format!("{base}/v1/link-entity"))
        .json(&serde_json::json!({
            "org_id": "org_test",
            "from_entity_type": "session",
            "from_entity_id": "sess_anon",
            "to_entity_type": "customer",
            "to_entity_id": "cust_linked",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let link_result: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(link_result["linked_count"], 2);

    // After linking: customer timeline includes the anonymous events
    let resp = client
        .get(format!("{base}/v1/timeline/customer/cust_linked"))
        .query(&[("org_id", "org_test")])
        .send()
        .await
        .unwrap();
    let after: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(
        after.len(),
        2,
        "Customer should now see linked session events"
    );
}

#[tokio::test]
async fn discovery_endpoints() {
    let base = start_test_server().await;
    let client = reqwest::Client::new();

    // Ingest some events
    client
        .post(format!("{base}/v1/events"))
        .json(&serde_json::json!({
            "org_id": "org_disc",
            "source": "stripe",
            "topic": "payments",
            "event_type": "charge.created",
            "entities": {"customer": "cust_1"},
        }))
        .send()
        .await
        .unwrap();

    // List entity types
    let resp = client
        .get(format!("{base}/v1/discover/entity-types"))
        .query(&[("org_id", "org_disc")])
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let types: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert!(
        !types.is_empty(),
        "Should have at least 'customer' entity type"
    );

    // List entities of type
    let resp = client
        .get(format!("{base}/v1/discover/entities/customer"))
        .query(&[("org_id", "org_disc")])
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let entities: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert!(!entities.is_empty());
}

#[tokio::test]
async fn sdk_capture_routes_persist_identify_signals_and_traces() {
    let base = start_test_server().await;
    let client = reqwest::Client::new();

    let identify = client
        .post(format!("{base}/v1/users/identify"))
        .json(&serde_json::json!({
            "org_id": "org_sdk",
            "user_id": "user_123",
            "traits": {"email": "user@example.com", "plan": "paid"},
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(identify.status(), 200);

    let signals = client
        .post(format!("{base}/v1/signals/track"))
        .json(&serde_json::json!({
            "org_id": "org_sdk",
            "signals": [{
                "event_id": "evt_logical",
                "signal_name": "thumbs_up",
                "sentiment": "POSITIVE",
                "signal_type": "feedback",
                "properties": {"location": "chat_ui"}
            }]
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(signals.status(), 200);

    let traces = client
        .post(format!("{base}/v1/traces/track"))
        .json(&serde_json::json!({
            "org_id": "org_sdk",
            "traces": [{
                "trace_id": "trace_123",
                "event_id": "evt_logical",
                "name": "support-chat",
                "attributes": {"route": "support"},
                "spans": [{
                    "trace_id": "trace_123",
                    "span_id": "span_root",
                    "name": "generateText",
                    "kind": "model",
                    "status": "ok",
                    "duration_ms": 42,
                    "attributes": {
                        "model": "test-model",
                        "ai.stream.msToFirstChunk": 7
                    }
                }]
            }]
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(traces.status(), 200);

    let trace_events = client
        .get(format!("{base}/v1/events"))
        .query(&[
            ("org_id", "org_sdk"),
            ("source", "chronicle.sdk"),
            ("topic", "traces"),
        ])
        .send()
        .await
        .unwrap();
    assert_eq!(trace_events.status(), 200);
    let body: Vec<serde_json::Value> = trace_events.json().await.unwrap();
    assert_eq!(body.len(), 1);
    assert_eq!(body[0]["event"]["payload"]["trace_id"], "trace_123");
    assert_eq!(body[0]["event"]["payload"]["span_id"], "span_root");
    assert!(body[0]["event"]["payload"]["_chronicle_backend"]["ingested_at"].is_string());

    let trace_tree = client
        .get(format!("{base}/v1/traces/trace_123"))
        .query(&[("org_id", "org_sdk")])
        .send()
        .await
        .unwrap();
    assert_eq!(trace_tree.status(), 200);
    let trace_tree: serde_json::Value = trace_tree.json().await.unwrap();
    assert_eq!(trace_tree["trace_id"], "trace_123");
    assert_eq!(trace_tree["spans"][0]["span_id"], "span_root");
    assert_eq!(trace_tree["spans"][0]["kind"], "model");

    let signal_events = client
        .get(format!("{base}/v1/events"))
        .query(&[
            ("org_id", "org_sdk"),
            ("source", "chronicle.sdk"),
            ("topic", "signals"),
        ])
        .send()
        .await
        .unwrap();
    assert_eq!(signal_events.status(), 200);
    let body: Vec<serde_json::Value> = signal_events.json().await.unwrap();
    assert_eq!(body.len(), 1);
    assert_eq!(body[0]["event"]["payload"]["signal_name"], "thumbs_up");
}

#[tokio::test]
async fn sdk_routes_require_developer_key_when_unkey_is_configured() {
    let base = start_test_server_with_sdk_auth(SdkAuthConfig::with_unkey(
        "unkey_test_root",
        "api_yeFHUx8h2p22",
    ))
    .await;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("{base}/v1/events"))
        .json(&serde_json::json!({
            "org_id": "org_test",
            "source": "chronicle.sdk",
            "topic": "ai",
            "event_type": "ai.interaction",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), reqwest::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[ignore = "requires live UNKEY_ROOT_KEY and creates a real short-lived Unkey key"]
async fn live_unkey_key_can_ingest_through_sdk_route() {
    let root_key = std::env::var("UNKEY_ROOT_KEY")
        .expect("set UNKEY_ROOT_KEY to run the live Unkey integration test");
    let api_id = std::env::var("UNKEY_API_ID").unwrap_or_else(|_| "api_yeFHUx8h2p22".to_string());
    let base_url =
        std::env::var("UNKEY_BASE_URL").unwrap_or_else(|_| "https://api.unkey.com/v2".to_string());
    let org_id = format!("org_live_unkey_{}", std::process::id());
    let http = reqwest::Client::new();

    let created_response = http
        .post(format!("{}/keys.createKey", base_url.trim_end_matches('/')))
        .bearer_auth(&root_key)
        .json(&serde_json::json!({
            "apiId": api_id,
            "prefix": "chr",
            "name": "chronicle live route test",
            "expires": chrono::Utc::now().timestamp_millis() + 1000 * 60 * 10,
            "meta": {
                "org_id": org_id,
                "scopes": ["events:write", "traces:write", "signals:write", "users:write"]
            }
        }))
        .send()
        .await
        .expect("failed to call Unkey createKey");
    assert!(
        created_response.status().is_success(),
        "failed to create live Unkey test key: {}",
        created_response.text().await.unwrap_or_default()
    );
    let created: serde_json::Value = created_response.json().await.unwrap();
    let created_key = created["data"]["key"]
        .as_str()
        .expect("Unkey createKey response missing data.key");
    let created_key_id = created["data"]["keyId"].as_str();

    let base = start_test_server_with_sdk_auth(SdkAuthConfig::with_unkey_base_url(
        &root_key,
        &api_id,
        Some(&base_url),
    ))
    .await;
    let response = http
        .post(format!("{base}/v1/events"))
        .bearer_auth(created_key)
        .json(&serde_json::json!({
            "org_id": org_id,
            "source": "chronicle.sdk",
            "topic": "ai",
            "event_type": "ai.interaction",
            "payload": {"live_unkey": true}
        }))
        .send()
        .await
        .expect("failed to call SDK ingest route with live Unkey key");

    let status = response.status();

    if let Some(key_id) = created_key_id {
        let _ = http
            .post(format!("{}/keys.deleteKey", base_url.trim_end_matches('/')))
            .bearer_auth(&root_key)
            .json(&serde_json::json!({ "keyId": key_id }))
            .send()
            .await;
    }

    assert_eq!(status, reqwest::StatusCode::OK);
}
