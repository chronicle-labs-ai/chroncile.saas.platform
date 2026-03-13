# Chronicle Platform Changelog

Rolling record of notable changes in `chronicle.platform`. Entries are kept
newest-first and grouped by date.

## 2026-03-13

### Added

- Added a feature-gated Helix event-graph backend path that mirrors canonical Postgres events into Helix raw payload, typed payload, entity, link, embedding, and trace nodes for graph and vector workloads.
- Added Helix-specific backfill tooling under `scripts/` plus a `chronicle_store` loader example for exporting event rows, entity refs, links, and embeddings from Postgres into a local Helix instance.
- Added Helix unit coverage for typed payload mirroring, non-mutating backfill helpers, trace materialization, OOD scoring, deterministic text embedding, and Anthropic-backed link-decision parsing, plus ignored live `chronicle_store` integration tests for the Helix backend.

### Changed

- Extended the backend runtime and config surface so `storage.events.backend=helix` builds a canonical Postgres store together with a Helix graph mirror, exposes Helix-specific services from the infra layer, and documents Helix connection settings in the backend example config.

### Docs

- Updated `docs/architecture.html` to include the Helix graph mirror and HelixDB datastore in the backend architecture diagram.

## 2026-03-11

### Fixed

- Removed the React Flow built-in `output` node wrapper styling from sandbox output nodes so they no longer render with an unintended white background.

### Added

- Added a backend sandbox AI graph-editing path with typed Rust DTOs, SaaS route wiring, Anthropic-backed planning integration, and generated shared contracts for `SandboxAiChat` / `GraphEditCommand` responses.

### Changed

- Replaced the sandbox generative prompt's local keyword parser with a backend-backed graph planning request that sends the current node graph, receives a validated preview, and applies graph edits through typed `PlatformApi` calls.

## 2026-03-08

### Added

- Added a Postgres-backed `chronicle_store::SubscriptionService` that uses `LISTEN/NOTIFY` plus event rehydration so whole Chronicle events can be pushed to live subscribers in `BACKEND_MODE=real`.
- Added a native `/v1/events/stream` SSE endpoint and frontend `EventSource` client wiring so the dashboard timeline can consume store-level live event subscriptions.
- Added ignored Postgres integration coverage for subscription delivery, entity filtering, and cancellation semantics.
- Added an official Tau² benchmark integration layer under `benchmarks/tau2/` plus repo-local setup, run, summary, ingestion, and side-by-side report scripts under `scripts/`.
- Added a Tau²-to-Chronicle ingestion path that translates official Tau² run metadata, task definitions, messages, tool calls, tool results, outcomes, and event-link sequences into Chronicle's native events API.

### Changed

- Switched the live events timeline path to consume store-backed subscriptions instead of the separate app-local stream, and restored pending entity refs during Postgres event rehydration so entity-based subscription filters work with persisted events.
- Scoped `apps/env-manager` Google OAuth to dedicated `ENV_MANAGER_GOOGLE_CLIENT_ID` and `ENV_MANAGER_GOOGLE_CLIENT_SECRET` secrets so the internal app no longer reuses the customer frontend's Google credentials.

### Docs

- Added `docs/tau2-benchmark.md` and linked it from the root README so the official Tau² setup, Chronicle ingestion flow, and benchmark-report workflow are documented in one place.

## 2026-03-07

### Fixed

- Deferred the dashboard sidebar clock until after mount so dashboard routes no
  longer trigger a React hydration mismatch from server/client time drift.

### Added

- Added a new `chronicle-mcp` backend service and `chronicle_mcp` crate that expose tenant-scoped Chronicle event, run, audit, schema, replay, and live-watch capabilities over both `stdio` and Streamable HTTP using `rmcp`.
- Added a live Anthropic-backed Chronicle MCP eval runner that seeds deterministic incident, historical-debugging, and replay/live-monitoring datasets and can drive the real MCP tool surface from Claude via an ignored integration test.
- Added a new Chronicle MCP eval scenario for reconstructing a user interaction story from a shared user id carried across product, billing, and support events.
- Added a second Anthropic eval path that compares Chronicle MCP tool use against a raw context-dump baseline on the same seeded scenarios, including latency, token, grounding, and verdict reporting.
- Added a generic frontend analytics layer with an `AnalyticsProvider`,
  PostHog-backed adapter, early client initialization via
  `apps/frontend/instrumentation-client.ts`, and the first tracked auth event
  path through the wrapper.
- Added a local-only hidden developer tools widget that opens after repeated
  clicks in the bottom-right corner and surfaces analytics debug details such as
  the current PostHog session id and distinct id.
- Added frontend Sentry browser monitoring with tracing, replay, NextAuth-driven
  user context sync, and local developer widget diagnostics for replay and event
  state.

### Changed

- Extracted backend runtime construction into the shared `chronicle_backend` library so the HTTP API server and the new Chronicle MCP server now reuse the same storage, repo, stream, JWT, and integration wiring.
- Updated the local developer diagnostics widget to use a fixed-height,
  scrollable panel with provider tabs so PostHog, Sentry, and context details
  can be inspected without one long stacked list.
- Added backend Sentry support with configurable DSN, environment, trace
  sample rate, log ingestion, and Postgres query span wiring across the Rust
  server, Fly deployments, and the local Docker stack, and raised the backend
  Rust baseline to `1.81+` for SDK compatibility.
- Renamed the frontend request boundary file from `middleware.ts` to
  `proxy.ts` so the Next.js 16 deprecation warning no longer appears during
  frontend startup and builds.
- Split Doppler local configs into explicit `dev_backend`, `dev_frontend`, and
  `dev_env_manager` variants so backend and frontend secrets no longer share the
  same dev config, and updated local sync commands to target the new names.
- Added a root `make docker-up` target that wraps the shared local compose stack
  so Postgres, backend, and frontend can be launched together with one command.
- Moved deploy assets into dedicated folders by ownership: the shared local
  compose stack now lives in `deploy/`, backend Fly and Docker assets live in
  `backend/deploy/`, and the frontend container build lives in
  `apps/frontend/deploy/`.
- Consolidated frontend-owned config under `apps/frontend/`, including the
  Vercel config and a checked-in `.env.example`, and removed legacy root-level
  clutter such as `package-lock.json`, `.eslintrc.json`, and the tracked webhook
  debug log.
- Upgraded `apps/frontend` to Next.js 16.1, switched its local lint script from
  `next lint` to the ESLint CLI required by Next 16, and added the PostHog
  browser SDK dependency.

### Docs

- Updated the master architecture diagram for the new Chronicle MCP service boundary and added an MCP evaluation matrix covering incident investigation, historical debugging, and replay/live-monitoring scenarios across both transports.
- Documented how to run the live Anthropic Chronicle MCP evals from `backend/README.md`, including scenario and transport selection via environment variables.
- Added a dedicated getting-started onboarding guide for first-time local setup
  and split the main README so it links to the dedicated setup flow.
- Moved the onboarding guide into `docs/getting-started.md` and refreshed
  deploy-related commands and architecture references to use the new config
  locations.
- Started a rolling changelog for `chronicle.platform` and added a project rule
  so future notable changes are recorded here.
- Refreshed the platform README into a documentation hub with an accurate
  monorepo map, current local development commands, and links to deeper
  frontend, backend, and architecture docs.
