use std::sync::Arc;
use std::time::Duration;

use chronicle_auth::types::AuthUser;
use chronicle_backend::{config, runtime};
use chronicle_core::event::EventBuilder;
use chronicle_domain::{Actor, CreateRunInput, EventEnvelope, Subject};
use chronicle_mcp::{
    ChronicleMcpDataAccess, EventQueryInput, InProcessChronicleMcpDataAccess, ListRunsInput,
    McpSessionContext, ReplayTimelineInput, WatchEventsInput,
};
use serde_json::value::RawValue;

fn session() -> McpSessionContext {
    AuthUser {
        id: "user_test".to_string(),
        email: "test@chronicle.dev".to_string(),
        name: Some("Test User".to_string()),
        role: "owner".to_string(),
        tenant_id: "tenant_test".to_string(),
        tenant_name: "Chronicle Test".to_string(),
        tenant_slug: "chronicle-test".to_string(),
    }
    .into()
}

async fn build_memory_data_access() -> (
    InProcessChronicleMcpDataAccess,
    runtime::ChroniclePlatformRuntime,
    McpSessionContext,
) {
    let runtime = runtime::build_platform_runtime(&config::LaunchConfig::default())
        .await
        .expect("memory runtime should build");
    let session = session();

    runtime
        .saas_state
        .tenants
        .create(chronicle_domain::CreateTenantInput {
            name: session.tenant_name.clone(),
            slug: session.tenant_slug.clone(),
        })
        .await
        .expect("tenant should be created");

    (
        InProcessChronicleMcpDataAccess::new(
            runtime.events_state.clone(),
            runtime.saas_state.clone(),
            Arc::clone(&runtime.stream_backend),
        ),
        runtime,
        session,
    )
}

#[tokio::test]
async fn query_events_is_tenant_scoped() {
    let (data_access, runtime, session) = build_memory_data_access().await;
    let own_event = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "payments",
        "charge.created",
    )
    .entity("customer", "cust_1")
    .build();
    let other_event = EventBuilder::new("tenant_other", "stripe", "payments", "charge.created")
        .entity("customer", "cust_1")
        .build();
    runtime
        .events_state
        .store
        .insert_events(&[own_event, other_event])
        .await
        .expect("events should insert");

    let result = data_access
        .query_events(
            &session,
            EventQueryInput {
                source: Some("stripe".to_string()),
                topic: Some("payments".to_string()),
                event_type: Some("charge.created".to_string()),
                entity_type: Some("customer".to_string()),
                entity_id: Some("cust_1".to_string()),
                since_days: None,
                limit: Some(10),
                offset: Some(0),
            },
        )
        .await
        .expect("query should succeed");

    assert_eq!(result.count, 1);
    assert_eq!(result.events[0].event.org_id.as_str(), session.tenant_id);
}

#[tokio::test]
async fn list_runs_and_get_run_include_audit_logs() {
    let (data_access, runtime, session) = build_memory_data_access().await;
    let run = runtime
        .saas_state
        .runs
        .create(CreateRunInput {
            tenant_id: session.tenant_id.clone(),
            workflow_id: Some("wf_test".to_string()),
            event_id: "evt_seed".to_string(),
            invocation_id: "invocation_1".to_string(),
            mode: "auto".to_string(),
            event_snapshot: None,
            context_pointers: None,
        })
        .await
        .expect("run should be created");
    runtime
        .saas_state
        .audit_logs
        .create(
            &session.tenant_id,
            "run.created",
            Some(&session.user_id),
            Some(&run.id),
            Some(&run.event_id),
            Some(&run.invocation_id),
            None,
        )
        .await
        .expect("audit log should be created");

    let runs = data_access
        .list_runs(
            &session,
            ListRunsInput {
                status: None,
                limit: Some(10),
                offset: Some(0),
            },
        )
        .await
        .expect("runs should list");
    assert_eq!(runs.total, 1);

    let detail = data_access
        .get_run(&session, &run.id)
        .await
        .expect("run detail should load");
    assert_eq!(detail.run.id, run.id);
    assert_eq!(detail.audit_logs.len(), 1);
}

#[tokio::test]
async fn watch_events_collects_matching_live_events() {
    let (data_access, runtime, session) = build_memory_data_access().await;
    let data_access = Arc::new(data_access);
    let watch_access = Arc::clone(&data_access);
    let watch_session = session.clone();

    let watch_handle = tokio::spawn(async move {
        watch_access
            .watch_events(
                &watch_session,
                WatchEventsInput {
                    source: Some("zendesk".to_string()),
                    event_type: Some("ticket.created".to_string()),
                    subject_id: Some("conv_live".to_string()),
                    payload_contains: Some("enterprise".to_string()),
                    limit: Some(1),
                    wait_seconds: Some(2),
                },
            )
            .await
            .expect("watch should succeed")
    });

    tokio::time::sleep(Duration::from_millis(50)).await;

    let payload = RawValue::from_string(r#"{"plan":"enterprise"}"#.to_string())
        .expect("payload should be valid json");
    runtime
        .stream_backend
        .publish(EventEnvelope::new(
            session.tenant_id.as_str(),
            "zendesk",
            "src_evt_live",
            "ticket.created",
            Subject::new("conv_live"),
            Actor::system(),
            payload,
        ))
        .await
        .expect("event should publish");

    let watched = watch_handle.await.expect("watch task should complete");
    assert_eq!(watched.collected, 1);
    assert_eq!(watched.events[0].source, "zendesk");
}

#[tokio::test]
async fn replay_timeline_orders_events_chronologically() {
    let (data_access, runtime, session) = build_memory_data_access().await;
    let now = chrono::Utc::now();
    let later = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "payments",
        "charge.succeeded",
    )
    .entity("customer", "cust_replay")
    .event_time(now)
    .build();
    let earlier = EventBuilder::new(
        session.tenant_id.as_str(),
        "stripe",
        "payments",
        "charge.created",
    )
    .entity("customer", "cust_replay")
    .event_time(now - chrono::Duration::minutes(5))
    .build();
    runtime
        .events_state
        .store
        .insert_events(&[later, earlier])
        .await
        .expect("events should insert");

    let replay = data_access
        .replay_timeline(
            &session,
            ReplayTimelineInput {
                entity_type: "customer".to_string(),
                entity_id: "cust_replay".to_string(),
                since_days: Some(30),
                limit: Some(10),
            },
        )
        .await
        .expect("replay should succeed");

    assert_eq!(replay.count, 2);
    assert!(replay.events[0].event.event_time <= replay.events[1].event.event_time);
}

#[tokio::test]
async fn postgres_runtime_smoke_if_database_is_configured() {
    let Some(database_url) = std::env::var("CHRONICLE_MCP_TEST_DATABASE_URL").ok() else {
        return;
    };

    let mut launch_config = config::LaunchConfig::default();
    launch_config.storage.events.backend = config::BackendKind::Postgres;
    launch_config.storage.events.database_url = Some(database_url.clone());
    launch_config.storage.saas.backend = config::BackendKind::Postgres;
    launch_config.storage.saas.database_url = Some(database_url);

    let runtime = runtime::build_platform_runtime(&launch_config)
        .await
        .expect("postgres runtime should build");
    let data_access = InProcessChronicleMcpDataAccess::new(
        runtime.events_state.clone(),
        runtime.saas_state.clone(),
        Arc::clone(&runtime.stream_backend),
    );
    let session = session();

    runtime
        .saas_state
        .tenants
        .create(chronicle_domain::CreateTenantInput {
            name: session.tenant_name.clone(),
            slug: format!("{}-pg", session.tenant_slug),
        })
        .await
        .ok();

    let runs = data_access
        .list_runs(
            &session,
            ListRunsInput {
                status: None,
                limit: Some(5),
                offset: Some(0),
            },
        )
        .await
        .expect("list runs should work against postgres");

    assert_eq!(runs.limit, 5);
}
