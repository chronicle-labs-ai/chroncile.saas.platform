//! In-Memory Store Implementation
//!
//! Uses DashMap for concurrent access and provides append-only event storage.

use async_trait::async_trait;
use dashmap::DashMap;
use parking_lot::RwLock;
use std::collections::HashSet;
use std::sync::Arc;

use chronicle_domain::{
    sort_for_replay, EventEnvelope, EventQuery, StoreResult, SubjectId, TenantId, TimeRange,
};
use chronicle_interfaces::{EventStore, QueryResult};

/// In-memory event store
///
/// Features:
/// - Thread-safe via DashMap
/// - Indexed by tenant and conversation
/// - Deduplication via dedup_keys set
pub struct MemoryStore {
    /// Events indexed by tenant_id
    events_by_tenant: DashMap<String, Vec<EventEnvelope>>,
    /// Events indexed by (tenant_id, conversation_id)
    events_by_conversation: DashMap<(String, String), Vec<EventEnvelope>>,
    /// Deduplication keys: (tenant_id, source, source_event_id)
    dedup_keys: Arc<RwLock<HashSet<String>>>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self {
            events_by_tenant: DashMap::new(),
            events_by_conversation: DashMap::new(),
            dedup_keys: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    /// Generate dedup key for an event
    fn dedup_key(tenant_id: &str, source: &str, source_event_id: &str) -> String {
        format!("{}:{}:{}", tenant_id, source, source_event_id)
    }

    /// Clear all data (for testing)
    pub fn clear(&self) {
        self.events_by_tenant.clear();
        self.events_by_conversation.clear();
        self.dedup_keys.write().clear();
    }

    /// Get total event count across all tenants
    pub fn total_count(&self) -> usize {
        self.events_by_tenant
            .iter()
            .map(|entry| entry.value().len())
            .sum()
    }
}

impl Default for MemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for MemoryStore {
    fn clone(&self) -> Self {
        // Create new store with same data
        let new_store = Self::new();

        for entry in self.events_by_tenant.iter() {
            new_store
                .events_by_tenant
                .insert(entry.key().clone(), entry.value().clone());
        }

        for entry in self.events_by_conversation.iter() {
            new_store
                .events_by_conversation
                .insert(entry.key().clone(), entry.value().clone());
        }

        *new_store.dedup_keys.write() = self.dedup_keys.read().clone();

        new_store
    }
}

#[async_trait]
impl EventStore for MemoryStore {
    async fn append(&self, events: &[EventEnvelope]) -> StoreResult<()> {
        for event in events {
            let dedup_key = Self::dedup_key(
                event.tenant_id.as_str(),
                &event.source,
                &event.source_event_id,
            );

            // Check for duplicates
            {
                let mut keys = self.dedup_keys.write();
                if keys.contains(&dedup_key) {
                    // Skip duplicate (idempotent behavior)
                    tracing::debug!("Skipping duplicate event: {}", dedup_key);
                    continue;
                }
                keys.insert(dedup_key);
            }

            // Add to tenant index
            self.events_by_tenant
                .entry(event.tenant_id.as_str().to_string())
                .or_default()
                .push(event.clone());

            // Add to conversation index
            let conv_key = (
                event.tenant_id.as_str().to_string(),
                event.subject.conversation_id.as_str().to_string(),
            );
            self.events_by_conversation
                .entry(conv_key)
                .or_default()
                .push(event.clone());
        }

        Ok(())
    }

    async fn fetch(
        &self,
        tenant_id: &TenantId,
        subject: &SubjectId,
        range: &TimeRange,
    ) -> StoreResult<Vec<EventEnvelope>> {
        let key = (tenant_id.as_str().to_string(), subject.as_str().to_string());

        let events = self
            .events_by_conversation
            .get(&key)
            .map(|entry| {
                entry
                    .value()
                    .iter()
                    .filter(|e| range.contains(&e.occurred_at))
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        Ok(sort_for_replay(events))
    }

    async fn fetch_all(&self, tenant_id: &TenantId) -> StoreResult<Vec<EventEnvelope>> {
        let events = self
            .events_by_tenant
            .get(tenant_id.as_str())
            .map(|entry| entry.value().clone())
            .unwrap_or_default();

        Ok(sort_for_replay(events))
    }

    async fn fetch_by_conversation(
        &self,
        tenant_id: &TenantId,
        conversation_id: &SubjectId,
    ) -> StoreResult<Vec<EventEnvelope>> {
        let key = (
            tenant_id.as_str().to_string(),
            conversation_id.as_str().to_string(),
        );

        let events = self
            .events_by_conversation
            .get(&key)
            .map(|entry| entry.value().clone())
            .unwrap_or_default();

        Ok(sort_for_replay(events))
    }

    async fn exists(
        &self,
        tenant_id: &TenantId,
        source: &str,
        source_event_id: &str,
    ) -> StoreResult<bool> {
        let dedup_key = Self::dedup_key(tenant_id.as_str(), source, source_event_id);
        Ok(self.dedup_keys.read().contains(&dedup_key))
    }

    async fn count(&self, tenant_id: &TenantId) -> StoreResult<usize> {
        Ok(self
            .events_by_tenant
            .get(tenant_id.as_str())
            .map(|entry| entry.value().len())
            .unwrap_or(0))
    }

    async fn query(&self, tenant_id: &TenantId, query: &EventQuery) -> StoreResult<QueryResult> {
        // Get all events for tenant first
        let all_events = self
            .events_by_tenant
            .get(tenant_id.as_str())
            .map(|entry| entry.value().clone())
            .unwrap_or_default();

        // Collect available sources and types before filtering
        let mut available_sources: HashSet<String> = HashSet::new();
        let mut available_event_types: HashSet<String> = HashSet::new();

        for event in &all_events {
            available_sources.insert(event.source.clone());
            available_event_types.insert(event.event_type.clone());
        }

        // Apply filters
        let mut filtered: Vec<EventEnvelope> = all_events
            .into_iter()
            .filter(|event| {
                // Time range filter
                if let Some(ref range) = query.time_range {
                    if !range.contains(&event.occurred_at) {
                        return false;
                    }
                }

                // Source filter
                if !query.sources.is_empty() && !query.sources.contains(&event.source) {
                    return false;
                }

                // Event type filter
                if !query.event_types.is_empty() && !query.event_types.contains(&event.event_type) {
                    return false;
                }

                // Actor filter
                if !query.actors.is_empty() && !query.actors.contains(&event.actor.actor_id) {
                    return false;
                }

                // Subject filter (conversation_id)
                if !query.subjects.is_empty()
                    && !query
                        .subjects
                        .contains(&event.subject.conversation_id.to_string())
                {
                    return false;
                }

                true
            })
            .collect();

        // Sort for replay ordering
        filtered = sort_for_replay(filtered);

        // Apply limit
        if let Some(limit) = query.limit {
            filtered.truncate(limit);
        }

        Ok(QueryResult {
            events: filtered,
            available_sources: available_sources.into_iter().collect(),
            available_event_types: available_event_types.into_iter().collect(),
        })
    }

    async fn list_sources(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        let sources: HashSet<String> = self
            .events_by_tenant
            .get(tenant_id.as_str())
            .map(|entry| entry.value().iter().map(|e| e.source.clone()).collect())
            .unwrap_or_default();

        let mut sources: Vec<String> = sources.into_iter().collect();
        sources.sort();
        Ok(sources)
    }

    async fn list_event_types(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        let types: HashSet<String> = self
            .events_by_tenant
            .get(tenant_id.as_str())
            .map(|entry| entry.value().iter().map(|e| e.event_type.clone()).collect())
            .unwrap_or_default();

        let mut types: Vec<String> = types.into_iter().collect();
        types.sort();
        Ok(types)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chronicle_domain::Actor;
    use chrono::Utc;
    use serde_json::value::RawValue;

    fn make_test_event(tenant: &str, conv: &str, source_id: &str) -> EventEnvelope {
        let payload = RawValue::from_string("{}".to_string()).unwrap();
        EventEnvelope {
            event_id: chronicle_domain::new_event_id(),
            tenant_id: TenantId::new(tenant),
            source: "test".to_string(),
            source_event_id: source_id.to_string(),
            event_type: "test.event".to_string(),
            subject: chronicle_domain::Subject::new(conv),
            actor: Actor::system(),
            occurred_at: Utc::now(),
            ingested_at: Utc::now(),
            schema_version: 1,
            payload,
            pii: Default::default(),
            permissions: Default::default(),
            stream_id: None,
        }
    }

    #[tokio::test]
    async fn test_append_and_fetch() {
        let store = MemoryStore::new();

        let events = vec![
            make_test_event("t1", "c1", "e1"),
            make_test_event("t1", "c1", "e2"),
            make_test_event("t1", "c2", "e3"),
        ];

        store.append(&events).await.unwrap();

        // Fetch by conversation
        let conv1_events = store
            .fetch_by_conversation(&TenantId::new("t1"), &SubjectId::new("c1"))
            .await
            .unwrap();
        assert_eq!(conv1_events.len(), 2);

        // Fetch all for tenant
        let all_events = store.fetch_all(&TenantId::new("t1")).await.unwrap();
        assert_eq!(all_events.len(), 3);
    }

    #[tokio::test]
    async fn test_deduplication() {
        let store = MemoryStore::new();

        let event1 = make_test_event("t1", "c1", "e1");
        let event2 = make_test_event("t1", "c1", "e1"); // Same source_event_id

        store.append(&[event1]).await.unwrap();
        store.append(&[event2]).await.unwrap(); // Should be ignored

        let count = store.count(&TenantId::new("t1")).await.unwrap();
        assert_eq!(count, 1); // Only one event stored
    }

    #[tokio::test]
    async fn test_exists() {
        let store = MemoryStore::new();

        let event = make_test_event("t1", "c1", "e1");
        store.append(&[event]).await.unwrap();

        assert!(store
            .exists(&TenantId::new("t1"), "test", "e1")
            .await
            .unwrap());
        assert!(!store
            .exists(&TenantId::new("t1"), "test", "e2")
            .await
            .unwrap());
        assert!(!store
            .exists(&TenantId::new("t2"), "test", "e1")
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn test_time_range_fetch() {
        let store = MemoryStore::new();

        let now = Utc::now();
        let mut events = vec![
            make_test_event("t1", "c1", "e1"),
            make_test_event("t1", "c1", "e2"),
        ];

        // Set different timestamps
        events[0].occurred_at = now - chrono::Duration::hours(2);
        events[1].occurred_at = now;

        store.append(&events).await.unwrap();

        // Fetch last hour only
        let range = TimeRange::last_hours(1);
        let filtered = store
            .fetch(&TenantId::new("t1"), &SubjectId::new("c1"), &range)
            .await
            .unwrap();

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].source_event_id, "e2");
    }

    #[tokio::test]
    async fn test_tenant_isolation() {
        let store = MemoryStore::new();

        store
            .append(&[make_test_event("t1", "c1", "e1")])
            .await
            .unwrap();
        store
            .append(&[make_test_event("t2", "c1", "e1")])
            .await
            .unwrap();

        let t1_count = store.count(&TenantId::new("t1")).await.unwrap();
        let t2_count = store.count(&TenantId::new("t2")).await.unwrap();

        assert_eq!(t1_count, 1);
        assert_eq!(t2_count, 1);
    }
}
