# Chronicle Labs - Frontend

This is the Next.js frontend application for Chronicle Labs.

## Setup

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the `apps/frontend` directory with:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/agent_warmup?schema=public"
   
   # NextAuth
   AUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-base64-32"
   AUTH_TRUST_HOST=true
   
   # App URL (use your Vercel URL in production)
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   
   # Encryption key for storing tokens (32 bytes = 64 hex chars)
   ENCRYPTION_KEY="generate-with-openssl-rand-hex-32"
   
   # Pipedream (for integrations: Intercom, Slack, Stripe, etc.)
   PIPEDREAM_CLIENT_ID="your-pipedream-client-id"
   PIPEDREAM_CLIENT_SECRET="your-pipedream-client-secret"
   PIPEDREAM_PROJECT_ID="your-pipedream-project-id"
   
   # Events Manager
   EVENTS_MANAGER_URL="http://localhost:8080"
   ```

   To generate secrets:
   ```bash
   # Generate AUTH_SECRET
   openssl rand -base64 32
   
   # Generate ENCRYPTION_KEY (64 hex characters)
   openssl rand -hex 32
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

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
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
