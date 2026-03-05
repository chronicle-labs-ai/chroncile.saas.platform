# Chronicle Labs Platform

A platform to turn AI agents into production-ready systems.

## Project Structure

This is a monorepo using Yarn workspaces and Turbo:

```
chronicle-platform/
├── apps/
│   └── frontend/          # Next.js frontend application
├── backend/               # Rust/Axum backend
├── packages/
│   └── shared/            # Shared types and utilities
├── package.json           # Root package.json with workspaces
└── turbo.json            # Turbo configuration
```

## Getting Started

### Prerequisites

- Node.js >= 20.14.0
- Yarn 4.7.0

### Installation

```bash
# Install dependencies
yarn install
```

### Development

```bash
# Run all apps in development mode
yarn dev

# Run only frontend
yarn dev:frontend
```

**Optional: Doppler (secrets from dashboard)**  
For env vars, run once from repo root: `doppler login` and `doppler setup --no-interactive`, then start apps with secrets injected:

- Frontend: `cd apps/frontend && doppler run -- yarn dev`
- Backend: `cd backend && doppler run -- cargo run --bin chronicle-backend`
- Env-manager: `cd apps/env-manager && doppler run -- yarn dev`

### Build

```bash
# Build all apps
yarn build

# Build only frontend
yarn build:frontend
```

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- React 19

### Backend (to be added)
- Node.js + TypeScript
- Fastify
- Prisma
- Supabase (PostgreSQL)
- Redis + BullMQ

## Documentation

- [Product Summary](./PRODUCT_SUMMARY.md)
- [Architecture Diagrams](./ARCHITECTURE_DIAGRAM.md)
- [FigJam Diagrams Index](./FIGJAM_DIAGRAMS_INDEX.md)

## License

Private
