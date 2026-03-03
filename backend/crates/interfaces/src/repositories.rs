use async_trait::async_trait;
use chronicle_domain::{
    AgentEndpointConfig, AuditLog, Connection, CreateConnectionInput, CreateInvitationInput,
    CreateRunInput, CreateTenantInput, CreateUserInput, Invitation, PipedreamTrigger, Run, Tenant,
    User,
};

pub type RepoResult<T> = Result<T, RepoError>;

#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("already exists: {0}")]
    AlreadyExists(String),
    #[error("internal error: {0}")]
    Internal(String),
}

#[async_trait]
pub trait TenantRepository: Send + Sync {
    async fn create(&self, input: CreateTenantInput) -> RepoResult<Tenant>;
    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Tenant>>;
    async fn find_by_slug(&self, slug: &str) -> RepoResult<Option<Tenant>>;
    async fn update_stripe_fields(
        &self,
        id: &str,
        customer_id: Option<&str>,
        subscription_status: Option<&str>,
        price_id: Option<&str>,
    ) -> RepoResult<Tenant>;
    async fn update_name(&self, id: &str, name: &str) -> RepoResult<Tenant>;
    async fn delete(&self, id: &str) -> RepoResult<()>;
    async fn list_all(&self, limit: usize, offset: usize) -> RepoResult<Vec<Tenant>>;
    async fn count_all(&self) -> RepoResult<usize>;
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create(&self, input: CreateUserInput) -> RepoResult<User>;
    async fn find_by_id(&self, id: &str) -> RepoResult<Option<User>>;
    async fn find_by_email(&self, email: &str) -> RepoResult<Option<User>>;
    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<User>>;
    async fn delete(&self, id: &str) -> RepoResult<()>;
    async fn update_role(&self, id: &str, role: &str) -> RepoResult<User>;
}

#[async_trait]
pub trait InvitationRepository: Send + Sync {
    async fn create(&self, input: CreateInvitationInput) -> RepoResult<Invitation>;
    async fn find_by_token(&self, token: &str) -> RepoResult<Option<Invitation>>;
    async fn find_by_email_and_tenant(
        &self,
        email: &str,
        tenant_id: &str,
    ) -> RepoResult<Option<Invitation>>;
    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<Invitation>>;
    async fn mark_accepted(&self, id: &str) -> RepoResult<Invitation>;
    async fn delete(&self, id: &str) -> RepoResult<()>;
}

#[async_trait]
pub trait RunRepository: Send + Sync {
    async fn create(&self, input: CreateRunInput) -> RepoResult<Run>;
    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Run>>;
    async fn list_by_tenant(
        &self,
        tenant_id: &str,
        status: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> RepoResult<Vec<Run>>;
    async fn update_status(&self, id: &str, status: &str) -> RepoResult<Run>;
    async fn update_response(&self, id: &str, agent_response: serde_json::Value)
        -> RepoResult<Run>;
    async fn count_by_tenant(&self, tenant_id: &str) -> RepoResult<usize>;
    async fn count_by_status(&self, tenant_id: &str, status: &str) -> RepoResult<usize>;
}

#[async_trait]
pub trait ConnectionRepository: Send + Sync {
    async fn create(&self, input: CreateConnectionInput) -> RepoResult<Connection>;
    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Connection>>;
    async fn find_by_tenant_provider(
        &self,
        tenant_id: &str,
        provider: &str,
    ) -> RepoResult<Option<Connection>>;
    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<Connection>>;
    async fn update_status(&self, id: &str, status: &str) -> RepoResult<Connection>;
    async fn delete(&self, id: &str) -> RepoResult<()>;
}

#[async_trait]
pub trait AuditLogRepository: Send + Sync {
    async fn create(
        &self,
        tenant_id: &str,
        action: &str,
        actor: Option<&str>,
        run_id: Option<&str>,
        event_id: Option<&str>,
        invocation_id: Option<&str>,
        payload: Option<serde_json::Value>,
    ) -> RepoResult<AuditLog>;
    async fn list_by_tenant(
        &self,
        tenant_id: &str,
        limit: usize,
        offset: usize,
    ) -> RepoResult<Vec<AuditLog>>;
    async fn list_by_run(&self, run_id: &str) -> RepoResult<Vec<AuditLog>>;
}

#[async_trait]
pub trait AgentEndpointConfigRepository: Send + Sync {
    async fn upsert(
        &self,
        tenant_id: &str,
        config: AgentEndpointConfig,
    ) -> RepoResult<AgentEndpointConfig>;
    async fn find_by_tenant(&self, tenant_id: &str) -> RepoResult<Option<AgentEndpointConfig>>;
}

#[async_trait]
pub trait PipedreamTriggerRepository: Send + Sync {
    async fn create(
        &self,
        tenant_id: &str,
        connection_id: &str,
        trigger_id: &str,
        deployment_id: &str,
        configured_props: Option<serde_json::Value>,
    ) -> RepoResult<PipedreamTrigger>;
    async fn find_by_deployment_id(
        &self,
        deployment_id: &str,
    ) -> RepoResult<Option<PipedreamTrigger>>;
    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<PipedreamTrigger>>;
    async fn update_status(&self, id: &str, status: &str) -> RepoResult<PipedreamTrigger>;
    async fn delete(&self, id: &str) -> RepoResult<()>;
}
