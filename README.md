# Chronicle Labs Platform

Chronicle Labs Platform is the product monorepo for the Chronicle Labs apps,
shared packages, and Rust backend services. Use this README as the main
entrypoint, then follow the linked subsystem docs for setup details,
architecture context, and implementation notes.

## Monorepo Overview

This repository uses Yarn workspaces and Turbo for the TypeScript apps and
packages, alongside a Rust backend in `backend/`.

| Path | Purpose |
| --- | --- |
| `apps/frontend` | Customer-facing Next.js app for auth, dashboard, runs, connections, and sandbox flows. |
| `apps/env-manager` | Internal Next.js app for environment operations, tenant administration, feature access, and email templates. |
| `backend` | Rust/Axum backend and event pipeline, including API, domain, infra, and UI crates. |
| `packages/shared` | Shared TypeScript types, generated bindings, and feature-access helpers. |
| `packages/ui` | Reusable UI components and shared styles for workspace apps. |
| `packages/platform-api` | Typed frontend API client for platform endpoints. |
| `packages/plans` | Subscription plan definitions and helpers. |

## Getting Started

### Prerequisites

- Node.js `>= 20.14.0`
- Yarn `4.6.0`
- Rust `1.75+` if you are working in `backend/`
- Docker Desktop if you need local Postgres or Kafka-backed backend workflows
- Doppler CLI if your team uses managed secrets

If you do not already have Yarn 4 enabled locally, run `corepack enable` first.

### Install Dependencies

```bash
yarn install
```

### Optional: Configure Secrets With Doppler

Run these commands from the repo root if you want Doppler-managed `.env` files:

```bash
doppler login
make doppler-setup
make doppler-sync
```

`make doppler-sync` writes environment files for `backend/`,
`apps/frontend/`, and `apps/env-manager/`.

### Run The Local Stack

Start the pieces you need in separate terminals:

```bash
# Frontend app
yarn dev:frontend

# Env manager app
yarn dev:env-manager

# Rust backend
make backend-dev
```

`yarn dev` runs Turbo workspace dev scripts for the JavaScript apps. The Rust
backend is started separately via `make backend-dev`.

## Common Commands

| Task | Command |
| --- | --- |
| Start frontend | `yarn dev:frontend` |
| Start env manager | `yarn dev:env-manager` |
| Build workspace apps | `yarn build` |
| Generate Prisma client | `yarn db:generate` |
| Apply Prisma schema changes | `yarn db:push` |
| Create Prisma migrations | `yarn db:migrate` |
| Run Rust backend tests | `yarn test:rust` |
| Run Rust contract tests | `yarn test:contracts` |
| Run Playwright end-to-end tests | `yarn test:e2e` |
| Run the full test suite | `yarn test:all` |
| Start backend in dev mode | `make backend-dev` |
| Run backend SQLx migrations | `make migrate` |
| Sync Doppler env files | `make doppler-sync` |

For subsystem-specific environment variables, database setup, and runtime
details, use the docs below.

## Documentation Guide

Use these docs for deeper context by topic:

| If you need... | Read |
| --- | --- |
| Frontend setup, env vars, Prisma workflows, and app routes | [Frontend README](./apps/frontend/README.md) |
| Backend setup, architecture, API endpoints, and runtime modes | [Backend README](./backend/README.md) |
| Backend status, known issues, and remaining implementation work | [Backend Development Notes](./backend/DEVELOPMENT.md) |
| Feature flags, entitlements, ownership, and cleanup rules | [Feature Access](./docs/feature-access.md) |
| High-level system diagram and service/data flow overview | [Architecture Diagram](./docs/architecture.html) |

### Component Docs

- [Events Manager UI README](./backend/crates/ui/README.md) for the native and
  WebAssembly UI
- [Timeline Widget README](./backend/crates/timeline-widget/README.md) for the
  timeline package used by the backend UI

## Tech Stack

### Frontend And Internal Apps

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Prisma with PostgreSQL
- NextAuth.js

### Backend And Platform Services

- Rust 1.75+
- Axum
- SQLx with PostgreSQL
- Kafka (feature-gated and optional)
- Server-sent events for streaming
- `ts-rs` generated TypeScript bindings shared through `packages/shared`

## Working In This Repo

- Start here for orientation, then move to the closest subsystem README before
  making changes.
- Prefer the app-specific docs for local env and database setup instead of
  duplicating those details here.
- If you are touching backend/frontend integration, review both the backend
  README and the architecture diagram first.

## License

Private
