use std::collections::BTreeSet;

use chronicle_core::event::Event;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub enum PayloadProjection {
    Generic {
        payload_text: String,
        source_event_type: String,
        schema_fingerprint: String,
    },
    StripePayment {
        amount: f64,
        currency: String,
        status: String,
        customer_id: String,
        payment_intent_id: String,
    },
    IntercomConversation {
        conversation_id: String,
        message: String,
        rating: u8,
        assignee_id: String,
    },
    ZendeskTicket {
        ticket_id: String,
        subject: String,
        priority: String,
        status: String,
        requester_id: String,
    },
}

pub fn raw_payload_text(event: &Event) -> Option<String> {
    event
        .payload
        .as_ref()
        .and_then(|payload| serde_json::to_string(payload).ok())
}

pub fn payload_source_event_type(event: &Event) -> String {
    format!("{}::{}", event.source.as_str(), event.event_type.as_str())
}

pub fn payload_schema_fingerprint(payload: &Value) -> String {
    let mut paths = BTreeSet::new();
    collect_paths(payload, "$", &mut paths);
    paths.into_iter().collect::<Vec<_>>().join("|")
}

pub fn project_payload(event: &Event) -> Option<PayloadProjection> {
    let payload = event.payload.as_ref()?;
    let payload_text = serde_json::to_string(payload).ok()?;

    let generic_projection = PayloadProjection::Generic {
        payload_text: payload_text.clone(),
        source_event_type: payload_source_event_type(event),
        schema_fingerprint: payload_schema_fingerprint(payload),
    };

    if event.source == "stripe" {
        return Some(project_stripe_payload(event, payload).unwrap_or(generic_projection));
    }

    if event.source == "intercom" {
        return Some(project_intercom_payload(payload).unwrap_or(generic_projection));
    }

    if event.source == "zendesk" {
        return Some(project_zendesk_payload(payload).unwrap_or(generic_projection));
    }

    Some(generic_projection)
}

fn project_stripe_payload(event: &Event, payload: &Value) -> Option<PayloadProjection> {
    let amount = number_field(payload, &["amount", "amount_total"])?;
    let currency = string_field(payload, &["currency"]).unwrap_or_else(|| "usd".to_string());
    let status = string_field(payload, &["status"]).unwrap_or_else(|| "unknown".to_string());
    let customer_id = string_field(payload, &["customer_id", "customerId"])
        .or_else(|| customer_entity_id(event))
        .unwrap_or_default();
    let payment_intent_id =
        string_field(payload, &["payment_intent_id", "paymentIntentId", "id"]).unwrap_or_default();

    Some(PayloadProjection::StripePayment {
        amount,
        currency,
        status,
        customer_id,
        payment_intent_id,
    })
}

fn project_intercom_payload(payload: &Value) -> Option<PayloadProjection> {
    let conversation_id = string_field(payload, &["conversation_id", "conversationId", "id"])?;
    let message = string_field(payload, &["message", "body", "text"]).unwrap_or_default();
    let rating = u8_field(payload, &["rating"]).unwrap_or_default();
    let assignee_id = string_field(payload, &["assignee_id", "assigneeId"]).unwrap_or_default();

    Some(PayloadProjection::IntercomConversation {
        conversation_id,
        message,
        rating,
        assignee_id,
    })
}

fn project_zendesk_payload(payload: &Value) -> Option<PayloadProjection> {
    let ticket_id = string_field(payload, &["ticket_id", "ticketId", "id"])?;
    let subject = string_field(payload, &["subject"]).unwrap_or_default();
    let priority = string_field(payload, &["priority"]).unwrap_or_default();
    let status = string_field(payload, &["status"]).unwrap_or_default();
    let requester_id = string_field(payload, &["requester_id", "requesterId"]).unwrap_or_default();

    Some(PayloadProjection::ZendeskTicket {
        ticket_id,
        subject,
        priority,
        status,
        requester_id,
    })
}

fn customer_entity_id(event: &Event) -> Option<String> {
    event
        .entity_refs
        .iter()
        .find(|reference| reference.entity_type == "customer")
        .map(|reference| reference.entity_id.to_string())
}

fn collect_paths(value: &Value, prefix: &str, paths: &mut BTreeSet<String>) {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                let child_prefix = format!("{prefix}.{key}");
                paths.insert(child_prefix.clone());
                collect_paths(child, &child_prefix, paths);
            }
        }
        Value::Array(items) => {
            for child in items {
                let child_prefix = format!("{prefix}[]");
                paths.insert(child_prefix.clone());
                collect_paths(child, &child_prefix, paths);
            }
        }
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
    }
}

fn string_field(payload: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        payload
            .get(key)
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
    })
}

fn number_field(payload: &Value, keys: &[&str]) -> Option<f64> {
    keys.iter()
        .find_map(|key| payload.get(key).and_then(Value::as_f64))
}

fn u8_field(payload: &Value, keys: &[&str]) -> Option<u8> {
    keys.iter()
        .find_map(|key| payload.get(key).and_then(Value::as_u64))
        .and_then(|value| u8::try_from(value).ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chronicle_core::event::EventBuilder;

    #[test]
    fn computes_schema_fingerprint_for_nested_payloads() {
        let payload = serde_json::json!({
            "message": {
                "body": "hello"
            },
            "tags": ["a", "b"]
        });

        let fingerprint = payload_schema_fingerprint(&payload);

        assert!(fingerprint.contains("$.message"));
        assert!(fingerprint.contains("$.message.body"));
        assert!(fingerprint.contains("$.tags[]"));
    }

    #[test]
    fn projects_stripe_payloads() {
        let event = EventBuilder::new("org_test", "stripe", "payments", "payment_intent.succeeded")
            .entity("customer", "cust_123")
            .payload(serde_json::json!({
                "amount": 4999,
                "currency": "usd",
                "status": "succeeded",
                "payment_intent_id": "pi_123"
            }))
            .build();

        let projection = project_payload(&event).expect("projection should exist");

        assert!(matches!(
            projection,
            PayloadProjection::StripePayment {
                amount,
                ref currency,
                ref customer_id,
                ..
            } if amount == 4999.0 && currency == "usd" && customer_id == "cust_123"
        ));
    }

    #[test]
    fn falls_back_to_generic_for_unknown_sources() {
        let event = EventBuilder::new("org_test", "slack", "messages", "message.posted")
            .payload(serde_json::json!({
                "channel": "support",
                "text": "hello"
            }))
            .build();

        let projection = project_payload(&event).expect("projection should exist");

        assert!(matches!(
            projection,
            PayloadProjection::Generic {
                ref payload_text,
                ..
            } if payload_text.contains("\"channel\":\"support\"")
        ));
    }
}
