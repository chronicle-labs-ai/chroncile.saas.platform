# Chronicle Labs - Frontend

This is the Next.js frontend application for Chronicle Labs.

## Setup

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Set up environment variables**  
   Either use **Doppler** (recommended if your team uses it) or a local `.env` file.

   **Option A — Doppler:**  
   From repo root run `make doppler-setup DOPPLER_ENV=dev`, then from this directory:
   ```bash
   doppler run -- yarn dev
   ```

   **Option B — Local `.env`:**  
   Start from the checked-in example:
   ```env
   cp .env.example .env
   ```

   Then update the copied file with your local secrets and provider credentials.
   The frontend observability layer also reads:
   ```env
   NEXT_PUBLIC_POSTHOG_KEY=
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   NEXT_PUBLIC_SENTRY_DSN=
   NEXT_PUBLIC_SENTRY_ORG=
   NEXT_PUBLIC_SENTRY_PROJECT=
   ```

   To generate the required secrets:
   ```bash
   # Generate AUTH_SECRET
   openssl rand -base64 32
   
   # Generate ENCRYPTION_KEY and SERVICE_SECRET
   openssl rand -hex 32
   openssl rand -base64 32
   ```

3. **Set up the database**:
   ```bash
   yarn db:push
   # or for migrations:
   yarn db:migrate
   ```

4. **Generate Prisma Client**:
   ```bash
   yarn db:generate
   ```

5. **Start the development server**:
   ```bash
   yarn dev
   ```

   The app will be available at http://localhost:3000

## Database Management

- `yarn db:generate` - Generate Prisma Client
- `yarn db:push` - Push schema changes to database (development)
- `yarn db:migrate` - Create and run migrations (production-ready)
- `yarn db:studio` - Open Prisma Studio to view/edit data

## Features Implemented

### Authentication (Week 1)
- ✅ NextAuth.js with credentials provider
- ✅ Signup flow with user + tenant creation
- ✅ Login/logout functionality
- ✅ Route protection middleware
- ✅ Dashboard layout with sidebar navigation

### Connections (Week 2)
- ✅ Nango Connect: connect Intercom, Slack, Front, and other supported providers
- ✅ Token encryption for secure storage
- ✅ Connection management UI
- ✅ Manual sync and backfill controls per provider

### Webhooks & Events
- ✅ Single backend webhook endpoint: `/api/webhooks/nango` for integration sync updates
- ✅ Event forwarding to Events Manager
- ✅ Events timeline UI with real-time refresh

### Observability
- ✅ PostHog client initialization through `instrumentation-client.ts`
- ✅ Sentry browser initialization with tracing and replay through `instrumentation-client.ts`
- ✅ Vendor-agnostic `AnalyticsProvider` abstraction for product analytics events
- ✅ Session-driven PostHog identify/reset plus Sentry user context sync
- ✅ Local hidden developer widget for PostHog and Sentry session diagnostics

### Pages
- `/login` - Login page
- `/signup` - Signup page with organization creation
- `/dashboard` - Protected dashboard home
- `/dashboard/events` - Events timeline (shows events from Events Manager)
- `/dashboard/connections` - Integration management via Nango
- `/dashboard/settings` - Account and organization settings

### API Endpoints
- `POST /api/auth/signup` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET /api/platform/integrations/providers` - List Nango-backed providers
- `POST /api/platform/integrations/connect-session` - Create a Nango Connect session
- `POST /api/platform/integrations/sync` - Trigger incremental sync or backfill
- `POST /api/webhooks/nango` - Receive sync webhooks from Nango

### Database Schema
- `User` - User accounts with email/password
- `Tenant` - Organizations/tenants
- `Connection` - Connected integration accounts and their provider metadata.
- `IntegrationSync` - Stored sync/deployment metadata for legacy compatibility and future sync state work.

### Integration Syncs (what they do in this app)

Chronicle now uses **Nango** for OAuth and sync orchestration. Instead of deploying provider-specific triggers from the frontend, the app materializes a connection and then lets operators run:

1. **Connect** – Creates a Nango Connect session so the user can authorize a provider.
2. **Run Sync** – Triggers an incremental sync for new or updated records.
3. **Run Backfill** – Triggers a historical sync for providers that support backfill.
4. **Webhook** (`POST /api/webhooks/nango`) – Receives sync notifications from Nango, fetches records, normalizes them, and forwards them into Chronicle’s event pipeline.

So in this application, connections are now driven by **Nango-managed syncs**.

## Tech Stack

- **Framework**: Next.js 16.1 (App Router)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **Observability**: PostHog analytics plus Sentry browser error, trace, and replay monitoring
- **Validation**: Zod
- **Password Hashing**: bcryptjs

## Project Structure

```
apps/frontend/
├── app/
│   ├── (auth)/          # Auth pages (login, signup)
│   ├── (dashboard)/     # Protected dashboard pages
│   ├── api/             # API routes (auth endpoints)
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page (redirects)
├── components/
│   ├── layout/          # Layout components (sidebar, header)
│   └── ui/              # Reusable UI components
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   ├── db.ts            # Prisma client
│   ├── encryption.ts    # Token encryption/decryption
│   ├── events-manager.ts # Events Manager API client
│   ├── validations.ts   # Zod schemas
│   └── utils.ts         # Utility functions
├── prisma/
│   └── schema.prisma    # Database schema
└── middleware.ts        # Route protection
```
