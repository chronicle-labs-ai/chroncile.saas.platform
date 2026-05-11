CREATE TABLE IF NOT EXISTS "SandboxFlow" (
    id TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    "playbackMode" TEXT NOT NULL DEFAULT 'paused',
    speed DOUBLE PRECISION NOT NULL DEFAULT 1,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    "workerId" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastCheckpoint" JSONB,
    "lastError" TEXT,
    "processedCount" BIGINT NOT NULL DEFAULT 0,
    "deliveredCount" BIGINT NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SandboxFlow_tenantId_idx"
    ON "SandboxFlow" ("tenantId");

CREATE INDEX IF NOT EXISTS "SandboxFlow_tenantId_status_idx"
    ON "SandboxFlow" ("tenantId", status);

CREATE INDEX IF NOT EXISTS "SandboxFlow_tenantId_updatedAt_idx"
    ON "SandboxFlow" ("tenantId", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "SandboxDeliveryLog" (
    id TEXT PRIMARY KEY,
    "sandboxId" TEXT NOT NULL REFERENCES "SandboxFlow"(id) ON DELETE CASCADE,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "nodeId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    source TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destinationUrl" TEXT,
    "requestBody" JSONB,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT
);

CREATE INDEX IF NOT EXISTS "SandboxDeliveryLog_sandboxId_idx"
    ON "SandboxDeliveryLog" ("sandboxId");

CREATE INDEX IF NOT EXISTS "SandboxDeliveryLog_tenantId_idx"
    ON "SandboxDeliveryLog" ("tenantId");

CREATE INDEX IF NOT EXISTS "SandboxDeliveryLog_sandboxId_deliveredAt_idx"
    ON "SandboxDeliveryLog" ("sandboxId", "deliveredAt" DESC);
