# Agent Warmup Platform - Frontend

This is the Next.js frontend application for the Agent Warmup Platform MVP.

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
   
   # Intercom OAuth
   INTERCOM_CLIENT_ID="your-intercom-client-id"
   INTERCOM_CLIENT_SECRET="your-intercom-client-secret"
   
   # Encryption key for storing tokens (32 bytes = 64 hex chars)
   ENCRYPTION_KEY="generate-with-openssl-rand-hex-32"
   
   # Intercom Webhook (optional - for signature verification)
   INTERCOM_WEBHOOK_SECRET="your-intercom-webhook-secret"
   
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
- ✅ Intercom OAuth flow
- ✅ Token encryption for secure storage
- ✅ Connection management UI
- ✅ Workspace info retrieval

### Webhooks & Events
- ✅ Intercom webhook receiver with signature verification
- ✅ Tenant lookup by Intercom workspace_id (app_id)
- ✅ Event forwarding to Events Manager
- ✅ Events timeline UI with real-time refresh

### Pages
- `/login` - Login page
- `/signup` - Signup page with organization creation
- `/dashboard` - Protected dashboard home
- `/dashboard/events` - Events timeline (shows events from Events Manager)
- `/dashboard/connections` - Integration management with Intercom OAuth
- `/dashboard/settings` - Account and organization settings

### API Endpoints
- `POST /api/auth/signup` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET /api/connections/intercom/authorize` - Start Intercom OAuth
- `GET /api/connections/intercom/callback` - Intercom OAuth callback
- `POST /api/webhooks/intercom` - Receive Intercom webhooks

### Database Schema
- `User` - User accounts with email/password
- `Tenant` - Organizations/tenants
- `Connection` - OAuth connections to external services (Intercom, etc.)

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
