use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;

use chronicle_domain::{
    FeatureFlagDefinition, FeatureFlagKey, FeatureFlagOverride, FeatureFlagScope,
    UpsertFeatureFlagDefinitionInput, UpsertFeatureFlagOverrideInput,
};
use chronicle_interfaces::{FeatureFlagRepository, RepoError, RepoResult};

fn new_id() -> String {
    cuid2::create_id()
}

fn override_key(flag_key: FeatureFlagKey, scope_type: FeatureFlagScope, scope_id: &str) -> String {
    format!("{}:{}:{}", flag_key.as_str(), scope_type.as_str(), scope_id)
}

#[derive(Clone, Default)]
pub struct InMemoryFeatureFlagRepo {
    definitions: Arc<DashMap<String, FeatureFlagDefinition>>,
    overrides: Arc<DashMap<String, FeatureFlagOverride>>,
}

#[async_trait]
impl FeatureFlagRepository for InMemoryFeatureFlagRepo {
    async fn upsert_definition(
        &self,
        input: UpsertFeatureFlagDefinitionInput,
    ) -> RepoResult<FeatureFlagDefinition> {
        let now = Utc::now();
        let key = input.key.as_str().to_string();
        let created_at = self
            .definitions
            .get(&key)
            .map(|entry| entry.created_at)
            .unwrap_or(now);

        let definition = FeatureFlagDefinition {
            key: input.key,
            flag_type: input.flag_type,
            description: input.description,
            owner: input.owner,
            default_enabled: input.default_enabled,
            enabled: input.enabled,
            expires_at: input.expires_at,
            created_at,
            updated_at: now,
        };
        self.definitions.insert(key, definition.clone());
        Ok(definition)
    }

    async fn list_definitions(&self) -> RepoResult<Vec<FeatureFlagDefinition>> {
        let mut definitions: Vec<_> = self
            .definitions
            .iter()
            .map(|entry| entry.value().clone())
            .collect();
        definitions.sort_by_key(|definition| definition.key.as_str().to_string());
        Ok(definitions)
    }

    async fn find_definition(
        &self,
        key: FeatureFlagKey,
    ) -> RepoResult<Option<FeatureFlagDefinition>> {
        Ok(self
            .definitions
            .get(key.as_str())
            .map(|entry| entry.value().clone()))
    }

    async fn upsert_override(
        &self,
        input: UpsertFeatureFlagOverrideInput,
    ) -> RepoResult<FeatureFlagOverride> {
        let now = Utc::now();
        let map_key = override_key(input.flag_key, input.scope_type, &input.scope_id);
        let existing = self
            .overrides
            .get(&map_key)
            .map(|entry| entry.value().clone());
        let override_record = FeatureFlagOverride {
            id: existing
                .as_ref()
                .map(|record| record.id.clone())
                .unwrap_or_else(new_id),
            flag_key: input.flag_key,
            scope_type: input.scope_type,
            scope_id: input.scope_id,
            enabled: input.enabled,
            reason: input.reason,
            variant: input.variant,
            rollout_percentage: input.rollout_percentage,
            created_at: existing
                .as_ref()
                .map(|record| record.created_at)
                .unwrap_or(now),
            updated_at: now,
        };
        self.overrides.insert(map_key, override_record.clone());
        Ok(override_record)
    }

    async fn list_overrides_for_scope(
        &self,
        scope_type: FeatureFlagScope,
        scope_id: &str,
    ) -> RepoResult<Vec<FeatureFlagOverride>> {
        let mut overrides: Vec<_> = self
            .overrides
            .iter()
            .filter(|entry| entry.scope_type == scope_type && entry.scope_id == scope_id)
            .map(|entry| entry.value().clone())
            .collect();
        overrides.sort_by_key(|record| record.flag_key.as_str().to_string());
        Ok(overrides)
    }

    async fn delete_override(
        &self,
        flag_key: FeatureFlagKey,
        scope_type: FeatureFlagScope,
        scope_id: &str,
    ) -> RepoResult<()> {
        let map_key = override_key(flag_key, scope_type, scope_id);
        self.overrides.remove(&map_key).ok_or_else(|| {
            RepoError::NotFound(format!(
                "feature flag override: {}:{}:{}",
                flag_key.as_str(),
                scope_type.as_str(),
                scope_id
            ))
        })?;
        Ok(())
    }
}
