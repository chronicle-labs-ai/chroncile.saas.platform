# Agent Warmup Platform

Agent Warmup Platform MVP - A platform to turn AI agents into production-ready systems.

## Project Structure

This is a monorepo using Yarn workspaces and Turbo:

```
agent-warmup-app/
├── apps/
│   └── frontend/          # Next.js frontend application
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
