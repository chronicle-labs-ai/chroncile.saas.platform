# Getting Started

Use this guide to get a fresh clone installed and running locally. After the
initial setup, continue with the subsystem docs for app-specific environment
variables, database workflows, and runtime details.

## Prerequisites

- Node.js `>= 20.14.0`
- Yarn `4.6.0`
- Rust `1.81+` if you are working in `backend/`
- Docker Desktop if you need local Postgres or the containerized stack
- Doppler CLI if your team uses managed secrets

If Yarn 4 is not already enabled locally, run:

```bash
corepack enable
```

## Install Dependencies

Run this from the repo root:

```bash
yarn install
```

## Optional: Sync Secrets With Doppler

If your team uses Doppler-managed `.env` files, run these commands from the
repo root:

```bash
doppler login
make doppler-setup DOPPLER_ENV=dev
make doppler-sync DOPPLER_ENV=dev
```

`make doppler-sync` writes `.env` files for `backend/`, `apps/frontend/`, and
`apps/env-manager/`.

Supported permanent environment slugs are `dev`, `stg`, and `prd`, so you can
also run `make doppler-sync DOPPLER_ENV=stg` or `make doppler-sync DOPPLER_ENV=prd`
when you need those config families locally.

If you are not using Doppler, follow the app-specific READMEs for local `.env`
setup. For backend Sentry in local development, add `SENTRY_DSN`,
`SENTRY_ENVIRONMENT`, and `SENTRY_TRACES_SAMPLE_RATE` to `backend/.env`.

## Start Local Development

Start each service you need in a separate terminal from the repo root:

```bash
# Rust backend
make backend-dev

# Customer-facing frontend
yarn dev:frontend

# Internal env manager
yarn dev:env-manager
```

Expected local URLs:

- `apps/frontend` uses the default Next.js dev URL: `http://localhost:3000`
- `apps/env-manager` runs on `http://localhost:3100`
- The backend URL comes from your backend env/config

## Optional: Run The Containerized Stack

If you want a Docker-based local stack, the shared compose file starts Postgres,
the Rust backend, and the frontend together:

```bash
make docker-up
```

That stack exposes:

- Frontend at `http://localhost:3000`
- Backend at `http://localhost:8080`
- Postgres at `localhost:5432`

## Next Docs

- For repo structure and shared commands, see [README.md](../README.md)
- For frontend env vars, Prisma workflows, and routes, see
  [apps/frontend/README.md](../apps/frontend/README.md)
- For backend runtime modes, architecture, and API details, see
  [backend/README.md](../backend/README.md)
