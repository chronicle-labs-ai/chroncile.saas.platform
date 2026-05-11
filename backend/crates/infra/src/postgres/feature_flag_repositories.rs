use async_trait::async_trait;
use chronicle_store::postgres::TracedPgPool;
use chrono::{NaiveDateTime, TimeZone, Utc};
use sqlx::Row;

use chronicle_domain::{
    FeatureFlagDefinition, FeatureFlagKey, FeatureFlagOverride, FeatureFlagScope, FeatureFlagType,
    UpsertFeatureFlagDefinitionInput, UpsertFeatureFlagOverrideInput,
};
use chronicle_interfaces::{FeatureFlagRepository, RepoError, RepoResult};

fn new_id() -> String {
    cuid2::create_id()
}

fn naive_to_utc(naive: NaiveDateTime) -> chrono::DateTime<Utc> {
    Utc.from_utc_datetime(&naive)
}

fn to_repo_err(error: sqlx::Error) -> RepoError {
    match &error {
        sqlx::Error::Database(db_err) if db_err.constraint().is_some() => {
            RepoError::AlreadyExists(db_err.to_string())
        }
        sqlx::Error::RowNotFound => RepoError::NotFound("row not found".to_string()),
        _ => RepoError::Internal(error.to_string()),
    }
}

fn parse_flag_key(value: String) -> Result<FeatureFlagKey, sqlx::Error> {
    value
        .parse()
        .map_err(|_| sqlx::Error::Protocol(format!("invalid feature flag key: {value}")))
}

fn parse_flag_type(value: String) -> Result<FeatureFlagType, sqlx::Error> {
    value
        .parse()
        .map_err(|_| sqlx::Error::Protocol(format!("invalid feature flag type: {value}")))
}

fn parse_scope_type(value: String) -> Result<FeatureFlagScope, sqlx::Error> {
    value
        .parse()
        .map_err(|_| sqlx::Error::Protocol(format!("invalid feature flag scope: {value}")))
}

fn definition_from_row(row: sqlx::postgres::PgRow) -> Result<FeatureFlagDefinition, sqlx::Error> {
    Ok(FeatureFlagDefinition {
        key: parse_flag_key(row.try_get("key")?)?,
        flag_type: parse_flag_type(row.try_get("flagType")?)?,
        description: row.try_get("description")?,
        owner: row.try_get("owner")?,
        default_enabled: row.try_get("defaultEnabled")?,
        enabled: row.try_get("enabled")?,
        expires_at: row
            .try_get::<Option<NaiveDateTime>, _>("expiresAt")?
            .map(naive_to_utc),
        created_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("createdAt")?),
        updated_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("updatedAt")?),
    })
}

fn override_from_row(row: sqlx::postgres::PgRow) -> Result<FeatureFlagOverride, sqlx::Error> {
    Ok(FeatureFlagOverride {
        id: row.try_get("id")?,
        flag_key: parse_flag_key(row.try_get("flagKey")?)?,
        scope_type: parse_scope_type(row.try_get("scopeType")?)?,
        scope_id: row.try_get("scopeId")?,
        enabled: row.try_get("enabled")?,
        reason: row.try_get("reason")?,
        variant: row.try_get("variant")?,
        rollout_percentage: row.try_get("rolloutPercentage")?,
        created_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("createdAt")?),
        updated_at: naive_to_utc(row.try_get::<NaiveDateTime, _>("updatedAt")?),
    })
}

#[derive(Clone)]
pub struct PgFeatureFlagRepo {
    pool: TracedPgPool,
}

impl PgFeatureFlagRepo {
    pub fn new(pool: TracedPgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FeatureFlagRepository for PgFeatureFlagRepo {
    async fn upsert_definition(
        &self,
        input: UpsertFeatureFlagDefinitionInput,
    ) -> RepoResult<FeatureFlagDefinition> {
        let now = Utc::now().naive_utc();
        sqlx::query(
            "INSERT INTO \"FeatureFlagDefinition\" (key, \"flagType\", description, owner, \"defaultEnabled\", enabled, \"expiresAt\", \"createdAt\", \"updatedAt\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (key) DO UPDATE SET \"flagType\" = EXCLUDED.\"flagType\", description = EXCLUDED.description, owner = EXCLUDED.owner, \"defaultEnabled\" = EXCLUDED.\"defaultEnabled\", enabled = EXCLUDED.enabled, \"expiresAt\" = EXCLUDED.\"expiresAt\", \"updatedAt\" = EXCLUDED.\"updatedAt\" RETURNING *",
        )
        .bind(input.key.as_str())
        .bind(input.flag_type.as_str())
        .bind(input.description)
        .bind(input.owner)
        .bind(input.default_enabled)
        .bind(input.enabled)
        .bind(input.expires_at.map(|value| value.naive_utc()))
        .bind(now)
        .bind(now)
        .try_map(definition_from_row)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn list_definitions(&self) -> RepoResult<Vec<FeatureFlagDefinition>> {
        sqlx::query("SELECT * FROM \"FeatureFlagDefinition\" ORDER BY key ASC")
            .try_map(definition_from_row)
            .fetch_all(&self.pool)
            .await
            .map_err(to_repo_err)
    }

    async fn find_definition(
        &self,
        key: FeatureFlagKey,
    ) -> RepoResult<Option<FeatureFlagDefinition>> {
        sqlx::query("SELECT * FROM \"FeatureFlagDefinition\" WHERE key = $1")
            .bind(key.as_str())
            .try_map(definition_from_row)
            .fetch_optional(&self.pool)
            .await
            .map_err(to_repo_err)
    }

    async fn upsert_override(
        &self,
        input: UpsertFeatureFlagOverrideInput,
    ) -> RepoResult<FeatureFlagOverride> {
        let id = new_id();
        let now = Utc::now().naive_utc();
        sqlx::query(
            "INSERT INTO \"FeatureFlagOverride\" (id, \"flagKey\", \"scopeType\", \"scopeId\", enabled, reason, variant, \"rolloutPercentage\", \"createdAt\", \"updatedAt\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (\"flagKey\", \"scopeType\", \"scopeId\") DO UPDATE SET enabled = EXCLUDED.enabled, reason = EXCLUDED.reason, variant = EXCLUDED.variant, \"rolloutPercentage\" = EXCLUDED.\"rolloutPercentage\", \"updatedAt\" = EXCLUDED.\"updatedAt\" RETURNING *",
        )
        .bind(id)
        .bind(input.flag_key.as_str())
        .bind(input.scope_type.as_str())
        .bind(input.scope_id)
        .bind(input.enabled)
        .bind(input.reason)
        .bind(input.variant)
        .bind(input.rollout_percentage)
        .bind(now)
        .bind(now)
        .try_map(override_from_row)
        .fetch_one(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn list_overrides_for_scope(
        &self,
        scope_type: FeatureFlagScope,
        scope_id: &str,
    ) -> RepoResult<Vec<FeatureFlagOverride>> {
        sqlx::query(
            "SELECT * FROM \"FeatureFlagOverride\" WHERE \"scopeType\" = $1 AND \"scopeId\" = $2 ORDER BY \"flagKey\" ASC",
        )
        .bind(scope_type.as_str())
        .bind(scope_id)
        .try_map(override_from_row)
        .fetch_all(&self.pool)
        .await
        .map_err(to_repo_err)
    }

    async fn delete_override(
        &self,
        flag_key: FeatureFlagKey,
        scope_type: FeatureFlagScope,
        scope_id: &str,
    ) -> RepoResult<()> {
        let result = sqlx::query(
            "DELETE FROM \"FeatureFlagOverride\" WHERE \"flagKey\" = $1 AND \"scopeType\" = $2 AND \"scopeId\" = $3",
        )
        .bind(flag_key.as_str())
        .bind(scope_type.as_str())
        .bind(scope_id)
        .execute(&self.pool)
        .await
        .map_err(to_repo_err)?;

        if result.rows_affected() == 0 {
            return Err(RepoError::NotFound(format!(
                "feature flag override: {}:{}:{}",
                flag_key.as_str(),
                scope_type.as_str(),
                scope_id
            )));
        }

        Ok(())
    }
}
