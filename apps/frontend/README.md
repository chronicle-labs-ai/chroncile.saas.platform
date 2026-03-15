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
- ✅ Pipedream Connect: connect Intercom, Slack, Stripe, etc. (no direct OAuth to third parties)
- ✅ Token encryption for secure storage
- ✅ Connection management UI
- ✅ Deploy triggers per connection to receive events via Pipedream webhooks

### Webhooks & Events
- ✅ Single webhook endpoint: `/api/webhooks/pipedream` for all Pipedream trigger events
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
- `/dashboard/connections` - Integration management via Pipedream (Intercom, Slack, Stripe, etc.)
- `/dashboard/settings` - Account and organization settings

### API Endpoints
- `POST /api/auth/signup` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET /api/pipedream/triggers` - List available Pipedream triggers
- `POST /api/pipedream/triggers/deploy` - Deploy a trigger for a connection
- `GET /api/pipedream/triggers/deployed` - List deployed triggers
- `POST /api/webhooks/pipedream` - Receive events from Pipedream (all integrations)

### Database Schema
- `User` - User accounts with email/password
- `Tenant` - Organizations/tenants
- `Connection` - Pipedream Connect accounts (Intercom, Slack, Stripe, etc.). No direct third-party OAuth.
- `PipedreamTrigger` - Deployed triggers linking a connection to our webhook so we receive events.

### Pipedream Triggers (what they do in this app)

**Triggers** are the mechanism by which the app receives events from third-party apps (Intercom, Slack, Stripe, etc.) **only via Pipedream**—there is no direct connection to those services.

1. **List triggers** (`GET /api/pipedream/triggers`) – Returns available Pipedream trigger components (e.g. “new message in Slack”, “new Intercom conversation”) that can be deployed for a given app.
2. **Deploy trigger** (`POST /api/pipedream/triggers/deploy`) – For a given **Connection** (Pipedream account), deploys a trigger so that:
   - Pipedream listens for that event type (e.g. new Intercom conversation).
   - When the event occurs, Pipedream sends it to our **single webhook** `POST /api/webhooks/pipedream`.
3. **List deployed triggers** (`GET /api/pipedream/triggers/deployed`) – Returns triggers already deployed for the current tenant (per connection), with status (active/paused).
4. **Webhook** (`POST /api/webhooks/pipedream`) – Receives **all** events from **all** deployed triggers. The handler looks up the deployment ID to get tenant and provider, normalizes the payload, and forwards it to the Events Manager.

So in this application, **triggers** = “subscriptions” to event types per connection. Deploying a trigger is what turns a connected app (e.g. Intercom via Pipedream) into a live event stream into the platform, without the app ever calling Intercom (or any other provider) directly.

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
