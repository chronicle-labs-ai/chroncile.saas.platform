-- SaaS schema using Prisma-compatible naming (PascalCase tables, camelCase columns)

CREATE TABLE IF NOT EXISTS "Tenant" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionStatus" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant" (slug);
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_key" ON "Tenant" ("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Tenant_slug_idx" ON "Tenant" (slug);

CREATE TABLE IF NOT EXISTS "User" (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    password TEXT NOT NULL,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" (email);
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User" ("tenantId");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User" (email);

CREATE TABLE IF NOT EXISTS "AgentEndpointConfig" (
    id TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "endpointUrl" TEXT,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "authHeaderName" TEXT,
    "authSecretEncrypted" TEXT,
    "basicUsername" TEXT,
    "customHeadersJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentEndpointConfig_tenantId_key" ON "AgentEndpointConfig" ("tenantId");
CREATE INDEX IF NOT EXISTS "AgentEndpointConfig_tenantId_idx" ON "AgentEndpointConfig" ("tenantId");

CREATE TABLE IF NOT EXISTS "Run" (
    id TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "workflowId" TEXT,
    "eventId" TEXT NOT NULL,
    "invocationId" TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    "eventSnapshot" JSONB,
    "contextPointers" JSONB,
    "agentRequest" JSONB,
    "agentResponse" JSONB,
    "humanDecision" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Run_invocationId_key" ON "Run" ("invocationId");
CREATE INDEX IF NOT EXISTS "Run_tenantId_idx" ON "Run" ("tenantId");
CREATE INDEX IF NOT EXISTS "Run_tenantId_status_idx" ON "Run" ("tenantId", status);
CREATE INDEX IF NOT EXISTS "Run_tenantId_createdAt_idx" ON "Run" ("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Run_eventId_idx" ON "Run" ("eventId");

CREATE TABLE IF NOT EXISTS "AuditLog" (
    id TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "runId" TEXT REFERENCES "Run"(id) ON DELETE SET NULL,
    "eventId" TEXT,
    "invocationId" TEXT,
    action TEXT NOT NULL,
    actor TEXT,
    payload JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" ON "AuditLog" ("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_runId_createdAt_idx" ON "AuditLog" ("runId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_eventId_idx" ON "AuditLog" ("eventId");
CREATE INDEX IF NOT EXISTS "AuditLog_invocationId_idx" ON "AuditLog" ("invocationId");

CREATE TABLE IF NOT EXISTS "Connection" (
    id TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "pipedreamAuthId" TEXT,
    metadata JSONB,
    status TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Connection_tenantId_provider_key" ON "Connection" ("tenantId", provider);
CREATE INDEX IF NOT EXISTS "Connection_tenantId_idx" ON "Connection" ("tenantId");
CREATE INDEX IF NOT EXISTS "Connection_provider_idx" ON "Connection" (provider);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Connection'
          AND column_name = 'pipedreamAuthId'
    ) THEN
        CREATE INDEX IF NOT EXISTS "Connection_pipedreamAuthId_idx"
            ON "Connection" ("pipedreamAuthId");
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('"PipedreamTrigger"') IS NULL
       AND to_regclass('"IntegrationSync"') IS NULL THEN
        CREATE TABLE "PipedreamTrigger" (
            id TEXT NOT NULL PRIMARY KEY,
            "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
            "connectionId" TEXT NOT NULL REFERENCES "Connection"(id) ON DELETE CASCADE,
            "triggerId" TEXT NOT NULL,
            "deploymentId" TEXT NOT NULL,
            "configuredProps" JSONB,
            status TEXT NOT NULL DEFAULT 'active',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('"PipedreamTrigger"') IS NOT NULL THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "PipedreamTrigger_deploymentId_key"
            ON "PipedreamTrigger" ("deploymentId");
        CREATE INDEX IF NOT EXISTS "PipedreamTrigger_tenantId_idx"
            ON "PipedreamTrigger" ("tenantId");
        CREATE INDEX IF NOT EXISTS "PipedreamTrigger_connectionId_idx"
            ON "PipedreamTrigger" ("connectionId");
        CREATE INDEX IF NOT EXISTS "PipedreamTrigger_deploymentId_idx"
            ON "PipedreamTrigger" ("deploymentId");
    END IF;
END $$;
