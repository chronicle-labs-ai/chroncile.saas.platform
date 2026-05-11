-- Backtest runtime schema (Phase 0 of the orchestration stack).
--
-- Models the persistence layer the orchestrator + frontend need to render
-- the Backtests dashboard against real data instead of mock seeds. Mirrors
-- Harbor's Job/Trial/VerifierResult split so the in-process orchestrator
-- (bin/server) and any future sidecar workers can scribble through the
-- same rows.
--
-- Tables (Prisma-compatible naming: PascalCase tables, camelCase columns):
--   "BacktestJob"           — one row per launched recipe; carries the full
--                             recipe JSON the user picked, lifecycle status,
--                             and the bounded-parallelism config.
--   "BacktestTrial"         — one row per (case × agent) cell. The
--                             orchestrator's TrialQueue claims, runs, and
--                             writes back to these rows.
--   "BacktestTrialReward"   — multi-key reward shape, one row per metric key
--                             per trial. Mirrors `VerifierResult.rewards`
--                             (`{accuracy: 0.91, latency_ms: 1240, ...}`).
--   "BacktestArtifact"      — pointers to logs/trajectories/screenshots that
--                             a trial produced. Path is opaque to this
--                             schema (S3 key, local FS, blob store).

CREATE TABLE IF NOT EXISTS "BacktestJob" (
    id TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Echo of `BacktestRecipe.mode` (replay | compare | regression | suite).
    mode TEXT NOT NULL,
    -- Full BacktestRecipe payload as it was at submit time. Keeps the run
    -- self-describing even if upstream datasets/agents/environments mutate.
    recipe JSONB NOT NULL,
    -- pending | running | succeeded | failed | cancelled.
    status TEXT NOT NULL DEFAULT 'pending',
    -- Optional verdict copy rendered on the manager list view.
    verdict TEXT,
    -- Hard cap on concurrent in-flight trials for this job.
    "nConcurrent" INTEGER NOT NULL DEFAULT 4,
    -- Sandbox driver picked at submit time: daytona | docker | mock.
    "sandboxDriver" TEXT NOT NULL DEFAULT 'daytona',
    -- Optional retry policy override (RetryConfig as JSON). NULL == defaults.
    "retryConfig" JSONB,
    -- Owner / actor who launched the job.
    "createdBy" TEXT,
    -- Optional ISO timestamp when the job was scheduled to start (vs created).
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    -- Soft summary used by the dashboard list view; populated lazily by the
    -- orchestrator as trials finish so the manager doesn't have to recount
    -- every render.
    "totalTrials" INTEGER,
    "completedTrials" INTEGER NOT NULL DEFAULT 0,
    "failedTrials" INTEGER NOT NULL DEFAULT 0,
    -- Captured exception kind (for the `failed` status) so we can render
    -- a useful row hint without joining trials.
    "exceptionKind" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BacktestJob_tenantId_idx"
    ON "BacktestJob" ("tenantId");
CREATE INDEX IF NOT EXISTS "BacktestJob_tenantId_status_idx"
    ON "BacktestJob" ("tenantId", status);
CREATE INDEX IF NOT EXISTS "BacktestJob_tenantId_createdAt_idx"
    ON "BacktestJob" ("tenantId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "BacktestTrial" (
    id TEXT PRIMARY KEY,
    "jobId" TEXT NOT NULL REFERENCES "BacktestJob"(id) ON DELETE CASCADE,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    -- Agent identity at recipe-resolve time. Stored as the recipe's
    -- BacktestAgent.id (typically `{name}@{version}`) so the row is stable
    -- even if the agent registry rolls a new latest version mid-job.
    "agentId" TEXT NOT NULL,
    "agentLabel" TEXT NOT NULL,
    -- Whether this trial is the comparison baseline for its case.
    "isBaseline" BOOLEAN NOT NULL DEFAULT FALSE,
    -- Identifier of the dataset case being run. Free-form string for now;
    -- when datasets are persisted, FK this to "DatasetCase"(id).
    "caseId" TEXT NOT NULL,
    -- Optional cluster label used by the live feed + Results table.
    "caseCluster" TEXT,
    -- pending | setup | running | verifying | succeeded | failed | cancelled.
    status TEXT NOT NULL DEFAULT 'pending',
    -- Per-phase timing (Harbor's TimingInfo). Nullable until each phase starts.
    "envSetupStartedAt" TIMESTAMP(3),
    "envSetupFinishedAt" TIMESTAMP(3),
    "agentSetupStartedAt" TIMESTAMP(3),
    "agentSetupFinishedAt" TIMESTAMP(3),
    "agentRunStartedAt" TIMESTAMP(3),
    "agentRunFinishedAt" TIMESTAMP(3),
    "verifierStartedAt" TIMESTAMP(3),
    "verifierFinishedAt" TIMESTAMP(3),
    -- Aggregate trial duration, populated when status reaches a terminal value.
    "durationMs" INTEGER,
    -- The sandbox the orchestrator created for this trial; stored even after
    -- teardown so we can correlate provider-side audit logs.
    "sandboxId" TEXT,
    -- Captured exception when status is `failed`.
    "exceptionKind" TEXT,
    "exceptionMessage" TEXT,
    -- Attempt counter — bumped on retry. 0 == first attempt.
    attempt INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BacktestTrial_jobId_idx"
    ON "BacktestTrial" ("jobId");
CREATE INDEX IF NOT EXISTS "BacktestTrial_jobId_status_idx"
    ON "BacktestTrial" ("jobId", status);
CREATE INDEX IF NOT EXISTS "BacktestTrial_tenantId_idx"
    ON "BacktestTrial" ("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "BacktestTrial_jobId_caseId_agentId_key"
    ON "BacktestTrial" ("jobId", "caseId", "agentId");

CREATE TABLE IF NOT EXISTS "BacktestTrialReward" (
    "trialId" TEXT NOT NULL REFERENCES "BacktestTrial"(id) ON DELETE CASCADE,
    -- Free-form metric key (e.g. `reward`, `accuracy`, `latency_ms`).
    -- Default verifier writes `reward`; multi-criteria graders emit one row
    -- per scored axis.
    key TEXT NOT NULL,
    -- DOUBLE PRECISION so reward keys can carry both [0,1] scores and
    -- duration-style values without a schema split.
    value DOUBLE PRECISION NOT NULL,
    -- Source grader id (joins with BacktestRecipe.graders[].id) when known.
    -- NULL for the implicit `reward` key produced by reward.txt.
    "graderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("trialId", key)
);

CREATE INDEX IF NOT EXISTS "BacktestTrialReward_trialId_idx"
    ON "BacktestTrialReward" ("trialId");
CREATE INDEX IF NOT EXISTS "BacktestTrialReward_key_idx"
    ON "BacktestTrialReward" (key);

CREATE TABLE IF NOT EXISTS "BacktestArtifact" (
    id TEXT PRIMARY KEY,
    "trialId" TEXT NOT NULL REFERENCES "BacktestTrial"(id) ON DELETE CASCADE,
    -- Artifact kind: `agent-log` | `verifier-log` | `trajectory` | `screenshot`
    --                | `reward-json` | `reward-txt` | `tar` | `other`.
    kind TEXT NOT NULL,
    -- Opaque storage path (S3 key, local FS path, blob store url). The
    -- orchestrator decides where artifacts land; this row just points.
    path TEXT NOT NULL,
    "sizeBytes" BIGINT,
    -- Optional MIME / file-type hint rendered in the artifacts list.
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BacktestArtifact_trialId_idx"
    ON "BacktestArtifact" ("trialId");
CREATE INDEX IF NOT EXISTS "BacktestArtifact_trialId_kind_idx"
    ON "BacktestArtifact" ("trialId", kind);
