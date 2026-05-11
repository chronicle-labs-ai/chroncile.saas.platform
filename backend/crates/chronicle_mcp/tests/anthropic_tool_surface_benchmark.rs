use anyhow::{anyhow, Result};
use chronicle_mcp::{
    compare_mcp_to_fragmented_tools, AnthropicFragmentedToolEvalRunner, AnthropicMcpEvalRunner,
    ChronicleMcpEvalMatrix, McpEvalTransport,
};
use std::time::Duration;

#[tokio::test]
#[ignore = "requires ANTHROPIC_API_KEY and makes live Anthropic API calls"]
async fn anthropic_tool_surface_benchmark_compares_fragmented_tools_to_chronicle_mcp() -> Result<()>
{
    let fragmented_runner =
        AnthropicFragmentedToolEvalRunner::from_env().map_err(|error| anyhow!(error))?;
    let mcp_runner = AnthropicMcpEvalRunner::from_env().map_err(|error| anyhow!(error))?;
    let matrix = ChronicleMcpEvalMatrix::default();
    let scenario_ids = parse_scenarios();
    let transports = parse_transports();
    let pause_seconds = parse_pause_seconds();

    let fragmented_results = fragmented_runner
        .run_selected(&matrix, &scenario_ids)
        .await
        .map_err(|error| anyhow!(error))?;
    if pause_seconds > 0 {
        tokio::time::sleep(Duration::from_secs(pause_seconds)).await;
    }
    let mcp_results = mcp_runner
        .run_selected(&matrix, &scenario_ids, &transports)
        .await
        .map_err(|error| anyhow!(error))?;
    let comparisons = compare_mcp_to_fragmented_tools(&mcp_results, &fragmented_results)
        .map_err(|error| anyhow!(error))?;

    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "fragmentedResults": fragmented_results,
            "mcpResults": mcp_results,
            "comparisons": comparisons
        }))?
    );

    assert_eq!(fragmented_results.len(), scenario_ids.len());
    assert_eq!(comparisons.len(), scenario_ids.len() * transports.len());
    assert!(comparisons
        .iter()
        .all(|comparison| !comparison.verdict.trim().is_empty()));

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
        .unwrap_or_else(|| vec!["high_volume_multi_hop_story".to_string()])
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

fn parse_pause_seconds() -> u64 {
    std::env::var("CHRONICLE_MCP_EVAL_PAUSE_SECONDS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(75)
}
