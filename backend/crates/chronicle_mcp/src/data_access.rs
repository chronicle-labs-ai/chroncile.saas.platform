use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use chronicle_api::{AppState, SaasAppState};
use chronicle_core::ids::{EntityId, EntityType, EventId, EventType, OrgId, Source, Topic};
use chronicle_core::link::LinkDirection;
use chronicle_core::query::{
    EventResult, GraphQuery, OrderBy, SemanticQuery, StructuredQuery, TimelineQuery,
};
use chronicle_core::time_range::TimeRange;
use chronicle_domain::{AuditLog, EventEnvelope, Run};
use chronicle_infra::StreamBackend;
use chronicle_store::{EntityTypeInfo, SourceInfo, SourceSchema, TenantGuard};
use serde::Serialize;

use crate::auth::McpSessionContext;
use crate::error::ChronicleMcpError;

const DEFAULT_LIMIT: usize = 50;
const DEFAULT_STREAM_LIMIT: usize = 25;
const DEFAULT_ACTIVITY_LIMIT: usize = 25;
const DEFAULT_STREAM_WAIT_SECONDS: u64 = 15;
const DEFAULT_MIN_CONFIDENCE: f32 = 0.0;

#[derive(Debug, Clone)]
pub struct EventQueryInput {
    pub source: Option<String>,
    pub topic: Option<String>,
    pub event_type: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub since_days: Option<i64>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct SearchInput {
    pub query: String,
    pub source: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct TimelineInput {
    pub entity_type: String,
    pub entity_id: String,
    pub since_days: Option<i64>,
    pub include_linked: bool,
}

#[derive(Debug, Clone)]
pub struct GraphInput {
    pub start_event_id: String,
    pub direction: LinkDirection,
    pub link_types: Option<Vec<String>>,
    pub max_depth: u32,
    pub min_confidence: f32,
}

#[derive(Debug, Clone)]
pub struct ListRunsInput {
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct ListAuditLogsInput {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct WatchEventsInput {
    pub source: Option<String>,
    pub event_type: Option<String>,
    pub subject_id: Option<String>,
    pub payload_contains: Option<String>,
    pub limit: Option<usize>,
    pub wait_seconds: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct ReplayTimelineInput {
    pub entity_type: String,
    pub entity_id: String,
    pub since_days: Option<i64>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventResultsOutput {
    pub count: usize,
    pub events: Vec<EventResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRunsOutput {
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
    pub runs: Vec<Run>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunDetailOutput {
    pub run: Run,
    pub audit_logs: Vec<AuditLog>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogListOutput {
    pub limit: usize,
    pub offset: usize,
    pub audit_logs: Vec<AuditLog>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCatalogOutput {
    pub count: usize,
    pub sources: Vec<SourceInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityTypesOutput {
    pub count: usize,
    pub entity_types: Vec<EntityTypeInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchEventsOutput {
    pub collected: usize,
    pub wait_seconds: u64,
    pub events: Vec<EventEnvelope>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayTimelineOutput {
    pub replay_enabled: bool,
    pub count: usize,
    pub events: Vec<EventResult>,
}

#[async_trait]
pub trait ChronicleMcpDataAccess: Send + Sync {
    async fn query_events(
        &self,
        session: &McpSessionContext,
        input: EventQueryInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError>;

    async fn search_events(
        &self,
        session: &McpSessionContext,
        input: SearchInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError>;

    async fn get_timeline(
        &self,
        session: &McpSessionContext,
        input: TimelineInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError>;

    async fn traverse_graph(
        &self,
        session: &McpSessionContext,
        input: GraphInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError>;

    async fn list_runs(
        &self,
        session: &McpSessionContext,
        input: ListRunsInput,
    ) -> Result<ListRunsOutput, ChronicleMcpError>;

    async fn get_run(
        &self,
        session: &McpSessionContext,
        run_id: &str,
    ) -> Result<RunDetailOutput, ChronicleMcpError>;

    async fn list_audit_logs(
        &self,
        session: &McpSessionContext,
        input: ListAuditLogsInput,
    ) -> Result<AuditLogListOutput, ChronicleMcpError>;

    async fn describe_sources(
        &self,
        session: &McpSessionContext,
    ) -> Result<SourceCatalogOutput, ChronicleMcpError>;

    async fn describe_entity_types(
        &self,
        session: &McpSessionContext,
    ) -> Result<EntityTypesOutput, ChronicleMcpError>;

    async fn describe_schema(
        &self,
        session: &McpSessionContext,
        source: &str,
        event_type: &str,
    ) -> Result<Option<SourceSchema>, ChronicleMcpError>;

    async fn get_event(
        &self,
        session: &McpSessionContext,
        event_id: &str,
    ) -> Result<Option<EventResult>, ChronicleMcpError>;

    async fn latest_activity(
        &self,
        session: &McpSessionContext,
        limit: Option<usize>,
    ) -> Result<AuditLogListOutput, ChronicleMcpError>;

    async fn watch_events(
        &self,
        session: &McpSessionContext,
        input: WatchEventsInput,
    ) -> Result<WatchEventsOutput, ChronicleMcpError>;

    async fn replay_timeline(
        &self,
        session: &McpSessionContext,
        input: ReplayTimelineInput,
    ) -> Result<ReplayTimelineOutput, ChronicleMcpError>;
}

#[derive(Clone)]
pub struct InProcessChronicleMcpDataAccess {
    events_state: AppState,
    saas_state: SaasAppState,
    stream_backend: Arc<StreamBackend>,
}

impl InProcessChronicleMcpDataAccess {
    pub fn new(
        events_state: AppState,
        saas_state: SaasAppState,
        stream_backend: Arc<StreamBackend>,
    ) -> Self {
        Self {
            events_state,
            saas_state,
            stream_backend,
        }
    }

    fn org_id(&self, session: &McpSessionContext) -> OrgId {
        OrgId::new(&session.org_id)
    }

    fn tenant_guard(&self, session: &McpSessionContext) -> TenantGuard {
        TenantGuard::new(self.events_state.store.engine(), self.org_id(session))
    }

    fn validate_entity(
        entity_type: Option<String>,
        entity_id: Option<String>,
    ) -> Result<Option<(EntityType, EntityId)>, ChronicleMcpError> {
        match (entity_type, entity_id) {
            (Some(entity_type), Some(entity_id)) => Ok(Some((
                EntityType::new(&entity_type),
                EntityId::new(entity_id),
            ))),
            (None, None) => Ok(None),
            _ => Err(ChronicleMcpError::invalid_input(
                "entityType and entityId must be provided together",
            )),
        }
    }

    fn time_range(since_days: Option<i64>) -> Result<Option<TimeRange>, ChronicleMcpError> {
        match since_days {
            Some(days) if days > 0 => Ok(Some(TimeRange::last_days(days))),
            Some(_) => Err(ChronicleMcpError::invalid_input(
                "sinceDays must be greater than zero",
            )),
            None => Ok(None),
        }
    }

    fn limit(limit: Option<usize>) -> usize {
        limit.unwrap_or(DEFAULT_LIMIT)
    }
}

#[async_trait]
impl ChronicleMcpDataAccess for InProcessChronicleMcpDataAccess {
    async fn query_events(
        &self,
        session: &McpSessionContext,
        input: EventQueryInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError> {
        let entity = Self::validate_entity(input.entity_type, input.entity_id)?;
        let query = StructuredQuery {
            org_id: self.org_id(session),
            entity,
            source: input.source.map(|value| Source::new(&value)),
            topic: input.topic.map(|value| Topic::new(&value)),
            event_type: input.event_type.map(|value| EventType::new(&value)),
            time_range: Self::time_range(input.since_days)?,
            payload_filters: vec![],
            group_by: None,
            order_by: OrderBy::EventTimeDesc,
            limit: Self::limit(input.limit),
            offset: input.offset.unwrap_or(0),
        };

        let events = self
            .events_state
            .query
            .query(&query)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        Ok(EventResultsOutput {
            count: events.len(),
            events,
        })
    }

    async fn search_events(
        &self,
        session: &McpSessionContext,
        input: SearchInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError> {
        let entity = Self::validate_entity(input.entity_type, input.entity_id)?;
        let query = SemanticQuery {
            org_id: self.org_id(session),
            query_text: input.query,
            entity,
            source: input.source.map(|value| Source::new(&value)),
            time_range: None,
            limit: Self::limit(input.limit),
        };

        let events = self
            .events_state
            .query
            .search(&query)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        Ok(EventResultsOutput {
            count: events.len(),
            events,
        })
    }

    async fn get_timeline(
        &self,
        session: &McpSessionContext,
        input: TimelineInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError> {
        let query = TimelineQuery {
            org_id: self.org_id(session),
            entity_type: EntityType::new(&input.entity_type),
            entity_id: EntityId::new(input.entity_id),
            time_range: Self::time_range(input.since_days)?,
            sources: None,
            include_linked: input.include_linked,
            include_entity_refs: true,
            link_depth: 1,
            min_link_confidence: 0.7,
        };

        let events = self
            .events_state
            .query
            .timeline(&query)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        Ok(EventResultsOutput {
            count: events.len(),
            events,
        })
    }

    async fn traverse_graph(
        &self,
        session: &McpSessionContext,
        input: GraphInput,
    ) -> Result<EventResultsOutput, ChronicleMcpError> {
        let start_event_id = input
            .start_event_id
            .parse::<EventId>()
            .map_err(|error| ChronicleMcpError::invalid_input(error.to_string()))?;
        self.tenant_guard(session)
            .assert_event_owned(&start_event_id)
            .await
            .map_err(|_| {
                ChronicleMcpError::not_found("Start event was not found in this tenant")
            })?;

        let query = GraphQuery {
            org_id: self.org_id(session),
            start_event_id,
            direction: input.direction,
            link_types: input.link_types,
            max_depth: input.max_depth,
            min_confidence: input.min_confidence,
        };

        let events = self
            .events_state
            .link
            .traverse(&query)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        Ok(EventResultsOutput {
            count: events.len(),
            events,
        })
    }

    async fn list_runs(
        &self,
        session: &McpSessionContext,
        input: ListRunsInput,
    ) -> Result<ListRunsOutput, ChronicleMcpError> {
        let limit = Self::limit(input.limit);
        let offset = input.offset.unwrap_or(0);
        let runs = self
            .saas_state
            .runs
            .list_by_tenant(&session.tenant_id, input.status.as_deref(), limit, offset)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        let total = self
            .saas_state
            .runs
            .count_by_tenant(&session.tenant_id)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;

        Ok(ListRunsOutput {
            total,
            limit,
            offset,
            runs,
        })
    }

    async fn get_run(
        &self,
        session: &McpSessionContext,
        run_id: &str,
    ) -> Result<RunDetailOutput, ChronicleMcpError> {
        let run = self
            .saas_state
            .runs
            .find_by_id(run_id)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?
            .ok_or_else(|| ChronicleMcpError::not_found(format!("Run {run_id} was not found")))?;

        if run.tenant_id != session.tenant_id {
            return Err(ChronicleMcpError::not_found(format!(
                "Run {run_id} was not found"
            )));
        }

        let audit_logs = self
            .saas_state
            .audit_logs
            .list_by_run(run_id)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;

        Ok(RunDetailOutput { run, audit_logs })
    }

    async fn list_audit_logs(
        &self,
        session: &McpSessionContext,
        input: ListAuditLogsInput,
    ) -> Result<AuditLogListOutput, ChronicleMcpError> {
        let limit = input.limit.unwrap_or(DEFAULT_ACTIVITY_LIMIT);
        let offset = input.offset.unwrap_or(0);
        let audit_logs = self
            .saas_state
            .audit_logs
            .list_by_tenant(&session.tenant_id, limit, offset)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        Ok(AuditLogListOutput {
            limit,
            offset,
            audit_logs,
        })
    }

    async fn describe_sources(
        &self,
        session: &McpSessionContext,
    ) -> Result<SourceCatalogOutput, ChronicleMcpError> {
        let sources = self
            .events_state
            .query
            .describe_sources(&self.org_id(session))
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        Ok(SourceCatalogOutput {
            count: sources.len(),
            sources,
        })
    }

    async fn describe_entity_types(
        &self,
        session: &McpSessionContext,
    ) -> Result<EntityTypesOutput, ChronicleMcpError> {
        let entity_types = self
            .events_state
            .query
            .describe_entity_types(&self.org_id(session))
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        Ok(EntityTypesOutput {
            count: entity_types.len(),
            entity_types,
        })
    }

    async fn describe_schema(
        &self,
        session: &McpSessionContext,
        source: &str,
        event_type: &str,
    ) -> Result<Option<SourceSchema>, ChronicleMcpError> {
        self.events_state
            .query
            .describe_schema(
                &self.org_id(session),
                &Source::new(source),
                &EventType::new(event_type),
            )
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))
    }

    async fn get_event(
        &self,
        session: &McpSessionContext,
        event_id: &str,
    ) -> Result<Option<EventResult>, ChronicleMcpError> {
        let parsed = event_id
            .parse::<EventId>()
            .map_err(|error| ChronicleMcpError::invalid_input(error.to_string()))?;
        self.tenant_guard(session)
            .assert_event_owned(&parsed)
            .await
            .map_err(|_| ChronicleMcpError::not_found(format!("Event {event_id} was not found")))?;

        self.events_state
            .query
            .get_event(&self.org_id(session), &parsed)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))
    }

    async fn latest_activity(
        &self,
        session: &McpSessionContext,
        limit: Option<usize>,
    ) -> Result<AuditLogListOutput, ChronicleMcpError> {
        self.list_audit_logs(
            session,
            ListAuditLogsInput {
                limit: Some(limit.unwrap_or(DEFAULT_ACTIVITY_LIMIT)),
                offset: Some(0),
            },
        )
        .await
    }

    async fn watch_events(
        &self,
        session: &McpSessionContext,
        input: WatchEventsInput,
    ) -> Result<WatchEventsOutput, ChronicleMcpError> {
        let mut receiver = self.stream_backend.subscribe();
        let limit = input.limit.unwrap_or(DEFAULT_STREAM_LIMIT);
        let wait_seconds = input.wait_seconds.unwrap_or(DEFAULT_STREAM_WAIT_SECONDS);
        let deadline = Instant::now() + Duration::from_secs(wait_seconds);
        let mut events = Vec::new();

        while events.len() < limit && Instant::now() < deadline {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let next_event = match tokio::time::timeout(remaining, receiver.recv()).await {
                Ok(result) => {
                    result.map_err(|error| ChronicleMcpError::internal(error.to_string()))?
                }
                Err(_) => break,
            };

            if next_event.tenant_id.as_str() != session.tenant_id {
                continue;
            }
            if let Some(source) = input.source.as_deref() {
                if next_event.source != source {
                    continue;
                }
            }
            if let Some(event_type) = input.event_type.as_deref() {
                if next_event.event_type != event_type {
                    continue;
                }
            }
            if let Some(subject_id) = input.subject_id.as_deref() {
                if next_event.subject.conversation_id.as_str() != subject_id {
                    continue;
                }
            }
            if let Some(needle) = input.payload_contains.as_deref() {
                if !next_event
                    .payload
                    .get()
                    .to_ascii_lowercase()
                    .contains(&needle.to_ascii_lowercase())
                {
                    continue;
                }
            }

            events.push(next_event);
        }

        Ok(WatchEventsOutput {
            collected: events.len(),
            wait_seconds,
            events,
        })
    }

    async fn replay_timeline(
        &self,
        session: &McpSessionContext,
        input: ReplayTimelineInput,
    ) -> Result<ReplayTimelineOutput, ChronicleMcpError> {
        let query = TimelineQuery {
            org_id: self.org_id(session),
            entity_type: EntityType::new(&input.entity_type),
            entity_id: EntityId::new(input.entity_id),
            time_range: Self::time_range(input.since_days)?,
            sources: None,
            include_linked: true,
            include_entity_refs: true,
            link_depth: 1,
            min_link_confidence: DEFAULT_MIN_CONFIDENCE,
        };

        let mut events = self
            .events_state
            .query
            .timeline(&query)
            .await
            .map_err(|error| ChronicleMcpError::internal(error.to_string()))?;
        events.sort_by_key(|item| item.event.event_time);
        if let Some(limit) = input.limit {
            events.truncate(limit);
        }

        Ok(ReplayTimelineOutput {
            replay_enabled: true,
            count: events.len(),
            events,
        })
    }
}
