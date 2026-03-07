//! Convert incoming web events into Chronicle [`Event`] objects.
//!
//! [`WebEventConverter`] is the central bridge: it validates an
//! [`IncomingWebEvent`], derives `source`/`topic`/`event_type`, merges
//! properties with context into a payload, and auto-extracts entity
//! refs (user, session, group).

use chronicle_core::event::{Event, EventBuilder};
use serde_json::Value;

use crate::error::WebError;
use crate::types::{IncomingWebEvent, WebEventKind};

/// Converts [`IncomingWebEvent`] payloads into Chronicle [`Event`] objects.
///
/// All web events are stored with `source = "web"`. The topic and
/// `event_type` are derived from the [`WebEventKind`].
pub struct WebEventConverter {
    _private: (),
}

impl WebEventConverter {
    pub fn new() -> Self {
        Self { _private: () }
    }

    /// Validate and convert a single incoming web event.
    pub fn convert(&self, incoming: &IncomingWebEvent, org_id: &str) -> Result<Event, WebError> {
        self.validate(incoming)?;

        let (topic, event_type) = derive_topic_and_type(&incoming.kind);

        let mut builder = EventBuilder::new(org_id, "web", topic, event_type);

        if let Some(ts) = incoming.timestamp {
            builder = builder.event_time(ts);
        }

        let payload = build_payload(incoming);
        if !payload.is_null() {
            builder = builder.payload(payload);
        }

        if let Ok(raw) = serde_json::to_string(incoming) {
            builder = builder.raw_body(raw);
        }

        builder = attach_entity_refs(builder, incoming);

        Ok(builder.build())
    }

    /// Validate and convert a batch of incoming web events.
    ///
    /// Returns one `Result` per event so partial failures are visible.
    pub fn convert_batch(
        &self,
        events: &[IncomingWebEvent],
        org_id: &str,
    ) -> Vec<Result<Event, WebError>> {
        events.iter().map(|e| self.convert(e, org_id)).collect()
    }

    #[allow(clippy::unused_self)]
    fn validate(&self, incoming: &IncomingWebEvent) -> Result<(), WebError> {
        if incoming.anonymous_id.is_none() && incoming.user_id.is_none() {
            return Err(WebError::MissingField(
                "anonymous_id or user_id (at least one required)",
            ));
        }

        match &incoming.kind {
            WebEventKind::Track { event, .. } => {
                if event.is_empty() {
                    return Err(WebError::InvalidValue {
                        field: "event",
                        reason: "track event name must not be empty".into(),
                    });
                }
            }
            WebEventKind::Identify { .. } => {
                if incoming.user_id.is_none() {
                    return Err(WebError::MissingField(
                        "user_id (required for identify events)",
                    ));
                }
            }
            WebEventKind::Group { group_id, .. } => {
                if group_id.is_empty() {
                    return Err(WebError::InvalidValue {
                        field: "group_id",
                        reason: "group_id must not be empty".into(),
                    });
                }
            }
            WebEventKind::Page { .. } => {}
        }

        Ok(())
    }
}

impl Default for WebEventConverter {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn derive_topic_and_type(kind: &WebEventKind) -> (&'static str, String) {
    match kind {
        WebEventKind::Track { event, .. } => ("tracks", event.clone()),
        WebEventKind::Page { name, .. } => {
            let etype = name.as_deref().unwrap_or("pageview").to_owned();
            ("pages", etype)
        }
        WebEventKind::Identify { .. } => ("identifies", "identify".to_owned()),
        WebEventKind::Group { .. } => ("groups", "group".to_owned()),
    }
}

/// Merge properties/traits with flattened context into a single payload.
fn build_payload(incoming: &IncomingWebEvent) -> Value {
    let mut payload = serde_json::Map::new();

    let props = match &incoming.kind {
        WebEventKind::Track { properties, .. } | WebEventKind::Page { properties, .. } => {
            properties.clone()
        }
        WebEventKind::Identify { traits, .. } | WebEventKind::Group { traits, .. } => {
            traits.clone()
        }
    };

    if let Some(Value::Object(map)) = props {
        for (k, v) in map {
            payload.insert(k, v);
        }
    }

    if let Some(ctx) = &incoming.context {
        if let Ok(Value::Object(ctx_map)) = serde_json::to_value(ctx) {
            payload.insert("_context".to_owned(), Value::Object(ctx_map));
        }
    }

    if let Some(mid) = &incoming.message_id {
        payload.insert("_message_id".to_owned(), Value::String(mid.clone()));
    }

    if payload.is_empty() {
        Value::Null
    } else {
        Value::Object(payload)
    }
}

/// Add entity refs for user, session, and group.
fn attach_entity_refs(mut builder: EventBuilder, incoming: &IncomingWebEvent) -> EventBuilder {
    if let Some(uid) = &incoming.user_id {
        builder = builder.entity("user", uid.clone());
    }
    if let Some(anon) = &incoming.anonymous_id {
        builder = builder.entity("anonymous_user", anon.clone());
    }

    if let Some(ctx) = &incoming.context {
        if let Some(sid) = &ctx.session_id {
            builder = builder.entity("session", sid.clone());
        }
    }

    if let WebEventKind::Group { group_id, .. } = &incoming.kind {
        builder = builder.entity("group", group_id.clone());
    }

    builder
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::WebContext;

    fn converter() -> WebEventConverter {
        WebEventConverter::new()
    }

    #[test]
    fn track_event_basic() {
        let incoming = IncomingWebEvent {
            message_id: Some("msg_1".into()),
            anonymous_id: Some("anon_abc".into()),
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Track {
                event: "button_clicked".into(),
                properties: Some(serde_json::json!({"button": "signup"})),
            },
        };

        let event = converter().convert(&incoming, "org_1").unwrap();
        assert_eq!(event.source.as_str(), "web");
        assert_eq!(event.topic.as_str(), "tracks");
        assert_eq!(event.event_type.as_str(), "button_clicked");
        assert!(event
            .entity_refs
            .iter()
            .any(|r| r.entity_type.as_str() == "anonymous_user"));
        assert!(event.payload.is_some());
    }

    #[test]
    fn page_event_defaults_to_pageview() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("anon_1".into()),
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Page {
                name: None,
                properties: None,
            },
        };

        let event = converter().convert(&incoming, "org_1").unwrap();
        assert_eq!(event.topic.as_str(), "pages");
        assert_eq!(event.event_type.as_str(), "pageview");
    }

    #[test]
    fn identify_creates_user_entity() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("anon_old".into()),
            user_id: Some("user_42".into()),
            timestamp: None,
            context: None,
            kind: WebEventKind::Identify {
                traits: Some(serde_json::json!({"name": "Alice", "plan": "pro"})),
            },
        };

        let event = converter().convert(&incoming, "org_1").unwrap();
        assert_eq!(event.topic.as_str(), "identifies");
        assert!(event
            .entity_refs
            .iter()
            .any(|r| r.entity_type.as_str() == "user" && r.entity_id.as_str() == "user_42"));
        assert!(event
            .entity_refs
            .iter()
            .any(|r| r.entity_type.as_str() == "anonymous_user"
                && r.entity_id.as_str() == "anon_old"));
    }

    #[test]
    fn group_creates_group_entity() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: None,
            user_id: Some("user_1".into()),
            timestamp: None,
            context: None,
            kind: WebEventKind::Group {
                group_id: "grp_acme".into(),
                traits: Some(serde_json::json!({"company": "Acme Inc"})),
            },
        };

        let event = converter().convert(&incoming, "org_1").unwrap();
        assert_eq!(event.topic.as_str(), "groups");
        assert!(event
            .entity_refs
            .iter()
            .any(|r| r.entity_type.as_str() == "group" && r.entity_id.as_str() == "grp_acme"));
    }

    #[test]
    fn session_id_from_context() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("anon_1".into()),
            user_id: None,
            timestamp: None,
            context: Some(WebContext {
                session_id: Some("sess_xyz".into()),
                ..WebContext::default()
            }),
            kind: WebEventKind::Track {
                event: "scroll".into(),
                properties: None,
            },
        };

        let event = converter().convert(&incoming, "org_1").unwrap();
        assert!(event
            .entity_refs
            .iter()
            .any(|r| r.entity_type.as_str() == "session" && r.entity_id.as_str() == "sess_xyz"));
    }

    #[test]
    fn rejects_missing_identity() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: None,
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Track {
                event: "oops".into(),
                properties: None,
            },
        };

        assert!(converter().convert(&incoming, "org_1").is_err());
    }

    #[test]
    fn rejects_empty_track_name() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("a".into()),
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Track {
                event: String::new(),
                properties: None,
            },
        };

        assert!(converter().convert(&incoming, "org_1").is_err());
    }

    #[test]
    fn rejects_identify_without_user_id() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("anon".into()),
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Identify { traits: None },
        };

        assert!(converter().convert(&incoming, "org_1").is_err());
    }

    #[test]
    fn rejects_empty_group_id() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("a".into()),
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Group {
                group_id: String::new(),
                traits: None,
            },
        };

        assert!(converter().convert(&incoming, "org_1").is_err());
    }

    #[test]
    fn batch_partial_success() {
        let good = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("a".into()),
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Track {
                event: "ok".into(),
                properties: None,
            },
        };
        let bad = IncomingWebEvent {
            message_id: None,
            anonymous_id: None,
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Track {
                event: "missing_identity".into(),
                properties: None,
            },
        };

        let results = converter().convert_batch(&[good, bad], "org_1");
        assert_eq!(results.len(), 2);
        assert!(results[0].is_ok());
        assert!(results[1].is_err());
    }

    #[test]
    fn message_id_in_payload() {
        let incoming = IncomingWebEvent {
            message_id: Some("hookdeck_123".into()),
            anonymous_id: Some("a".into()),
            user_id: None,
            timestamp: None,
            context: None,
            kind: WebEventKind::Track {
                event: "test".into(),
                properties: None,
            },
        };

        let event = converter().convert(&incoming, "org_1").unwrap();
        let payload = event.payload.unwrap();
        assert_eq!(payload["_message_id"], "hookdeck_123");
    }

    #[test]
    fn context_nested_in_payload() {
        let incoming = IncomingWebEvent {
            message_id: None,
            anonymous_id: Some("a".into()),
            user_id: None,
            timestamp: None,
            context: Some(WebContext {
                user_agent: Some("TestAgent/1.0".into()),
                ..WebContext::default()
            }),
            kind: WebEventKind::Track {
                event: "test".into(),
                properties: Some(serde_json::json!({"key": "val"})),
            },
        };

        let event = converter().convert(&incoming, "org_1").unwrap();
        let payload = event.payload.unwrap();
        assert_eq!(payload["key"], "val");
        assert_eq!(payload["_context"]["user_agent"], "TestAgent/1.0");
    }
}
