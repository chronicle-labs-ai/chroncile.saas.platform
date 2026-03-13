//! Helix-backed event graph store.
//!
//! Canonical event rows, schemas, and subscriptions stay in Postgres during
//! phase 1 while Helix mirrors entity refs, links, embeddings, raw payloads,
//! typed payload nodes, and traces for graph/vector workloads.

mod store;

pub use chronicle_store::helix::{
    AnthropicLinkDecisionConfig, AnthropicLinkDecisionModel, DeterministicTextEmbedder,
    HelixConnectionConfig, HelixLinkingPipeline, HelixTraceOodService, LinkDecisionModel,
    TextEmbedder, TraceDocument,
};
pub use store::HelixStore;
