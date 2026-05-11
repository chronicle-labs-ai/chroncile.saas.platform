DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Connection'
          AND column_name = 'pipedreamAuthId'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Connection'
          AND column_name = 'nangoConnectionId'
    ) THEN
        ALTER TABLE "Connection" RENAME COLUMN "pipedreamAuthId" TO "nangoConnectionId";
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('"Connection_pipedreamAuthId_idx"') IS NOT NULL
       AND to_regclass('"Connection_nangoConnectionId_idx"') IS NULL THEN
        ALTER INDEX "Connection_pipedreamAuthId_idx" RENAME TO "Connection_nangoConnectionId_idx";
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('"PipedreamTrigger"') IS NOT NULL
       AND to_regclass('"IntegrationSync"') IS NULL THEN
        ALTER TABLE "PipedreamTrigger" RENAME TO "IntegrationSync";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'IntegrationSync'
          AND column_name = 'triggerId'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'IntegrationSync'
          AND column_name = 'syncName'
    ) THEN
        ALTER TABLE "IntegrationSync" RENAME COLUMN "triggerId" TO "syncName";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'IntegrationSync'
          AND column_name = 'deploymentId'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'IntegrationSync'
          AND column_name = 'nangoSyncId'
    ) THEN
        ALTER TABLE "IntegrationSync" RENAME COLUMN "deploymentId" TO "nangoSyncId";
    END IF;
END $$;

ALTER TABLE "IntegrationSync"
    ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "syncCursor" TEXT;

DO $$
BEGIN
    IF to_regclass('"PipedreamTrigger_deploymentId_key"') IS NOT NULL
       AND to_regclass('"IntegrationSync_nangoSyncId_key"') IS NULL THEN
        ALTER INDEX "PipedreamTrigger_deploymentId_key" RENAME TO "IntegrationSync_nangoSyncId_key";
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('"PipedreamTrigger_tenantId_idx"') IS NOT NULL
       AND to_regclass('"IntegrationSync_tenantId_idx"') IS NULL THEN
        ALTER INDEX "PipedreamTrigger_tenantId_idx" RENAME TO "IntegrationSync_tenantId_idx";
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('"PipedreamTrigger_connectionId_idx"') IS NOT NULL
       AND to_regclass('"IntegrationSync_connectionId_idx"') IS NULL THEN
        ALTER INDEX "PipedreamTrigger_connectionId_idx" RENAME TO "IntegrationSync_connectionId_idx";
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('"PipedreamTrigger_deploymentId_idx"') IS NOT NULL
       AND to_regclass('"IntegrationSync_nangoSyncId_idx"') IS NULL THEN
        ALTER INDEX "PipedreamTrigger_deploymentId_idx" RENAME TO "IntegrationSync_nangoSyncId_idx";
    END IF;
END $$;
