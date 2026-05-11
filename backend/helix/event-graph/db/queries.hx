QUERY UpsertEvent(
    external_id: String,
    org_id: String,
    source: String,
    topic: String,
    event_type: String,
    event_time: Date,
    ingestion_time: Date,
    actor_type: String,
    actor_id: String,
    raw_body: String
) =>
    existing <- N<Event>::WHERE(_::{external_id}::EQ(external_id))
    event <- existing::UpsertN({
        external_id: external_id,
        org_id: org_id,
        source: source,
        topic: topic,
        event_type: event_type,
        event_time: event_time,
        ingestion_time: ingestion_time,
        actor_type: actor_type,
        actor_id: actor_id,
        raw_body: raw_body
    })
    RETURN event::{
        eventID: ID,
        ..
    }

QUERY GetEventByExternalId(external_id: String) =>
    event <- N<Event>::WHERE(_::{external_id}::EQ(external_id))
    RETURN event::{
        eventID: ID,
        ..
    }

QUERY UpsertRawPayload(
    event_external_id: String,
    org_id: String,
    payload_text: String,
    source_event_type: String,
    schema_fingerprint: String,
    mirrored_at: Date
) =>
    existing <- N<RawPayload>::WHERE(_::{raw_event_external_id}::EQ(event_external_id))
    payload <- existing::UpsertN({
        raw_event_external_id: event_external_id,
        org_id: org_id,
        payload_text: payload_text,
        source_event_type: source_event_type,
        schema_fingerprint: schema_fingerprint,
        mirrored_at: mirrored_at
    })
    RETURN payload::{
        payloadID: ID,
        ..
    }

QUERY UpsertGenericPayload(
    event_external_id: String,
    org_id: String,
    payload_text: String,
    source_event_type: String,
    schema_fingerprint: String,
    first_seen_at: Date
) =>
    existing <- N<GenericPayload>::WHERE(_::{generic_event_external_id}::EQ(event_external_id))
    payload <- existing::UpsertN({
        generic_event_external_id: event_external_id,
        org_id: org_id,
        payload_text: payload_text,
        source_event_type: source_event_type,
        schema_fingerprint: schema_fingerprint,
        first_seen_at: first_seen_at
    })
    RETURN payload::{
        payloadID: ID,
        ..
    }

QUERY UpsertStripePaymentPayload(
    event_external_id: String,
    org_id: String,
    amount: F64,
    currency: String,
    status: String,
    customer_id: String,
    payment_intent_id: String
) =>
    existing <- N<StripePaymentPayload>::WHERE(_::{stripe_event_external_id}::EQ(event_external_id))
    payload <- existing::UpsertN({
        stripe_event_external_id: event_external_id,
        org_id: org_id,
        amount: amount,
        currency: currency,
        status: status,
        customer_id: customer_id,
        payment_intent_id: payment_intent_id
    })
    RETURN payload::{
        payloadID: ID,
        ..
    }

QUERY UpsertIntercomConversationPayload(
    event_external_id: String,
    org_id: String,
    conversation_id: String,
    message: String,
    rating: U8,
    assignee_id: String
) =>
    existing <- N<IntercomConversationPayload>::WHERE(_::{intercom_event_external_id}::EQ(event_external_id))
    payload <- existing::UpsertN({
        intercom_event_external_id: event_external_id,
        org_id: org_id,
        conversation_id: conversation_id,
        message: message,
        rating: rating,
        assignee_id: assignee_id
    })
    RETURN payload::{
        payloadID: ID,
        ..
    }

QUERY UpsertZendeskTicketPayload(
    event_external_id: String,
    org_id: String,
    ticket_id: String,
    subject: String,
    priority: String,
    status: String,
    requester_id: String
) =>
    existing <- N<ZendeskTicketPayload>::WHERE(_::{zendesk_event_external_id}::EQ(event_external_id))
    payload <- existing::UpsertN({
        zendesk_event_external_id: event_external_id,
        org_id: org_id,
        ticket_id: ticket_id,
        subject: subject,
        priority: priority,
        status: status,
        requester_id: requester_id
    })
    RETURN payload::{
        payloadID: ID,
        ..
    }

QUERY LinkEventToRawPayload(event_id: ID, payload_id: ID, created_at: Date) =>
    event <- N<Event>(event_id)
    payload <- N<RawPayload>(payload_id)
    existing <- E<HasRawPayload>
    edge <- existing::UpsertE({created_at: created_at})::From(event)::To(payload)
    RETURN edge::{
        edgeID: ID,
        created_at
    }

QUERY LinkEventToGenericPayload(event_id: ID, payload_id: ID, created_at: Date) =>
    event <- N<Event>(event_id)
    payload <- N<GenericPayload>(payload_id)
    existing <- E<HasGenericPayload>
    edge <- existing::UpsertE({created_at: created_at})::From(event)::To(payload)
    RETURN edge::{
        edgeID: ID,
        created_at
    }

QUERY LinkEventToStripePaymentPayload(event_id: ID, payload_id: ID, created_at: Date) =>
    event <- N<Event>(event_id)
    payload <- N<StripePaymentPayload>(payload_id)
    existing <- E<HasStripePaymentPayload>
    edge <- existing::UpsertE({created_at: created_at})::From(event)::To(payload)
    RETURN edge::{
        edgeID: ID,
        created_at
    }

QUERY LinkEventToIntercomConversationPayload(event_id: ID, payload_id: ID, created_at: Date) =>
    event <- N<Event>(event_id)
    payload <- N<IntercomConversationPayload>(payload_id)
    existing <- E<HasIntercomConversationPayload>
    edge <- existing::UpsertE({created_at: created_at})::From(event)::To(payload)
    RETURN edge::{
        edgeID: ID,
        created_at
    }

QUERY LinkEventToZendeskTicketPayload(event_id: ID, payload_id: ID, created_at: Date) =>
    event <- N<Event>(event_id)
    payload <- N<ZendeskTicketPayload>(payload_id)
    existing <- E<HasZendeskTicketPayload>
    edge <- existing::UpsertE({created_at: created_at})::From(event)::To(payload)
    RETURN edge::{
        edgeID: ID,
        created_at
    }

QUERY UpsertEntity(
    scoped_entity_key: String,
    org_id: String,
    entity_type: String,
    entity_id: String
) =>
    existing <- N<Entity>::WHERE(_::{scoped_entity_key}::EQ(scoped_entity_key))
    entity <- existing::UpsertN({
        scoped_entity_key: scoped_entity_key,
        org_id: org_id,
        entity_type: entity_type,
        entity_id: entity_id
    })
    RETURN entity::{
        entityNodeID: ID,
        ..
    }

QUERY LinkEventToEntity(event_id: ID, entity_id: ID, created_by: String, created_at: Date) =>
    event <- N<Event>(event_id)
    entity <- N<Entity>(entity_id)
    existing <- E<RefersTo>
    edge <- existing::UpsertE({
        created_by: created_by,
        created_at: created_at
    })::From(event)::To(entity)
    RETURN edge::{
        edgeID: ID,
        ..
    }

QUERY SyncEventsBatch(
    events: [{
        external_id: String,
        org_id: String,
        source: String,
        topic: String,
        event_type: String,
        event_time: Date,
        ingestion_time: Date,
        actor_type: String,
        actor_id: String,
        raw_body: String,
        raw_payloads: [{
            payload_text: String,
            source_event_type: String,
            schema_fingerprint: String,
            mirrored_at: Date
        }],
        generic_payloads: [{
            payload_text: String,
            source_event_type: String,
            schema_fingerprint: String,
            first_seen_at: Date,
            created_at: Date
        }],
        stripe_payloads: [{
            amount: F64,
            currency: String,
            status: String,
            customer_id: String,
            payment_intent_id: String,
            created_at: Date
        }],
        intercom_payloads: [{
            conversation_id: String,
            message: String,
            rating: U8,
            assignee_id: String,
            created_at: Date
        }],
        zendesk_payloads: [{
            ticket_id: String,
            subject: String,
            priority: String,
            status: String,
            requester_id: String,
            created_at: Date
        }],
        entity_refs: [{
            scoped_entity_key: String,
            entity_type: String,
            entity_id: String,
            created_by: String,
            created_at: Date
        }]
    }]
) =>
    FOR {external_id, org_id, source, topic, event_type, event_time, ingestion_time, actor_type, actor_id, raw_body, raw_payloads, generic_payloads, stripe_payloads, intercom_payloads, zendesk_payloads, entity_refs} IN events {
        existing_event_nodes <- N<Event>::WHERE(_::{external_id}::EQ(external_id))
        synced_event <- existing_event_nodes::UpsertN({
            external_id: external_id,
            org_id: org_id,
            source: source,
            topic: topic,
            event_type: event_type,
            event_time: event_time,
            ingestion_time: ingestion_time,
            actor_type: actor_type,
            actor_id: actor_id,
            raw_body: raw_body
        })

        FOR {payload_text, source_event_type, schema_fingerprint, mirrored_at} IN raw_payloads {
            existing_raw_payload_nodes <- N<RawPayload>::WHERE(_::{raw_event_external_id}::EQ(external_id))
            synced_raw_payload <- existing_raw_payload_nodes::UpsertN({
                raw_event_external_id: external_id,
                org_id: org_id,
                payload_text: payload_text,
                source_event_type: source_event_type,
                schema_fingerprint: schema_fingerprint,
                mirrored_at: mirrored_at
            })
            raw_payload_edges <- E<HasRawPayload>
            synced_raw_payload_edge <- raw_payload_edges::UpsertE({created_at: mirrored_at})::From(synced_event)::To(synced_raw_payload)
        }

        FOR {payload_text, source_event_type, schema_fingerprint, first_seen_at, created_at} IN generic_payloads {
            existing_generic_payload_nodes <- N<GenericPayload>::WHERE(_::{generic_event_external_id}::EQ(external_id))
            synced_generic_payload <- existing_generic_payload_nodes::UpsertN({
                generic_event_external_id: external_id,
                org_id: org_id,
                payload_text: payload_text,
                source_event_type: source_event_type,
                schema_fingerprint: schema_fingerprint,
                first_seen_at: first_seen_at
            })
            generic_payload_edges <- E<HasGenericPayload>
            synced_generic_payload_edge <- generic_payload_edges::UpsertE({created_at: created_at})::From(synced_event)::To(synced_generic_payload)
        }

        FOR {amount, currency, status, customer_id, payment_intent_id, created_at} IN stripe_payloads {
            existing_stripe_payload_nodes <- N<StripePaymentPayload>::WHERE(_::{stripe_event_external_id}::EQ(external_id))
            synced_stripe_payload <- existing_stripe_payload_nodes::UpsertN({
                stripe_event_external_id: external_id,
                org_id: org_id,
                amount: amount,
                currency: currency,
                status: status,
                customer_id: customer_id,
                payment_intent_id: payment_intent_id
            })
            stripe_payload_edges <- E<HasStripePaymentPayload>
            synced_stripe_payload_edge <- stripe_payload_edges::UpsertE({created_at: created_at})::From(synced_event)::To(synced_stripe_payload)
        }

        FOR {conversation_id, message, rating, assignee_id, created_at} IN intercom_payloads {
            existing_intercom_payload_nodes <- N<IntercomConversationPayload>::WHERE(_::{intercom_event_external_id}::EQ(external_id))
            synced_intercom_payload <- existing_intercom_payload_nodes::UpsertN({
                intercom_event_external_id: external_id,
                org_id: org_id,
                conversation_id: conversation_id,
                message: message,
                rating: rating,
                assignee_id: assignee_id
            })
            intercom_payload_edges <- E<HasIntercomConversationPayload>
            synced_intercom_payload_edge <- intercom_payload_edges::UpsertE({created_at: created_at})::From(synced_event)::To(synced_intercom_payload)
        }

        FOR {ticket_id, subject, priority, status, requester_id, created_at} IN zendesk_payloads {
            existing_zendesk_payload_nodes <- N<ZendeskTicketPayload>::WHERE(_::{zendesk_event_external_id}::EQ(external_id))
            synced_zendesk_payload <- existing_zendesk_payload_nodes::UpsertN({
                zendesk_event_external_id: external_id,
                org_id: org_id,
                ticket_id: ticket_id,
                subject: subject,
                priority: priority,
                status: status,
                requester_id: requester_id
            })
            zendesk_payload_edges <- E<HasZendeskTicketPayload>
            synced_zendesk_payload_edge <- zendesk_payload_edges::UpsertE({created_at: created_at})::From(synced_event)::To(synced_zendesk_payload)
        }

        FOR {scoped_entity_key, entity_type, entity_id, created_by, created_at} IN entity_refs {
            existing_entity_nodes <- N<Entity>::WHERE(_::{scoped_entity_key}::EQ(scoped_entity_key))
            synced_entity <- existing_entity_nodes::UpsertN({
                scoped_entity_key: scoped_entity_key,
                org_id: org_id,
                entity_type: entity_type,
                entity_id: entity_id
            })
            entity_edges <- E<RefersTo>
            synced_entity_edge <- entity_edges::UpsertE({
                created_by: created_by,
                created_at: created_at
            })::From(synced_event)::To(synced_entity)
        }
    }

    RETURN "ok"

QUERY GetEntityRefsForEvent(event_id: ID) =>
    entities <- N<Event>(event_id)::Out<RefersTo>
    RETURN entities::{
        entityNodeID: ID,
        ..
    }

QUERY GetEventsForEntity(scoped_entity_key: String) =>
    entity <- N<Entity>::WHERE(_::{scoped_entity_key}::EQ(scoped_entity_key))
    events <- entity::In<RefersTo>
    RETURN events::{
        eventID: ID,
        ..
    }

QUERY GroupEntityTypes(org_id: String) =>
    entities <- N<Entity>::WHERE(_::{org_id}::EQ(org_id))
    RETURN entities::GROUP_BY(entity_type)

QUERY ListEntitiesByType(org_id: String, entity_type: String, limit: I64) =>
    entities <- N<Entity>::WHERE(
        AND(
            _::{org_id}::EQ(org_id),
            _::{entity_type}::EQ(entity_type)
        )
    )::RANGE(0, limit)
    RETURN entities::{
        entityNodeID: ID,
        ..
    }

QUERY CreateCausalLink(
    source_event_id: ID,
    target_event_id: ID,
    link_type: String,
    confidence: F64,
    reasoning: String,
    created_by: String,
    created_at: Date
) =>
    source <- N<Event>(source_event_id)
    target <- N<Event>(target_event_id)
    existing <- E<CausalLink>
    edge <- existing::UpsertE({
        link_type: link_type,
        confidence: confidence,
        reasoning: reasoning,
        created_by: created_by,
        created_at: created_at
    })::From(source)::To(target)
    RETURN edge::{
        edgeID: ID,
        ..
    }

QUERY GetOutgoingLinkEdgeIds(event_id: ID, min_confidence: F64) =>
    edges <- N<Event>(event_id)::OutE<CausalLink>::WHERE(_::{confidence}::GTE(min_confidence))
    RETURN edges::{
        edgeID: ID,
        ..
    }

QUERY GetIncomingLinkEdgeIds(event_id: ID, min_confidence: F64) =>
    edges <- N<Event>(event_id)::InE<CausalLink>::WHERE(_::{confidence}::GTE(min_confidence))
    RETURN edges::{
        edgeID: ID,
        ..
    }

QUERY GetLinkDetail(edge_id: ID) =>
    edge <- E<CausalLink>(edge_id)
    source <- edge::FromN
    target <- edge::ToN
    RETURN edge::{
        edgeID: ID,
        ..
    }, source::{
        sourceEventID: ID,
        sourceExternalID: external_id,
        sourceOrgID: org_id
    }, target::{
        targetEventID: ID,
        targetExternalID: external_id,
        targetOrgID: org_id
    }

QUERY UpsertEventEmbedding(
    vector: [F64],
    event_external_id: String,
    org_id: String,
    source: String,
    embedded_text: String,
    model_version: String
) =>
    existing <- V<EventEmbedding>::WHERE(_::{embedding_event_external_id}::EQ(event_external_id))
    embedding <- existing::UpsertV(vector, {
        embedding_event_external_id: event_external_id,
        org_id: org_id,
        source: source,
        embedded_text: embedded_text,
        model_version: model_version
    })
    RETURN embedding::{
        embeddingID: ID,
        ..
    }

QUERY LinkEventToEmbedding(event_id: ID, embedding_id: ID, created_at: Date) =>
    event <- N<Event>(event_id)
    embedding <- V<EventEmbedding>(embedding_id)
    existing <- E<HasEmbedding>
    edge <- existing::UpsertE({created_at: created_at})::From(event)::To(embedding)
    RETURN edge::{
        edgeID: ID,
        created_at
    }

QUERY SearchEventEmbeddings(vector: [F64], limit: I64, org_id: String) =>
    searched_embeddings <- SearchV<EventEmbedding>(vector, limit)
    embeddings <- searched_embeddings::WHERE(_::{org_id}::EQ(org_id))
    events <- embeddings::In<HasEmbedding>
    RETURN events::{
        eventID: ID,
        ..
    }

QUERY UpsertTrace(
    trace_key: String,
    org_id: String,
    trace_type: String,
    start_time: Date,
    end_time: Date,
    event_count: U32,
    status: String,
    structural_signature: String
) =>
    existing <- N<Trace>::WHERE(_::{trace_key}::EQ(trace_key))
    trace <- existing::UpsertN({
        trace_key: trace_key,
        org_id: org_id,
        trace_type: trace_type,
        start_time: start_time,
        end_time: end_time,
        event_count: event_count,
        status: status,
        structural_signature: structural_signature
    })
    RETURN trace::{
        traceID: ID,
        ..
    }

QUERY LinkTraceToEvent(trace_id: ID, event_id: ID, position: U32, created_at: Date) =>
    trace <- N<Trace>(trace_id)
    event <- N<Event>(event_id)
    existing <- E<ContainsEvent>
    edge <- existing::UpsertE({
        position: position,
        created_at: created_at
    })::From(trace)::To(event)
    RETURN edge::{
        edgeID: ID,
        ..
    }

QUERY GetTraceEvents(trace_id: ID) =>
    events <- N<Trace>(trace_id)::Out<ContainsEvent>
    RETURN events::{
        eventID: ID,
        ..
    }

QUERY UpsertTraceEmbedding(
    vector: [F64],
    trace_key: String,
    org_id: String,
    trace_type: String,
    embedded_text: String,
    model_version: String
) =>
    existing <- V<TraceEmbedding>::WHERE(_::{trace_embedding_key}::EQ(trace_key))
    embedding <- existing::UpsertV(vector, {
        trace_embedding_key: trace_key,
        org_id: org_id,
        trace_type: trace_type,
        embedded_text: embedded_text,
        model_version: model_version
    })
    RETURN embedding::{
        embeddingID: ID,
        ..
    }

QUERY LinkTraceToEmbedding(trace_id: ID, embedding_id: ID, created_at: Date) =>
    trace <- N<Trace>(trace_id)
    embedding <- V<TraceEmbedding>(embedding_id)
    existing <- E<HasTraceEmbedding>
    edge <- existing::UpsertE({created_at: created_at})::From(trace)::To(embedding)
    RETURN edge::{
        edgeID: ID,
        created_at
    }

QUERY SearchTraceEmbeddings(vector: [F64], limit: I64, org_id: String) =>
    searched_embeddings <- SearchV<TraceEmbedding>(vector, limit)
    embeddings <- searched_embeddings::WHERE(_::{org_id}::EQ(org_id))
    traces <- embeddings::In<HasTraceEmbedding>
    RETURN traces::{
        traceID: ID,
        ..
    }

QUERY SearchRawPayloadKeywords(keywords: String, limit: I64, org_id: String) =>
    searched_payloads <- SearchBM25<RawPayload>(keywords, limit)
    raw_payloads <- searched_payloads::WHERE(_::{org_id}::EQ(org_id))
    events <- raw_payloads::In<HasRawPayload>
    RETURN events::{
        eventID: ID,
        ..
    }

QUERY SearchGenericPayloadKeywords(keywords: String, limit: I64, org_id: String) =>
    searched_payloads <- SearchBM25<GenericPayload>(keywords, limit)
    payloads <- searched_payloads::WHERE(_::{org_id}::EQ(org_id))
    events <- payloads::In<HasGenericPayload>
    RETURN events::{
        eventID: ID,
        ..
    }

QUERY SearchStripeRefundTraces(min_amount: F64, org_id: String) =>
    payloads <- N<StripePaymentPayload>::WHERE(
        AND(
            _::{org_id}::EQ(org_id),
            _::{status}::EQ("refunded"),
            _::{amount}::GTE(min_amount)
        )
    )
    events <- payloads::In<HasStripePaymentPayload>
    traces <- events::In<ContainsEvent>
    RETURN traces::{
        traceID: ID,
        ..
    }
