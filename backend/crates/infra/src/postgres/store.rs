//! Postgres Chronicle storage wrapper.

use std::sync::Arc;

use chronicle_store::postgres::{PostgresBackend, TracedPgPool};
use chronicle_store::StorageEngine;
use chrono::{DateTime, Utc};
use serde_json::{value::RawValue, Value};
use sqlx::Row;

use crate::conversion::legacy_event_to_chronicle;
use chronicle_domain::{Actor, ActorType, EventEnvelope, Permissions, PiiFlags, Subject, TenantId};

use super::PostgresError;

#[derive(Clone)]
pub struct PostgresStore {
    backend: Arc<PostgresBackend>,
}

impl PostgresStore {
    pub async fn new(database_url: &str) -> Result<Self, PostgresError> {
        let backend = PostgresBackend::new(database_url)
            .await
            .map_err(|err| PostgresError::Connection(err.to_string()))?;
        Ok(Self {
            backend: Arc::new(backend),
        })
    }

    pub async fn migrate(&self) -> Result<(), PostgresError> {
        self.rename_legacy_events_table().await?;
        self.backend
            .run_migrations()
            .await
            .map_err(|err| PostgresError::Migration(err.to_string()))?;
        self.create_support_tables().await?;
        self.backfill_legacy_events().await?;
        Ok(())
    }

    pub fn backend(&self) -> Arc<PostgresBackend> {
        Arc::clone(&self.backend)
    }

    pub fn engine(&self) -> StorageEngine {
        StorageEngine {
            events: self.backend.clone(),
            entity_refs: self.backend.clone(),
            links: self.backend.clone(),
            embeddings: self.backend.clone(),
            schemas: self.backend.clone(),
            subscriptions: Some(self.backend.clone()),
        }
    }

    pub async fn exists_source_event_id(
        &self,
        tenant_id: &TenantId,
        source: &str,
        source_event_id: &str,
    ) -> Result<bool, PostgresError> {
        sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM events e
                WHERE e.org_id = $1
                  AND e.source = $2
                  AND e.payload #>> '{_legacy,source_event_id}' = $3
            )
            "#,
        )
        .bind(tenant_id.as_str())
        .bind(source)
        .bind(source_event_id)
        .fetch_one(self.pool())
        .await
        .map_err(|err| PostgresError::Query(err.to_string()))
    }

    pub async fn health_check(&self) -> Result<(), PostgresError> {
        sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(self.pool())
            .await
            .map(|_| ())
            .map_err(|err| PostgresError::Query(err.to_string()))
    }

    fn pool(&self) -> &TracedPgPool {
        self.backend.traced_pool()
    }

    async fn rename_legacy_events_table(&self) -> Result<(), PostgresError> {
        let pool = self.pool();
        let has_legacy_columns: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'events'
                  AND column_name = 'tenant_id'
            )
            "#,
        )
        .fetch_one(pool)
        .await
        .map_err(|err| PostgresError::Migration(err.to_string()))?;

        if !has_legacy_columns {
            return Ok(());
        }

        let legacy_exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'legacy_events'
            )
            "#,
        )
        .fetch_one(pool)
        .await
        .map_err(|err| PostgresError::Migration(err.to_string()))?;

        if !legacy_exists {
            sqlx::raw_sql("ALTER TABLE events RENAME TO legacy_events")
                .execute(pool)
                .await
                .map_err(|err| PostgresError::Migration(err.to_string()))?;
        }

        Ok(())
    }

    async fn create_support_tables(&self) -> Result<(), PostgresError> {
        sqlx::raw_sql(
            r#"
            CREATE TABLE IF NOT EXISTS legacy_event_id_map (
                legacy_event_id TEXT PRIMARY KEY,
                chronicle_event_id TEXT NOT NULL UNIQUE,
                org_id TEXT NOT NULL,
                source TEXT NOT NULL,
                source_event_id TEXT,
                migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            "#,
        )
        .execute(self.pool())
        .await
        .map_err(|err| PostgresError::Migration(err.to_string()))?;

        Ok(())
    }

    async fn backfill_legacy_events(&self) -> Result<(), PostgresError> {
        let pool = self.pool();
        let legacy_exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'legacy_events'
            )
            "#,
        )
        .fetch_one(pool)
        .await
        .map_err(|err| PostgresError::Migration(err.to_string()))?;

        if !legacy_exists {
            return Ok(());
        }

        let rows = sqlx::query(
            r#"
            SELECT
                le.event_id,
                le.tenant_id,
                le.source,
                le.source_event_id,
                le.event_type,
                le.conversation_id,
                le.ticket_id,
                le.customer_id,
                le.account_id,
                le.actor_type,
                le.actor_id,
                le.actor_name,
                le.occurred_at,
                le.ingested_at,
                le.schema_version,
                le.payload,
                le.pii_flags,
                le.permissions
            FROM legacy_events le
            LEFT JOIN legacy_event_id_map map
                ON map.legacy_event_id = le.event_id
            WHERE map.legacy_event_id IS NULL
            ORDER BY le.occurred_at ASC, le.event_id ASC
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|err| PostgresError::Migration(err.to_string()))?;

        if rows.is_empty() {
            return Ok(());
        }

        for row in rows {
            let legacy_event = self.row_to_legacy_event(&row)?;
            let legacy_event_id = legacy_event.event_id.to_string();
            let source = legacy_event.source.clone();
            let source_event_id = legacy_event.source_event_id.clone();
            let org_id = legacy_event.tenant_id.to_string();
            let native_event = legacy_event_to_chronicle(&legacy_event);

            let chronicle_event_id = self
                .engine()
                .events
                .insert_events(&[native_event])
                .await
                .map_err(|err| PostgresError::Migration(err.to_string()))?
                .into_iter()
                .next()
                .ok_or_else(|| PostgresError::Migration("missing migrated event id".to_string()))?;

            sqlx::query(
                r#"
                INSERT INTO legacy_event_id_map (
                    legacy_event_id,
                    chronicle_event_id,
                    org_id,
                    source,
                    source_event_id
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (legacy_event_id) DO NOTHING
                "#,
            )
            .bind(&legacy_event_id)
            .bind(chronicle_event_id.to_string())
            .bind(org_id)
            .bind(source)
            .bind(source_event_id)
            .execute(pool)
            .await
            .map_err(|err| PostgresError::Migration(err.to_string()))?;
        }

        sqlx::raw_sql(
            r#"
            UPDATE "Run" AS run
            SET "eventId" = map.chronicle_event_id
            FROM legacy_event_id_map AS map
            WHERE run."eventId" = map.legacy_event_id;

            UPDATE "AuditLog" AS log
            SET "eventId" = map.chronicle_event_id
            FROM legacy_event_id_map AS map
            WHERE log."eventId" = map.legacy_event_id;
            "#,
        )
        .execute(pool)
        .await
        .map_err(|err| PostgresError::Migration(err.to_string()))?;

        Ok(())
    }

    fn row_to_legacy_event(
        &self,
        row: &sqlx::postgres::PgRow,
    ) -> Result<EventEnvelope, PostgresError> {
        let payload = row
            .try_get::<serde_json::Value, _>("payload")
            .map_err(|err| PostgresError::Migration(err.to_string()))?;
        let raw_payload = RawValue::from_string(
            serde_json::to_string(&payload)
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
        )
        .map_err(|err| PostgresError::Migration(err.to_string()))?;

        let pii = row
            .try_get::<Value, _>("pii_flags")
            .ok()
            .and_then(|value| serde_json::from_value::<PiiFlags>(value).ok())
            .unwrap_or_default();
        let permissions = row
            .try_get::<Value, _>("permissions")
            .ok()
            .and_then(|value| serde_json::from_value::<Permissions>(value).ok())
            .unwrap_or_default();

        let actor_type = row
            .try_get::<String, _>("actor_type")
            .unwrap_or_else(|_| "system".to_string());
        let actor_id = row
            .try_get::<String, _>("actor_id")
            .unwrap_or_else(|_| "system".to_string());
        let actor_name = row
            .try_get::<Option<String>, _>("actor_name")
            .ok()
            .flatten();

        let actor = match actor_type.as_str() {
            "customer" => Actor::customer(actor_id),
            "agent" => Actor::agent(actor_id),
            "bot" => Actor {
                actor_type: ActorType::Bot,
                actor_id,
                display_name: None,
            },
            _ => Actor::system(),
        };
        let actor = if let Some(name) = actor_name {
            actor.with_name(name)
        } else {
            actor
        };

        let mut subject = Subject::new(
            row.try_get::<String, _>("conversation_id")
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
        );
        if let Some(ticket_id) = row.try_get::<Option<String>, _>("ticket_id").ok().flatten() {
            subject = subject.with_ticket(ticket_id);
        }
        if let Some(customer_id) = row
            .try_get::<Option<String>, _>("customer_id")
            .ok()
            .flatten()
        {
            subject = subject.with_customer(customer_id);
        }
        if let Some(account_id) = row
            .try_get::<Option<String>, _>("account_id")
            .ok()
            .flatten()
        {
            subject = subject.with_account(account_id);
        }

        Ok(EventEnvelope {
            event_id: row
                .try_get::<String, _>("event_id")
                .map_err(|err| PostgresError::Migration(err.to_string()))?
                .parse::<ulid::Ulid>()
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
            tenant_id: TenantId::new(
                row.try_get::<String, _>("tenant_id")
                    .map_err(|err| PostgresError::Migration(err.to_string()))?,
            ),
            source: row
                .try_get("source")
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
            source_event_id: row
                .try_get("source_event_id")
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
            event_type: row
                .try_get("event_type")
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
            subject,
            actor,
            occurred_at: row
                .try_get::<DateTime<Utc>, _>("occurred_at")
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
            ingested_at: row
                .try_get::<DateTime<Utc>, _>("ingested_at")
                .map_err(|err| PostgresError::Migration(err.to_string()))?,
            schema_version: row
                .try_get::<i32, _>("schema_version")
                .map_err(|err| PostgresError::Migration(err.to_string()))?
                as u32,
            payload: raw_payload,
            pii,
            permissions,
            stream_id: None,
        })
    }
}
