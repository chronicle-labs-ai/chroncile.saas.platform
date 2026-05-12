# Env Manager

This is the internal Next.js app used to manage permanent and ephemeral
environments, backend admin flows, and frontend environment convergence.

## Local Setup

1. Install workspace dependencies from the repo root:

```bash
yarn install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

If your team uses Doppler, start from the split env-manager config:

```bash
make doppler-setup DOPPLER_ENV=dev
make doppler-sync-env-manager DOPPLER_ENV=dev
```

The Doppler-managed env-manager config is intended to provide the permanent
environment Doppler tokens plus shared defaults such as `FLY_ORG_SLUG`. Keep
operator credentials like `FLY_API_TOKEN`, `VERCEL_API_TOKEN`,
`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, and `GITHUB_TOKEN` in a local override
or your runtime platform secret store.

3. Start the app:

```bash
yarn dev:env-manager
```

When `DATABASE_URL` points at a Fly private hostname such as
`chronicle-env-manager-db.flycast`, the dev script starts `fly proxy`
automatically and runs Next.js against `localhost:15432`. Set
`ENV_MANAGER_DB_PROXY_PORT` to override the local port, or set
`ENV_MANAGER_DB_PROXY=0` to disable the automatic proxy.

## Permanent Environment Sync

The cron sync path reads permanent backend and frontend config values from
Doppler using read-only service tokens, then:

- updates the environment registry with the latest permanent `SERVICE_SECRET`
- converges frontend Vercel env vars toward the matching frontend Doppler config
- refreshes permanent environment URLs and health metadata

See [Doppler Guide](../../docs/doppler.md) for the config matrix and token
layout.
