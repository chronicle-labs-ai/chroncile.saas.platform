//! Postgres Event Store
//!
//! Implements append-only event storage with Postgres.

use async_trait::async_trait;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};

use chronicle_domain::{
    sort_for_replay, EventEnvelope, EventQuery, StoreError, StoreResult, SubjectId, TenantId,
    TimeRange,
};
use chronicle_interfaces::{EventStore, QueryResult};

use super::PostgresError;

/// Postgres event store
#[derive(Clone)]
pub struct PostgresStore {
    pool: PgPool,
}

impl PostgresStore {
    /// Create a new Postgres store
    pub async fn new(database_url: &str) -> Result<Self, PostgresError> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await
            .map_err(|e| PostgresError::Connection(e.to_string()))?;

        Ok(Self { pool })
    }

    /// Run database migrations
    pub async fn migrate(&self) -> Result<(), PostgresError> {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await
            .map_err(|e: sqlx::migrate::MigrateError| PostgresError::Migration(e.to_string()))?;
        Ok(())
    }

    /// Append a batch of events (optimized for bulk insert)
    pub async fn append_batch(&self, events: &[EventEnvelope]) -> StoreResult<()> {
        if events.is_empty() {
            return Ok(());
        }

        // Use a transaction for atomicity
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| StoreError::ConnectionFailed(e.to_string()))?;

        for event in events {
            let payload_str = event.payload.get();
            let pii_json = serde_json::to_value(&event.pii)
                .map_err(|e: serde_json::Error| StoreError::Serialization(e.to_string()))?;
            let permissions_json = serde_json::to_value(&event.permissions)
                .map_err(|e: serde_json::Error| StoreError::Serialization(e.to_string()))?;

            sqlx::query(
                r#"
                INSERT INTO events (
                    event_id, tenant_id, source, source_event_id, event_type,
                    conversation_id, ticket_id, customer_id, account_id,
                    actor_type, actor_id, actor_name,
                    occurred_at, ingested_at, schema_version,
                    payload, pii_flags, permissions
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18
                )
                ON CONFLICT (tenant_id, source, source_event_id) DO NOTHING
                "#,
            )
            .bind(event.event_id.to_string())
            .bind(event.tenant_id.as_str())
            .bind(&event.source)
            .bind(&event.source_event_id)
            .bind(&event.event_type)
            .bind(event.subject.conversation_id.as_str())
            .bind(&event.subject.ticket_id)
            .bind(&event.subject.customer_id)
            .bind(&event.subject.account_id)
            .bind(format!("{:?}", event.actor.actor_type).to_lowercase())
            .bind(&event.actor.actor_id)
            .bind(&event.actor.display_name)
            .bind(event.occurred_at)
            .bind(event.ingested_at)
            .bind(event.schema_version as i32)
            .bind(payload_str)
            .bind(pii_json)
            .bind(permissions_json)
            .execute(&mut *tx)
            .await
            .map_err(|e| StoreError::QueryFailed(e.to_string()))?;
        }

        tx.commit()
            .await
            .map_err(|e| StoreError::QueryFailed(e.to_string()))?;

        Ok(())
    }
}

#[async_trait]
impl EventStore for PostgresStore {
    async fn append(&self, events: &[EventEnvelope]) -> StoreResult<()> {
        self.append_batch(events).await
    }

    async fn fetch(
        &self,
        tenant_id: &TenantId,
        subject: &SubjectId,
        range: &TimeRange,
    ) -> StoreResult<Vec<EventEnvelope>> {
        let rows = sqlx::query(
            r#"
            SELECT * FROM events
            WHERE tenant_id = $1
              AND conversation_id = $2
              AND occurred_at >= $3
              AND occurred_at <= $4
            ORDER BY occurred_at ASC, event_id ASC
            "#,
        )
        .bind(tenant_id.as_str())
        .bind(subject.as_str())
        .bind(range.start)
        .bind(range.end)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| StoreError::QueryFailed(e.to_string()))?;

        let events: Vec<EventEnvelope> = rows
            .into_iter()
            .filter_map(|row| row_to_event(&row).ok())
            .collect();

        Ok(events)
    }

    async fn fetch_all(&self, tenant_id: &TenantId) -> StoreResult<Vec<EventEnvelope>> {
        let rows = sqlx::query(
            r#"
            SELECT * FROM events
            WHERE tenant_id = $1
            ORDER BY occurred_at ASC, event_id ASC
            "#,
        )
        .bind(tenant_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| StoreError::QueryFailed(e.to_string()))?;

        let events: Vec<EventEnvelope> = rows
            .into_iter()
            .filter_map(|row| row_to_event(&row).ok())
            .collect();

        Ok(events)
    }

    async fn fetch_by_conversation(
        &self,
        tenant_id: &TenantId,
        conversation_id: &SubjectId,
    ) -> StoreResult<Vec<EventEnvelope>> {
        let rows = sqlx::query(
            r#"
            SELECT * FROM events
            WHERE tenant_id = $1 AND conversation_id = $2
            ORDER BY occurred_at ASC, event_id ASC
            "#,
        )
        .bind(tenant_id.as_str())
        .bind(conversation_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| StoreError::QueryFailed(e.to_string()))?;

        let events: Vec<EventEnvelope> = rows
            .into_iter()
            .filter_map(|row| row_to_event(&row).ok())
            .collect();

        Ok(events)
    }

    async fn exists(
        &self,
        tenant_id: &TenantId,
        source: &str,
        source_event_id: &str,
    ) -> StoreResult<bool> {
        let row = sqlx::query(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM events
                WHERE tenant_id = $1 AND source = $2 AND source_event_id = $3
            ) as exists
            "#,
        )
        .bind(tenant_id.as_str())
        .bind(source)
        .bind(source_event_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| StoreError::QueryFailed(e.to_string()))?;

        Ok(row.get::<bool, _>("exists"))
    }

    async fn count(&self, tenant_id: &TenantId) -> StoreResult<usize> {
        let row = sqlx::query(
            r#"
            SELECT COUNT(*) as count FROM events WHERE tenant_id = $1
            "#,
        )
        .bind(tenant_id.as_str())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| StoreError::QueryFailed(e.to_string()))?;

        Ok(row.get::<i64, _>("count") as usize)
    }

    async fn query(
        &self,
        tenant_id: &TenantId,
        query: &EventQuery,
    ) -> StoreResult<QueryResult> {
        let all_events = self.fetch_all(tenant_id).await?;
        let available_sources: std::collections::HashSet<String> =
            all_events.iter().map(|e| e.source.clone()).collect();
        let available_event_types: std::collections::HashSet<String> =
            all_events.iter().map(|e| e.event_type.clone()).collect();

        let mut filtered: Vec<EventEnvelope> = all_events
            .into_iter()
            .filter(|event| {
                if let Some(ref range) = query.time_range {
                    if !range.contains(&event.occurred_at) {
                        return false;
                    }
                }
                if !query.sources.is_empty() && !query.sources.contains(&event.source) {
                    return false;
                }
                if !query.event_types.is_empty()
                    && !query.event_types.contains(&event.event_type)
                {
                    return false;
                }
                if !query.actors.is_empty() && !query.actors.contains(&event.actor.actor_id) {
                    return false;
                }
                if !query.subjects.is_empty()
                    && !query.subjects.contains(&event.subject.conversation_id.to_string())
                {
                    return false;
                }
                true
            })
            .collect();
        filtered = sort_for_replay(filtered);
        if let Some(limit) = query.limit {
            filtered.truncate(limit);
        }

        let mut sources: Vec<String> = available_sources.into_iter().collect();
        sources.sort();
        let mut types: Vec<String> = available_event_types.into_iter().collect();
        types.sort();

        Ok(QueryResult {
            events: filtered,
            available_sources: sources,
            available_event_types: types,
        })
    }

    async fn list_sources(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        let rows = sqlx::query(
            r#"SELECT DISTINCT source FROM events WHERE tenant_id = $1 ORDER BY source"#,
        )
        .bind(tenant_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| StoreError::QueryFailed(e.to_string()))?;
        Ok(rows.into_iter().map(|r| r.get::<String, _>("source")).collect())
    }

    async fn list_event_types(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        let rows = sqlx::query(
            r#"SELECT DISTINCT event_type FROM events WHERE tenant_id = $1 ORDER BY event_type"#,
        )
        .bind(tenant_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| StoreError::QueryFailed(e.to_string()))?;
        Ok(rows
            .into_iter()
            .map(|r| r.get::<String, _>("event_type"))
            .collect())
    }
}

/// Convert a database row to an EventEnvelope
fn row_to_event(row: &sqlx::postgres::PgRow) -> Result<EventEnvelope, StoreError> {
    use chronicle_domain::{Actor, ActorType, Permissions, PiiFlags, Subject};
    use serde_json::value::RawValue;

    let event_id: String = row.get("event_id");
    let tenant_id: String = row.get("tenant_id");
    let source: String = row.get("source");
    let source_event_id: String = row.get("source_event_id");
    let event_type: String = row.get("event_type");
    let conversation_id: String = row.get("conversation_id");
    let ticket_id: Option<String> = row.get("ticket_id");
    let customer_id: Option<String> = row.get("customer_id");
    let account_id: Option<String> = row.get("account_id");
    let actor_type: String = row.get("actor_type");
    let actor_id: String = row.get("actor_id");
    let actor_name: Option<String> = row.get("actor_name");
    let occurred_at: chrono::DateTime<chrono::Utc> = row.get("occurred_at");
    let ingested_at: chrono::DateTime<chrono::Utc> = row.get("ingested_at");
    let schema_version: i32 = row.get("schema_version");
    let payload_value: serde_json::Value = row.get("payload");
    let payload_str = serde_json::to_string(&payload_value)
        .map_err(|e: serde_json::Error| StoreError::Serialization(e.to_string()))?;
    let pii_flags: serde_json::Value = row.get("pii_flags");
    let permissions: serde_json::Value = row.get("permissions");

    let subject = Subject {
        conversation_id: SubjectId::new(conversation_id),
        ticket_id,
        customer_id,
        account_id,
    };

    let actor = Actor {
        actor_type: match actor_type.as_str() {
            "customer" => ActorType::Customer,
            "agent" => ActorType::Agent,
            "bot" => ActorType::Bot,
            _ => ActorType::System,
        },
        actor_id,
        display_name: actor_name,
    };

    let payload = RawValue::from_string(payload_str)
        .map_err(|e: serde_json::Error| StoreError::Serialization(e.to_string()))?;

    let pii: PiiFlags = serde_json::from_value(pii_flags)
        .map_err(|e: serde_json::Error| StoreError::Serialization(e.to_string()))?;

    let permissions: Permissions = serde_json::from_value(permissions)
        .map_err(|e: serde_json::Error| StoreError::Serialization(e.to_string()))?;

    Ok(EventEnvelope {
        event_id: event_id
            .parse()
            .map_err(|_| StoreError::Serialization("Invalid ULID".to_string()))?,
        tenant_id: TenantId::new(tenant_id),
        source,
        source_event_id,
        event_type,
        subject,
        actor,
        occurred_at,
        ingested_at,
        schema_version: schema_version as u32,
        payload,
        pii,
        permissions,
        stream_id: None,
    })
}
