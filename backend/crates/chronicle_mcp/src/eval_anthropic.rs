use std::collections::BTreeSet;
use std::time::Instant;

use reqwest::header::{HeaderMap, HeaderValue};
use rmcp::model::Tool;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    eval::{self},
    eval_seed::build_seeded_eval_scenario,
    eval_transport::{connect_eval_transport, ToolCallPayload},
    ChronicleMcpEvalMatrix, ChronicleMcpEvalResult, ChronicleMcpEvalRunner,
    ChronicleMcpEvalScenario, McpEvalTransport,
};

const DEFAULT_ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS: u32 = 1_024;
const DEFAULT_MAX_TURNS: usize = 8;
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Debug, Clone)]
pub struct AnthropicEvalConfig {
    pub api_url: String,
    pub model: String,
    pub max_tokens: u32,
    pub max_turns: usize,
    pub temperature: f32,
}

impl Default for AnthropicEvalConfig {
    fn default() -> Self {
        Self {
            api_url: DEFAULT_ANTHROPIC_API_URL.to_string(),
            model: DEFAULT_ANTHROPIC_MODEL.to_string(),
            max_tokens: DEFAULT_MAX_TOKENS,
            max_turns: DEFAULT_MAX_TURNS,
            temperature: 0.0,
        }
    }
}

pub struct AnthropicMcpEvalRunner {
    http_client: reqwest::Client,
    config: AnthropicEvalConfig,
}

impl AnthropicMcpEvalRunner {
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
                max_turns: parse_env_usize("CHRONICLE_MCP_EVAL_MAX_TURNS")
                    .unwrap_or(DEFAULT_MAX_TURNS),
                temperature: parse_env_f32("ANTHROPIC_TEMPERATURE").unwrap_or(0.0),
            },
        })
    }

    pub async fn run_selected(
        &self,
        matrix: &ChronicleMcpEvalMatrix,
        scenario_ids: &[String],
        transports: &[McpEvalTransport],
    ) -> Result<Vec<ChronicleMcpEvalResult>, String> {
        let scenarios = matrix.select_scenarios(scenario_ids)?;
        let selected_transports = if transports.is_empty() {
            vec![McpEvalTransport::Stdio]
        } else {
            transports.to_vec()
        };

        let mut results = Vec::new();
        for scenario in &scenarios {
            for transport in &selected_transports {
                results.push(self.run_seeded_scenario(scenario, *transport).await?);
            }
        }

        eval::ChronicleMcpEvalMatrix::apply_transport_parity(&mut results);
        Ok(results)
    }

    async fn run_seeded_scenario(
        &self,
        scenario: &ChronicleMcpEvalScenario,
        transport: McpEvalTransport,
    ) -> Result<ChronicleMcpEvalResult, String> {
        let started_at = Instant::now();
        let seeded = build_seeded_eval_scenario(scenario).await?;
        let prompt = seeded.prompt.clone();
        let expected_citations = seeded.expected_citations.clone();
        let mut client = connect_eval_transport(
            transport,
            seeded.runtime,
            seeded.auth_token,
            seeded.live_events,
            scenario.replay_required,
        )
        .await?;
        let tools = client.list_tools().await?;

        let mut messages = vec![AnthropicRequestMessage::user_text(prompt)];
        let anthropic_tools = tools
            .iter()
            .map(anthropic_tool_from_mcp_tool)
            .collect::<Vec<_>>();
        let mut tool_calls = Vec::new();
        let mut final_response = String::new();
        let mut notes = Vec::new();
        let mut total_input_tokens = 0_u64;
        let mut total_output_tokens = 0_u64;

        for _ in 0..self.config.max_turns {
            let response = self
                .create_message(scenario, &messages, &anthropic_tools, &expected_citations)
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
                let arguments = input.as_object().cloned().unwrap_or_default();
                let tool_result = client.call_tool(&name, arguments).await?;
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
                "Using only the evidence already gathered from Chronicle, provide the final answer now. Do not call any more tools.".to_string(),
            ));
            let response = self
                .create_message(scenario, &messages, &[], &expected_citations)
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

        client.shutdown().await?;

        let missing_required_tools = missing_required_tools(&tool_calls, &scenario.required_tools);
        let cited_evidence = expected_citations
            .iter()
            .filter(|citation| final_response.contains(citation.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let grounded = !cited_evidence.is_empty();
        let passed = !tool_calls.is_empty()
            && !final_response.trim().is_empty()
            && missing_required_tools.is_empty()
            && grounded;

        if !grounded {
            notes.push(
                "Final response did not cite any expected identifier or evidence token".to_string(),
            );
        }
        if !missing_required_tools.is_empty() {
            notes.push(format!(
                "Missing required tools: {}",
                missing_required_tools.join(", ")
            ));
        }

        Ok(ChronicleMcpEvalResult {
            scenario_id: scenario.id.clone(),
            transport,
            available_tool_count: Some(anthropic_tools.len()),
            tool_calls,
            missing_required_tools,
            final_response,
            cited_evidence,
            grounded,
            passed,
            latency_ms: Some(started_at.elapsed().as_millis() as u64),
            input_tokens: Some(total_input_tokens),
            output_tokens: Some(total_output_tokens),
            transport_parity_passed: false,
            notes,
        })
    }

    async fn create_message(
        &self,
        scenario: &ChronicleMcpEvalScenario,
        messages: &[AnthropicRequestMessage],
        tools: &[AnthropicTool],
        expected_citations: &[String],
    ) -> Result<AnthropicResponseMessage, String> {
        let response = self
            .http_client
            .post(&self.config.api_url)
            .json(&AnthropicRequest {
                model: self.config.model.clone(),
                max_tokens: self.config.max_tokens,
                temperature: self.config.temperature,
                system: build_system_prompt(scenario, expected_citations),
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

#[async_trait::async_trait]
impl ChronicleMcpEvalRunner for AnthropicMcpEvalRunner {
    async fn run_scenario(
        &self,
        scenario: &ChronicleMcpEvalScenario,
        transport: McpEvalTransport,
    ) -> Result<ChronicleMcpEvalResult, String> {
        self.run_seeded_scenario(scenario, transport).await
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

fn anthropic_tool_from_mcp_tool(tool: &Tool) -> AnthropicTool {
    AnthropicTool {
        name: tool.name.to_string(),
        description: tool
            .description
            .as_ref()
            .map(|value| value.to_string())
            .unwrap_or_else(|| format!("Chronicle MCP tool {}", tool.name)),
        input_schema: Value::Object(tool.input_schema.as_ref().clone()),
    }
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

fn build_system_prompt(
    scenario: &ChronicleMcpEvalScenario,
    _expected_citations: &[String],
) -> String {
    format!(
        "You are evaluating Chronicle MCP usage.\n\
Use Chronicle only through the provided tools.\n\
Do not guess or invent facts.\n\
Before answering, gather evidence with the required tools for this scenario: {}.\n\
When the scenario starts from partial clues, resolve the identity or account from Chronicle evidence before summarizing.\n\
Prefer the smallest useful result set for query-like tools, usually a limit of 5-10.\n\
Once you have a plausible shared account or user, stop repeating searches and call `get_timeline` to confirm chronology.\n\
Your final answer must include:\n\
1. A short diagnosis or summary.\n\
2. An `Evidence` section with exact identifiers or evidence tokens copied from tool results.\n\
3. A `Tool usage` section naming the Chronicle tools you used.\n\
Keep the final answer concise, under 250 words, and do not use tables.\n\
Scenario: {}",
        scenario.required_tools.join(", "),
        scenario.prompt
    )
}

fn missing_required_tools(tool_calls: &[String], required_tools: &[String]) -> Vec<String> {
    let used = tool_calls.iter().cloned().collect::<BTreeSet<_>>();
    required_tools
        .iter()
        .filter(|tool| !used.contains(tool.as_str()))
        .cloned()
        .collect()
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
