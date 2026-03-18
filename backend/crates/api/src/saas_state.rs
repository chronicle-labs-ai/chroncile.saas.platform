use std::sync::Arc;

use chronicle_auth::jwt::JwtService;
use chronicle_infra::{StoreBackend, StreamBackend};
use chronicle_interfaces::{
    AgentEndpointConfigRepository, AuditLogRepository, ConnectionRepository, EmailService,
    FeatureFlagRepository, InvitationRepository, PasswordResetRepository, SandboxAiConfigService,
    PipedreamTriggerRepository, RunRepository, TenantRepository, UserRepository,
};
use chronicle_nango::NangoClient;
use chronicle_pipedream_connect::PipedreamClient;

use crate::feature_access::FeatureAccessService;
use crate::runtime_config::SaasRuntimeConfig;

#[derive(Clone)]
pub struct SaasAppState {
    pub jwt: Arc<JwtService>,
    pub tenants: Arc<dyn TenantRepository>,
    pub users: Arc<dyn UserRepository>,
    pub runs: Arc<dyn RunRepository>,
    pub connections: Arc<dyn ConnectionRepository>,
    pub audit_logs: Arc<dyn AuditLogRepository>,
    pub agent_configs: Arc<dyn AgentEndpointConfigRepository>,
    pub pipedream_triggers: Arc<dyn PipedreamTriggerRepository>,
    pub invitations: Arc<dyn InvitationRepository>,
    pub password_resets: Arc<dyn PasswordResetRepository>,
    pub pipedream: Option<Arc<PipedreamClient>>,
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
        jwt_secret: &str,
        tenants: Arc<dyn TenantRepository>,
        users: Arc<dyn UserRepository>,
        runs: Arc<dyn RunRepository>,
        connections: Arc<dyn ConnectionRepository>,
        audit_logs: Arc<dyn AuditLogRepository>,
        agent_configs: Arc<dyn AgentEndpointConfigRepository>,
        pipedream_triggers: Arc<dyn PipedreamTriggerRepository>,
        feature_flags: Arc<dyn FeatureFlagRepository>,
        invitations: Arc<dyn InvitationRepository>,
        password_resets: Arc<dyn PasswordResetRepository>,
        pipedream: Option<Arc<PipedreamClient>>,
        nango: Option<Arc<NangoClient>>,
        email: Arc<dyn EmailService>,
        sandbox_ai: Option<Arc<dyn SandboxAiConfigService>>,
        event_store: Arc<StoreBackend>,
        event_stream: Arc<StreamBackend>,
        config: SaasRuntimeConfig,
    ) -> Self {
        Self {
            jwt: Arc::new(JwtService::new(jwt_secret)),
            tenants: Arc::clone(&tenants),
            users,
            runs,
            connections,
            audit_logs,
            agent_configs,
            pipedream_triggers,
            invitations,
            password_resets,
            pipedream,
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
