# Chronicle Labs Frontend

This is the customer-facing Next.js app. It has been reset to a small App
Router skeleton while preserving the auth, webhook, and integration callback
contracts used by external systems.

## Local Development

Install dependencies from the repo root:

```bash
yarn install
```

Copy the local env template and fill in WorkOS/backend values:

```bash
cp apps/frontend/.env.example apps/frontend/.env.local
```

Run the app:

```bash
yarn dev:frontend
```

The app is served at `http://localhost:3000`.

## Preserved Contracts

- `proxy.ts` protects non-public routes with the WorkOS sealed-session cookie.
- `app/api/auth/*` handles WorkOS OAuth, callbacks, session refresh, sign-out,
  and current-session reads.
- `app/api/webhooks/*` forwards external webhook calls to the backend.
- `app/api/integrations/*/callback` completes provider OAuth callback handoff
  through the backend and redirects back to `/dashboard/connections`.

## Skeleton Routes

- `/login`
- `/signup`
- `/dashboard`
- `/dashboard/connections`
- `/onboarding/workspace`
