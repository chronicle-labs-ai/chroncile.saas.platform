# Development Status

## Synopsis for Next Agent

This document summarizes the current state of the Events Manager project and outlines remaining work.

---

## ✅ Completed Work

### Core Architecture
- [x] **Workspace structure** with 6 crates: `domain`, `interfaces`, `infra`, `mock-connector`, `api`, `ui`
- [x] **Enum dispatch pattern** for backends (no vtable overhead)
- [x] **Zero-copy JSON payloads** via `Box<RawValue>`
- [x] **Push-based streaming** via `tokio::sync::broadcast`
- [x] **Thread-local ULID generation** for event IDs
- [x] **Feature-gated backends** (`memory`, `kafka`, `postgres`, `full`)
- [x] **Error hierarchy** with `thiserror`

### Domain Layer (`crates/domain`)
- [x] `EventEnvelope` with proper serialization
- [x] `TenantId`, `SubjectId` newtypes
- [x] Deterministic ordering for replay (`sort_for_replay`)
- [x] Replay state machine (`ReplaySession`, `ReplayState`, `ReplayMode`)
- [x] Error types (`EventsError`)
- [x] Property-based test utilities (`arb_event_envelope`)

### Interfaces Layer (`crates/interfaces`)
- [x] `StreamBackend` enum with `Memory` and `Kafka` variants
- [x] `StoreBackend` enum with `Memory` and `Postgres` variants
- [x] `Clock` trait with `SystemClock` and `SimulatedClock`
- [x] Async trait implementations

### Infrastructure Layer (`crates/infra`)
- [x] **In-memory stream** with broadcast channels
- [x] **In-memory store** with `DashMap`
- [x] Placeholder Kafka producer/consumer (feature-gated)
- [x] Placeholder Postgres store (feature-gated)
- [x] SQL migrations for events table

### Mock Connector (`crates/mock-connector`)
- [x] OAuth flow simulation
- [x] Realistic event generation
- [x] Pre-built scenarios:
  - `refund_request` - Customer refund flow
  - `escalation` - Escalation to manager
  - `simple_inquiry` - Quick question/answer
  - `multi_channel` - Cross-channel conversation
  - `ai_assisted` - AI copilot suggestions

### API Layer (`crates/api`)
- [x] Axum HTTP server with CORS
- [x] Health check endpoint
- [x] Connection management (CRUD)
- [x] Event generation endpoints
- [x] Scenario loading
- [x] SSE streaming (`/api/stream`)
- [x] Timeline endpoint (`/api/conversations/:id/timeline`)
- [x] Replay session management
- [x] Replay SSE stream (`/api/replay/:id/stream`)
- [x] Static file serving for web UI

### Web UI (`ui/index.html`)
- [x] "Digital Observatory" dark theme
- [x] Live Stream tab with real-time events
- [x] Timeline tab with conversation loader
- [x] Connections tab for managing mock connections
- [x] Event detail panel with JSON viewer
- [x] Filter controls
- [x] Toast notifications
- [x] Responsive layout
- [x] SSE integration

### Native egui UI (`crates/ui`)
- [x] Dark observatory theme matching web UI
- [x] Live Stream view with filtering
- [x] Timeline view with event details
- [x] Connections view with scenarios
- [x] Toast notification system
- [x] SSE integration via `eventsource-client`
- [x] Event selection and detail panel

### egui WebAssembly Support (`crates/ui/web`)
- [x] wgpu backend for WebGL rendering
- [x] Platform-conditional code (`cfg(target_arch = "wasm32")`)
- [x] Web-specific dependencies (`gloo-net`, `wasm-bindgen`, etc.)
- [x] SSE via `gloo_net::eventsource`
- [x] HTTP via `gloo_net::http`
- [x] Build script (`build-web.sh`)
- [x] HTML wrapper with loading screen
- [x] API URL configuration via query param

### Infrastructure
- [x] `deploy/docker-compose.yml` for Kafka + Postgres
- [x] Environment configuration (`env.example`)
- [x] README documentation

---

## 🚧 Known Issues / Bugs

1. **egui Web SSE may not reconnect** after network interruption
2. **Timeline in egui Web** - async result handling may have edge cases

### Recently Fixed

- ✅ **macOS objc2 crash** - Fixed by updating eframe 0.28 → 0.29
- ✅ **"no reactor running" panic** - Fixed by using `std::thread` with dedicated tokio runtime for SSE
- ✅ **Quick timeline buttons flickering** - Fixed by sorting conversation IDs

---

## 📋 Remaining Work (Next Agent)

### High Priority

1. **Kafka Backend Implementation**
   - `crates/infra/src/kafka/producer.rs` - Complete `publish()` method
   - `crates/infra/src/kafka/consumer.rs` - Complete consumer loop
   - Wire up to `StreamBackend::Kafka` variant

2. **Postgres Backend Implementation**
   - `crates/infra/src/postgres/store.rs` - Implement all store methods
   - Run migrations on startup
   - Wire up to `StoreBackend::Postgres` variant

3. **Replay Engine Polish**
   - Full `ReplaySession::tick()` implementation with timing
   - Step mode support
   - Pause/resume via API

4. **Property-Based Tests**
   - Complete `crates/domain/tests/ordering_tests.rs`
   - Add proptest to CI

### Medium Priority

5. **Multi-Tenancy**
   - Add tenant middleware to API
   - Tenant isolation in store queries
   - Tenant-scoped SSE streams

6. **PII Handling**
   - Field-level redaction for sensitive data
   - Audit logging

7. **Batch Ingestion**
   - Implement batched writes with backpressure
   - Configurable batch size/timeout

### Low Priority

8. **Real OAuth Connectors**
   - Zendesk webhook integration
   - Salesforce event relay
   - Slack events API

9. **Observability**
   - Expand beyond the current Sentry error monitoring, logs, request tracing, and Postgres query span baseline
   - OpenTelemetry tracing
   - Prometheus metrics

10. **Production Hardening**
    - Rate limiting
    - Authentication
    - TLS termination

---

## Development Commands

```bash
# Build everything
cargo build

# Run server (in-memory)
cargo run --bin events-manager

# Run native UI
cargo run --bin events-manager-ui

# Build wasm UI
cd crates/ui && ./build-web.sh

# Serve wasm UI
cd crates/ui/web && python3 -m http.server 8080

# Run tests
cargo test

# Build with all backends
cargo build --features full

# Start Kafka/Postgres
docker compose -f deploy/docker-compose.yml up -d
```

### Quick Start (Both Server + Web UI)

```bash
# Terminal 1: Start server
cargo run --bin events-manager

# Browser: Open web UI
open http://localhost:3000

# Terminal 2 (optional): Start native UI
cargo run --bin events-manager-ui
```

### Environment Setup

If `cargo` commands fail with "command not found" or use wrong version:

```bash
# Add to ~/.zshrc
export PATH="$HOME/.cargo/bin:$PATH"

# Then reload
source ~/.zshrc

# Verify
which cargo  # Should show ~/.cargo/bin/cargo
```

---

## File Quick Reference

| File | Purpose |
|------|---------|
| `crates/domain/src/envelope.rs` | Event envelope structure |
| `crates/domain/src/replay.rs` | Replay state machine |
| `crates/interfaces/src/streaming.rs` | Stream backend enum |
| `crates/interfaces/src/storage.rs` | Store backend enum |
| `crates/infra/src/memory/stream.rs` | In-memory broadcast stream |
| `crates/infra/src/memory/store.rs` | In-memory DashMap store |
| `crates/api/src/routes/stream.rs` | SSE endpoint |
| `crates/api/src/routes/replay.rs` | Replay API |
| `crates/ui/src/app.rs` | egui application |
| `crates/ui/src/client.rs` | API client (native + web) |
| `ui/index.html` | Static web UI |

---

## Architecture Notes

### Why Enum Dispatch?

```rust
// We use this:
pub enum StreamBackend {
    Memory(MemoryStreamHandle),
    #[cfg(feature = "kafka")]
    Kafka(KafkaStreamHandle),
}

// Instead of:
pub trait StreamProducer { ... }
Box<dyn StreamProducer>  // vtable overhead
```

Benefits:
- Inlining possible
- No vtable lookup
- Compile-time known backends
- Feature flags disable unused code

### Zero-Copy Payloads

```rust
pub struct EventEnvelope {
    // Raw JSON bytes - no parsing on ingest
    pub payload: Box<RawValue>,
}

// Parse lazily when needed
let typed: MyPayload = event.payload_as()?;
```

### Push-Based Streaming

```rust
// Broadcast channel - true push, no polling
let (tx, _) = broadcast::channel(10_000);

// Subscribers get pushed events
let mut rx = tx.subscribe();
while let Ok(event) = rx.recv().await {
    // Process event
}
```

---

*Last updated: 2026-01-10*
