mod client;
mod llm;
mod payloads;

pub use client::{
    HelixConnectionConfig, HelixGraphClient, DEFAULT_HELIX_ENDPOINT, DEFAULT_HELIX_PORT,
    DEFAULT_HELIX_PROJECT_DIR,
};
pub use llm::{AnthropicLinkDecisionConfig, AnthropicLinkDecisionModel};

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::Serialize;
use serde_json::{json, Map, Value};

use chronicle_core::entity_ref::EntityRef;
use chronicle_core::error::StoreError;
use chronicle_core::event::Event;
use chronicle_core::ids::{Confidence, EntityId, EntityType, EventId, LinkId, OrgId};
use chronicle_core::link::{EventLink, LinkDirection};
use chronicle_core::query::{
    EventResult, GraphQuery, SemanticQuery, StructuredQuery, TimelineQuery,
};

use crate::traits::{
    EmbeddingStore, EntityInfo, EntityRefStore, EntityTypeInfo, EventEmbedding, EventLinkStore,
    EventStore,
};

use self::client::SdkHelixGraphClient;
use self::payloads::{
    payload_schema_fingerprint, payload_source_event_type, project_payload, raw_payload_text,
    PayloadProjection,
};

const DEFAULT_SEARCH_EMBEDDING_DIMENSIONS: usize = 16;
const HELIX_SEARCH_OVERFETCH_MULTIPLIER: usize = 10;
const HELIX_MAX_SEARCH_CANDIDATES: usize = 1_000;

fn overfetch_search_limit(requested_limit: usize) -> i64 {
    requested_limit
        .max(1)
        .saturating_mul(HELIX_SEARCH_OVERFETCH_MULTIPLIER)
        .min(HELIX_MAX_SEARCH_CANDIDATES) as i64
}

#[derive(Debug, Default, Serialize)]
struct SyncEventsBatchRequest {
    events: Vec<SyncEventBatchRecord>,
}

#[derive(Debug, Serialize)]
struct SyncEventBatchRecord {
    external_id: String,
    org_id: String,
    source: String,
    topic: String,
    event_type: String,
    event_time: String,
    ingestion_time: String,
    actor_type: String,
    actor_id: String,
    raw_body: String,
    raw_payloads: Vec<SyncRawPayloadBatchRecord>,
    generic_payloads: Vec<SyncGenericPayloadBatchRecord>,
    stripe_payloads: Vec<SyncStripePayloadBatchRecord>,
    intercom_payloads: Vec<SyncIntercomPayloadBatchRecord>,
    zendesk_payloads: Vec<SyncZendeskPayloadBatchRecord>,
    entity_refs: Vec<SyncEntityRefBatchRecord>,
}

#[derive(Debug, Serialize)]
struct SyncRawPayloadBatchRecord {
    payload_text: String,
    source_event_type: String,
    schema_fingerprint: String,
    mirrored_at: String,
}

#[derive(Debug, Serialize)]
struct SyncGenericPayloadBatchRecord {
    payload_text: String,
    source_event_type: String,
    schema_fingerprint: String,
    first_seen_at: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct SyncStripePayloadBatchRecord {
    amount: f64,
    currency: String,
    status: String,
    customer_id: String,
    payment_intent_id: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct SyncIntercomPayloadBatchRecord {
    conversation_id: String,
    message: String,
    rating: u8,
    assignee_id: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct SyncZendeskPayloadBatchRecord {
    ticket_id: String,
    subject: String,
    priority: String,
    status: String,
    requester_id: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct SyncEntityRefBatchRecord {
    scoped_entity_key: String,
    entity_type: String,
    entity_id: String,
    created_by: String,
    created_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TraceDocument {
    pub trace_key: String,
    pub org_id: OrgId,
    pub trace_type: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub event_ids: Vec<EventId>,
    pub status: String,
    pub structural_signature: String,
    pub embedded_text: String,
    pub model_version: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TraceMatch {
    pub trace_id: String,
    pub trace_key: String,
    pub trace_type: String,
    pub event_count: u32,
    pub status: String,
    pub score: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OodAssessment {
    pub is_ood: bool,
    pub best_score: Option<f64>,
    pub threshold: f64,
    pub candidates: Vec<TraceMatch>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LinkDecision {
    pub target_event_id: EventId,
    pub link_type: String,
    pub confidence: f32,
    pub reasoning: Option<String>,
}

#[async_trait]
pub trait LinkDecisionModel: Send + Sync + 'static {
    async fn evaluate(
        &self,
        source_event: &Event,
        candidates: &[EventResult],
    ) -> Result<Vec<LinkDecision>, StoreError>;
}

#[async_trait]
pub trait TextEmbedder: Send + Sync + 'static {
    async fn embed_text(&self, text: &str) -> Result<Vec<f64>, StoreError>;
}

#[derive(Debug, Clone, Copy)]
pub struct DeterministicTextEmbedder {
    dimensions: usize,
}

impl Default for DeterministicTextEmbedder {
    fn default() -> Self {
        Self {
            dimensions: DEFAULT_SEARCH_EMBEDDING_DIMENSIONS,
        }
    }
}

impl DeterministicTextEmbedder {
    pub fn new(dimensions: usize) -> Self {
        Self { dimensions }
    }
}

#[async_trait]
impl TextEmbedder for DeterministicTextEmbedder {
    async fn embed_text(&self, text: &str) -> Result<Vec<f64>, StoreError> {
        Ok(hash_text_to_vector(text, self.dimensions))
    }
}

impl TraceDocument {
    pub fn from_events(
        trace_key: impl Into<String>,
        trace_type: impl Into<String>,
        model_version: impl Into<String>,
        events: &[Event],
    ) -> Result<Self, StoreError> {
        let Some(first_event) = events.first() else {
            return Err(StoreError::Query(
                "cannot materialize a trace without events".to_string(),
            ));
        };

        if events
            .iter()
            .any(|event| event.org_id != first_event.org_id)
        {
            return Err(StoreError::Query(
                "all events in a trace must belong to the same org".to_string(),
            ));
        }

        let start_time = events
            .iter()
            .map(|event| event.event_time)
            .min()
            .unwrap_or(first_event.event_time);
        let end_time = events
            .iter()
            .map(|event| event.event_time)
            .max()
            .unwrap_or(first_event.event_time);

        Ok(Self {
            trace_key: trace_key.into(),
            org_id: first_event.org_id,
            trace_type: trace_type.into(),
            start_time,
            end_time,
            event_ids: events.iter().map(|event| event.event_id).collect(),
            status: trace_status_from_events(events),
            structural_signature: trace_structural_signature(events),
            embedded_text: trace_embedding_text(events),
            model_version: model_version.into(),
        })
    }
}

#[derive(Clone)]
pub struct HelixGraphBackend {
    client: Arc<dyn HelixGraphClient>,
    canonical_events: Arc<dyn EventStore>,
    canonical_entity_refs: Arc<dyn EntityRefStore>,
    canonical_links: Arc<dyn EventLinkStore>,
    canonical_embeddings: Arc<dyn EmbeddingStore>,
    event_node_cache: Arc<RwLock<HashMap<String, String>>>,
    event_embedding_cache: Arc<RwLock<HashMap<String, Vec<f64>>>>,
    trace_embedding_cache: Arc<RwLock<HashMap<String, Vec<f64>>>>,
}

impl HelixGraphBackend {
    pub fn new(
        config: HelixConnectionConfig,
        canonical_events: Arc<dyn EventStore>,
        canonical_entity_refs: Arc<dyn EntityRefStore>,
        canonical_links: Arc<dyn EventLinkStore>,
        canonical_embeddings: Arc<dyn EmbeddingStore>,
    ) -> Self {
        Self::from_client(
            Arc::new(SdkHelixGraphClient::new(&config)),
            canonical_events,
            canonical_entity_refs,
            canonical_links,
            canonical_embeddings,
        )
    }

    pub fn from_client(
        client: Arc<dyn HelixGraphClient>,
        canonical_events: Arc<dyn EventStore>,
        canonical_entity_refs: Arc<dyn EntityRefStore>,
        canonical_links: Arc<dyn EventLinkStore>,
        canonical_embeddings: Arc<dyn EmbeddingStore>,
    ) -> Self {
        Self {
            client,
            canonical_events,
            canonical_entity_refs,
            canonical_links,
            canonical_embeddings,
            event_node_cache: Arc::new(RwLock::new(HashMap::new())),
            event_embedding_cache: Arc::new(RwLock::new(HashMap::new())),
            trace_embedding_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn sync_event(&self, event: &Event) -> Result<(), StoreError> {
        let sync_started = Instant::now();
        let event_node_id = self
            .run_event_sync_step(event, "upsert_event", self.upsert_event_node(event))
            .await?;
        self.event_node_cache
            .write()
            .insert(event.event_id.to_string(), event_node_id.clone());

        if let Some(payload_text) = raw_payload_text(event) {
            let raw_payload = self
                .run_event_sync_step(
                    event,
                    "upsert_raw_payload",
                    self.query(
                        "UpsertRawPayload",
                        json!({
                            "event_external_id": event.event_id.to_string(),
                            "org_id": event.org_id.as_str(),
                            "payload_text": payload_text,
                            "source_event_type": payload_source_event_type(event),
                            "schema_fingerprint": event
                                .payload
                                .as_ref()
                                .map(payload_schema_fingerprint)
                                .unwrap_or_default(),
                            "mirrored_at": event.ingestion_time.to_rfc3339(),
                        }),
                    ),
                )
                .await?;
            let raw_payload_id = self.required_field(&raw_payload, "payload", "payloadID")?;
            self.run_event_sync_step(
                event,
                "link_event_to_raw_payload",
                self.query(
                    "LinkEventToRawPayload",
                    json!({
                        "event_id": event_node_id,
                        "payload_id": raw_payload_id,
                        "created_at": event.ingestion_time.to_rfc3339(),
                    }),
                ),
            )
            .await?;
        }

        if let Some(payload_projection) = project_payload(event) {
            self.sync_projected_payload(event, &event_node_id, payload_projection)
                .await?;
        }

        for entity_ref in event.materialize_entity_refs("ingestion") {
            self.mirror_entity_ref(Some(event), &event.org_id, &event_node_id, &entity_ref)
                .await?;
        }

        tracing::debug!(
            event_id = %event.event_id,
            org_id = %event.org_id,
            elapsed_ms = sync_started.elapsed().as_millis(),
            "Helix event sync completed"
        );
        Ok(())
    }

    pub async fn sync_events(&self, events: &[Event]) -> Result<(), StoreError> {
        for event in events {
            self.sync_event(event).await?;
        }
        Ok(())
    }

    pub async fn sync_events_batched(&self, events: &[Event]) -> Result<(), StoreError> {
        if events.is_empty() {
            return Ok(());
        }

        let batch = Self::build_sync_events_batch_request(events);
        let event_count = batch.events.len();
        let raw_payload_count = batch
            .events
            .iter()
            .map(|event| event.raw_payloads.len())
            .sum::<usize>();
        let typed_payload_count = batch
            .events
            .iter()
            .map(|event| {
                event.generic_payloads.len()
                    + event.stripe_payloads.len()
                    + event.intercom_payloads.len()
                    + event.zendesk_payloads.len()
            })
            .sum::<usize>();
        let entity_ref_count = batch
            .events
            .iter()
            .map(|event| event.entity_refs.len())
            .sum::<usize>();

        self.query("SyncEventsBatch", json!(batch)).await?;
        tracing::debug!(
            event_count,
            raw_payload_count,
            typed_payload_count,
            entity_ref_count,
            "Helix batch event sync completed"
        );
        Ok(())
    }

    pub async fn sync_existing_entity_refs(
        &self,
        org_id: &OrgId,
        refs: &[EntityRef],
    ) -> Result<(), StoreError> {
        for entity_ref in refs {
            let event_node_id = self
                .ensure_event_node_id(org_id, &entity_ref.event_id)
                .await?;
            self.mirror_entity_ref(None, org_id, &event_node_id, entity_ref)
                .await?;
        }

        Ok(())
    }

    pub async fn sync_existing_links(
        &self,
        org_id: &OrgId,
        links: &[EventLink],
    ) -> Result<(), StoreError> {
        for link in links {
            self.sync_existing_link(org_id, link).await?;
        }

        Ok(())
    }

    pub async fn sync_event_embedding(&self, embedding: &EventEmbedding) -> Result<(), StoreError> {
        let event_node_id = self
            .ensure_event_node_id(&embedding.org_id, &embedding.event_id)
            .await?;

        let response = self
            .query(
                "UpsertEventEmbedding",
                json!({
                    "vector": to_helix_vector(&embedding.embedding),
                    "event_external_id": embedding.event_id.to_string(),
                    "org_id": embedding.org_id.as_str(),
                    "source": "",
                    "embedded_text": embedding.embedded_text,
                    "model_version": embedding.model_version,
                }),
            )
            .await?;
        let embedding_id = self.required_field(&response, "embedding", "embeddingID")?;

        self.query(
            "LinkEventToEmbedding",
            json!({
                "event_id": event_node_id,
                "embedding_id": embedding_id,
                "created_at": Utc::now().to_rfc3339(),
            }),
        )
        .await?;

        self.event_embedding_cache.write().insert(
            embedding.event_id.to_string(),
            to_helix_vector(&embedding.embedding),
        );
        Ok(())
    }

    pub async fn upsert_trace(
        &self,
        trace: &TraceDocument,
        embedding: &[f64],
    ) -> Result<(), StoreError> {
        let response = self
            .query(
                "UpsertTrace",
                json!({
                    "trace_key": trace.trace_key,
                    "org_id": trace.org_id.as_str(),
                    "trace_type": trace.trace_type,
                    "start_time": trace.start_time.to_rfc3339(),
                    "end_time": trace.end_time.to_rfc3339(),
                    "event_count": trace.event_ids.len() as u32,
                    "status": trace.status,
                    "structural_signature": trace.structural_signature,
                }),
            )
            .await?;
        let trace_node_id = self.required_field(&response, "trace", "traceID")?;

        for (position, event_id) in trace.event_ids.iter().enumerate() {
            let event_node_id = self.ensure_event_node_id(&trace.org_id, event_id).await?;
            self.query(
                "LinkTraceToEvent",
                json!({
                    "trace_id": trace_node_id,
                    "event_id": event_node_id,
                    "position": position as u32,
                    "created_at": Utc::now().to_rfc3339(),
                }),
            )
            .await?;
        }

        let embedding_response = self
            .query(
                "UpsertTraceEmbedding",
                json!({
                    "vector": embedding,
                    "trace_key": trace.trace_key,
                    "org_id": trace.org_id.as_str(),
                    "trace_type": trace.trace_type,
                    "embedded_text": trace.embedded_text,
                    "model_version": trace.model_version,
                }),
            )
            .await?;
        let embedding_id = self.required_field(&embedding_response, "embedding", "embeddingID")?;

        self.query(
            "LinkTraceToEmbedding",
            json!({
                "trace_id": trace_node_id,
                "embedding_id": embedding_id,
                "created_at": Utc::now().to_rfc3339(),
            }),
        )
        .await?;

        self.trace_embedding_cache
            .write()
            .insert(trace.trace_key.clone(), embedding.to_vec());
        Ok(())
    }

    pub async fn sync_existing_link(
        &self,
        org_id: &OrgId,
        link: &EventLink,
    ) -> Result<(), StoreError> {
        let source_node_id = self
            .ensure_event_node_id(org_id, &link.source_event_id)
            .await?;
        let target_node_id = self
            .ensure_event_node_id(org_id, &link.target_event_id)
            .await?;

        self.query(
            "CreateCausalLink",
            json!({
                "source_event_id": source_node_id,
                "target_event_id": target_node_id,
                "link_type": link.link_type,
                "confidence": link.confidence.value() as f64,
                "reasoning": link.reasoning.clone().unwrap_or_default(),
                "created_by": link.created_by,
                "created_at": link.created_at.to_rfc3339(),
            }),
        )
        .await?;

        Ok(())
    }

    pub async fn search_event_candidates(
        &self,
        org_id: &OrgId,
        vector: &[f64],
        limit: usize,
    ) -> Result<Vec<EventResult>, StoreError> {
        let response = self
            .query(
                "SearchEventEmbeddings",
                json!({
                    "vector": vector,
                    "limit": overfetch_search_limit(limit),
                    "org_id": org_id.as_str(),
                }),
            )
            .await?;

        let external_ids = self.external_ids_from_records(&response, "events")?;
        let mut results = self
            .load_events_by_external_ids(org_id, &external_ids)
            .await?;
        results.truncate(limit);
        Ok(results)
    }

    pub async fn search_raw_payload_keywords(
        &self,
        org_id: &OrgId,
        keywords: &str,
        limit: usize,
    ) -> Result<Vec<EventResult>, StoreError> {
        let response = self
            .query(
                "SearchRawPayloadKeywords",
                json!({
                    "keywords": keywords,
                    "limit": overfetch_search_limit(limit),
                    "org_id": org_id.as_str(),
                }),
            )
            .await?;
        let external_ids = self.external_ids_from_records(&response, "events")?;
        let mut results = self
            .load_events_by_external_ids(org_id, &external_ids)
            .await?;
        results.truncate(limit);
        Ok(results)
    }

    pub async fn search_generic_payload_keywords(
        &self,
        org_id: &OrgId,
        keywords: &str,
        limit: usize,
    ) -> Result<Vec<EventResult>, StoreError> {
        let response = self
            .query(
                "SearchGenericPayloadKeywords",
                json!({
                    "keywords": keywords,
                    "limit": overfetch_search_limit(limit),
                    "org_id": org_id.as_str(),
                }),
            )
            .await?;
        let external_ids = self.external_ids_from_records(&response, "events")?;
        let mut results = self
            .load_events_by_external_ids(org_id, &external_ids)
            .await?;
        results.truncate(limit);
        Ok(results)
    }

    pub async fn search_trace_candidates(
        &self,
        org_id: &OrgId,
        vector: &[f64],
        limit: usize,
    ) -> Result<Vec<TraceMatch>, StoreError> {
        let response = self
            .query(
                "SearchTraceEmbeddings",
                json!({
                    "vector": vector,
                    "limit": overfetch_search_limit(limit),
                    "org_id": org_id.as_str(),
                }),
            )
            .await?;

        let mut matches = Vec::new();
        for record in self.records_from_field(&response, "traces")? {
            let trace_key = self.value_as_string(&record, "trace_key")?;
            let score = self
                .trace_embedding_cache
                .read()
                .get(&trace_key)
                .map(|existing| cosine_similarity(existing, vector));
            matches.push(TraceMatch {
                trace_id: self.value_as_string(&record, "traceID")?,
                trace_key,
                trace_type: self.value_as_string(&record, "trace_type")?,
                event_count: self.value_as_u32(&record, "event_count")?,
                status: self.value_as_string(&record, "status")?,
                score,
            });
        }
        matches.truncate(limit);
        Ok(matches)
    }

    pub async fn search_stripe_refund_traces(
        &self,
        org_id: &OrgId,
        min_amount: f64,
    ) -> Result<Vec<TraceMatch>, StoreError> {
        let response = self
            .query(
                "SearchStripeRefundTraces",
                json!({
                    "min_amount": min_amount,
                    "org_id": org_id.as_str(),
                }),
            )
            .await?;

        self.records_from_field(&response, "traces")?
            .into_iter()
            .map(|record| {
                Ok(TraceMatch {
                    trace_id: self.value_as_string(&record, "traceID")?,
                    trace_key: self.value_as_string(&record, "trace_key")?,
                    trace_type: self.value_as_string(&record, "trace_type")?,
                    event_count: self.value_as_u32(&record, "event_count")?,
                    status: self.value_as_string(&record, "status")?,
                    score: None,
                })
            })
            .collect()
    }

    fn build_sync_events_batch_request(events: &[Event]) -> SyncEventsBatchRequest {
        let mut batch = SyncEventsBatchRequest::default();
        batch.events.reserve(events.len());

        for event in events {
            let event_external_id = event.event_id.to_string();
            let org_id = event.org_id.as_str().to_string();
            let created_at = event.ingestion_time.to_rfc3339();
            let mut event_record = SyncEventBatchRecord {
                external_id: event_external_id.clone(),
                org_id: org_id.clone(),
                source: event.source.as_str().to_string(),
                topic: event.topic.as_str().to_string(),
                event_type: event.event_type.as_str().to_string(),
                event_time: event.event_time.to_rfc3339(),
                ingestion_time: created_at.clone(),
                actor_type: String::new(),
                actor_id: String::new(),
                raw_body: event.raw_body.clone().unwrap_or_default(),
                raw_payloads: Vec::new(),
                generic_payloads: Vec::new(),
                stripe_payloads: Vec::new(),
                intercom_payloads: Vec::new(),
                zendesk_payloads: Vec::new(),
                entity_refs: Vec::new(),
            };

            if let Some(payload_text) = raw_payload_text(event) {
                event_record.raw_payloads.push(SyncRawPayloadBatchRecord {
                    payload_text,
                    source_event_type: payload_source_event_type(event),
                    schema_fingerprint: event
                        .payload
                        .as_ref()
                        .map(payload_schema_fingerprint)
                        .unwrap_or_default(),
                    mirrored_at: created_at.clone(),
                });
            }

            if let Some(payload_projection) = project_payload(event) {
                match payload_projection {
                    PayloadProjection::Generic {
                        payload_text,
                        source_event_type,
                        schema_fingerprint,
                    } => event_record
                        .generic_payloads
                        .push(SyncGenericPayloadBatchRecord {
                            payload_text,
                            source_event_type,
                            schema_fingerprint,
                            first_seen_at: created_at.clone(),
                            created_at: created_at.clone(),
                        }),
                    PayloadProjection::StripePayment {
                        amount,
                        currency,
                        status,
                        customer_id,
                        payment_intent_id,
                    } => event_record
                        .stripe_payloads
                        .push(SyncStripePayloadBatchRecord {
                            amount,
                            currency,
                            status,
                            customer_id,
                            payment_intent_id,
                            created_at: created_at.clone(),
                        }),
                    PayloadProjection::IntercomConversation {
                        conversation_id,
                        message,
                        rating,
                        assignee_id,
                    } => event_record
                        .intercom_payloads
                        .push(SyncIntercomPayloadBatchRecord {
                            conversation_id,
                            message,
                            rating,
                            assignee_id,
                            created_at: created_at.clone(),
                        }),
                    PayloadProjection::ZendeskTicket {
                        ticket_id,
                        subject,
                        priority,
                        status,
                        requester_id,
                    } => event_record
                        .zendesk_payloads
                        .push(SyncZendeskPayloadBatchRecord {
                            ticket_id,
                            subject,
                            priority,
                            status,
                            requester_id,
                            created_at: created_at.clone(),
                        }),
                }
            }

            for entity_ref in event.materialize_entity_refs("ingestion") {
                event_record.entity_refs.push(SyncEntityRefBatchRecord {
                    scoped_entity_key: format!(
                        "{}::{}::{}",
                        event.org_id.as_str(),
                        entity_ref.entity_type.as_str(),
                        entity_ref.entity_id.as_str()
                    ),
                    entity_type: entity_ref.entity_type.as_str().to_string(),
                    entity_id: entity_ref.entity_id.as_str().to_string(),
                    created_by: entity_ref.created_by,
                    created_at: entity_ref.created_at.to_rfc3339(),
                });
            }

            batch.events.push(event_record);
        }

        batch
    }

    async fn upsert_event_node(&self, event: &Event) -> Result<String, StoreError> {
        let response = self
            .query(
                "UpsertEvent",
                json!({
                    "external_id": event.event_id.to_string(),
                    "org_id": event.org_id.as_str(),
                    "source": event.source.as_str(),
                    "topic": event.topic.as_str(),
                    "event_type": event.event_type.as_str(),
                    "event_time": event.event_time.to_rfc3339(),
                    "ingestion_time": event.ingestion_time.to_rfc3339(),
                    "actor_type": "",
                    "actor_id": "",
                    "raw_body": event.raw_body.clone().unwrap_or_default(),
                }),
            )
            .await?;

        self.required_field(&response, "event", "eventID")
    }

    async fn sync_projected_payload(
        &self,
        event: &Event,
        event_node_id: &str,
        projection: PayloadProjection,
    ) -> Result<(), StoreError> {
        match projection {
            PayloadProjection::Generic {
                payload_text,
                source_event_type,
                schema_fingerprint,
            } => {
                let payload = self
                    .run_event_sync_step(
                        event,
                        "upsert_generic_payload",
                        self.query(
                            "UpsertGenericPayload",
                            json!({
                                "event_external_id": event.event_id.to_string(),
                                "org_id": event.org_id.as_str(),
                                "payload_text": payload_text,
                                "source_event_type": source_event_type,
                                "schema_fingerprint": schema_fingerprint,
                                "first_seen_at": event.ingestion_time.to_rfc3339(),
                            }),
                        ),
                    )
                    .await?;
                let payload_id = self.required_field(&payload, "payload", "payloadID")?;
                self.run_event_sync_step(
                    event,
                    "link_event_to_generic_payload",
                    self.query(
                        "LinkEventToGenericPayload",
                        json!({
                            "event_id": event_node_id,
                            "payload_id": payload_id,
                            "created_at": event.ingestion_time.to_rfc3339(),
                        }),
                    ),
                )
                .await?;
            }
            PayloadProjection::StripePayment {
                amount,
                currency,
                status,
                customer_id,
                payment_intent_id,
            } => {
                let payload = self
                    .run_event_sync_step(
                        event,
                        "upsert_stripe_payment_payload",
                        self.query(
                            "UpsertStripePaymentPayload",
                            json!({
                                "event_external_id": event.event_id.to_string(),
                                "org_id": event.org_id.as_str(),
                                "amount": amount,
                                "currency": currency,
                                "status": status,
                                "customer_id": customer_id,
                                "payment_intent_id": payment_intent_id,
                            }),
                        ),
                    )
                    .await?;
                let payload_id = self.required_field(&payload, "payload", "payloadID")?;
                self.run_event_sync_step(
                    event,
                    "link_event_to_stripe_payment_payload",
                    self.query(
                        "LinkEventToStripePaymentPayload",
                        json!({
                            "event_id": event_node_id,
                            "payload_id": payload_id,
                            "created_at": event.ingestion_time.to_rfc3339(),
                        }),
                    ),
                )
                .await?;
            }
            PayloadProjection::IntercomConversation {
                conversation_id,
                message,
                rating,
                assignee_id,
            } => {
                let payload = self
                    .run_event_sync_step(
                        event,
                        "upsert_intercom_conversation_payload",
                        self.query(
                            "UpsertIntercomConversationPayload",
                            json!({
                                "event_external_id": event.event_id.to_string(),
                                "org_id": event.org_id.as_str(),
                                "conversation_id": conversation_id,
                                "message": message,
                                "rating": rating,
                                "assignee_id": assignee_id,
                            }),
                        ),
                    )
                    .await?;
                let payload_id = self.required_field(&payload, "payload", "payloadID")?;
                self.run_event_sync_step(
                    event,
                    "link_event_to_intercom_conversation_payload",
                    self.query(
                        "LinkEventToIntercomConversationPayload",
                        json!({
                            "event_id": event_node_id,
                            "payload_id": payload_id,
                            "created_at": event.ingestion_time.to_rfc3339(),
                        }),
                    ),
                )
                .await?;
            }
            PayloadProjection::ZendeskTicket {
                ticket_id,
                subject,
                priority,
                status,
                requester_id,
            } => {
                let payload = self
                    .run_event_sync_step(
                        event,
                        "upsert_zendesk_ticket_payload",
                        self.query(
                            "UpsertZendeskTicketPayload",
                            json!({
                                "event_external_id": event.event_id.to_string(),
                                "org_id": event.org_id.as_str(),
                                "ticket_id": ticket_id,
                                "subject": subject,
                                "priority": priority,
                                "status": status,
                                "requester_id": requester_id,
                            }),
                        ),
                    )
                    .await?;
                let payload_id = self.required_field(&payload, "payload", "payloadID")?;
                self.run_event_sync_step(
                    event,
                    "link_event_to_zendesk_ticket_payload",
                    self.query(
                        "LinkEventToZendeskTicketPayload",
                        json!({
                            "event_id": event_node_id,
                            "payload_id": payload_id,
                            "created_at": event.ingestion_time.to_rfc3339(),
                        }),
                    ),
                )
                .await?;
            }
        }

        Ok(())
    }

    async fn mirror_entity_ref(
        &self,
        context_event: Option<&Event>,
        org_id: &OrgId,
        event_node_id: &str,
        entity_ref: &EntityRef,
    ) -> Result<(), StoreError> {
        let scoped_entity_key = format!(
            "{}::{}::{}",
            org_id.as_str(),
            entity_ref.entity_type.as_str(),
            entity_ref.entity_id.as_str()
        );

        let sync_event = match context_event {
            Some(event) => event.clone(),
            None => self
                .canonical_events
                .get_event(org_id, &entity_ref.event_id)
                .await?
                .map(|result| result.event)
                .ok_or_else(|| StoreError::NotFound {
                    entity: "event",
                    id: entity_ref.event_id.to_string(),
                })?,
        };

        let entity = self
            .run_event_sync_step(
                &sync_event,
                "upsert_entity",
                self.query(
                    "UpsertEntity",
                    json!({
                        "scoped_entity_key": scoped_entity_key,
                        "org_id": org_id.as_str(),
                        "entity_type": entity_ref.entity_type.as_str(),
                        "entity_id": entity_ref.entity_id.as_str(),
                    }),
                ),
            )
            .await?;
        let entity_id = self.required_field(&entity, "entity", "entityNodeID")?;
        self.run_event_sync_step(
            &sync_event,
            "link_event_to_entity",
            self.query(
                "LinkEventToEntity",
                json!({
                    "event_id": event_node_id,
                    "entity_id": entity_id,
                    "created_by": entity_ref.created_by,
                    "created_at": entity_ref.created_at.to_rfc3339(),
                }),
            ),
        )
        .await?;
        Ok(())
    }

    async fn ensure_event_node_id(
        &self,
        org_id: &OrgId,
        event_id: &EventId,
    ) -> Result<String, StoreError> {
        if let Some(node_id) = self
            .event_node_cache
            .read()
            .get(&event_id.to_string())
            .cloned()
        {
            return Ok(node_id);
        }

        let response = self
            .query(
                "GetEventByExternalId",
                json!({ "external_id": event_id.to_string() }),
            )
            .await?;

        if let Ok(node_id) = self.required_field(&response, "event", "eventID") {
            self.event_node_cache
                .write()
                .insert(event_id.to_string(), node_id.clone());
            return Ok(node_id);
        }

        let event = self
            .canonical_events
            .get_event(org_id, event_id)
            .await?
            .ok_or_else(|| StoreError::NotFound {
                entity: "event",
                id: event_id.to_string(),
            })?;
        self.sync_event(&event.event).await?;

        let response = self
            .query(
                "GetEventByExternalId",
                json!({ "external_id": event_id.to_string() }),
            )
            .await?;
        let node_id = self.required_field(&response, "event", "eventID")?;
        self.event_node_cache
            .write()
            .insert(event_id.to_string(), node_id.clone());
        Ok(node_id)
    }

    async fn create_link_record(
        &self,
        org_id: &OrgId,
        link: &EventLink,
    ) -> Result<LinkId, StoreError> {
        let link_id = self.canonical_links.create_link(org_id, link).await?;
        let source_node_id = self
            .ensure_event_node_id(org_id, &link.source_event_id)
            .await?;
        let target_node_id = self
            .ensure_event_node_id(org_id, &link.target_event_id)
            .await?;

        self.query(
            "CreateCausalLink",
            json!({
                "source_event_id": source_node_id,
                "target_event_id": target_node_id,
                "link_type": link.link_type,
                "confidence": link.confidence.value() as f64,
                "reasoning": link.reasoning.clone().unwrap_or_default(),
                "created_by": link.created_by,
                "created_at": link.created_at.to_rfc3339(),
            }),
        )
        .await?;

        Ok(link_id)
    }

    async fn load_events_by_external_ids(
        &self,
        org_id: &OrgId,
        external_ids: &[String],
    ) -> Result<Vec<EventResult>, StoreError> {
        let mut results = Vec::new();
        for external_id in external_ids {
            let event_id = external_id.parse::<EventId>().map_err(|error| {
                StoreError::Internal(format!("invalid event id '{external_id}': {error}"))
            })?;
            if let Some(event) = self.canonical_events.get_event(org_id, &event_id).await? {
                results.push(event);
            }
        }
        Ok(results)
    }

    async fn traverse_neighbors(
        &self,
        event_node_id: &str,
        direction: LinkDirection,
        min_confidence: f32,
        link_types: Option<&[String]>,
    ) -> Result<Vec<String>, StoreError> {
        let mut neighbor_ids = Vec::new();

        if matches!(direction, LinkDirection::Outgoing | LinkDirection::Both) {
            neighbor_ids.extend(
                self.edge_neighbors(
                    event_node_id,
                    "GetOutgoingLinkEdgeIds",
                    true,
                    min_confidence,
                    link_types,
                )
                .await?,
            );
        }

        if matches!(direction, LinkDirection::Incoming | LinkDirection::Both) {
            neighbor_ids.extend(
                self.edge_neighbors(
                    event_node_id,
                    "GetIncomingLinkEdgeIds",
                    false,
                    min_confidence,
                    link_types,
                )
                .await?,
            );
        }

        Ok(neighbor_ids)
    }

    async fn edge_neighbors(
        &self,
        event_node_id: &str,
        query_name: &str,
        outgoing: bool,
        min_confidence: f32,
        link_types: Option<&[String]>,
    ) -> Result<Vec<String>, StoreError> {
        let response = self
            .query(
                query_name,
                json!({
                    "event_id": event_node_id,
                    "min_confidence": min_confidence as f64,
                }),
            )
            .await?;

        let mut external_ids = Vec::new();
        for edge in self.records_from_field(&response, "edges")? {
            let edge_id = self.value_as_string(&edge, "edgeID")?;
            let detail = self
                .query("GetLinkDetail", json!({ "edge_id": edge_id }))
                .await?;
            let edge_record = self.object_from_field(&detail, "edge")?;
            if let Some(filter_types) = link_types {
                let link_type = self.value_as_string(&edge_record, "link_type")?;
                if !filter_types.iter().any(|candidate| candidate == &link_type) {
                    continue;
                }
            }

            let endpoint_field = if outgoing {
                self.object_from_field(&detail, "target")?
            } else {
                self.object_from_field(&detail, "source")?
            };
            let external_id_key = if outgoing {
                "targetExternalID"
            } else {
                "sourceExternalID"
            };
            external_ids.push(self.value_as_string(&endpoint_field, external_id_key)?);
        }
        Ok(external_ids)
    }

    async fn query(&self, endpoint: &str, data: Value) -> Result<Value, StoreError> {
        self.client.query_value(endpoint, &data).await
    }

    async fn run_event_sync_step<T, F>(
        &self,
        event: &Event,
        step: &'static str,
        future: F,
    ) -> Result<T, StoreError>
    where
        F: std::future::Future<Output = Result<T, StoreError>>,
    {
        let started = Instant::now();
        match future.await {
            Ok(value) => {
                tracing::debug!(
                    event_id = %event.event_id,
                    org_id = %event.org_id,
                    step,
                    elapsed_ms = started.elapsed().as_millis(),
                    "Helix sync step completed"
                );
                Ok(value)
            }
            Err(error) => {
                let elapsed_ms = started.elapsed().as_millis();
                let contextual_error = self.sync_step_error(event, step, elapsed_ms, error);
                tracing::warn!(
                    event_id = %event.event_id,
                    org_id = %event.org_id,
                    step,
                    elapsed_ms,
                    error = %contextual_error,
                    "Helix sync step failed"
                );
                Err(contextual_error)
            }
        }
    }

    fn sync_step_error(
        &self,
        event: &Event,
        step: &'static str,
        elapsed_ms: u128,
        error: StoreError,
    ) -> StoreError {
        let message = format!(
            "helix sync_event step '{step}' failed for event {} after {elapsed_ms} ms: {error}",
            event.event_id
        );

        match error {
            StoreError::Connection(_) => StoreError::Connection(message),
            StoreError::Query(_) => StoreError::Query(message),
            StoreError::Migration(_) => StoreError::Migration(message),
            StoreError::Internal(_) => StoreError::Internal(message),
            StoreError::NotFound { .. } | StoreError::Duplicate { .. } => {
                StoreError::Internal(message)
            }
        }
    }

    fn required_field(&self, value: &Value, field: &str, key: &str) -> Result<String, StoreError> {
        let object = self.object_from_field(value, field)?;
        self.value_as_string(&object, key)
    }

    fn object_from_field(
        &self,
        value: &Value,
        field: &str,
    ) -> Result<Map<String, Value>, StoreError> {
        match value.get(field) {
            Some(Value::Object(object)) => Ok(object.clone()),
            Some(Value::Array(items)) => items
                .first()
                .and_then(Value::as_object)
                .cloned()
                .ok_or_else(|| {
                    StoreError::Query(format!("field '{field}' did not contain an object"))
                }),
            _ => Err(StoreError::Query(format!(
                "missing object field '{field}' in Helix response"
            ))),
        }
    }

    fn records_from_field(
        &self,
        value: &Value,
        field: &str,
    ) -> Result<Vec<Map<String, Value>>, StoreError> {
        match value.get(field) {
            Some(Value::Array(items)) => items
                .iter()
                .map(|item| {
                    item.as_object().cloned().ok_or_else(|| {
                        StoreError::Query(format!("field '{field}' contained a non-object item"))
                    })
                })
                .collect(),
            Some(Value::Object(object)) => Ok(vec![object.clone()]),
            Some(Value::Null) | None => Ok(vec![]),
            _ => Err(StoreError::Query(format!(
                "field '{field}' was not an object array"
            ))),
        }
    }

    fn external_ids_from_records(
        &self,
        value: &Value,
        field: &str,
    ) -> Result<Vec<String>, StoreError> {
        self.records_from_field(value, field)?
            .into_iter()
            .map(|record| self.value_as_string(&record, "external_id"))
            .collect()
    }

    fn value_as_string(&self, value: &Map<String, Value>, key: &str) -> Result<String, StoreError> {
        value
            .get(key)
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .ok_or_else(|| StoreError::Query(format!("missing string key '{key}'")))
    }

    fn value_as_u32(&self, value: &Map<String, Value>, key: &str) -> Result<u32, StoreError> {
        value
            .get(key)
            .and_then(Value::as_u64)
            .and_then(|number| u32::try_from(number).ok())
            .ok_or_else(|| StoreError::Query(format!("missing u32 key '{key}'")))
    }
}

#[async_trait]
impl EntityRefStore for HelixGraphBackend {
    async fn add_refs(&self, org_id: &OrgId, refs: &[EntityRef]) -> Result<(), StoreError> {
        self.canonical_entity_refs.add_refs(org_id, refs).await?;

        for entity_ref in refs {
            let event_node_id = self
                .ensure_event_node_id(org_id, &entity_ref.event_id)
                .await?;
            self.mirror_entity_ref(None, org_id, &event_node_id, entity_ref)
                .await?;
        }

        Ok(())
    }

    async fn get_refs_for_event(
        &self,
        org_id: &OrgId,
        event_id: &EventId,
    ) -> Result<Vec<EntityRef>, StoreError> {
        self.canonical_entity_refs
            .get_refs_for_event(org_id, event_id)
            .await
    }

    async fn get_events_for_entity(
        &self,
        org_id: &OrgId,
        entity_type: &EntityType,
        entity_id: &EntityId,
    ) -> Result<Vec<EventId>, StoreError> {
        let scoped_entity_key = format!(
            "{}::{}::{}",
            org_id.as_str(),
            entity_type.as_str(),
            entity_id.as_str()
        );
        let response = self
            .query(
                "GetEventsForEntity",
                json!({
                    "scoped_entity_key": scoped_entity_key,
                }),
            )
            .await?;

        self.external_ids_from_records(&response, "events")?
            .into_iter()
            .map(|event_id| {
                event_id.parse::<EventId>().map_err(|error| {
                    StoreError::Internal(format!("invalid event id '{event_id}': {error}"))
                })
            })
            .collect()
    }

    async fn link_entity(
        &self,
        org_id: &OrgId,
        from_type: &EntityType,
        from_id: &EntityId,
        to_type: &EntityType,
        to_id: &EntityId,
        created_by: &str,
    ) -> Result<u64, StoreError> {
        let linked_count = self
            .canonical_entity_refs
            .link_entity(org_id, from_type, from_id, to_type, to_id, created_by)
            .await?;
        let event_ids = self
            .canonical_entity_refs
            .get_events_for_entity(org_id, from_type, from_id)
            .await?;

        let refs: Vec<_> = event_ids
            .into_iter()
            .map(|event_id| EntityRef::new(event_id, to_type.clone(), to_id.clone(), created_by))
            .collect();
        self.add_refs(org_id, &refs).await?;

        Ok(linked_count)
    }

    async fn list_entity_types(&self, org_id: &OrgId) -> Result<Vec<EntityTypeInfo>, StoreError> {
        self.canonical_entity_refs.list_entity_types(org_id).await
    }

    async fn list_entities(
        &self,
        org_id: &OrgId,
        entity_type: &EntityType,
        limit: usize,
    ) -> Result<Vec<EntityInfo>, StoreError> {
        self.canonical_entity_refs
            .list_entities(org_id, entity_type, limit)
            .await
    }
}

#[async_trait]
impl EventLinkStore for HelixGraphBackend {
    async fn create_link(&self, org_id: &OrgId, link: &EventLink) -> Result<LinkId, StoreError> {
        self.create_link_record(org_id, link).await
    }

    async fn get_links_for_event(
        &self,
        org_id: &OrgId,
        event_id: &EventId,
    ) -> Result<Vec<EventLink>, StoreError> {
        self.canonical_links
            .get_links_for_event(org_id, event_id)
            .await
    }

    async fn traverse(&self, query: &GraphQuery) -> Result<Vec<EventResult>, StoreError> {
        let start_event = query.start_event_id.to_string();
        let start_node_id = self
            .ensure_event_node_id(&query.org_id, &query.start_event_id)
            .await?;

        let mut queue = VecDeque::from([(start_node_id, start_event.clone(), 0_u32)]);
        let mut seen = HashSet::from([start_event.clone()]);
        let mut ordered_ids = vec![start_event];

        while let Some((node_id, _external_id, depth)) = queue.pop_front() {
            if depth >= query.max_depth {
                continue;
            }

            for neighbor in self
                .traverse_neighbors(
                    &node_id,
                    query.direction,
                    query.min_confidence,
                    query.link_types.as_deref(),
                )
                .await?
            {
                if seen.insert(neighbor.clone()) {
                    let event_id = neighbor.parse::<EventId>().map_err(|error| {
                        StoreError::Internal(format!("invalid event id '{neighbor}': {error}"))
                    })?;
                    let neighbor_node_id =
                        self.ensure_event_node_id(&query.org_id, &event_id).await?;
                    ordered_ids.push(neighbor);
                    queue.push_back((neighbor_node_id, event_id.to_string(), depth + 1));
                }
            }
        }

        self.load_events_by_external_ids(&query.org_id, &ordered_ids)
            .await
    }
}

#[async_trait]
impl EmbeddingStore for HelixGraphBackend {
    async fn store_embeddings(&self, embeddings: &[EventEmbedding]) -> Result<(), StoreError> {
        self.canonical_embeddings
            .store_embeddings(embeddings)
            .await?;
        for embedding in embeddings {
            self.sync_event_embedding(embedding).await?;
        }
        Ok(())
    }

    async fn search(&self, query: &SemanticQuery) -> Result<Vec<EventResult>, StoreError> {
        let dimensions = self
            .event_embedding_cache
            .read()
            .values()
            .next()
            .map(Vec::len)
            .unwrap_or(DEFAULT_SEARCH_EMBEDDING_DIMENSIONS);
        let vector = hash_text_to_vector(&query.query_text, dimensions);
        self.search_event_candidates(&query.org_id, &vector, query.limit)
            .await
    }

    async fn has_embedding(&self, org_id: &OrgId, event_id: &EventId) -> Result<bool, StoreError> {
        self.canonical_embeddings
            .has_embedding(org_id, event_id)
            .await
    }
}

#[derive(Clone)]
pub struct HelixEventStore {
    canonical: Arc<dyn EventStore>,
    graph: Arc<HelixGraphBackend>,
}

impl HelixEventStore {
    pub fn new(canonical: Arc<dyn EventStore>, graph: Arc<HelixGraphBackend>) -> Self {
        Self { canonical, graph }
    }
}

#[async_trait]
impl EventStore for HelixEventStore {
    async fn insert_events(&self, events: &[Event]) -> Result<Vec<EventId>, StoreError> {
        let event_ids = self.canonical.insert_events(events).await?;
        for event in events {
            if let Err(error) = self.graph.sync_event(event).await {
                tracing::warn!(
                    error = %error,
                    event_id = %event.event_id,
                    "failed to mirror event into Helix; canonical Postgres write already succeeded"
                );
            }
        }
        Ok(event_ids)
    }

    async fn get_event(
        &self,
        org_id: &OrgId,
        id: &EventId,
    ) -> Result<Option<EventResult>, StoreError> {
        self.canonical.get_event(org_id, id).await
    }

    async fn query_structured(
        &self,
        query: &StructuredQuery,
    ) -> Result<Vec<EventResult>, StoreError> {
        self.canonical.query_structured(query).await
    }

    async fn query_timeline(&self, query: &TimelineQuery) -> Result<Vec<EventResult>, StoreError> {
        self.canonical.query_timeline(query).await
    }

    async fn query_sql(&self, org_id: &OrgId, sql: &str) -> Result<Vec<EventResult>, StoreError> {
        self.canonical.query_sql(org_id, sql).await
    }

    async fn count(&self, query: &StructuredQuery) -> Result<u64, StoreError> {
        self.canonical.count(query).await
    }
}

#[derive(Clone)]
pub struct HelixLinkingPipeline {
    graph: Arc<HelixGraphBackend>,
    evaluator: Arc<dyn LinkDecisionModel>,
}

impl HelixLinkingPipeline {
    pub fn new(graph: Arc<HelixGraphBackend>, evaluator: Arc<dyn LinkDecisionModel>) -> Self {
        Self { graph, evaluator }
    }

    pub async fn link_with_event_text(
        &self,
        org_id: &OrgId,
        source_event_id: EventId,
        embedder: &dyn TextEmbedder,
        candidate_limit: usize,
        created_by: &str,
    ) -> Result<Vec<LinkId>, StoreError> {
        let source = self.load_source_event(org_id, source_event_id).await?;
        let embedded_text = event_embedding_text(&source.event);
        let vector = embedder.embed_text(&embedded_text).await?;

        self.link_source_with_vector(
            org_id,
            source_event_id,
            source,
            &vector,
            candidate_limit,
            created_by,
        )
        .await
    }

    pub async fn link_with_vector(
        &self,
        org_id: &OrgId,
        source_event_id: EventId,
        vector: &[f64],
        candidate_limit: usize,
        created_by: &str,
    ) -> Result<Vec<LinkId>, StoreError> {
        let source = self.load_source_event(org_id, source_event_id).await?;

        self.link_source_with_vector(
            org_id,
            source_event_id,
            source,
            vector,
            candidate_limit,
            created_by,
        )
        .await
    }

    async fn load_source_event(
        &self,
        org_id: &OrgId,
        source_event_id: EventId,
    ) -> Result<EventResult, StoreError> {
        self.graph
            .canonical_events
            .get_event(org_id, &source_event_id)
            .await?
            .ok_or_else(|| StoreError::NotFound {
                entity: "event",
                id: source_event_id.to_string(),
            })
    }

    async fn link_source_with_vector(
        &self,
        org_id: &OrgId,
        source_event_id: EventId,
        source: EventResult,
        vector: &[f64],
        candidate_limit: usize,
        created_by: &str,
    ) -> Result<Vec<LinkId>, StoreError> {
        let candidates = self
            .graph
            .search_event_candidates(org_id, vector, candidate_limit)
            .await?
            .into_iter()
            .filter(|candidate| candidate.event.event_id != source_event_id)
            .collect::<Vec<_>>();

        let decisions = self.evaluator.evaluate(&source.event, &candidates).await?;

        let mut link_ids = Vec::new();
        for decision in decisions {
            let confidence = Confidence::new(decision.confidence).map_err(|error| {
                StoreError::Query(format!("invalid decision confidence: {error}"))
            })?;
            let link = EventLink {
                link_id: LinkId::new(),
                source_event_id,
                target_event_id: decision.target_event_id,
                link_type: decision.link_type,
                confidence,
                reasoning: decision.reasoning,
                created_by: created_by.to_string(),
                created_at: Utc::now(),
            };
            link_ids.push(self.graph.create_link_record(org_id, &link).await?);
        }

        Ok(link_ids)
    }
}

#[derive(Clone)]
pub struct HelixTraceOodService {
    graph: Arc<HelixGraphBackend>,
}

impl HelixTraceOodService {
    pub fn new(graph: Arc<HelixGraphBackend>) -> Self {
        Self { graph }
    }

    pub async fn upsert_trace(
        &self,
        trace: &TraceDocument,
        embedding: &[f64],
    ) -> Result<(), StoreError> {
        self.graph.upsert_trace(trace, embedding).await
    }

    pub async fn materialize_trace(
        &self,
        trace_key: impl Into<String>,
        trace_type: impl Into<String>,
        model_version: impl Into<String>,
        org_id: &OrgId,
        event_ids: &[EventId],
    ) -> Result<TraceDocument, StoreError> {
        let events = self.load_trace_events(org_id, event_ids).await?;
        TraceDocument::from_events(trace_key, trace_type, model_version, &events)
    }

    pub async fn upsert_materialized_trace(
        &self,
        trace_key: impl Into<String>,
        trace_type: impl Into<String>,
        model_version: impl Into<String>,
        org_id: &OrgId,
        event_ids: &[EventId],
        embedder: &dyn TextEmbedder,
    ) -> Result<TraceDocument, StoreError> {
        let trace = self
            .materialize_trace(trace_key, trace_type, model_version, org_id, event_ids)
            .await?;
        let embedding = embedder.embed_text(&trace.embedded_text).await?;
        self.upsert_trace(&trace, &embedding).await?;
        Ok(trace)
    }

    pub async fn assess_trace_document(
        &self,
        trace: &TraceDocument,
        candidate_limit: usize,
        threshold: f64,
        embedder: &dyn TextEmbedder,
    ) -> Result<OodAssessment, StoreError> {
        let embedding = embedder.embed_text(&trace.embedded_text).await?;
        self.assess(&trace.org_id, &embedding, candidate_limit, threshold)
            .await
    }

    pub async fn assess(
        &self,
        org_id: &OrgId,
        embedding: &[f64],
        candidate_limit: usize,
        threshold: f64,
    ) -> Result<OodAssessment, StoreError> {
        let candidates = self
            .graph
            .search_trace_candidates(org_id, embedding, candidate_limit)
            .await?;
        let best_score = candidates
            .iter()
            .filter_map(|candidate| candidate.score)
            .max_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));

        Ok(OodAssessment {
            is_ood: best_score.map_or(true, |score| score < threshold),
            best_score,
            threshold,
            candidates,
        })
    }

    async fn load_trace_events(
        &self,
        org_id: &OrgId,
        event_ids: &[EventId],
    ) -> Result<Vec<Event>, StoreError> {
        let mut events = Vec::with_capacity(event_ids.len());

        for event_id in event_ids {
            let event = self
                .graph
                .canonical_events
                .get_event(org_id, event_id)
                .await?
                .ok_or_else(|| StoreError::NotFound {
                    entity: "event",
                    id: event_id.to_string(),
                })?;
            events.push(event.event);
        }

        Ok(events)
    }
}

fn to_helix_vector(values: &[f32]) -> Vec<f64> {
    values.iter().map(|value| f64::from(*value)).collect()
}

fn cosine_similarity(left: &[f64], right: &[f64]) -> f64 {
    let mut dot = 0.0;
    let mut left_norm = 0.0;
    let mut right_norm = 0.0;

    for (left_value, right_value) in left.iter().zip(right.iter()) {
        dot += left_value * right_value;
        left_norm += left_value * left_value;
        right_norm += right_value * right_value;
    }

    if left_norm == 0.0 || right_norm == 0.0 {
        return 0.0;
    }

    dot / (left_norm.sqrt() * right_norm.sqrt())
}

fn hash_text_to_vector(text: &str, dimensions: usize) -> Vec<f64> {
    let mut hash: u64 = 5381;
    for byte in text.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(u64::from(byte));
    }

    (0..dimensions)
        .map(|index| ((hash.wrapping_add(index as u64) % 1000) as f64) / 1000.0)
        .collect()
}

fn event_embedding_text(event: &Event) -> String {
    let mut sections = vec![
        format!("source={}", event.source.as_str()),
        format!("topic={}", event.topic.as_str()),
        format!("event_type={}", event.event_type.as_str()),
    ];

    let entity_refs = event
        .materialize_entity_refs("embedding")
        .into_iter()
        .map(|entity_ref| format!("{}={}", entity_ref.entity_type, entity_ref.entity_id))
        .collect::<Vec<_>>();
    if !entity_refs.is_empty() {
        sections.push(format!("entities={}", entity_refs.join(",")));
    }

    if let Some(payload_text) = raw_payload_text(event) {
        sections.push(format!("payload={payload_text}"));
    } else if let Some(raw_body) = &event.raw_body {
        sections.push(format!("raw_body={raw_body}"));
    }

    sections.join("\n")
}

fn trace_embedding_text(events: &[Event]) -> String {
    events
        .iter()
        .enumerate()
        .map(|(index, event)| format!("step={index}\n{}", event_embedding_text(event)))
        .collect::<Vec<_>>()
        .join("\n---\n")
}

fn trace_structural_signature(events: &[Event]) -> String {
    events
        .iter()
        .map(|event| format!("{}:{}", event.source.as_str(), event.event_type.as_str()))
        .collect::<Vec<_>>()
        .join(" -> ")
}

fn trace_status_from_events(events: &[Event]) -> String {
    let Some(last_event) = events.last() else {
        return "open".to_string();
    };

    let normalized_type = last_event.event_type.as_str().to_ascii_lowercase();
    if normalized_type.contains("cancel") || normalized_type.contains("churn") {
        return "closed_lost".to_string();
    }
    if normalized_type.contains("resolve")
        || normalized_type.contains("complete")
        || normalized_type.contains("success")
    {
        return "resolved".to_string();
    }
    if normalized_type.contains("refund") || normalized_type.contains("fail") {
        return "needs_review".to_string();
    }

    "open".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::sync::atomic::{AtomicUsize, Ordering};

    use chronicle_core::event::EventBuilder;
    use parking_lot::RwLock;

    use crate::memory::InMemoryBackend;

    #[derive(Clone, Default)]
    struct RecordingClient {
        call_count: Arc<AtomicUsize>,
        calls: Arc<RwLock<Vec<(String, Value)>>>,
        event_search_results: Arc<RwLock<Vec<String>>>,
        trace_search_results: Arc<RwLock<Vec<Value>>>,
        failing_endpoints: Arc<RwLock<HashMap<String, String>>>,
    }

    impl RecordingClient {
        fn endpoints(&self) -> Vec<String> {
            self.calls
                .read()
                .iter()
                .map(|(endpoint, _)| endpoint.clone())
                .collect()
        }

        fn payloads_for(&self, endpoint: &str) -> Vec<Value> {
            self.calls
                .read()
                .iter()
                .filter(|(recorded_endpoint, _)| recorded_endpoint == endpoint)
                .map(|(_, payload)| payload.clone())
                .collect()
        }

        fn set_event_search_results(&self, event_ids: Vec<EventId>) {
            *self.event_search_results.write() = event_ids
                .into_iter()
                .map(|event_id| event_id.to_string())
                .collect();
        }

        fn set_trace_search_results(&self, trace_records: Vec<Value>) {
            *self.trace_search_results.write() = trace_records;
        }

        fn fail_endpoint(&self, endpoint: &str, message: impl Into<String>) {
            self.failing_endpoints
                .write()
                .insert(endpoint.to_string(), message.into());
        }
    }

    #[async_trait]
    impl HelixGraphClient for RecordingClient {
        async fn query_value(&self, endpoint: &str, data: &Value) -> Result<Value, StoreError> {
            self.call_count.fetch_add(1, Ordering::Relaxed);
            self.calls
                .write()
                .push((endpoint.to_string(), data.clone()));
            if let Some(message) = self.failing_endpoints.read().get(endpoint).cloned() {
                return Err(StoreError::Connection(message));
            }
            match endpoint {
                "UpsertEvent" => Ok(json!({
                    "event": {
                        "eventID": "helix_event_1",
                        "external_id": data["external_id"],
                    }
                })),
                "GetEventByExternalId" => Ok(json!({
                    "event": {
                        "eventID": "helix_event_1",
                        "external_id": data["external_id"],
                    }
                })),
                "UpsertRawPayload"
                | "UpsertGenericPayload"
                | "UpsertStripePaymentPayload"
                | "UpsertIntercomConversationPayload"
                | "UpsertZendeskTicketPayload" => Ok(json!({
                    "payload": {
                        "payloadID": "helix_payload_1"
                    }
                })),
                "UpsertEntity" => Ok(json!({
                    "entity": {
                        "entityNodeID": "helix_entity_1"
                    }
                })),
                "UpsertEventEmbedding" | "UpsertTraceEmbedding" => Ok(json!({
                    "embedding": {
                        "embeddingID": "helix_embedding_1"
                    }
                })),
                "SearchEventEmbeddings"
                | "SearchRawPayloadKeywords"
                | "SearchGenericPayloadKeywords" => Ok(json!({
                    "events": self
                        .event_search_results
                        .read()
                        .iter()
                        .map(|event_id| json!({ "external_id": event_id }))
                        .collect::<Vec<_>>()
                })),
                "UpsertTrace" => Ok(json!({
                    "trace": {
                        "traceID": "helix_trace_1"
                    }
                })),
                "SearchTraceEmbeddings" => Ok(json!({
                    "traces": self.trace_search_results.read().clone()
                })),
                "SyncEventsBatch" => Ok(json!({
                    "status": "ok"
                })),
                _ => Ok(json!({})),
            }
        }
    }

    #[derive(Clone, Default)]
    struct AcceptAllEvaluator;

    #[async_trait]
    impl LinkDecisionModel for AcceptAllEvaluator {
        async fn evaluate(
            &self,
            _source_event: &Event,
            candidates: &[EventResult],
        ) -> Result<Vec<LinkDecision>, StoreError> {
            Ok(candidates
                .iter()
                .take(1)
                .map(|candidate| LinkDecision {
                    target_event_id: candidate.event.event_id,
                    link_type: "candidate_match".to_string(),
                    confidence: 0.9,
                    reasoning: Some("unit test".to_string()),
                })
                .collect())
        }
    }

    #[derive(Clone)]
    struct RecordingEmbedder {
        vector: Vec<f64>,
        seen_texts: Arc<RwLock<Vec<String>>>,
    }

    impl RecordingEmbedder {
        fn new(vector: Vec<f64>) -> Self {
            Self {
                vector,
                seen_texts: Arc::new(RwLock::new(Vec::new())),
            }
        }

        fn seen_texts(&self) -> Vec<String> {
            self.seen_texts.read().clone()
        }
    }

    #[async_trait]
    impl TextEmbedder for RecordingEmbedder {
        async fn embed_text(&self, text: &str) -> Result<Vec<f64>, StoreError> {
            self.seen_texts.write().push(text.to_string());
            Ok(self.vector.clone())
        }
    }

    fn make_graph_backend(
        client: Arc<dyn HelixGraphClient>,
    ) -> (Arc<HelixGraphBackend>, Arc<InMemoryBackend>) {
        let backend = Arc::new(InMemoryBackend::new());
        let graph = Arc::new(HelixGraphBackend::from_client(
            client,
            backend.clone(),
            backend.clone(),
            backend.clone(),
            backend.clone(),
        ));
        (graph, backend)
    }

    #[tokio::test]
    async fn sync_event_mirrors_raw_and_typed_payload_nodes() {
        let client = Arc::new(RecordingClient::default());
        let (graph, _backend) = make_graph_backend(client.clone());
        let event = EventBuilder::new("org_test", "stripe", "payments", "payment_intent.succeeded")
            .entity("customer", "cust_123")
            .payload(serde_json::json!({
                "amount": 4999,
                "currency": "usd",
                "status": "succeeded",
                "payment_intent_id": "pi_123"
            }))
            .build();

        graph.sync_event(&event).await.unwrap();

        assert!(client.call_count.load(Ordering::Relaxed) >= 4);
        let endpoints = client.endpoints();
        assert!(endpoints
            .iter()
            .any(|endpoint| endpoint == "UpsertRawPayload"));
        assert!(endpoints
            .iter()
            .any(|endpoint| endpoint == "UpsertStripePaymentPayload"));
        assert!(endpoints.iter().any(|endpoint| endpoint == "UpsertEntity"));
        let stripe_payloads = client.payloads_for("UpsertStripePaymentPayload");
        assert_eq!(stripe_payloads.len(), 1);
        assert_eq!(stripe_payloads[0]["amount"], json!(4999.0));
    }

    #[tokio::test]
    async fn sync_events_batched_sends_one_query_with_projected_records() {
        let client = Arc::new(RecordingClient::default());
        let (graph, _backend) = make_graph_backend(client.clone());
        let stripe_event =
            EventBuilder::new("org_test", "stripe", "payments", "payment_intent.succeeded")
                .entity("customer", "cust_123")
                .payload(serde_json::json!({
                    "amount": 4999,
                    "currency": "usd",
                    "status": "succeeded",
                    "payment_intent_id": "pi_123"
                }))
                .build();
        let generic_event = EventBuilder::new("org_test", "custom_webhook", "cases", "case.synced")
            .entity("customer", "cust_456")
            .payload(serde_json::json!({
                "category": "custom-escalation",
                "message": "customer requested refund review"
            }))
            .build();

        graph
            .sync_events_batched(&[stripe_event, generic_event])
            .await
            .unwrap();

        assert_eq!(client.endpoints(), vec!["SyncEventsBatch".to_string()]);
        let payloads = client.payloads_for("SyncEventsBatch");
        assert_eq!(payloads.len(), 1);
        let payload = &payloads[0];
        let events = payload["events"].as_array().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["raw_payloads"].as_array().unwrap().len(), 1);
        assert_eq!(events[0]["stripe_payloads"].as_array().unwrap().len(), 1);
        assert_eq!(events[0]["entity_refs"].as_array().unwrap().len(), 1);
        assert_eq!(events[1]["raw_payloads"].as_array().unwrap().len(), 1);
        assert_eq!(events[1]["generic_payloads"].as_array().unwrap().len(), 1);
        assert_eq!(events[1]["entity_refs"].as_array().unwrap().len(), 1);
        assert_eq!(events[0]["stripe_payloads"][0]["amount"], json!(4999.0));
        assert_eq!(
            events[1]["generic_payloads"][0]["source_event_type"],
            json!("custom_webhook::case.synced")
        );
        assert_eq!(
            events[0]["entity_refs"][0]["scoped_entity_key"],
            json!("org_test::customer::cust_123")
        );
    }

    #[tokio::test]
    async fn sync_event_failure_reports_failing_step_context() {
        let client = Arc::new(RecordingClient::default());
        client.fail_endpoint("LinkEventToRawPayload", "synthetic disconnect");
        let (graph, _backend) = make_graph_backend(client);
        let event = EventBuilder::new("org_test", "stripe", "payments", "payment_intent.failed")
            .entity("customer", "cust_failure")
            .payload(serde_json::json!({
                "amount": 4999,
                "currency": "usd",
                "status": "failed"
            }))
            .build();

        let error = graph.sync_event(&event).await.unwrap_err().to_string();

        assert!(error.contains("link_event_to_raw_payload"));
        assert!(error.contains(&event.event_id.to_string()));
    }

    #[tokio::test]
    async fn helix_event_store_preserves_canonical_insert() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client);
        let store = HelixEventStore::new(backend.clone(), graph);
        let event = EventBuilder::new("org_test", "slack", "messages", "message.posted")
            .payload(serde_json::json!({"text": "hello"}))
            .build();

        let ids = store.insert_events(&[event]).await.unwrap();

        assert_eq!(ids.len(), 1);
        assert_eq!(backend.event_count(), 1);
    }

    #[tokio::test]
    async fn sync_existing_entity_refs_only_updates_helix_projection() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client.clone());
        let event = EventBuilder::new("org_test", "web", "product", "page.view")
            .payload(serde_json::json!({"path": "/pricing"}))
            .build();
        let event_id = event.event_id;
        backend.insert_events(&[event]).await.unwrap();

        let refs = vec![EntityRef::new(
            event_id,
            EntityType::new("customer"),
            EntityId::new("cust_backfill"),
            "backfill",
        )];
        graph
            .sync_existing_entity_refs(&OrgId::new("org_test"), &refs)
            .await
            .unwrap();

        let canonical_refs = backend
            .get_refs_for_event(&OrgId::new("org_test"), &event_id)
            .await
            .unwrap();
        assert!(canonical_refs.is_empty());
        assert!(client
            .endpoints()
            .iter()
            .any(|endpoint| endpoint == "LinkEventToEntity"));
    }

    #[tokio::test]
    async fn sync_existing_link_only_updates_helix_projection() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client.clone());
        let source = EventBuilder::new("org_test", "stripe", "payments", "payment.failed").build();
        let target = EventBuilder::new("org_test", "zendesk", "support", "ticket.created").build();
        let link = EventLink {
            link_id: LinkId::new(),
            source_event_id: source.event_id,
            target_event_id: target.event_id,
            link_type: "caused_by".to_string(),
            confidence: Confidence::new(0.85).unwrap(),
            reasoning: Some("backfilled".to_string()),
            created_by: "backfill".to_string(),
            created_at: Utc::now(),
        };

        backend.insert_events(&[source, target]).await.unwrap();
        graph
            .sync_existing_link(&OrgId::new("org_test"), &link)
            .await
            .unwrap();

        assert_eq!(backend.link_count(), 0);
        assert!(client
            .endpoints()
            .iter()
            .any(|endpoint| endpoint == "CreateCausalLink"));
    }

    #[tokio::test]
    async fn trace_ood_assessment_flags_low_similarity() {
        let client = Arc::new(RecordingClient::default());
        let (graph, _backend) = make_graph_backend(client.clone());
        client.set_trace_search_results(vec![json!({
            "traceID": "trace_1",
            "trace_key": "trace_existing",
            "trace_type": "customer_support",
            "event_count": 3,
            "status": "resolved"
        })]);
        graph
            .trace_embedding_cache
            .write()
            .insert("trace_existing".to_string(), vec![1.0, 0.0, 0.0, 0.0]);

        let service = HelixTraceOodService::new(graph);
        let assessment = service
            .assess(&OrgId::new("org_test"), &[0.0, 1.0, 0.0, 0.0], 5, 0.5)
            .await
            .unwrap();

        assert!(assessment.is_ood);
    }

    #[tokio::test]
    async fn event_candidate_search_overfetches_and_truncates() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client.clone());
        let first = EventBuilder::new("org_test", "stripe", "payments", "payment_intent.failed")
            .payload(serde_json::json!({"amount": 1}))
            .build();
        let second = EventBuilder::new("org_test", "stripe", "payments", "payment_intent.failed")
            .payload(serde_json::json!({"amount": 2}))
            .build();
        backend
            .insert_events(&[first.clone(), second.clone()])
            .await
            .unwrap();
        client.set_event_search_results(vec![first.event_id, second.event_id]);

        let results = graph
            .search_event_candidates(&OrgId::new("org_test"), &[0.1, 0.2, 0.3], 1)
            .await
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(
            client.payloads_for("SearchEventEmbeddings")[0]["limit"],
            json!(overfetch_search_limit(1))
        );
    }

    #[tokio::test]
    async fn raw_keyword_search_overfetches_and_truncates() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client.clone());
        let first = EventBuilder::new("org_test", "slack", "messages", "message.posted")
            .payload(serde_json::json!({"text": "marker-one"}))
            .build();
        let second = EventBuilder::new("org_test", "slack", "messages", "message.posted")
            .payload(serde_json::json!({"text": "marker-two"}))
            .build();
        backend
            .insert_events(&[first.clone(), second.clone()])
            .await
            .unwrap();
        client.set_event_search_results(vec![first.event_id, second.event_id]);

        let results = graph
            .search_raw_payload_keywords(&OrgId::new("org_test"), "marker", 1)
            .await
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(
            client.payloads_for("SearchRawPayloadKeywords")[0]["limit"],
            json!(overfetch_search_limit(1))
        );
    }

    #[tokio::test]
    async fn trace_candidate_search_overfetches_and_truncates() {
        let client = Arc::new(RecordingClient::default());
        let (graph, _backend) = make_graph_backend(client.clone());
        client.set_trace_search_results(vec![
            json!({
                "traceID": "trace_1",
                "trace_key": "trace_a",
                "trace_type": "support",
                "event_count": 3,
                "status": "resolved"
            }),
            json!({
                "traceID": "trace_2",
                "trace_key": "trace_b",
                "trace_type": "support",
                "event_count": 4,
                "status": "resolved"
            }),
        ]);
        graph
            .trace_embedding_cache
            .write()
            .insert("trace_a".to_string(), vec![1.0, 0.0, 0.0]);
        graph
            .trace_embedding_cache
            .write()
            .insert("trace_b".to_string(), vec![0.0, 1.0, 0.0]);

        let results = graph
            .search_trace_candidates(&OrgId::new("org_test"), &[1.0, 0.0, 0.0], 1)
            .await
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(
            client.payloads_for("SearchTraceEmbeddings")[0]["limit"],
            json!(overfetch_search_limit(1))
        );
    }

    #[tokio::test]
    async fn linking_pipeline_creates_links_from_evaluator_output() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client.clone());

        let source = EventBuilder::new("org_test", "slack", "messages", "message.posted")
            .payload(serde_json::json!({"text": "source"}))
            .build();
        let target = EventBuilder::new("org_test", "slack", "messages", "message.posted")
            .payload(serde_json::json!({"text": "target"}))
            .build();
        let source_id = source.event_id;
        let target_id = target.event_id;

        backend.insert_events(&[source, target]).await.unwrap();
        client.set_event_search_results(vec![target_id]);

        let pipeline = HelixLinkingPipeline::new(graph, Arc::new(AcceptAllEvaluator));
        let link_ids = pipeline
            .link_with_vector(
                &OrgId::new("org_test"),
                source_id,
                &[0.1, 0.2, 0.3, 0.4],
                5,
                "test_agent",
            )
            .await
            .unwrap();

        assert_eq!(link_ids.len(), 1);
        assert_eq!(backend.link_count(), 1);
    }

    #[tokio::test]
    async fn linking_pipeline_can_embed_source_event_text() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client.clone());
        let source = EventBuilder::new("org_test", "intercom", "support", "conversation.created")
            .entity("customer", "cust_embed")
            .payload(serde_json::json!({
                "conversation_id": "conv_1",
                "message": "Customer asked for a refund"
            }))
            .build();
        let target = EventBuilder::new("org_test", "stripe", "payments", "charge.refunded")
            .entity("customer", "cust_embed")
            .payload(serde_json::json!({"amount": 4999, "status": "refunded"}))
            .build();
        let source_id = source.event_id;
        let target_id = target.event_id;
        let embedder = RecordingEmbedder::new(vec![0.1, 0.2, 0.3, 0.4]);

        backend.insert_events(&[source, target]).await.unwrap();
        client.set_event_search_results(vec![source_id, target_id]);

        let pipeline = HelixLinkingPipeline::new(graph, Arc::new(AcceptAllEvaluator));
        let link_ids = pipeline
            .link_with_event_text(
                &OrgId::new("org_test"),
                source_id,
                &embedder,
                5,
                "test_agent",
            )
            .await
            .unwrap();

        assert_eq!(link_ids.len(), 1);
        assert_eq!(backend.link_count(), 1);
        assert!(embedder
            .seen_texts()
            .iter()
            .any(|text| text.contains("conversation.created")));
        assert!(embedder
            .seen_texts()
            .iter()
            .any(|text| text.contains("Customer asked for a refund")));
    }

    #[tokio::test]
    async fn materialized_trace_preserves_event_order_and_embeds_trace_text() {
        let client = Arc::new(RecordingClient::default());
        let (graph, backend) = make_graph_backend(client.clone());
        let first = EventBuilder::new("org_test", "stripe", "payments", "payment.failed")
            .payload(serde_json::json!({"amount": 4999, "status": "failed"}))
            .build();
        let second = EventBuilder::new("org_test", "zendesk", "support", "ticket.created")
            .payload(serde_json::json!({"subject": "billing issue"}))
            .build();
        let event_ids = vec![second.event_id, first.event_id];
        let embedder = RecordingEmbedder::new(vec![0.9, 0.1, 0.0, 0.0]);

        backend.insert_events(&[first, second]).await.unwrap();

        let service = HelixTraceOodService::new(graph);
        let trace = service
            .upsert_materialized_trace(
                "trace_support_1",
                "customer_support",
                "deterministic-test",
                &OrgId::new("org_test"),
                &event_ids,
                &embedder,
            )
            .await
            .unwrap();

        assert_eq!(trace.event_ids, event_ids);
        assert_eq!(
            trace.structural_signature,
            "zendesk:ticket.created -> stripe:payment.failed"
        );
        assert_eq!(trace.status, "needs_review");
        assert!(embedder
            .seen_texts()
            .iter()
            .any(|text| text.contains("step=0")));
        assert!(client
            .endpoints()
            .iter()
            .any(|endpoint| endpoint == "UpsertTrace"));
        assert!(client
            .endpoints()
            .iter()
            .any(|endpoint| endpoint == "UpsertTraceEmbedding"));
    }

    #[tokio::test]
    async fn trace_document_rejects_mixed_orgs() {
        let first = EventBuilder::new("org_a", "stripe", "payments", "payment.failed").build();
        let second = EventBuilder::new("org_b", "zendesk", "support", "ticket.created").build();

        let error =
            TraceDocument::from_events("trace_mixed", "customer_support", "test", &[first, second])
                .unwrap_err();

        assert!(matches!(error, StoreError::Query(_)));
    }
}
