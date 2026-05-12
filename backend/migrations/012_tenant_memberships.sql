-- Phase 1 of the multi-organization migration.
--
-- Introduces a TenantMembership table that mirrors WorkOS's
-- `organization_membership` resource (top-level, status enum
-- `pending`/`active`/`inactive`). This decouples a User's identity from a
-- single Tenant: one User can be a member of zero, one, or many Tenants.
--
-- Backfill: every existing (user.id, user.tenantId, user.role) becomes one
-- `active` membership row. The User.tenantId column is retained as the
-- "primary self-serve tenant" pointer so the legacy AuthUser extractor keeps
-- working until CP9/CP10 finishes the migration.
--
-- See plans/multi_org_membership.plan.md for context (TBD).

CREATE TABLE IF NOT EXISTS "TenantMembership" (
    id TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantMembership_status_check"
        CHECK (status IN ('pending', 'active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantMembership_userId_tenantId_key"
    ON "TenantMembership" ("userId", "tenantId");

CREATE INDEX IF NOT EXISTS "TenantMembership_userId_idx"
    ON "TenantMembership" ("userId");

CREATE INDEX IF NOT EXISTS "TenantMembership_tenantId_idx"
    ON "TenantMembership" ("tenantId");

CREATE INDEX IF NOT EXISTS "TenantMembership_userId_status_idx"
    ON "TenantMembership" ("userId", status);

-- Backfill from User.tenantId. Idempotent: only inserts rows that don't
-- exist yet, so re-running the migration is safe.
INSERT INTO "TenantMembership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt")
SELECT
    'tm_' || u.id,
    u.id,
    u."tenantId",
    COALESCE(u.role, 'member'),
    'active',
    u."createdAt",
    u."updatedAt"
FROM "User" u
WHERE u."tenantId" IS NOT NULL
ON CONFLICT ("userId", "tenantId") DO NOTHING;
