//! Live integration tests for the Helix-backed graph backend.
//!
//! Requires:
//! - Postgres running on the dedicated test database
//! - Helix running locally with `backend/helix/event-graph` pushed

#![cfg(all(feature = "postgres", feature = "helix"))]

use std::env;
use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;

use chronicle_core::event::EventBuilder;
use chronicle_core::ids::{EntityId, EntityType, EventId, OrgId};
use chronicle_core::link::LinkDirection;
use chronicle_core::query::{GraphQuery, SemanticQuery};
use chronicle_store::helix::{
    DeterministicTextEmbedder, HelixConnectionConfig, HelixEventStore, HelixGraphBackend,
    HelixTraceOodService, DEFAULT_HELIX_ENDPOINT, DEFAULT_HELIX_PORT, DEFAULT_HELIX_PROJECT_DIR,
};
use chronicle_store::postgres::PostgresBackend;
use chronicle_store::traits::{
    EmbeddingStore, EntityRefStore, EventEmbedding, EventLinkStore, EventStore,
};
use chronicle_test_fixtures::{factories, trait_tests};

const DEFAULT_TEST_DB_URL: &str = "postgres://chronicle:chronicle@localhost:5433/chronicle";
const EMBEDDING_DIMENSIONS: usize = 8;

#[tokio::test]
#[ignore = "requires local Postgres test DB and Helix with schema pushed"]
async fn helix_passes_event_store_suite() {
    let (_canonical, _graph, store) = live_helix_backend().await;
    trait_tests::run_event_store_tests(&store).await;
}

#[tokio::test]
#[ignore = "requires local Postgres test DB and Helix with schema pushed"]
async fn helix_passes_entity_ref_suite() {
    let (_canonical, graph, store) = live_helix_backend().await;
    trait_tests::run_entity_ref_tests(graph.as_ref(), &store).await;
}

#[tokio::test]
#[ignore = "requires local Postgres test DB and Helix with schema pushed"]
async fn helix_live_query_matrix_covers_graph_search_and_ood() {
    let (canonical, graph, _store) = live_helix_backend().await;
    let org_id = unique_org_id("helix_query");
    let org = OrgId::new(org_id.as_str());
    let customer_id = "cust_helix_query";
    let session_id = "sess_helix_query";

    let failed_payment = factories::stripe_payment_failed(org.as_str(), customer_id, 8_999);
    let failed_payment_id = failed_payment.event_id;
    let support_ticket = factories::support_ticket(
        org.as_str(),
        customer_id,
        "Billing issue after payment failed",
    );
    let support_ticket_id = support_ticket.event_id;
    let anonymous_page = factories::anonymous_page_view(org.as_str(), session_id, "/refund-policy");
    let anonymous_page_id = anonymous_page.event_id;
    let refunded_charge = EventBuilder::new(org.as_str(), "stripe", "payments", "charge.refunded")
        .entity("customer", customer_id)
        .payload(serde_json::json!({
            "amount": 8_999,
            "currency": "usd",
            "status": "refunded",
            "payment_intent_id": "pi_refund_1"
        }))
        .build();
    let refunded_charge_id = refunded_charge.event_id;

    canonical
        .insert_events(&[
            failed_payment.clone(),
            support_ticket.clone(),
            anonymous_page.clone(),
            refunded_charge.clone(),
        ])
        .await
        .unwrap();
    graph
        .sync_events(&[
            failed_payment.clone(),
            support_ticket.clone(),
            anonymous_page.clone(),
            refunded_charge.clone(),
        ])
        .await
        .unwrap();

    graph
        .create_link(
            &org,
            &factories::causal_link(failed_payment_id, support_ticket_id, 0.94),
        )
        .await
        .unwrap();
    graph
        .create_link(
            &org,
            &factories::causal_link(support_ticket_id, refunded_charge_id, 0.91),
        )
        .await
        .unwrap();
    graph
        .link_entity(
            &org,
            &EntityType::new("session"),
            &EntityId::new(session_id),
            &EntityType::new("customer"),
            &EntityId::new(customer_id),
            "helix_live_test",
        )
        .await
        .unwrap();

    let search_text = "billing issue after payment failed";
    let event_embedding = deterministic_embedding(search_text, EMBEDDING_DIMENSIONS);
    graph
        .store_embeddings(&[
            make_embedding(&org, failed_payment_id, search_text, &event_embedding),
            make_embedding(&org, support_ticket_id, search_text, &event_embedding),
        ])
        .await
        .unwrap();

    let semantic_results = graph
        .search_event_candidates(
            &org,
            &event_embedding
                .iter()
                .map(|value| f64::from(*value))
                .collect::<Vec<_>>(),
            5,
        )
        .await
        .unwrap();
    assert!(semantic_results
        .iter()
        .any(|result| result.event.event_id == support_ticket_id));

    let bm25_raw_results = graph
        .search_raw_payload_keywords(&org, "Billing issue", 5)
        .await
        .unwrap();
    assert!(bm25_raw_results
        .iter()
        .any(|result| result.event.event_id == support_ticket_id));

    let bm25_generic_results = graph
        .search_generic_payload_keywords(&org, "Billing issue", 5)
        .await
        .unwrap();
    assert!(bm25_generic_results
        .iter()
        .any(|result| result.event.event_id == support_ticket_id));

    let customer_event_ids = graph
        .get_events_for_entity(
            &org,
            &EntityType::new("customer"),
            &EntityId::new(customer_id),
        )
        .await
        .unwrap();
    assert!(customer_event_ids.contains(&anonymous_page_id));
    assert!(customer_event_ids.contains(&refunded_charge_id));

    let traversed = graph
        .traverse(&GraphQuery {
            org_id: org,
            start_event_id: refunded_charge_id,
            direction: LinkDirection::Incoming,
            link_types: Some(vec!["caused_by".to_string()]),
            max_depth: 4,
            min_confidence: 0.7,
        })
        .await
        .unwrap();
    assert!(traversed
        .iter()
        .any(|result| result.event.event_id == failed_payment_id));
    assert!(traversed
        .iter()
        .any(|result| result.event.event_id == support_ticket_id));

    let trace_service = HelixTraceOodService::new(graph.clone());
    let embedder = DeterministicTextEmbedder::new(EMBEDDING_DIMENSIONS);
    let trace = trace_service
        .upsert_materialized_trace(
            "trace_refund_resolution",
            "refund_resolution",
            "deterministic-live-test",
            &org,
            &[failed_payment_id, support_ticket_id, refunded_charge_id],
            &embedder,
        )
        .await
        .unwrap();

    let refund_traces = graph
        .search_stripe_refund_traces(&org, 5_000.0)
        .await
        .unwrap();
    assert!(refund_traces
        .iter()
        .any(|candidate| candidate.trace_key == "trace_refund_resolution"));

    let ood = trace_service
        .assess_trace_document(&trace, 5, 0.5, &embedder)
        .await
        .unwrap();
    assert!(!ood.is_ood);
    assert!(ood.best_score.unwrap_or_default() >= 0.99);

    let semantic_via_trait = graph
        .search(&SemanticQuery {
            org_id: org,
            query_text: search_text.to_string(),
            entity: None,
            source: None,
            time_range: None,
            limit: 5,
        })
        .await
        .unwrap();
    assert!(!semantic_via_trait.is_empty());
}

async fn live_helix_backend() -> (
    Arc<PostgresBackend>,
    Arc<HelixGraphBackend>,
    HelixEventStore,
) {
    let canonical = Arc::new(
        PostgresBackend::new(&live_database_url())
            .await
            .expect("connect to Postgres test DB"),
    );
    canonical
        .run_migrations()
        .await
        .expect("run Chronicle event migrations");

    let graph = Arc::new(HelixGraphBackend::new(
        live_helix_config(),
        canonical.clone(),
        canonical.clone(),
        canonical.clone(),
        canonical.clone(),
    ));
    let store = HelixEventStore::new(canonical.clone(), graph.clone());
    (canonical, graph, store)
}

fn live_database_url() -> String {
    env::var("HELIX_TEST_DATABASE_URL")
        .or_else(|_| env::var("DATABASE_URL"))
        .unwrap_or_else(|_| DEFAULT_TEST_DB_URL.to_string())
}

fn live_helix_config() -> HelixConnectionConfig {
    HelixConnectionConfig {
        endpoint: env::var("HELIX_TEST_BASE_URL")
            .or_else(|_| env::var("HELIX_BASE_URL"))
            .unwrap_or_else(|_| DEFAULT_HELIX_ENDPOINT.to_string()),
        port: env::var("HELIX_TEST_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .or_else(|| {
                env::var("HELIX_PORT")
                    .ok()
                    .and_then(|value| value.parse::<u16>().ok())
            })
            .unwrap_or(DEFAULT_HELIX_PORT),
        api_key: env::var("HELIX_TEST_API_KEY")
            .ok()
            .or_else(|| env::var("HELIX_API_KEY").ok()),
        project_dir: PathBuf::from(DEFAULT_HELIX_PROJECT_DIR),
    }
}

fn unique_org_id(prefix: &str) -> String {
    format!(
        "{prefix}_{}",
        Utc::now().timestamp_nanos_opt().unwrap_or_default()
    )
}

fn deterministic_embedding(text: &str, dimensions: usize) -> Vec<f32> {
    let mut hash: u64 = 5381;
    for byte in text.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(u64::from(byte));
    }

    (0..dimensions)
        .map(|index| ((hash.wrapping_add(index as u64) % 1000) as f32) / 1000.0)
        .collect()
}

fn make_embedding(org_id: &OrgId, event_id: EventId, text: &str, vector: &[f32]) -> EventEmbedding {
    EventEmbedding {
        event_id,
        org_id: org_id.clone(),
        embedding: vector.to_vec(),
        embedded_text: text.to_string(),
        model_version: "deterministic-live-test".to_string(),
    }
}
