// Chronicle event graph schema for HelixDB.
//
// Postgres remains the canonical event store in phase 1. Helix holds a
// graph-oriented read model: mirrored event envelope/raw payload nodes,
// typed payload family nodes, entity/link edges, and event/trace vectors.

N::Event {
    UNIQUE INDEX external_id: String,
    INDEX org_id: String,
    INDEX source: String,
    INDEX topic: String,
    INDEX event_type: String,
    event_time: Date,
    ingestion_time: Date,
    actor_type: String DEFAULT "",
    actor_id: String DEFAULT "",
    raw_body: String DEFAULT ""
}

N::RawPayload {
    UNIQUE INDEX raw_event_external_id: String,
    INDEX org_id: String,
    payload_text: String,
    source_event_type: String,
    schema_fingerprint: String,
    mirrored_at: Date DEFAULT NOW
}

N::GenericPayload {
    UNIQUE INDEX generic_event_external_id: String,
    INDEX org_id: String,
    payload_text: String,
    source_event_type: String,
    schema_fingerprint: String,
    first_seen_at: Date DEFAULT NOW
}

N::StripePaymentPayload {
    UNIQUE INDEX stripe_event_external_id: String,
    INDEX org_id: String,
    amount: F64,
    currency: String,
    status: String,
    customer_id: String,
    payment_intent_id: String DEFAULT ""
}

N::IntercomConversationPayload {
    UNIQUE INDEX intercom_event_external_id: String,
    INDEX org_id: String,
    conversation_id: String,
    message: String,
    rating: U8 DEFAULT 0,
    assignee_id: String DEFAULT ""
}

N::ZendeskTicketPayload {
    UNIQUE INDEX zendesk_event_external_id: String,
    INDEX org_id: String,
    ticket_id: String,
    subject: String,
    priority: String DEFAULT "",
    status: String DEFAULT "",
    requester_id: String DEFAULT ""
}

N::Entity {
    UNIQUE INDEX scoped_entity_key: String,
    INDEX org_id: String,
    INDEX entity_type: String,
    INDEX entity_id: String
}

N::Trace {
    UNIQUE INDEX trace_key: String,
    INDEX org_id: String,
    INDEX trace_type: String,
    start_time: Date,
    end_time: Date,
    event_count: U32,
    status: String DEFAULT "open",
    structural_signature: String DEFAULT ""
}

V::EventEmbedding {
    UNIQUE INDEX embedding_event_external_id: String,
    org_id: String,
    source: String,
    embedded_text: String,
    model_version: String
}

V::TraceEmbedding {
    UNIQUE INDEX trace_embedding_key: String,
    org_id: String,
    trace_type: String,
    embedded_text: String,
    model_version: String
}

E::HasRawPayload {
    From: Event,
    To: RawPayload,
    Properties: {
        created_at: Date DEFAULT NOW
    }
}

E::HasGenericPayload {
    From: Event,
    To: GenericPayload,
    Properties: {
        created_at: Date DEFAULT NOW
    }
}

E::HasStripePaymentPayload {
    From: Event,
    To: StripePaymentPayload,
    Properties: {
        created_at: Date DEFAULT NOW
    }
}

E::HasIntercomConversationPayload {
    From: Event,
    To: IntercomConversationPayload,
    Properties: {
        created_at: Date DEFAULT NOW
    }
}

E::HasZendeskTicketPayload {
    From: Event,
    To: ZendeskTicketPayload,
    Properties: {
        created_at: Date DEFAULT NOW
    }
}

E::RefersTo {
    From: Event,
    To: Entity,
    Properties: {
        created_by: String,
        created_at: Date DEFAULT NOW
    }
}

E::CausalLink {
    From: Event,
    To: Event,
    Properties: {
        link_type: String,
        confidence: F64,
        reasoning: String,
        created_by: String,
        created_at: Date DEFAULT NOW
    }
}

E::ContainsEvent {
    From: Trace,
    To: Event,
    Properties: {
        position: U32,
        created_at: Date DEFAULT NOW
    }
}

E::HasEmbedding {
    From: Event,
    To: EventEmbedding,
    Properties: {
        created_at: Date DEFAULT NOW
    }
}

E::HasTraceEmbedding {
    From: Trace,
    To: TraceEmbedding,
    Properties: {
        created_at: Date DEFAULT NOW
    }
}
