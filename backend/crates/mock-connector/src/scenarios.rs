//! Pre-built Conversation Scenarios
//!
//! Provides realistic multi-event conversation sequences for demos and testing.

use chrono::{Duration, Utc};

use chronicle_domain::{Actor, EventEnvelope};

use crate::{MockEventGenerator, MockOAuthConnection, MockService};

/// A complete conversation scenario with multiple events
pub struct ConversationScenario {
    pub name: String,
    pub description: String,
    pub events: Vec<EventEnvelope>,
}

/// Generate a refund request scenario
pub fn refund_request_scenario(tenant_id: &str) -> ConversationScenario {
    let conn = MockOAuthConnection::new(tenant_id, MockService::MockZendesk);
    let mut gen = MockEventGenerator::new(conn);
    let conv_id = "conv_refund_001";
    let customer_id = "cust_jane_doe";
    let agent_id = "agent_sarah";

    let base_time = Utc::now() - Duration::hours(2);
    let mut events = vec![];

    // Customer opens ticket
    events.push(
        gen.customer_message(
            conv_id,
            customer_id,
            "Hi, I received my order but the item is damaged. I'd like a refund please.",
        )
        .with_occurred_at(base_time),
    );

    // System assigns to agent
    events.push(
        gen.assignee_change(conv_id, None, agent_id, Actor::system())
            .with_occurred_at(base_time + Duration::minutes(2)),
    );

    // LLM suggests response
    events.push(
        gen.llm_suggestion(
            conv_id,
            "Apologize for the damaged item and offer immediate refund",
            0.92,
        )
        .with_occurred_at(base_time + Duration::minutes(3)),
    );

    // Agent responds
    events.push(
        gen.agent_message(
            conv_id,
            agent_id,
            "Sarah",
            "I'm so sorry to hear your item arrived damaged! I can process a full refund for you right away. Could you please confirm the order number?",
        )
        .with_occurred_at(base_time + Duration::minutes(5)),
    );

    // Tag applied
    events.push(
        gen.tag_applied(conv_id, "refund_request", Actor::agent(agent_id))
            .with_occurred_at(base_time + Duration::minutes(5)),
    );

    // Customer replies
    events.push(
        gen.customer_message(
            conv_id,
            customer_id,
            "Yes, my order number is #12345. Thank you!",
        )
        .with_occurred_at(base_time + Duration::minutes(20)),
    );

    // Agent internal note
    events.push(
        gen.internal_note(
            conv_id,
            agent_id,
            "Processing refund for order #12345, damaged item",
        )
        .with_occurred_at(base_time + Duration::minutes(22)),
    );

    // Agent confirms refund
    events.push(
        gen.agent_message(
            conv_id,
            agent_id,
            "Sarah",
            "I've processed your refund of $49.99. You should see it in your account within 3-5 business days. Is there anything else I can help you with?",
        )
        .with_occurred_at(base_time + Duration::minutes(25)),
    );

    // Status change
    events.push(
        gen.status_change(conv_id, "open", "pending", Actor::agent(agent_id))
            .with_occurred_at(base_time + Duration::minutes(25)),
    );

    // Customer thanks
    events.push(
        gen.customer_message(
            conv_id,
            customer_id,
            "That's all, thank you so much for your help!",
        )
        .with_occurred_at(base_time + Duration::minutes(45)),
    );

    // Resolve
    events.push(
        gen.status_change(conv_id, "pending", "solved", Actor::agent(agent_id))
            .with_occurred_at(base_time + Duration::minutes(46)),
    );

    ConversationScenario {
        name: "Refund Request".to_string(),
        description: "Customer requests refund for damaged item, agent processes it quickly"
            .to_string(),
        events,
    }
}

/// Generate an escalation scenario
pub fn escalation_scenario(tenant_id: &str) -> ConversationScenario {
    let conn = MockOAuthConnection::new(tenant_id, MockService::MockZendesk);
    let mut gen = MockEventGenerator::new(conn);
    let conv_id = "conv_escalation_001";
    let customer_id = "cust_angry_bob";
    let agent_id = "agent_mike";
    let senior_agent_id = "agent_senior_lisa";

    let base_time = Utc::now() - Duration::hours(4);
    let mut events = vec![];

    // Initial complaint
    events.push(
        gen.customer_message(
            conv_id,
            customer_id,
            "This is unacceptable! I've been waiting 2 weeks for my order and no one is helping me!",
        )
        .with_occurred_at(base_time),
    );

    // Assign to agent
    events.push(
        gen.assignee_change(conv_id, None, agent_id, Actor::system())
            .with_occurred_at(base_time + Duration::minutes(1)),
    );

    // Tag
    events.push(
        gen.tag_applied(conv_id, "urgent", Actor::system())
            .with_occurred_at(base_time + Duration::minutes(1)),
    );

    // Agent response
    events.push(
        gen.agent_message(
            conv_id,
            agent_id,
            "Mike",
            "I apologize for the delay. Let me look into your order status right away.",
        )
        .with_occurred_at(base_time + Duration::minutes(3)),
    );

    // Customer still upset
    events.push(
        gen.customer_message(
            conv_id,
            customer_id,
            "I want to speak to a manager. This is the third time I've contacted support!",
        )
        .with_occurred_at(base_time + Duration::minutes(10)),
    );

    // Internal note
    events.push(
        gen.internal_note(
            conv_id,
            agent_id,
            "Customer is very frustrated, shipping shows package lost in transit. Escalating.",
        )
        .with_occurred_at(base_time + Duration::minutes(12)),
    );

    // Escalation
    events.push(
        gen.escalation(
            conv_id,
            "Customer requesting manager, package lost in transit",
            Actor::agent(agent_id),
        )
        .with_occurred_at(base_time + Duration::minutes(13)),
    );

    // Reassign to senior
    events.push(
        gen.assignee_change(
            conv_id,
            Some(agent_id),
            senior_agent_id,
            Actor::agent(agent_id),
        )
        .with_occurred_at(base_time + Duration::minutes(14)),
    );

    // Senior agent responds
    events.push(
        gen.agent_message(
            conv_id,
            senior_agent_id,
            "Lisa (Senior Support)",
            "Hi, I'm Lisa from our senior support team. I've reviewed your case and I'm truly sorry for this experience. I'm going to expedite a replacement shipment at no extra cost, and add a $20 credit to your account for the inconvenience.",
        )
        .with_occurred_at(base_time + Duration::minutes(20)),
    );

    // LLM suggestion
    events.push(
        gen.llm_suggestion(
            conv_id,
            "Consider offering expedited shipping and a discount on next order",
            0.88,
        )
        .with_occurred_at(base_time + Duration::minutes(20)),
    );

    // Customer responds
    events.push(
        gen.customer_message(
            conv_id,
            customer_id,
            "Thank you Lisa, I appreciate you taking care of this. When can I expect the replacement?",
        )
        .with_occurred_at(base_time + Duration::minutes(35)),
    );

    // Final resolution
    events.push(
        gen.agent_message(
            conv_id,
            senior_agent_id,
            "Lisa (Senior Support)",
            "Your replacement is being shipped today with overnight delivery. You'll receive a tracking number within the hour. Thank you for your patience!",
        )
        .with_occurred_at(base_time + Duration::minutes(40)),
    );

    events.push(
        gen.status_change(conv_id, "open", "solved", Actor::agent(senior_agent_id))
            .with_occurred_at(base_time + Duration::minutes(41)),
    );

    ConversationScenario {
        name: "Escalation to Senior Support".to_string(),
        description: "Frustrated customer escalated to senior agent, resolved with compensation"
            .to_string(),
        events,
    }
}

/// Generate a simple question scenario
pub fn simple_question_scenario(tenant_id: &str) -> ConversationScenario {
    let conn = MockOAuthConnection::new(tenant_id, MockService::MockZendesk);
    let mut gen = MockEventGenerator::new(conn);
    let conv_id = "conv_simple_001";
    let customer_id = "cust_alice";
    let agent_id = "agent_tom";

    let base_time = Utc::now() - Duration::minutes(30);
    let events = vec![
        gen.customer_message(conv_id, customer_id, "Do you ship to Canada?")
            .with_occurred_at(base_time),
        gen.assignee_change(conv_id, None, agent_id, Actor::system())
            .with_occurred_at(base_time + Duration::minutes(1)),
        gen.agent_message(
            conv_id,
            agent_id,
            "Tom",
            "Yes! We ship to Canada. Standard shipping is $12.99 and takes 7-10 business days. Express shipping is $24.99 and takes 3-5 business days.",
        )
        .with_occurred_at(base_time + Duration::minutes(3)),
        gen.customer_message(conv_id, customer_id, "Great, thanks!")
            .with_occurred_at(base_time + Duration::minutes(5)),
        gen.status_change(conv_id, "open", "solved", Actor::agent(agent_id))
            .with_occurred_at(base_time + Duration::minutes(6)),
    ];

    ConversationScenario {
        name: "Simple Question".to_string(),
        description: "Quick shipping question answered promptly".to_string(),
        events,
    }
}

/// Get all available scenarios
pub fn all_scenarios(tenant_id: &str) -> Vec<ConversationScenario> {
    vec![
        refund_request_scenario(tenant_id),
        escalation_scenario(tenant_id),
        simple_question_scenario(tenant_id),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_refund_scenario() {
        let scenario = refund_request_scenario("test_tenant");

        assert!(!scenario.events.is_empty());
        assert!(scenario.events.len() > 5);

        // Check events are properly ordered
        for window in scenario.events.windows(2) {
            assert!(window[0].occurred_at <= window[1].occurred_at);
        }
    }

    #[test]
    fn test_all_scenarios() {
        let scenarios = all_scenarios("test_tenant");

        assert_eq!(scenarios.len(), 3);

        for scenario in scenarios {
            assert!(!scenario.events.is_empty());
            assert!(!scenario.name.is_empty());
        }
    }
}
