use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Instant;

use chronicle_auth::types::AuthUser;
use chronicle_core::query::EventResult;
use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    eval_seed::build_seeded_eval_scenario, eval_transport::ToolCallPayload, AnthropicEvalConfig,
    ChronicleMcpDataAccess, ChronicleMcpEvalMatrix, ChronicleMcpEvalResult,
    ChronicleMcpEvalScenario, InProcessChronicleMcpDataAccess, ListAuditLogsInput, ListRunsInput,
    McpEvalTransport, McpSessionContext, SearchInput, TimelineInput,
};

const DEFAULT_ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS: u32 = 1_024;
const DEFAULT_MAX_TURNS: usize = 12;
const ANTHROPIC_VERSION: &str = "2023-06-01";

const FRAGMENTED_TOOL_COUNT: usize = 100;
const FRAGMENTED_EVENT_LIMIT: usize = 4;
const FRAGMENTED_RUN_LIMIT: usize = 8;
const FRAGMENTED_AUDIT_LIMIT: usize = 25;
const FRAGMENTED_SUPPORTED_SCENARIO_ID: &str = "high_volume_multi_hop_story";
const FRAGMENTED_TARGET_WORKFLOW_ID: &str = "wf_dashboard_rbac_sync";

const FRAGMENTED_PROVIDERS: [&str; 10] = [
    "frontend",
    "slack",
    "stripe",
    "intercom",
    "zendesk",
    "github",
    "pagerduty",
    "jira",
    "salesforce",
    "chronicle",
];

const FRAGMENTED_OPERATIONS: [ToolOperation; 10] = [
    ToolOperation {
        suffix: "search_users_by_email",
        description: "Search provider-side user or login records by email.",
        schema_kind: FragmentedToolSchemaKind::Query,
    },
    ToolOperation {
        suffix: "search_workspace_activity",
        description: "Search provider-side workspace activity by workspace name.",
        schema_kind: FragmentedToolSchemaKind::Query,
    },
    ToolOperation {
        suffix: "search_ticket_subjects",
        description: "Search provider-side support threads by ticket subject.",
        schema_kind: FragmentedToolSchemaKind::Query,
    },
    ToolOperation {
        suffix: "search_billing_records",
        description: "Search provider-side billing or subscription records by query.",
        schema_kind: FragmentedToolSchemaKind::Query,
    },
    ToolOperation {
        suffix: "search_access_regressions",
        description: "Search provider-side access regression or rollout failures by query.",
        schema_kind: FragmentedToolSchemaKind::Query,
    },
    ToolOperation {
        suffix: "get_account_timeline",
        description: "Fetch the provider's timeline for a resolved account id.",
        schema_kind: FragmentedToolSchemaKind::AccountId,
    },
    ToolOperation {
        suffix: "list_incident_runs",
        description: "List provider incident or workflow runs, optionally filtered by status.",
        schema_kind: FragmentedToolSchemaKind::Status,
    },
    ToolOperation {
        suffix: "get_run_details",
        description: "Fetch full run details for an exact run id.",
        schema_kind: FragmentedToolSchemaKind::RunId,
    },
    ToolOperation {
        suffix: "list_actor_audit_logs",
        description: "List provider audit logs for a specific actor id.",
        schema_kind: FragmentedToolSchemaKind::Actor,
    },
    ToolOperation {
        suffix: "search_misc_notes",
        description: "Search miscellaneous provider notes and low-signal records by query.",
        schema_kind: FragmentedToolSchemaKind::Query,
    },
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FragmentedToolEvalResult {
    pub scenario_id: String,
    pub available_tool_count: usize,
    pub tool_calls: Vec<String>,
    pub final_response: String,
    pub cited_evidence: Vec<String>,
    pub grounded: bool,
    pub passed: bool,
    pub latency_ms: Option<u64>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolSurfaceBenchmarkComparison {
    pub scenario_id: String,
    pub transport: McpEvalTransport,
    pub chronicle_passed: bool,
    pub fragmented_passed: bool,
    pub chronicle_grounded: bool,
    pub fragmented_grounded: bool,
    pub chronicle_cited_evidence_count: usize,
    pub fragmented_cited_evidence_count: usize,
    pub chronicle_available_tool_count: Option<usize>,
    pub fragmented_available_tool_count: usize,
    pub chronicle_tool_calls: usize,
    pub fragmented_tool_calls: usize,
    pub chronicle_latency_ms: Option<u64>,
    pub fragmented_latency_ms: Option<u64>,
    pub chronicle_input_tokens: Option<u64>,
    pub fragmented_input_tokens: Option<u64>,
    pub verdict: String,
}

pub struct AnthropicFragmentedToolEvalRunner {
    http_client: reqwest::Client,
    config: AnthropicEvalConfig,
}

impl AnthropicFragmentedToolEvalRunner {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();
        let api_key = std::env::var("ANTHROPIC_API_KEY")
            .map_err(|_| "ANTHROPIC_API_KEY must be set to run live Anthropic evals".to_string())?;

        let mut headers = HeaderMap::new();
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&api_key).map_err(|error| error.to_string())?,
        );
        headers.insert(
            "anthropic-version",
            HeaderValue::from_static(ANTHROPIC_VERSION),
        );
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );

        let http_client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|error| error.to_string())?;

        Ok(Self {
            http_client,
            config: AnthropicEvalConfig {
                api_url: std::env::var("ANTHROPIC_API_URL")
                    .unwrap_or_else(|_| DEFAULT_ANTHROPIC_API_URL.to_string()),
                model: std::env::var("ANTHROPIC_MODEL")
                    .unwrap_or_else(|_| DEFAULT_ANTHROPIC_MODEL.to_string()),
                max_tokens: parse_env_u32("ANTHROPIC_MAX_TOKENS").unwrap_or(DEFAULT_MAX_TOKENS),
                max_turns: parse_env_usize("CHRONICLE_FRAGMENTED_TOOL_EVAL_MAX_TURNS")
                    .unwrap_or(DEFAULT_MAX_TURNS),
                temperature: parse_env_f32("ANTHROPIC_TEMPERATURE").unwrap_or(0.0),
            },
        })
    }

    pub async fn run_selected(
        &self,
        matrix: &ChronicleMcpEvalMatrix,
        scenario_ids: &[String],
    ) -> Result<Vec<FragmentedToolEvalResult>, String> {
        let scenarios = matrix.select_scenarios(scenario_ids)?;
        let mut results = Vec::new();
        for scenario in &scenarios {
            results.push(self.run_seeded_scenario(scenario).await?);
        }
        Ok(results)
    }

    async fn run_seeded_scenario(
        &self,
        scenario: &ChronicleMcpEvalScenario,
    ) -> Result<FragmentedToolEvalResult, String> {
        if scenario.id != FRAGMENTED_SUPPORTED_SCENARIO_ID {
            return Err(format!(
                "Fragmented tool benchmark currently supports only scenario `{FRAGMENTED_SUPPORTED_SCENARIO_ID}`, got `{}`",
                scenario.id
            ));
        }

        let started_at = Instant::now();
        let seeded = build_seeded_eval_scenario(scenario).await?;
        let expected_citations = seeded.expected_citations.clone();
        let prompt = seeded
            .prompt
            .replace("Use Chronicle tools only.", "Use only the provided tools.");
        let session = benchmark_session(scenario);
        let tool_suite = FragmentedToolSuite::new(
            InProcessChronicleMcpDataAccess::new(
                seeded.runtime.events_state.clone(),
                seeded.runtime.saas_state.clone(),
                Arc::clone(&seeded.runtime.stream_backend),
            ),
            session,
        );

        let anthropic_tools = tool_suite.anthropic_tools();
        let mut messages = vec![AnthropicRequestMessage::user_text(prompt)];
        let mut tool_calls = Vec::new();
        let mut final_response = String::new();
        let mut notes = vec![format!(
            "Available fragmented tools: {}",
            tool_suite.available_tool_count()
        )];
        let mut total_input_tokens = 0_u64;
        let mut total_output_tokens = 0_u64;

        for _ in 0..self.config.max_turns {
            let response = self
                .create_message(
                    scenario,
                    &messages,
                    &anthropic_tools,
                    &expected_citations,
                    tool_suite.available_tool_count(),
                )
                .await?;

            if let Some(usage) = response.usage.as_ref() {
                total_input_tokens += usage.input_tokens as u64;
                total_output_tokens += usage.output_tokens as u64;
            }

            let assistant_text = assistant_text_from_content(&response.content);
            let assistant_message = AnthropicRequestMessage {
                role: "assistant".to_string(),
                content: response.content.clone(),
            };
            let tool_uses = response
                .content
                .iter()
                .filter_map(|block| match block {
                    AnthropicContentBlock::ToolUse { id, name, input } => {
                        Some((id.clone(), name.clone(), input.clone()))
                    }
                    _ => None,
                })
                .collect::<Vec<_>>();

            messages.push(assistant_message);

            if tool_uses.is_empty() {
                final_response = assistant_text;
                notes.push(format!(
                    "Anthropic stop reason: {}",
                    response
                        .stop_reason
                        .clone()
                        .unwrap_or_else(|| "unknown".to_string())
                ));
                break;
            }

            let mut tool_results = Vec::new();
            for (tool_use_id, name, input) in tool_uses {
                tool_calls.push(name.clone());
                let tool_result = tool_suite.call_tool(&name, input).await?;
                tool_results.push(tool_result_block(tool_use_id, tool_result));
            }

            messages.push(AnthropicRequestMessage {
                role: "user".to_string(),
                content: tool_results,
            });
        }

        if final_response.is_empty() {
            notes.push(format!(
                "Anthropic max turn limit ({}) reached before a final answer",
                self.config.max_turns
            ));
            messages.push(AnthropicRequestMessage::user_text(
                "Using only the evidence already gathered from the provided tools, give the final answer now. Do not call any more tools.".to_string(),
            ));
            let response = self
                .create_message(
                    scenario,
                    &messages,
                    &[],
                    &expected_citations,
                    tool_suite.available_tool_count(),
                )
                .await?;
            if let Some(usage) = response.usage.as_ref() {
                total_input_tokens += usage.input_tokens as u64;
                total_output_tokens += usage.output_tokens as u64;
            }
            final_response = assistant_text_from_content(&response.content);
            notes.push(format!(
                "Anthropic forced-final stop reason: {}",
                response
                    .stop_reason
                    .clone()
                    .unwrap_or_else(|| "unknown".to_string())
            ));
        }

        let cited_evidence = expected_citations
            .iter()
            .filter(|citation| final_response.contains(citation.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let grounded = !cited_evidence.is_empty();
        let passed = !tool_calls.is_empty() && !final_response.trim().is_empty() && grounded;

        if !grounded {
            notes.push(
                "Final response did not cite any expected identifier or evidence token".to_string(),
            );
        }

        Ok(FragmentedToolEvalResult {
            scenario_id: scenario.id.clone(),
            available_tool_count: tool_suite.available_tool_count(),
            tool_calls,
            final_response,
            cited_evidence,
            grounded,
            passed,
            latency_ms: Some(started_at.elapsed().as_millis() as u64),
            input_tokens: Some(total_input_tokens),
            output_tokens: Some(total_output_tokens),
            notes,
        })
    }

    async fn create_message(
        &self,
        scenario: &ChronicleMcpEvalScenario,
        messages: &[AnthropicRequestMessage],
        tools: &[AnthropicTool],
        expected_citations: &[String],
        available_tool_count: usize,
    ) -> Result<AnthropicResponseMessage, String> {
        let response = self
            .http_client
            .post(&self.config.api_url)
            .json(&AnthropicRequest {
                model: self.config.model.clone(),
                max_tokens: self.config.max_tokens,
                temperature: self.config.temperature,
                system: build_fragmented_system_prompt(
                    scenario,
                    expected_citations,
                    available_tool_count,
                ),
                messages: messages.to_vec(),
                tools: tools.to_vec(),
            })
            .send()
            .await
            .map_err(|error| error.to_string())?;

        let status = response.status();
        let body = response.text().await.map_err(|error| error.to_string())?;
        if !status.is_success() {
            return Err(format!(
                "Anthropic API request failed with {status}: {body}"
            ));
        }

        serde_json::from_str(&body).map_err(|error| error.to_string())
    }
}

pub fn compare_mcp_to_fragmented_tools(
    mcp_results: &[ChronicleMcpEvalResult],
    fragmented_results: &[FragmentedToolEvalResult],
) -> Result<Vec<ToolSurfaceBenchmarkComparison>, String> {
    let mut comparisons = Vec::new();

    for mcp_result in mcp_results {
        let fragmented = fragmented_results
            .iter()
            .find(|result| result.scenario_id == mcp_result.scenario_id)
            .ok_or_else(|| {
                format!(
                    "Missing fragmented tool benchmark result for Chronicle MCP scenario {}",
                    mcp_result.scenario_id
                )
            })?;

        comparisons.push(ToolSurfaceBenchmarkComparison {
            scenario_id: mcp_result.scenario_id.clone(),
            transport: mcp_result.transport,
            chronicle_passed: mcp_result.passed,
            fragmented_passed: fragmented.passed,
            chronicle_grounded: mcp_result.grounded,
            fragmented_grounded: fragmented.grounded,
            chronicle_cited_evidence_count: mcp_result.cited_evidence.len(),
            fragmented_cited_evidence_count: fragmented.cited_evidence.len(),
            chronicle_available_tool_count: mcp_result.available_tool_count,
            fragmented_available_tool_count: fragmented.available_tool_count,
            chronicle_tool_calls: mcp_result.tool_calls.len(),
            fragmented_tool_calls: fragmented.tool_calls.len(),
            chronicle_latency_ms: mcp_result.latency_ms,
            fragmented_latency_ms: fragmented.latency_ms,
            chronicle_input_tokens: mcp_result.input_tokens,
            fragmented_input_tokens: fragmented.input_tokens,
            verdict: compare_fragmented_verdict(mcp_result, fragmented),
        });
    }

    Ok(comparisons)
}

#[derive(Clone)]
struct FragmentedToolSuite {
    data_access: InProcessChronicleMcpDataAccess,
    session: McpSessionContext,
    tools: Vec<FragmentedToolDefinition>,
}

impl FragmentedToolSuite {
    fn new(data_access: InProcessChronicleMcpDataAccess, session: McpSessionContext) -> Self {
        let mut tools = Vec::new();
        for provider in FRAGMENTED_PROVIDERS {
            for operation in FRAGMENTED_OPERATIONS {
                tools.push(FragmentedToolDefinition {
                    provider: provider.to_string(),
                    operation_suffix: operation.suffix.to_string(),
                    anthropic_tool: AnthropicTool {
                        name: format!("{provider}_{}", operation.suffix),
                        description: format!(
                            "{} {}",
                            provider_title(provider),
                            operation.description
                        ),
                        input_schema: schema_for_kind(operation.schema_kind),
                    },
                    handler: handler_for(provider, operation.suffix),
                });
            }
        }
        assert_eq!(tools.len(), FRAGMENTED_TOOL_COUNT);

        Self {
            data_access,
            session,
            tools,
        }
    }

    fn anthropic_tools(&self) -> Vec<AnthropicTool> {
        self.tools
            .iter()
            .map(|tool| tool.anthropic_tool.clone())
            .collect()
    }

    fn available_tool_count(&self) -> usize {
        self.tools.len()
    }

    async fn call_tool(&self, name: &str, input: Value) -> Result<ToolCallPayload, String> {
        let tool = self
            .tools
            .iter()
            .find(|tool| tool.anthropic_tool.name == name)
            .ok_or_else(|| format!("Unknown fragmented benchmark tool `{name}`"))?;

        match tool.handler {
            FragmentedToolHandler::Empty => Ok(ToolCallPayload {
                payload: json!({
                    "provider": tool.provider,
                    "operation": tool.operation_suffix,
                    "count": 0,
                    "records": [],
                    "note": "No matching records surfaced from this fragmented provider tool."
                }),
                is_error: false,
            }),
            FragmentedToolHandler::FrontendSearchUsersByEmail => {
                let query = required_string_argument(&input, "query")?;
                self.search_events("frontend", &query, &tool.provider, &tool.operation_suffix)
                    .await
            }
            FragmentedToolHandler::FrontendSearchWorkspaceActivity => {
                let query = required_string_argument(&input, "query")?;
                self.search_events("frontend", &query, &tool.provider, &tool.operation_suffix)
                    .await
            }
            FragmentedToolHandler::StripeSearchBillingRecords => {
                let query = required_string_argument(&input, "query")?;
                self.search_events("stripe", &query, &tool.provider, &tool.operation_suffix)
                    .await
            }
            FragmentedToolHandler::ZendeskSearchTicketSubjects => {
                let query = required_string_argument(&input, "query")?;
                self.search_events("zendesk", &query, &tool.provider, &tool.operation_suffix)
                    .await
            }
            FragmentedToolHandler::ChronicleSearchAccessRegressions => {
                let query = required_string_argument(&input, "query")?;
                self.search_events("chronicle", &query, &tool.provider, &tool.operation_suffix)
                    .await
            }
            FragmentedToolHandler::ChronicleGetAccountTimeline => {
                let account_id = required_string_argument(&input, "accountId")?;
                let result = self
                    .data_access
                    .get_timeline(
                        &self.session,
                        TimelineInput {
                            entity_type: "account".to_string(),
                            entity_id: account_id.clone(),
                            since_days: Some(30),
                            include_linked: false,
                        },
                    )
                    .await
                    .map_err(mcp_error_message)?;

                Ok(ToolCallPayload {
                    payload: json!({
                        "provider": tool.provider,
                        "operation": tool.operation_suffix,
                        "accountId": account_id,
                        "count": result.count,
                        "records": result
                            .events
                            .iter()
                            .map(event_result_to_record)
                            .collect::<Vec<_>>()
                    }),
                    is_error: false,
                })
            }
            FragmentedToolHandler::ChronicleListIncidentRuns => {
                let status = optional_string_argument(&input, "status")
                    .unwrap_or_else(|| "failed".to_string());
                let result = self
                    .data_access
                    .list_runs(
                        &self.session,
                        ListRunsInput {
                            status: Some(status.clone()),
                            limit: Some(FRAGMENTED_RUN_LIMIT),
                            offset: Some(0),
                        },
                    )
                    .await
                    .map_err(mcp_error_message)?;

                let runs = result
                    .runs
                    .iter()
                    .filter(|run| run.workflow_id.as_deref() == Some(FRAGMENTED_TARGET_WORKFLOW_ID))
                    .map(|run| {
                        json!({
                            "runIdFragment": redacted_id_fragment(&run.id),
                            "status": run.status,
                            "workflowId": run.workflow_id,
                            "eventId": run.event_id,
                            "invocationId": run.invocation_id,
                            "accountId": payload_string(run.event_snapshot.as_ref(), "accountId"),
                            "workspace": payload_string(run.event_snapshot.as_ref(), "workspace"),
                            "billingEmail": payload_string(run.event_snapshot.as_ref(), "billingEmail")
                        })
                    })
                    .collect::<Vec<_>>();

                Ok(ToolCallPayload {
                    payload: json!({
                        "provider": tool.provider,
                        "operation": tool.operation_suffix,
                        "status": status,
                        "count": runs.len(),
                        "runs": runs
                    }),
                    is_error: false,
                })
            }
            FragmentedToolHandler::ChronicleGetRunDetails => {
                let run_id = required_string_argument(&input, "runId")?;
                let result = match self.data_access.get_run(&self.session, &run_id).await {
                    Ok(result) => result,
                    Err(error) => {
                        return Ok(ToolCallPayload {
                            payload: json!({
                                "provider": tool.provider,
                                "operation": tool.operation_suffix,
                                "runId": run_id,
                                "error": mcp_error_message(error)
                            }),
                            is_error: true,
                        });
                    }
                };

                Ok(ToolCallPayload {
                    payload: json!({
                        "provider": tool.provider,
                        "operation": tool.operation_suffix,
                        "run": {
                            "runId": result.run.id,
                            "status": result.run.status,
                            "workflowId": result.run.workflow_id,
                            "eventId": result.run.event_id,
                            "invocationId": result.run.invocation_id,
                            "accountId": payload_string(result.run.event_snapshot.as_ref(), "accountId"),
                            "workspace": payload_string(result.run.event_snapshot.as_ref(), "workspace"),
                            "billingEmail": payload_string(result.run.event_snapshot.as_ref(), "billingEmail")
                        },
                        "auditLogs": result
                            .audit_logs
                            .iter()
                            .map(|audit_log| {
                                json!({
                                    "auditLogId": audit_log.id,
                                    "action": audit_log.action,
                                    "actor": audit_log.actor,
                                    "runId": audit_log.run_id,
                                    "eventId": audit_log.event_id,
                                    "reason": payload_string(audit_log.payload.as_ref(), "reason"),
                                    "workspace": payload_string(audit_log.payload.as_ref(), "workspace")
                                })
                            })
                            .collect::<Vec<_>>()
                    }),
                    is_error: false,
                })
            }
            FragmentedToolHandler::ChronicleListActorAuditLogs => {
                let actor = required_string_argument(&input, "actor")?;
                let result = self
                    .data_access
                    .list_audit_logs(
                        &self.session,
                        ListAuditLogsInput {
                            limit: Some(FRAGMENTED_AUDIT_LIMIT),
                            offset: Some(0),
                        },
                    )
                    .await
                    .map_err(mcp_error_message)?;

                let audit_logs = result
                    .audit_logs
                    .iter()
                    .filter(|audit_log| audit_log.actor.as_deref() == Some(actor.as_str()))
                    .map(|audit_log| {
                        json!({
                            "auditLogIdFragment": redacted_id_fragment(&audit_log.id),
                            "action": audit_log.action,
                            "actor": audit_log.actor,
                            "runIdFragment": audit_log.run_id.as_deref().map(redacted_id_fragment),
                            "eventId": audit_log.event_id,
                            "reason": payload_string(audit_log.payload.as_ref(), "reason"),
                            "workspace": payload_string(audit_log.payload.as_ref(), "workspace")
                        })
                    })
                    .collect::<Vec<_>>();

                Ok(ToolCallPayload {
                    payload: json!({
                        "provider": tool.provider,
                        "operation": tool.operation_suffix,
                        "actor": actor,
                        "count": audit_logs.len(),
                        "auditLogs": audit_logs
                    }),
                    is_error: false,
                })
            }
        }
    }

    async fn search_events(
        &self,
        source: &str,
        query: &str,
        provider: &str,
        operation: &str,
    ) -> Result<ToolCallPayload, String> {
        let result = self
            .data_access
            .search_events(
                &self.session,
                SearchInput {
                    query: query.to_string(),
                    source: Some(source.to_string()),
                    entity_type: None,
                    entity_id: None,
                    limit: Some(FRAGMENTED_EVENT_LIMIT),
                },
            )
            .await
            .map_err(mcp_error_message)?;

        Ok(ToolCallPayload {
            payload: json!({
                "provider": provider,
                "operation": operation,
                "query": query,
                "count": result.count,
                "records": result
                    .events
                    .iter()
                    .map(event_result_to_record)
                    .collect::<Vec<_>>()
            }),
            is_error: false,
        })
    }
}

#[derive(Debug, Clone, Copy)]
struct ToolOperation {
    suffix: &'static str,
    description: &'static str,
    schema_kind: FragmentedToolSchemaKind,
}

#[derive(Debug, Clone, Copy)]
enum FragmentedToolSchemaKind {
    Query,
    AccountId,
    Status,
    RunId,
    Actor,
}

#[derive(Debug, Clone)]
struct FragmentedToolDefinition {
    provider: String,
    operation_suffix: String,
    anthropic_tool: AnthropicTool,
    handler: FragmentedToolHandler,
}

#[derive(Debug, Clone, Copy)]
enum FragmentedToolHandler {
    Empty,
    FrontendSearchUsersByEmail,
    FrontendSearchWorkspaceActivity,
    StripeSearchBillingRecords,
    ZendeskSearchTicketSubjects,
    ChronicleSearchAccessRegressions,
    ChronicleGetAccountTimeline,
    ChronicleListIncidentRuns,
    ChronicleGetRunDetails,
    ChronicleListActorAuditLogs,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    temperature: f32,
    system: String,
    messages: Vec<AnthropicRequestMessage>,
    tools: Vec<AnthropicTool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnthropicRequestMessage {
    role: String,
    content: Vec<AnthropicContentBlock>,
}

impl AnthropicRequestMessage {
    fn user_text(text: String) -> Self {
        Self {
            role: "user".to_string(),
            content: vec![AnthropicContentBlock::Text { text }],
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct AnthropicTool {
    name: String,
    description: String,
    input_schema: Value,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponseMessage {
    content: Vec<AnthropicContentBlock>,
    stop_reason: Option<String>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum AnthropicContentBlock {
    Text {
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: Value,
    },
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

fn compare_fragmented_verdict(
    mcp_result: &ChronicleMcpEvalResult,
    fragmented_result: &FragmentedToolEvalResult,
) -> String {
    if mcp_result.passed && !fragmented_result.passed {
        return "chronicle_better".to_string();
    }
    if !mcp_result.passed && fragmented_result.passed {
        return "fragmented_better".to_string();
    }
    if mcp_result.cited_evidence.len() > fragmented_result.cited_evidence.len() {
        return "chronicle_more_grounded".to_string();
    }
    if mcp_result.cited_evidence.len() < fragmented_result.cited_evidence.len() {
        return "fragmented_more_grounded".to_string();
    }
    "tie".to_string()
}

fn build_fragmented_system_prompt(
    scenario: &ChronicleMcpEvalScenario,
    _expected_citations: &[String],
    available_tool_count: usize,
) -> String {
    format!(
        "You are evaluating reasoning under a fragmented operations tool surface.\n\
Use only the provided tools.\n\
There are {available_tool_count} provider-specific tools, and many are irrelevant to the incident.\n\
Minimize unnecessary tool calls, but do not guess.\n\
Resolve the shared account from partial clues first, then use the Chronicle-specific run or audit tools only after you have narrowed the incident.\n\
Some provider tools expose only partial identifiers in search or list results, so exact drill-down requires the right app-local id from the right tool.\n\
Your final answer must include:\n\
1. A short diagnosis or summary.\n\
2. An `Evidence` section with exact identifiers copied from tool results.\n\
3. A `Tool usage` section naming the tools you used.\n\
Keep the final answer concise, under 250 words, and do not use tables.\n\
Scenario: {}",
        scenario.prompt
    )
}

fn benchmark_session(scenario: &ChronicleMcpEvalScenario) -> McpSessionContext {
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
    .into()
}

fn handler_for(provider: &str, operation_suffix: &str) -> FragmentedToolHandler {
    match (provider, operation_suffix) {
        ("frontend", "search_users_by_email") => FragmentedToolHandler::FrontendSearchUsersByEmail,
        ("frontend", "search_workspace_activity") => {
            FragmentedToolHandler::FrontendSearchWorkspaceActivity
        }
        ("stripe", "search_billing_records") => FragmentedToolHandler::StripeSearchBillingRecords,
        ("zendesk", "search_ticket_subjects") => FragmentedToolHandler::ZendeskSearchTicketSubjects,
        ("chronicle", "search_access_regressions") => {
            FragmentedToolHandler::ChronicleSearchAccessRegressions
        }
        ("chronicle", "get_account_timeline") => FragmentedToolHandler::ChronicleGetAccountTimeline,
        ("chronicle", "list_incident_runs") => FragmentedToolHandler::ChronicleListIncidentRuns,
        ("chronicle", "get_run_details") => FragmentedToolHandler::ChronicleGetRunDetails,
        ("chronicle", "list_actor_audit_logs") => {
            FragmentedToolHandler::ChronicleListActorAuditLogs
        }
        _ => FragmentedToolHandler::Empty,
    }
}

fn schema_for_kind(kind: FragmentedToolSchemaKind) -> Value {
    match kind {
        FragmentedToolSchemaKind::Query => json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Provider-specific query text."
                }
            },
            "required": ["query"]
        }),
        FragmentedToolSchemaKind::AccountId => json!({
            "type": "object",
            "properties": {
                "accountId": {
                    "type": "string",
                    "description": "Resolved provider account id."
                }
            },
            "required": ["accountId"]
        }),
        FragmentedToolSchemaKind::Status => json!({
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Optional run status filter such as failed."
                }
            }
        }),
        FragmentedToolSchemaKind::RunId => json!({
            "type": "object",
            "properties": {
                "runId": {
                    "type": "string",
                    "description": "Exact provider run id."
                }
            },
            "required": ["runId"]
        }),
        FragmentedToolSchemaKind::Actor => json!({
            "type": "object",
            "properties": {
                "actor": {
                    "type": "string",
                    "description": "Provider actor id or deploy actor name."
                }
            },
            "required": ["actor"]
        }),
    }
}

fn provider_title(provider: &str) -> String {
    let mut chars = provider.chars();
    match chars.next() {
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
        None => provider.to_string(),
    }
}

fn required_string_argument(input: &Value, key: &str) -> Result<String, String> {
    input
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| format!("Tool argument `{key}` must be a string"))
}

fn optional_string_argument(input: &Value, key: &str) -> Option<String> {
    input
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn event_result_to_record(result: &EventResult) -> Value {
    json!({
        "eventId": result.event.event_id,
        "time": result.event.event_time.to_rfc3339(),
        "source": result.event.source.to_string(),
        "topic": result.event.topic.to_string(),
        "eventType": result.event.event_type.to_string(),
        "entities": event_entities(result),
        "payload": result.event.payload
    })
}

fn event_entities(result: &EventResult) -> BTreeMap<String, String> {
    result
        .entity_refs
        .iter()
        .map(|entity_ref| {
            (
                entity_ref.entity_type.to_string(),
                entity_ref.entity_id.to_string(),
            )
        })
        .collect()
}

fn payload_string(payload: Option<&Value>, key: &str) -> Option<String> {
    payload
        .and_then(|value| value.get(key))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn tool_result_block(tool_use_id: String, tool_result: ToolCallPayload) -> AnthropicContentBlock {
    let content = serde_json::to_string_pretty(&tool_result.payload)
        .unwrap_or_else(|_| tool_result.payload.to_string());
    AnthropicContentBlock::ToolResult {
        tool_use_id,
        content,
        is_error: tool_result.is_error.then_some(true),
    }
}

fn assistant_text_from_content(content: &[AnthropicContentBlock]) -> String {
    content
        .iter()
        .filter_map(|block| match block {
            AnthropicContentBlock::Text { text } => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_env_u32(key: &str) -> Option<u32> {
    std::env::var(key).ok()?.parse().ok()
}

fn parse_env_usize(key: &str) -> Option<usize> {
    std::env::var(key).ok()?.parse().ok()
}

fn parse_env_f32(key: &str) -> Option<f32> {
    std::env::var(key).ok()?.parse().ok()
}

fn mcp_error_message(error: crate::ChronicleMcpError) -> String {
    error.to_mcp_error().message.to_string()
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
