use std::sync::Arc;

use chronicle_auth::jwt::JwtService;
use chronicle_infra::{StoreBackend, StreamBackend};
use chronicle_interfaces::{
    AuditLogRepository, AgentEndpointConfigRepository, ConnectionRepository,
    EmailService, InvitationRepository, PipedreamTriggerRepository, RunRepository,
    TenantRepository, UserRepository,
};
use pipedream_connect::PipedreamClient;

use crate::escalation::EscalationLog;

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
    pub pipedream: Option<Arc<PipedreamClient>>,
    pub email: Arc<dyn EmailService>,
    pub event_store: Arc<StoreBackend>,
    pub event_stream: Arc<StreamBackend>,
    pub escalation_log: EscalationLog,
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
        invitations: Arc<dyn InvitationRepository>,
        pipedream: Option<Arc<PipedreamClient>>,
        email: Arc<dyn EmailService>,
        event_store: Arc<StoreBackend>,
        event_stream: Arc<StreamBackend>,
        escalation_log: EscalationLog,
    ) -> Self {
        Self {
            jwt: Arc::new(JwtService::new(jwt_secret)),
            tenants,
            users,
            runs,
            connections,
            audit_logs,
            agent_configs,
            pipedream_triggers,
            invitations,
            pipedream,
            email,
            event_store,
            event_stream,
            escalation_log,
        }
    }
}
