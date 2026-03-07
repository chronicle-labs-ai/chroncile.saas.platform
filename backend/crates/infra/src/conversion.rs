use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};

use chronicle_core::event::{Event as ChronicleEvent, EventBuilder};
use chronicle_domain::{
    EventEnvelope as LegacyEventEnvelope, LEGACY_METADATA_KEY, PLATFORM_METADATA_KEY,
};

pub fn derive_topic(source: &str, event_type: &str) -> String {
    let lowered = event_type.to_ascii_lowercase();
    if lowered.contains("payment")
        || lowered.contains("charge")
        || lowered.contains("refund")
        || lowered.contains("invoice")
        || lowered.contains("subscription")
        || source.eq_ignore_ascii_case("stripe")
    {
        return "billing".to_string();
    }

    if lowered.contains("conversation")
        || lowered.contains("message")
        || lowered.contains("ticket")
        || lowered.contains("support")
        || lowered.contains("note")
        || lowered.contains("escalation")
        || source.eq_ignore_ascii_case("intercom")
        || source.eq_ignore_ascii_case("zendesk")
    {
        return "support".to_string();
    }

    if lowered.contains("lead")
        || lowered.contains("customer")
        || lowered.contains("contact")
        || lowered.contains("user")
    {
        return "customers".to_string();
    }

    if lowered.contains("tool") || lowered.contains("llm") || lowered.contains("agent") {
        return "automation".to_string();
    }

    event_type
        .split('.')
        .next()
        .filter(|segment| !segment.is_empty())
        .unwrap_or(source)
        .to_string()
}

fn normalize_payload(payload: Value) -> Map<String, Value> {
    match payload {
        Value::Object(map) => map,
        other => {
            let mut map = Map::new();
            map.insert("value".to_string(), other);
            map
        }
    }
}

pub fn attach_metadata(
    payload: Value,
    platform_metadata: Option<Value>,
    legacy_metadata: Option<Value>,
) -> Value {
    let mut payload = normalize_payload(payload);

    if let Some(platform_metadata) = platform_metadata {
        payload.insert(PLATFORM_METADATA_KEY.to_string(), platform_metadata);
    }

    if let Some(legacy_metadata) = legacy_metadata {
        payload.insert(LEGACY_METADATA_KEY.to_string(), legacy_metadata);
    }

    Value::Object(payload)
}

pub fn build_native_event(
    org_id: &str,
    source: &str,
    event_type: &str,
    occurred_at: DateTime<Utc>,
    ingestion_time: Option<DateTime<Utc>>,
    payload: Value,
    entities: Vec<(String, String)>,
    raw_body: Option<String>,
    platform_metadata: Option<Value>,
    legacy_metadata: Option<Value>,
) -> ChronicleEvent {
    let topic = derive_topic(source, event_type);
    let payload = attach_metadata(payload, platform_metadata, legacy_metadata);

    let mut builder = EventBuilder::new(org_id, source, topic, event_type).event_time(occurred_at);

    for (entity_type, entity_id) in entities {
        builder = builder.entity(entity_type, entity_id);
    }

    builder = builder.payload(payload);

    if let Some(raw_body) = raw_body {
        builder = builder.raw_body(raw_body);
    }

    let mut event = builder.build();
    if let Some(ingestion_time) = ingestion_time {
        event.ingestion_time = ingestion_time;
    }
    event
}

pub fn legacy_event_to_chronicle(event: &LegacyEventEnvelope) -> ChronicleEvent {
    let payload = serde_json::from_str(event.payload.get()).unwrap_or_else(|_| json!({}));

    let platform_metadata = json!({
        "subject": {
            "conversation_id": event.subject.conversation_id.as_str(),
            "ticket_id": event.subject.ticket_id,
            "customer_id": event.subject.customer_id,
            "account_id": event.subject.account_id,
        },
        "actor": {
            "actor_type": event.actor.actor_type,
            "actor_id": event.actor.actor_id,
            "name": event.actor.display_name,
        },
        "pii": event.pii,
        "permissions": event.permissions,
        "schema_version": event.schema_version,
        "stream_id": event.stream_id.as_ref().map(ToString::to_string),
    });

    let legacy_metadata = json!({
        "event_id": event.event_id.to_string(),
        "source_event_id": event.source_event_id,
    });

    let mut entities = vec![(
        "conversation".to_string(),
        event.subject.conversation_id.as_str().to_string(),
    )];

    if let Some(ticket_id) = &event.subject.ticket_id {
        entities.push(("ticket".to_string(), ticket_id.clone()));
    }
    if let Some(customer_id) = &event.subject.customer_id {
        entities.push(("customer".to_string(), customer_id.clone()));
    }
    if let Some(account_id) = &event.subject.account_id {
        entities.push(("account".to_string(), account_id.clone()));
    }

    build_native_event(
        event.tenant_id.as_str(),
        &event.source,
        &event.event_type,
        event.occurred_at,
        Some(event.ingested_at),
        payload,
        entities,
        Some(event.payload.get().to_string()),
        Some(platform_metadata),
        Some(legacy_metadata),
    )
}
