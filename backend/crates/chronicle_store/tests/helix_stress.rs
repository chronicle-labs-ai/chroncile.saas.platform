//! Manual stress benchmark for the Helix-backed event store.
//!
//! Runs a large mixed workload through the real Postgres + Helix path:
//! - canonical event inserts through `HelixEventStore`
//! - Helix graph link creation
//! - Helix event embeddings
//! - Helix trace materialization + OOD lookup
//! - Helix BM25, vector, entity, and traversal queries
//!
//! Example:
//! `HELIX_TEST_DATABASE_URL=postgres://chronicle:chronicle_dev@127.0.0.1:5432/chronicle \
//!   HELIX_TEST_PORT=6971 \
//!   HELIX_STRESS_SYNC_MODE=batched \
//!   HELIX_STRESS_EVENTS=10000 \
//!   cargo test -p chronicle_store --features "postgres helix" \
//!   --test helix_stress helix_stress_large_mixed_workload -- --ignored --nocapture --test-threads=1`

#![cfg(all(feature = "postgres", feature = "helix"))]

use std::env;
use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use chrono::{Duration, Utc};

use chronicle_core::event::{Event, EventBuilder};
use chronicle_core::ids::{Confidence, EntityId, EntityType, EventId, LinkId, OrgId};
use chronicle_core::link::{EventLink, LinkDirection};
use chronicle_core::query::{GraphQuery, OrderBy, StructuredQuery};
use chronicle_store::helix::{
    DeterministicTextEmbedder, HelixConnectionConfig, HelixGraphBackend, HelixTraceOodService,
    TextEmbedder, DEFAULT_HELIX_ENDPOINT, DEFAULT_HELIX_PORT, DEFAULT_HELIX_PROJECT_DIR,
};
use chronicle_store::postgres::PostgresBackend;
use chronicle_store::traits::{
    EmbeddingStore, EntityRefStore, EventEmbedding, EventLinkStore, EventStore,
};

const DEFAULT_TEST_DB_URL: &str = "postgres://chronicle:chronicle@localhost:5433/chronicle";
const DEFAULT_TOTAL_EVENTS: usize = 10_000;
const DEFAULT_BATCH_SIZE: usize = 250;
const DEFAULT_SYNC_CHUNK_SIZE: usize = 50;
const DEFAULT_QUERY_ITERATIONS: usize = 5;
const DEFAULT_REFUND_MIN_AMOUNT: f64 = 5_000.0;
const EMBEDDING_DIMENSIONS: usize = 8;
const WORKFLOW_EVENT_COUNT: usize = 10;
const LINKS_PER_WORKFLOW: usize = 3;
const BM25_LIMIT: usize = 50;
const VECTOR_LIMIT: usize = 25;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HelixSyncMode {
    Serial,
    Batched,
}

impl HelixSyncMode {
    fn from_env() -> Self {
        match env::var("HELIX_STRESS_SYNC_MODE")
            .unwrap_or_else(|_| "serial".to_string())
            .as_str()
        {
            "serial" => Self::Serial,
            "batched" => Self::Batched,
            other => panic!("unsupported HELIX_STRESS_SYNC_MODE: {other}"),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Serial => "serial",
            Self::Batched => "batched",
        }
    }
}

#[derive(Debug, Clone)]
struct StressConfig {
    total_events: usize,
    batch_size: usize,
    sync_chunk_size: usize,
    query_iterations: usize,
    refund_min_amount: f64,
    sync_mode: HelixSyncMode,
}

impl StressConfig {
    fn from_env() -> Self {
        Self {
            total_events: rounded_total_events(env_usize(
                "HELIX_STRESS_EVENTS",
                DEFAULT_TOTAL_EVENTS,
            )),
            batch_size: env_usize("HELIX_STRESS_BATCH_SIZE", DEFAULT_BATCH_SIZE).max(1),
            sync_chunk_size: env_usize("HELIX_STRESS_SYNC_CHUNK_SIZE", DEFAULT_SYNC_CHUNK_SIZE)
                .max(1),
            query_iterations: env_usize("HELIX_STRESS_QUERY_ITERATIONS", DEFAULT_QUERY_ITERATIONS)
                .max(1),
            refund_min_amount: env_f64("HELIX_STRESS_REFUND_MIN_AMOUNT", DEFAULT_REFUND_MIN_AMOUNT),
            sync_mode: HelixSyncMode::from_env(),
        }
    }

    fn workflow_count(&self) -> usize {
        self.total_events / WORKFLOW_EVENT_COUNT
    }
}

#[derive(Debug, Clone)]
struct TraceSeed {
    trace_key: String,
    trace_type: String,
    event_ids: Vec<EventId>,
}

#[derive(Debug)]
struct StressDataset {
    org_id: String,
    sample_customer_id: String,
    sample_semantic_query: String,
    raw_keyword: String,
    generic_keyword: String,
    sample_refunded_event_id: EventId,
    expected_customer_event_count: usize,
    expected_refund_trace_count: usize,
    events: Vec<Event>,
    links: Vec<EventLink>,
    traces: Vec<TraceSeed>,
    embedding_inputs: Vec<(EventId, String)>,
}

impl StressDataset {
    fn build(config: &StressConfig) -> Self {
        let org_id = unique_org_id("helix_stress");
        let mut events = Vec::with_capacity(config.total_events);
        let mut links = Vec::with_capacity(config.workflow_count() * LINKS_PER_WORKFLOW);
        let mut traces = Vec::with_capacity(config.workflow_count());
        let mut embedding_inputs = Vec::with_capacity(config.workflow_count() * 2);
        let run_marker = format!(
            "stressmarker{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        let mut sample_customer_id = String::new();
        let mut sample_semantic_query = String::new();
        let mut sample_refunded_event_id = None;
        let mut expected_refund_trace_count = 0usize;
        let base_time = Utc::now() - Duration::days(45);

        for workflow_index in 0..config.workflow_count() {
            let customer_id = format!("cust_{workflow_index:05}");
            let session_id = format!("sess_{workflow_index:05}");
            let conversation_id = format!("conv_{workflow_index:05}");
            let ticket_id = format!("zd_{workflow_index:05}");
            let payment_intent_id = format!("pi_{workflow_index:05}");
            let amount = 4_000.0 + ((workflow_index % 7) as f64 * 700.0);
            let is_refund_trace = workflow_index % 3 == 0;
            let trace_type = if is_refund_trace {
                "refund_resolution"
            } else {
                "support_resolution"
            };

            if sample_customer_id.is_empty() {
                sample_customer_id = customer_id.clone();
            }

            let workflow_start =
                base_time + Duration::minutes((workflow_index * WORKFLOW_EVENT_COUNT) as i64);

            let payment_failed = EventBuilder::new(
                org_id.as_str(),
                "stripe",
                "payments",
                "payment_intent.failed",
            )
            .entity("customer", customer_id.as_str())
            .entity("session", session_id.as_str())
            .payload(serde_json::json!({
                "amount": amount,
                "currency": "usd",
                "status": "failed",
                "customer_id": customer_id,
                "payment_intent_id": payment_intent_id
            }))
            .event_time(workflow_start)
            .build();

            let intercom_text = format!(
                "refund requested after payment failed for customer {customer_id} {run_marker}"
            );
            if sample_semantic_query.is_empty() {
                sample_semantic_query = intercom_text.clone();
            }

            let intercom_reply = EventBuilder::new(
                org_id.as_str(),
                "intercom",
                "conversations",
                "conversation.user.replied",
            )
            .entity("customer", customer_id.as_str())
            .payload(serde_json::json!({
                "conversation_id": conversation_id,
                "message": intercom_text,
                "rating": if workflow_index % 4 == 0 { 1 } else { 4 },
                "assignee_id": format!("agent_{:03}", workflow_index % 25)
            }))
            .event_time(workflow_start + Duration::minutes(1))
            .build();

            let zendesk_ticket =
                EventBuilder::new(org_id.as_str(), "zendesk", "tickets", "ticket.created")
                    .entity("customer", customer_id.as_str())
                    .entity("ticket", ticket_id.as_str())
                    .payload(serde_json::json!({
                        "ticket_id": ticket_id,
                        "subject": format!("Refund follow up for {customer_id}"),
                        "priority": if workflow_index % 5 == 0 { "urgent" } else { "normal" },
                        "status": "open",
                        "requester_id": customer_id
                    }))
                    .event_time(workflow_start + Duration::minutes(2))
                    .build();

            let stripe_resolution = EventBuilder::new(
                org_id.as_str(),
                "stripe",
                "payments",
                if is_refund_trace {
                    "charge.refunded"
                } else {
                    "payment_intent.succeeded"
                },
            )
            .entity("customer", customer_id.as_str())
            .payload(serde_json::json!({
                "amount": amount + 900.0,
                "currency": "usd",
                "status": if is_refund_trace { "refunded" } else { "succeeded" },
                "customer_id": customer_id,
                "payment_intent_id": payment_intent_id
            }))
            .event_time(workflow_start + Duration::minutes(3))
            .build();

            let generic_keyword_message = format!(
                "generic escalation marker payload for customer {customer_id} {run_marker}"
            );
            let generic_webhook =
                EventBuilder::new(org_id.as_str(), "custom_webhook", "cases", "case.synced")
                    .entity("customer", customer_id.as_str())
                    .payload(serde_json::json!({
                        "category": "custom-escalation",
                        "message": generic_keyword_message,
                        "customerId": customer_id,
                        "details": {
                            "nested": {
                                "severity": if workflow_index % 2 == 0 { "high" } else { "medium" }
                            }
                        }
                    }))
                    .event_time(workflow_start + Duration::minutes(4))
                    .build();

            let page_view = EventBuilder::new(org_id.as_str(), "product", "usage", "page.viewed")
                .entity("customer", customer_id.as_str())
                .entity("session", session_id.as_str())
                .payload(serde_json::json!({
                    "url": "/billing",
                    "duration_ms": 30_000 + (workflow_index % 5) * 1_000
                }))
                .event_time(workflow_start + Duration::minutes(5))
                .build();

            let feature_used =
                EventBuilder::new(org_id.as_str(), "product", "usage", "feature.used")
                    .entity("customer", customer_id.as_str())
                    .payload(serde_json::json!({
                        "feature": "refund-center",
                        "success": workflow_index % 6 != 0
                    }))
                    .event_time(workflow_start + Duration::minutes(6))
                    .build();

            let slack_message =
                EventBuilder::new(org_id.as_str(), "slack", "messages", "message.posted")
                    .entity("customer", customer_id.as_str())
                    .payload(serde_json::json!({
                        "channel": "support-escalations",
                        "text": format!("refund sync noted for {customer_id}")
                    }))
                    .event_time(workflow_start + Duration::minutes(7))
                    .build();

            let case_note = EventBuilder::new(
                org_id.as_str(),
                "custom_webhook",
                "cases",
                "case.note_added",
            )
            .entity("customer", customer_id.as_str())
            .payload(serde_json::json!({
                "category": "case-note",
                "message": format!("follow up note for {customer_id}"),
                "tags": ["refund", "support"]
            }))
            .event_time(workflow_start + Duration::minutes(8))
            .build();

            let final_page = EventBuilder::new(org_id.as_str(), "product", "usage", "page.viewed")
                .entity("customer", customer_id.as_str())
                .entity("session", session_id.as_str())
                .payload(serde_json::json!({
                    "url": "/refund-status",
                    "duration_ms": 45_000
                }))
                .event_time(workflow_start + Duration::minutes(9))
                .build();

            let trace_event_ids = vec![
                payment_failed.event_id,
                intercom_reply.event_id,
                zendesk_ticket.event_id,
                stripe_resolution.event_id,
                generic_webhook.event_id,
            ];

            links.push(EventLink {
                link_id: LinkId::new(),
                source_event_id: payment_failed.event_id,
                target_event_id: intercom_reply.event_id,
                link_type: "caused_by".to_string(),
                confidence: Confidence::new(0.94).expect("valid confidence"),
                reasoning: Some("payment failure triggered support reply".to_string()),
                created_by: "helix_stress".to_string(),
                created_at: workflow_start + Duration::minutes(1),
            });
            links.push(EventLink {
                link_id: LinkId::new(),
                source_event_id: intercom_reply.event_id,
                target_event_id: zendesk_ticket.event_id,
                link_type: "caused_by".to_string(),
                confidence: Confidence::new(0.92).expect("valid confidence"),
                reasoning: Some("support reply escalated to Zendesk".to_string()),
                created_by: "helix_stress".to_string(),
                created_at: workflow_start + Duration::minutes(2),
            });
            links.push(EventLink {
                link_id: LinkId::new(),
                source_event_id: zendesk_ticket.event_id,
                target_event_id: stripe_resolution.event_id,
                link_type: "caused_by".to_string(),
                confidence: Confidence::new(0.91).expect("valid confidence"),
                reasoning: Some("ticket resulted in payment resolution".to_string()),
                created_by: "helix_stress".to_string(),
                created_at: workflow_start + Duration::minutes(3),
            });

            if is_refund_trace && amount + 900.0 >= config.refund_min_amount {
                expected_refund_trace_count += 1;
            }
            if is_refund_trace {
                if sample_refunded_event_id.is_none() {
                    sample_refunded_event_id = Some(stripe_resolution.event_id);
                }
            }

            traces.push(TraceSeed {
                trace_key: format!("trace_{workflow_index:05}"),
                trace_type: trace_type.to_string(),
                event_ids: trace_event_ids,
            });
            embedding_inputs.push((intercom_reply.event_id, intercom_text));
            embedding_inputs.push((generic_webhook.event_id, generic_keyword_message));

            events.extend([
                payment_failed,
                intercom_reply,
                zendesk_ticket,
                stripe_resolution,
                generic_webhook,
                page_view,
                feature_used,
                slack_message,
                case_note,
                final_page,
            ]);
        }

        Self {
            org_id,
            sample_customer_id,
            sample_semantic_query,
            raw_keyword: run_marker.clone(),
            generic_keyword: run_marker,
            sample_refunded_event_id: sample_refunded_event_id.expect("at least one refund trace"),
            expected_customer_event_count: WORKFLOW_EVENT_COUNT,
            expected_refund_trace_count,
            events,
            links,
            traces,
            embedding_inputs,
        }
    }

    fn build_embeddings(&self) -> Vec<EventEmbedding> {
        let org_id = OrgId::new(self.org_id.as_str());
        self.embedding_inputs
            .iter()
            .map(|(event_id, text)| EventEmbedding {
                event_id: *event_id,
                org_id: org_id.clone(),
                embedding: deterministic_embedding(text, EMBEDDING_DIMENSIONS),
                embedded_text: text.clone(),
                model_version: "deterministic-stress-test".to_string(),
            })
            .collect()
    }
}

#[derive(Debug)]
struct StageMetric {
    label: String,
    item_count: usize,
    elapsed_ms: u128,
    items_per_sec: f64,
}

impl StageMetric {
    fn print(&self) {
        eprintln!(
            "  {:22} {:>8} items {:>8}ms {:>12.0} items/sec",
            self.label, self.item_count, self.elapsed_ms, self.items_per_sec
        );
    }
}

#[derive(Debug)]
struct QueryMetric {
    label: String,
    average_ms: f64,
    min_ms: u128,
    max_ms: u128,
    result_count: usize,
}

impl QueryMetric {
    fn print(&self) {
        eprintln!(
            "  {:22} avg {:>8.2}ms min {:>6}ms max {:>6}ms results {:>6}",
            self.label, self.average_ms, self.min_ms, self.max_ms, self.result_count
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "manual stress benchmark"]
async fn helix_stress_large_mixed_workload() {
    let config = StressConfig::from_env();
    let dataset = StressDataset::build(&config);
    let embedder = DeterministicTextEmbedder::new(EMBEDDING_DIMENSIONS);
    let (canonical, graph) = live_helix_backend().await;
    let org = OrgId::new(dataset.org_id.as_str());
    let trace_service = HelixTraceOodService::new(graph.clone());
    let embeddings = dataset.build_embeddings();

    eprintln!("\n{}", "=".repeat(78));
    eprintln!("  HELIX STRESS BENCHMARK");
    eprintln!(
        "  org={} events={} workflows={} batch_size={} sync_mode={} links={} embeddings={} traces={}",
        dataset.org_id,
        dataset.events.len(),
        config.workflow_count(),
        config.batch_size,
        config.sync_mode.as_str(),
        dataset.links.len(),
        embeddings.len(),
        dataset.traces.len(),
    );
    eprintln!("{}", "=".repeat(78));

    let insert_metric = measure_stage("canonical inserts", dataset.events.len(), || async {
        for chunk in dataset.events.chunks(config.batch_size) {
            canonical.insert_events(chunk).await?;
        }
        Ok(())
    })
    .await;
    insert_metric.print();

    let mirror_label = format!("Helix mirror sync ({})", config.sync_mode.as_str());
    let mirror_metric = measure_stage(mirror_label.as_str(), dataset.events.len(), || async {
        let mut mirrored = 0usize;
        for chunk in dataset.events.chunks(config.sync_chunk_size) {
            match config.sync_mode {
                HelixSyncMode::Serial => graph.sync_events(chunk).await?,
                HelixSyncMode::Batched => graph.sync_events_batched(chunk).await?,
            }
            mirrored += chunk.len();
            if mirrored % (config.sync_chunk_size * 5) == 0 || mirrored == dataset.events.len() {
                eprintln!("    mirrored {mirrored}/{} events", dataset.events.len());
            }
        }
        Ok(())
    })
    .await;
    mirror_metric.print();

    let canonical_count = canonical
        .count(&StructuredQuery {
            org_id: org.clone(),
            source: None,
            entity: None,
            topic: None,
            event_type: None,
            time_range: None,
            payload_filters: vec![],
            group_by: None,
            order_by: OrderBy::EventTimeDesc,
            limit: 1,
            offset: 0,
        })
        .await
        .expect("count canonical events");
    assert_eq!(canonical_count, dataset.events.len() as u64);

    let link_metric = measure_stage("create graph links", dataset.links.len(), || async {
        for link in &dataset.links {
            graph.create_link(&org, link).await?;
        }
        Ok(())
    })
    .await;
    link_metric.print();

    let embedding_metric = measure_stage("store embeddings", embeddings.len(), || async {
        for chunk in embeddings.chunks(config.batch_size.min(500)) {
            graph.store_embeddings(chunk).await?;
        }
        Ok(())
    })
    .await;
    embedding_metric.print();

    let trace_metric = measure_stage("materialize traces", dataset.traces.len(), || async {
        for trace in &dataset.traces {
            trace_service
                .upsert_materialized_trace(
                    trace.trace_key.as_str(),
                    trace.trace_type.as_str(),
                    "deterministic-stress-test",
                    &org,
                    &trace.event_ids,
                    &embedder,
                )
                .await?;
        }
        Ok(())
    })
    .await;
    trace_metric.print();

    let semantic_vector = embedder
        .embed_text(dataset.sample_semantic_query.as_str())
        .await
        .expect("build semantic vector");

    let raw_query_metric = measure_query("raw payload BM25", config.query_iterations, || async {
        Ok(graph
            .search_raw_payload_keywords(&org, &dataset.raw_keyword, BM25_LIMIT)
            .await?
            .len())
    })
    .await;
    raw_query_metric.print();

    let generic_query_metric =
        measure_query("generic payload BM25", config.query_iterations, || async {
            Ok(graph
                .search_generic_payload_keywords(&org, &dataset.generic_keyword, BM25_LIMIT)
                .await?
                .len())
        })
        .await;
    generic_query_metric.print();

    let vector_query_metric =
        measure_query("event vector search", config.query_iterations, || async {
            Ok(graph
                .search_event_candidates(&org, &semantic_vector, VECTOR_LIMIT)
                .await?
                .len())
        })
        .await;
    vector_query_metric.print();

    let entity_query_metric =
        measure_query("entity traversal", config.query_iterations, || async {
            Ok(graph
                .get_events_for_entity(
                    &org,
                    &EntityType::new("customer"),
                    &EntityId::new(dataset.sample_customer_id.as_str()),
                )
                .await?
                .len())
        })
        .await;
    entity_query_metric.print();

    let traversal_query_metric =
        measure_query("link traversal", config.query_iterations, || async {
            Ok(graph
                .traverse(&GraphQuery {
                    org_id: org.clone(),
                    start_event_id: dataset.sample_refunded_event_id,
                    direction: LinkDirection::Incoming,
                    link_types: Some(vec!["caused_by".to_string()]),
                    max_depth: 4,
                    min_confidence: 0.7,
                })
                .await?
                .len())
        })
        .await;
    traversal_query_metric.print();

    let trace_search_metric =
        measure_query("refund trace search", config.query_iterations, || async {
            Ok(graph
                .search_stripe_refund_traces(&org, config.refund_min_amount)
                .await?
                .len())
        })
        .await;
    trace_search_metric.print();

    let sample_trace = trace_service
        .materialize_trace(
            "sample_ood_trace",
            "refund_resolution",
            "deterministic-stress-test",
            &org,
            &dataset.traces[0].event_ids,
        )
        .await
        .expect("materialize sample trace");

    let ood_metric = measure_query("trace OOD lookup", config.query_iterations, || async {
        Ok(trace_service
            .assess_trace_document(&sample_trace, VECTOR_LIMIT, 0.5, &embedder)
            .await?
            .candidates
            .len())
    })
    .await;
    ood_metric.print();

    let vector_results = graph
        .search_event_candidates(&org, &semantic_vector, VECTOR_LIMIT)
        .await
        .expect("vector search results");
    let entity_events = graph
        .get_events_for_entity(
            &org,
            &EntityType::new("customer"),
            &EntityId::new(dataset.sample_customer_id.as_str()),
        )
        .await
        .expect("entity traversal results");
    let traversal_results = graph
        .traverse(&GraphQuery {
            org_id: org.clone(),
            start_event_id: dataset.sample_refunded_event_id,
            direction: LinkDirection::Incoming,
            link_types: Some(vec!["caused_by".to_string()]),
            max_depth: 4,
            min_confidence: 0.7,
        })
        .await
        .expect("graph traversal results");
    let refund_traces = graph
        .search_stripe_refund_traces(&org, config.refund_min_amount)
        .await
        .expect("refund traces");
    let ood = trace_service
        .assess_trace_document(&sample_trace, VECTOR_LIMIT, 0.5, &embedder)
        .await
        .expect("OOD assessment");

    assert!(raw_query_metric.result_count > 0);
    assert!(generic_query_metric.result_count > 0);
    assert!(!vector_results.is_empty());
    assert_eq!(entity_events.len(), dataset.expected_customer_event_count);
    assert!(traversal_results.len() >= 3);
    assert_eq!(refund_traces.len(), dataset.expected_refund_trace_count);
    assert!(!ood.is_ood);
    assert!(ood.best_score.unwrap_or_default() > 0.8);

    eprintln!("\nSummary:");
    insert_metric.print();
    mirror_metric.print();
    link_metric.print();
    embedding_metric.print();
    trace_metric.print();
    raw_query_metric.print();
    generic_query_metric.print();
    vector_query_metric.print();
    entity_query_metric.print();
    traversal_query_metric.print();
    trace_search_metric.print();
    ood_metric.print();
    eprintln!("{}", "=".repeat(78));
}

async fn live_helix_backend() -> (Arc<PostgresBackend>, Arc<HelixGraphBackend>) {
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
    (canonical, graph)
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

async fn measure_stage<F, Fut>(label: &str, item_count: usize, operation: F) -> StageMetric
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<(), chronicle_core::error::StoreError>>,
{
    let started = Instant::now();
    operation().await.expect("stress stage should succeed");
    let elapsed = started.elapsed();
    let elapsed_ms = elapsed.as_millis();
    let items_per_sec = if elapsed.as_secs_f64() > 0.0 {
        item_count as f64 / elapsed.as_secs_f64()
    } else {
        f64::INFINITY
    };

    StageMetric {
        label: label.to_string(),
        item_count,
        elapsed_ms,
        items_per_sec,
    }
}

async fn measure_query<F, Fut>(label: &str, iterations: usize, mut operation: F) -> QueryMetric
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<usize, chronicle_core::error::StoreError>>,
{
    let mut total_ms = 0f64;
    let mut min_ms = u128::MAX;
    let mut max_ms = 0u128;
    let mut result_count = 0usize;

    for _ in 0..iterations {
        let started = Instant::now();
        result_count = operation().await.expect("stress query should succeed");
        let elapsed_ms = started.elapsed().as_millis();
        total_ms += elapsed_ms as f64;
        min_ms = min_ms.min(elapsed_ms);
        max_ms = max_ms.max(elapsed_ms);
    }

    QueryMetric {
        label: label.to_string(),
        average_ms: total_ms / iterations as f64,
        min_ms,
        max_ms,
        result_count,
    }
}

fn rounded_total_events(requested: usize) -> usize {
    let requested = requested.max(WORKFLOW_EVENT_COUNT);
    let remainder = requested % WORKFLOW_EVENT_COUNT;
    if remainder == 0 {
        requested
    } else {
        requested + (WORKFLOW_EVENT_COUNT - remainder)
    }
}

fn env_usize(name: &str, default: usize) -> usize {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(default)
}

fn env_f64(name: &str, default: f64) -> f64 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(default)
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
