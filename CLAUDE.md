# Chronicle Labs Platform

Multi-tenant SaaS monorepo: Rust/Axum event capture backend, two Next.js apps
(customer frontend + internal env-manager), and shared TypeScript packages.
Yarn 4 workspaces + Turbo for TS; Cargo workspace for Rust.

## Context Routing

Before starting work, identify your task type and load the relevant context.

### 1. Rust backend (`backend/`)

Read `backend/README.md` for architecture, API endpoints, event envelope schema.
Read `backend/DEVELOPMENT.md` for status and known issues (some binary names are stale).
For a specific crate, check `backend/crates/{crate}/` — there are 31 crates.
Key crates: `api` (routes), `domain` (business logic), `interfaces` (trait defs + enum dispatch),
`infra` (vendor impls, feature-gated), `chronicle_store`, `chronicle_server`, `auth`.

### 2. Customer frontend (`apps/frontend/`)

Read `apps/frontend/README.md` for routes, API endpoints, DB schema, and feature list.
Auth lives in `server/auth/auth.ts` and `server/auth/auth.config.ts` (not `lib/auth.ts`).
Route protection uses `proxy.ts` (Next.js 16 pattern), not `middleware.ts`.
Events Manager client: `lib/events-manager.ts` and `lib/events-manager-sse.ts`.

### 3. Internal env-manager (`apps/env-manager/`)

Read `apps/env-manager/README.md` for Doppler sync, Vercel convergence, cron patterns.
Read `docs/doppler.md` for the full config matrix and token layout.

### 4. Feature flags and entitlements

Read `docs/feature-access.md` — naming conventions, ownership rules, lifecycle, cleanup.
Backend resolves Stripe `price_id` → internal `plan_id`. Keep Stripe identifiers out of
frontend product-access logic.

### 5. Integrations (Nango, Stripe, Gorgias, etc.)

Nango sync scripts: `nango-integrations/` (Front, Intercom, Slack).
Backend integration crates: `chronicle_nango`, `chronicle_stripe`, `chronicle_gorgias`.
Webhook handling: `apps/frontend/app/api/webhooks/` (stripe, nango, shopify, intercom, klaviyo, trellus).

### 6. Shared types and TS bindings

`packages/shared/src/generated/` is auto-generated from Rust via `ts-rs`. Do not edit manually.
Generation flow: `cargo test` in backend → `backend/crates/**/bindings/generated/*.ts` → copy to
`packages/shared/src/generated/` → barrel export via `index.ts`.
Run `scripts/generate-types.sh` or see CI `type-check` job.

### 7. Database

Backend (SQLx): migrations at `backend/migrations/`, `backend/crates/infra/migrations/`,
and `backend/crates/chronicle_store/migrations/`.
Frontend + env-manager (Prisma): `apps/env-manager/prisma/schema.prisma`.
Commands: `yarn db:push`, `yarn db:migrate`, `yarn db:generate`, `make migrate`.

### 8. DevOps, deploy, and infrastructure

Docker: `deploy/docker-compose.yml` (Postgres 16, backend, frontend).
Dockerfiles: `backend/deploy/Dockerfile` (cargo-chef multi-stage), `apps/frontend/deploy/Dockerfile`.
Fly.io deploy configs: `backend/deploy/fly.*.toml` (dev, staging, prod, ephemeral).
Secrets: Doppler — read `docs/doppler.md`. Sync via `make doppler-sync DOPPLER_ENV=dev|stg|prd`.
CI: `.github/workflows/ci.yml` — lint, test, type-check, build, deploy per branch.

### 9. Benchmarks and evals

Tau² benchmark: `docs/tau2-benchmark.md`, scripts under `scripts/*tau2*`.
MCP evals: `cargo test -p chronicle_mcp anthropic_live_eval...` (needs `ANTHROPIC_API_KEY`).
Contract baselines: `scripts/capture-api-baselines.sh`.

## Quick Reference

| Task                        | Command                                      |
|-----------------------------|----------------------------------------------|
| Start backend               | `make backend-dev`                           |
| Start frontend              | `yarn dev:frontend`                          |
| Start env-manager           | `yarn dev:env-manager`                       |
| Full local stack (Docker)   | `make docker-up`                             |
| Sync secrets                | `make doppler-sync DOPPLER_ENV=dev`          |
| Run Rust tests              | `make test` or `yarn test:rust`              |
| Run Rust tests (with PG)    | `make test-full`                             |
| Lint Rust                   | `make clippy`                                |
| Format Rust                 | `make fmt`                                   |
| Generate TS from Rust types | `./scripts/generate-types.sh`                |
| Prisma generate             | `yarn db:generate`                           |
| Prisma push                 | `yarn db:push`                               |
| Start all services at once  | `make dev-all`                               |
| Full dev setup              | `make dev` (syncs secrets + starts tunnel)   |
| Build all TS apps           | `yarn build`                                 |
| Run all tests               | `yarn test:all`                              |

## Universal Conventions

- Monorepo root: Yarn 4.6 workspaces + Turbo. Node >= 20.14. Rust 1.81+.
- ESLint flat config at root ignores `backend/**`. Rust has its own `clippy` + `fmt`.
- Workspace packages (`packages/*`) are transpiled by Next.js via `next.config.ts`.
- Feature-gated Rust backends: `memory` (default, fast compile), `postgres`, `kafka`, `helix`, `full`.
- Server binary is `chronicle-backend` at `backend/bin/server/` (not `events-manager`).
- Backend uses enum dispatch over `dyn Trait` for performance (no vtable overhead).
- `Box<RawValue>` for zero-copy JSON storage in event payloads.
- Thread-local ULID generators to avoid contention.

## Do Not

- Do not edit files in `packages/shared/src/generated/`. They are overwritten by `ts-rs`.
- Do not hardcode Stripe price IDs in the frontend. Backend owns the `price_id` → `plan_id` mapping.
- Do not use `middleware.ts` in `apps/frontend/`. Auth uses `proxy.ts` (Next.js 16).
- Do not reference `events-manager` as the binary name. It is `chronicle-backend`.
- Do not add backend paths to the root ESLint config. Backend linting is `make clippy`.
- Do not put operator credentials (FLY_API_TOKEN, VERCEL_API_TOKEN, GITHUB_TOKEN) in Doppler
  split configs. They go in local overrides or runtime secret stores.
- Do not build Stripe flag names dynamically. One flag per operator decision.
- Do not skip `ts-rs` regeneration after changing Rust types that derive `TS`.
