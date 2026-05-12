use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::Response,
    Router,
};
use chronicle_auth::{types::AuthUser, workos_jwt::WorkosJwtVerifier};
use chronicle_interfaces::{TenantRepository, UserRepository};

use crate::auth::validate_workos_token;
use chronicle_backend::runtime::ChroniclePlatformRuntime;
use chronicle_domain::EventEnvelope;
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use rmcp::{
    model::{CallToolRequestParams, CallToolResult, JsonObject, ListToolsResult, Tool},
    transport::{
        streamable_http_server::{
            session::local::LocalSessionManager, tower::StreamableHttpService,
        },
        StreamableHttpServerConfig,
    },
    ClientHandler, ServiceExt,
};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use tokio::{net::TcpListener, sync::Mutex, task::JoinHandle};

use crate::{
    ChronicleMcpAuthResolver, ChronicleMcpServer, ChronicleMcpServerOptions,
    InProcessChronicleMcpDataAccess, McpEvalTransport,
};

const HTTP_ACCEPT_HEADER: &str = "application/json, text/event-stream";
const EVAL_QUERY_LIMIT: u64 = 6;
const EVAL_SEARCH_LIMIT: u64 = 4;
const EVAL_LIST_LIMIT: u64 = 5;
const EVAL_WATCH_LIMIT: u64 = 5;
const EVAL_WATCH_WAIT_SECONDS: u64 = 5;

#[derive(Debug, Clone)]
pub struct ToolCallPayload {
    pub payload: Value,
    pub is_error: bool,
}

#[async_trait]
pub trait EvalTransportClient: Send {
    async fn list_tools(&mut self) -> Result<Vec<Tool>, String>;
    async fn call_tool(
        &mut self,
        name: &str,
        arguments: JsonObject,
    ) -> Result<ToolCallPayload, String>;
    async fn shutdown(self: Box<Self>) -> Result<(), String>;
}

pub async fn connect_eval_transport(
    transport: McpEvalTransport,
    runtime: ChroniclePlatformRuntime,
    auth_token: String,
    live_events: Vec<EventEnvelope>,
    enable_replay: bool,
) -> Result<Box<dyn EvalTransportClient>, String> {
    match transport {
        McpEvalTransport::Stdio => {
            let client =
                StdioEvalTransportClient::connect(runtime, auth_token, live_events, enable_replay)
                    .await?;
            Ok(Box::new(client))
        }
        McpEvalTransport::StreamableHttp => {
            let client =
                HttpEvalTransportClient::connect(runtime, auth_token, live_events, enable_replay)
                    .await?;
            Ok(Box::new(client))
        }
    }
}

#[derive(Default, Clone)]
struct EvalClientHandler;

impl ClientHandler for EvalClientHandler {}

struct StdioEvalTransportClient {
    client: rmcp::service::RunningService<rmcp::RoleClient, EvalClientHandler>,
    server_handle: JoinHandle<Result<(), String>>,
    live_events: Arc<Mutex<Option<Vec<EventEnvelope>>>>,
    stream_backend: Arc<chronicle_infra::StreamBackend>,
}

impl StdioEvalTransportClient {
    async fn connect(
        runtime: ChroniclePlatformRuntime,
        auth_token: String,
        live_events: Vec<EventEnvelope>,
        enable_replay: bool,
    ) -> Result<Self, String> {
        let auth = ChronicleMcpAuthResolver::for_stdio(
            runtime.saas_state.workos_jwt.clone(),
            runtime.saas_state.users.clone(),
            runtime.saas_state.tenants.clone(),
            &auth_token,
        )
        .await
        .map_err(|error| error.to_mcp_error().message.to_string())?;
        let data_access = Arc::new(InProcessChronicleMcpDataAccess::new(
            runtime.events_state.clone(),
            runtime.saas_state.clone(),
            Arc::clone(&runtime.stream_backend),
        ));
        let server = ChronicleMcpServer::new(
            auth,
            data_access,
            ChronicleMcpServerOptions { enable_replay },
        );

        let (server_transport, client_transport) = tokio::io::duplex(64 * 1024);
        let server_handle = tokio::spawn(async move {
            let service = server
                .serve(server_transport)
                .await
                .map_err(|error| error.to_string())?;
            service
                .waiting()
                .await
                .map_err(|error| error.to_string())
                .map(|_| ())
        });

        let client = EvalClientHandler
            .serve(client_transport)
            .await
            .map_err(|error| error.to_string())?;

        Ok(Self {
            client,
            server_handle,
            live_events: Arc::new(Mutex::new(Some(live_events))),
            stream_backend: runtime.stream_backend,
        })
    }
}

#[async_trait]
impl EvalTransportClient for StdioEvalTransportClient {
    async fn list_tools(&mut self) -> Result<Vec<Tool>, String> {
        self.client
            .list_all_tools()
            .await
            .map_err(|error| error.to_string())
    }

    async fn call_tool(
        &mut self,
        name: &str,
        arguments: JsonObject,
    ) -> Result<ToolCallPayload, String> {
        let arguments = constrain_eval_tool_arguments(name, arguments);
        maybe_spawn_live_events(name, &self.live_events, Arc::clone(&self.stream_backend)).await;

        let result = self
            .client
            .call_tool(CallToolRequestParams::new(name.to_string()).with_arguments(arguments))
            .await
            .map_err(|error| error.to_string())?;
        Ok(tool_call_payload(result))
    }

    async fn shutdown(mut self: Box<Self>) -> Result<(), String> {
        self.client
            .cancel()
            .await
            .map_err(|error| error.to_string())?;
        self.server_handle
            .await
            .map_err(|error| error.to_string())??;
        Ok(())
    }
}

struct HttpEvalTransportClient {
    http_client: reqwest::Client,
    endpoint: String,
    auth_token: String,
    protocol_version: String,
    next_request_id: u64,
    server_handle: JoinHandle<Result<(), String>>,
    live_events: Arc<Mutex<Option<Vec<EventEnvelope>>>>,
    stream_backend: Arc<chronicle_infra::StreamBackend>,
}

impl HttpEvalTransportClient {
    async fn connect(
        runtime: ChroniclePlatformRuntime,
        auth_token: String,
        live_events: Vec<EventEnvelope>,
        enable_replay: bool,
    ) -> Result<Self, String> {
        let auth = ChronicleMcpAuthResolver::for_http(
            runtime.saas_state.workos_jwt.clone(),
            runtime.saas_state.users.clone(),
            runtime.saas_state.tenants.clone(),
        );
        let workos_jwt = runtime.saas_state.workos_jwt.clone();
        let users_repo = runtime.saas_state.users.clone();
        let tenants_repo = runtime.saas_state.tenants.clone();
        let data_access = Arc::new(InProcessChronicleMcpDataAccess::new(
            runtime.events_state.clone(),
            runtime.saas_state.clone(),
            Arc::clone(&runtime.stream_backend),
        ));
        let server = ChronicleMcpServer::new(
            auth,
            data_access,
            ChronicleMcpServerOptions { enable_replay },
        );
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

        let mw_state = AuthMwState {
            workos_jwt,
            users: users_repo,
            tenants: tenants_repo,
        };
        let app = Router::new()
            .nest_service("/mcp", service)
            .layer(middleware::from_fn_with_state(mw_state, auth_middleware));

        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|error| error.to_string())?;
        let port = listener
            .local_addr()
            .map_err(|error| error.to_string())?
            .port();
        let server_handle = tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .map_err(|error| error.to_string())
        });

        tokio::time::sleep(Duration::from_millis(100)).await;

        let mut client = Self {
            http_client: reqwest::Client::new(),
            endpoint: format!("http://127.0.0.1:{port}/mcp"),
            auth_token,
            protocol_version: "2024-11-05".to_string(),
            next_request_id: 1,
            server_handle,
            live_events: Arc::new(Mutex::new(Some(live_events))),
            stream_backend: runtime.stream_backend,
        };

        client.initialize().await?;
        Ok(client)
    }

    async fn initialize(&mut self) -> Result<(), String> {
        let response = self
            .send_request::<Value>(
                "initialize",
                json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {
                        "name": "chronicle-mcp-anthropic-eval",
                        "version": "0.1.0"
                    }
                }),
                false,
            )
            .await?;

        if let Some(version) = response
            .get("protocolVersion")
            .and_then(|value| value.as_str())
        {
            self.protocol_version = version.to_string();
        }
        Ok(())
    }

    async fn send_request<T: DeserializeOwned>(
        &mut self,
        method: &str,
        params: Value,
        include_protocol_version: bool,
    ) -> Result<T, String> {
        let request_id = self.next_request_id;
        self.next_request_id += 1;

        let mut request = self
            .http_client
            .post(&self.endpoint)
            .header(AUTHORIZATION, format!("Bearer {}", self.auth_token))
            .header(ACCEPT, HTTP_ACCEPT_HEADER)
            .header(CONTENT_TYPE, "application/json")
            .json(&json!({
                "jsonrpc": "2.0",
                "id": request_id,
                "method": method,
                "params": params,
            }));

        if include_protocol_version {
            request = request.header("mcp-protocol-version", &self.protocol_version);
        }

        let response = request.send().await.map_err(|error| error.to_string())?;
        let status = response.status();
        let body = response.text().await.map_err(|error| error.to_string())?;
        if !status.is_success() {
            return Err(format!("HTTP MCP request failed with {status}: {body}"));
        }

        let payload: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
        if let Some(error) = payload.get("error") {
            return Err(error.to_string());
        }

        serde_json::from_value(payload["result"].clone()).map_err(|error| error.to_string())
    }
}

#[async_trait]
impl EvalTransportClient for HttpEvalTransportClient {
    async fn list_tools(&mut self) -> Result<Vec<Tool>, String> {
        let result: ListToolsResult = self.send_request("tools/list", json!({}), true).await?;
        Ok(result.tools)
    }

    async fn call_tool(
        &mut self,
        name: &str,
        arguments: JsonObject,
    ) -> Result<ToolCallPayload, String> {
        let arguments = constrain_eval_tool_arguments(name, arguments);
        maybe_spawn_live_events(name, &self.live_events, Arc::clone(&self.stream_backend)).await;

        let result: CallToolResult = self
            .send_request(
                "tools/call",
                json!({
                    "name": name,
                    "arguments": arguments,
                }),
                true,
            )
            .await?;
        Ok(tool_call_payload(result))
    }

    async fn shutdown(self: Box<Self>) -> Result<(), String> {
        self.server_handle.abort();
        Ok(())
    }
}

#[derive(Clone)]
struct AuthMwState {
    workos_jwt: Arc<WorkosJwtVerifier>,
    users: Arc<dyn UserRepository>,
    tenants: Arc<dyn TenantRepository>,
}

async fn auth_middleware(
    State(state): State<AuthMwState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let user = validate_workos_token(&state.workos_jwt, &state.users, &state.tenants, token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    request.extensions_mut().insert::<AuthUser>(user);
    Ok(next.run(request).await)
}

async fn maybe_spawn_live_events(
    tool_name: &str,
    live_events: &Arc<Mutex<Option<Vec<EventEnvelope>>>>,
    stream_backend: Arc<chronicle_infra::StreamBackend>,
) {
    if tool_name != "watch_events" {
        return;
    }

    let events = live_events.lock().await.take();
    let Some(events) = events else {
        return;
    };

    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(250)).await;
        for event in events {
            let _ = stream_backend.publish(event).await;
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    });
}

fn tool_call_payload(result: CallToolResult) -> ToolCallPayload {
    ToolCallPayload {
        payload: result
            .structured_content
            .unwrap_or_else(|| json!({ "content": result.content })),
        is_error: result.is_error.unwrap_or(false),
    }
}

fn constrain_eval_tool_arguments(name: &str, mut arguments: JsonObject) -> JsonObject {
    match name {
        "query_events" | "replay_timeline" => {
            clamp_limit_argument(&mut arguments, EVAL_QUERY_LIMIT);
        }
        "search_events" => {
            clamp_limit_argument(&mut arguments, EVAL_SEARCH_LIMIT);
        }
        "list_runs" | "list_audit_logs" => {
            clamp_limit_argument(&mut arguments, EVAL_LIST_LIMIT);
        }
        "watch_events" => {
            clamp_limit_argument(&mut arguments, EVAL_WATCH_LIMIT);
            clamp_wait_seconds_argument(&mut arguments, EVAL_WATCH_WAIT_SECONDS);
        }
        _ => {}
    }
    arguments
}

fn clamp_limit_argument(arguments: &mut JsonObject, max_limit: u64) {
    match arguments.get_mut("limit") {
        Some(value) => {
            if value
                .as_u64()
                .map(|current| current > max_limit)
                .unwrap_or(true)
            {
                *value = json!(max_limit);
            }
        }
        None => {
            arguments.insert("limit".to_string(), json!(max_limit));
        }
    }
}

fn clamp_wait_seconds_argument(arguments: &mut JsonObject, max_wait_seconds: u64) {
    match arguments.get_mut("wait_seconds") {
        Some(value) => {
            if value
                .as_u64()
                .map(|current| current > max_wait_seconds)
                .unwrap_or(true)
            {
                *value = json!(max_wait_seconds);
            }
        }
        None => {
            arguments.insert("wait_seconds".to_string(), json!(max_wait_seconds));
        }
    }
}
