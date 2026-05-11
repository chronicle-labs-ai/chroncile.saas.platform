use anyhow::{anyhow, Result};
use chronicle_mcp::{AnthropicMcpEvalRunner, ChronicleMcpEvalMatrix, McpEvalTransport};

#[tokio::test]
#[ignore = "requires ANTHROPIC_API_KEY and makes live Anthropic API calls"]
async fn anthropic_live_eval_runs_against_real_mcp_tools() -> Result<()> {
    let runner = AnthropicMcpEvalRunner::from_env().map_err(|error| anyhow!(error))?;
    let matrix = ChronicleMcpEvalMatrix::default();
    let scenario_ids = parse_scenarios();
    let transports = parse_transports();

    let results = runner
        .run_selected(&matrix, &scenario_ids, &transports)
        .await
        .map_err(|error| anyhow!(error))?;

    println!("{}", serde_json::to_string_pretty(&results)?);

    assert_eq!(results.len(), scenario_ids.len() * transports.len());
    assert!(results
        .iter()
        .all(|result| !result.final_response.trim().is_empty()));
    assert!(results.iter().all(|result| !result.tool_calls.is_empty()));

    Ok(())
}

fn parse_scenarios() -> Vec<String> {
    std::env::var("CHRONICLE_MCP_EVAL_SCENARIOS")
        .ok()
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|values| !values.is_empty())
        .unwrap_or_else(|| {
            vec![
                "incident_investigation".to_string(),
                "historical_event_debugging".to_string(),
            ]
        })
}

fn parse_transports() -> Vec<McpEvalTransport> {
    std::env::var("CHRONICLE_MCP_EVAL_TRANSPORTS")
        .ok()
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter_map(McpEvalTransport::parse)
                .collect::<Vec<_>>()
        })
        .filter(|values| !values.is_empty())
        .unwrap_or_else(|| vec![McpEvalTransport::Stdio])
}
