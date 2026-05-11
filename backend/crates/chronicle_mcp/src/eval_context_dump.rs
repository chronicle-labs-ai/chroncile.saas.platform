use std::time::Instant;

use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};

use crate::{
    eval_seed::build_seeded_eval_scenario, ChronicleBaselineEvalResult, ChronicleEvalBaseline,
    ChronicleMcpEvalMatrix, ChronicleMcpEvalScenario,
};

const DEFAULT_ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS: u32 = 1_024;
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct AnthropicContextDumpEvalRunner {
    http_client: reqwest::Client,
    config: crate::eval_anthropic::AnthropicEvalConfig,
}

impl AnthropicContextDumpEvalRunner {
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
            config: crate::eval_anthropic::AnthropicEvalConfig {
                api_url: std::env::var("ANTHROPIC_API_URL")
                    .unwrap_or_else(|_| DEFAULT_ANTHROPIC_API_URL.to_string()),
                model: std::env::var("ANTHROPIC_MODEL")
                    .unwrap_or_else(|_| DEFAULT_ANTHROPIC_MODEL.to_string()),
                max_tokens: parse_env_u32("ANTHROPIC_MAX_TOKENS").unwrap_or(DEFAULT_MAX_TOKENS),
                max_turns: 1,
                temperature: parse_env_f32("ANTHROPIC_TEMPERATURE").unwrap_or(0.0),
            },
        })
    }

    pub async fn run_selected(
        &self,
        matrix: &ChronicleMcpEvalMatrix,
        scenario_ids: &[String],
    ) -> Result<Vec<ChronicleBaselineEvalResult>, String> {
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
    ) -> Result<ChronicleBaselineEvalResult, String> {
        let started_at = Instant::now();
        let seeded = build_seeded_eval_scenario(scenario).await?;
        let response = self
            .create_message(
                scenario,
                &seeded.prompt,
                &seeded.context_dump,
                &seeded.expected_citations,
            )
            .await?;

        let final_response = response
            .content
            .iter()
            .filter_map(|block| match block {
                AnthropicContentBlock::Text { text } => Some(text.as_str()),
            })
            .collect::<Vec<_>>()
            .join("\n");

        let cited_evidence = seeded
            .expected_citations
            .iter()
            .filter(|citation| final_response.contains(citation.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let grounded = !cited_evidence.is_empty();
        let passed = !final_response.trim().is_empty() && grounded;
        let mut notes = vec![format!(
            "Anthropic stop reason: {}",
            response
                .stop_reason
                .clone()
                .unwrap_or_else(|| "unknown".to_string())
        )];
        if !grounded {
            notes.push(
                "Final response did not cite any expected identifier or evidence token".to_string(),
            );
        }

        Ok(ChronicleBaselineEvalResult {
            scenario_id: scenario.id.clone(),
            baseline: ChronicleEvalBaseline::ClueRetrievalDump,
            final_response,
            cited_evidence,
            grounded,
            passed,
            latency_ms: Some(started_at.elapsed().as_millis() as u64),
            input_tokens: response
                .usage
                .as_ref()
                .map(|usage| usage.input_tokens as u64),
            output_tokens: response
                .usage
                .as_ref()
                .map(|usage| usage.output_tokens as u64),
            notes,
        })
    }

    async fn create_message(
        &self,
        scenario: &ChronicleMcpEvalScenario,
        prompt: &str,
        context_dump: &str,
        expected_citations: &[String],
    ) -> Result<AnthropicResponseMessage, String> {
        let request = AnthropicRequest {
            model: self.config.model.clone(),
            max_tokens: self.config.max_tokens,
            temperature: self.config.temperature,
            system: build_system_prompt(scenario, expected_citations),
            messages: vec![AnthropicRequestMessage::user_text(format!(
                "{prompt}\n\nChronicle static retrieval dump:\n```json\n{context_dump}\n```"
            ))],
        };

        let response = self
            .http_client
            .post(&self.config.api_url)
            .json(&request)
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

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    temperature: f32,
    system: String,
    messages: Vec<AnthropicRequestMessage>,
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

#[derive(Debug, Deserialize)]
struct AnthropicResponseMessage {
    content: Vec<AnthropicContentBlock>,
    stop_reason: Option<String>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum AnthropicContentBlock {
    Text { text: String },
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

fn build_system_prompt(
    scenario: &ChronicleMcpEvalScenario,
    _expected_citations: &[String],
) -> String {
    format!(
        "You are evaluating Chronicle reasoning without tools.\n\
Use only the static Chronicle retrieval dump provided in the user message.\n\
Do not guess or invent facts that are not directly supported by the dump.\n\
If the dump contains separate retrieval sections, reconcile them yourself because they are not deduplicated or normalized across accounts.\n\
When the scenario starts from partial clues, resolve the identity or account from the dump before summarizing.\n\
Your final answer must include:\n\
1. A short diagnosis or summary.\n\
2. An `Evidence` section with exact identifiers or evidence tokens copied from the dump.\n\
Keep the final answer concise, under 250 words, and do not use tables.\n\
Scenario: {}",
        scenario.prompt
    )
}

fn parse_env_u32(key: &str) -> Option<u32> {
    std::env::var(key).ok()?.parse().ok()
}

fn parse_env_f32(key: &str) -> Option<f32> {
    std::env::var(key).ok()?.parse().ok()
}
