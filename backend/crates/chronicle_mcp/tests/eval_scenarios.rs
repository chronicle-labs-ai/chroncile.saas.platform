use async_trait::async_trait;
use chronicle_mcp::{
    compare_mcp_to_baseline, ChronicleBaselineEvalResult, ChronicleEvalBaseline,
    ChronicleMcpEvalMatrix, ChronicleMcpEvalResult, ChronicleMcpEvalRunner, McpEvalTransport,
};

#[tokio::test]
async fn default_eval_matrix_covers_expected_scenarios_and_transports() {
    let matrix = ChronicleMcpEvalMatrix::default();
    assert_eq!(matrix.scenarios.len(), 5);
    assert!(matrix
        .scenarios
        .iter()
        .any(|scenario| scenario.id == "user_interaction_story"));
    assert!(matrix
        .scenarios
        .iter()
        .any(|scenario| scenario.id == "high_volume_multi_hop_story"));

    for scenario in &matrix.scenarios {
        assert!(scenario.transports.contains(&McpEvalTransport::Stdio));
        assert!(scenario
            .transports
            .contains(&McpEvalTransport::StreamableHttp));
        assert!(!scenario.required_tools.is_empty());
        assert!(!scenario.rubric.is_empty());
    }
}

#[tokio::test]
async fn eval_runner_skips_replay_scenarios_when_replay_is_disabled() {
    struct RecordingRunner;

    #[async_trait]
    impl ChronicleMcpEvalRunner for RecordingRunner {
        async fn run_scenario(
            &self,
            scenario: &chronicle_mcp::ChronicleMcpEvalScenario,
            transport: McpEvalTransport,
        ) -> Result<ChronicleMcpEvalResult, String> {
            Ok(ChronicleMcpEvalResult {
                scenario_id: scenario.id.clone(),
                transport,
                available_tool_count: Some(scenario.required_tools.len()),
                tool_calls: scenario.required_tools.clone(),
                missing_required_tools: vec![],
                final_response: "grounded answer".to_string(),
                cited_evidence: vec!["evt_test".to_string()],
                grounded: true,
                passed: true,
                latency_ms: Some(100),
                input_tokens: Some(250),
                output_tokens: Some(75),
                transport_parity_passed: true,
                notes: vec![],
            })
        }
    }

    let matrix = ChronicleMcpEvalMatrix::default();
    let results = matrix
        .run(&RecordingRunner, false)
        .await
        .expect("eval run should succeed");

    assert_eq!(results.len(), 8);
    assert!(results
        .iter()
        .all(|result| result.scenario_id != "replay_or_live_monitoring"));
}

#[test]
fn compare_results_flags_mcp_advantage_when_mcp_passes_and_baseline_fails() {
    let mcp_results = vec![ChronicleMcpEvalResult {
        scenario_id: "user_interaction_story".to_string(),
        transport: McpEvalTransport::Stdio,
        available_tool_count: Some(4),
        tool_calls: vec!["describe_sources".to_string(), "query_events".to_string()],
        missing_required_tools: vec![],
        final_response: "grounded".to_string(),
        cited_evidence: vec!["evt_1".to_string(), "evt_2".to_string()],
        grounded: true,
        passed: true,
        latency_ms: Some(800),
        input_tokens: Some(1_000),
        output_tokens: Some(180),
        transport_parity_passed: true,
        notes: vec![],
    }];
    let baseline_results = vec![ChronicleBaselineEvalResult {
        scenario_id: "user_interaction_story".to_string(),
        baseline: ChronicleEvalBaseline::ClueRetrievalDump,
        final_response: "weak answer".to_string(),
        cited_evidence: vec![],
        grounded: false,
        passed: false,
        latency_ms: Some(300),
        input_tokens: Some(1_500),
        output_tokens: Some(120),
        notes: vec![],
    }];

    let comparisons =
        compare_mcp_to_baseline(&mcp_results, &baseline_results).expect("comparison succeeds");

    assert_eq!(comparisons.len(), 1);
    assert_eq!(comparisons[0].verdict, "mcp_better");
    assert!(comparisons[0].mcp_passed);
    assert!(!comparisons[0].baseline_passed);
    assert_eq!(comparisons[0].mcp_cited_evidence_count, 2);
}
