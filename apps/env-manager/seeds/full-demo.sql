-- Chronicle Labs — Full Demo Seed
-- Creates orgs, users, connections, runs, audit logs, and sample events
-- for a realistic demo environment.

-- ═══════════════════════════════════════════════════════════════════════
-- TENANTS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "Tenant" (id, name, slug, "stripeSubscriptionStatus", "createdAt", "updatedAt")
VALUES
  ('tenant-acme', 'Acme Corp', 'acme-corp', NULL, NOW() - INTERVAL '30 days', NOW()),
  ('tenant-chronicle', 'Chronicle Labs', 'chronicle-labs', 'active', NOW() - INTERVAL '60 days', NOW()),
  ('tenant-globex', 'Globex Corporation', 'globex', 'active', NOW() - INTERVAL '15 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- USERS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "User" (id, email, name, password, "authProvider", "tenantId", "createdAt", "updatedAt")
VALUES
  -- Acme Corp
  ('user-alice', 'alice@acme-corp.com', 'Alice Johnson', NULL, 'google', 'tenant-acme', NOW() - INTERVAL '28 days', NOW()),
  ('user-bob', 'bob@acme-corp.com', 'Bob Smith', NULL, 'google', 'tenant-acme', NOW() - INTERVAL '20 days', NOW()),
  -- Chronicle Labs
  ('user-admin', 'admin@chronicle-labs.com', 'Admin User', NULL, 'google', 'tenant-chronicle', NOW() - INTERVAL '60 days', NOW()),
  ('user-dev', 'dev@chronicle-labs.com', 'Dev User', NULL, 'google', 'tenant-chronicle', NOW() - INTERVAL '45 days', NOW()),
  ('user-qa', 'qa@chronicle-labs.com', 'QA Engineer', NULL, 'google', 'tenant-chronicle', NOW() - INTERVAL '30 days', NOW()),
  -- Globex
  ('user-hank', 'hank@globex.com', 'Hank Scorpio', NULL, 'google', 'tenant-globex', NOW() - INTERVAL '14 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- AGENT ENDPOINT CONFIGS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "AgentEndpointConfig" (id, "tenantId", "endpointUrl", "authType", "createdAt", "updatedAt")
VALUES
  ('aec-chronicle', 'tenant-chronicle', 'https://agent.chronicle-labs.com/v1/process', 'bearer', NOW() - INTERVAL '40 days', NOW()),
  ('aec-globex', 'tenant-globex', 'https://api.globex.com/agent/webhook', 'none', NOW() - INTERVAL '10 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- CONNECTIONS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "Connection" (id, "tenantId", provider, status, "createdAt", "updatedAt")
VALUES
  ('conn-chronicle-intercom', 'tenant-chronicle', 'intercom', 'active', NOW() - INTERVAL '35 days', NOW()),
  ('conn-chronicle-stripe', 'tenant-chronicle', 'stripe', 'active', NOW() - INTERVAL '30 days', NOW()),
  ('conn-globex-zendesk', 'tenant-globex', 'zendesk', 'active', NOW() - INTERVAL '12 days', NOW()),
  ('conn-acme-slack', 'tenant-acme', 'slack', 'inactive', NOW() - INTERVAL '25 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- RUNS (sample workflow executions)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "Run" (id, "tenantId", "workflowId", "eventId", "invocationId", mode, status, "eventSnapshot", "agentResponse", "createdAt", "updatedAt")
VALUES
  ('run-001', 'tenant-chronicle', 'wf-support-triage', 'evt-001', 'inv-001', 'auto', 'completed',
    '{"type":"conversation.created","source":"intercom"}'::jsonb,
    '{"action":"route_to_tier2","confidence":0.92}'::jsonb,
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('run-002', 'tenant-chronicle', 'wf-support-triage', 'evt-002', 'inv-002', 'auto', 'completed',
    '{"type":"conversation.updated","source":"intercom"}'::jsonb,
    '{"action":"auto_reply","confidence":0.87}'::jsonb,
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('run-003', 'tenant-chronicle', 'wf-support-triage', 'evt-003', 'inv-003', 'auto', 'failed',
    '{"type":"conversation.created","source":"intercom"}'::jsonb,
    NULL,
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('run-004', 'tenant-chronicle', 'wf-refund-review', 'evt-004', 'inv-004', 'human-in-loop', 'requires_human',
    '{"type":"charge.disputed","source":"stripe"}'::jsonb,
    '{"action":"escalate","reason":"high_value_dispute","amount":4999}'::jsonb,
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('run-005', 'tenant-chronicle', 'wf-support-triage', 'evt-005', 'inv-005', 'auto', 'pending',
    '{"type":"conversation.created","source":"intercom"}'::jsonb,
    NULL,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('run-006', 'tenant-globex', 'wf-ticket-classify', 'evt-006', 'inv-006', 'auto', 'completed',
    '{"type":"ticket.created","source":"zendesk"}'::jsonb,
    '{"category":"billing","priority":"high"}'::jsonb,
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('run-007', 'tenant-globex', 'wf-ticket-classify', 'evt-007', 'inv-007', 'auto', 'completed',
    '{"type":"ticket.updated","source":"zendesk"}'::jsonb,
    '{"category":"technical","priority":"medium"}'::jsonb,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- AUDIT LOGS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "AuditLog" (id, "tenantId", "runId", action, actor, payload, "createdAt")
VALUES
  ('al-001', 'tenant-chronicle', 'run-001', 'run.completed', 'system', '{"duration_ms":1250}'::jsonb, NOW() - INTERVAL '5 days'),
  ('al-002', 'tenant-chronicle', 'run-002', 'run.completed', 'system', '{"duration_ms":890}'::jsonb, NOW() - INTERVAL '4 days'),
  ('al-003', 'tenant-chronicle', 'run-003', 'run.failed', 'system', '{"error":"agent_timeout"}'::jsonb, NOW() - INTERVAL '3 days'),
  ('al-004', 'tenant-chronicle', 'run-004', 'run.escalated', 'user-admin', '{"reason":"manual_review"}'::jsonb, NOW() - INTERVAL '2 days'),
  ('al-005', 'tenant-chronicle', NULL, 'connection.created', 'user-admin', '{"provider":"intercom"}'::jsonb, NOW() - INTERVAL '35 days'),
  ('al-006', 'tenant-chronicle', NULL, 'connection.created', 'user-dev', '{"provider":"stripe"}'::jsonb, NOW() - INTERVAL '30 days'),
  ('al-007', 'tenant-chronicle', NULL, 'agent_endpoint.configured', 'user-admin', '{"url":"https://agent.chronicle-labs.com/v1/process"}'::jsonb, NOW() - INTERVAL '40 days'),
  ('al-008', 'tenant-globex', 'run-006', 'run.completed', 'system', '{"duration_ms":650}'::jsonb, NOW() - INTERVAL '3 days'),
  ('al-009', 'tenant-globex', NULL, 'user.invited', 'user-hank', '{"email":"hank@globex.com"}'::jsonb, NOW() - INTERVAL '14 days')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- SAMPLE EVENTS (for the events timeline)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO events (event_id, tenant_id, source, source_event_id, event_type, conversation_id, actor_type, actor_id, actor_name, occurred_at, payload)
VALUES
  ('evt-001', 'tenant-chronicle', 'intercom', 'ic-conv-1001', 'conversation.created', 'conv-1001', 'customer', 'cust-500', 'Jane Doe', NOW() - INTERVAL '5 days',
    '{"title":"Cannot access dashboard","body":"I keep getting a 403 error when trying to view my analytics.","tags":["bug","access"]}'::jsonb),
  ('evt-002', 'tenant-chronicle', 'intercom', 'ic-conv-1001-u1', 'conversation.updated', 'conv-1001', 'agent', 'agent-ai', 'Chronicle AI', NOW() - INTERVAL '4 days 23 hours',
    '{"auto_reply":"Hi Jane, I am looking into your access issue. Could you tell me which browser you are using?","confidence":0.87}'::jsonb),
  ('evt-003', 'tenant-chronicle', 'intercom', 'ic-conv-1002', 'conversation.created', 'conv-1002', 'customer', 'cust-501', 'John Wick', NOW() - INTERVAL '3 days',
    '{"title":"Billing question","body":"I was charged twice this month.","tags":["billing","urgent"]}'::jsonb),
  ('evt-004', 'tenant-chronicle', 'stripe', 'ch_dispute_42', 'charge.disputed', 'conv-billing-42', 'system', 'stripe', 'Stripe', NOW() - INTERVAL '2 days',
    '{"amount":4999,"currency":"usd","reason":"duplicate","customer_email":"john@example.com"}'::jsonb),
  ('evt-005', 'tenant-chronicle', 'intercom', 'ic-conv-1003', 'conversation.created', 'conv-1003', 'customer', 'cust-502', 'Sarah Connor', NOW() - INTERVAL '1 day',
    '{"title":"Feature request","body":"Can we get Slack integration for notifications?","tags":["feature-request"]}'::jsonb),
  ('evt-006', 'tenant-globex', 'zendesk', 'zd-tkt-9001', 'ticket.created', 'tkt-9001', 'customer', 'cust-g100', 'Homer Simpson', NOW() - INTERVAL '3 days',
    '{"subject":"Billing overcharge","priority":"high","category":"billing"}'::jsonb),
  ('evt-007', 'tenant-globex', 'zendesk', 'zd-tkt-9001-u1', 'ticket.updated', 'tkt-9001', 'agent', 'agent-g1', 'Support Bot', NOW() - INTERVAL '1 day',
    '{"status":"in_progress","assignee":"hank@globex.com"}'::jsonb)
ON CONFLICT (event_id) DO NOTHING;
