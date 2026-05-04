use std::sync::Arc;

use chronicle_auth::middleware::HasAuthDeps;
use chronicle_auth::workos_jwt::WorkosJwtVerifier;
use chronicle_infra::{StoreBackend, StreamBackend};
use chronicle_interfaces::{
    AgentEndpointConfigRepository, AuditLogRepository, ConnectionRepository, EmailService,
    FeatureFlagRepository, IntegrationSyncRepository, InvitationRepository, RunRepository,
    SandboxAiConfigService, TenantMembershipRepository, TenantRepository, UserRepository,
};
use chronicle_nango::NangoClient;

use crate::feature_access::FeatureAccessService;
use crate::runtime_config::SaasRuntimeConfig;

#[derive(Clone)]
pub struct SaasAppState {
    /// Validates WorkOS access tokens via JWKS. Used by every authenticated
    /// extractor (`AuthUser` and `WorkosAuthUser`).
    pub workos_jwt: Arc<WorkosJwtVerifier>,
    pub tenants: Arc<dyn TenantRepository>,
    pub users: Arc<dyn UserRepository>,
    pub runs: Arc<dyn RunRepository>,
    pub connections: Arc<dyn ConnectionRepository>,
    pub audit_logs: Arc<dyn AuditLogRepository>,
    pub agent_configs: Arc<dyn AgentEndpointConfigRepository>,
    pub integration_syncs: Arc<dyn IntegrationSyncRepository>,
    pub invitations: Arc<dyn InvitationRepository>,
    /// Multi-org membership lookup. The `WorkosAuthUser` extractor uses this
    /// to validate that the JWT's `org_id` claim corresponds to an active
    /// membership for the user. See migration 012_tenant_memberships.sql.
    pub memberships: Arc<dyn TenantMembershipRepository>,
    pub nango: Option<Arc<NangoClient>>,
    pub email: Arc<dyn EmailService>,
    pub sandbox_ai: Option<Arc<dyn SandboxAiConfigService>>,
    pub event_store: Arc<StoreBackend>,
    pub event_stream: Arc<StreamBackend>,
    pub feature_access: Arc<FeatureAccessService>,
    pub config: Arc<SaasRuntimeConfig>,
}

impl SaasAppState {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        workos_client_id: &str,
        tenants: Arc<dyn TenantRepository>,
        users: Arc<dyn UserRepository>,
        runs: Arc<dyn RunRepository>,
        connections: Arc<dyn ConnectionRepository>,
        audit_logs: Arc<dyn AuditLogRepository>,
        agent_configs: Arc<dyn AgentEndpointConfigRepository>,
        integration_syncs: Arc<dyn IntegrationSyncRepository>,
        feature_flags: Arc<dyn FeatureFlagRepository>,
        invitations: Arc<dyn InvitationRepository>,
        memberships: Arc<dyn TenantMembershipRepository>,
        nango: Option<Arc<NangoClient>>,
        email: Arc<dyn EmailService>,
        sandbox_ai: Option<Arc<dyn SandboxAiConfigService>>,
        event_store: Arc<StoreBackend>,
        event_stream: Arc<StreamBackend>,
        config: SaasRuntimeConfig,
    ) -> Self {
        Self {
            workos_jwt: Arc::new(WorkosJwtVerifier::new(workos_client_id)),
            tenants: Arc::clone(&tenants),
            users,
            runs,
            connections,
            audit_logs,
            agent_configs,
            integration_syncs,
            invitations,
            memberships,
            nango,
            email,
            sandbox_ai,
            event_store,
            event_stream,
            feature_access: Arc::new(FeatureAccessService::new(
                Arc::clone(&tenants),
                feature_flags,
                config.feature_access.clone(),
            )),
            config: Arc::new(config),
        }
    }
}

impl HasAuthDeps for SaasAppState {
    fn workos_jwt(&self) -> &Arc<WorkosJwtVerifier> {
        &self.workos_jwt
    }
    fn users(&self) -> &Arc<dyn UserRepository> {
        &self.users
    }
    fn tenants(&self) -> &Arc<dyn TenantRepository> {
        &self.tenants
    }
}
