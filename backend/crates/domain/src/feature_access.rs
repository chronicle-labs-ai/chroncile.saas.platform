use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq, Hash, TS)]
#[ts(export, export_to = "generated/")]
pub enum PlanId {
    #[serde(rename = "free")]
    #[default]
    Free,
    #[serde(rename = "starter")]
    Starter,
    #[serde(rename = "pro")]
    Pro,
    #[serde(rename = "enterprise")]
    Enterprise,
    #[serde(rename = "customEnterprise")]
    CustomEnterprise,
}

impl PlanId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Free => "free",
            Self::Starter => "starter",
            Self::Pro => "pro",
            Self::Enterprise => "enterprise",
            Self::CustomEnterprise => "customEnterprise",
        }
    }
}

impl fmt::Display for PlanId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for PlanId {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "free" => Ok(Self::Free),
            "starter" => Ok(Self::Starter),
            "pro" => Ok(Self::Pro),
            "enterprise" => Ok(Self::Enterprise),
            "customEnterprise" => Ok(Self::CustomEnterprise),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, TS)]
#[ts(export, export_to = "generated/")]
pub enum FeatureFlagKey {
    #[serde(rename = "sandbox")]
    Sandbox,
    #[serde(rename = "auditLog")]
    AuditLog,
    #[serde(rename = "agentEndpointConfig")]
    AgentEndpointConfig,
    #[serde(rename = "workflowFilters")]
    WorkflowFilters,
}

impl FeatureFlagKey {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sandbox => "sandbox",
            Self::AuditLog => "auditLog",
            Self::AgentEndpointConfig => "agentEndpointConfig",
            Self::WorkflowFilters => "workflowFilters",
        }
    }

    pub fn all() -> &'static [Self] {
        const ALL: &[FeatureFlagKey] = &[
            FeatureFlagKey::Sandbox,
            FeatureFlagKey::AuditLog,
            FeatureFlagKey::AgentEndpointConfig,
            FeatureFlagKey::WorkflowFilters,
        ];
        ALL
    }
}

impl fmt::Display for FeatureFlagKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for FeatureFlagKey {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "sandbox" => Ok(Self::Sandbox),
            "auditLog" => Ok(Self::AuditLog),
            "agentEndpointConfig" => Ok(Self::AgentEndpointConfig),
            "workflowFilters" => Ok(Self::WorkflowFilters),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, TS)]
#[ts(export, export_to = "generated/")]
pub enum EntitlementKey {
    #[serde(rename = "runs")]
    Runs,
    #[serde(rename = "connections")]
    Connections,
    #[serde(rename = "auditLog")]
    AuditLog,
    #[serde(rename = "agentEndpointConfig")]
    AgentEndpointConfig,
    #[serde(rename = "sandbox")]
    Sandbox,
    #[serde(rename = "workflowFilters")]
    WorkflowFilters,
}

impl EntitlementKey {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Runs => "runs",
            Self::Connections => "connections",
            Self::AuditLog => "auditLog",
            Self::AgentEndpointConfig => "agentEndpointConfig",
            Self::Sandbox => "sandbox",
            Self::WorkflowFilters => "workflowFilters",
        }
    }

    pub fn all() -> &'static [Self] {
        const ALL: &[EntitlementKey] = &[
            EntitlementKey::Runs,
            EntitlementKey::Connections,
            EntitlementKey::AuditLog,
            EntitlementKey::AgentEndpointConfig,
            EntitlementKey::Sandbox,
            EntitlementKey::WorkflowFilters,
        ];
        ALL
    }
}

impl fmt::Display for EntitlementKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for EntitlementKey {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "runs" => Ok(Self::Runs),
            "connections" => Ok(Self::Connections),
            "auditLog" => Ok(Self::AuditLog),
            "agentEndpointConfig" => Ok(Self::AgentEndpointConfig),
            "sandbox" => Ok(Self::Sandbox),
            "workflowFilters" => Ok(Self::WorkflowFilters),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "generated/")]
pub enum FeatureFlagType {
    #[serde(rename = "release")]
    Release,
    #[serde(rename = "ops")]
    Ops,
    #[serde(rename = "experiment")]
    Experiment,
    #[serde(rename = "entitlement")]
    Entitlement,
}

impl FeatureFlagType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Release => "release",
            Self::Ops => "ops",
            Self::Experiment => "experiment",
            Self::Entitlement => "entitlement",
        }
    }
}

impl fmt::Display for FeatureFlagType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for FeatureFlagType {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "release" => Ok(Self::Release),
            "ops" => Ok(Self::Ops),
            "experiment" => Ok(Self::Experiment),
            "entitlement" => Ok(Self::Entitlement),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "generated/")]
pub enum FeatureFlagScope {
    #[serde(rename = "global")]
    Global,
    #[serde(rename = "tenant")]
    Tenant,
    #[serde(rename = "user")]
    User,
}

impl FeatureFlagScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::Tenant => "tenant",
            Self::User => "user",
        }
    }
}

impl fmt::Display for FeatureFlagScope {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for FeatureFlagScope {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "global" => Ok(Self::Global),
            "tenant" => Ok(Self::Tenant),
            "user" => Ok(Self::User),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "generated/")]
pub enum FeatureValueSource {
    #[serde(rename = "default")]
    Default,
    #[serde(rename = "plan")]
    Plan,
    #[serde(rename = "globalOverride")]
    GlobalOverride,
    #[serde(rename = "tenantOverride")]
    TenantOverride,
    #[serde(rename = "userOverride")]
    UserOverride,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct FeatureFlagDefinition {
    pub key: FeatureFlagKey,
    pub flag_type: FeatureFlagType,
    pub description: String,
    pub owner: String,
    pub default_enabled: bool,
    pub enabled: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct UpsertFeatureFlagDefinitionInput {
    pub key: FeatureFlagKey,
    pub flag_type: FeatureFlagType,
    pub description: String,
    pub owner: String,
    pub default_enabled: bool,
    pub enabled: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct FeatureFlagOverride {
    pub id: String,
    pub flag_key: FeatureFlagKey,
    pub scope_type: FeatureFlagScope,
    pub scope_id: String,
    pub enabled: bool,
    pub reason: Option<String>,
    pub variant: Option<String>,
    pub rollout_percentage: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct UpsertFeatureFlagOverrideInput {
    pub flag_key: FeatureFlagKey,
    pub scope_type: FeatureFlagScope,
    pub scope_id: String,
    pub enabled: bool,
    pub reason: Option<String>,
    pub variant: Option<String>,
    pub rollout_percentage: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct FeatureFlagSnapshot {
    pub key: FeatureFlagKey,
    pub enabled: bool,
    pub source: FeatureValueSource,
    pub definition: FeatureFlagDefinition,
    pub override_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct EntitlementSnapshot {
    pub key: EntitlementKey,
    pub enabled: bool,
    pub limit: Option<i64>,
    pub source: FeatureValueSource,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "generated/")]
pub struct FeatureAccessSnapshot {
    pub plan_id: PlanId,
    pub flags: Vec<FeatureFlagSnapshot>,
    pub entitlements: Vec<EntitlementSnapshot>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_id_roundtrips() {
        for plan_id in [
            PlanId::Free,
            PlanId::Starter,
            PlanId::Pro,
            PlanId::Enterprise,
            PlanId::CustomEnterprise,
        ] {
            let parsed: PlanId = plan_id.as_str().parse().unwrap();
            assert_eq!(parsed, plan_id);
        }
    }

    #[test]
    fn feature_flag_key_roundtrips() {
        for key in FeatureFlagKey::all() {
            let parsed: FeatureFlagKey = key.as_str().parse().unwrap();
            assert_eq!(&parsed, key);
        }
    }

    #[test]
    fn entitlement_key_roundtrips() {
        for key in EntitlementKey::all() {
            let parsed: EntitlementKey = key.as_str().parse().unwrap();
            assert_eq!(&parsed, key);
        }
    }
}
