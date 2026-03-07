CREATE TABLE IF NOT EXISTS "FeatureFlagDefinition" (
    key TEXT NOT NULL PRIMARY KEY,
    "flagType" TEXT NOT NULL,
    description TEXT NOT NULL,
    owner TEXT NOT NULL,
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FeatureFlagOverride" (
    id TEXT NOT NULL PRIMARY KEY,
    "flagKey" TEXT NOT NULL REFERENCES "FeatureFlagDefinition"(key) ON DELETE CASCADE,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    enabled BOOLEAN NOT NULL,
    reason TEXT,
    variant TEXT,
    "rolloutPercentage" INT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureFlagOverride_flag_scope_key"
    ON "FeatureFlagOverride" ("flagKey", "scopeType", "scopeId");

CREATE INDEX IF NOT EXISTS "FeatureFlagOverride_scope_idx"
    ON "FeatureFlagOverride" ("scopeType", "scopeId");
