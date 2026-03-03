//! Property-Based Tests for Event Ordering
//!
//! These tests verify that event ordering is deterministic and correct.

use chrono::{Duration, Utc};
use proptest::prelude::*;
use serde_json::value::RawValue;

use chronicle_domain::{
    compare_events, is_valid_order, merge_sorted, sort_for_replay, Actor, EventEnvelope,
    Permissions, PiiFlags, Subject, TenantId,
};

fn make_event_at(tenant: &str, conv: &str, offset_secs: i64) -> EventEnvelope {
    let occurred_at = Utc::now() - Duration::seconds(offset_secs);
    let payload = RawValue::from_string("{}".to_string()).unwrap();

    EventEnvelope {
        event_id: chronicle_domain::new_event_id(),
        tenant_id: TenantId::new(tenant),
        source: "test".to_string(),
        source_event_id: chronicle_domain::new_event_id().to_string(),
        event_type: "test.event".to_string(),
        subject: Subject::new(conv),
        actor: Actor::system(),
        occurred_at,
        ingested_at: Utc::now(),
        schema_version: 1,
        payload,
        pii: PiiFlags::none(),
        permissions: Permissions::support(),
        stream_id: None,
    }
}

proptest! {
    /// Sorting the same events twice produces identical ordering
    #[test]
    fn ordering_is_deterministic(
        offsets in prop::collection::vec(0i64..3600, 1..50)
    ) {
        let events: Vec<EventEnvelope> = offsets
            .iter()
            .map(|&offset| make_event_at("tenant", "conv", offset))
            .collect();

        let sorted1 = sort_for_replay(events.clone());
        let sorted2 = sort_for_replay(events);

        // Same number of events
        prop_assert_eq!(sorted1.len(), sorted2.len());

        // Same event IDs in same order
        for (a, b) in sorted1.iter().zip(sorted2.iter()) {
            prop_assert_eq!(a.event_id, b.event_id);
        }
    }

    /// Sorted events respect occurred_at ordering
    #[test]
    fn ordering_respects_occurred_at(
        offsets in prop::collection::vec(0i64..3600, 2..50)
    ) {
        let events: Vec<EventEnvelope> = offsets
            .iter()
            .map(|&offset| make_event_at("tenant", "conv", offset))
            .collect();

        let sorted = sort_for_replay(events);

        // Each event should have occurred_at <= the next event
        for window in sorted.windows(2) {
            prop_assert!(
                window[0].occurred_at <= window[1].occurred_at,
                "Event at {} should come before event at {}",
                window[0].occurred_at,
                window[1].occurred_at
            );
        }
    }

    /// Events with same occurred_at are ordered by event_id
    #[test]
    fn ordering_tiebreaks_by_event_id(count in 2..20usize) {
        let base_time = Utc::now();

        let mut events: Vec<EventEnvelope> = (0..count)
            .map(|_| {
                let mut e = make_event_at("tenant", "conv", 0);
                e.occurred_at = base_time; // Same timestamp for all
                e
            })
            .collect();

        // Shuffle to ensure sorting is needed
        use rand::seq::SliceRandom;
        events.shuffle(&mut rand::thread_rng());

        let sorted = sort_for_replay(events);

        // Event IDs should be in ascending order
        for window in sorted.windows(2) {
            prop_assert!(
                window[0].event_id < window[1].event_id,
                "Event ID {} should come before {}",
                window[0].event_id,
                window[1].event_id
            );
        }
    }

    /// is_valid_order returns true for sorted events
    #[test]
    fn sorted_events_are_valid(
        offsets in prop::collection::vec(0i64..3600, 1..50)
    ) {
        let events: Vec<EventEnvelope> = offsets
            .iter()
            .map(|&offset| make_event_at("tenant", "conv", offset))
            .collect();

        let sorted = sort_for_replay(events);
        prop_assert!(is_valid_order(&sorted));
    }

    /// Merging two sorted lists produces a valid sorted list
    #[test]
    fn merge_preserves_order(
        offsets1 in prop::collection::vec(0i64..3600, 1..25),
        offsets2 in prop::collection::vec(0i64..3600, 1..25),
    ) {
        let events1: Vec<EventEnvelope> = offsets1
            .iter()
            .map(|&offset| make_event_at("tenant", "conv", offset))
            .collect();

        let events2: Vec<EventEnvelope> = offsets2
            .iter()
            .map(|&offset| make_event_at("tenant", "conv", offset))
            .collect();

        let sorted1 = sort_for_replay(events1);
        let sorted2 = sort_for_replay(events2);

        let merged = merge_sorted(sorted1.clone(), sorted2.clone());

        // Should have all events
        prop_assert_eq!(merged.len(), sorted1.len() + sorted2.len());

        // Should be valid order
        prop_assert!(is_valid_order(&merged));
    }

    /// compare_events is consistent (transitivity)
    #[test]
    fn compare_is_transitive(
        offset_a in 0i64..3600,
        offset_b in 0i64..3600,
        offset_c in 0i64..3600,
    ) {
        let a = make_event_at("t", "c", offset_a);
        let b = make_event_at("t", "c", offset_b);
        let c = make_event_at("t", "c", offset_c);

        use std::cmp::Ordering;

        let ab = compare_events(&a, &b);
        let bc = compare_events(&b, &c);
        let ac = compare_events(&a, &c);

        // If a <= b and b <= c, then a <= c
        if ab != Ordering::Greater && bc != Ordering::Greater {
            prop_assert!(ac != Ordering::Greater);
        }

        // If a >= b and b >= c, then a >= c
        if ab != Ordering::Less && bc != Ordering::Less {
            prop_assert!(ac != Ordering::Less);
        }
    }
}

#[test]
fn test_empty_list_is_valid() {
    assert!(is_valid_order(&[]));
}

#[test]
fn test_single_event_is_valid() {
    let event = make_event_at("t", "c", 0);
    assert!(is_valid_order(&[event]));
}

#[test]
fn test_merge_empty_lists() {
    let merged = merge_sorted(vec![], vec![]);
    assert!(merged.is_empty());
}

#[test]
fn test_merge_with_empty() {
    let events = vec![make_event_at("t", "c", 100), make_event_at("t", "c", 50)];
    let sorted = sort_for_replay(events);

    let merged1 = merge_sorted(sorted.clone(), vec![]);
    let merged2 = merge_sorted(vec![], sorted.clone());

    assert_eq!(merged1.len(), sorted.len());
    assert_eq!(merged2.len(), sorted.len());
}
