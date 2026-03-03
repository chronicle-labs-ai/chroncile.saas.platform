//! Events Manager Domain Layer
//!
//! Pure business logic with zero vendor dependencies.
//! This crate contains the core types and logic for the event system.

pub mod api_types;
pub mod envelope;
pub mod error;
pub mod ids;
pub mod ordering;
pub mod recording;
pub mod replay;
pub mod saas;
pub mod stream;
pub mod stream_manager;
pub mod tenant;

#[cfg(test)]
pub mod test_utils;

pub use api_types::*;
pub use envelope::*;
pub use error::*;
pub use ids::*;
pub use ordering::*;
pub use recording::*;
pub use replay::*;
pub use saas::*;
pub use stream::*;
pub use stream_manager::*;
pub use tenant::*;
