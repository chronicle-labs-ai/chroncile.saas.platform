use std::collections::HashSet;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use chronicle_core::error::StoreError;
use chronicle_core::event::Event;
use chronicle_core::ids::EventId;
use chronicle_core::query::EventResult;

use super::payloads::raw_payload_text;
use super::{LinkDecision, LinkDecisionModel};

const DEFAULT_ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS: u32 = 1_024;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const DEFAULT_TEMPERATURE: f32 = 0.0;
const ANTHROPIC_VERSION: &str = "2023-06-01";
const LINK_DECISION_TOOL_NAME: &str = "return_event_link_decisions";

#[derive(Debug, Clone)]
pub struct AnthropicLinkDecisionConfig {
    pub api_key: String,
    pub api_url: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_ms: u64,
}

impl Default for AnthropicLinkDecisionConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            api_url: DEFAULT_ANTHROPIC_API_URL.to_string(),
            model: DEFAULT_ANTHROPIC_MODEL.to_string(),
            max_tokens: DEFAULT_MAX_TOKENS,
            temperature: DEFAULT_TEMPERATURE,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        }
    }
}

pub struct AnthropicLinkDecisionModel {
    http_client: reqwest::Client,
    config: AnthropicLinkDecisionConfig,
}

impl AnthropicLinkDecisionModel {
    pub fn new(config: AnthropicLinkDecisionConfig) -> Result<Self, StoreError> {
        if config.api_key.trim().is_empty() {
            return Err(StoreError::Query(
                "anthropic link evaluator requires a non-empty api key".to_string(),
            ));
        }

        let mut headers = HeaderMap::new();
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&config.api_key)
                .map_err(|error| StoreError::Internal(error.to_string()))?,
        );
        headers.insert(
            "anthropic-version",
            HeaderValue::from_static(ANTHROPIC_VERSION),
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let http_client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_millis(config.timeout_ms))
            .build()
            .map_err(|error| StoreError::Connection(error.to_string()))?;

        Ok(Self {
            http_client,
            config,
        })
    }

    async fn request_model_output(
        &self,
        source_event: &Event,
        candidates: &[EventResult],
    ) -> Result<AnthropicLinkDecisionOutput, StoreError> {
        let response = self
            .http_client
            .post(&self.config.api_url)
            .json(&AnthropicRequest {
                model: self.config.model.clone(),
                max_tokens: self.config.max_tokens,
                temperature: self.config.temperature,
                system: build_system_prompt(),
                messages: vec![AnthropicRequestMessage::user_text(build_user_prompt(
                    source_event,
                    candidates,
                ))],
                tools: vec![link_decision_tool()],
            })
            .send()
            .await
            .map_err(|error| StoreError::Connection(error.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| StoreError::Connection(error.to_string()))?;

        if !status.is_success() {
            return Err(StoreError::Query(format!(
                "anthropic returned {status}: {body}"
            )));
        }

        let parsed: AnthropicResponseMessage =
            serde_json::from_str(&body).map_err(|error| StoreError::Query(error.to_string()))?;

        if let Some(tool_output) = parsed.content.iter().find_map(|block| match block {
            AnthropicContentBlock::ToolUse { name, input, .. }
                if name == LINK_DECISION_TOOL_NAME =>
            {
                Some(input.clone())
            }
            _ => None,
        }) {
            return serde_json::from_value(tool_output)
                .map_err(|error| StoreError::Query(error.to_string()));
        }

        let assistant_text = assistant_text_from_content(&parsed.content);
        parse_text_fallback(&assistant_text).ok_or_else(|| {
            StoreError::Query(
                "anthropic response did not include an event-link tool payload".to_string(),
            )
        })
    }
}

#[async_trait]
impl LinkDecisionModel for AnthropicLinkDecisionModel {
    async fn evaluate(
        &self,
        source_event: &Event,
        candidates: &[EventResult],
    ) -> Result<Vec<LinkDecision>, StoreError> {
        if candidates.is_empty() {
            return Ok(Vec::new());
        }

        let output = self.request_model_output(source_event, candidates).await?;
        let allowed_target_ids = candidates
            .iter()
            .map(|candidate| candidate.event.event_id.to_string())
            .collect::<HashSet<_>>();

        output
            .decisions
            .into_iter()
            .filter(|decision| {
                decision.target_event_id != source_event.event_id.to_string()
                    && allowed_target_ids.contains(&decision.target_event_id)
            })
            .map(|decision| {
                let target_event_id =
                    decision
                        .target_event_id
                        .parse::<EventId>()
                        .map_err(|error| {
                            StoreError::Query(format!(
                                "anthropic returned invalid targetEventId '{}': {error}",
                                decision.target_event_id
                            ))
                        })?;

                if !(0.0..=1.0).contains(&decision.confidence) {
                    return Err(StoreError::Query(format!(
                        "anthropic returned confidence outside 0..=1 for event {}",
                        target_event_id
                    )));
                }

                Ok(LinkDecision {
                    target_event_id,
                    link_type: decision.link_type,
                    confidence: decision.confidence,
                    reasoning: Some(decision.reasoning),
                })
            })
            .collect()
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
struct AnthropicLinkDecisionOutput {
    decisions: Vec<AnthropicLinkDecisionPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnthropicLinkDecisionPayload {
    target_event_id: String,
    link_type: String,
    confidence: f32,
    reasoning: String,
}

fn build_system_prompt() -> String {
    [
        "You are Chronicle's event-link evaluator.",
        "Given one source event and a ranked list of candidate events, decide which candidates should be linked.",
        "Always use the provided tool to return your answer.",
        "Only link events when there is a concrete causal or entity-resolution reason.",
        "Never invent target event ids that are not present in the candidate list.",
        "Use concise link types such as caused_by, follows, duplicate_of, same_customer_journey, or related_context.",
        "Confidence must be a number between 0.0 and 1.0.",
        "If none of the candidates should be linked, return an empty decisions array.",
    ]
    .join("\n")
}

fn build_user_prompt(source_event: &Event, candidates: &[EventResult]) -> String {
    let payload = json!({
        "sourceEvent": event_summary(source_event),
        "candidateEvents": candidates
            .iter()
            .map(|candidate| event_summary(&candidate.event))
            .collect::<Vec<_>>(),
    });

    format!(
        "Evaluate Chronicle event-link candidates.\n\
Return only the tool payload.\n\n\
Linking context:\n```json\n{}\n```",
        serde_json::to_string_pretty(&payload)
            .unwrap_or_else(|_| "{\"error\":\"failed to serialize linking context\"}".to_string())
    )
}

fn link_decision_tool() -> AnthropicTool {
    AnthropicTool {
        name: LINK_DECISION_TOOL_NAME.to_string(),
        description: "Return the assistant explanation plus a list of event link decisions."
            .to_string(),
        input_schema: json!({
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "assistantMessage": {
                    "type": "string",
                    "description": "Short explanation of how the candidates were evaluated."
                },
                "decisions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "targetEventId": { "type": "string" },
                            "linkType": { "type": "string" },
                            "confidence": { "type": "number" },
                            "reasoning": { "type": "string" }
                        },
                        "required": ["targetEventId", "linkType", "confidence", "reasoning"]
                    }
                }
            },
            "required": ["assistantMessage", "decisions"]
        }),
    }
}

fn event_summary(event: &Event) -> Value {
    json!({
        "eventId": event.event_id,
        "orgId": event.org_id,
        "source": event.source,
        "topic": event.topic,
        "eventType": event.event_type,
        "eventTime": event.event_time,
        "entityRefs": event.materialize_entity_refs("llm_linking")
            .into_iter()
            .map(|entity_ref| {
                json!({
                    "entityType": entity_ref.entity_type,
                    "entityId": entity_ref.entity_id,
                })
            })
            .collect::<Vec<_>>(),
        "payloadText": raw_payload_text(event),
        "rawBody": event.raw_body,
    })
}

fn assistant_text_from_content(content: &[AnthropicContentBlock]) -> String {
    content
        .iter()
        .filter_map(|block| match block {
            AnthropicContentBlock::Text { text } => Some(text.as_str()),
            AnthropicContentBlock::ToolUse { .. } => None,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_text_fallback(text: &str) -> Option<AnthropicLinkDecisionOutput> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    serde_json::from_str::<AnthropicLinkDecisionOutput>(&text[start..=end]).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    use chrono::Utc;
    use wiremock::matchers::{body_partial_json, header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use chronicle_core::event::EventBuilder;
    use chronicle_core::query::EventResult;

    fn candidate(event: Event) -> EventResult {
        EventResult {
            event,
            entity_refs: Vec::new(),
            search_distance: None,
        }
    }

    #[tokio::test]
    async fn anthropic_model_parses_tool_payload() {
        let server = MockServer::start().await;
        let source = EventBuilder::new(
            "org_test",
            "stripe",
            "payments",
            "payment_intent.payment_failed",
        )
        .entity("customer", "cust_123")
        .payload(json!({"amount": 4999, "status": "failed"}))
        .event_time(Utc::now())
        .build();
        let target = EventBuilder::new("org_test", "zendesk", "support", "ticket.created")
            .entity("customer", "cust_123")
            .payload(json!({"subject": "billing issue"}))
            .event_time(Utc::now())
            .build();
        let target_id = target.event_id;
        Mock::given(method("POST"))
            .and(path("/messages"))
            .and(header("anthropic-version", ANTHROPIC_VERSION))
            .and(body_partial_json(json!({
                "tools": [{
                    "name": LINK_DECISION_TOOL_NAME
                }]
            })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "content": [{
                    "type": "tool_use",
                    "id": "toolu_1",
                    "name": LINK_DECISION_TOOL_NAME,
                    "input": {
                        "assistantMessage": "billing failure lines up with the support ticket",
                        "decisions": [{
                            "targetEventId": target_id.to_string(),
                            "linkType": "caused_by",
                            "confidence": 0.92,
                            "reasoning": "The candidate follows the failed payment and references the same customer."
                        }]
                    }
                }]
            })))
            .mount(&server)
            .await;

        let model = AnthropicLinkDecisionModel::new(AnthropicLinkDecisionConfig {
            api_key: "test-key".to_string(),
            api_url: format!("{}/messages", server.uri()),
            ..AnthropicLinkDecisionConfig::default()
        })
        .unwrap();

        let decisions = model.evaluate(&source, &[candidate(target)]).await.unwrap();

        assert_eq!(decisions.len(), 1);
        assert_eq!(decisions[0].target_event_id, target_id);
        assert_eq!(decisions[0].link_type, "caused_by");
    }

    #[tokio::test]
    async fn anthropic_model_filters_unknown_target_ids() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/messages"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "content": [{
                    "type": "tool_use",
                    "id": "toolu_1",
                    "name": LINK_DECISION_TOOL_NAME,
                    "input": {
                        "assistantMessage": "ignored",
                        "decisions": [{
                            "targetEventId": "01J7A0Y2R99AM8J1V9YAZR3V0F",
                            "linkType": "caused_by",
                            "confidence": 0.8,
                            "reasoning": "not a real candidate"
                        }]
                    }
                }]
            })))
            .mount(&server)
            .await;

        let model = AnthropicLinkDecisionModel::new(AnthropicLinkDecisionConfig {
            api_key: "test-key".to_string(),
            api_url: format!("{}/messages", server.uri()),
            ..AnthropicLinkDecisionConfig::default()
        })
        .unwrap();

        let source = EventBuilder::new("org_test", "stripe", "payments", "payment.failed")
            .event_time(Utc::now())
            .build();
        let target = EventBuilder::new("org_test", "zendesk", "support", "ticket.created")
            .event_time(Utc::now())
            .build();

        let decisions = model.evaluate(&source, &[candidate(target)]).await.unwrap();

        assert!(decisions.is_empty());
    }
}
