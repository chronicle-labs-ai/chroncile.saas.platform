//! Graders / judges that score an agent's output.
//!
//! The orchestrator runs these AFTER the verifier's `test.sh` has
//! produced its base reward. Rubric (LLM-judge) graders read the
//! agent's output text + the rubric prompt, emit a per-grader reward
//! key (`grader_<id>`), and the trial's reward map is the merged
//! result of every grader plus the assertion-based score from the
//! test.sh path.
//!
//! Phase 6 ships:
//! * `Grader` trait — narrow contract every grader implements.
//! * `MockGrader` — returns a fixed score, used when the orchestrator
//!   has no Anthropic key + the recipe declares rubric graders.
//! * `AnthropicGrader` — calls the Messages API with a structured
//!   prompt, parses the model's JSON response into a numeric score.
//!
//! Future graders (trace-state diff, tool-call match) plug into the
//! same trait. The grader registry hands the orchestrator one of
//! these per `BacktestGrader` declared on the recipe.

use crate::error::{OrchestratorError, OrchestratorResult};
use async_trait::async_trait;
use chronicle_domain::{BacktestGrader, BacktestGraderKind};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

/// Context every grader sees per trial.
#[derive(Debug, Clone)]
pub struct GraderContext<'a> {
    pub trial_id: &'a str,
    pub agent_id: &'a str,
    /// The instruction the agent was given (per-case prompt).
    pub instruction: &'a str,
    /// What the agent produced — the contents of `/tmp/chronicle/work/output.txt`.
    /// Empty string if the agent didn't write an output.
    pub agent_output: &'a str,
    /// Optional expected outcome / gold answer from the dataset trace.
    /// `None` when the recipe doesn't supply one.
    pub expected_outcome: Option<&'a str>,
}

/// Score one rubric / assertion / metric / etc. Implementations MUST
/// be safe to call concurrently — many trials grade in parallel and
/// share an `Arc<dyn Grader>`.
#[async_trait]
pub trait Grader: Send + Sync {
    /// Stable label (e.g. `"anthropic-rubric"`, `"mock"`). Surfaces
    /// in tracing.
    fn name(&self) -> &str;

    /// Grade one trial against the given declared grader. Returns a
    /// scalar score in 0..=1 plus optional reasoning text the trial
    /// can stash as an artifact.
    async fn grade(
        &self,
        grader: &BacktestGrader,
        ctx: GraderContext<'_>,
    ) -> OrchestratorResult<GraderOutcome>;
}

#[derive(Debug, Clone)]
pub struct GraderOutcome {
    /// Score in 0..=1. Higher is better by convention; the recipe's
    /// per-metric `higher` flag (in BacktestMetric) governs display.
    pub score: f64,
    /// Optional human-readable reasoning. Persisted as a trial
    /// artifact so we can audit the judge later.
    pub reasoning: Option<String>,
    /// Optional structured payload (e.g. multi-criterion sub-scores).
    /// When present, the orchestrator emits one reward row per key.
    /// `score` is still always emitted as `grader_<id>`.
    pub sub_scores: HashMap<String, f64>,
}

impl GraderOutcome {
    pub fn just(score: f64) -> Self {
        Self {
            score: score.clamp(0.0, 1.0),
            reasoning: None,
            sub_scores: HashMap::new(),
        }
    }
}

/* ── MockGrader ─────────────────────────────────────────── */

/// Deterministic mock used when the orchestrator has no API key.
/// Every trial gets a `1.0` score so the rubric path stays exercised
/// in tests / dev builds without phoning out to Anthropic.
#[derive(Debug, Clone)]
pub struct MockGrader {
    score: f64,
}

impl Default for MockGrader {
    fn default() -> Self {
        Self { score: 1.0 }
    }
}

impl MockGrader {
    pub fn with_score(score: f64) -> Self {
        Self {
            score: score.clamp(0.0, 1.0),
        }
    }
}

#[async_trait]
impl Grader for MockGrader {
    fn name(&self) -> &str {
        "mock-grader"
    }

    async fn grade(
        &self,
        grader: &BacktestGrader,
        _ctx: GraderContext<'_>,
    ) -> OrchestratorResult<GraderOutcome> {
        Ok(GraderOutcome {
            score: self.score,
            reasoning: Some(format!(
                "MockGrader returned {} (no LLM call) for grader '{}'",
                self.score, grader.id
            )),
            sub_scores: HashMap::new(),
        })
    }
}

/* ── AnthropicGrader ────────────────────────────────────── */

/// Calls Anthropic's Messages API with a structured prompt and parses
/// the model's JSON response into a 0..=1 score. Built around the
/// public `anthropic-version: 2023-06-01` contract.
#[derive(Clone)]
pub struct AnthropicGrader {
    api_key: String,
    api_url: String,
    model: String,
    max_tokens: u32,
    request_timeout: Duration,
    http: reqwest::Client,
}

impl AnthropicGrader {
    pub fn from_env() -> Option<Self> {
        let key = std::env::var("ANTHROPIC_API_KEY").ok()?;
        if key.trim().is_empty() {
            return None;
        }
        let api_url = std::env::var("ANTHROPIC_API_URL")
            .unwrap_or_else(|_| "https://api.anthropic.com".to_string());
        let model = std::env::var("ANTHROPIC_MODEL")
            .unwrap_or_else(|_| "claude-sonnet-4-6".to_string());
        let max_tokens = std::env::var("ANTHROPIC_MAX_TOKENS")
            .ok()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(1024);

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .user_agent(concat!("chronicle-orchestrator/", env!("CARGO_PKG_VERSION")))
            .build()
            .ok()?;

        Some(Self {
            api_key: key,
            api_url,
            model,
            max_tokens,
            request_timeout: Duration::from_secs(60),
            http,
        })
    }

    fn build_prompt(&self, grader: &BacktestGrader, ctx: &GraderContext<'_>) -> String {
        // Default rubric: the grader's `evidence` is the rubric text;
        // we ask for a JSON-only response with a 0..1 `score`. Few-
        // shot patterns can layer in via a future `grader.system_prompt`
        // field on the recipe.
        let rubric = grader.evidence.as_deref().unwrap_or(
            "Did the agent's output correctly and helpfully address \
             the instruction? Score 1.0 if perfect, 0.5 if partial, \
             0.0 if wrong or missing.",
        );
        let expected_block = ctx
            .expected_outcome
            .map(|e| format!("\n\nEXPECTED OUTCOME:\n{e}"))
            .unwrap_or_default();
        format!(
            "You are an evaluator scoring an AI agent's response.\n\n\
             RUBRIC ({label}):\n{rubric}{expected_block}\n\n\
             INSTRUCTION GIVEN TO THE AGENT:\n{instr}\n\n\
             AGENT OUTPUT:\n{out}\n\n\
             Respond with ONLY a JSON object on a single line, no prose:\n\
             {{\"score\": <number 0-1>, \"reasoning\": \"<one sentence>\"}}",
            label = grader.label,
            rubric = rubric,
            expected_block = expected_block,
            instr = ctx.instruction,
            out = if ctx.agent_output.is_empty() {
                "<agent produced no output>"
            } else {
                ctx.agent_output
            },
        )
    }
}

#[async_trait]
impl Grader for AnthropicGrader {
    fn name(&self) -> &str {
        "anthropic-grader"
    }

    async fn grade(
        &self,
        grader: &BacktestGrader,
        ctx: GraderContext<'_>,
    ) -> OrchestratorResult<GraderOutcome> {
        let prompt = self.build_prompt(grader, &ctx);

        let body = AnthropicMessagesRequest {
            model: &self.model,
            max_tokens: self.max_tokens,
            messages: vec![AnthropicMessage {
                role: "user",
                content: &prompt,
            }],
        };

        let url = format!(
            "{}/v1/messages",
            self.api_url.trim_end_matches('/')
        );
        let resp = tokio::time::timeout(
            self.request_timeout,
            self.http
                .post(url)
                .header("x-api-key", &self.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send(),
        )
        .await
        .map_err(|_| {
            OrchestratorError::Transient("AnthropicGrader: request timed out".to_string())
        })?
        .map_err(|e| OrchestratorError::Transient(format!("AnthropicGrader: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            let snippet = body.chars().take(512).collect::<String>();
            return Err(OrchestratorError::Configuration(format!(
                "AnthropicGrader: HTTP {status}: {snippet}"
            )));
        }

        let parsed: AnthropicMessagesResponse = resp.json().await.map_err(|e| {
            OrchestratorError::Configuration(format!(
                "AnthropicGrader: response parse failed: {e}"
            ))
        })?;

        let text_blocks: Vec<&str> = parsed
            .content
            .iter()
            .filter(|b| b.kind == "text")
            .filter_map(|b| b.text.as_deref())
            .collect();
        let full_text = text_blocks.join("\n");
        if full_text.trim().is_empty() {
            return Err(OrchestratorError::Configuration(
                "AnthropicGrader: model returned empty content".to_string(),
            ));
        }

        let JudgeJsonResponse { score, reasoning } = parse_judge_json(&full_text)?;
        Ok(GraderOutcome {
            score: score.clamp(0.0, 1.0),
            reasoning,
            sub_scores: HashMap::new(),
        })
    }
}

/* ── Anthropic wire shapes ──────────────────────────────── */

#[derive(Debug, Serialize)]
struct AnthropicMessagesRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    messages: Vec<AnthropicMessage<'a>>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Deserialize)]
struct AnthropicMessagesResponse {
    #[serde(default)]
    content: Vec<AnthropicContentBlock>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    text: Option<String>,
}

/* ── Response parsing ───────────────────────────────────── */

#[derive(Debug, Clone)]
struct JudgeJsonResponse {
    score: f64,
    reasoning: Option<String>,
}

/// Extract a JSON object from the model's text output. Models
/// sometimes wrap responses in markdown fences or add a sentence of
/// preamble; we tolerate both by scanning for the first `{`/`}` pair
/// that parses as the expected shape.
fn parse_judge_json(text: &str) -> OrchestratorResult<JudgeJsonResponse> {
    // Try direct parse first (the prompt asks for JSON-only output).
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
        if let Some(out) = extract_judge_response(&v) {
            return Ok(out);
        }
    }
    // Fallback: scan for a balanced JSON object.
    let bytes = text.as_bytes();
    let mut depth = 0;
    let mut start: Option<usize> = None;
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'{' => {
                if depth == 0 {
                    start = Some(i);
                }
                depth += 1;
            }
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    if let Some(s) = start {
                        let candidate = &text[s..=i];
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(candidate) {
                            if let Some(out) = extract_judge_response(&v) {
                                return Ok(out);
                            }
                        }
                        start = None;
                    }
                }
            }
            _ => {}
        }
    }
    Err(OrchestratorError::Configuration(format!(
        "AnthropicGrader: could not extract JSON {{score, reasoning}} from model output: {}",
        text.chars().take(256).collect::<String>()
    )))
}

fn extract_judge_response(v: &serde_json::Value) -> Option<JudgeJsonResponse> {
    let obj = v.as_object()?;
    let score = obj.get("score").and_then(|s| s.as_f64())?;
    let reasoning = obj
        .get("reasoning")
        .and_then(|r| r.as_str())
        .map(|s| s.to_string());
    Some(JudgeJsonResponse { score, reasoning })
}

/* ── Convenience: pick the right grader at startup ──────── */

/// Build a `Grader` from the current process env. Returns
/// `AnthropicGrader` when `ANTHROPIC_API_KEY` is set, `MockGrader`
/// otherwise. The caller usually wraps this in `Arc` so multiple
/// trials share one HTTP client + retry budget.
pub fn build_default_grader() -> std::sync::Arc<dyn Grader> {
    if let Some(g) = AnthropicGrader::from_env() {
        tracing::info!("grader: AnthropicGrader (model={})", g.model);
        std::sync::Arc::new(g)
    } else {
        tracing::info!("grader: MockGrader (no ANTHROPIC_API_KEY)");
        std::sync::Arc::new(MockGrader::default())
    }
}

/// Filter the recipe's grader list to those a `Grader` implementation
/// can actually evaluate. Phase 6 supports `Rubric` only; other
/// kinds (Classifier, Metric, Embedding, Assertion) are skipped with
/// a debug log so a recipe declaring them doesn't fail outright.
pub fn rubric_graders(graders: &[BacktestGrader]) -> Vec<&BacktestGrader> {
    graders
        .iter()
        .filter(|g| matches!(g.kind, BacktestGraderKind::Rubric))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn judge_json_direct_parse() {
        let r = parse_judge_json(r#"{"score": 0.83, "reasoning": "good"}"#).unwrap();
        assert_eq!(r.score, 0.83);
        assert_eq!(r.reasoning.as_deref(), Some("good"));
    }

    #[test]
    fn judge_json_inside_markdown() {
        let raw = "```json\n{\"score\": 0.5, \"reasoning\": \"meh\"}\n```";
        let r = parse_judge_json(raw).unwrap();
        assert_eq!(r.score, 0.5);
    }

    #[test]
    fn judge_json_with_preamble() {
        let raw = "Here's my evaluation:\n{\"score\": 1.0, \"reasoning\": \"ok\"}";
        let r = parse_judge_json(raw).unwrap();
        assert_eq!(r.score, 1.0);
    }

    #[test]
    fn judge_json_rejects_garbage() {
        assert!(parse_judge_json("not json").is_err());
        assert!(parse_judge_json("{\"label\": \"x\"}").is_err()); // no score
    }

    #[test]
    fn judge_json_clamp_at_grader_outcome() {
        // GraderOutcome::just clamps; test it.
        assert_eq!(GraderOutcome::just(1.5).score, 1.0);
        assert_eq!(GraderOutcome::just(-0.2).score, 0.0);
    }

    #[test]
    fn rubric_filter_excludes_other_kinds() {
        let mut g = BacktestGrader {
            id: "x".into(),
            label: "X".into(),
            kind: BacktestGraderKind::Assertion,
            weight: chronicle_domain::BacktestGraderWeight::Med,
            source: chronicle_domain::BacktestGraderSource::Custom,
            evidence: None,
        };
        let mut all = vec![g.clone()];
        g.id = "y".into();
        g.kind = BacktestGraderKind::Rubric;
        all.push(g);
        let only = rubric_graders(&all);
        assert_eq!(only.len(), 1);
        assert_eq!(only[0].id, "y");
    }
}
