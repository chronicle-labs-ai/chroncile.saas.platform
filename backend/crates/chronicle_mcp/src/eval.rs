use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpEvalTransport {
    Stdio,
    StreamableHttp,
}

impl McpEvalTransport {
    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_lowercase().as_str() {
            "stdio" => Some(Self::Stdio),
            "http" | "streamable-http" | "streamable_http" => Some(Self::StreamableHttp),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stdio => "stdio",
            Self::StreamableHttp => "streamable_http",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleMcpEvalScenario {
    pub id: String,
    pub title: String,
    pub prompt: String,
    pub seed_dataset: String,
    pub required_tools: Vec<String>,
    pub rubric: Vec<String>,
    pub transports: Vec<McpEvalTransport>,
    pub replay_required: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleMcpEvalResult {
    pub scenario_id: String,
    pub transport: McpEvalTransport,
    pub available_tool_count: Option<usize>,
    pub tool_calls: Vec<String>,
    pub missing_required_tools: Vec<String>,
    pub final_response: String,
    pub cited_evidence: Vec<String>,
    pub grounded: bool,
    pub passed: bool,
    pub latency_ms: Option<u64>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub transport_parity_passed: bool,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChronicleEvalBaseline {
    ClueRetrievalDump,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleBaselineEvalResult {
    pub scenario_id: String,
    pub baseline: ChronicleEvalBaseline,
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
pub struct ChronicleEvalComparison {
    pub scenario_id: String,
    pub transport: McpEvalTransport,
    pub mcp_passed: bool,
    pub baseline_passed: bool,
    pub mcp_grounded: bool,
    pub baseline_grounded: bool,
    pub mcp_cited_evidence_count: usize,
    pub baseline_cited_evidence_count: usize,
    pub mcp_tool_calls: usize,
    pub mcp_latency_ms: Option<u64>,
    pub baseline_latency_ms: Option<u64>,
    pub mcp_input_tokens: Option<u64>,
    pub baseline_input_tokens: Option<u64>,
    pub verdict: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleMcpEvalMatrix {
    pub scenarios: Vec<ChronicleMcpEvalScenario>,
}

#[async_trait]
pub trait ChronicleMcpEvalRunner: Send + Sync {
    async fn run_scenario(
        &self,
        scenario: &ChronicleMcpEvalScenario,
        transport: McpEvalTransport,
    ) -> Result<ChronicleMcpEvalResult, String>;
}

impl ChronicleMcpEvalMatrix {
    pub fn default() -> Self {
        Self {
            scenarios: vec![
                ChronicleMcpEvalScenario {
                    id: "incident_investigation".to_string(),
                    title: "Incident Investigation".to_string(),
                    prompt: "Why did this customer workflow fail, and what evidence in Chronicle supports that diagnosis?".to_string(),
                    seed_dataset: "seed/incident-investigation".to_string(),
                    required_tools: vec![
                        "list_runs".to_string(),
                        "get_run".to_string(),
                        "list_audit_logs".to_string(),
                        "get_timeline".to_string(),
                        "traverse_graph".to_string(),
                    ],
                    rubric: vec![
                        "Uses run and audit evidence before forming a conclusion.".to_string(),
                        "Cites MCP-returned facts instead of fabricating workflow state.".to_string(),
                        "Keeps the investigation tenant-scoped.".to_string(),
                    ],
                    transports: vec![McpEvalTransport::Stdio, McpEvalTransport::StreamableHttp],
                    replay_required: false,
                },
                ChronicleMcpEvalScenario {
                    id: "historical_event_debugging".to_string(),
                    title: "Historical Event Debugging".to_string(),
                    prompt: "Find the payment events related to this account and explain the execution path through Chronicle.".to_string(),
                    seed_dataset: "seed/historical-event-debugging".to_string(),
                    required_tools: vec![
                        "query_events".to_string(),
                        "search_events".to_string(),
                        "describe_sources".to_string(),
                        "get_timeline".to_string(),
                    ],
                    rubric: vec![
                        "Uses query or search tools to narrow the event set before summarizing.".to_string(),
                        "Explains the execution path with source and time ordering grounded in MCP data.".to_string(),
                        "Avoids cross-tenant leakage when account identifiers overlap.".to_string(),
                    ],
                    transports: vec![McpEvalTransport::Stdio, McpEvalTransport::StreamableHttp],
                    replay_required: false,
                },
                ChronicleMcpEvalScenario {
                    id: "user_interaction_story".to_string(),
                    title: "User Interaction Story".to_string(),
                    prompt: "Resolve the correct Chronicle user by joining partial clues from billing, onboarding, and support events, then reconstruct that user's story.".to_string(),
                    seed_dataset: "seed/user-interaction-story".to_string(),
                    required_tools: vec![
                        "query_events".to_string(),
                        "search_events".to_string(),
                    ],
                    rubric: vec![
                        "Resolves identity by joining partial clues across billing, onboarding, and support instead of relying on one exact identifier.".to_string(),
                        "Builds a chronological narrative grounded in MCP-returned events after narrowing to the correct account or user.".to_string(),
                        "Cites the resolved user id and exact event identifiers from Chronicle results.".to_string(),
                    ],
                    transports: vec![McpEvalTransport::Stdio, McpEvalTransport::StreamableHttp],
                    replay_required: false,
                },
                ChronicleMcpEvalScenario {
                    id: "high_volume_multi_hop_story".to_string(),
                    title: "High Volume Multi-Hop Story".to_string(),
                    prompt: "Resolve the correct Chronicle account in a tenant with a very large event corpus, then identify the exact failed run and audit log that explain the dashboard permission regression after billing activation.".to_string(),
                    seed_dataset: "seed/high-volume-multi-hop-story".to_string(),
                    required_tools: vec![
                        "search_events".to_string(),
                        "query_events".to_string(),
                        "get_timeline".to_string(),
                        "list_runs".to_string(),
                        "get_run".to_string(),
                        "list_audit_logs".to_string(),
                    ],
                    rubric: vec![
                        "Resolves the correct account from partial clues without relying on a pre-joined static slice.".to_string(),
                        "Uses Chronicle tools to fetch the exact failed run and audit evidence instead of inferring from partial snippets.".to_string(),
                        "Builds a grounded chronology across billing, product, workflow, and support under a very large event volume.".to_string(),
                    ],
                    transports: vec![McpEvalTransport::Stdio, McpEvalTransport::StreamableHttp],
                    replay_required: false,
                },
                ChronicleMcpEvalScenario {
                    id: "replay_or_live_monitoring".to_string(),
                    title: "Replay Or Live Monitoring".to_string(),
                    prompt: "Watch the replay or live stream and summarize notable state transitions or anomalies for the operator.".to_string(),
                    seed_dataset: "seed/replay-or-live-monitoring".to_string(),
                    required_tools: vec![
                        "watch_events".to_string(),
                        "replay_timeline".to_string(),
                    ],
                    rubric: vec![
                        "Summaries reference observed transitions from the live stream or replay output.".to_string(),
                        "Calls out gaps when replay is disabled rather than inventing replay evidence.".to_string(),
                        "Compares behavior across stdio and Streamable HTTP transports.".to_string(),
                    ],
                    transports: vec![McpEvalTransport::Stdio, McpEvalTransport::StreamableHttp],
                    replay_required: true,
                },
            ],
        }
    }

    pub fn select_scenarios(
        &self,
        scenario_ids: &[String],
    ) -> Result<Vec<ChronicleMcpEvalScenario>, String> {
        if scenario_ids.is_empty() {
            return Ok(self.scenarios.clone());
        }

        let mut selected = Vec::new();
        for scenario_id in scenario_ids {
            let scenario = self
                .scenarios
                .iter()
                .find(|scenario| &scenario.id == scenario_id)
                .ok_or_else(|| format!("Unknown Chronicle MCP eval scenario: {scenario_id}"))?;
            selected.push(scenario.clone());
        }

        Ok(selected)
    }

    pub async fn run<R: ChronicleMcpEvalRunner>(
        &self,
        runner: &R,
        replay_enabled: bool,
    ) -> Result<Vec<ChronicleMcpEvalResult>, String> {
        let mut results = Vec::new();

        for scenario in &self.scenarios {
            if scenario.replay_required && !replay_enabled {
                continue;
            }

            for transport in &scenario.transports {
                results.push(runner.run_scenario(scenario, *transport).await?);
            }
        }

        Ok(results)
    }

    pub fn apply_transport_parity(results: &mut [ChronicleMcpEvalResult]) {
        for index in 0..results.len() {
            let scenario_id = results[index].scenario_id.clone();
            let scenario_results: Vec<_> = results
                .iter()
                .filter(|result| result.scenario_id == scenario_id)
                .collect();

            if scenario_results.len() < 2 {
                results[index].transport_parity_passed = true;
                continue;
            }

            let all_passed = scenario_results.iter().all(|result| result.passed);
            let all_grounded = scenario_results.iter().all(|result| result.grounded);
            let first_missing = &scenario_results[0].missing_required_tools;
            let consistent_missing = scenario_results
                .iter()
                .all(|result| result.missing_required_tools == *first_missing);

            results[index].transport_parity_passed =
                all_passed && all_grounded && consistent_missing;
        }
    }
}

pub fn compare_mcp_to_baseline(
    mcp_results: &[ChronicleMcpEvalResult],
    baseline_results: &[ChronicleBaselineEvalResult],
) -> Result<Vec<ChronicleEvalComparison>, String> {
    let mut comparisons = Vec::new();

    for mcp_result in mcp_results {
        let baseline = baseline_results
            .iter()
            .find(|baseline| baseline.scenario_id == mcp_result.scenario_id)
            .ok_or_else(|| {
                format!(
                    "Missing baseline result for Chronicle MCP scenario {}",
                    mcp_result.scenario_id
                )
            })?;

        comparisons.push(ChronicleEvalComparison {
            scenario_id: mcp_result.scenario_id.clone(),
            transport: mcp_result.transport,
            mcp_passed: mcp_result.passed,
            baseline_passed: baseline.passed,
            mcp_grounded: mcp_result.grounded,
            baseline_grounded: baseline.grounded,
            mcp_cited_evidence_count: mcp_result.cited_evidence.len(),
            baseline_cited_evidence_count: baseline.cited_evidence.len(),
            mcp_tool_calls: mcp_result.tool_calls.len(),
            mcp_latency_ms: mcp_result.latency_ms,
            baseline_latency_ms: baseline.latency_ms,
            mcp_input_tokens: mcp_result.input_tokens,
            baseline_input_tokens: baseline.input_tokens,
            verdict: compare_verdict(mcp_result, baseline),
        });
    }

    Ok(comparisons)
}

fn compare_verdict(
    mcp_result: &ChronicleMcpEvalResult,
    baseline: &ChronicleBaselineEvalResult,
) -> String {
    if mcp_result.passed && !baseline.passed {
        return "mcp_better".to_string();
    }
    if !mcp_result.passed && baseline.passed {
        return "baseline_better".to_string();
    }
    if mcp_result.cited_evidence.len() > baseline.cited_evidence.len() {
        return "mcp_more_grounded".to_string();
    }
    if mcp_result.cited_evidence.len() < baseline.cited_evidence.len() {
        return "baseline_more_grounded".to_string();
    }
    "tie".to_string()
}
