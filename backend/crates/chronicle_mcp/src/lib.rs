pub mod auth;
mod data_access;
mod error;
mod eval;
mod eval_anthropic;
mod eval_context_dump;
mod eval_fragmented_tools;
mod eval_seed;
mod eval_transport;
mod resources;
mod server;

pub use auth::{ChronicleMcpAuthResolver, McpSessionContext};
pub use data_access::{
    ChronicleMcpDataAccess, EventQueryInput, InProcessChronicleMcpDataAccess, ListAuditLogsInput,
    ListRunsInput, ReplayTimelineInput, ReplayTimelineOutput, SearchInput, TimelineInput,
    WatchEventsInput, WatchEventsOutput,
};
pub use error::ChronicleMcpError;
pub use eval::{
    compare_mcp_to_baseline, ChronicleBaselineEvalResult, ChronicleEvalBaseline,
    ChronicleEvalComparison, ChronicleMcpEvalMatrix, ChronicleMcpEvalResult,
    ChronicleMcpEvalRunner, ChronicleMcpEvalScenario, McpEvalTransport,
};
pub use eval_anthropic::{AnthropicEvalConfig, AnthropicMcpEvalRunner};
pub use eval_context_dump::AnthropicContextDumpEvalRunner;
pub use eval_fragmented_tools::{
    compare_mcp_to_fragmented_tools, AnthropicFragmentedToolEvalRunner, FragmentedToolEvalResult,
    ToolSurfaceBenchmarkComparison,
};
pub use server::{ChronicleMcpServer, ChronicleMcpServerOptions};
