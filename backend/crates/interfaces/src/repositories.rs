use async_trait::async_trait;
use chronicle_domain::{
    AgentEndpointConfig, AuditLog, BacktestArtifactKind, BacktestArtifactRecord, BacktestJobMode,
    BacktestJobRecord, BacktestTrialRecord, Connection, CreateBacktestJobInput,
    CreateBacktestTrialInput, CreateConnectionInput, CreateInvitationInput,
    CreatePasswordResetTokenInput, CreateRunInput, CreateTenantInput, CreateTenantMembershipInput,
    CreateUserInput, FeatureFlagDefinition, FeatureFlagKey, FeatureFlagOverride, FeatureFlagScope,
    IntegrationSync, Invitation, JobStatus, MembershipStatus, PasswordResetToken, Run, Tenant,
    TenantMembership, TrialException, TrialStatus, UpsertFeatureFlagDefinitionInput,
    UpsertFeatureFlagOverrideInput, User, UserRole,
};
use std::collections::HashMap;

/// Internal marker for the eight per-phase timing columns on
/// `BacktestTrial`. Lives on the interface side because no caller
/// outside the orchestrator + repo touches it; not exported to TS.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrialTimingMarker {
    EnvSetupStarted,
    EnvSetupFinished,
    AgentSetupStarted,
    AgentSetupFinished,
    AgentRunStarted,
    AgentRunFinished,
    VerifierStarted,
    VerifierFinished,
}

impl TrialTimingMarker {
    /// The matching DB column name on `"BacktestTrial"`.
    pub fn column(&self) -> &'static str {
        match self {
            Self::EnvSetupStarted => "envSetupStartedAt",
            Self::EnvSetupFinished => "envSetupFinishedAt",
            Self::AgentSetupStarted => "agentSetupStartedAt",
            Self::AgentSetupFinished => "agentSetupFinishedAt",
            Self::AgentRunStarted => "agentRunStartedAt",
            Self::AgentRunFinished => "agentRunFinishedAt",
            Self::VerifierStarted => "verifierStartedAt",
            Self::VerifierFinished => "verifierFinishedAt",
        }
    }
}

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
    async fn find_by_stripe_customer_id(&self, customer_id: &str) -> RepoResult<Option<Tenant>>;
    /// Lookup the local Tenant row that's been linked to a WorkOS Organization
    /// via `workos_organization_id`. Returns `None` when no link exists yet
    /// (typically during the first-import window or for legacy tenants).
    async fn find_by_workos_organization_id(
        &self,
        workos_organization_id: &str,
    ) -> RepoResult<Option<Tenant>>;
    async fn update_stripe_fields(
        &self,
        id: &str,
        customer_id: Option<&str>,
        subscription_status: Option<&str>,
        price_id: Option<&str>,
    ) -> RepoResult<Tenant>;
    /// Sets the WorkOS organization id on a tenant. Used by the importer and
    /// by the `provisionWorkspace` self-serve path right after
    /// `organizations.create`.
    async fn set_workos_organization_id(
        &self,
        id: &str,
        workos_organization_id: &str,
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
    /// Lookup by linked WorkOS user id. Returns `None` for legacy rows that
    /// have not been imported yet.
    async fn find_by_workos_user_id(
        &self,
        workos_user_id: &str,
    ) -> RepoResult<Option<User>>;
    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<User>>;
    async fn list_all(&self) -> RepoResult<Vec<User>>;
    async fn delete(&self, id: &str) -> RepoResult<()>;
    async fn update_role(&self, id: &str, role: &str) -> RepoResult<User>;
    async fn update_password(&self, id: &str, password_hash: &str) -> RepoResult<User>;
    /// Backfills the WorkOS user id on a row. Used by the importer after
    /// `userManagement.bulkCreateUsers` and by the SCIM webhook on
    /// directory.user.created events that match an existing email.
    async fn set_workos_user_id(
        &self,
        id: &str,
        workos_user_id: &str,
    ) -> RepoResult<User>;
    async fn set_tenant_id(
        &self,
        id: &str,
        tenant_id: &str,
    ) -> RepoResult<User>;
}

/// Mirrors WorkOS's `organization_membership` resource. A `User` may be a
/// member of zero, one, or many `Tenant`s. The `WorkosAuthUser` extractor
/// resolves the active org from the JWT `org_id` claim and validates
/// membership through this repo (active status only).
#[async_trait]
pub trait TenantMembershipRepository: Send + Sync {
    /// Idempotent insert. If a membership already exists for `(user_id,
    /// tenant_id)`, returns it without modifying status or role.
    async fn upsert(
        &self,
        input: CreateTenantMembershipInput,
    ) -> RepoResult<TenantMembership>;
    /// Find the membership row for a single (user, tenant) pair.
    async fn find(
        &self,
        user_id: &str,
        tenant_id: &str,
    ) -> RepoResult<Option<TenantMembership>>;
    /// All memberships for a user. By default callers should filter to
    /// `MembershipStatus::Active`; the repo returns rows in any status so the
    /// admin surface can show pending/inactive too.
    async fn list_by_user(&self, user_id: &str) -> RepoResult<Vec<TenantMembership>>;
    /// All memberships for a tenant. Used by `team.rs::list_members`.
    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<TenantMembership>>;
    /// Promote a pending membership to active or vice-versa. Also updates
    /// `role` if `role` is `Some`.
    async fn update(
        &self,
        user_id: &str,
        tenant_id: &str,
        status: Option<MembershipStatus>,
        role: Option<UserRole>,
    ) -> RepoResult<TenantMembership>;
    /// Hard delete. Use `update` with `Inactive` for soft-delete semantics.
    async fn delete(&self, user_id: &str, tenant_id: &str) -> RepoResult<()>;
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
pub trait PasswordResetRepository: Send + Sync {
    async fn create(&self, input: CreatePasswordResetTokenInput) -> RepoResult<PasswordResetToken>;
    async fn consume(&self, token_hash: &str) -> RepoResult<Option<PasswordResetToken>>;
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
    async fn upsert_by_tenant_provider(
        &self,
        input: CreateConnectionInput,
        status: &str,
    ) -> RepoResult<Connection>;
    async fn find_by_id(&self, id: &str) -> RepoResult<Option<Connection>>;
    async fn find_by_nango_connection_id(&self, auth_id: &str) -> RepoResult<Option<Connection>>;
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
#[allow(clippy::too_many_arguments)]
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
pub trait IntegrationSyncRepository: Send + Sync {
    async fn create(
        &self,
        tenant_id: &str,
        connection_id: &str,
        sync_name: &str,
        nango_sync_id: &str,
        configured_props: Option<serde_json::Value>,
    ) -> RepoResult<IntegrationSync>;
    async fn find_by_nango_sync_id(
        &self,
        nango_sync_id: &str,
    ) -> RepoResult<Option<IntegrationSync>>;
    async fn list_by_tenant(&self, tenant_id: &str) -> RepoResult<Vec<IntegrationSync>>;
    async fn update_status(&self, id: &str, status: &str) -> RepoResult<IntegrationSync>;
    async fn delete(&self, id: &str) -> RepoResult<()>;
}

#[async_trait]
pub trait FeatureFlagRepository: Send + Sync {
    async fn upsert_definition(
        &self,
        input: UpsertFeatureFlagDefinitionInput,
    ) -> RepoResult<FeatureFlagDefinition>;
    async fn list_definitions(&self) -> RepoResult<Vec<FeatureFlagDefinition>>;
    async fn find_definition(
        &self,
        key: FeatureFlagKey,
    ) -> RepoResult<Option<FeatureFlagDefinition>>;
    async fn upsert_override(
        &self,
        input: UpsertFeatureFlagOverrideInput,
    ) -> RepoResult<FeatureFlagOverride>;
    async fn list_overrides_for_scope(
        &self,
        scope_type: FeatureFlagScope,
        scope_id: &str,
    ) -> RepoResult<Vec<FeatureFlagOverride>>;
    async fn delete_override(
        &self,
        flag_key: FeatureFlagKey,
        scope_type: FeatureFlagScope,
        scope_id: &str,
    ) -> RepoResult<()>;
}

/* ── Backtests ──────────────────────────────────────────── */

/// Persistence for `"BacktestJob"` rows. The orchestrator owns the
/// lifecycle: create at submit, transition to `running` on first
/// trial-pickup, write summary counts as trials finish, mark terminal
/// when the job's TrialQueue drains. The API layer reads through this
/// trait too — list, detail, cancel.
#[async_trait]
pub trait BacktestJobRepository: Send + Sync {
    async fn create(&self, input: CreateBacktestJobInput) -> RepoResult<BacktestJobRecord>;

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestJobRecord>>;

    /// Tenant-scoped list. `mode` is an optional filter for the dashboard
    /// "by job mode" tabs; `status` filters the lifecycle.
    async fn list_by_tenant(
        &self,
        tenant_id: &str,
        mode: Option<BacktestJobMode>,
        status: Option<JobStatus>,
        limit: usize,
        offset: usize,
    ) -> RepoResult<Vec<BacktestJobRecord>>;

    async fn count_by_tenant(&self, tenant_id: &str) -> RepoResult<usize>;

    /// Move the job into a new lifecycle state. `started_at` /
    /// `finished_at` are written when the new status is `running` /
    /// `succeeded`/`failed`/`cancelled` respectively (callers pass `None`
    /// to leave the column unchanged).
    async fn update_status(
        &self,
        id: &str,
        status: JobStatus,
        started_at: Option<chrono::DateTime<chrono::Utc>>,
        finished_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> RepoResult<BacktestJobRecord>;

    /// Lazy summary refresh — bumped by the orchestrator after each
    /// trial reaches a terminal status. `total_trials` is set on the
    /// first call (when the queue size is known) and left alone after.
    async fn update_summary(
        &self,
        id: &str,
        total_trials: Option<u32>,
        completed_trials: u32,
        failed_trials: u32,
        exception_kind: Option<&str>,
    ) -> RepoResult<BacktestJobRecord>;

    /// Set the final verdict copy rendered on the dashboard list view.
    async fn set_verdict(&self, id: &str, verdict: &str) -> RepoResult<BacktestJobRecord>;
}

/// Persistence for `"BacktestTrial"` rows + their `"BacktestTrialReward"`
/// children. Rewards travel with their trial (only ever inserted /
/// queried per trial) so they live on the same trait — analogous to how
/// Harbor's `Trial` owns its `VerifierResult`.
#[async_trait]
pub trait BacktestTrialRepository: Send + Sync {
    async fn create(&self, input: CreateBacktestTrialInput) -> RepoResult<BacktestTrialRecord>;

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestTrialRecord>>;

    async fn list_by_job(&self, job_id: &str) -> RepoResult<Vec<BacktestTrialRecord>>;

    /// Per-status filter for the orchestrator's resume path
    /// (e.g. picking up `Pending` trials from a previous process).
    async fn list_by_job_status(
        &self,
        job_id: &str,
        status: TrialStatus,
    ) -> RepoResult<Vec<BacktestTrialRecord>>;

    /// Stamp a per-phase timing column. Each marker maps unambiguously
    /// to a single `*StartedAt`/`*FinishedAt` column on `BacktestTrial`.
    /// Decoupled from `TrialPhase` (which is SSE-grained and includes
    /// non-timed events like `Queued` / `ArtifactCollection`).
    async fn record_timing(&self, id: &str, marker: TrialTimingMarker) -> RepoResult<()>;

    /// Update the lifecycle status without touching timestamps. Used
    /// for transient transitions (e.g. `Pending` → `Setup`) where the
    /// per-phase columns are managed separately.
    async fn update_status(&self, id: &str, status: TrialStatus) -> RepoResult<()>;

    /// Move the trial to a terminal status, writing duration + optional
    /// exception in a single round-trip. Idempotent — the orchestrator
    /// shielded-cleanup path may call this from cancellation handlers.
    async fn mark_terminal(
        &self,
        id: &str,
        status: TrialStatus,
        duration_ms: Option<u32>,
        exception: Option<TrialException>,
    ) -> RepoResult<BacktestTrialRecord>;

    /// Record the sandbox the orchestrator created for this trial.
    /// Stored even after teardown so the CLI / inspector can correlate
    /// provider audit logs.
    async fn set_sandbox_id(&self, id: &str, sandbox_id: &str) -> RepoResult<()>;

    /// Bump the retry counter; called before a re-attempt re-enters the
    /// queue.
    async fn bump_attempt(&self, id: &str) -> RepoResult<u32>;

    /// Bulk-upsert reward rows for a single trial. Matches Harbor's
    /// `VerifierResult.rewards: dict[str, float]` shape — pass the full
    /// map; existing keys are replaced.
    async fn record_rewards(
        &self,
        trial_id: &str,
        rewards: &HashMap<String, f64>,
        grader_id: Option<&str>,
    ) -> RepoResult<()>;

    /// Read all rewards for a trial as a flat map.
    async fn list_rewards(&self, trial_id: &str) -> RepoResult<HashMap<String, f64>>;
}

/// Persistence for `"BacktestArtifact"` rows. Artifacts are append-only
/// pointers to logs / trajectories / screenshots / reward files. The
/// orchestrator inserts; the dashboard + CLI list.
#[async_trait]
pub trait BacktestArtifactRepository: Send + Sync {
    async fn create(
        &self,
        trial_id: &str,
        kind: BacktestArtifactKind,
        path: &str,
        size_bytes: Option<u64>,
        content_type: Option<&str>,
    ) -> RepoResult<BacktestArtifactRecord>;

    async fn list_by_trial(&self, trial_id: &str) -> RepoResult<Vec<BacktestArtifactRecord>>;
}
