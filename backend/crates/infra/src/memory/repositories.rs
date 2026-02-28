use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;

use chronicle_domain::{
    AuditLog, AgentEndpointConfig, Connection, CreateConnectionInput,
    CreateRunInput, CreateTenantInput, CreateUserInput, PipedreamTrigger,
    Run, Tenant, User,
};
use chronicle_interfaces::{
    AuditLogRepository, AgentEndpointConfigRepository, ConnectionRepository,
    PipedreamTriggerRepository, RepoError, RepoResult, RunRepository,
    TenantRepository, UserRepository,
};

fn new_id() -> String {
    cuid2::create_id()
}

// === Tenant ===

#[derive(Clone, Default)]
pub struct InMemoryTenantRepo {
    store: Arc<DashMap<String, Tenant>>,
}

#[async_trait]
impl TenantRepository for InMemoryTenantRepo {
    async fn create(&self, input: CreateTenantInput) -> RepoResult<Tenant> {
        if self.store.iter().any(|e| e.value().slug == input.slug) {
            return Err(RepoError::AlreadyExists(format!("slug: {}", input.slug)));
        }
        let now = Utc::now();
        let tenant = Tenant {
            id: new_id(),
            name: input.name,
            slug: input.slug,
            stripe_customer_id: None,
            stripe_subscription_status: None,
            stripe_price_id: None,
            created_at: now,
            updated_at: now,
        };
        self.store.insert(tenant.id.clone(), tenant.clone());
        Ok(tenant)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Tenant>> {
        Ok(self.store.get(id).map(|e| e.value().clone()))
    }

    async fn find_by_slug(&self, slug: &str) -> RepoResult<Option<Tenant>> {
        Ok(self.store.iter().find(|e| e.value().slug == slug).map(|e| e.value().clone()))
    }

    async fn update_stripe_fields(
        &self,
        id: &str,
        customer_id: Option<&str>,
        subscription_status: Option<&str>,
        price_id: Option<&str>,
    ) -> RepoResult<Tenant> {
        let mut tenant = self.store.get_mut(id)
            .ok_or_else(|| RepoError::NotFound(format!("tenant: {id}")))?;
        if let Some(cid) = customer_id {
            tenant.stripe_customer_id = Some(cid.to_string());
        }
        if let Some(status) = subscription_status {
            tenant.stripe_subscription_status = Some(status.to_string());
        }
        if let Some(pid) = price_id {
            tenant.stripe_price_id = Some(pid.to_string());
        }
        tenant.updated_at = Utc::now();
        Ok(tenant.clone())
    }
}

// === User ===

#[derive(Clone, Default)]
pub struct InMemoryUserRepo {
    store: Arc<DashMap<String, User>>,
}

#[async_trait]
impl UserRepository for InMemoryUserRepo {
    async fn create(&self, input: CreateUserInput) -> RepoResult<User> {
        if self.store.iter().any(|e| e.value().email == input.email) {
            return Err(RepoError::AlreadyExists(format!("email: {}", input.email)));
        }
        let now = Utc::now();
        let user = User {
            id: new_id(),
            email: input.email,
            name: input.name,
            password: input.password_hash,
            auth_provider: input.auth_provider,
            tenant_id: input.tenant_id,
            created_at: now,
            updated_at: now,
        };
        self.store.insert(user.id.clone(), user.clone());
        Ok(user)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<User>> {
        Ok(self.store.get(id).map(|e| e.value().clone()))
    }

    async fn find_by_email(&self, email: &str) -> RepoResult<Option<User>> {
        Ok(self.store.iter().find(|e| e.value().email == email).map(|e| e.value().clone()))
    }
}

// === Run ===

#[derive(Clone, Default)]
pub struct InMemoryRunRepo {
    store: Arc<DashMap<String, Run>>,
}

#[async_trait]
impl RunRepository for InMemoryRunRepo {
    async fn create(&self, input: CreateRunInput) -> RepoResult<Run> {
        if self.store.iter().any(|e| e.value().invocation_id == input.invocation_id) {
            return Err(RepoError::AlreadyExists(format!(
                "invocation_id: {}", input.invocation_id
            )));
        }
        let now = Utc::now();
        let run = Run {
            id: new_id(),
            tenant_id: input.tenant_id,
            workflow_id: input.workflow_id,
            event_id: input.event_id,
            invocation_id: input.invocation_id,
            mode: input.mode,
            status: "pending".to_string(),
            event_snapshot: input.event_snapshot,
            context_pointers: input.context_pointers,
            agent_request: None,
            agent_response: None,
            human_decision: None,
            created_at: now,
            updated_at: now,
        };
        self.store.insert(run.id.clone(), run.clone());
        Ok(run)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Run>> {
        Ok(self.store.get(id).map(|e| e.value().clone()))
    }

    async fn list_by_tenant(
        &self,
        tenant_id: &str,
        status: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> RepoResult<Vec<Run>> {
        let mut runs: Vec<Run> = self.store.iter()
            .filter(|e| e.value().tenant_id == tenant_id)
            .filter(|e| status.map_or(true, |s| e.value().status == s))
            .map(|e| e.value().clone())
            .collect();
        runs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(runs.into_iter().skip(offset).take(limit).collect())
    }

    async fn update_status(&self, id: &str, status: &str) -> RepoResult<Run> {
        let mut run = self.store.get_mut(id)
            .ok_or_else(|| RepoError::NotFound(format!("run: {id}")))?;
        run.status = status.to_string();
        run.updated_at = Utc::now();
        Ok(run.clone())
    }

    async fn update_response(&self, id: &str, agent_response: serde_json::Value) -> RepoResult<Run> {
        let mut run = self.store.get_mut(id)
            .ok_or_else(|| RepoError::NotFound(format!("run: {id}")))?;
        run.agent_response = Some(agent_response);
        run.updated_at = Utc::now();
        Ok(run.clone())
    }

    async fn count_by_tenant(&self, tenant_id: &str) -> RepoResult<usize> {
        Ok(self.store.iter().filter(|e| e.value().tenant_id == tenant_id).count())
    }

    async fn count_by_status(&self, tenant_id: &str, status: &str) -> RepoResult<usize> {
        Ok(self.store.iter()
            .filter(|e| e.value().tenant_id == tenant_id && e.value().status == status)
            .count())
    }
}

// === Connection ===

#[derive(Clone, Default)]
pub struct InMemoryConnectionRepo {
    store: Arc<DashMap<String, Connection>>,
}

#[async_trait]
impl ConnectionRepository for InMemoryConnectionRepo {
    async fn create(&self, input: CreateConnectionInput) -> RepoResult<Connection> {
        if self.store.iter().any(|e| {
            e.value().tenant_id == input.tenant_id && e.value().provider == input.provider
        }) {
            return Err(RepoError::AlreadyExists(format!(
                "tenant_id: {}, provider: {}", input.tenant_id, input.provider
            )));
        }
        let now = Utc::now();
        let conn = Connection {
            id: new_id(),
            tenant_id: input.tenant_id,
            provider: input.provider,
            access_token: input.access_token,
            refresh_token: input.refresh_token,
            expires_at: input.expires_at,
            pipedream_auth_id: input.pipedream_auth_id,
            metadata: input.metadata,
            status: "active".to_string(),
            created_at: now,
            updated_at: now,
        };
        self.store.insert(conn.id.clone(), conn.clone());
        Ok(conn)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Connection>> {
        Ok(self.store.get(id).map(|e| e.value().clone()))
    }

    async fn find_by_tenant_provider(&self, tenant_id: &str, provider: &str) -> RepoResult<Option<Connection>> {
        Ok(self.store.iter()
            .find(|e| e.value().tenant_id == tenant_id && e.value().provider == provider)
            .map(|e| e.value().clone()))
    }

    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<Connection>> {
        Ok(self.store.iter()
            .filter(|e| e.value().tenant_id == tenant_id)
            .map(|e| e.value().clone())
            .collect())
    }

    async fn update_status(&self, id: &str, status: &str) -> RepoResult<Connection> {
        let mut conn = self.store.get_mut(id)
            .ok_or_else(|| RepoError::NotFound(format!("connection: {id}")))?;
        conn.status = status.to_string();
        conn.updated_at = Utc::now();
        Ok(conn.clone())
    }

    async fn delete(&self, id: &str) -> RepoResult<()> {
        self.store.remove(id)
            .ok_or_else(|| RepoError::NotFound(format!("connection: {id}")))?;
        Ok(())
    }
}

// === AuditLog ===

#[derive(Clone, Default)]
pub struct InMemoryAuditLogRepo {
    store: Arc<DashMap<String, AuditLog>>,
}

#[async_trait]
impl AuditLogRepository for InMemoryAuditLogRepo {
    async fn create(
        &self,
        tenant_id: &str,
        action: &str,
        actor: Option<&str>,
        run_id: Option<&str>,
        event_id: Option<&str>,
        invocation_id: Option<&str>,
        payload: Option<serde_json::Value>,
    ) -> RepoResult<AuditLog> {
        let log = AuditLog {
            id: new_id(),
            tenant_id: tenant_id.to_string(),
            run_id: run_id.map(|s| s.to_string()),
            event_id: event_id.map(|s| s.to_string()),
            invocation_id: invocation_id.map(|s| s.to_string()),
            action: action.to_string(),
            actor: actor.map(|s| s.to_string()),
            payload,
            created_at: Utc::now(),
        };
        self.store.insert(log.id.clone(), log.clone());
        Ok(log)
    }

    async fn list_by_tenant(&self, tenant_id: &str, limit: usize, offset: usize) -> RepoResult<Vec<AuditLog>> {
        let mut logs: Vec<AuditLog> = self.store.iter()
            .filter(|e| e.value().tenant_id == tenant_id)
            .map(|e| e.value().clone())
            .collect();
        logs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(logs.into_iter().skip(offset).take(limit).collect())
    }

    async fn list_by_run(&self, run_id: &str) -> RepoResult<Vec<AuditLog>> {
        let mut logs: Vec<AuditLog> = self.store.iter()
            .filter(|e| e.value().run_id.as_deref() == Some(run_id))
            .map(|e| e.value().clone())
            .collect();
        logs.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        Ok(logs)
    }
}

// === AgentEndpointConfig ===

#[derive(Clone, Default)]
pub struct InMemoryAgentEndpointConfigRepo {
    store: Arc<DashMap<String, AgentEndpointConfig>>,
}

#[async_trait]
impl AgentEndpointConfigRepository for InMemoryAgentEndpointConfigRepo {
    async fn upsert(&self, tenant_id: &str, config: AgentEndpointConfig) -> RepoResult<AgentEndpointConfig> {
        self.store.insert(tenant_id.to_string(), config.clone());
        Ok(config)
    }

    async fn find_by_tenant(&self, tenant_id: &str) -> RepoResult<Option<AgentEndpointConfig>> {
        Ok(self.store.get(tenant_id).map(|e| e.value().clone()))
    }
}

// === PipedreamTrigger ===

#[derive(Clone, Default)]
pub struct InMemoryPipedreamTriggerRepo {
    store: Arc<DashMap<String, PipedreamTrigger>>,
}

#[async_trait]
impl PipedreamTriggerRepository for InMemoryPipedreamTriggerRepo {
    async fn create(
        &self,
        tenant_id: &str,
        connection_id: &str,
        trigger_id: &str,
        deployment_id: &str,
        configured_props: Option<serde_json::Value>,
    ) -> RepoResult<PipedreamTrigger> {
        if self.store.iter().any(|e| e.value().deployment_id == deployment_id) {
            return Err(RepoError::AlreadyExists(format!("deployment_id: {deployment_id}")));
        }
        let now = Utc::now();
        let trigger = PipedreamTrigger {
            id: new_id(),
            tenant_id: tenant_id.to_string(),
            connection_id: connection_id.to_string(),
            trigger_id: trigger_id.to_string(),
            deployment_id: deployment_id.to_string(),
            configured_props,
            status: "active".to_string(),
            created_at: now,
            updated_at: now,
        };
        self.store.insert(trigger.id.clone(), trigger.clone());
        Ok(trigger)
    }

    async fn find_by_deployment_id(&self, deployment_id: &str) -> RepoResult<Option<PipedreamTrigger>> {
        Ok(self.store.iter()
            .find(|e| e.value().deployment_id == deployment_id)
            .map(|e| e.value().clone()))
    }

    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<PipedreamTrigger>> {
        Ok(self.store.iter()
            .filter(|e| e.value().tenant_id == tenant_id)
            .map(|e| e.value().clone())
            .collect())
    }

    async fn update_status(&self, id: &str, status: &str) -> RepoResult<PipedreamTrigger> {
        let mut trigger = self.store.get_mut(id)
            .ok_or_else(|| RepoError::NotFound(format!("trigger: {id}")))?;
        trigger.status = status.to_string();
        trigger.updated_at = Utc::now();
        Ok(trigger.clone())
    }

    async fn delete(&self, id: &str) -> RepoResult<()> {
        self.store.remove(id)
            .ok_or_else(|| RepoError::NotFound(format!("trigger: {id}")))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tenant_create_and_find() {
        let repo = InMemoryTenantRepo::default();
        let tenant = repo.create(CreateTenantInput {
            name: "Test Org".to_string(),
            slug: "test-org".to_string(),
        }).await.unwrap();

        assert_eq!(tenant.name, "Test Org");
        assert_eq!(tenant.slug, "test-org");

        let found = repo.find_by_id(&tenant.id).await.unwrap().unwrap();
        assert_eq!(found.id, tenant.id);

        let found_by_slug = repo.find_by_slug("test-org").await.unwrap().unwrap();
        assert_eq!(found_by_slug.id, tenant.id);
    }

    #[tokio::test]
    async fn test_tenant_duplicate_slug_fails() {
        let repo = InMemoryTenantRepo::default();
        repo.create(CreateTenantInput {
            name: "Org A".to_string(),
            slug: "same-slug".to_string(),
        }).await.unwrap();

        let result = repo.create(CreateTenantInput {
            name: "Org B".to_string(),
            slug: "same-slug".to_string(),
        }).await;

        assert!(matches!(result, Err(RepoError::AlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_user_create_and_find_by_email() {
        let repo = InMemoryUserRepo::default();
        let user = repo.create(CreateUserInput {
            email: "test@example.com".to_string(),
            name: Some("Test".to_string()),
            password_hash: Some("hashed".to_string()),
            auth_provider: "credentials".to_string(),
            tenant_id: "t1".to_string(),
        }).await.unwrap();

        let found = repo.find_by_email("test@example.com").await.unwrap().unwrap();
        assert_eq!(found.id, user.id);

        let not_found = repo.find_by_email("other@example.com").await.unwrap();
        assert!(not_found.is_none());
    }

    #[tokio::test]
    async fn test_user_duplicate_email_fails() {
        let repo = InMemoryUserRepo::default();
        repo.create(CreateUserInput {
            email: "dupe@example.com".to_string(),
            name: None,
            password_hash: Some("h1".to_string()),
            auth_provider: "credentials".to_string(),
            tenant_id: "t1".to_string(),
        }).await.unwrap();

        let result = repo.create(CreateUserInput {
            email: "dupe@example.com".to_string(),
            name: None,
            password_hash: Some("h2".to_string()),
            auth_provider: "credentials".to_string(),
            tenant_id: "t2".to_string(),
        }).await;

        assert!(matches!(result, Err(RepoError::AlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_run_lifecycle() {
        let repo = InMemoryRunRepo::default();
        let run = repo.create(CreateRunInput {
            tenant_id: "t1".to_string(),
            workflow_id: None,
            event_id: "evt_1".to_string(),
            invocation_id: "inv_1".to_string(),
            mode: "auto".to_string(),
            event_snapshot: None,
            context_pointers: None,
        }).await.unwrap();

        assert_eq!(run.status, "pending");

        let updated = repo.update_status(&run.id, "processing").await.unwrap();
        assert_eq!(updated.status, "processing");

        let count = repo.count_by_status("t1", "processing").await.unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_run_list_with_status_filter() {
        let repo = InMemoryRunRepo::default();
        for i in 0..5 {
            let run = repo.create(CreateRunInput {
                tenant_id: "t1".to_string(),
                workflow_id: None,
                event_id: format!("evt_{i}"),
                invocation_id: format!("inv_{i}"),
                mode: "auto".to_string(),
                event_snapshot: None,
                context_pointers: None,
            }).await.unwrap();

            if i < 3 {
                repo.update_status(&run.id, "completed").await.unwrap();
            }
        }

        let all = repo.list_by_tenant("t1", None, 100, 0).await.unwrap();
        assert_eq!(all.len(), 5);

        let completed = repo.list_by_tenant("t1", Some("completed"), 100, 0).await.unwrap();
        assert_eq!(completed.len(), 3);

        let pending = repo.list_by_tenant("t1", Some("pending"), 100, 0).await.unwrap();
        assert_eq!(pending.len(), 2);
    }

    #[tokio::test]
    async fn test_connection_crud() {
        let repo = InMemoryConnectionRepo::default();
        let conn = repo.create(CreateConnectionInput {
            tenant_id: "t1".to_string(),
            provider: "intercom".to_string(),
            access_token: Some("at_123".to_string()),
            refresh_token: None,
            expires_at: None,
            pipedream_auth_id: None,
            metadata: None,
        }).await.unwrap();

        assert_eq!(conn.status, "active");

        let found = repo.find_by_tenant_provider("t1", "intercom").await.unwrap().unwrap();
        assert_eq!(found.id, conn.id);

        let list = repo.list_by_tenant("t1").await.unwrap();
        assert_eq!(list.len(), 1);

        repo.delete(&conn.id).await.unwrap();
        let gone = repo.find_by_id(&conn.id).await.unwrap();
        assert!(gone.is_none());
    }

    #[tokio::test]
    async fn test_connection_unique_tenant_provider() {
        let repo = InMemoryConnectionRepo::default();
        repo.create(CreateConnectionInput {
            tenant_id: "t1".to_string(),
            provider: "slack".to_string(),
            access_token: None,
            refresh_token: None,
            expires_at: None,
            pipedream_auth_id: None,
            metadata: None,
        }).await.unwrap();

        let result = repo.create(CreateConnectionInput {
            tenant_id: "t1".to_string(),
            provider: "slack".to_string(),
            access_token: None,
            refresh_token: None,
            expires_at: None,
            pipedream_auth_id: None,
            metadata: None,
        }).await;

        assert!(matches!(result, Err(RepoError::AlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_audit_log_create_and_list() {
        let repo = InMemoryAuditLogRepo::default();
        repo.create("t1", "run.created", Some("user_1"), Some("run_1"), None, None, None).await.unwrap();
        repo.create("t1", "run.completed", Some("system"), Some("run_1"), None, None, None).await.unwrap();
        repo.create("t2", "run.created", Some("user_2"), Some("run_2"), None, None, None).await.unwrap();

        let t1_logs = repo.list_by_tenant("t1", 100, 0).await.unwrap();
        assert_eq!(t1_logs.len(), 2);

        let run_logs = repo.list_by_run("run_1").await.unwrap();
        assert_eq!(run_logs.len(), 2);
    }

    #[tokio::test]
    async fn test_tenant_isolation_runs() {
        let repo = InMemoryRunRepo::default();
        repo.create(CreateRunInput {
            tenant_id: "t1".to_string(),
            workflow_id: None,
            event_id: "e1".to_string(),
            invocation_id: "i1".to_string(),
            mode: "auto".to_string(),
            event_snapshot: None,
            context_pointers: None,
        }).await.unwrap();
        repo.create(CreateRunInput {
            tenant_id: "t2".to_string(),
            workflow_id: None,
            event_id: "e2".to_string(),
            invocation_id: "i2".to_string(),
            mode: "auto".to_string(),
            event_snapshot: None,
            context_pointers: None,
        }).await.unwrap();

        let t1_runs = repo.list_by_tenant("t1", None, 100, 0).await.unwrap();
        assert_eq!(t1_runs.len(), 1);
        assert_eq!(t1_runs[0].tenant_id, "t1");

        let t2_runs = repo.list_by_tenant("t2", None, 100, 0).await.unwrap();
        assert_eq!(t2_runs.len(), 1);
        assert_eq!(t2_runs[0].tenant_id, "t2");
    }
}
