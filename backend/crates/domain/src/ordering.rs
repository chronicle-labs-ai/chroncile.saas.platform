//! Deterministic Event Ordering
//!
//! Provides ordering logic for events that ensures deterministic replay
//! regardless of ingestion order or timing variations.

use chrono::{DateTime, Utc};

use crate::EventEnvelope;

/// Time range for querying events
#[derive(Clone, Debug)]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl TimeRange {
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    pub fn contains(&self, time: &DateTime<Utc>) -> bool {
        time >= &self.start && time <= &self.end
    }

    /// Create a range for the last N hours
    pub fn last_hours(hours: i64) -> Self {
        let end = Utc::now();
        let start = end - chrono::Duration::hours(hours);
        Self { start, end }
    }

    /// Create a range for the last N days
    pub fn last_days(days: i64) -> Self {
        let end = Utc::now();
        let start = end - chrono::Duration::days(days);
        Self { start, end }
    }
}

impl Default for TimeRange {
    fn default() -> Self {
        Self::last_hours(24)
    }
}

/// Query parameters for filtering events
#[derive(Clone, Debug, Default)]
pub struct EventQuery {
    /// Time range filter
    pub time_range: Option<TimeRange>,
    /// Filter by sources (e.g., "intercom", "zendesk")
    pub sources: Vec<String>,
    /// Filter by event types (e.g., "ticket.created", "message.sent")
    pub event_types: Vec<String>,
    /// Filter by actor IDs
    pub actors: Vec<String>,
    /// Filter by subject IDs (conversation ID, user ID, etc.)
    pub subjects: Vec<String>,
    /// Maximum number of events to return
    pub limit: Option<usize>,
}

impl EventQuery {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_time_range(mut self, range: TimeRange) -> Self {
        self.time_range = Some(range);
        self
    }

    pub fn with_sources(mut self, sources: Vec<String>) -> Self {
        self.sources = sources;
        self
    }

    pub fn with_event_types(mut self, types: Vec<String>) -> Self {
        self.event_types = types;
        self
    }

    pub fn with_actors(mut self, actors: Vec<String>) -> Self {
        self.actors = actors;
        self
    }

    pub fn with_subjects(mut self, subjects: Vec<String>) -> Self {
        self.subjects = subjects;
        self
    }

    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }
}

/// Sort events for deterministic replay
///
/// Ordering rules (in priority order):
/// 1. `occurred_at` - when the event happened in source
/// 2. `event_id` (ULID) - tie-breaker, stable across ingestions
/// 3. `ingested_at` - final fallback (rarely needed)
///
/// This ensures:
/// - Events replay in the order they occurred
/// - Same events always sort the same way (deterministic)
/// - Late-arriving events slot into correct position
pub fn sort_for_replay(mut events: Vec<EventEnvelope>) -> Vec<EventEnvelope> {
    events.sort_by(compare_events);
    events
}

/// Compare two events for ordering
pub fn compare_events(a: &EventEnvelope, b: &EventEnvelope) -> std::cmp::Ordering {
    // Primary: occurred_at
    match a.occurred_at.cmp(&b.occurred_at) {
        std::cmp::Ordering::Equal => {
            // Tie-breaker: event_id (ULID is lexicographically sortable)
            match a.event_id.cmp(&b.event_id) {
                std::cmp::Ordering::Equal => {
                    // Final fallback: ingested_at
                    a.ingested_at.cmp(&b.ingested_at)
                }
                other => other,
            }
        }
        other => other,
    }
}

/// Check if events are in valid replay order
pub fn is_valid_order(events: &[EventEnvelope]) -> bool {
    events
        .windows(2)
        .all(|w| compare_events(&w[0], &w[1]) != std::cmp::Ordering::Greater)
}

/// Find the insertion index for a new event to maintain order
pub fn find_insertion_index(events: &[EventEnvelope], new_event: &EventEnvelope) -> usize {
    events
        .binary_search_by(|e| compare_events(e, new_event))
        .unwrap_or_else(|i| i)
}

/// Merge two sorted event lists maintaining order
pub fn merge_sorted(left: Vec<EventEnvelope>, right: Vec<EventEnvelope>) -> Vec<EventEnvelope> {
    let mut result = Vec::with_capacity(left.len() + right.len());
    let mut left_iter = left.into_iter().peekable();
    let mut right_iter = right.into_iter().peekable();

    loop {
        match (left_iter.peek(), right_iter.peek()) {
            (Some(l), Some(r)) => {
                if compare_events(l, r) != std::cmp::Ordering::Greater {
                    result.push(left_iter.next().unwrap());
                } else {
                    result.push(right_iter.next().unwrap());
                }
            }
            (Some(_), None) => {
                result.extend(left_iter);
                break;
            }
            (None, Some(_)) => {
                result.extend(right_iter);
                break;
            }
            (None, None) => break,
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{new_event_id, Actor, EventEnvelope, Subject, TenantId};
    use serde_json::value::RawValue;

    fn make_test_event(occurred_at: DateTime<Utc>) -> EventEnvelope {
        let payload = RawValue::from_string("{}".to_string()).unwrap();
        EventEnvelope {
            event_id: new_event_id(),
            tenant_id: TenantId::new("test"),
            source: "test".to_string(),
            source_event_id: new_event_id().to_string(),
            event_type: "test.event".to_string(),
            subject: Subject::new("conv_1"),
            actor: Actor::system(),
            occurred_at,
            ingested_at: Utc::now(),
            schema_version: 1,
            payload,
            pii: Default::default(),
            permissions: Default::default(),
            stream_id: None,
        }
    }

    #[test]
    fn test_sort_by_occurred_at() {
        let now = Utc::now();
        let e1 = make_test_event(now - chrono::Duration::seconds(10));
        let e2 = make_test_event(now - chrono::Duration::seconds(5));
        let e3 = make_test_event(now);

        let events = vec![e3.clone(), e1.clone(), e2.clone()];
        let sorted = sort_for_replay(events);

        assert_eq!(sorted[0].occurred_at, e1.occurred_at);
        assert_eq!(sorted[1].occurred_at, e2.occurred_at);
        assert_eq!(sorted[2].occurred_at, e3.occurred_at);
    }

    #[test]
    fn test_deterministic_ordering() {
        let now = Utc::now();
        let events: Vec<_> = (0..10).map(|_| make_test_event(now)).collect();

        let sorted1 = sort_for_replay(events.clone());
        let sorted2 = sort_for_replay(events);

        // Should produce identical ordering
        for (a, b) in sorted1.iter().zip(sorted2.iter()) {
            assert_eq!(a.event_id, b.event_id);
        }
    }

    #[test]
    fn test_is_valid_order() {
        let now = Utc::now();
        let e1 = make_test_event(now - chrono::Duration::seconds(10));
        let e2 = make_test_event(now);

        assert!(is_valid_order(&[e1.clone(), e2.clone()]));
        assert!(!is_valid_order(&[e2, e1]));
    }

    #[test]
    fn test_time_range() {
        let now = Utc::now();
        let range = TimeRange::last_hours(1);

        assert!(range.contains(&now));
        assert!(range.contains(&(now - chrono::Duration::minutes(30))));
        assert!(!range.contains(&(now - chrono::Duration::hours(2))));
    }

    #[test]
    fn test_merge_sorted() {
        let now = Utc::now();
        let left = vec![
            make_test_event(now - chrono::Duration::seconds(10)),
            make_test_event(now - chrono::Duration::seconds(5)),
        ];
        let right = vec![
            make_test_event(now - chrono::Duration::seconds(8)),
            make_test_event(now),
        ];

        let merged = merge_sorted(sort_for_replay(left), sort_for_replay(right));

        assert!(is_valid_order(&merged));
        assert_eq!(merged.len(), 4);
    }
}
