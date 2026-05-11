use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct SandboxDateRange {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct EventSourceConfig {
    pub date_range: SandboxDateRange,
    pub source_filter: Vec<String>,
    pub event_type_filter: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct FilterRule {
    pub id: String,
    pub field: String,
    pub operator: String,
    pub value: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct FilterConfig {
    pub rules: Vec<FilterRule>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[ts(export, export_to = "types/sandbox/")]
pub enum SandboxOutputType {
    #[serde(rename = "sse")]
    Sse,
    #[serde(rename = "webhook")]
    Webhook,
    #[serde(rename = "file")]
    File,
    #[serde(rename = "console")]
    Console,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[ts(export, export_to = "types/sandbox/")]
pub enum SandboxFileFormat {
    #[serde(rename = "jsonl")]
    Jsonl,
    #[serde(rename = "csv")]
    Csv,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct OutputConfig {
    pub output_type: SandboxOutputType,
    pub webhook_url: String,
    pub file_format: SandboxFileFormat,
    pub transform_template: String,
    pub included_fields: Vec<String>,
}

impl Default for OutputConfig {
    fn default() -> Self {
        Self {
            output_type: SandboxOutputType::Console,
            webhook_url: String::new(),
            file_format: SandboxFileFormat::Jsonl,
            transform_template: "{{ payload }}".to_string(),
            included_fields: vec![
                "event_id".to_string(),
                "source".to_string(),
                "event_type".to_string(),
                "occurred_at".to_string(),
                "actor".to_string(),
                "subject".to_string(),
                "payload".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct GeneratorConfig {
    pub source_types: Vec<String>,
    pub event_types: Vec<String>,
    pub count: u32,
    pub interval_ms: u32,
    pub variation_level: f64,
}

impl Default for GeneratorConfig {
    fn default() -> Self {
        Self {
            source_types: Vec::new(),
            event_types: Vec::new(),
            count: 50,
            interval_ms: 1_000,
            variation_level: 0.5,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(tag = "nodeType")]
#[ts(export, export_to = "types/sandbox/")]
pub enum SandboxNodeData {
    #[serde(rename = "event-source")]
    EventSource {
        label: String,
        config: EventSourceConfig,
    },
    #[serde(rename = "filter")]
    Filter { label: String, config: FilterConfig },
    #[serde(rename = "output")]
    Output { label: String, config: OutputConfig },
    #[serde(rename = "generator")]
    Generator {
        label: String,
        config: GeneratorConfig,
    },
}

impl SandboxNodeData {
    pub fn node_type(&self) -> &'static str {
        match self {
            Self::EventSource { .. } => "event-source",
            Self::Filter { .. } => "filter",
            Self::Output { .. } => "output",
            Self::Generator { .. } => "generator",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct SandboxNodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct SandboxNodeDto {
    pub id: String,
    pub position: SandboxNodePosition,
    pub data: SandboxNodeData,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct SandboxEdgeDto {
    pub id: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct GraphEditPreview {
    pub nodes: Vec<SandboxNodeDto>,
    pub edges: Vec<SandboxEdgeDto>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(tag = "type")]
#[ts(export, export_to = "types/sandbox/")]
pub enum GraphEditCommand {
    #[serde(rename = "add_node")]
    AddNode { node: SandboxNodeDto },
    #[serde(rename = "update_node")]
    UpdateNode { node: SandboxNodeDto },
    #[serde(rename = "remove_node")]
    RemoveNode {
        #[serde(rename = "nodeId")]
        node_id: String,
    },
    #[serde(rename = "add_edge")]
    AddEdge { edge: SandboxEdgeDto },
    #[serde(rename = "remove_edge")]
    RemoveEdge {
        #[serde(rename = "edgeId")]
        edge_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct GraphEditValidationError {
    pub command_index: Option<usize>,
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct SandboxValidationIssue {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct SandboxValidationResponse {
    pub ok: bool,
    pub issues: Vec<SandboxValidationIssue>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[ts(export, export_to = "types/sandbox/")]
pub enum SandboxAiChatRole {
    #[serde(rename = "user")]
    User,
    #[serde(rename = "assistant")]
    Assistant,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/sandbox/")]
pub struct SandboxAiChatMessage {
    pub role: SandboxAiChatRole,
    pub content: String,
}

pub fn apply_graph_edit_commands(
    nodes: &[SandboxNodeDto],
    edges: &[SandboxEdgeDto],
    commands: &[GraphEditCommand],
) -> Result<GraphEditPreview, Vec<GraphEditValidationError>> {
    let mut next_nodes = nodes.to_vec();
    let mut next_edges = edges.to_vec();
    let mut errors = Vec::new();

    for (command_index, command) in commands.iter().enumerate() {
        match command {
            GraphEditCommand::AddNode { node } => {
                if next_nodes.iter().any(|candidate| candidate.id == node.id) {
                    push_command_error(
                        &mut errors,
                        command_index,
                        "node.id",
                        format!("Node `{}` already exists", node.id),
                    );
                    continue;
                }

                next_nodes.push(node.clone());
            }
            GraphEditCommand::UpdateNode { node } => {
                let Some(index) = next_nodes
                    .iter()
                    .position(|candidate| candidate.id == node.id)
                else {
                    push_command_error(
                        &mut errors,
                        command_index,
                        "node.id",
                        format!("Node `{}` does not exist", node.id),
                    );
                    continue;
                };

                next_nodes[index] = node.clone();
            }
            GraphEditCommand::RemoveNode { node_id } => {
                let Some(index) = next_nodes
                    .iter()
                    .position(|candidate| candidate.id == *node_id)
                else {
                    push_command_error(
                        &mut errors,
                        command_index,
                        "nodeId",
                        format!("Node `{node_id}` does not exist"),
                    );
                    continue;
                };

                next_nodes.remove(index);
                next_edges.retain(|edge| edge.source != *node_id && edge.target != *node_id);
            }
            GraphEditCommand::AddEdge { edge } => {
                if next_edges.iter().any(|candidate| candidate.id == edge.id) {
                    push_command_error(
                        &mut errors,
                        command_index,
                        "edge.id",
                        format!("Edge `{}` already exists", edge.id),
                    );
                    continue;
                }

                if !next_nodes.iter().any(|node| node.id == edge.source) {
                    push_command_error(
                        &mut errors,
                        command_index,
                        "edge.source",
                        format!("Edge source `{}` does not exist", edge.source),
                    );
                }

                if !next_nodes.iter().any(|node| node.id == edge.target) {
                    push_command_error(
                        &mut errors,
                        command_index,
                        "edge.target",
                        format!("Edge target `{}` does not exist", edge.target),
                    );
                }

                if errors
                    .iter()
                    .any(|error| error.command_index == Some(command_index))
                {
                    continue;
                }

                next_edges.push(edge.clone());
            }
            GraphEditCommand::RemoveEdge { edge_id } => {
                let Some(index) = next_edges
                    .iter()
                    .position(|candidate| candidate.id == *edge_id)
                else {
                    push_command_error(
                        &mut errors,
                        command_index,
                        "edgeId",
                        format!("Edge `{edge_id}` does not exist"),
                    );
                    continue;
                };

                next_edges.remove(index);
            }
        }
    }

    if !errors.is_empty() {
        return Err(errors);
    }

    Ok(GraphEditPreview {
        nodes: next_nodes,
        edges: next_edges,
    })
}

pub fn validate_sandbox_graph(
    nodes: &[SandboxNodeDto],
    edges: &[SandboxEdgeDto],
) -> SandboxValidationResponse {
    let mut issues = Vec::new();

    if nodes.is_empty() {
        issues.push(validation_issue(
            "nodes",
            "Add at least one node to build a sandbox graph.",
        ));
    }

    for (index, edge) in edges.iter().enumerate() {
        if !nodes.iter().any(|node| node.id == edge.source) {
            issues.push(validation_issue(
                format!("edges[{index}].source"),
                format!("Edge source `{}` does not exist.", edge.source),
            ));
        }

        if !nodes.iter().any(|node| node.id == edge.target) {
            issues.push(validation_issue(
                format!("edges[{index}].target"),
                format!("Edge target `{}` does not exist.", edge.target),
            ));
        }
    }

    if !nodes.iter().any(|node| {
        matches!(
            node.data,
            SandboxNodeData::EventSource { .. } | SandboxNodeData::Generator { .. }
        )
    }) {
        issues.push(validation_issue(
            "nodes",
            "Add an event-source or generator node so the graph has an input.",
        ));
    }

    if !nodes
        .iter()
        .any(|node| matches!(node.data, SandboxNodeData::Output { .. }))
    {
        issues.push(validation_issue(
            "nodes",
            "Add at least one output node so the graph has a destination.",
        ));
    }

    for (index, node) in nodes.iter().enumerate() {
        match &node.data {
            SandboxNodeData::Filter { config, .. } if config.rules.is_empty() => {
                issues.push(validation_issue(
                    format!("nodes[{index}].data.config.rules"),
                    "Filter nodes should include at least one rule.",
                ));
            }
            SandboxNodeData::Output { config, .. } => {
                if matches!(config.output_type, SandboxOutputType::Webhook)
                    && config.webhook_url.trim().is_empty()
                {
                    issues.push(validation_issue(
                        format!("nodes[{index}].data.config.webhookUrl"),
                        "Webhook outputs need a destination URL.",
                    ));
                }

                if config.included_fields.is_empty() {
                    issues.push(validation_issue(
                        format!("nodes[{index}].data.config.includedFields"),
                        "Output nodes should include at least one field.",
                    ));
                }
            }
            _ => {}
        }
    }

    SandboxValidationResponse {
        ok: issues.is_empty(),
        issues,
    }
}

fn push_command_error(
    errors: &mut Vec<GraphEditValidationError>,
    command_index: usize,
    path: impl Into<String>,
    message: impl Into<String>,
) {
    errors.push(GraphEditValidationError {
        command_index: Some(command_index),
        path: path.into(),
        message: message.into(),
    });
}

fn validation_issue(path: impl Into<String>, message: impl Into<String>) -> SandboxValidationIssue {
    SandboxValidationIssue {
        path: path.into(),
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event_source_node(id: &str) -> SandboxNodeDto {
        SandboxNodeDto {
            id: id.to_string(),
            position: SandboxNodePosition { x: 80.0, y: 200.0 },
            data: SandboxNodeData::EventSource {
                label: "Intercom Events".to_string(),
                config: EventSourceConfig::default(),
            },
        }
    }

    fn output_node(id: &str) -> SandboxNodeDto {
        SandboxNodeDto {
            id: id.to_string(),
            position: SandboxNodePosition { x: 360.0, y: 200.0 },
            data: SandboxNodeData::Output {
                label: "Console Output".to_string(),
                config: OutputConfig::default(),
            },
        }
    }

    #[test]
    fn applies_graph_edit_commands_in_order() {
        let preview = apply_graph_edit_commands(
            &[event_source_node("source_1")],
            &[],
            &[
                GraphEditCommand::AddNode {
                    node: output_node("output_1"),
                },
                GraphEditCommand::AddEdge {
                    edge: SandboxEdgeDto {
                        id: "edge_1".to_string(),
                        source: "source_1".to_string(),
                        target: "output_1".to_string(),
                    },
                },
            ],
        )
        .expect("commands should apply");

        assert_eq!(preview.nodes.len(), 2);
        assert_eq!(preview.edges.len(), 1);
        assert_eq!(preview.edges[0].source, "source_1");
        assert_eq!(preview.edges[0].target, "output_1");
    }

    #[test]
    fn rejects_edges_that_reference_missing_nodes() {
        let errors = apply_graph_edit_commands(
            &[event_source_node("source_1")],
            &[],
            &[GraphEditCommand::AddEdge {
                edge: SandboxEdgeDto {
                    id: "edge_1".to_string(),
                    source: "source_1".to_string(),
                    target: "missing_output".to_string(),
                },
            }],
        )
        .expect_err("missing target should fail");

        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].path, "edge.target");
    }
}
