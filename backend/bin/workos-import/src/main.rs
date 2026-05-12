//! `workos-import` — one-shot bulk importer for the WorkOS AuthKit
//! migration (Phase 1 of the rollout).
//!
//! Idempotent: every step is a check-then-act, and rows whose
//! `workosOrganizationId` / `workosUserId` are already populated are
//! skipped. Safe to re-run after partial failure.
//!
//! Usage (after Phase 0b is deployed and the `WORKOS_API_KEY` /
//! `WORKOS_CLIENT_ID` / `DATABASE_URL` env vars are set):
//!
//! ```bash
//! cargo run --bin workos-import -- --batch-size 50
//! ```
//!
//! The output drives the E.1 importer-log story in Storybook: one
//! green-checked line per successfully imported user, plus a final
//! summary tally.
//!
//! What this binary deliberately does NOT do:
//!
//! - It does not delete the bcrypt `password` column (that is Phase 3).
//! - It does not create the local User row when the WorkOS user is
//!   created from scratch — local rows already exist before import; we
//!   just attach `workosUserId`. Net-new users go through
//!   `workos_exchange` JIT or the SCIM webhook.
//! - It does not migrate Google-OAuth users specially. WorkOS matches
//!   verified-email accounts on first sign-in; existing google-oauth
//!   rows just get a workosUserId stamped on them.

use std::collections::HashMap;
use std::env;
use std::time::Duration;

use anyhow::{Context, Result};
use chronicle_auth::workos::{
    BulkCreateUserParams, BulkOrganizationMembership, CreateOrganizationParams, WorkosClient,
};
use chrono::NaiveDateTime;
use sqlx::{postgres::PgPoolOptions, PgPool, Row};

const DEFAULT_BATCH_SIZE: usize = 50;

#[derive(Debug)]
struct LocalTenant {
    id: String,
    name: String,
    slug: String,
    workos_organization_id: Option<String>,
}

#[derive(Debug)]
struct LocalUser {
    id: String,
    email: String,
    name: Option<String>,
    password_hash: Option<String>,
    role: String,
    workos_user_id: Option<String>,
    auth_provider: String,
}

#[derive(Default)]
struct ImportSummary {
    tenants_total: usize,
    tenants_already_linked: usize,
    tenants_newly_linked: usize,
    users_total: usize,
    users_already_imported: usize,
    users_newly_imported: usize,
    user_errors: Vec<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    let batch_size = parse_batch_size_arg().unwrap_or(DEFAULT_BATCH_SIZE);
    let database_url = env::var("DATABASE_URL").context(
        "DATABASE_URL not set; export it (or run via `doppler run -- workos-import`)",
    )?;
    let workos = WorkosClient::from_env()
        .context("WORKOS_API_KEY / WORKOS_CLIENT_ID env vars not set")?;

    println!("backend/bin/workos-import — cutover");
    println!("─────────────────────────────────────────");

    let pool = PgPoolOptions::new()
        .max_connections(4)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await
        .context("failed to connect to Postgres")?;

    let mut summary = ImportSummary::default();

    // ── 1. Link every tenant to a WorkOS organization. ─────────────
    let tenants = load_tenants(&pool).await?;
    summary.tenants_total = tenants.len();
    let mut tenant_workos_org_id: HashMap<String, String> = HashMap::new();
    for tenant in &tenants {
        if let Some(existing) = &tenant.workos_organization_id {
            summary.tenants_already_linked += 1;
            tenant_workos_org_id.insert(tenant.id.clone(), existing.clone());
            println!(
                "tenant {id:>16}  ✓ already linked → {existing}",
                id = tenant.id
            );
            continue;
        }
        let domains = collect_user_domains(&pool, &tenant.id).await?;
        match workos
            .create_organization(&CreateOrganizationParams {
                name: tenant.name.clone(),
                domains: domains.into_iter().collect(),
            })
            .await
        {
            Ok(org) => {
                set_tenant_workos_org(&pool, &tenant.id, &org.id).await?;
                tenant_workos_org_id.insert(tenant.id.clone(), org.id.clone());
                summary.tenants_newly_linked += 1;
                println!(
                    "tenant {id:>16}  ✓ created WorkOS org {org_id} (slug={slug})",
                    id = tenant.id,
                    org_id = org.id,
                    slug = tenant.slug
                );
            }
            Err(err) => {
                tracing::error!(tenant_id = %tenant.id, error = %err, "Failed to create WorkOS org");
                summary
                    .user_errors
                    .push(format!("tenant {} workos.create: {err}", tenant.id));
            }
        }
    }

    // ── 2. Bulk-create users in WorkOS, batched by tenant. ─────────
    for tenant in &tenants {
        let Some(workos_org_id) = tenant_workos_org_id.get(&tenant.id) else {
            continue;
        };
        let users = load_users_for_tenant(&pool, &tenant.id).await?;
        summary.users_total += users.len();

        let mut batch_buffer: Vec<&LocalUser> = Vec::with_capacity(batch_size);
        let mut to_send: Vec<BulkCreateUserParams> = Vec::with_capacity(batch_size);

        for user in &users {
            if user.workos_user_id.is_some() {
                summary.users_already_imported += 1;
                println!(
                    "  user {email:>40}  · skipped (workosUserId already set)",
                    email = user.email
                );
                continue;
            }
            batch_buffer.push(user);
            to_send.push(build_bulk_user_params(user, workos_org_id));
            if batch_buffer.len() >= batch_size {
                flush_batch(
                    &workos,
                    &pool,
                    &mut batch_buffer,
                    &mut to_send,
                    &mut summary,
                )
                .await;
            }
        }
        flush_batch(
            &workos,
            &pool,
            &mut batch_buffer,
            &mut to_send,
            &mut summary,
        )
        .await;
    }

    // ── 3. Final summary. ──────────────────────────────────────────
    println!("─────────────────────────────────────────");
    println!(
        "tenants: {linked}/{total} linked ({newly} new)",
        linked = summary.tenants_already_linked + summary.tenants_newly_linked,
        total = summary.tenants_total,
        newly = summary.tenants_newly_linked,
    );
    println!(
        "users:   {imported}/{total} imported ({newly} new, {errors} errors)",
        imported = summary.users_already_imported + summary.users_newly_imported,
        total = summary.users_total,
        newly = summary.users_newly_imported,
        errors = summary.user_errors.len()
    );
    if !summary.user_errors.is_empty() {
        println!("errors:");
        for err in &summary.user_errors {
            println!("  · {err}");
        }
        anyhow::bail!("{} errors during import", summary.user_errors.len());
    }
    println!(
        "✓ {} / {} users imported · 0 errors",
        summary.users_already_imported + summary.users_newly_imported,
        summary.users_total
    );
    Ok(())
}

fn parse_batch_size_arg() -> Option<usize> {
    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--batch-size" {
            if let Some(value) = args.next() {
                return value.parse().ok();
            }
        } else if let Some(rest) = arg.strip_prefix("--batch-size=") {
            return rest.parse().ok();
        }
    }
    None
}

async fn load_tenants(pool: &PgPool) -> Result<Vec<LocalTenant>> {
    let rows = sqlx::query(
        r#"SELECT id, name, slug, "workosOrganizationId" FROM "Tenant" ORDER BY "createdAt" ASC"#,
    )
    .fetch_all(pool)
    .await?;
    let mut tenants = Vec::with_capacity(rows.len());
    for row in rows {
        tenants.push(LocalTenant {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            slug: row.try_get("slug")?,
            workos_organization_id: row.try_get("workosOrganizationId").ok().flatten(),
        });
    }
    Ok(tenants)
}

async fn load_users_for_tenant(pool: &PgPool, tenant_id: &str) -> Result<Vec<LocalUser>> {
    let rows = sqlx::query(
        r#"SELECT id, email, name, password, role, "workosUserId", "authProvider"
           FROM "User" WHERE "tenantId" = $1 ORDER BY "createdAt" ASC"#,
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;
    let mut users = Vec::with_capacity(rows.len());
    for row in rows {
        users.push(LocalUser {
            id: row.try_get("id")?,
            email: row.try_get("email")?,
            name: row.try_get("name").unwrap_or(None),
            password_hash: row.try_get("password").unwrap_or(None),
            role: row
                .try_get::<String, _>("role")
                .unwrap_or_else(|_| "member".to_string()),
            workos_user_id: row.try_get("workosUserId").unwrap_or(None),
            auth_provider: row
                .try_get::<String, _>("authProvider")
                .unwrap_or_else(|_| "credentials".to_string()),
        });
    }
    Ok(users)
}

async fn collect_user_domains(pool: &PgPool, tenant_id: &str) -> Result<Vec<String>> {
    let rows = sqlx::query(r#"SELECT email FROM "User" WHERE "tenantId" = $1"#)
        .bind(tenant_id)
        .fetch_all(pool)
        .await?;
    let mut domains = std::collections::BTreeSet::new();
    for row in rows {
        let email: String = row.try_get("email")?;
        if let Some((_, domain)) = email.rsplit_once('@') {
            domains.insert(domain.trim().to_lowercase());
        }
    }
    Ok(domains.into_iter().collect())
}

async fn set_tenant_workos_org(pool: &PgPool, tenant_id: &str, workos_org_id: &str) -> Result<()> {
    sqlx::query(
        r#"UPDATE "Tenant" SET "workosOrganizationId" = $1, "updatedAt" = $3 WHERE id = $2"#,
    )
    .bind(workos_org_id)
    .bind(tenant_id)
    .bind(now_naive())
    .execute(pool)
    .await?;
    Ok(())
}

async fn set_user_workos_id(
    pool: &PgPool,
    user_id: &str,
    workos_user_id: &str,
    created_via: &str,
) -> Result<()> {
    sqlx::query(
        r#"UPDATE "User" SET "workosUserId" = $1, "createdVia" = COALESCE("createdVia", $4),
             "updatedAt" = $3 WHERE id = $2"#,
    )
    .bind(workos_user_id)
    .bind(user_id)
    .bind(now_naive())
    .bind(created_via)
    .execute(pool)
    .await?;
    Ok(())
}

fn now_naive() -> NaiveDateTime {
    chrono::Utc::now().naive_utc()
}

fn build_bulk_user_params(user: &LocalUser, workos_org_id: &str) -> BulkCreateUserParams {
    let (first_name, last_name) = split_display_name(user.name.as_deref());
    let role_slug = match user.role.as_str() {
        "owner" => "owner",
        "admin" => "admin",
        _ => "member",
    };
    let password_hash_type = if user.password_hash.is_some() {
        Some("bcrypt".to_string())
    } else {
        None
    };
    BulkCreateUserParams {
        email: user.email.clone(),
        first_name,
        last_name,
        password_hash: user.password_hash.clone(),
        password_hash_type,
        // Existing rows have already cleared their email-verification
        // step; treat them as verified to avoid forcing every user
        // through a re-verify step at first sign-in.
        email_verified: true,
        organization_memberships: vec![BulkOrganizationMembership {
            organization_id: workos_org_id.to_string(),
            role_slug: role_slug.to_string(),
        }],
    }
}

fn split_display_name(name: Option<&str>) -> (Option<String>, Option<String>) {
    let Some(name) = name else {
        return (None, None);
    };
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return (None, None);
    }
    if let Some((first, rest)) = trimmed.split_once(' ') {
        let last = rest.trim();
        let last = if last.is_empty() {
            None
        } else {
            Some(last.to_string())
        };
        return (Some(first.to_string()), last);
    }
    (Some(trimmed.to_string()), None)
}

async fn flush_batch(
    workos: &WorkosClient,
    pool: &PgPool,
    batch: &mut Vec<&LocalUser>,
    to_send: &mut Vec<BulkCreateUserParams>,
    summary: &mut ImportSummary,
) {
    if batch.is_empty() {
        return;
    }
    match workos.bulk_create_users(to_send).await {
        Ok(result) => {
            // The WorkOS bulk endpoint returns `users` in the same
            // order it received them. We zip with our local batch to
            // attach the new id back to the correct row.
            for (local, remote) in batch.iter().zip(result.users.iter()) {
                if let Err(err) = set_user_workos_id(pool, &local.id, &remote.id, "import").await {
                    summary
                        .user_errors
                        .push(format!("user {}: writeback failed: {err}", local.email));
                    tracing::error!(user_id = %local.id, error = %err, "writeback failed");
                    continue;
                }
                summary.users_newly_imported += 1;
                println!(
                    "  user {email:>40}  ✓ workos_user_id={workos_id} (provider={provider})",
                    email = local.email,
                    workos_id = remote.id,
                    provider = local.auth_provider,
                );
            }
            if !result.errors.is_empty() {
                for err in &result.errors {
                    summary.user_errors.push(format!("bulk_create: {err}"));
                }
            }
        }
        Err(err) => {
            for local in batch.iter() {
                summary
                    .user_errors
                    .push(format!("user {}: bulk_create_users failed: {err}", local.email));
            }
            tracing::error!(error = %err, "bulk_create_users failed for batch");
        }
    }
    batch.clear();
    to_send.clear();
}
