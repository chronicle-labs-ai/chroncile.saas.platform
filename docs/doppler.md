# Doppler Configuration Matrix

Chronicle uses a single Doppler project, `chronicle-platform`, with
service-specific configs for each permanent environment:

| Environment | Backend | Frontend | Env manager |
| --- | --- | --- | --- |
| `dev` | `dev_backend` | `dev_frontend` | `dev_env_manager` |
| `stg` | `stg_backend` | `stg_frontend` | `stg_env_manager` |
| `prd` | `prd_backend` | `prd_frontend` | `prd_env_manager` |

## Secret Ownership

### Backend configs

Backend Doppler configs are the source of truth for backend runtime secrets and
local backend `.env` files. They should contain only backend-facing values such
as:

- `AUTH_SECRET`
- `DATABASE_URL` when the environment needs a Doppler-managed database URL
- `NANGO_BASE_URL`
- `NANGO_FRONT_INTEGRATION_ID`
- `NANGO_INTERCOM_INTEGRATION_ID`
- `NANGO_SECRET_KEY`
- `NANGO_SLACK_INTEGRATION_ID`
- `NANGO_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_ADDRESS`
- `SERVICE_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `WORKOS_API_KEY` — server-side WorkOS API key (`sk_...`); used by
  `chronicle_auth::workos` (`workos_exchange`, invitation send/resend,
  SCIM webhook validation, and the bulk importer).
- `WORKOS_CLIENT_ID` — WorkOS project client id (`client_...`); used to
  validate access tokens and as a default when calling AuthKit endpoints.
- `WORKOS_WEBHOOK_SECRET` — HMAC-SHA256 secret used to verify the
  `WorkOS-Signature` header on `POST /api/webhooks/workos`
  (`directory.user.*` SCIM events).
- `LOGO_DEV_SECRET_KEY` — optional server-side Logo.dev key. Only required if
  backend logo proxying or metadata calls are added; frontend image embeds use
  `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY`.

### Frontend configs

Frontend Doppler configs are the source of truth for frontend local `.env`
files and the permanent Vercel environment variables that env-manager syncs:

- `AUTH_SECRET`
- `AUTH_TRUST_HOST`
- `AUTH_URL`
- `ENCRYPTION_KEY`
- `EVENTS_MANAGER_URL`
- `GOOGLE_CLIENT_ID` — to be removed once Phase 3 cleanup lands
  (WorkOS handles Google OAuth via AuthKit).
- `GOOGLE_CLIENT_SECRET` — to be removed once Phase 3 cleanup lands.
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY` — publishable Logo.dev token for
  rendering company brand logos by domain.
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_ORG`
- `NEXT_PUBLIC_SENTRY_PROJECT`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `SERVICE_SECRET`
- `STRIPE_SECRET_KEY`
- `WORKOS_API_KEY` — same value as the backend config; consumed by
  `@workos-inc/authkit-nextjs` and `@workos-inc/node` from server actions
  in Phase 2.
- `WORKOS_CLIENT_ID` — same value as the backend config.
- `WORKOS_REDIRECT_URI` — public AuthKit callback URL, e.g.
  `https://app.chronicle-labs.com/api/auth/[...workos]`.
- `WORKOS_COOKIE_PASSWORD` — 32-byte hex string used to seal the
  `wos-session` cookie. Generate via
  `openssl rand -hex 32`.

### Env-manager configs

Env-manager Doppler configs are used for local/admin workflows and to store the
read-only Doppler service tokens that let env-manager look up permanent backend
and frontend config values:

- `DOPPLER_PROJECT`
- `DOPPLER_DEV_BACKEND_CONFIG`
- `DOPPLER_DEV_BACKEND_TOKEN`
- `DOPPLER_DEV_FRONTEND_CONFIG`
- `DOPPLER_DEV_FRONTEND_TOKEN`
- `DOPPLER_STG_BACKEND_CONFIG`
- `DOPPLER_STG_BACKEND_TOKEN`
- `DOPPLER_STG_FRONTEND_CONFIG`
- `DOPPLER_STG_FRONTEND_TOKEN`
- `DOPPLER_PRD_BACKEND_CONFIG`
- `DOPPLER_PRD_BACKEND_TOKEN`
- `DOPPLER_PRD_FRONTEND_CONFIG`
- `DOPPLER_PRD_FRONTEND_TOKEN`

They may also include local-safe defaults such as `FLY_ORG_SLUG`,
`GITHUB_OWNER`, `GITHUB_REPO`, `SERVICE_USER_ID`, and a local
`DATABASE_URL` for development.

### Operator credentials outside split configs

The service split does not automatically move every operator credential into
these configs. The following values may still need to be supplied by the
runtime platform or a local override file, especially for `apps/env-manager`:

- `FLY_API_TOKEN`
- `GITHUB_TOKEN`
- `VERCEL_API_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`

## Automation

### Backend deploys

GitHub Actions environment `development`, `staging`, and `production` each
store a `DOPPLER_BACKEND_TOKEN` secret scoped to their matching backend config.
Deploy jobs download that config and import the secrets into Fly before
deploying.

### Env-manager permanent sync

Env-manager reads permanent environment secrets from Doppler using the
read-only per-config service tokens in its runtime environment. During cron
sync, it also converges frontend Vercel env vars toward the matching frontend
Doppler config.

## Local usage

Use the repo root Make targets to sync local `.env` files:

```bash
make doppler-sync DOPPLER_ENV=dev
make doppler-sync DOPPLER_ENV=stg
make doppler-sync DOPPLER_ENV=prd
```

`make doppler-setup DOPPLER_ENV=<env>` scopes the Doppler CLI to the matching
service configs for `backend/`, `apps/frontend/`, and `apps/env-manager/`.

Logo.dev keys can be stored without exposing values in shell history:

```bash
scripts/setup-logo-dev-doppler-secrets.sh dev
make doppler-sync DOPPLER_ENV=dev
```
