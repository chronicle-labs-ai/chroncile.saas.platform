use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    AgentEndpointConfig, AuditLog, Connection, FeatureAccessSnapshot, FeatureFlagDefinition,
    FeatureFlagOverride, PipedreamTrigger, Run, Tenant,
};

// ── Dashboard ──

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct DashboardStatsResponse {
    pub total_runs: usize,
    pub pending_runs: usize,
    pub completed_runs: usize,
    pub failed_runs: usize,
    pub total_connections: usize,
    pub active_connections: usize,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct DashboardActivityResponse {
    pub activity: Vec<AuditLog>,
}

// ── Runs ──

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct ListRunsParams {
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct ListRunsResponse {
    pub runs: Vec<Run>,
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct CreateRunRequest {
    pub event_id: String,
    pub invocation_id: String,
    pub mode: Option<String>,
    pub workflow_id: Option<String>,
    pub event_snapshot: Option<serde_json::Value>,
    pub context_pointers: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct RunResponse {
    pub run: Run,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct RunDetailResponse {
    pub run: Run,
    pub audit_logs: Vec<AuditLog>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct UpdateRunStatusRequest {
    pub status: String,
}

// ── Settings ──

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct AgentEndpointResponse {
    pub config: Option<AgentEndpointConfig>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct UpdateAgentEndpointRequest {
    pub endpoint_url: Option<String>,
    pub auth_type: Option<String>,
    pub auth_header_name: Option<String>,
    pub basic_username: Option<String>,
}

// ── Connections ──

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct ConnectionListResponse {
    pub connections: Vec<Connection>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct ConnectionResponse {
    pub connection: Connection,
}

// ── Audit ──

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct AuditLogParams {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct AuditLogListResponse {
    pub audit_logs: Vec<AuditLog>,
    pub limit: usize,
    pub offset: usize,
}

// ── Tenant ──

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct TenantResponse {
    pub tenant: Option<Tenant>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct UpdateStripeRequest {
    pub stripe_customer_id: Option<String>,
    pub stripe_subscription_status: Option<String>,
    pub stripe_price_id: Option<String>,
}

// ── Feature Access ──

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct FeatureAccessResponse {
    pub access: FeatureAccessSnapshot,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct FeatureFlagDefinitionsResponse {
    pub flags: Vec<FeatureFlagDefinition>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct AdminTenantFeatureAccessResponse {
    pub tenant: Option<Tenant>,
    pub access: FeatureAccessSnapshot,
    pub overrides: Vec<FeatureFlagOverride>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct UpsertFeatureFlagOverrideRequest {
    pub enabled: bool,
    pub reason: Option<String>,
}

// ── Pipedream ──

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct ListAppsParams {
    pub q: Option<String>,
    pub limit: Option<u64>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct ListTriggersParams {
    pub app: Option<String>,
    pub q: Option<String>,
    pub limit: Option<u64>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct DeployTriggerRequest {
    pub trigger_id: String,
    pub webhook_url: Option<String>,
    pub configured_props: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct DeployedTriggersResponse {
    pub data: serde_json::Value,
    pub triggers: Vec<PipedreamTrigger>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct PipedreamTokenRequest {
    pub app_id: Option<String>,
}

// ── Auth (request types for login/signup) ──

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub name: String,
    pub org_name: String,
}
