//! EventEnvelope Builder
//!
//! Builder for constructing EventEnvelope during field mapping.

use chrono::{DateTime, Utc};

use chronicle_domain::{Actor, ActorType, EventEnvelope, PiiFlags, Subject, TenantId};

/// Builder for constructing EventEnvelope during mapping
pub struct EventEnvelopeBuilder {
    tenant_id: TenantId,
    source: String,
    source_event_id: Option<String>,
    event_type: String,
    subject: Subject,
    actor: Actor,
    occurred_at: Option<DateTime<Utc>>,
    payload: Option<Box<serde_json::value::RawValue>>,
    pii: PiiFlags,
}

impl EventEnvelopeBuilder {
    pub fn new(tenant_id: TenantId, source: String, event_type: String) -> Self {
        Self {
            tenant_id,
            source,
            source_event_id: None,
            event_type,
            subject: Subject::new("default"),
            actor: Actor::system(),
            occurred_at: None,
            payload: None,
            pii: PiiFlags::none(),
        }
    }

    pub fn with_source_event_id(mut self, id: String) -> Self {
        self.source_event_id = Some(id);
        self
    }

    pub fn with_event_type(mut self, event_type: String) -> Self {
        self.event_type = event_type;
        self
    }

    pub fn with_occurred_at(mut self, ts: DateTime<Utc>) -> Self {
        self.occurred_at = Some(ts);
        self
    }

    pub fn with_subject_conversation(mut self, id: String) -> Self {
        self.subject = Subject::new(id);
        self
    }

    pub fn with_subject_customer(mut self, id: String) -> Self {
        self.subject = self.subject.with_customer(id);
        self
    }

    pub fn with_subject_ticket(mut self, id: String) -> Self {
        self.subject = self.subject.with_ticket(id);
        self
    }

    pub fn with_actor_type(mut self, actor_type: String) -> Self {
        self.actor = match actor_type.to_lowercase().as_str() {
            "customer" | "user" => Actor::customer("unknown"),
            "agent" | "admin" => Actor::agent("unknown"),
            "system" | "bot" => Actor::system(),
            _ => Actor::system(),
        };
        self
    }

    pub fn with_actor_id(mut self, id: String) -> Self {
        self.actor = match self.actor.actor_type {
            ActorType::Customer => Actor::customer(id),
            ActorType::Agent => Actor::agent(id),
            ActorType::System | ActorType::Bot => Actor::system(),
        };
        self
    }

    pub fn with_actor_name(mut self, name: String) -> Self {
        self.actor = self.actor.with_name(name);
        self
    }

    pub fn with_pii(mut self, pii: PiiFlags) -> Self {
        self.pii = pii;
        self
    }

    pub fn with_payload(mut self, payload: Box<serde_json::value::RawValue>) -> Self {
        self.payload = Some(payload);
        self
    }

    pub fn build(self) -> EventEnvelope {
        let source_event_id = self
            .source_event_id
            .unwrap_or_else(|| chronicle_domain::new_event_id().to_string());

        let payload = self
            .payload
            .unwrap_or_else(|| serde_json::value::RawValue::from_string("{}".to_string()).unwrap());

        EventEnvelope::new(
            self.tenant_id,
            self.source,
            source_event_id,
            self.event_type,
            self.subject,
            self.actor,
            payload,
        )
        .with_occurred_at(self.occurred_at.unwrap_or_else(Utc::now))
        .with_pii(self.pii)
    }
}
