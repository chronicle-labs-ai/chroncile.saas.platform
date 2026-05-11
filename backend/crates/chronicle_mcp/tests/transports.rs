use std::sync::Arc;

use axum::Router;
use chronicle_auth::types::AuthUser;
use chronicle_backend::{config, runtime};
use chronicle_domain::CreateTenantInput;
use chronicle_mcp::{
    ChronicleMcpAuthResolver, ChronicleMcpServer, ChronicleMcpServerOptions,
    InProcessChronicleMcpDataAccess,
};
use rmcp::{
    model::{CallToolRequestParams, ReadResourceRequestParams},
    transport::{
        streamable_http_server::{
            session::local::LocalSessionManager, tower::StreamableHttpService,
        },
        StreamableHttpServerConfig,
    },
    ClientHandler, ServiceExt,
};
use serde_json::json;

const TENANT_CONTEXT_URI: &str = "chronicle://tenant/context";

#[derive(Default, Clone)]
struct TestClient;

impl ClientHandler for TestClient {}

fn test_user() -> AuthUser {
    AuthUser {
        id: "user_transport".to_string(),
        email: "transport@chronicle.dev".to_string(),
        name: Some("Transport Test".to_string()),
        role: "owner".to_string(),
        tenant_id: "tenant_transport".to_string(),
        tenant_name: "Chronicle Transport".to_string(),
        tenant_slug: "chronicle-transport".to_string(),
    }
}

async fn build_server(http_mode: bool) -> anyhow::Result<(ChronicleMcpServer, String)> {
    let runtime = runtime::build_platform_runtime(&config::LaunchConfig::default()).await?;
    let user = test_user();
    runtime
        .saas_state
        .tenants
        .create(CreateTenantInput {
            name: user.tenant_name.clone(),
            slug: user.tenant_slug.clone(),
        })
        .await
        .ok();

    let token = runtime.saas_state.jwt.issue(&user)?;
    let auth = if http_mode {
        ChronicleMcpAuthResolver::for_http(runtime.saas_state.jwt.clone())
    } else {
        ChronicleMcpAuthResolver::for_stdio(runtime.saas_state.jwt.clone(), &token)
            .map_err(|error| anyhow::anyhow!(error.to_mcp_error().message.to_string()))?
    };
    let data_access = Arc::new(InProcessChronicleMcpDataAccess::new(
        runtime.events_state.clone(),
        runtime.saas_state.clone(),
        Arc::clone(&runtime.stream_backend),
    ));

    Ok((
        ChronicleMcpServer::new(auth, data_access, ChronicleMcpServerOptions::default()),
        token,
    ))
}

#[tokio::test]
async fn stdio_transport_lists_tools_and_reads_resources() -> anyhow::Result<()> {
    let (server, _token): (ChronicleMcpServer, String) = build_server(false).await?;
    let (server_transport, client_transport) = tokio::io::duplex(16 * 1024);

    let server_handle = tokio::spawn(async move {
        server.serve(server_transport).await?.waiting().await?;
        anyhow::Ok(())
    });

    let client = TestClient.serve(client_transport).await?;
    let tools = client.list_all_tools().await?;
    assert!(tools.iter().any(|tool| tool.name == "list_runs"));

    let resource = client
        .read_resource(ReadResourceRequestParams::new(TENANT_CONTEXT_URI))
        .await?;
    assert_eq!(resource.contents.len(), 1);

    let tool_result = client
        .call_tool(CallToolRequestParams::new("describe_sources"))
        .await?;
    assert!(tool_result.structured_content.is_some());

    client.cancel().await?;
    server_handle.await??;
    Ok(())
}

#[tokio::test]
async fn streamable_http_transport_accepts_bearer_token() -> anyhow::Result<()> {
    let (server, token): (ChronicleMcpServer, String) = build_server(true).await?;
    let service: StreamableHttpService<ChronicleMcpServer, LocalSessionManager> =
        StreamableHttpService::new(
            move || Ok(server.clone()),
            LocalSessionManager::default().into(),
            StreamableHttpServerConfig {
                stateful_mode: false,
                json_response: true,
                ..Default::default()
            },
        );

    let app = Router::new().nest_service("/mcp", service);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let server_handle = tokio::spawn(async move { axum::serve(listener, app).await });

    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();
    let initialize = client
        .post(format!("http://127.0.0.1:{port}/mcp"))
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(
            reqwest::header::ACCEPT,
            "application/json, text/event-stream",
        )
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "chronicle-mcp-test",
                    "version": "0.1.0"
                }
            }
        }))
        .send()
        .await?;
    assert!(initialize.status().is_success());
    let initialize_body: serde_json::Value = initialize.json().await?;
    assert!(initialize_body["result"]["capabilities"]["tools"].is_object());
    let protocol_version = initialize_body["result"]["protocolVersion"]
        .as_str()
        .unwrap_or("2024-11-05")
        .to_string();

    let tool_call = client
        .post(format!("http://127.0.0.1:{port}/mcp"))
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(
            reqwest::header::ACCEPT,
            "application/json, text/event-stream",
        )
        .header("mcp-protocol-version", &protocol_version)
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "list_runs",
                "arguments": {}
            }
        }))
        .send()
        .await?;
    assert!(tool_call.status().is_success());
    let tool_body: serde_json::Value = tool_call.json().await?;
    assert!(
        tool_body["result"]["structuredContent"].is_object(),
        "unexpected tool response: {tool_body}"
    );

    server_handle.abort();
    Ok(())
}
