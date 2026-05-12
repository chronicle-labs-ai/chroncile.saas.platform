use chrono::{Duration, Utc};
use serde_json::json;

use chronicle_auth::types::AuthUser;
use chronicle_backend::{config, runtime, runtime::ChroniclePlatformRuntime};
use chronicle_core::{
    event::{Event, EventBuilder},
    ids::{Confidence, LinkId, OrgId},
    link::EventLink,
};
use chronicle_domain::{Actor, AuditLog, CreateRunInput, CreateTenantInput, EventEnvelope, Run};
use chronicle_mock_connector::{MockEventGenerator, MockOAuthConnection, MockService};

use crate::{ChronicleMcpError, ChronicleMcpEvalScenario, McpSessionContext};

pub struct SeededEvalScenario {
    pub runtime: ChroniclePlatformRuntime,
    pub auth_token: String,
    pub prompt: String,
    pub expected_citations: Vec<String>,
    pub context_dump: String,
    pub live_events: Vec<EventEnvelope>,
}

const USER_STORY_TOTAL_EVENT_COUNT: usize = 1_000;
const USER_STORY_TARGET_EVENT_COUNT: usize = 6;
const USER_STORY_OVERLAP_DISTRACTOR_EVENT_COUNT: usize = 12;
const USER_STORY_GENERIC_DISTRACTOR_EVENT_COUNT: usize = USER_STORY_TOTAL_EVENT_COUNT
    - USER_STORY_TARGET_EVENT_COUNT
    - USER_STORY_OVERLAP_DISTRACTOR_EVENT_COUNT;
const USER_STORY_BILLING_EMAIL: &str = "maya@example.com";
const USER_STORY_WORKSPACE: &str = "chronicle-demo";
const USER_STORY_SUPPORT_SUBJECT: &str = "Permission denied when opening dashboards";
const USER_STORY_CHAIN_LOGIN_INDEX: usize = 0;
const USER_STORY_CHAIN_ONBOARDING_INDEX: usize = 1;
const USER_STORY_CHAIN_SUBSCRIPTION_INDEX: usize = 2;
const USER_STORY_CHAIN_SUPPORT_INDEX: usize = 3;
const HIGH_VOLUME_TOTAL_EVENT_COUNT_DEFAULT: usize = 1_000_000;
const HIGH_VOLUME_INSERT_BATCH_SIZE: usize = 10_000;
const HIGH_VOLUME_TARGET_EVENT_COUNT: usize = 10;
const HIGH_VOLUME_OVERLAP_DISTRACTOR_EVENT_COUNT: usize = 12;
const HIGH_VOLUME_BILLING_EMAIL: &str = "maya@example.com";
const HIGH_VOLUME_WORKSPACE: &str = "chronicle-demo";
const HIGH_VOLUME_SUPPORT_SUBJECT: &str = "Permission denied when opening dashboards";
const HIGH_VOLUME_AUDIT_ACTOR: &str = "rbac-deployer";
const HIGH_VOLUME_WORKFLOW_ID: &str = "wf_dashboard_rbac_sync";
const HIGH_VOLUME_ROOT_CAUSE: &str = "missing_dashboard_viewer_mapping";
const HIGH_VOLUME_EMAIL_WORKSPACE_CHAIN_KEY: &str = "shared_email_and_workspace";
const HIGH_VOLUME_EMAIL_SUPPORT_CHAIN_KEY: &str = "shared_email_and_support";
const HIGH_VOLUME_WORKSPACE_SUPPORT_CHAIN_KEY: &str = "shared_workspace_and_support";

pub async fn build_seeded_eval_scenario(
    scenario: &ChronicleMcpEvalScenario,
) -> Result<SeededEvalScenario, String> {
    let runtime = runtime::build_platform_runtime(&config::LaunchConfig::default())
        .await
        .map_err(|error| error.to_string())?;
    let auth_user = eval_user(scenario);
    let session = McpSessionContext::from(auth_user.clone());

    runtime
        .saas_state
        .tenants
        .create(CreateTenantInput {
            name: session.tenant_name.clone(),
            slug: session.tenant_slug.clone(),
        })
        .await
        .map_err(|error| error.to_string())?;

    // The Chronicle-issued HS256 JWT path is gone — auth flows through WorkOS
    // JWKS now. The evals don't have a real WorkOS user, so we hand the
    // downstream MCP transport a placeholder token. Eval scenarios that
    // exercise the auth boundary will fail fast on `/api/auth/me` (expected);
    // re-architecting the eval harness against WorkOS test users is tracked
    // separately. For scenarios that don't touch authenticated endpoints,
    // this placeholder is harmless.
    let _ = auth_user; // silence unused-binding warning until the harness is rewired
    let auth_token = String::from("eval-placeholder-token");

    match scenario.id.as_str() {
        "incident_investigation" => seed_incident_investigation(runtime, session, auth_token).await,
        "historical_event_debugging" => {
            seed_historical_debugging(runtime, session, auth_token).await
        }
        "user_interaction_story" => seed_user_interaction_story(runtime, session, auth_token).await,
        "high_volume_multi_hop_story" => {
            seed_high_volume_multi_hop_story(runtime, session, auth_token).await
        }
        "replay_or_live_monitoring" => {
            seed_replay_or_live_monitoring(runtime, session, auth_token).await
        }
        other => Err(format!(
            "No seeded dataset implementation for scenario {other}"
        )),
    }
}

fn eval_user(scenario: &ChronicleMcpEvalScenario) -> AuthUser {
    let suffix = scenario.id.replace('_', "-");
    AuthUser {
        id: format!("user-eval-{suffix}"),
        email: format!("eval-{suffix}@chronicle.dev"),
        name: Some(format!("Eval {}", scenario.title)),
        role: "owner".to_string(),
        tenant_id: format!("tenant-eval-{suffix}"),
        tenant_name: format!("Chronicle Eval {}", scenario.title),
        tenant_slug: format!("chronicle-eval-{suffix}"),
    }
}

async fn seed_incident_investigation(
    runtime: ChroniclePlatformRuntime,
    session: McpSessionContext,
    auth_token: String,
) -> Result<SeededEvalScenario, String> {
    let conversation_id = "conv_incident_eval_001";
    let customer_id = "cust_incident_eval";
    let workflow_id = "wf_refund_router";
    let org_id = OrgId::new(&session.tenant_id);
    let base_time = Utc::now() - Duration::minutes(35);

    let customer_message = EventBuilder::new(
        session.tenant_id.as_str(),
        "zendesk",
        "support",
        "support.message.customer",
    )
    .entity("conversation", conversation_id)
    .entity("customer", customer_id)
    .event_time(base_time)
    .payload(json!({
        "text": "Refund workflow keeps failing for my damaged item claim.",
        "priority": "high"
    }))
    .build();

    let validation_failed = EventBuilder::new(
        session.tenant_id.as_str(),
        "chronicle",
        "workflow",
        "workflow.validation.failed",
    )
    .entity("conversation", conversation_id)
    .entity("customer", customer_id)
    .entity("workflow", workflow_id)
    .event_time(base_time + Duration::minutes(2))
    .payload(json!({
        "step": "validate_payment",
        "reason": "missing_charge_confirmation",
        "severity": "error"
    }))
    .build();

    let run_failed = EventBuilder::new(
        session.tenant_id.as_str(),
        "chronicle",
        "workflow",
        "workflow.run.failed",
    )
    .entity("conversation", conversation_id)
    .entity("customer", customer_id)
    .entity("workflow", workflow_id)
    .event_time(base_time + Duration::minutes(4))
    .payload(json!({
        "status": "failed",
        "error": "charge confirmation missing from upstream event graph"
    }))
    .build();

    runtime
        .events_state
        .store
        .insert_events(&[
            customer_message.clone(),
            validation_failed.clone(),
            run_failed.clone(),
        ])
        .await
        .map_err(|error| error.to_string())?;

    create_link(
        &runtime,
        &org_id,
        customer_message.event_id,
        validation_failed.event_id,
        "caused_by",
        "Customer refund request triggered workflow validation",
    )
    .await?;
    create_link(
        &runtime,
        &org_id,
        validation_failed.event_id,
        run_failed.event_id,
        "caused_by",
        "Validation failure caused the run to fail",
    )
    .await?;

    let run = runtime
        .saas_state
        .runs
        .create(CreateRunInput {
            tenant_id: session.tenant_id.clone(),
            workflow_id: Some(workflow_id.to_string()),
            event_id: run_failed.event_id.to_string(),
            invocation_id: "inv_incident_eval_001".to_string(),
            mode: "automatic".to_string(),
            event_snapshot: Some(json!({
                "conversationId": conversation_id,
                "customerId": customer_id
            })),
            context_pointers: Some(json!({
                "timelineEntityType": "conversation",
                "timelineEntityId": conversation_id
            })),
        })
        .await
        .map_err(|error| error.to_string())?;

    runtime
        .saas_state
        .runs
        .update_status(&run.id, "failed")
        .await
        .map_err(|error| error.to_string())?;

    let audit_log_created = runtime
        .saas_state
        .audit_logs
        .create(
            &session.tenant_id,
            "run.created",
            Some(&session.user_id),
            Some(&run.id),
            Some(&customer_message.event_id.to_string()),
            Some(&run.invocation_id),
            Some(json!({"workflowId": workflow_id})),
        )
        .await
        .map_err(|error| error.to_string())?;
    let audit_log_validation_failed = runtime
        .saas_state
        .audit_logs
        .create(
            &session.tenant_id,
            "workflow.validation.failed",
            Some("chronicle-system"),
            Some(&run.id),
            Some(&validation_failed.event_id.to_string()),
            Some(&run.invocation_id),
            Some(json!({"reason": "missing_charge_confirmation"})),
        )
        .await
        .map_err(|error| error.to_string())?;
    let audit_log_run_failed = runtime
        .saas_state
        .audit_logs
        .create(
            &session.tenant_id,
            "run.failed",
            Some("chronicle-system"),
            Some(&run.id),
            Some(&run_failed.event_id.to_string()),
            Some(&run.invocation_id),
            Some(json!({"status": "failed"})),
        )
        .await
        .map_err(|error| error.to_string())?;

    let run_id = run.id.clone();

    Ok(SeededEvalScenario {
        runtime,
        auth_token,
        prompt: format!(
            "Investigate why workflow run `{}` for conversation `{}` failed. Use Chronicle tools only. Start by listing runs, inspect the run and audit trail, inspect the conversation timeline, traverse the event graph, and finish with a grounded diagnosis that cites the run id and at least one event id.",
            run_id, conversation_id
        ),
        expected_citations: vec![
            run_id,
            validation_failed.event_id.to_string(),
            run_failed.event_id.to_string(),
        ],
        context_dump: pretty_json(&json!({
            "scenario": "incident_investigation",
            "tenantId": session.tenant_id,
            "conversationId": conversation_id,
            "events": [customer_message, validation_failed, run_failed],
            "run": run,
            "auditLogs": [
                audit_log_created,
                audit_log_validation_failed,
                audit_log_run_failed
            ]
        })),
        live_events: vec![],
    })
}

async fn seed_historical_debugging(
    runtime: ChroniclePlatformRuntime,
    session: McpSessionContext,
    auth_token: String,
) -> Result<SeededEvalScenario, String> {
    let account_id = "acct_eval_northwind";
    let customer_id = "cust_eval_northwind";
    let org_id = OrgId::new(&session.tenant_id);
    let base_time = Utc::now() - Duration::minutes(55);

    let charge_created = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "payments",
        "charge.created",
    )
    .entity("account", account_id)
    .entity("customer", customer_id)
    .event_time(base_time)
    .payload(json!({
        "amount": 2499,
        "currency": "usd",
        "status": "pending"
    }))
    .build();

    let payment_retry = EventBuilder::new(
        session.tenant_id.as_str(),
        "chronicle",
        "workflow",
        "payment.retry.started",
    )
    .entity("account", account_id)
    .entity("customer", customer_id)
    .event_time(base_time + Duration::minutes(3))
    .payload(json!({
        "attempt": 2,
        "reason": "processor_timeout"
    }))
    .build();

    let charge_succeeded = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "payments",
        "charge.succeeded",
    )
    .entity("account", account_id)
    .entity("customer", customer_id)
    .event_time(base_time + Duration::minutes(5))
    .payload(json!({
        "amount": 2499,
        "currency": "usd",
        "status": "succeeded"
    }))
    .build();

    runtime
        .events_state
        .store
        .insert_events(&[
            charge_created.clone(),
            payment_retry.clone(),
            charge_succeeded.clone(),
        ])
        .await
        .map_err(|error| error.to_string())?;

    create_link(
        &runtime,
        &org_id,
        charge_created.event_id,
        payment_retry.event_id,
        "retried_by",
        "Chronicle workflow retried the charge after the processor timeout",
    )
    .await?;
    create_link(
        &runtime,
        &org_id,
        payment_retry.event_id,
        charge_succeeded.event_id,
        "resolved_by",
        "Retry succeeded and closed the payment incident",
    )
    .await?;

    Ok(SeededEvalScenario {
        runtime,
        auth_token,
        prompt: format!(
            "Find the payment events for account `{}` and explain the execution path. Use Chronicle tools only. You should identify the relevant sources first, search or query for the payment events, inspect the timeline for the account, and cite at least one exact event id in the final answer.",
            account_id
        ),
        expected_citations: vec![
            charge_created.event_id.to_string(),
            charge_succeeded.event_id.to_string(),
            account_id.to_string(),
        ],
        context_dump: pretty_json(&json!({
            "scenario": "historical_event_debugging",
            "tenantId": session.tenant_id,
            "accountId": account_id,
            "events": [charge_created, payment_retry, charge_succeeded]
        })),
        live_events: vec![],
    })
}

async fn seed_replay_or_live_monitoring(
    runtime: ChroniclePlatformRuntime,
    session: McpSessionContext,
    auth_token: String,
) -> Result<SeededEvalScenario, String> {
    let conversation_id = "conv_live_eval_001";
    let org_id = OrgId::new(&session.tenant_id);
    let base_time = Utc::now() - Duration::minutes(20);

    let ticket_created = EventBuilder::new(
        session.tenant_id.as_str(),
        "zendesk",
        "support",
        "ticket.created",
    )
    .entity("conversation", conversation_id)
    .event_time(base_time)
    .payload(json!({
        "priority": "high",
        "customerId": "cust_live_eval"
    }))
    .build();

    let assigned = EventBuilder::new(
        session.tenant_id.as_str(),
        "zendesk",
        "support",
        "ticket.assignee_changed",
    )
    .entity("conversation", conversation_id)
    .event_time(base_time + Duration::minutes(1))
    .payload(json!({
        "oldAssignee": null,
        "newAssignee": "agent_live_1"
    }))
    .build();

    let escalated = EventBuilder::new(
        session.tenant_id.as_str(),
        "zendesk",
        "support",
        "escalation.created",
    )
    .entity("conversation", conversation_id)
    .event_time(base_time + Duration::minutes(3))
    .payload(json!({
        "reason": "customer requested supervisor review",
        "priority": "high"
    }))
    .build();

    runtime
        .events_state
        .store
        .insert_events(&[ticket_created.clone(), assigned.clone(), escalated.clone()])
        .await
        .map_err(|error| error.to_string())?;

    create_link(
        &runtime,
        &org_id,
        ticket_created.event_id,
        assigned.event_id,
        "progressed_to",
        "Ticket was assigned after creation",
    )
    .await?;
    create_link(
        &runtime,
        &org_id,
        assigned.event_id,
        escalated.event_id,
        "progressed_to",
        "Assignment led to escalation",
    )
    .await?;

    let conn = MockOAuthConnection::new(session.tenant_id.clone(), MockService::MockZendesk);
    let mut generator = MockEventGenerator::new(conn);
    let live_events = vec![
        generator
            .internal_note(
                conversation_id,
                "agent_live_1",
                "Supervisor requested additional shipment tracing context",
            )
            .with_occurred_at(Utc::now()),
        generator
            .agent_message(
                conversation_id,
                "agent_live_supervisor",
                "Lisa",
                "I found a warehouse handoff delay and escalated fulfillment for a same-day replacement.",
            )
            .with_occurred_at(Utc::now() + Duration::seconds(1)),
        generator
            .status_change(
                conversation_id,
                "open",
                "pending_replacement",
                Actor::agent("agent_live_supervisor"),
            )
            .with_occurred_at(Utc::now() + Duration::seconds(2)),
    ];

    Ok(SeededEvalScenario {
        runtime,
        auth_token,
        prompt: format!(
            "Watch the live Chronicle stream for conversation `{}` and compare it to the replay timeline for that same conversation. Use Chronicle tools only. You must call both `replay_timeline` and `watch_events`, then summarize notable transitions or anomalies with at least one exact event id or event type.",
            conversation_id
        ),
        expected_citations: vec![
            assigned.event_id.to_string(),
            escalated.event_id.to_string(),
            "pending_replacement".to_string(),
            "escalation.created".to_string(),
        ],
        context_dump: pretty_json(&json!({
            "scenario": "replay_or_live_monitoring",
            "tenantId": session.tenant_id,
            "conversationId": conversation_id,
            "historicalEvents": [ticket_created, assigned, escalated],
            "liveEvents": live_events.clone()
        })),
        live_events,
    })
}

async fn seed_user_interaction_story(
    runtime: ChroniclePlatformRuntime,
    session: McpSessionContext,
    auth_token: String,
) -> Result<SeededEvalScenario, String> {
    let user_id = "usr_eval_story_001";
    let account_id = "acct_eval_story_001";
    let conversation_id = "conv_eval_story_001";
    let workflow_id = "wf_eval_story_onboarding";
    let base_time = Utc::now() - Duration::minutes(95);

    let login_succeeded = EventBuilder::new(
        session.tenant_id.as_str(),
        "frontend",
        "auth",
        "auth.login.succeeded",
    )
    .entity("user", user_id)
    .entity("account", account_id)
    .event_time(base_time)
    .payload(json!({
        "email": USER_STORY_BILLING_EMAIL,
        "authProvider": "password"
    }))
    .build();

    let onboarding_started = EventBuilder::new(
        session.tenant_id.as_str(),
        "frontend",
        "product",
        "onboarding.started",
    )
    .entity("user", user_id)
    .entity("account", account_id)
    .event_time(base_time + Duration::minutes(2))
    .payload(json!({
        "checklist": ["connect_source", "create_workflow"],
        "workspace": USER_STORY_WORKSPACE
    }))
    .build();

    let workflow_completed = EventBuilder::new(
        session.tenant_id.as_str(),
        "chronicle",
        "workflow",
        "workflow.run.completed",
    )
    .entity("account", account_id)
    .entity("workflow", workflow_id)
    .event_time(base_time + Duration::minutes(11))
    .payload(json!({
        "status": "completed",
        "template": "trial-onboarding",
        "workspace": USER_STORY_WORKSPACE,
        "runCount": 1
    }))
    .build();

    let checkout_started = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "billing",
        "billing.checkout.started",
    )
    .entity("account", account_id)
    .event_time(base_time + Duration::minutes(24))
    .payload(json!({
        "plan": "pro",
        "interval": "monthly",
        "amount": 4900
    }))
    .build();

    let subscription_activated = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "billing",
        "billing.subscription.activated",
    )
    .entity("account", account_id)
    .event_time(base_time + Duration::minutes(27))
    .payload(json!({
        "plan": "pro",
        "status": "active",
        "billingEmail": USER_STORY_BILLING_EMAIL
    }))
    .build();

    let support_ticket_created = EventBuilder::new(
        session.tenant_id.as_str(),
        "zendesk",
        "support",
        "support.ticket.created",
    )
    .entity("account", account_id)
    .entity("conversation", conversation_id)
    .event_time(base_time + Duration::minutes(61))
    .payload(json!({
        "subject": USER_STORY_SUPPORT_SUBJECT,
        "priority": "normal",
        "text": "After upgrading to Pro, Maya still sees permission denied on the dashboards page."
    }))
    .build();

    let login_succeeded_time = base_time;
    let onboarding_started_time = base_time + Duration::minutes(2);
    let workflow_completed_time = base_time + Duration::minutes(11);
    let subscription_activated_time = base_time + Duration::minutes(27);
    let support_ticket_created_time = base_time + Duration::minutes(61);

    let login_summary = compact_story_event_summary(
        &login_succeeded,
        login_succeeded_time,
        "frontend",
        "auth",
        "auth.login.succeeded",
        Some(user_id),
        None,
        None,
        json!({
            "email": USER_STORY_BILLING_EMAIL,
            "authProvider": "password"
        }),
    );
    let onboarding_summary = compact_story_event_summary(
        &onboarding_started,
        onboarding_started_time,
        "frontend",
        "product",
        "onboarding.started",
        Some(user_id),
        Some(account_id),
        None,
        json!({
            "workspace": USER_STORY_WORKSPACE,
            "checklist": ["connect_source", "create_workflow"]
        }),
    );
    let workflow_summary = compact_story_event_summary(
        &workflow_completed,
        workflow_completed_time,
        "chronicle",
        "workflow",
        "workflow.run.completed",
        None,
        Some(account_id),
        None,
        json!({
            "workflowId": workflow_id,
            "template": "trial-onboarding",
            "workspace": USER_STORY_WORKSPACE
        }),
    );
    let subscription_summary = compact_story_event_summary(
        &subscription_activated,
        subscription_activated_time,
        "stripe",
        "billing",
        "billing.subscription.activated",
        None,
        Some(account_id),
        None,
        json!({
            "plan": "pro",
            "status": "active",
            "billingEmail": USER_STORY_BILLING_EMAIL
        }),
    );
    let support_summary = compact_story_event_summary(
        &support_ticket_created,
        support_ticket_created_time,
        "zendesk",
        "support",
        "support.ticket.created",
        None,
        Some(account_id),
        Some(conversation_id),
        json!({
            "subject": USER_STORY_SUPPORT_SUBJECT,
            "priority": "normal"
        }),
    );

    let overlap_email_workspace = build_user_story_overlap_distractor_chain(
        session.tenant_id.as_str(),
        base_time,
        "shared_email_and_workspace",
        USER_STORY_BILLING_EMAIL,
        USER_STORY_WORKSPACE,
        "Invoice looks correct but export is missing",
        5,
    );
    let overlap_email_support = build_user_story_overlap_distractor_chain(
        session.tenant_id.as_str(),
        base_time,
        "shared_email_and_support",
        USER_STORY_BILLING_EMAIL,
        "ops-control-room",
        USER_STORY_SUPPORT_SUBJECT,
        19,
    );
    let overlap_workspace_support = build_user_story_overlap_distractor_chain(
        session.tenant_id.as_str(),
        base_time,
        "shared_workspace_and_support",
        "maya+ops@example.com",
        USER_STORY_WORKSPACE,
        USER_STORY_SUPPORT_SUBJECT,
        31,
    );

    let mut all_events = vec![
        login_succeeded.clone(),
        onboarding_started.clone(),
        workflow_completed.clone(),
        checkout_started.clone(),
        subscription_activated.clone(),
        support_ticket_created.clone(),
    ];
    for chain in [
        &overlap_email_workspace,
        &overlap_email_support,
        &overlap_workspace_support,
    ] {
        for (event, _) in chain {
            all_events.push(event.clone());
        }
    }

    for index in 0..USER_STORY_GENERIC_DISTRACTOR_EVENT_COUNT {
        let (event, _) =
            build_user_story_distractor_event(session.tenant_id.as_str(), base_time, index);
        all_events.push(event);
    }

    let auth_by_billing_email = vec![
        login_summary.clone(),
        overlap_email_workspace[USER_STORY_CHAIN_LOGIN_INDEX]
            .1
            .clone(),
        overlap_email_support[USER_STORY_CHAIN_LOGIN_INDEX]
            .1
            .clone(),
    ];
    let billing_by_email = vec![
        subscription_summary.clone(),
        overlap_email_workspace[USER_STORY_CHAIN_SUBSCRIPTION_INDEX]
            .1
            .clone(),
        overlap_email_support[USER_STORY_CHAIN_SUBSCRIPTION_INDEX]
            .1
            .clone(),
    ];
    let onboarding_by_workspace = vec![
        onboarding_summary.clone(),
        workflow_summary.clone(),
        overlap_email_workspace[USER_STORY_CHAIN_ONBOARDING_INDEX]
            .1
            .clone(),
        overlap_workspace_support[USER_STORY_CHAIN_ONBOARDING_INDEX]
            .1
            .clone(),
    ];
    let support_by_subject = vec![
        support_summary.clone(),
        overlap_email_support[USER_STORY_CHAIN_SUPPORT_INDEX]
            .1
            .clone(),
        overlap_workspace_support[USER_STORY_CHAIN_SUPPORT_INDEX]
            .1
            .clone(),
    ];

    runtime
        .events_state
        .store
        .insert_events(&all_events)
        .await
        .map_err(|error| error.to_string())?;

    Ok(SeededEvalScenario {
        runtime,
        auth_token,
        prompt: format!(
            "Reconstruct the Chronicle journey for the operator case that matches all three clues: the Stripe billing email `{}`, the onboarding workspace `{}`, and the later Zendesk ticket titled `{}`. The tenant has roughly {} events and several distractor accounts share one or two of these clues, so you must join the signals instead of relying on a single exact match. Use Chronicle tools only. Recommended flow: search the support subject, search the billing email, intersect on the shared account, then call `get_timeline` for that account or the resolved user before writing the answer. Identify the correct Chronicle user id, then summarize the chronology from login through billing and support. Cite the user id and at least two exact event ids in the final answer.",
            USER_STORY_BILLING_EMAIL,
            USER_STORY_WORKSPACE,
            USER_STORY_SUPPORT_SUBJECT,
            USER_STORY_TOTAL_EVENT_COUNT
        ),
        expected_citations: vec![
            user_id.to_string(),
            login_succeeded.event_id.to_string(),
            subscription_activated.event_id.to_string(),
            support_ticket_created.event_id.to_string(),
        ],
        context_dump: compact_json(&json!({
            "scenario": "user_interaction_story",
            "tenantId": session.tenant_id,
            "operatorClues": {
                "billingEmail": USER_STORY_BILLING_EMAIL,
                "workspace": USER_STORY_WORKSPACE,
                "supportSubject": USER_STORY_SUPPORT_SUBJECT
            },
            "totalEventCount": USER_STORY_TOTAL_EVENT_COUNT,
            "note": "Each section is an independent static top-k retrieval for one clue. The sections are not deduplicated or normalized across accounts.",
            "rowFormat": "rowIdOrEventId|timeIfRelevant|source:eventType|u=<user>|a=<account>|c=<conversation>|details",
            "staticRetrievals": {
                "authByBillingEmailTopK": auth_by_billing_email,
                "billingByEmailTopK": billing_by_email,
                "onboardingByWorkspaceTopK": onboarding_by_workspace,
                "supportBySubjectTopK": support_by_subject
            }
        })),
        live_events: vec![],
    })
}

async fn seed_high_volume_multi_hop_story(
    runtime: ChroniclePlatformRuntime,
    session: McpSessionContext,
    auth_token: String,
) -> Result<SeededEvalScenario, String> {
    let total_event_count = high_volume_total_event_count();
    let generic_noise_count = total_event_count
        - HIGH_VOLUME_TARGET_EVENT_COUNT
        - HIGH_VOLUME_OVERLAP_DISTRACTOR_EVENT_COUNT;
    let base_time = Utc::now() - Duration::hours(2);
    let user_id = "usr_eval_high_volume_001";
    let account_id = "acct_eval_high_volume_001";
    let conversation_id = "conv_eval_high_volume_001";

    let login_succeeded = EventBuilder::new(
        session.tenant_id.as_str(),
        "frontend",
        "auth",
        "auth.login.succeeded",
    )
    .entity("user", user_id)
    .entity("account", account_id)
    .event_time(base_time)
    .payload(json!({
        "email": HIGH_VOLUME_BILLING_EMAIL,
        "authProvider": "password"
    }))
    .build();

    let onboarding_started = EventBuilder::new(
        session.tenant_id.as_str(),
        "frontend",
        "product",
        "onboarding.started",
    )
    .entity("user", user_id)
    .entity("account", account_id)
    .event_time(base_time + Duration::minutes(2))
    .payload(json!({
        "workspace": HIGH_VOLUME_WORKSPACE,
        "checklist": ["connect_source", "create_workflow"]
    }))
    .build();

    let workflow_completed = EventBuilder::new(
        session.tenant_id.as_str(),
        "chronicle",
        "workflow",
        "workflow.run.completed",
    )
    .entity("account", account_id)
    .entity("workflow", HIGH_VOLUME_WORKFLOW_ID)
    .event_time(base_time + Duration::minutes(11))
    .payload(json!({
        "status": "completed",
        "template": "trial-onboarding",
        "workspace": HIGH_VOLUME_WORKSPACE
    }))
    .build();

    let subscription_activated = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "billing",
        "billing.subscription.activated",
    )
    .entity("account", account_id)
    .event_time(base_time + Duration::minutes(27))
    .payload(json!({
        "plan": "pro",
        "status": "active",
        "billingEmail": HIGH_VOLUME_BILLING_EMAIL
    }))
    .build();

    let dashboard_access_denied = EventBuilder::new(
        session.tenant_id.as_str(),
        "frontend",
        "dashboard",
        "dashboard.access.denied",
    )
    .entity("user", user_id)
    .entity("account", account_id)
    .event_time(base_time + Duration::minutes(34))
    .payload(json!({
        "workspace": HIGH_VOLUME_WORKSPACE,
        "route": "/dashboard",
        "errorCode": "permission_denied"
    }))
    .build();

    let role_sync_failed = build_high_volume_role_sync_failed_event(
        session.tenant_id.as_str(),
        account_id,
        HIGH_VOLUME_WORKSPACE,
        base_time + Duration::minutes(35),
        HIGH_VOLUME_ROOT_CAUSE,
    );

    let support_ticket_created = EventBuilder::new(
        session.tenant_id.as_str(),
        "zendesk",
        "support",
        "support.ticket.created",
    )
    .entity("account", account_id)
    .entity("conversation", conversation_id)
    .event_time(base_time + Duration::minutes(61))
    .payload(json!({
        "subject": HIGH_VOLUME_SUPPORT_SUBJECT,
        "priority": "normal",
        "text": "After upgrading to Pro, Maya still sees permission denied on the dashboards page."
    }))
    .build();

    let login_summary = compact_story_event_summary(
        &login_succeeded,
        base_time,
        "frontend",
        "auth",
        "auth.login.succeeded",
        Some(user_id),
        Some(account_id),
        None,
        json!({
            "email": HIGH_VOLUME_BILLING_EMAIL,
            "authProvider": "password"
        }),
    );
    let onboarding_summary = compact_story_event_summary(
        &onboarding_started,
        base_time + Duration::minutes(2),
        "frontend",
        "product",
        "onboarding.started",
        Some(user_id),
        Some(account_id),
        None,
        json!({
            "workspace": HIGH_VOLUME_WORKSPACE,
            "checklist": ["connect_source", "create_workflow"]
        }),
    );
    let workflow_summary = compact_story_event_summary(
        &workflow_completed,
        base_time + Duration::minutes(11),
        "chronicle",
        "workflow",
        "workflow.run.completed",
        None,
        Some(account_id),
        None,
        json!({
            "workflowId": HIGH_VOLUME_WORKFLOW_ID,
            "workspace": HIGH_VOLUME_WORKSPACE
        }),
    );
    let subscription_summary = compact_story_event_summary(
        &subscription_activated,
        base_time + Duration::minutes(27),
        "stripe",
        "billing",
        "billing.subscription.activated",
        None,
        Some(account_id),
        None,
        json!({
            "plan": "pro",
            "billingEmail": HIGH_VOLUME_BILLING_EMAIL
        }),
    );
    let access_denied_summary = compact_story_event_summary(
        &dashboard_access_denied,
        base_time + Duration::minutes(34),
        "frontend",
        "dashboard",
        "dashboard.access.denied",
        Some(user_id),
        Some(account_id),
        None,
        json!({
            "workspace": HIGH_VOLUME_WORKSPACE,
            "errorCode": "permission_denied"
        }),
    );
    let support_summary = compact_story_event_summary(
        &support_ticket_created,
        base_time + Duration::minutes(61),
        "zendesk",
        "support",
        "support.ticket.created",
        None,
        Some(account_id),
        Some(conversation_id),
        json!({
            "subject": HIGH_VOLUME_SUPPORT_SUBJECT,
            "priority": "normal"
        }),
    );

    let overlap_email_workspace = build_user_story_overlap_distractor_chain(
        session.tenant_id.as_str(),
        base_time,
        HIGH_VOLUME_EMAIL_WORKSPACE_CHAIN_KEY,
        HIGH_VOLUME_BILLING_EMAIL,
        HIGH_VOLUME_WORKSPACE,
        "Invoice looks correct but export is missing",
        5,
    );
    let overlap_email_support = build_user_story_overlap_distractor_chain(
        session.tenant_id.as_str(),
        base_time,
        HIGH_VOLUME_EMAIL_SUPPORT_CHAIN_KEY,
        HIGH_VOLUME_BILLING_EMAIL,
        "ops-control-room",
        HIGH_VOLUME_SUPPORT_SUBJECT,
        19,
    );
    let overlap_workspace_support = build_user_story_overlap_distractor_chain(
        session.tenant_id.as_str(),
        base_time,
        HIGH_VOLUME_WORKSPACE_SUPPORT_CHAIN_KEY,
        "maya+ops@example.com",
        HIGH_VOLUME_WORKSPACE,
        HIGH_VOLUME_SUPPORT_SUBJECT,
        31,
    );

    let overlap_email_workspace_account_id = format!(
        "acct_eval_story_overlap_{}",
        HIGH_VOLUME_EMAIL_WORKSPACE_CHAIN_KEY
    );
    let overlap_email_support_account_id = format!(
        "acct_eval_story_overlap_{}",
        HIGH_VOLUME_EMAIL_SUPPORT_CHAIN_KEY
    );
    let overlap_workspace_support_account_id = format!(
        "acct_eval_story_overlap_{}",
        HIGH_VOLUME_WORKSPACE_SUPPORT_CHAIN_KEY
    );

    let email_workspace_role_sync_failed = build_high_volume_role_sync_failed_event(
        session.tenant_id.as_str(),
        overlap_email_workspace_account_id.as_str(),
        HIGH_VOLUME_WORKSPACE,
        base_time + Duration::minutes(36),
        "stale_membership_snapshot",
    );
    let email_support_role_sync_failed = build_high_volume_role_sync_failed_event(
        session.tenant_id.as_str(),
        overlap_email_support_account_id.as_str(),
        "ops-control-room",
        base_time + Duration::minutes(38),
        "workspace_membership_not_found",
    );
    let workspace_support_role_sync_failed = build_high_volume_role_sync_failed_event(
        session.tenant_id.as_str(),
        overlap_workspace_support_account_id.as_str(),
        HIGH_VOLUME_WORKSPACE,
        base_time + Duration::minutes(39),
        "trial_role_template_not_provisioned",
    );

    let role_sync_target_summary = compact_story_event_summary(
        &role_sync_failed,
        base_time + Duration::minutes(35),
        "chronicle",
        "authorization",
        "authorization.role.sync.failed",
        None,
        Some(account_id),
        None,
        json!({
            "actor": HIGH_VOLUME_AUDIT_ACTOR,
            "workspace": HIGH_VOLUME_WORKSPACE,
            "reason": HIGH_VOLUME_ROOT_CAUSE
        }),
    );
    let role_sync_workspace_support_summary = compact_story_event_summary(
        &workspace_support_role_sync_failed,
        base_time + Duration::minutes(39),
        "chronicle",
        "authorization",
        "authorization.role.sync.failed",
        None,
        Some(overlap_workspace_support_account_id.as_str()),
        None,
        json!({
            "actor": HIGH_VOLUME_AUDIT_ACTOR,
            "workspace": HIGH_VOLUME_WORKSPACE,
            "reason": "trial_role_template_not_provisioned"
        }),
    );

    let mut explicit_events = vec![
        login_succeeded.clone(),
        onboarding_started.clone(),
        workflow_completed.clone(),
        subscription_activated.clone(),
        dashboard_access_denied.clone(),
        role_sync_failed.clone(),
        support_ticket_created.clone(),
        email_workspace_role_sync_failed.clone(),
        email_support_role_sync_failed.clone(),
        workspace_support_role_sync_failed.clone(),
    ];
    debug_assert_eq!(explicit_events.len(), HIGH_VOLUME_TARGET_EVENT_COUNT);

    for chain in [
        &overlap_email_workspace,
        &overlap_email_support,
        &overlap_workspace_support,
    ] {
        for (event, _) in chain {
            explicit_events.push(event.clone());
        }
    }
    debug_assert_eq!(
        explicit_events.len(),
        HIGH_VOLUME_TARGET_EVENT_COUNT + HIGH_VOLUME_OVERLAP_DISTRACTOR_EVENT_COUNT
    );

    runtime
        .events_state
        .store
        .insert_events(&explicit_events)
        .await
        .map_err(|error| error.to_string())?;

    insert_high_volume_noise_events(
        &runtime,
        session.tenant_id.as_str(),
        base_time,
        generic_noise_count,
    )
    .await?;

    let (target_run, target_failure_audit) = create_high_volume_failed_run(
        &runtime,
        &session,
        "inv_high_volume_target_001",
        &role_sync_failed,
        account_id,
        HIGH_VOLUME_WORKSPACE,
        HIGH_VOLUME_BILLING_EMAIL,
        HIGH_VOLUME_ROOT_CAUSE,
    )
    .await?;
    let (email_workspace_run, email_workspace_failure_audit) = create_high_volume_failed_run(
        &runtime,
        &session,
        "inv_high_volume_overlap_email_workspace",
        &email_workspace_role_sync_failed,
        overlap_email_workspace_account_id.as_str(),
        HIGH_VOLUME_WORKSPACE,
        HIGH_VOLUME_BILLING_EMAIL,
        "stale_membership_snapshot",
    )
    .await?;
    let (email_support_run, email_support_failure_audit) = create_high_volume_failed_run(
        &runtime,
        &session,
        "inv_high_volume_overlap_email_support",
        &email_support_role_sync_failed,
        overlap_email_support_account_id.as_str(),
        "ops-control-room",
        HIGH_VOLUME_BILLING_EMAIL,
        "workspace_membership_not_found",
    )
    .await?;
    let (workspace_support_run, workspace_support_failure_audit) = create_high_volume_failed_run(
        &runtime,
        &session,
        "inv_high_volume_overlap_workspace_support",
        &workspace_support_role_sync_failed,
        overlap_workspace_support_account_id.as_str(),
        HIGH_VOLUME_WORKSPACE,
        "maya+ops@example.com",
        "trial_role_template_not_provisioned",
    )
    .await?;

    let auth_by_billing_email = vec![
        login_summary.clone(),
        overlap_email_workspace[USER_STORY_CHAIN_LOGIN_INDEX]
            .1
            .clone(),
        overlap_email_support[USER_STORY_CHAIN_LOGIN_INDEX]
            .1
            .clone(),
    ];
    let billing_by_email = vec![
        subscription_summary.clone(),
        overlap_email_workspace[USER_STORY_CHAIN_SUBSCRIPTION_INDEX]
            .1
            .clone(),
        overlap_email_support[USER_STORY_CHAIN_SUBSCRIPTION_INDEX]
            .1
            .clone(),
    ];
    let workspace_activity = vec![
        onboarding_summary.clone(),
        workflow_summary.clone(),
        access_denied_summary.clone(),
        role_sync_target_summary.clone(),
        overlap_email_workspace[USER_STORY_CHAIN_ONBOARDING_INDEX]
            .1
            .clone(),
        overlap_workspace_support[USER_STORY_CHAIN_ONBOARDING_INDEX]
            .1
            .clone(),
        role_sync_workspace_support_summary,
    ];
    let support_by_subject = vec![
        support_summary.clone(),
        overlap_email_support[USER_STORY_CHAIN_SUPPORT_INDEX]
            .1
            .clone(),
        overlap_workspace_support[USER_STORY_CHAIN_SUPPORT_INDEX]
            .1
            .clone(),
    ];
    let run_candidates = vec![
        compact_high_volume_run_summary(&target_run, HIGH_VOLUME_WORKSPACE, HIGH_VOLUME_ROOT_CAUSE),
        compact_high_volume_run_summary(
            &email_workspace_run,
            HIGH_VOLUME_WORKSPACE,
            "stale_membership_snapshot",
        ),
        compact_high_volume_run_summary(
            &email_support_run,
            "ops-control-room",
            "workspace_membership_not_found",
        ),
        compact_high_volume_run_summary(
            &workspace_support_run,
            HIGH_VOLUME_WORKSPACE,
            "trial_role_template_not_provisioned",
        ),
    ];
    let audit_by_actor = vec![
        compact_high_volume_audit_summary(
            &target_failure_audit,
            HIGH_VOLUME_WORKSPACE,
            HIGH_VOLUME_ROOT_CAUSE,
        ),
        compact_high_volume_audit_summary(
            &email_workspace_failure_audit,
            HIGH_VOLUME_WORKSPACE,
            "stale_membership_snapshot",
        ),
        compact_high_volume_audit_summary(
            &email_support_failure_audit,
            "ops-control-room",
            "workspace_membership_not_found",
        ),
        compact_high_volume_audit_summary(
            &workspace_support_failure_audit,
            HIGH_VOLUME_WORKSPACE,
            "trial_role_template_not_provisioned",
        ),
    ];

    Ok(SeededEvalScenario {
        runtime,
        auth_token,
        prompt: format!(
            "Investigate the dashboard permission regression in a Chronicle tenant with roughly {} events. Resolve the single account that matches all four clues: Stripe billing email `{}`, onboarding workspace `{}`, Zendesk ticket subject `{}`, and audit actor `{}`. Several distractor accounts share two or three clues, and there are multiple failed role-sync runs, so you must join the signals before choosing a run. Use Chronicle tools only. Recommended flow: search the support subject, search the billing email, reconcile the workspace clue, get the account timeline, then inspect the failed dashboard role-sync runs and their audit logs. In the final answer, identify the correct Chronicle user id and account id, explain the chronology from login to support escalation, and cite the exact failed run id plus the exact audit log id that proves the root cause `{}`.",
            total_event_count,
            HIGH_VOLUME_BILLING_EMAIL,
            HIGH_VOLUME_WORKSPACE,
            HIGH_VOLUME_SUPPORT_SUBJECT,
            HIGH_VOLUME_AUDIT_ACTOR,
            HIGH_VOLUME_ROOT_CAUSE
        ),
        expected_citations: vec![target_run.id.clone(), target_failure_audit.id.clone()],
        context_dump: compact_json(&json!({
            "scenario": "high_volume_multi_hop_story",
            "tenantId": session.tenant_id,
            "operatorClues": {
                "billingEmail": HIGH_VOLUME_BILLING_EMAIL,
                "workspace": HIGH_VOLUME_WORKSPACE,
                "supportSubject": HIGH_VOLUME_SUPPORT_SUBJECT,
                "auditActor": HIGH_VOLUME_AUDIT_ACTOR
            },
            "totalEventCount": total_event_count,
            "fixedBudgetNote": "This static bundle is capped and intentionally not normalized across accounts. Event sections keep full ids, but run and audit identifiers are truncated to mimic a budgeted retrieval snapshot instead of an interactive tool session.",
            "rowFormat": "event sections: eventId|time|source:eventType|u=<user>|a=<account>|c=<conversation>|details=... ; run/audit sections use redacted id fragments only.",
            "staticRetrievals": {
                "authByBillingEmailTopK": auth_by_billing_email,
                "billingByEmailTopK": billing_by_email,
                "workspaceActivityTopK": workspace_activity,
                "supportBySubjectTopK": support_by_subject,
                "runCandidatesTopK": run_candidates,
                "auditByActorTopK": audit_by_actor
            }
        })),
        live_events: vec![],
    })
}

async fn insert_high_volume_noise_events(
    runtime: &ChroniclePlatformRuntime,
    tenant_id: &str,
    base_time: chrono::DateTime<Utc>,
    event_count: usize,
) -> Result<(), String> {
    for batch_start in (0..event_count).step_by(HIGH_VOLUME_INSERT_BATCH_SIZE) {
        let batch_end = (batch_start + HIGH_VOLUME_INSERT_BATCH_SIZE).min(event_count);
        let mut batch = Vec::with_capacity(batch_end - batch_start);
        for index in batch_start..batch_end {
            batch.push(build_high_volume_noise_event(tenant_id, base_time, index));
        }
        runtime
            .events_state
            .store
            .insert_events(&batch)
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn build_high_volume_noise_event(
    tenant_id: &str,
    base_time: chrono::DateTime<Utc>,
    index: usize,
) -> Event {
    // Keep the million-event background corpus safely before the target chronology
    // so clue-driven searches can still surface the relevant incidents near the top.
    let occurred_at = base_time - Duration::days(90) + Duration::milliseconds(index as i64);
    let user_id = format!("usr_eval_hv_noise_{:05}", index % 50_000);
    let account_id = format!("acct_eval_hv_noise_{:05}", index % 50_000);

    match index % 6 {
        0 => EventBuilder::new(tenant_id, "frontend", "auth", "auth.login.succeeded")
            .entity("user", user_id.as_str())
            .entity("account", account_id.as_str())
            .event_time(occurred_at)
            .payload(json!({
                "email": format!("noise-{}@example.com", index % 10_000),
                "authProvider": if index % 2 == 0 { "password" } else { "google" }
            }))
            .build(),
        1 => EventBuilder::new(tenant_id, "frontend", "product", "onboarding.started")
            .entity("account", account_id.as_str())
            .event_time(occurred_at)
            .payload(json!({
                "workspace": format!("workspace-{}", index % 5_000)
            }))
            .build(),
        2 => EventBuilder::new(
            tenant_id,
            "stripe",
            "billing",
            "billing.subscription.activated",
        )
        .entity("account", account_id.as_str())
        .event_time(occurred_at)
        .payload(json!({
            "billingEmail": format!("billing-{}@example.com", index % 8_000),
            "plan": if index % 2 == 0 { "starter" } else { "team" }
        }))
        .build(),
        3 => EventBuilder::new(tenant_id, "chronicle", "workflow", "workflow.run.completed")
            .entity("account", account_id.as_str())
            .entity(
                "workflow",
                format!("wf_noise_{:05}", index % 12_000).as_str(),
            )
            .event_time(occurred_at)
            .payload(json!({
                "template": format!("template-{}", index % 64),
                "status": "completed"
            }))
            .build(),
        4 => EventBuilder::new(tenant_id, "zendesk", "support", "support.ticket.created")
            .entity("account", account_id.as_str())
            .entity(
                "conversation",
                format!("conv_noise_{:05}", index % 20_000).as_str(),
            )
            .event_time(occurred_at)
            .payload(json!({
                "subject": format!("Noise support ticket {}", index % 7_000),
                "priority": if index % 3 == 0 { "high" } else { "low" }
            }))
            .build(),
        _ => EventBuilder::new(
            tenant_id,
            "chronicle",
            "authorization",
            "authorization.role.sync.failed",
        )
        .entity("account", account_id.as_str())
        .entity("workflow", HIGH_VOLUME_WORKFLOW_ID)
        .event_time(occurred_at)
        .payload(json!({
            "actor": "rbac-batch",
            "workspace": format!("workspace-{}", index % 5_000),
            "reason": "stale_membership_snapshot"
        }))
        .build(),
    }
}

fn build_high_volume_role_sync_failed_event(
    tenant_id: &str,
    account_id: &str,
    workspace: &str,
    occurred_at: chrono::DateTime<Utc>,
    failure_reason: &str,
) -> Event {
    EventBuilder::new(
        tenant_id,
        "chronicle",
        "authorization",
        "authorization.role.sync.failed",
    )
    .entity("account", account_id)
    .entity("workflow", HIGH_VOLUME_WORKFLOW_ID)
    .event_time(occurred_at)
    .payload(json!({
        "actor": HIGH_VOLUME_AUDIT_ACTOR,
        "workspace": workspace,
        "featureFlag": "pro_dashboards_v2",
        "reason": failure_reason
    }))
    .build()
}

async fn create_high_volume_failed_run(
    runtime: &ChroniclePlatformRuntime,
    session: &McpSessionContext,
    invocation_id: &str,
    event: &Event,
    account_id: &str,
    workspace: &str,
    billing_email: &str,
    failure_reason: &str,
) -> Result<(Run, AuditLog), String> {
    let run = runtime
        .saas_state
        .runs
        .create(CreateRunInput {
            tenant_id: session.tenant_id.clone(),
            workflow_id: Some(HIGH_VOLUME_WORKFLOW_ID.to_string()),
            event_id: event.event_id.to_string(),
            invocation_id: invocation_id.to_string(),
            mode: "automatic".to_string(),
            event_snapshot: Some(json!({
                "accountId": account_id,
                "workspace": workspace,
                "billingEmail": billing_email
            })),
            context_pointers: Some(json!({
                "timelineEntityType": "account",
                "timelineEntityId": account_id
            })),
        })
        .await
        .map_err(|error| error.to_string())?;

    runtime
        .saas_state
        .runs
        .update_status(&run.id, "failed")
        .await
        .map_err(|error| error.to_string())?;

    runtime
        .saas_state
        .audit_logs
        .create(
            &session.tenant_id,
            "run.created",
            Some(HIGH_VOLUME_AUDIT_ACTOR),
            Some(&run.id),
            Some(&event.event_id.to_string()),
            Some(&run.invocation_id),
            Some(json!({
                "workflowId": HIGH_VOLUME_WORKFLOW_ID,
                "workspace": workspace
            })),
        )
        .await
        .map_err(|error| error.to_string())?;

    runtime
        .saas_state
        .audit_logs
        .create(
            &session.tenant_id,
            "dashboard.permission.rollout.started",
            Some(HIGH_VOLUME_AUDIT_ACTOR),
            Some(&run.id),
            Some(&event.event_id.to_string()),
            Some(&run.invocation_id),
            Some(json!({
                "workspace": workspace,
                "accountId": account_id,
                "flag": "pro_dashboards_v2"
            })),
        )
        .await
        .map_err(|error| error.to_string())?;

    runtime
        .saas_state
        .audit_logs
        .create(
            &session.tenant_id,
            "dashboard.role_sync.failed",
            Some(HIGH_VOLUME_AUDIT_ACTOR),
            Some(&run.id),
            Some(&event.event_id.to_string()),
            Some(&run.invocation_id),
            Some(json!({
                "workspace": workspace,
                "accountId": account_id,
                "reason": failure_reason,
                "targetRole": "dashboard_viewer"
            })),
        )
        .await
        .map_err(|error| error.to_string())
        .map(|audit_log| (run, audit_log))
}

fn high_volume_total_event_count() -> usize {
    std::env::var("CHRONICLE_MCP_HIGH_VOLUME_TOTAL_EVENTS")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(HIGH_VOLUME_TOTAL_EVENT_COUNT_DEFAULT)
        .max(HIGH_VOLUME_TARGET_EVENT_COUNT + HIGH_VOLUME_OVERLAP_DISTRACTOR_EVENT_COUNT)
}

fn compact_high_volume_run_summary(run: &Run, workspace: &str, reason: &str) -> serde_json::Value {
    serde_json::Value::String(format!(
        "run=frag:{}|workflow={}|status={}|workspace={}|reason={}",
        redacted_id_fragment(&run.id),
        run.workflow_id.as_deref().unwrap_or("-"),
        run.status,
        workspace,
        reason
    ))
}

fn compact_high_volume_audit_summary(
    audit_log: &AuditLog,
    workspace: &str,
    reason: &str,
) -> serde_json::Value {
    serde_json::Value::String(format!(
        "audit=frag:{}|actor={}|action={}|run=frag:{}|workspace={}|reason={}",
        redacted_id_fragment(&audit_log.id),
        audit_log.actor.as_deref().unwrap_or("-"),
        audit_log.action,
        audit_log
            .run_id
            .as_deref()
            .map(redacted_id_fragment)
            .unwrap_or_else(|| "-".to_string()),
        workspace,
        reason
    ))
}

fn redacted_id_fragment(identifier: &str) -> String {
    let prefix: String = identifier.chars().take(8).collect();
    let suffix: String = identifier
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    format!("{prefix}...{suffix}")
}

async fn create_link(
    runtime: &ChroniclePlatformRuntime,
    org_id: &OrgId,
    source_event_id: chronicle_core::ids::EventId,
    target_event_id: chronicle_core::ids::EventId,
    link_type: &str,
    reasoning: &str,
) -> Result<(), String> {
    runtime
        .events_state
        .link
        .create_link(
            org_id,
            &EventLink {
                link_id: LinkId::new(),
                source_event_id,
                target_event_id,
                link_type: link_type.to_string(),
                confidence: Confidence::new(0.95).map_err(|error| {
                    ChronicleMcpError::internal(error.to_string())
                        .to_mcp_error()
                        .message
                        .to_string()
                })?,
                reasoning: Some(reasoning.to_string()),
                created_by: "chronicle-mcp-eval".to_string(),
                created_at: Utc::now(),
            },
        )
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn pretty_json(value: &serde_json::Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string())
}

fn compact_json(value: &serde_json::Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| value.to_string())
}

fn compact_story_event_summary(
    event: &Event,
    occurred_at: chrono::DateTime<Utc>,
    source: &str,
    _topic: &str,
    event_type: &str,
    user_id: Option<&str>,
    account_id: Option<&str>,
    conversation_id: Option<&str>,
    details: serde_json::Value,
) -> serde_json::Value {
    serde_json::Value::String(format!(
        "{}|{}|{}:{}|u={}|a={}|c={}|details={}",
        event.event_id,
        occurred_at.to_rfc3339(),
        source,
        event_type,
        user_id.unwrap_or("-"),
        account_id.unwrap_or("-"),
        conversation_id.unwrap_or("-"),
        compact_json(&details)
    ))
}

fn compact_story_noise_summary(
    row_id: &str,
    source: &str,
    event_type: &str,
    user_id: Option<&str>,
    account_id: Option<&str>,
    conversation_id: Option<&str>,
    details: &str,
) -> serde_json::Value {
    serde_json::Value::String(format!(
        "{}|{}:{}|u={}|a={}|c={}|{}",
        row_id,
        source,
        event_type,
        user_id.unwrap_or("-"),
        account_id.unwrap_or("-"),
        conversation_id.unwrap_or("-"),
        details
    ))
}

fn build_user_story_overlap_distractor_chain(
    tenant_id: &str,
    base_time: chrono::DateTime<Utc>,
    chain_key: &str,
    billing_email: &str,
    workspace: &str,
    support_subject: &str,
    minute_offset: i64,
) -> Vec<(Event, serde_json::Value)> {
    let user_id = format!("usr_eval_story_overlap_{chain_key}");
    let account_id = format!("acct_eval_story_overlap_{chain_key}");
    let conversation_id = format!("conv_eval_story_overlap_{chain_key}");
    let login_time = base_time + Duration::minutes(minute_offset);
    let onboarding_time = login_time + Duration::minutes(2);
    let subscription_time = login_time + Duration::minutes(27);
    let support_time = login_time + Duration::minutes(61);

    let login_event = EventBuilder::new(tenant_id, "frontend", "auth", "auth.login.succeeded")
        .entity("user", user_id.as_str())
        .entity("account", account_id.as_str())
        .event_time(login_time)
        .payload(json!({
            "email": billing_email,
            "authProvider": "password"
        }))
        .build();

    let onboarding_event =
        EventBuilder::new(tenant_id, "frontend", "product", "onboarding.started")
            .entity("user", user_id.as_str())
            .entity("account", account_id.as_str())
            .event_time(onboarding_time)
            .payload(json!({
                "workspace": workspace,
                "checklist": ["connect_source", "create_workflow"]
            }))
            .build();

    let subscription_event = EventBuilder::new(
        tenant_id,
        "stripe",
        "billing",
        "billing.subscription.activated",
    )
    .entity("account", account_id.as_str())
    .event_time(subscription_time)
    .payload(json!({
        "plan": "pro",
        "status": "active",
        "billingEmail": billing_email
    }))
    .build();

    let support_event =
        EventBuilder::new(tenant_id, "zendesk", "support", "support.ticket.created")
            .entity("account", account_id.as_str())
            .entity("conversation", conversation_id.as_str())
            .event_time(support_time)
            .payload(json!({
                "subject": support_subject,
                "priority": "normal",
                "text": format!("Support follow-up for overlap chain {chain_key}.")
            }))
            .build();

    vec![
        (
            login_event.clone(),
            compact_story_event_summary(
                &login_event,
                login_time,
                "frontend",
                "auth",
                "auth.login.succeeded",
                Some(&user_id),
                None,
                None,
                json!({
                    "email": billing_email,
                    "authProvider": "password"
                }),
            ),
        ),
        (
            onboarding_event.clone(),
            compact_story_event_summary(
                &onboarding_event,
                onboarding_time,
                "frontend",
                "product",
                "onboarding.started",
                Some(&user_id),
                Some(&account_id),
                None,
                json!({
                    "workspace": workspace
                }),
            ),
        ),
        (
            subscription_event.clone(),
            compact_story_event_summary(
                &subscription_event,
                subscription_time,
                "stripe",
                "billing",
                "billing.subscription.activated",
                None,
                Some(&account_id),
                None,
                json!({
                    "plan": "pro",
                    "billingEmail": billing_email
                }),
            ),
        ),
        (
            support_event.clone(),
            compact_story_event_summary(
                &support_event,
                support_time,
                "zendesk",
                "support",
                "support.ticket.created",
                None,
                Some(&account_id),
                Some(&conversation_id),
                json!({
                    "subject": support_subject,
                    "priority": "normal"
                }),
            ),
        ),
    ]
}

fn build_user_story_distractor_event(
    tenant_id: &str,
    base_time: chrono::DateTime<Utc>,
    index: usize,
) -> (Event, serde_json::Value) {
    let occurred_at = base_time - Duration::hours(24) + Duration::seconds((index as i64 * 9) + 5);
    let user_id = format!("usr_eval_story_noise_{:03}", index % 240);
    let account_id = format!("acct_eval_story_noise_{:03}", index % 240);
    let similar_user_reference = match index % 41 {
        0 => Some("usr_eval_story_011"),
        7 => Some("usr_eval_story_001_shadow"),
        _ => None,
    };

    match index % 5 {
        0 => {
            let event = EventBuilder::new(tenant_id, "frontend", "auth", "auth.login.succeeded")
                .entity("user", user_id.as_str())
                .entity("account", account_id.as_str())
                .event_time(occurred_at)
                .payload(json!({
                    "email": format!("noise-user-{index}@example.com"),
                    "authProvider": if index % 2 == 0 { "password" } else { "google" },
                    "mentionedUserId": similar_user_reference
                }))
                .build();

            (
                event.clone(),
                compact_story_noise_summary(
                    &format!("noise-{index:04}"),
                    "frontend",
                    "auth.login.succeeded",
                    Some(&user_id),
                    None,
                    None,
                    &format!(
                        "email=noise-user-{index}@example.com auth={} ref={}",
                        if index % 2 == 0 { "password" } else { "google" },
                        similar_user_reference.unwrap_or("-")
                    ),
                ),
            )
        }
        1 => {
            let workspace = format!("workspace-{:03}", index % 75);
            let event = EventBuilder::new(tenant_id, "frontend", "product", "onboarding.started")
                .entity("user", user_id.as_str())
                .entity("account", account_id.as_str())
                .event_time(occurred_at)
                .payload(json!({
                    "workspace": workspace,
                    "checklist": ["connect_source", "invite_teammate"]
                }))
                .build();

            (
                event.clone(),
                compact_story_noise_summary(
                    &format!("noise-{index:04}"),
                    "frontend",
                    "onboarding.started",
                    Some(&user_id),
                    Some(&account_id),
                    None,
                    &format!("workspace={workspace}"),
                ),
            )
        }
        2 => {
            let workflow_id = format!("wf_eval_story_noise_{:03}", index % 90);
            let event =
                EventBuilder::new(tenant_id, "chronicle", "workflow", "workflow.run.completed")
                    .entity("user", user_id.as_str())
                    .entity("account", account_id.as_str())
                    .entity("workflow", workflow_id.as_str())
                    .event_time(occurred_at)
                    .payload(json!({
                        "status": "completed",
                        "template": format!("template-{:02}", index % 18),
                        "mentionedUserId": similar_user_reference
                    }))
                    .build();

            (
                event.clone(),
                compact_story_noise_summary(
                    &format!("noise-{index:04}"),
                    "chronicle",
                    "workflow.run.completed",
                    None,
                    Some(&account_id),
                    None,
                    &format!(
                        "workflow={} template=template-{:02} ref={}",
                        workflow_id,
                        index % 18,
                        similar_user_reference.unwrap_or("-")
                    ),
                ),
            )
        }
        3 => {
            let plan = if index % 2 == 0 { "starter" } else { "team" };
            let event =
                EventBuilder::new(tenant_id, "stripe", "billing", "billing.checkout.started")
                    .entity("user", user_id.as_str())
                    .entity("account", account_id.as_str())
                    .event_time(occurred_at)
                    .payload(json!({
                        "plan": plan,
                        "interval": "monthly",
                        "amount": if plan == "starter" { 1900 } else { 9900 }
                    }))
                    .build();

            (
                event.clone(),
                compact_story_noise_summary(
                    &format!("noise-{index:04}"),
                    "stripe",
                    "billing.checkout.started",
                    None,
                    Some(&account_id),
                    None,
                    &format!(
                        "plan={} amount={}",
                        plan,
                        if plan == "starter" { 1900 } else { 9900 }
                    ),
                ),
            )
        }
        _ => {
            let conversation_id = format!("conv_eval_story_noise_{:03}", index % 160);
            let event =
                EventBuilder::new(tenant_id, "zendesk", "support", "support.ticket.created")
                    .entity("user", user_id.as_str())
                    .entity("account", account_id.as_str())
                    .entity("conversation", conversation_id.as_str())
                    .event_time(occurred_at)
                    .payload(json!({
                        "subject": format!("Noise support ticket {index}"),
                        "priority": if index % 3 == 0 { "high" } else { "low" },
                        "text": format!(
                            "Ticket references {} while investigating workspace access.",
                            similar_user_reference.unwrap_or("no related user")
                        )
                    }))
                    .build();

            (
                event.clone(),
                compact_story_noise_summary(
                    &format!("noise-{index:04}"),
                    "zendesk",
                    "support.ticket.created",
                    None,
                    Some(&account_id),
                    Some(&conversation_id),
                    &format!(
                        "priority={} ref={}",
                        if index % 3 == 0 { "high" } else { "low" },
                        similar_user_reference.unwrap_or("-")
                    ),
                ),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use chronicle_infra::StoreBackend;

    use super::*;
    use crate::ChronicleMcpEvalMatrix;

    #[tokio::test]
    #[ignore = "stress test for the 1M-event high-volume seed"]
    async fn high_volume_multi_hop_story_seeds_one_million_events() {
        let scenario = ChronicleMcpEvalMatrix::default()
            .scenarios
            .into_iter()
            .find(|scenario| scenario.id == "high_volume_multi_hop_story")
            .expect("high-volume scenario should exist");

        let seeded = build_seeded_eval_scenario(&scenario)
            .await
            .expect("high-volume scenario should seed");

        let event_count = match seeded.runtime.store_backend.as_ref() {
            StoreBackend::Memory(store) => store.backend().event_count(),
            _ => panic!("expected in-memory store backend"),
        };
        assert_eq!(event_count, HIGH_VOLUME_TOTAL_EVENT_COUNT_DEFAULT);

        let context_dump: serde_json::Value =
            serde_json::from_str(&seeded.context_dump).expect("context dump should be json");
        assert_eq!(
            context_dump["totalEventCount"],
            serde_json::json!(HIGH_VOLUME_TOTAL_EVENT_COUNT_DEFAULT)
        );

        let session = McpSessionContext::from(eval_user(&scenario));
        let run_count = seeded
            .runtime
            .saas_state
            .runs
            .count_by_tenant(&session.tenant_id)
            .await
            .expect("run count should succeed");
        let audit_logs = seeded
            .runtime
            .saas_state
            .audit_logs
            .list_by_tenant(&session.tenant_id, 100, 0)
            .await
            .expect("audit log listing should succeed");

        assert_eq!(run_count, 4);
        assert_eq!(audit_logs.len(), 12);
        assert_eq!(seeded.expected_citations.len(), 2);
        assert!(seeded
            .expected_citations
            .iter()
            .all(|citation| !citation.is_empty()));
    }
}
