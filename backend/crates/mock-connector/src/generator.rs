//! Mock Event Generator
//!
//! Generates realistic support events for testing and demos.

use chrono::{Duration, Utc};
use rand::seq::SliceRandom;
use rand::Rng;
use serde_json::json;

use chronicle_domain::{
    Actor, EventEnvelope, EventEnvelopeBuilder, Permissions, PiiFlags, Subject, TenantId,
};

use crate::MockOAuthConnection;

/// Event generator for creating realistic support events
pub struct MockEventGenerator {
    /// Connection this generator is associated with
    pub connection: MockOAuthConnection,
    /// Counter for generating sequential IDs
    event_counter: u64,
}

impl MockEventGenerator {
    pub fn new(connection: MockOAuthConnection) -> Self {
        Self {
            connection,
            event_counter: 0,
        }
    }

    fn next_event_id(&mut self) -> String {
        self.event_counter += 1;
        format!(
            "{}_{}_{}",
            self.connection.service.as_str(),
            self.connection.connection_id,
            self.event_counter
        )
    }

    /// Generate a customer message event
    pub fn customer_message(
        &mut self,
        conversation_id: &str,
        customer_id: &str,
        message: &str,
    ) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "support.message.customer",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id).with_customer(customer_id))
        .actor(Actor::customer(customer_id).with_name("Customer"))
        .payload(&json!({
            "text": message,
            "channel": "email",
            "html": format!("<p>{}</p>", message),
        }))
        .unwrap()
        .pii(PiiFlags::with_fields(vec!["payload.text".to_string()]))
        .build()
    }

    /// Generate an agent message event
    pub fn agent_message(
        &mut self,
        conversation_id: &str,
        agent_id: &str,
        agent_name: &str,
        message: &str,
    ) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "support.message.agent",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id))
        .actor(Actor::agent(agent_id).with_name(agent_name))
        .payload(&json!({
            "text": message,
            "channel": "email",
            "is_public": true,
        }))
        .unwrap()
        .build()
    }

    /// Generate an internal note event
    pub fn internal_note(
        &mut self,
        conversation_id: &str,
        agent_id: &str,
        note: &str,
    ) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "support.note.internal",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id))
        .actor(Actor::agent(agent_id))
        .payload(&json!({
            "text": note,
            "is_internal": true,
        }))
        .unwrap()
        .permissions(Permissions::internal())
        .build()
    }

    /// Generate a ticket status change event
    pub fn status_change(
        &mut self,
        conversation_id: &str,
        old_status: &str,
        new_status: &str,
        actor: Actor,
    ) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "ticket.status_changed",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id))
        .actor(actor)
        .payload(&json!({
            "old_status": old_status,
            "new_status": new_status,
        }))
        .unwrap()
        .build()
    }

    /// Generate a tag applied event
    pub fn tag_applied(&mut self, conversation_id: &str, tag: &str, actor: Actor) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "ticket.tag_applied",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id))
        .actor(actor)
        .payload(&json!({
            "tag": tag,
        }))
        .unwrap()
        .build()
    }

    /// Generate an assignee change event
    pub fn assignee_change(
        &mut self,
        conversation_id: &str,
        old_assignee: Option<&str>,
        new_assignee: &str,
        actor: Actor,
    ) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "ticket.assignee_changed",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id))
        .actor(actor)
        .payload(&json!({
            "old_assignee": old_assignee,
            "new_assignee": new_assignee,
        }))
        .unwrap()
        .build()
    }

    /// Generate an escalation event
    pub fn escalation(
        &mut self,
        conversation_id: &str,
        reason: &str,
        actor: Actor,
    ) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "escalation.created",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id))
        .actor(actor)
        .payload(&json!({
            "reason": reason,
            "priority": "high",
        }))
        .unwrap()
        .build()
    }

    /// Generate an LLM suggestion event (tool output)
    pub fn llm_suggestion(
        &mut self,
        conversation_id: &str,
        suggestion: &str,
        confidence: f64,
    ) -> EventEnvelope {
        let source_event_id = self.next_event_id();

        EventEnvelopeBuilder::new(
            self.connection.tenant_id.clone(),
            self.connection.service.as_str(),
            "tool.llm_suggestion",
        )
        .source_event_id(&source_event_id)
        .subject(Subject::new(conversation_id))
        .actor(Actor::system())
        .payload(&json!({
            "suggestion": suggestion,
            "confidence": confidence,
            "model": "gpt-4",
        }))
        .unwrap()
        .permissions(Permissions::internal())
        .build()
    }
}

/// Generate a batch of random events for testing
pub fn generate_random_events(tenant_id: impl Into<TenantId>, count: usize) -> Vec<EventEnvelope> {
    let tenant_id = tenant_id.into();
    let conn = MockOAuthConnection::new(tenant_id.clone(), crate::MockService::MockZendesk);
    let mut generator = MockEventGenerator::new(conn);

    let mut rng = rand::thread_rng();
    let mut events = Vec::with_capacity(count);
    let base_time = Utc::now() - Duration::hours(1);

    let customer_messages = [
        "Hi, I need help with my order",
        "The product arrived damaged",
        "Can I get a refund?",
        "Thanks for your help!",
        "I'm still waiting for a response",
    ];

    let agent_messages = [
        "Hi! I'd be happy to help you with that.",
        "Let me look into this for you.",
        "I've processed your refund.",
        "Is there anything else I can help with?",
        "I'm escalating this to our specialist team.",
    ];

    for i in 0..count {
        let conv_id = format!("conv_{}", rng.gen_range(1..=5));
        let offset = Duration::seconds(rng.gen_range(0..3600) + (i as i64 * 10));
        let occurred_at = base_time + offset;

        let event = match rng.gen_range(0..6) {
            0 => {
                let msg = customer_messages.choose(&mut rng).unwrap();
                generator
                    .customer_message(&conv_id, "cust_1", msg)
                    .with_occurred_at(occurred_at)
            }
            1 => {
                let msg = agent_messages.choose(&mut rng).unwrap();
                generator
                    .agent_message(&conv_id, "agent_1", "Sarah", msg)
                    .with_occurred_at(occurred_at)
            }
            2 => generator
                .status_change(&conv_id, "open", "pending", Actor::agent("agent_1"))
                .with_occurred_at(occurred_at),
            3 => generator
                .tag_applied(&conv_id, "billing", Actor::system())
                .with_occurred_at(occurred_at),
            4 => generator
                .internal_note(&conv_id, "agent_1", "Customer seems frustrated")
                .with_occurred_at(occurred_at),
            _ => generator
                .llm_suggestion(&conv_id, "Offer a discount", 0.85)
                .with_occurred_at(occurred_at),
        };

        events.push(event);
    }

    // Sort by occurred_at for realistic ordering
    events.sort_by(|a, b| a.occurred_at.cmp(&b.occurred_at));
    events
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MockService;

    #[test]
    fn test_generator_creates_events() {
        let conn = MockOAuthConnection::new("tenant_1", MockService::MockZendesk);
        let mut gen = MockEventGenerator::new(conn);

        let event = gen.customer_message("conv_1", "cust_1", "Hello!");

        assert_eq!(event.tenant_id.as_str(), "tenant_1");
        assert_eq!(event.event_type, "support.message.customer");
        assert!(event.pii.contains_pii);
    }

    #[test]
    fn test_unique_event_ids() {
        let conn = MockOAuthConnection::new("tenant_1", MockService::MockZendesk);
        let mut gen = MockEventGenerator::new(conn);

        let e1 = gen.customer_message("c1", "cust_1", "msg1");
        let e2 = gen.customer_message("c1", "cust_1", "msg2");

        assert_ne!(e1.source_event_id, e2.source_event_id);
    }

    #[test]
    fn test_random_events() {
        let events = generate_random_events("tenant_1", 10);

        assert_eq!(events.len(), 10);
        // Events should be sorted by occurred_at
        for window in events.windows(2) {
            assert!(window[0].occurred_at <= window[1].occurred_at);
        }
    }
}
