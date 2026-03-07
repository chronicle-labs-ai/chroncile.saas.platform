use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use axum::extract::FromRequestParts;
use axum::http::{request::Parts, StatusCode};
use chronicle_auth::types::AuthUser;
use chronicle_domain::{
    EntitlementKey, EntitlementSnapshot, FeatureAccessSnapshot, FeatureFlagDefinition,
    FeatureFlagKey, FeatureFlagOverride, FeatureFlagScope, FeatureFlagSnapshot, FeatureFlagType,
    FeatureValueSource, PlanId, Tenant, UpsertFeatureFlagDefinitionInput,
    UpsertFeatureFlagOverrideInput,
};
use chronicle_interfaces::{FeatureFlagRepository, RepoError, RepoResult, TenantRepository};

use crate::runtime_config::FeatureAccessRuntimeConfig;

const GLOBAL_SCOPE_ID: &str = "__global__";

#[derive(Clone)]
pub struct ResolvedFeatureAccess(pub FeatureAccessSnapshot);

#[async_trait]
impl<S> FromRequestParts<S> for ResolvedFeatureAccess
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<ResolvedFeatureAccess>()
            .cloned()
            .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

#[derive(Clone)]
pub struct FeatureAccessService {
    entitlements: Arc<EntitlementService>,
    feature_flags: Arc<FeatureFlagService>,
}

impl FeatureAccessService {
    pub fn new(
        tenants: Arc<dyn TenantRepository>,
        feature_flags: Arc<dyn FeatureFlagRepository>,
        config: FeatureAccessRuntimeConfig,
    ) -> Self {
        Self {
            entitlements: Arc::new(EntitlementService::new(tenants, config)),
            feature_flags: Arc::new(FeatureFlagService::new(feature_flags)),
        }
    }

    pub async fn resolve_for_user(&self, user: &AuthUser) -> RepoResult<FeatureAccessSnapshot> {
        let (_, plan_id, entitlements) = self
            .entitlements
            .resolve_for_tenant_id(&user.tenant_id)
            .await?;
        let flags = self
            .feature_flags
            .resolve_for_scopes(&user.tenant_id, Some(&user.id), entitlements.as_slice())
            .await?;
        Ok(FeatureAccessSnapshot {
            plan_id,
            flags,
            entitlements,
        })
    }

    pub async fn resolve_for_tenant(&self, tenant_id: &str) -> RepoResult<FeatureAccessSnapshot> {
        let (_, plan_id, entitlements) = self.entitlements.resolve_for_tenant_id(tenant_id).await?;
        let flags = self
            .feature_flags
            .resolve_for_scopes(tenant_id, None, entitlements.as_slice())
            .await?;
        Ok(FeatureAccessSnapshot {
            plan_id,
            flags,
            entitlements,
        })
    }

    pub async fn resolve_admin_view(
        &self,
        tenant_id: &str,
    ) -> RepoResult<(
        Option<Tenant>,
        FeatureAccessSnapshot,
        Vec<FeatureFlagOverride>,
    )> {
        let tenant = self.entitlements.tenants.find_by_id(tenant_id).await?;
        let access = self.resolve_for_tenant(tenant_id).await?;
        let overrides = self.feature_flags.list_tenant_overrides(tenant_id).await?;
        Ok((tenant, access, overrides))
    }

    pub async fn list_flag_definitions(&self) -> RepoResult<Vec<FeatureFlagDefinition>> {
        self.feature_flags.list_definitions().await
    }

    pub async fn upsert_tenant_override(
        &self,
        tenant_id: &str,
        flag_key: FeatureFlagKey,
        enabled: bool,
        reason: Option<String>,
    ) -> RepoResult<FeatureFlagOverride> {
        self.feature_flags
            .upsert_override(UpsertFeatureFlagOverrideInput {
                flag_key,
                scope_type: FeatureFlagScope::Tenant,
                scope_id: tenant_id.to_string(),
                enabled,
                reason,
                variant: None,
                rollout_percentage: None,
            })
            .await
    }

    pub async fn delete_tenant_override(
        &self,
        tenant_id: &str,
        flag_key: FeatureFlagKey,
    ) -> RepoResult<()> {
        self.feature_flags
            .delete_override(flag_key, FeatureFlagScope::Tenant, tenant_id)
            .await
    }
}

#[derive(Clone)]
struct EntitlementService {
    tenants: Arc<dyn TenantRepository>,
    plan_price_ids: HashMap<PlanId, Vec<String>>,
}

impl EntitlementService {
    fn new(tenants: Arc<dyn TenantRepository>, config: FeatureAccessRuntimeConfig) -> Self {
        Self {
            tenants,
            plan_price_ids: normalize_plan_price_ids(config.plan_price_ids),
        }
    }

    async fn resolve_for_tenant_id(
        &self,
        tenant_id: &str,
    ) -> RepoResult<(Tenant, PlanId, Vec<EntitlementSnapshot>)> {
        let tenant = self
            .tenants
            .find_by_id(tenant_id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("tenant: {tenant_id}")))?;
        let plan_id = self.resolve_plan_id(&tenant);
        let entitlements = entitlements_for_plan(plan_id);
        Ok((tenant, plan_id, entitlements))
    }

    fn resolve_plan_id(&self, tenant: &Tenant) -> PlanId {
        if let Some(price_id) = tenant.stripe_price_id.as_deref() {
            for (plan_id, price_ids) in &self.plan_price_ids {
                if price_ids.iter().any(|candidate| candidate == price_id) {
                    return *plan_id;
                }
            }
        }

        if is_active_subscription(tenant.stripe_subscription_status.as_deref()) {
            PlanId::Starter
        } else {
            PlanId::Free
        }
    }
}

#[derive(Clone)]
struct FeatureFlagService {
    repository: Arc<dyn FeatureFlagRepository>,
}

impl FeatureFlagService {
    fn new(repository: Arc<dyn FeatureFlagRepository>) -> Self {
        Self { repository }
    }

    async fn list_definitions(&self) -> RepoResult<Vec<FeatureFlagDefinition>> {
        self.ensure_catalog_synced().await?;
        self.repository.list_definitions().await
    }

    async fn list_tenant_overrides(&self, tenant_id: &str) -> RepoResult<Vec<FeatureFlagOverride>> {
        self.repository
            .list_overrides_for_scope(FeatureFlagScope::Tenant, tenant_id)
            .await
    }

    async fn upsert_override(
        &self,
        input: UpsertFeatureFlagOverrideInput,
    ) -> RepoResult<FeatureFlagOverride> {
        self.ensure_catalog_synced().await?;
        self.repository.upsert_override(input).await
    }

    async fn delete_override(
        &self,
        flag_key: FeatureFlagKey,
        scope_type: FeatureFlagScope,
        scope_id: &str,
    ) -> RepoResult<()> {
        self.repository
            .delete_override(flag_key, scope_type, scope_id)
            .await
    }

    async fn resolve_for_scopes(
        &self,
        tenant_id: &str,
        user_id: Option<&str>,
        entitlements: &[EntitlementSnapshot],
    ) -> RepoResult<Vec<FeatureFlagSnapshot>> {
        let definitions = self.list_definitions().await?;
        let entitlement_lookup = entitlements_by_key(entitlements);
        let global_overrides = self
            .repository
            .list_overrides_for_scope(FeatureFlagScope::Global, GLOBAL_SCOPE_ID)
            .await?;
        let tenant_overrides = self
            .repository
            .list_overrides_for_scope(FeatureFlagScope::Tenant, tenant_id)
            .await?;
        let user_overrides = match user_id {
            Some(user_id) => {
                self.repository
                    .list_overrides_for_scope(FeatureFlagScope::User, user_id)
                    .await?
            }
            None => Vec::new(),
        };

        let global_lookup = overrides_by_key(&global_overrides);
        let tenant_lookup = overrides_by_key(&tenant_overrides);
        let user_lookup = overrides_by_key(&user_overrides);

        let mut snapshots = Vec::with_capacity(definitions.len());
        for definition in definitions {
            let catalog = catalog_entry(definition.key);
            let mut enabled = if let Some(entitlement_key) = catalog.entitlement_default {
                entitlement_lookup
                    .get(&entitlement_key)
                    .map(|snapshot| snapshot.enabled)
                    .unwrap_or(definition.default_enabled)
            } else {
                definition.default_enabled
            };
            let mut source = if catalog.entitlement_default.is_some() {
                FeatureValueSource::Plan
            } else {
                FeatureValueSource::Default
            };
            let mut override_enabled = None;

            if !definition.enabled {
                enabled = false;
                source = FeatureValueSource::Default;
            }

            if let Some(global_override) = global_lookup.get(&definition.key) {
                enabled = global_override.enabled;
                source = FeatureValueSource::GlobalOverride;
                override_enabled = Some(global_override.enabled);
            }
            if let Some(tenant_override) = tenant_lookup.get(&definition.key) {
                enabled = tenant_override.enabled;
                source = FeatureValueSource::TenantOverride;
                override_enabled = Some(tenant_override.enabled);
            }
            if let Some(user_override) = user_lookup.get(&definition.key) {
                enabled = user_override.enabled;
                source = FeatureValueSource::UserOverride;
                override_enabled = Some(user_override.enabled);
            }

            snapshots.push(FeatureFlagSnapshot {
                key: definition.key,
                enabled,
                source,
                definition,
                override_enabled,
            });
        }

        Ok(snapshots)
    }

    async fn ensure_catalog_synced(&self) -> RepoResult<()> {
        for entry in FEATURE_FLAG_CATALOG {
            if self.repository.find_definition(entry.key).await?.is_none() {
                self.repository
                    .upsert_definition(entry.default_definition())
                    .await?;
            }
        }
        Ok(())
    }
}

#[derive(Clone, Copy)]
struct FeatureFlagCatalogEntry {
    key: FeatureFlagKey,
    flag_type: FeatureFlagType,
    description: &'static str,
    owner: &'static str,
    default_enabled: bool,
    entitlement_default: Option<EntitlementKey>,
}

impl FeatureFlagCatalogEntry {
    fn default_definition(self) -> UpsertFeatureFlagDefinitionInput {
        UpsertFeatureFlagDefinitionInput {
            key: self.key,
            flag_type: self.flag_type,
            description: self.description.to_string(),
            owner: self.owner.to_string(),
            default_enabled: self.default_enabled,
            enabled: true,
            expires_at: None,
        }
    }
}

const FEATURE_FLAG_CATALOG: &[FeatureFlagCatalogEntry] = &[
    FeatureFlagCatalogEntry {
        key: FeatureFlagKey::Sandbox,
        flag_type: FeatureFlagType::Entitlement,
        description: "Controls access to the sandbox tools.",
        owner: "platform",
        default_enabled: true,
        entitlement_default: Some(EntitlementKey::Sandbox),
    },
    FeatureFlagCatalogEntry {
        key: FeatureFlagKey::AuditLog,
        flag_type: FeatureFlagType::Entitlement,
        description: "Controls access to the audit log views.",
        owner: "platform",
        default_enabled: true,
        entitlement_default: Some(EntitlementKey::AuditLog),
    },
    FeatureFlagCatalogEntry {
        key: FeatureFlagKey::AgentEndpointConfig,
        flag_type: FeatureFlagType::Entitlement,
        description: "Controls access to agent endpoint configuration.",
        owner: "platform",
        default_enabled: true,
        entitlement_default: Some(EntitlementKey::AgentEndpointConfig),
    },
    FeatureFlagCatalogEntry {
        key: FeatureFlagKey::WorkflowFilters,
        flag_type: FeatureFlagType::Entitlement,
        description: "Controls access to workflow filter functionality.",
        owner: "platform",
        default_enabled: false,
        entitlement_default: Some(EntitlementKey::WorkflowFilters),
    },
];

fn catalog_entry(key: FeatureFlagKey) -> FeatureFlagCatalogEntry {
    FEATURE_FLAG_CATALOG
        .iter()
        .copied()
        .find(|entry| entry.key == key)
        .unwrap_or(FeatureFlagCatalogEntry {
            key,
            flag_type: FeatureFlagType::Release,
            description: "Uncatalogued feature flag.",
            owner: "platform",
            default_enabled: false,
            entitlement_default: None,
        })
}

fn normalize_plan_price_ids(raw: HashMap<String, Vec<String>>) -> HashMap<PlanId, Vec<String>> {
    raw.into_iter()
        .filter_map(|(plan_id, price_ids)| {
            let parsed_plan_id = plan_id.parse().ok()?;
            let normalized_ids = price_ids
                .into_iter()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>();
            Some((parsed_plan_id, normalized_ids))
        })
        .collect()
}

fn is_active_subscription(status: Option<&str>) -> bool {
    matches!(status, Some("active" | "trialing" | "past_due"))
}

fn entitlements_for_plan(plan_id: PlanId) -> Vec<EntitlementSnapshot> {
    let (max_connections, audit_retention_days, workflow_filters) = match plan_id {
        PlanId::Free => (Some(1), Some(7), false),
        PlanId::Starter => (Some(1), Some(30), false),
        PlanId::Pro => (Some(5), Some(90), true),
        PlanId::Enterprise => (None, Some(365), true),
        PlanId::CustomEnterprise => (None, Some(3650), true),
    };

    vec![
        entitlement(EntitlementKey::Runs, true, None),
        entitlement(
            EntitlementKey::Connections,
            true,
            max_connections.map(i64::from),
        ),
        entitlement(
            EntitlementKey::AuditLog,
            true,
            audit_retention_days.map(i64::from),
        ),
        entitlement(EntitlementKey::AgentEndpointConfig, true, None),
        entitlement(EntitlementKey::Sandbox, true, None),
        entitlement(EntitlementKey::WorkflowFilters, workflow_filters, None),
    ]
}

fn entitlement(key: EntitlementKey, enabled: bool, limit: Option<i64>) -> EntitlementSnapshot {
    EntitlementSnapshot {
        key,
        enabled,
        limit,
        source: FeatureValueSource::Plan,
    }
}

fn entitlements_by_key(
    entitlements: &[EntitlementSnapshot],
) -> HashMap<EntitlementKey, EntitlementSnapshot> {
    entitlements
        .iter()
        .cloned()
        .map(|snapshot| (snapshot.key, snapshot))
        .collect()
}

fn overrides_by_key(
    overrides: &[FeatureFlagOverride],
) -> HashMap<FeatureFlagKey, FeatureFlagOverride> {
    overrides
        .iter()
        .cloned()
        .map(|override_record| (override_record.flag_key, override_record))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chronicle_auth::types::AuthUser;
    use chronicle_domain::{CreateTenantInput, FeatureValueSource, UpsertFeatureFlagOverrideInput};
    use chronicle_infra::memory::{InMemoryFeatureFlagRepo, InMemoryTenantRepo};
    use chronicle_interfaces::FeatureFlagRepository;

    #[test]
    fn unknown_active_subscription_falls_back_to_starter() {
        let service = EntitlementService::new(
            Arc::new(TestTenantRepo),
            FeatureAccessRuntimeConfig {
                plan_price_ids: HashMap::new(),
            },
        );
        let tenant = Tenant {
            id: "tenant_1".to_string(),
            name: "Tenant".to_string(),
            slug: "tenant".to_string(),
            stripe_customer_id: None,
            stripe_subscription_status: Some("active".to_string()),
            stripe_price_id: Some("price_unknown".to_string()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        assert_eq!(service.resolve_plan_id(&tenant), PlanId::Starter);
    }

    #[tokio::test]
    async fn resolves_plan_entitlements_and_flags_from_price_mapping() {
        let tenant_repo = Arc::new(InMemoryTenantRepo::default());
        let feature_flag_repo = Arc::new(InMemoryFeatureFlagRepo::default());
        let tenant = tenant_repo
            .create(CreateTenantInput {
                name: "Acme".to_string(),
                slug: "acme".to_string(),
            })
            .await
            .unwrap();
        tenant_repo
            .update_stripe_fields(&tenant.id, None, Some("active"), Some("price_pro"))
            .await
            .unwrap();

        let service = FeatureAccessService::new(
            tenant_repo.clone(),
            feature_flag_repo,
            FeatureAccessRuntimeConfig {
                plan_price_ids: HashMap::from([("pro".to_string(), vec!["price_pro".to_string()])]),
            },
        );

        let access = service.resolve_for_user(&test_user(&tenant)).await.unwrap();

        assert_eq!(access.plan_id, PlanId::Pro);
        assert!(flag_enabled(&access, FeatureFlagKey::WorkflowFilters));
        assert_eq!(
            flag_source(&access, FeatureFlagKey::WorkflowFilters),
            FeatureValueSource::Plan
        );
        assert!(entitlement_enabled(
            &access,
            EntitlementKey::WorkflowFilters
        ));
        assert_eq!(
            entitlement_limit(&access, EntitlementKey::Connections),
            Some(5)
        );
    }

    #[tokio::test]
    async fn tenant_override_wins_over_plan_default() {
        let tenant_repo = Arc::new(InMemoryTenantRepo::default());
        let feature_flag_repo = Arc::new(InMemoryFeatureFlagRepo::default());
        let tenant = tenant_repo
            .create(CreateTenantInput {
                name: "Acme".to_string(),
                slug: "acme".to_string(),
            })
            .await
            .unwrap();
        tenant_repo
            .update_stripe_fields(&tenant.id, None, Some("active"), Some("price_pro"))
            .await
            .unwrap();

        let service = FeatureAccessService::new(
            tenant_repo.clone(),
            feature_flag_repo.clone(),
            FeatureAccessRuntimeConfig {
                plan_price_ids: HashMap::from([("pro".to_string(), vec!["price_pro".to_string()])]),
            },
        );

        service
            .upsert_tenant_override(
                &tenant.id,
                FeatureFlagKey::WorkflowFilters,
                false,
                Some("support hold".to_string()),
            )
            .await
            .unwrap();

        let access = service.resolve_for_user(&test_user(&tenant)).await.unwrap();

        assert!(!flag_enabled(&access, FeatureFlagKey::WorkflowFilters));
        assert_eq!(
            flag_source(&access, FeatureFlagKey::WorkflowFilters),
            FeatureValueSource::TenantOverride
        );
    }

    #[tokio::test]
    async fn user_override_is_applied_in_request_context() {
        let tenant_repo = Arc::new(InMemoryTenantRepo::default());
        let feature_flag_repo = Arc::new(InMemoryFeatureFlagRepo::default());
        let tenant = tenant_repo
            .create(CreateTenantInput {
                name: "Acme".to_string(),
                slug: "acme".to_string(),
            })
            .await
            .unwrap();
        tenant_repo
            .update_stripe_fields(&tenant.id, None, Some("active"), Some("price_pro"))
            .await
            .unwrap();

        let user = test_user(&tenant);
        let service = FeatureAccessService::new(
            tenant_repo,
            feature_flag_repo.clone(),
            FeatureAccessRuntimeConfig {
                plan_price_ids: HashMap::from([("pro".to_string(), vec!["price_pro".to_string()])]),
            },
        );

        feature_flag_repo
            .upsert_override(UpsertFeatureFlagOverrideInput {
                flag_key: FeatureFlagKey::WorkflowFilters,
                scope_type: FeatureFlagScope::User,
                scope_id: user.id.clone(),
                enabled: false,
                reason: Some("debug request-scope evaluation".to_string()),
                variant: None,
                rollout_percentage: None,
            })
            .await
            .unwrap();

        let access = service.resolve_for_user(&user).await.unwrap();

        assert!(!flag_enabled(&access, FeatureFlagKey::WorkflowFilters));
        assert_eq!(
            flag_source(&access, FeatureFlagKey::WorkflowFilters),
            FeatureValueSource::UserOverride
        );
    }

    fn test_user(tenant: &Tenant) -> AuthUser {
        AuthUser {
            id: "user_1".to_string(),
            email: "owner@example.com".to_string(),
            name: Some("Owner".to_string()),
            role: "owner".to_string(),
            tenant_id: tenant.id.clone(),
            tenant_name: tenant.name.clone(),
            tenant_slug: tenant.slug.clone(),
        }
    }

    fn flag_enabled(access: &FeatureAccessSnapshot, key: FeatureFlagKey) -> bool {
        access
            .flags
            .iter()
            .find(|flag| flag.key == key)
            .map(|flag| flag.enabled)
            .unwrap()
    }

    fn flag_source(access: &FeatureAccessSnapshot, key: FeatureFlagKey) -> FeatureValueSource {
        access
            .flags
            .iter()
            .find(|flag| flag.key == key)
            .map(|flag| flag.source)
            .unwrap()
    }

    fn entitlement_enabled(access: &FeatureAccessSnapshot, key: EntitlementKey) -> bool {
        access
            .entitlements
            .iter()
            .find(|entitlement| entitlement.key == key)
            .map(|entitlement| entitlement.enabled)
            .unwrap()
    }

    fn entitlement_limit(access: &FeatureAccessSnapshot, key: EntitlementKey) -> Option<i64> {
        access
            .entitlements
            .iter()
            .find(|entitlement| entitlement.key == key)
            .and_then(|entitlement| entitlement.limit)
    }

    #[derive(Clone)]
    struct TestTenantRepo;

    #[async_trait]
    impl TenantRepository for TestTenantRepo {
        async fn create(&self, _input: chronicle_domain::CreateTenantInput) -> RepoResult<Tenant> {
            unreachable!()
        }

        async fn find_by_id(&self, _id: &str) -> RepoResult<Option<Tenant>> {
            unreachable!()
        }

        async fn find_by_slug(&self, _slug: &str) -> RepoResult<Option<Tenant>> {
            unreachable!()
        }

        async fn find_by_stripe_customer_id(
            &self,
            _customer_id: &str,
        ) -> RepoResult<Option<Tenant>> {
            unreachable!()
        }

        async fn update_stripe_fields(
            &self,
            _id: &str,
            _customer_id: Option<&str>,
            _subscription_status: Option<&str>,
            _price_id: Option<&str>,
        ) -> RepoResult<Tenant> {
            unreachable!()
        }

        async fn update_name(&self, _id: &str, _name: &str) -> RepoResult<Tenant> {
            unreachable!()
        }

        async fn delete(&self, _id: &str) -> RepoResult<()> {
            unreachable!()
        }

        async fn list_all(&self, _limit: usize, _offset: usize) -> RepoResult<Vec<Tenant>> {
            unreachable!()
        }

        async fn count_all(&self) -> RepoResult<usize> {
            unreachable!()
        }
    }
}
