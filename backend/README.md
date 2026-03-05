# Events Manager

A high-performance, multi-tenant event capture and replay system built in Rust.

## Overview

Events Manager is an enterprise-grade event system that:

- **Captures** events from multiple sources (support systems, CRMs, chat, etc.)
- **Stores** them in an immutable, append-only log
- **Streams** events in real-time via SSE
- **Replays** events deterministically for debugging, training, and evaluation

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Connectors    │────▶│   Ingestion     │────▶│   Event Bus     │
│ (Mock/Zendesk)  │     │   Gateway       │     │ (Memory/Kafka)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web/egui UI   │◀────│   Query API     │◀────│   Event Store   │
│ (Timeline View) │     │  (SSE Stream)   │     │ (Memory/PG)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Enum dispatch over `dyn Trait` | Avoids vtable overhead, enables inlining |
| `Box<RawValue>` for payload | Zero-copy JSON storage, lazy parsing |
| `broadcast` channels | Push-based streaming, no polling |
| Thread-local ULID generators | Avoids contention under high concurrency |
| Feature-gated backends | Fast compile times, optional heavy deps |

---

## Environment Setup

### Prerequisites

- **Rust 1.75+** (via rustup - recommended)
- Docker + Docker Compose (optional, for real backends)

### Fixing PATH Issues (macOS)

If you have both Homebrew Rust and rustup installed, rustup should take precedence.
Add this to your `~/.zshrc` (or `~/.bashrc`):

```bash
# Ensure rustup takes precedence over Homebrew
export PATH="$HOME/.cargo/bin:$PATH"
```

Then reload your shell:

```bash
source ~/.zshrc
```

Verify with:

```bash
which cargo
# Should output: /Users/<you>/.cargo/bin/cargo

cargo --version
# Should output: cargo 1.8x.x or higher
```

### For WebAssembly Development

```bash
# Install the wasm32 target
rustup target add wasm32-unknown-unknown

# Install wasm-bindgen CLI (for JS bindings)
cargo install wasm-bindgen-cli
```

---

## Quick Start

### Development Mode (In-Memory)

```bash
# From repo root, enter backend
cd backend

# Option A — Doppler (if your team uses it): run once from root: doppler setup --no-interactive
doppler run -- cargo run --bin chronicle-backend

# Option B — Local .env
cp env.example .env
cargo run --bin chronicle-backend
```

### Running the Native egui UI

```bash
# In another terminal
cargo run --bin events-manager-ui
```

### Running the egui Web UI (WebAssembly)

```bash
# Build for wasm
cd crates/ui
chmod +x build-web.sh
./build-web.sh

# Serve the web UI
cd web
python3 -m http.server 8080

# Open browser
open http://localhost:8080?api_url=http://localhost:3000
```

### Production Mode (Kafka + Postgres)

```bash
# Start infrastructure
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Run with real backends
BACKEND_MODE=real cargo run --bin events-manager --features full
```

---

## Project Structure

```
events-manager/
├── crates/
│   ├── domain/          # Pure business logic (no vendor deps)
│   ├── interfaces/      # Trait definitions + enum dispatch
│   ├── infra/           # Vendor implementations (feature-gated)
│   ├── mock-connector/  # Mock OAuth + event generation
│   ├── api/             # HTTP API (axum)
│   └── ui/              # Desktop + Web UI (egui/wgpu)
├── bin/server/          # Main server binary
├── ui/                  # Static web UI (HTML/CSS/JS)
└── docker-compose.yml   # Kafka + Postgres for production
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/connections` | Create OAuth connection |
| GET | `/api/connections` | List connections |
| DELETE | `/api/connections/:id` | Delete connection |
| POST | `/api/connections/:id/generate` | Generate test events |
| GET | `/api/scenarios` | List available scenarios |
| POST | `/api/scenarios/:name/load` | Load a scenario |
| POST | `/api/ingest` | Ingest an event |
| GET | `/api/stream` | SSE event stream |
| GET | `/api/conversations/:id/timeline` | Get conversation timeline |
| POST | `/api/replay` | Create replay session |
| GET | `/api/replay/:id/stream` | SSE replay stream |

---

## Usage Examples

### Create a Connection and Generate Events

```bash
# Create a mock Zendesk connection
curl -X POST http://localhost:3000/api/connections \
  -H "Content-Type: application/json" \
  -d '{"service": "mock-zendesk", "name": "Demo Connection"}'

# Generate some events
curl -X POST http://localhost:3000/api/connections/{connection_id}/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 20}'
```

### Load a Pre-built Scenario

```bash
# List scenarios
curl http://localhost:3000/api/scenarios

# Load the refund scenario
curl -X POST http://localhost:3000/api/scenarios/refund_request/load
```

### Stream Events (SSE)

```bash
# Stream all events
curl -N http://localhost:3000/api/stream

# Stream with filter
curl -N "http://localhost:3000/api/stream?conversation_id=conv_demo_1"
```

### Replay a Conversation

```bash
# Create replay session
curl -X POST http://localhost:3000/api/replay \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "conv_refund_001", "mode": "accelerated", "speed": 10}'

# Stream the replay
curl -N http://localhost:3000/api/replay/{session_id}/stream
```

---

## Feature Flags

```bash
# Default (memory only - fast compilation)
cargo build

# With Kafka support
cargo build --features kafka

# With Postgres support
cargo build --features postgres

# Full (all backends)
cargo build --features full
```

---

## Testing

```bash
# Run all tests
cargo test

# Run with property-based tests (slower but thorough)
cargo test --release

# Run specific test module
cargo test --package events-manager-domain ordering
```

---

## Configuration

See `env.example` for all configuration options:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_MODE` | `memory` | Backend type: `memory` or `real` |
| `API_HOST` | `127.0.0.1` | Server bind address |
| `API_PORT` | `3000` | Server port |
| `STREAM_CHANNEL_CAPACITY` | `10000` | Broadcast channel size |
| `KAFKA_BROKERS` | `localhost:9092` | Kafka broker addresses |
| `DATABASE_URL` | - | Postgres connection string |

---

## Event Envelope Schema

Every event follows this envelope:

```json
{
  "event_id": "01HXYZ...",
  "tenant_id": "tenant_123",
  "source": "zendesk",
  "source_event_id": "zd_evt_456",
  "event_type": "support.message.customer",
  "subject": {
    "conversation_id": "conv_789",
    "ticket_id": "ticket_123",
    "customer_id": "cust_456"
  },
  "actor": {
    "actor_type": "customer",
    "actor_id": "cust_456",
    "display_name": "Jane Doe"
  },
  "occurred_at": "2024-01-15T10:30:00Z",
  "ingested_at": "2024-01-15T10:30:01Z",
  "schema_version": 1,
  "payload": { "text": "I need help with..." },
  "pii": { "contains_pii": true, "fields": ["payload.text"] },
  "permissions": { "visibility": "support", "roles": ["agent"] }
}
```

---

## Replay Modes

| Mode | Description |
|------|-------------|
| `instant` | Emit all events as fast as possible |
| `realtime` | Match original timing between events |
| `accelerated` | Speed up playback (e.g., 10x) |
| `step` | Manual advancement via API |

---

## UIs Available

### 1. Web UI (Static HTML/CSS/JS)
- **Location**: Served from `/` on the API server
- **Access**: `http://localhost:3000`
- **Features**: Full-featured, "Digital Observatory" dark theme

### 2. Native egui UI
- **Location**: `crates/ui`
- **Run**: `cargo run --bin events-manager-ui`
- **Features**: Desktop application, fast native rendering

### 3. egui WebAssembly UI
- **Location**: `crates/ui/web/`
- **Build**: `cd crates/ui && ./build-web.sh`
- **Run**: `cd crates/ui/web && python3 -m http.server 8080`
- **Access**: `http://localhost:8080?api_url=http://localhost:3000`
- **Features**: Same as native egui, runs in browser via wgpu/WebGL

---

## License

MIT
