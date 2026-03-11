ALTER TABLE "SandboxFlow"
    ADD COLUMN IF NOT EXISTS "configVersion" BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "appliedConfigVersion" BIGINT,
    ADD COLUMN IF NOT EXISTS "pendingConfigApply" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "runtimePhase" TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS "lastDeliveryAt" TIMESTAMP(3);

UPDATE "SandboxFlow"
SET
    "runtimePhase" = CASE
        WHEN status = 'draft' THEN 'draft'
        WHEN status = 'archived' THEN 'archived'
        WHEN status = 'error' THEN 'error'
        WHEN status = 'active' AND "playbackMode" = 'live' THEN 'waitingForEvents'
        WHEN status = 'active' AND "playbackMode" = 'playing' THEN 'replaying'
        ELSE 'paused'
    END,
    "pendingConfigApply" = CASE
        WHEN status = 'active'
         AND ("workerId" IS NULL OR "leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= CURRENT_TIMESTAMP)
            THEN TRUE
        ELSE FALSE
    END,
    "appliedConfigVersion" = CASE
        WHEN status = 'active'
         AND "workerId" IS NOT NULL
         AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" > CURRENT_TIMESTAMP)
            THEN "configVersion"
        ELSE NULL
    END;

UPDATE "SandboxFlow" AS flow
SET "lastDeliveryAt" = latest."lastDeliveryAt"
FROM (
    SELECT "sandboxId", MAX("deliveredAt") AS "lastDeliveryAt"
    FROM "SandboxDeliveryLog"
    GROUP BY "sandboxId"
) AS latest
WHERE flow.id = latest."sandboxId";
