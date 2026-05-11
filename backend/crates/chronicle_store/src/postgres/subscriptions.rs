//! PostgreSQL implementation of [`SubscriptionService`].
//!
//! Uses `LISTEN/NOTIFY` for cross-process wakeups, then rehydrates full
//! [`Event`] rows from Postgres before invoking subscription handlers.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgListener;
use tokio::sync::broadcast;

use chronicle_core::error::StoreError;
use chronicle_core::event::Event;

use super::events::row_to_event;
use super::PostgresBackend;
use crate::subscriptions::{
    matches_filter, EventHandler, SubFilter, SubscriptionHandle, SubscriptionPosition,
    SubscriptionService,
};

const SUBSCRIPTION_CHANNEL: &str = "chronicle_events";
const MAX_NOTIFY_PAYLOAD_BYTES: usize = 7_500;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct NotificationPayload {
    pub org_id: String,
    pub event_ids: Vec<String>,
}

pub(super) fn notification_payloads(events: &[Event]) -> Result<Vec<String>, StoreError> {
    let mut grouped = Vec::<(String, Vec<String>)>::new();
    let mut org_indexes = HashMap::<String, usize>::new();

    for event in events {
        let org_id = event.org_id.as_str().to_string();
        let index = match org_indexes.get(&org_id) {
            Some(index) => *index,
            None => {
                let index = grouped.len();
                grouped.push((org_id.clone(), Vec::new()));
                org_indexes.insert(org_id, index);
                index
            }
        };

        grouped[index].1.push(event.event_id.to_string());
    }

    let mut payloads = Vec::new();
    for (org_id, event_ids) in grouped {
        let mut current = Vec::new();
        for event_id in event_ids {
            current.push(event_id.clone());
            let serialized = serialize_notification_payload(&org_id, &current)?;
            if serialized.len() <= MAX_NOTIFY_PAYLOAD_BYTES {
                continue;
            }

            let last_id = current
                .pop()
                .expect("notification chunk must contain the event being considered");
            if current.is_empty() {
                return Err(StoreError::Internal(format!(
                    "event notification for org {org_id} exceeded {MAX_NOTIFY_PAYLOAD_BYTES} bytes"
                )));
            }

            payloads.push(serialize_notification_payload(&org_id, &current)?);
            current = vec![last_id];
        }

        if !current.is_empty() {
            payloads.push(serialize_notification_payload(&org_id, &current)?);
        }
    }

    Ok(payloads)
}

fn serialize_notification_payload(
    org_id: &str,
    event_ids: &[String],
) -> Result<String, StoreError> {
    serde_json::to_string(&NotificationPayload {
        org_id: org_id.to_string(),
        event_ids: event_ids.to_vec(),
    })
    .map_err(|error| StoreError::Internal(format!("serialize subscription notification: {error}")))
}

async fn fetch_notified_events(
    pool: &super::TracedPgPool,
    payload: &NotificationPayload,
) -> Result<Vec<Event>, StoreError> {
    if payload.event_ids.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query(
        r#"
        SELECT
            e.event_id,
            e.org_id,
            e.source,
            e.topic,
            e.event_type,
            e.event_time,
            e.ingestion_time,
            e.payload,
            e.media_type,
            e.media_ref,
            e.media_blob,
            e.media_size_bytes,
            e.raw_body
        FROM events e
        WHERE e.org_id = $1
          AND e.event_id = ANY($2)
        "#,
    )
    .bind(&payload.org_id)
    .bind(&payload.event_ids)
    .fetch_all(pool)
    .await
    .map_err(|error| StoreError::Query(error.to_string()))?;

    let order: HashMap<&str, usize> = payload
        .event_ids
        .iter()
        .enumerate()
        .map(|(index, event_id)| (event_id.as_str(), index))
        .collect();

    let mut events: Vec<Event> = rows.iter().map(row_to_event).collect();
    events.sort_by_key(|event| {
        order
            .get(event.event_id.to_string().as_str())
            .copied()
            .unwrap_or(usize::MAX)
    });
    Ok(events)
}

#[async_trait]
impl SubscriptionService for PostgresBackend {
    async fn subscribe(
        &self,
        filter: SubFilter,
        position: SubscriptionPosition,
        handler: Arc<dyn EventHandler>,
    ) -> Result<SubscriptionHandle, StoreError> {
        if matches!(position, SubscriptionPosition::Beginning) {
            return Err(StoreError::Internal(
                "Postgres subscriptions currently support SubscriptionPosition::End only"
                    .to_string(),
            ));
        }

        let (cancel_tx, mut cancel_rx) = broadcast::channel::<()>(1);
        let pool = self.pool.clone();

        tokio::spawn(async move {
            let mut listener = match PgListener::connect_with(pool.inner()).await {
                Ok(listener) => listener,
                Err(error) => {
                    tracing::error!(error = %error, "failed to connect Postgres subscription listener");
                    return;
                }
            };

            if let Err(error) = listener.listen(SUBSCRIPTION_CHANNEL).await {
                tracing::error!(error = %error, "failed to LISTEN for Postgres subscriptions");
                return;
            }

            loop {
                tokio::select! {
                    _ = cancel_rx.recv() => {
                        tracing::debug!("Postgres subscription cancelled");
                        break;
                    }
                    notification = listener.recv() => {
                        let notification = match notification {
                            Ok(notification) => notification,
                            Err(error) => {
                                tracing::error!(error = %error, "Postgres subscription listener failed");
                                break;
                            }
                        };

                        let payload = match serde_json::from_str::<NotificationPayload>(notification.payload()) {
                            Ok(payload) => payload,
                            Err(error) => {
                                tracing::warn!(error = %error, payload = notification.payload(), "ignoring invalid subscription payload");
                                continue;
                            }
                        };

                        if let Some(expected_org) = filter.org_id.as_ref() {
                            if payload.org_id != expected_org.as_str() {
                                continue;
                            }
                        }

                        let events = match fetch_notified_events(&pool, &payload).await {
                            Ok(events) => events,
                            Err(error) => {
                                tracing::warn!(error = %error, org_id = %payload.org_id, "failed to rehydrate subscribed events");
                                continue;
                            }
                        };

                        for event in events {
                            if !matches_filter(&event, &filter) {
                                continue;
                            }

                            if let Err(error) = handler.handle(&event).await {
                                tracing::warn!(error = %error, event_id = %event.event_id, "subscription handler error");
                            }
                        }
                    }
                }
            }
        });

        Ok(SubscriptionHandle::new(cancel_tx))
    }
}

pub(super) fn notification_channel() -> &'static str {
    SUBSCRIPTION_CHANNEL
}
