-- Phase 0b of the WorkOS AuthKit migration.
--
-- Adds the WorkOS-link columns alongside the existing bcrypt `password`
-- column. The `password` column stays populated through Phase 2 so we have a
-- one-shot rollback path; it is dropped in Phase 3 only after the importer
-- has copied every hash into WorkOS and the frontend cutover has soaked.
--
-- See plans/workos_authkit_embedded_migration_b1340f19.plan.md for context.

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "workosUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "createdVia" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_workosUserId_key"
    ON "User" ("workosUserId");

ALTER TABLE "Tenant"
    ADD COLUMN IF NOT EXISTS "workosOrganizationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_workosOrganizationId_key"
    ON "Tenant" ("workosOrganizationId");
