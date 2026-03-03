//! Test Utilities
//!
//! Helpers for generating test data and property-based testing.

use chrono::{Duration, Utc};
use proptest::prelude::*;
use serde_json::value::RawValue;

use crate::{Actor, ActorType, EventEnvelope, Permissions, PiiFlags, Subject, SubjectId, TenantId};

/// Generate an arbitrary TenantId
pub fn arb_tenant_id() -> impl Strategy<Value = TenantId> {
    "[a-z]{3,10}_[0-9]{1,5}".prop_map(TenantId::new)
}

/// Generate an arbitrary SubjectId
pub fn arb_subject_id() -> impl Strategy<Value = SubjectId> {
    "[a-z]{4,8}_[0-9]{1,5}".prop_map(SubjectId::new)
}

/// Generate an arbitrary Actor
pub fn arb_actor() -> impl Strategy<Value = Actor> {
    (
        prop_oneof![
            Just(ActorType::Customer),
            Just(ActorType::Agent),
            Just(ActorType::System),
            Just(ActorType::Bot),
        ],
        "[a-z]{3,8}_[0-9]{1,4}",
        proptest::option::of("[A-Z][a-z]{3,10}"),
    )
        .prop_map(|(actor_type, actor_id, display_name)| Actor {
            actor_type,
            actor_id,
            display_name,
        })
}

/// Generate an arbitrary Subject
pub fn arb_subject() -> impl Strategy<Value = Subject> {
    (
        arb_subject_id(),
        proptest::option::of("[a-z]{4,8}_[0-9]{1,5}"),
        proptest::option::of("[a-z]{4,8}_[0-9]{1,5}"),
    )
        .prop_map(|(conversation_id, ticket_id, customer_id)| Subject {
            conversation_id,
            ticket_id,
            customer_id,
            account_id: None,
        })
}

/// Generate an arbitrary EventEnvelope
pub fn arb_event_envelope() -> impl Strategy<Value = EventEnvelope> {
    (
        arb_tenant_id(),
        "[a-z]{5,10}",              // source
        "[a-z0-9]{8,16}",           // source_event_id
        "[a-z]+\\.[a-z]+\\.[a-z]+", // event_type
        arb_subject(),
        arb_actor(),
        0i64..3600i64, // seconds offset
    )
        .prop_map(
            |(tenant_id, source, source_event_id, event_type, subject, actor, offset)| {
                let occurred_at = Utc::now() - Duration::seconds(offset);
                let payload = RawValue::from_string("{}".to_string()).unwrap();

                EventEnvelope {
                    event_id: crate::new_event_id(),
                    tenant_id,
                    source,
                    source_event_id,
                    event_type,
                    subject,
                    actor,
                    occurred_at,
                    ingested_at: Utc::now(),
                    schema_version: 1,
                    payload,
                    pii: PiiFlags::none(),
                    permissions: Permissions::support(),
                    stream_id: None,
                }
            },
        )
}

/// Generate a vector of events for the same conversation
pub fn arb_conversation_events(
    min: usize,
    max: usize,
) -> impl Strategy<Value = Vec<EventEnvelope>> {
    (arb_tenant_id(), arb_subject_id(), min..=max).prop_flat_map(|(tenant_id, conv_id, count)| {
        proptest::collection::vec(
            (
                "[a-z]{5,10}",
                "[a-z0-9]{8,16}",
                "[a-z]+\\.[a-z]+",
                arb_actor(),
                0i64..3600i64,
            ),
            count,
        )
        .prop_map(move |items| {
            items
                .into_iter()
                .map(|(source, source_event_id, event_type, actor, offset)| {
                    let occurred_at = Utc::now() - Duration::seconds(offset);
                    let payload = RawValue::from_string("{}".to_string()).unwrap();

                    EventEnvelope {
                        event_id: crate::new_event_id(),
                        tenant_id: tenant_id.clone(),
                        source,
                        source_event_id,
                        event_type,
                        subject: Subject::new(conv_id.clone()),
                        actor,
                        occurred_at,
                        ingested_at: Utc::now(),
                        schema_version: 1,
                        payload,
                        pii: PiiFlags::none(),
                        permissions: Permissions::support(),
                        stream_id: None,
                    }
                })
                .collect()
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    proptest! {
        #[test]
        fn test_arb_event_produces_valid_events(event in arb_event_envelope()) {
            prop_assert!(!event.tenant_id.as_str().is_empty());
            prop_assert!(!event.source.is_empty());
            prop_assert!(!event.event_type.is_empty());
        }

        #[test]
        fn test_arb_conversation_events_same_conversation(
            events in arb_conversation_events(2, 10)
        ) {
            if events.len() >= 2 {
                let conv_id = &events[0].subject.conversation_id;
                for event in &events {
                    prop_assert_eq!(&event.subject.conversation_id, conv_id);
                }
            }
        }
    }
}
