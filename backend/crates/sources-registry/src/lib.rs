//! Sources Registry
//!
//! Compile-time registration and runtime discovery of source adapters.
//!
//! ## Usage
//!
//! Sources register themselves using the `inventory` crate:
//!
//! ```ignore
//! // In source-intercom/src/lib.rs
//! inventory::submit! {
//!     SourceRegistration::new(|| Box::new(IntercomAdapter::new()))
//! }
//! ```
//!
//! Then discover sources at runtime:
//!
//! ```ignore
//! use chronicle_sources_registry::{all_sources, get_source};
//!
//! // List all registered sources
//! for source in all_sources() {
//!     println!("Source: {}", source.manifest().name);
//! }
//!
//! // Get a specific source
//! if let Some(intercom) = get_source("intercom") {
//!     // Use the source...
//! }
//! ```

mod registry;

pub use registry::*;

