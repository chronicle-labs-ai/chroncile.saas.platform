use std::sync::Arc;

use axum::http::request::Parts;
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    schemars,
    service::RequestContext,
    tool, tool_handler, tool_router, ErrorData as McpError, RoleServer, ServerHandler,
};
use serde_json::json;
use tokio::sync::RwLock;

use crate::auth::{ChronicleMcpAuthResolver, McpSessionContext};
use crate::data_access::{
    ChronicleMcpDataAccess, EventQueryInput, GraphInput, ListAuditLogsInput, ListRunsInput,
    ReplayTimelineInput, SearchInput, TimelineInput, WatchEventsInput,
};
use crate::error::ChronicleMcpError;
use crate::resources::{
    ChronicleResourceUri, LATEST_ACTIVITY_URI, SOURCES_CATALOG_URI, TENANT_CONTEXT_URI,
};

const DEFAULT_GRAPH_DEPTH: u32 = 3;

#[derive(Debug, Clone, serde::Deserialize, schemars::JsonSchema)]
pub struct QueryEventsArgs {
    pub source: Option<String>,
    pub topic: Option<String>,
    pub event_type: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub since_days: Option<i64>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, serde::Deserialize, schemars::JsonSchema)]
pub struct SearchEventsArgs {
    pub query: String,
    pub source: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, serde::Deserialize, schemars::JsonSchema)]
pub struct TimelineArgs {
    pub entity_type: String,
    pub entity_id: String,
    pub since_days: Option<i64>,
    pub include_linked: Option<bool>,
}

#[derive(Debug, Clone, Copy, serde::Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum GraphDirectionArg {
    Outgoing,
    Incoming,
    Both,
}

#[derive(Debug, Clone, serde::Deserialize, schemars::JsonSchema)]
pub struct TraverseGraphArgs {
    pub start_event_id: String,
    pub direction: GraphDirectionArg,
    pub link_types: Option<Vec<String>>,
    pub max_depth: Option<u32>,
    pub min_confidence: Option<f32>,
}

#[derive(Debug, Clone, Default, serde::Deserialize, schemars::JsonSchema)]
pub struct ListRunsArgs {
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, serde::Deserialize, schemars::JsonSchema)]
pub struct RunIdArgs {
    pub run_id: String,
}

#[derive(Debug, Clone, Default, serde::Deserialize, schemars::JsonSchema)]
pub struct ListAuditLogsArgs {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, serde::Deserialize, schemars::JsonSchema)]
pub struct DescribeSchemaArgs {
    pub source: String,
    pub event_type: String,
}

#[derive(Debug, Clone, Default, serde::Deserialize, schemars::JsonSchema)]
pub struct WatchEventsArgs {
    pub source: Option<String>,
    pub event_type: Option<String>,
    pub subject_id: Option<String>,
    pub payload_contains: Option<String>,
    pub limit: Option<usize>,
    pub wait_seconds: Option<u64>,
}

#[derive(Debug, Clone, serde::Deserialize, schemars::JsonSchema)]
pub struct ReplayTimelineArgs {
    pub entity_type: String,
    pub entity_id: String,
    pub since_days: Option<i64>,
    pub limit: Option<usize>,
}

#[derive(Clone)]
pub struct ChronicleMcpServerOptions {
    pub enable_replay: bool,
}

impl Default for ChronicleMcpServerOptions {
    fn default() -> Self {
        Self {
            enable_replay: false,
        }
    }
}

#[derive(Clone)]
pub struct ChronicleMcpServer {
    auth: ChronicleMcpAuthResolver,
    data_access: Arc<dyn ChronicleMcpDataAccess>,
    tool_router: ToolRouter<Self>,
    minimum_log_level: Arc<RwLock<LoggingLevel>>,
    options: ChronicleMcpServerOptions,
}

#[tool_router]
impl ChronicleMcpServer {
    pub fn new(
        auth: ChronicleMcpAuthResolver,
        data_access: Arc<dyn ChronicleMcpDataAccess>,
        options: ChronicleMcpServerOptions,
    ) -> Self {
        Self {
            auth,
            data_access,
            tool_router: Self::tool_router(),
            minimum_log_level: Arc::new(RwLock::new(LoggingLevel::Info)),
            options,
        }
    }

    #[tool(description = "Query Chronicle operational events for the current tenant")]
    async fn query_events(
        &self,
        Parameters(args): Parameters<QueryEventsArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self
            .data_access
            .query_events(
                &session,
                EventQueryInput {
                    source: args.source,
                    topic: args.topic,
                    event_type: args.event_type,
                    entity_type: args.entity_type,
                    entity_id: args.entity_id,
                    since_days: args.since_days,
                    limit: args.limit,
                    offset: args.offset,
                },
            )
            .await;
        self.log_tool_invocation(&context, "query_events", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Search Chronicle events semantically for the current tenant")]
    async fn search_events(
        &self,
        Parameters(args): Parameters<SearchEventsArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self
            .data_access
            .search_events(
                &session,
                SearchInput {
                    query: args.query,
                    source: args.source,
                    entity_type: args.entity_type,
                    entity_id: args.entity_id,
                    limit: args.limit,
                },
            )
            .await;
        self.log_tool_invocation(&context, "search_events", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Get a chronological timeline for a Chronicle entity")]
    async fn get_timeline(
        &self,
        Parameters(args): Parameters<TimelineArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self
            .data_access
            .get_timeline(
                &session,
                TimelineInput {
                    entity_type: args.entity_type,
                    entity_id: args.entity_id,
                    since_days: args.since_days,
                    include_linked: args.include_linked.unwrap_or(true),
                },
            )
            .await;
        self.log_tool_invocation(&context, "get_timeline", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Traverse Chronicle event links from a starting event")]
    async fn traverse_graph(
        &self,
        Parameters(args): Parameters<TraverseGraphArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self
            .data_access
            .traverse_graph(
                &session,
                GraphInput {
                    start_event_id: args.start_event_id,
                    direction: args.direction.into(),
                    link_types: args.link_types,
                    max_depth: args.max_depth.unwrap_or(DEFAULT_GRAPH_DEPTH),
                    min_confidence: args.min_confidence.unwrap_or_default(),
                },
            )
            .await;
        self.log_tool_invocation(&context, "traverse_graph", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "List workflow runs for the current tenant")]
    async fn list_runs(
        &self,
        Parameters(args): Parameters<ListRunsArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self
            .data_access
            .list_runs(
                &session,
                ListRunsInput {
                    status: args.status,
                    limit: args.limit,
                    offset: args.offset,
                },
            )
            .await;
        self.log_tool_invocation(&context, "list_runs", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Get a single workflow run and its audit trail")]
    async fn get_run(
        &self,
        Parameters(args): Parameters<RunIdArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self.data_access.get_run(&session, &args.run_id).await;
        self.log_tool_invocation(&context, "get_run", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "List tenant audit logs")]
    async fn list_audit_logs(
        &self,
        Parameters(args): Parameters<ListAuditLogsArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self
            .data_access
            .list_audit_logs(
                &session,
                ListAuditLogsInput {
                    limit: args.limit,
                    offset: args.offset,
                },
            )
            .await;
        self.log_tool_invocation(&context, "list_audit_logs", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Describe sources available in the current tenant")]
    async fn describe_sources(
        &self,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self.data_access.describe_sources(&session).await;
        self.log_tool_invocation(&context, "describe_sources", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Describe entity types available in the current tenant")]
    async fn describe_entity_types(
        &self,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self.data_access.describe_entity_types(&session).await;
        self.log_tool_invocation(&context, "describe_entity_types", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Describe the schema for a source and event type")]
    async fn describe_schema(
        &self,
        Parameters(args): Parameters<DescribeSchemaArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        let result = self
            .data_access
            .describe_schema(&session, &args.source, &args.event_type)
            .await;
        self.log_tool_invocation(&context, "describe_schema", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Watch the live Chronicle event stream for new matching events")]
    async fn watch_events(
        &self,
        Parameters(args): Parameters<WatchEventsArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        self.notify_progress(&context, 0.0, 1.0, "Waiting for live events")
            .await;
        let result = self
            .data_access
            .watch_events(
                &session,
                WatchEventsInput {
                    source: args.source,
                    event_type: args.event_type,
                    subject_id: args.subject_id,
                    payload_contains: args.payload_contains,
                    limit: args.limit,
                    wait_seconds: args.wait_seconds,
                },
            )
            .await;
        self.notify_progress(&context, 1.0, 1.0, "Finished collecting live events")
            .await;
        self.log_tool_invocation(&context, "watch_events", &session)
            .await;
        tool_response(result)
    }

    #[tool(description = "Replay a Chronicle entity timeline in chronological order")]
    async fn replay_timeline(
        &self,
        Parameters(args): Parameters<ReplayTimelineArgs>,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session = self.session(&context).await?;
        if !self.options.enable_replay {
            return Ok(ChronicleMcpError::unsupported(
                "Replay is disabled for this Chronicle MCP server instance",
            )
            .to_tool_result());
        }

        let result = self
            .data_access
            .replay_timeline(
                &session,
                ReplayTimelineInput {
                    entity_type: args.entity_type,
                    entity_id: args.entity_id,
                    since_days: args.since_days,
                    limit: args.limit,
                },
            )
            .await;
        self.log_tool_invocation(&context, "replay_timeline", &session)
            .await;
        tool_response(result)
    }
}

#[tool_handler]
impl ServerHandler for ChronicleMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(
            ServerCapabilities::builder()
                .enable_tools()
                .enable_resources()
                .enable_logging()
                .build(),
        )
        .with_server_info(Implementation::from_build_env())
        .with_instructions(
            "Chronicle MCP provides tenant-scoped access to operational events, timelines, runs, audit logs, schemas, and live stream inspection. All data is scoped from the authenticated Chronicle token.".to_string(),
        )
    }

    async fn initialize(
        &self,
        _request: InitializeRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<ServerInfo, McpError> {
        Ok(self.get_info())
    }

    async fn set_level(
        &self,
        request: SetLevelRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<(), McpError> {
        *self.minimum_log_level.write().await = request.level;
        Ok(())
    }

    async fn list_resources(
        &self,
        _request: Option<PaginatedRequestParams>,
        context: RequestContext<RoleServer>,
    ) -> Result<ListResourcesResult, McpError> {
        let _session = self
            .session_from_parts(context.extensions.get::<Parts>())
            .await?;
        Ok(ListResourcesResult {
            resources: vec![
                RawResource::new(TENANT_CONTEXT_URI, "tenant-context").no_annotation(),
                RawResource::new(LATEST_ACTIVITY_URI, "latest-activity").no_annotation(),
                RawResource::new(SOURCES_CATALOG_URI, "sources-catalog").no_annotation(),
            ],
            next_cursor: None,
            meta: None,
        })
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        context: RequestContext<RoleServer>,
    ) -> Result<ReadResourceResult, McpError> {
        let session = self
            .session_from_parts(context.extensions.get::<Parts>())
            .await?;
        let parsed = ChronicleResourceUri::parse(request.uri.as_str()).ok_or_else(|| {
            ChronicleMcpError::not_found(format!("Unknown Chronicle resource {}", request.uri))
                .to_mcp_error()
        })?;

        match parsed {
            ChronicleResourceUri::TenantContext => resource_response(&request.uri, &session),
            ChronicleResourceUri::LatestActivity => resource_response(
                &request.uri,
                self.data_access
                    .latest_activity(&session, None)
                    .await
                    .map_err(|error| error.to_mcp_error())?,
            ),
            ChronicleResourceUri::SourcesCatalog => resource_response(
                &request.uri,
                self.data_access
                    .describe_sources(&session)
                    .await
                    .map_err(|error| error.to_mcp_error())?,
            ),
            ChronicleResourceUri::RunDetail { run_id } => resource_response(
                &request.uri,
                self.data_access
                    .get_run(&session, &run_id)
                    .await
                    .map_err(|error| error.to_mcp_error())?,
            ),
            ChronicleResourceUri::EventDetail { event_id } => {
                let event = self
                    .data_access
                    .get_event(&session, &event_id)
                    .await
                    .map_err(|error| error.to_mcp_error())?
                    .ok_or_else(|| {
                        ChronicleMcpError::not_found(format!("Event {event_id} was not found"))
                            .to_mcp_error()
                    })?;
                resource_response(&request.uri, event)
            }
            ChronicleResourceUri::Schema { source, event_type } => resource_response(
                &request.uri,
                self.data_access
                    .describe_schema(&session, &source, &event_type)
                    .await
                    .map_err(|error| error.to_mcp_error())?,
            ),
        }
    }

    async fn list_resource_templates(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourceTemplatesResult, McpError> {
        Ok(ListResourceTemplatesResult {
            resource_templates: vec![],
            next_cursor: None,
            meta: None,
        })
    }
}

impl ChronicleMcpServer {
    async fn session(
        &self,
        context: &RequestContext<RoleServer>,
    ) -> Result<McpSessionContext, McpError> {
        self.session_from_parts(context.extensions.get::<Parts>())
            .await
    }

    async fn session_from_parts(
        &self,
        parts: Option<&Parts>,
    ) -> Result<McpSessionContext, McpError> {
        self.auth
            .resolve_from_parts(parts)
            .await
            .map_err(|error| error.to_mcp_error())
    }

    async fn log_tool_invocation(
        &self,
        context: &RequestContext<RoleServer>,
        tool_name: &str,
        session: &McpSessionContext,
    ) {
        if context.extensions.get::<Parts>().is_some() {
            return;
        }
        let configured_level = *self.minimum_log_level.read().await;
        if !should_log(configured_level, LoggingLevel::Info) {
            return;
        }

        let payload = json!({
            "message": "Chronicle MCP tool executed",
            "tool": tool_name,
            "tenantId": session.tenant_id,
            "userId": session.user_id,
        });
        let _ = context
            .peer
            .notify_logging_message(LoggingMessageNotificationParam {
                level: LoggingLevel::Info,
                logger: Some("chronicle-mcp".into()),
                data: payload,
            })
            .await;
    }

    async fn notify_progress(
        &self,
        context: &RequestContext<RoleServer>,
        progress: f64,
        total: f64,
        message: &str,
    ) {
        if context.extensions.get::<Parts>().is_some() {
            return;
        }
        let _ = context
            .peer
            .notify_progress(ProgressNotificationParam {
                progress_token: ProgressToken(NumberOrString::String("chronicle-live".into())),
                progress,
                total: Some(total),
                message: Some(message.to_string()),
            })
            .await;
    }
}

impl From<GraphDirectionArg> for chronicle_core::link::LinkDirection {
    fn from(value: GraphDirectionArg) -> Self {
        match value {
            GraphDirectionArg::Outgoing => Self::Outgoing,
            GraphDirectionArg::Incoming => Self::Incoming,
            GraphDirectionArg::Both => Self::Both,
        }
    }
}

fn resource_response<T: serde::Serialize>(
    uri: &str,
    value: T,
) -> Result<ReadResourceResult, McpError> {
    let text = serde_json::to_string_pretty(&value).map_err(internal_error)?;
    Ok(ReadResourceResult::new(vec![ResourceContents::text(
        text,
        uri.to_string(),
    )
    .with_mime_type("application/json")]))
}

fn tool_response<T: serde::Serialize>(
    result: Result<T, ChronicleMcpError>,
) -> Result<CallToolResult, McpError> {
    match result {
        Ok(value) => {
            let structured = serde_json::to_value(value).map_err(internal_error)?;
            Ok(CallToolResult::structured(structured))
        }
        Err(error) => Ok(error.to_tool_result()),
    }
}

fn internal_error(error: impl ToString) -> McpError {
    ChronicleMcpError::internal(error.to_string()).to_mcp_error()
}

fn should_log(minimum_level: LoggingLevel, level: LoggingLevel) -> bool {
    logging_level_rank(level) >= logging_level_rank(minimum_level)
}

fn logging_level_rank(level: LoggingLevel) -> u8 {
    match level {
        LoggingLevel::Debug => 0,
        LoggingLevel::Info => 1,
        LoggingLevel::Notice => 2,
        LoggingLevel::Warning => 3,
        LoggingLevel::Error => 4,
        LoggingLevel::Critical => 5,
        LoggingLevel::Alert => 6,
        LoggingLevel::Emergency => 7,
    }
}
