-- Chronicle Labs — Demo Users Seed
-- Creates two orgs with users for testing the platform.

-- Org 1: Acme Corp (free tier)
INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt")
VALUES ('tenant-acme', 'Acme Corp', 'acme-corp', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "User" (id, email, name, password, "authProvider", "tenantId", "createdAt", "updatedAt")
VALUES
  ('user-alice', 'alice@acme-corp.com', 'Alice Johnson', NULL, 'google', 'tenant-acme', NOW(), NOW()),
  ('user-bob', 'bob@acme-corp.com', 'Bob Smith', NULL, 'google', 'tenant-acme', NOW(), NOW()),
  ('user-carol', 'carol@acme-corp.com', 'Carol Davis', NULL, 'google', 'tenant-acme', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Org 2: Chronicle Labs (active subscription)
INSERT INTO "Tenant" (id, name, slug, "stripeSubscriptionStatus", "createdAt", "updatedAt")
VALUES ('tenant-chronicle', 'Chronicle Labs', 'chronicle-labs', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "User" (id, email, name, password, "authProvider", "tenantId", "createdAt", "updatedAt")
VALUES
  ('user-admin', 'admin@chronicle-labs.com', 'Admin User', NULL, 'google', 'tenant-chronicle', NOW(), NOW()),
  ('user-dev', 'dev@chronicle-labs.com', 'Dev User', NULL, 'google', 'tenant-chronicle', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
