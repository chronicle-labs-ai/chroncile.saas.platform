use async_trait::async_trait;
use chrono::{NaiveDateTime, TimeZone, Utc};
use sqlx::{FromRow, PgPool, Row};

fn naive_to_utc(naive: NaiveDateTime) -> chrono::DateTime<Utc> {
    Utc.from_utc_datetime(&naive)
}

use chronicle_domain::{
    AgentEndpointConfig, AuditLog, Connection, CreateConnectionInput, CreateRunInput,
    CreateTenantInput, CreateUserInput, PipedreamTrigger, Run, Tenant, User,
};
use chronicle_interfaces::{
    AgentEndpointConfigRepository, AuditLogRepository, ConnectionRepository,
    PipedreamTriggerRepository, RepoError, RepoResult, RunRepository, TenantRepository,
    UserRepository,
};

fn new_id() -> String {
    cuid2::create_id()
}

fn to_repo_err(e: sqlx::Error) -> RepoError {
    match &e {
        sqlx::Error::Database(db_err) if db_err.constraint().is_some() => {
            RepoError::AlreadyExists(db_err.to_string())
        }
        sqlx::Error::RowNotFound => RepoError::NotFound("row not found".to_string()),
        _ => RepoError::Internal(e.to_string()),
    }
}

fn tenant_from_row(row: sqlx::postgres::PgRow) -> Result<Tenant, sqlx::Error> {
    let created: NaiveDateTime = row.try_get("createdAt")?;
    let updated: NaiveDateTime = row.try_get("updatedAt")?;
    Ok(Tenant {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        slug: row.try_get("slug")?,
        stripe_customer_id: row.try_get("stripeCustomerId")?,
        stripe_subscription_status: row.try_get("stripeSubscriptionStatus")?,
        stripe_price_id: row.try_get("stripePriceId")?,
        created_at: naive_to_utc(created),
        updated_at: naive_to_utc(updated),
    })
}

fn user_from_row(row: sqlx::postgres::PgRow) -> Result<User, sqlx::Error> {
    let created: NaiveDateTime = row.try_get("createdAt")?;
    let updated: NaiveDateTime = row.try_get("updatedAt")?;
    Ok(User {
        id: row.try_get("id")?,
        email: row.try_get("email")?,
        name: row.try_get("name")?,
        password: row.try_get("password")?,
        auth_provider: row.try_get::<String, _>("authProvider").unwrap_or_else(|_| "credentials".to_string()),
        tenant_id: row.try_get("tenantId")?,
        created_at: naive_to_utc(created),
        updated_at: naive_to_utc(updated),
    })
}

fn run_from_row(row: sqlx::postgres::PgRow) -> Result<Run, sqlx::Error> {
    Ok(Run {
        id: row.try_get("id")?,
        tenant_id: row.try_get("tenantId")?,
        workflow_id: row.try_get("workflowId")?,
        event_id: row.try_get("eventId")?,
        invocation_id: row.try_get("invocationId")?,
        mode: row.try_get("mode")?,
        status: row.try_get("status")?,
        event_snapshot: row.try_get("eventSnapshot")?,
        context_pointers: row.try_get("contextPointers")?,
        agent_request: row.try_get("agentRequest")?,
        agent_response: row.try_get("agentResponse")?,
        human_decision: row.try_get("humanDecision")?,
        created_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("createdAt")?),
        updated_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("updatedAt")?),
    })
}

fn connection_from_row(row: sqlx::postgres::PgRow) -> Result<Connection, sqlx::Error> {
    Ok(Connection {
        id: row.try_get("id")?,
        tenant_id: row.try_get("tenantId")?,
        provider: row.try_get("provider")?,
        access_token: row.try_get("accessToken")?,
        refresh_token: row.try_get("refreshToken")?,
        expires_at: row.try_get::<Option<NaiveDateTime>, _>("expiresAt")?.map(naive_to_utc),
        pipedream_auth_id: row.try_get("pipedreamAuthId")?,
        metadata: row.try_get("metadata")?,
        status: row.try_get("status")?,
        created_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("createdAt")?),
        updated_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("updatedAt")?),
    })
}

fn audit_log_from_row(row: sqlx::postgres::PgRow) -> Result<AuditLog, sqlx::Error> {
    Ok(AuditLog {
        id: row.try_get("id")?,
        tenant_id: row.try_get("tenantId")?,
        run_id: row.try_get("runId")?,
        event_id: row.try_get("eventId")?,
        invocation_id: row.try_get("invocationId")?,
        action: row.try_get("action")?,
        actor: row.try_get("actor")?,
        payload: row.try_get("payload")?,
        created_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("createdAt")?),
    })
}

fn config_from_row(row: sqlx::postgres::PgRow) -> Result<AgentEndpointConfig, sqlx::Error> {
    Ok(AgentEndpointConfig {
        id: row.try_get("id")?,
        tenant_id: row.try_get("tenantId")?,
        endpoint_url: row.try_get("endpointUrl")?,
        auth_type: row.try_get("authType")?,
        auth_header_name: row.try_get("authHeaderName")?,
        auth_secret_encrypted: row.try_get("authSecretEncrypted")?,
        basic_username: row.try_get("basicUsername")?,
        custom_headers_json: row.try_get("customHeadersJson")?,
        created_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("createdAt")?),
        updated_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("updatedAt")?),
    })
}

fn trigger_from_row(row: sqlx::postgres::PgRow) -> Result<PipedreamTrigger, sqlx::Error> {
    Ok(PipedreamTrigger {
        id: row.try_get("id")?,
        tenant_id: row.try_get("tenantId")?,
        connection_id: row.try_get("connectionId")?,
        trigger_id: row.try_get("triggerId")?,
        deployment_id: row.try_get("deploymentId")?,
        configured_props: row.try_get("configuredProps")?,
        status: row.try_get("status")?,
        created_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("createdAt")?),
        updated_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("updatedAt")?),
    })
}

// === Tenant ===

#[derive(Clone)]
pub struct PgTenantRepo {
    pool: PgPool,
}

impl PgTenantRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TenantRepository for PgTenantRepo {
    async fn create(&self, input: CreateTenantInput) -> RepoResult<Tenant> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        sqlx::query("INSERT INTO \"Tenant\" (id, name, slug, \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5)")
            .bind(&id).bind(&input.name).bind(&input.slug).bind(now).bind(now)
            .execute(&self.pool).await.map_err(to_repo_err)?;
        self.find_by_id(&id).await?
            .ok_or_else(|| RepoError::Internal("tenant not found after insert".to_string()))
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Tenant>> {
        sqlx::query("SELECT * FROM \"Tenant\" WHERE id = $1")
            .bind(id).try_map(tenant_from_row)
            .fetch_optional(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_slug(&self, slug: &str) -> RepoResult<Option<Tenant>> {
        sqlx::query("SELECT * FROM \"Tenant\" WHERE slug = $1")
            .bind(slug).try_map(tenant_from_row)
            .fetch_optional(&self.pool).await.map_err(to_repo_err)
    }

    async fn update_stripe_fields(&self, id: &str, customer_id: Option<&str>, subscription_status: Option<&str>, price_id: Option<&str>) -> RepoResult<Tenant> {
        sqlx::query("UPDATE \"Tenant\" SET \"stripeCustomerId\" = COALESCE($2, \"stripeCustomerId\"), \"stripeSubscriptionStatus\" = COALESCE($3, \"stripeSubscriptionStatus\"), \"stripePriceId\" = COALESCE($4, \"stripePriceId\") WHERE id = $1 RETURNING *")
            .bind(id).bind(customer_id).bind(subscription_status).bind(price_id)
            .try_map(tenant_from_row)
            .fetch_one(&self.pool).await.map_err(to_repo_err)
    }
}

// === User ===

#[derive(Clone)]
pub struct PgUserRepo { pool: PgPool }
impl PgUserRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

#[async_trait]
impl UserRepository for PgUserRepo {
    async fn create(&self, input: CreateUserInput) -> RepoResult<User> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        sqlx::query("INSERT INTO \"User\" (id, email, name, password, \"authProvider\", \"tenantId\", \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *")
            .bind(&id).bind(&input.email).bind(&input.name).bind(&input.password_hash).bind(&input.auth_provider).bind(&input.tenant_id).bind(now).bind(now)
            .try_map(user_from_row)
            .fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<User>> {
        sqlx::query("SELECT * FROM \"User\" WHERE id = $1").bind(id)
            .try_map(user_from_row).fetch_optional(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_email(&self, email: &str) -> RepoResult<Option<User>> {
        sqlx::query("SELECT * FROM \"User\" WHERE email = $1").bind(email)
            .try_map(user_from_row).fetch_optional(&self.pool).await.map_err(to_repo_err)
    }
}

// === Run ===

#[derive(Clone)]
pub struct PgRunRepo { pool: PgPool }
impl PgRunRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

#[async_trait]
impl RunRepository for PgRunRepo {
    async fn create(&self, input: CreateRunInput) -> RepoResult<Run> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        sqlx::query("INSERT INTO \"Run\" (id, \"tenantId\", \"workflowId\", \"eventId\", \"invocationId\", mode, status, \"eventSnapshot\", \"contextPointers\", \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10) RETURNING *")
            .bind(&id).bind(&input.tenant_id).bind(&input.workflow_id).bind(&input.event_id)
            .bind(&input.invocation_id).bind(&input.mode).bind(&input.event_snapshot)
            .bind(&input.context_pointers).bind(now).bind(now)
            .try_map(run_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Run>> {
        sqlx::query("SELECT * FROM \"Run\" WHERE id = $1").bind(id)
            .try_map(run_from_row).fetch_optional(&self.pool).await.map_err(to_repo_err)
    }

    async fn list_by_tenant(&self, tenant_id: &str, status: Option<&str>, limit: usize, offset: usize) -> RepoResult<Vec<Run>> {
        if let Some(s) = status {
            sqlx::query("SELECT * FROM \"Run\" WHERE \"tenantId\" = $1 AND status = $2 ORDER BY \"createdAt\" DESC LIMIT $3 OFFSET $4")
                .bind(tenant_id).bind(s).bind(limit as i64).bind(offset as i64)
                .try_map(run_from_row).fetch_all(&self.pool).await.map_err(to_repo_err)
        } else {
            sqlx::query("SELECT * FROM \"Run\" WHERE \"tenantId\" = $1 ORDER BY \"createdAt\" DESC LIMIT $2 OFFSET $3")
                .bind(tenant_id).bind(limit as i64).bind(offset as i64)
                .try_map(run_from_row).fetch_all(&self.pool).await.map_err(to_repo_err)
        }
    }

    async fn update_status(&self, id: &str, status: &str) -> RepoResult<Run> {
        sqlx::query("UPDATE \"Run\" SET status = $2, \"updatedAt\" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *")
            .bind(id).bind(status).try_map(run_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn update_response(&self, id: &str, agent_response: serde_json::Value) -> RepoResult<Run> {
        sqlx::query("UPDATE \"Run\" SET \"agentResponse\" = $2, \"updatedAt\" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *")
            .bind(id).bind(agent_response).try_map(run_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn count_by_tenant(&self, tenant_id: &str) -> RepoResult<usize> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM \"Run\" WHERE \"tenantId\" = $1")
            .bind(tenant_id).fetch_one(&self.pool).await.map_err(to_repo_err)?;
        Ok(row.0 as usize)
    }

    async fn count_by_status(&self, tenant_id: &str, status: &str) -> RepoResult<usize> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM \"Run\" WHERE \"tenantId\" = $1 AND status = $2")
            .bind(tenant_id).bind(status).fetch_one(&self.pool).await.map_err(to_repo_err)?;
        Ok(row.0 as usize)
    }
}

// === Connection ===

#[derive(Clone)]
pub struct PgConnectionRepo { pool: PgPool }
impl PgConnectionRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

#[async_trait]
impl ConnectionRepository for PgConnectionRepo {
    async fn create(&self, input: CreateConnectionInput) -> RepoResult<Connection> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        sqlx::query("INSERT INTO \"Connection\" (id, \"tenantId\", provider, \"accessToken\", \"refreshToken\", \"expiresAt\", \"pipedreamAuthId\", metadata, status, \"createdAt\", \"updatedAt\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10) RETURNING *")
            .bind(&id).bind(&input.tenant_id).bind(&input.provider).bind(&input.access_token)
            .bind(&input.refresh_token).bind(&input.expires_at).bind(&input.pipedream_auth_id)
            .bind(&input.metadata).bind(now).bind(now)
            .try_map(connection_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Connection>> {
        sqlx::query("SELECT * FROM \"Connection\" WHERE id = $1").bind(id)
            .try_map(connection_from_row).fetch_optional(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_tenant_provider(&self, tenant_id: &str, provider: &str) -> RepoResult<Option<Connection>> {
        sqlx::query("SELECT * FROM \"Connection\" WHERE \"tenantId\" = $1 AND provider = $2")
            .bind(tenant_id).bind(provider)
            .try_map(connection_from_row).fetch_optional(&self.pool).await.map_err(to_repo_err)
    }

    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<Connection>> {
        sqlx::query("SELECT * FROM \"Connection\" WHERE \"tenantId\" = $1 ORDER BY \"createdAt\" DESC")
            .bind(tenant_id).try_map(connection_from_row).fetch_all(&self.pool).await.map_err(to_repo_err)
    }

    async fn update_status(&self, id: &str, status: &str) -> RepoResult<Connection> {
        sqlx::query("UPDATE \"Connection\" SET status = $2, \"updatedAt\" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *")
            .bind(id).bind(status).try_map(connection_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn delete(&self, id: &str) -> RepoResult<()> {
        let result = sqlx::query("DELETE FROM \"Connection\" WHERE id = $1").bind(id)
            .execute(&self.pool).await.map_err(to_repo_err)?;
        if result.rows_affected() == 0 { return Err(RepoError::NotFound(format!("connection: {id}"))); }
        Ok(())
    }
}

// === AuditLog ===

#[derive(Clone)]
pub struct PgAuditLogRepo { pool: PgPool }
impl PgAuditLogRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

#[async_trait]
impl AuditLogRepository for PgAuditLogRepo {
    async fn create(&self, tenant_id: &str, action: &str, actor: Option<&str>, run_id: Option<&str>, event_id: Option<&str>, invocation_id: Option<&str>, payload: Option<serde_json::Value>) -> RepoResult<AuditLog> {
        let id = new_id();
        sqlx::query("INSERT INTO \"AuditLog\" (id, \"tenantId\", action, actor, \"runId\", \"eventId\", \"invocationId\", payload, \"createdAt\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP) RETURNING *")
            .bind(&id).bind(tenant_id).bind(action).bind(actor).bind(run_id).bind(event_id).bind(invocation_id).bind(payload)
            .try_map(audit_log_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn list_by_tenant(&self, tenant_id: &str, limit: usize, offset: usize) -> RepoResult<Vec<AuditLog>> {
        sqlx::query("SELECT * FROM \"AuditLog\" WHERE \"tenantId\" = $1 ORDER BY \"createdAt\" DESC LIMIT $2 OFFSET $3")
            .bind(tenant_id).bind(limit as i64).bind(offset as i64)
            .try_map(audit_log_from_row).fetch_all(&self.pool).await.map_err(to_repo_err)
    }

    async fn list_by_run(&self, run_id: &str) -> RepoResult<Vec<AuditLog>> {
        sqlx::query("SELECT * FROM \"AuditLog\" WHERE \"runId\" = $1 ORDER BY \"createdAt\" ASC")
            .bind(run_id).try_map(audit_log_from_row).fetch_all(&self.pool).await.map_err(to_repo_err)
    }
}

// === AgentEndpointConfig ===

#[derive(Clone)]
pub struct PgAgentEndpointConfigRepo { pool: PgPool }
impl PgAgentEndpointConfigRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

#[async_trait]
impl AgentEndpointConfigRepository for PgAgentEndpointConfigRepo {
    async fn upsert(&self, tenant_id: &str, config: AgentEndpointConfig) -> RepoResult<AgentEndpointConfig> {
        sqlx::query("INSERT INTO \"AgentEndpointConfig\" (id, \"tenantId\", \"endpointUrl\", \"authType\", \"authHeaderName\", \"authSecretEncrypted\", \"basicUsername\", \"customHeadersJson\", \"createdAt\", \"updatedAt\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (\"tenantId\") DO UPDATE SET \"endpointUrl\"=EXCLUDED.\"endpointUrl\", \"authType\"=EXCLUDED.\"authType\", \"authHeaderName\"=EXCLUDED.\"authHeaderName\", \"authSecretEncrypted\"=EXCLUDED.\"authSecretEncrypted\", \"basicUsername\"=EXCLUDED.\"basicUsername\", \"customHeadersJson\"=EXCLUDED.\"customHeadersJson\", \"updatedAt\"=CURRENT_TIMESTAMP RETURNING *")
            .bind(&config.id).bind(tenant_id).bind(&config.endpoint_url).bind(&config.auth_type)
            .bind(&config.auth_header_name).bind(&config.auth_secret_encrypted).bind(&config.basic_username)
            .bind(&config.custom_headers_json)
            .try_map(config_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_tenant(&self, tenant_id: &str) -> RepoResult<Option<AgentEndpointConfig>> {
        sqlx::query("SELECT * FROM \"AgentEndpointConfig\" WHERE \"tenantId\" = $1")
            .bind(tenant_id).try_map(config_from_row).fetch_optional(&self.pool).await.map_err(to_repo_err)
    }
}

// === PipedreamTrigger ===

#[derive(Clone)]
pub struct PgPipedreamTriggerRepo { pool: PgPool }
impl PgPipedreamTriggerRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

#[async_trait]
impl PipedreamTriggerRepository for PgPipedreamTriggerRepo {
    async fn create(&self, tenant_id: &str, connection_id: &str, trigger_id: &str, deployment_id: &str, configured_props: Option<serde_json::Value>) -> RepoResult<PipedreamTrigger> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        sqlx::query("INSERT INTO \"PipedreamTrigger\" (id, \"tenantId\", \"connectionId\", \"triggerId\", \"deploymentId\", \"configuredProps\", status, \"createdAt\", \"updatedAt\") VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8) RETURNING *")
            .bind(&id).bind(tenant_id).bind(connection_id).bind(trigger_id).bind(deployment_id)
            .bind(configured_props).bind(now).bind(now)
            .try_map(trigger_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn find_by_deployment_id(&self, deployment_id: &str) -> RepoResult<Option<PipedreamTrigger>> {
        sqlx::query("SELECT * FROM \"PipedreamTrigger\" WHERE \"deploymentId\" = $1")
            .bind(deployment_id).try_map(trigger_from_row).fetch_optional(&self.pool).await.map_err(to_repo_err)
    }

    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<PipedreamTrigger>> {
        sqlx::query("SELECT * FROM \"PipedreamTrigger\" WHERE \"tenantId\" = $1")
            .bind(tenant_id).try_map(trigger_from_row).fetch_all(&self.pool).await.map_err(to_repo_err)
    }

    async fn update_status(&self, id: &str, status: &str) -> RepoResult<PipedreamTrigger> {
        sqlx::query("UPDATE \"PipedreamTrigger\" SET status = $2, \"updatedAt\" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *")
            .bind(id).bind(status).try_map(trigger_from_row).fetch_one(&self.pool).await.map_err(to_repo_err)
    }

    async fn delete(&self, id: &str) -> RepoResult<()> {
        let result = sqlx::query("DELETE FROM \"PipedreamTrigger\" WHERE id = $1").bind(id)
            .execute(&self.pool).await.map_err(to_repo_err)?;
        if result.rows_affected() == 0 { return Err(RepoError::NotFound(format!("trigger: {id}"))); }
        Ok(())
    }
}
