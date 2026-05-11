use std::time::Duration;

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use chronicle_domain::{
    apply_graph_edit_commands, validate_sandbox_graph, GraphEditCommand, GraphEditPreview,
    SandboxAiChatRequest, SandboxAiChatResponse,
};
use chronicle_interfaces::{SandboxAiConfigError, SandboxAiConfigService};

const DEFAULT_ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS: u32 = 1_024;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const ANTHROPIC_VERSION: &str = "2023-06-01";
const GRAPH_EDIT_TOOL_NAME: &str = "return_graph_edit_plan";

#[derive(Debug, Clone)]
pub struct AnthropicSandboxAiConfig {
    pub api_key: String,
    pub api_url: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_ms: u64,
}

impl Default for AnthropicSandboxAiConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            api_url: DEFAULT_ANTHROPIC_API_URL.to_string(),
            model: DEFAULT_ANTHROPIC_MODEL.to_string(),
            max_tokens: DEFAULT_MAX_TOKENS,
            temperature: 0.0,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        }
    }
}

pub struct AnthropicSandboxAiConfigService {
    http_client: reqwest::Client,
    config: AnthropicSandboxAiConfig,
}

impl AnthropicSandboxAiConfigService {
    pub fn new(config: AnthropicSandboxAiConfig) -> Result<Self, SandboxAiConfigError> {
        if config.api_key.trim().is_empty() {
            return Err(SandboxAiConfigError::NotConfigured);
        }

        let mut headers = HeaderMap::new();
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&config.api_key)
                .map_err(|error| SandboxAiConfigError::Internal(error.to_string()))?,
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
            .timeout(Duration::from_millis(config.timeout_ms))
            .build()
            .map_err(|error| SandboxAiConfigError::Internal(error.to_string()))?;

        Ok(Self {
            http_client,
            config,
        })
    }

    async fn request_model_output(
        &self,
        tenant_id: &str,
        request: &SandboxAiChatRequest,
    ) -> Result<SandboxAiModelOutput, SandboxAiConfigError> {
        let response = self
            .http_client
            .post(&self.config.api_url)
            .json(&AnthropicRequest {
                model: self.config.model.clone(),
                max_tokens: self.config.max_tokens,
                temperature: self.config.temperature,
                system: build_system_prompt(),
                messages: vec![AnthropicRequestMessage::user_text(build_user_prompt(
                    tenant_id, request,
                ))],
                tools: vec![graph_edit_tool()],
            })
            .send()
            .await
            .map_err(|error| SandboxAiConfigError::Upstream(error.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| SandboxAiConfigError::Upstream(error.to_string()))?;

        if !status.is_success() {
            return Err(SandboxAiConfigError::Upstream(format!(
                "Anthropic returned {status}: {body}"
            )));
        }

        let parsed: AnthropicResponseMessage = serde_json::from_str(&body)
            .map_err(|error| SandboxAiConfigError::InvalidResponse(error.to_string()))?;

        if let Some(tool_output) = parsed.content.iter().find_map(|block| match block {
            AnthropicContentBlock::ToolUse { name, input, .. } if name == GRAPH_EDIT_TOOL_NAME => {
                Some(input.clone())
            }
            _ => None,
        }) {
            return serde_json::from_value(tool_output)
                .map_err(|error| SandboxAiConfigError::InvalidResponse(error.to_string()));
        }

        let assistant_text = assistant_text_from_content(&parsed.content);
        if let Some(output) = parse_text_fallback(&assistant_text) {
            return Ok(output);
        }

        Err(SandboxAiConfigError::InvalidResponse(
            "Anthropic response did not include a graph-edit tool payload".to_string(),
        ))
    }
}

#[async_trait]
impl SandboxAiConfigService for AnthropicSandboxAiConfigService {
    async fn generate_graph_edits(
        &self,
        tenant_id: &str,
        request: SandboxAiChatRequest,
    ) -> Result<SandboxAiChatResponse, SandboxAiConfigError> {
        if request.prompt.trim().is_empty() {
            return Err(SandboxAiConfigError::Validation(
                "Prompt cannot be empty".to_string(),
            ));
        }

        let model_output = self.request_model_output(tenant_id, &request).await?;
        let preview_result =
            apply_graph_edit_commands(&request.nodes, &request.edges, &model_output.commands);

        let (preview, errors) = match preview_result {
            Ok(preview) => (preview, Vec::new()),
            Err(errors) => (
                GraphEditPreview {
                    nodes: request.nodes.clone(),
                    edges: request.edges.clone(),
                },
                errors,
            ),
        };

        let validation = validate_sandbox_graph(&preview.nodes, &preview.edges);

        Ok(SandboxAiChatResponse {
            assistant_message: model_output.assistant_message,
            commands: model_output.commands,
            preview,
            validation,
            errors,
        })
    }
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SandboxAiModelOutput {
    assistant_message: String,
    commands: Vec<GraphEditCommand>,
}

fn build_system_prompt() -> String {
    [
        "You are Chronicle's sandbox graph planner.",
        "You edit an existing sandbox graph by returning a minimal set of graph edit commands.",
        "Always use the provided tool to return your answer.",
        "Do not invent unsupported node types, React Flow metadata, or fields outside the schema.",
        "Supported node types are event-source, filter, output, and generator.",
        "Use update_node when changing an existing node. Use add_node and add_edge when extending the graph.",
        "Prefer preserving the existing structure unless the user clearly asks to replace or remove it.",
        "When the request is ambiguous or missing required values, return an assistantMessage that asks a clear follow-up question and leave commands empty.",
        "For new node ids and edge ids, use short stable ids like ai_source_1 or ai_edge_1.",
        "Output config rules:",
        "- outputType must be one of sse, webhook, file, console.",
        "- If the user asks for a webhook but does not provide a URL, leave webhookUrl empty and mention the missing URL in assistantMessage.",
        "- If the user asks for a file output and does not specify a format, default to jsonl.",
        "Graph layout rules:",
        "- Keep left-to-right flow where practical.",
        "- Preserve nearby positions when editing existing nodes.",
        "- Place new downstream nodes to the right of their parents.",
    ]
    .join("\n")
}

fn build_user_prompt(tenant_id: &str, request: &SandboxAiChatRequest) -> String {
    let payload = json!({
        "tenantId": tenant_id,
        "userPrompt": request.prompt,
        "selectedNodeId": request.selected_node_id,
        "recentMessages": request.recent_messages,
        "currentGraph": {
            "nodes": request.nodes,
            "edges": request.edges,
        },
    });

    format!(
        "Plan sandbox graph edits for this request.\n\
Return only the tool payload.\n\n\
Graph context:\n```json\n{}\n```",
        serde_json::to_string_pretty(&payload)
            .unwrap_or_else(|_| "{\"error\":\"failed to serialize graph context\"}".to_string())
    )
}

fn graph_edit_tool() -> AnthropicTool {
    AnthropicTool {
        name: GRAPH_EDIT_TOOL_NAME.to_string(),
        description:
            "Return the assistant reply plus a minimal command list that updates the sandbox graph."
                .to_string(),
        input_schema: json!({
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "assistantMessage": { "type": "string" },
                "commands": {
                    "type": "array",
                    "items": graph_edit_command_schema()
                }
            },
            "required": ["assistantMessage", "commands"]
        }),
    }
}

fn graph_edit_command_schema() -> Value {
    json!({
        "type": "object",
        "oneOf": [
            {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "type": { "const": "add_node" },
                    "node": sandbox_node_schema()
                },
                "required": ["type", "node"]
            },
            {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "type": { "const": "update_node" },
                    "node": sandbox_node_schema()
                },
                "required": ["type", "node"]
            },
            {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "type": { "const": "remove_node" },
                    "nodeId": { "type": "string" }
                },
                "required": ["type", "nodeId"]
            },
            {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "type": { "const": "add_edge" },
                    "edge": sandbox_edge_schema()
                },
                "required": ["type", "edge"]
            },
            {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "type": { "const": "remove_edge" },
                    "edgeId": { "type": "string" }
                },
                "required": ["type", "edgeId"]
            }
        ]
    })
}

fn sandbox_node_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "id": { "type": "string" },
            "position": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "x": { "type": "number" },
                    "y": { "type": "number" }
                },
                "required": ["x", "y"]
            },
            "data": {
                "oneOf": [
                    {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "nodeType": { "const": "event-source" },
                            "label": { "type": "string" },
                            "config": {
                                "type": "object",
                                "additionalProperties": false,
                                "properties": {
                                    "dateRange": {
                                        "type": "object",
                                        "additionalProperties": false,
                                        "properties": {
                                            "start": { "type": "string" },
                                            "end": { "type": "string" }
                                        },
                                        "required": ["start", "end"]
                                    },
                                    "sourceFilter": { "type": "array", "items": { "type": "string" } },
                                    "eventTypeFilter": { "type": "array", "items": { "type": "string" } }
                                },
                                "required": ["dateRange", "sourceFilter", "eventTypeFilter"]
                            }
                        },
                        "required": ["nodeType", "label", "config"]
                    },
                    {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "nodeType": { "const": "filter" },
                            "label": { "type": "string" },
                            "config": {
                                "type": "object",
                                "additionalProperties": false,
                                "properties": {
                                    "rules": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "additionalProperties": false,
                                            "properties": {
                                                "id": { "type": "string" },
                                                "field": { "type": "string" },
                                                "operator": { "type": "string" },
                                                "value": { "type": "string" }
                                            },
                                            "required": ["id", "field", "operator", "value"]
                                        }
                                    }
                                },
                                "required": ["rules"]
                            }
                        },
                        "required": ["nodeType", "label", "config"]
                    },
                    {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "nodeType": { "const": "output" },
                            "label": { "type": "string" },
                            "config": {
                                "type": "object",
                                "additionalProperties": false,
                                "properties": {
                                    "outputType": { "type": "string", "enum": ["sse", "webhook", "file", "console"] },
                                    "webhookUrl": { "type": "string" },
                                    "fileFormat": { "type": "string", "enum": ["jsonl", "csv"] },
                                    "transformTemplate": { "type": "string" },
                                    "includedFields": { "type": "array", "items": { "type": "string" } }
                                },
                                "required": ["outputType", "webhookUrl", "fileFormat", "transformTemplate", "includedFields"]
                            }
                        },
                        "required": ["nodeType", "label", "config"]
                    },
                    {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "nodeType": { "const": "generator" },
                            "label": { "type": "string" },
                            "config": {
                                "type": "object",
                                "additionalProperties": false,
                                "properties": {
                                    "sourceTypes": { "type": "array", "items": { "type": "string" } },
                                    "eventTypes": { "type": "array", "items": { "type": "string" } },
                                    "count": { "type": "number" },
                                    "intervalMs": { "type": "number" },
                                    "variationLevel": { "type": "number" }
                                },
                                "required": ["sourceTypes", "eventTypes", "count", "intervalMs", "variationLevel"]
                            }
                        },
                        "required": ["nodeType", "label", "config"]
                    }
                ]
            }
        },
        "required": ["id", "position", "data"]
    })
}

fn sandbox_edge_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "id": { "type": "string" },
            "source": { "type": "string" },
            "target": { "type": "string" }
        },
        "required": ["id", "source", "target"]
    })
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

fn parse_text_fallback(text: &str) -> Option<SandboxAiModelOutput> {
    serde_json::from_str(text.trim()).ok().or_else(|| {
        extract_json_object(text).and_then(|json_text| serde_json::from_str(json_text).ok())
    })
}

fn extract_json_object(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    (end > start).then_some(&text[start..=end])
}
