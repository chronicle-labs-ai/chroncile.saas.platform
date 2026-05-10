//! Events Manager Domain Layer
//!
//! Pure business logic with zero vendor dependencies.
//! This crate contains the core types and logic for the event system.

pub mod agents;
pub mod api_types;
pub mod backtests;
pub mod chronicle;
pub mod connections;
pub mod datasets;
pub mod envelope;
pub mod error;
pub mod feature_access;
pub mod ids;
pub mod ordering;
pub mod recording;
pub mod replay;
pub mod saas;
pub mod sandbox_graph;
pub mod stream;
pub mod stream_manager;
pub mod tenant;
pub mod timeline;

#[cfg(test)]
pub mod test_utils;

pub use agents::*;
pub use api_types::*;
pub use backtests::*;
pub use chronicle::*;
pub use connections::{
    Connection as DashboardConnection,
    ConnectionBackfillRecord,
    ConnectionBackfillStatus,
    ConnectionDelivery,
    ConnectionEventTypeSub,
    ConnectionHealth,
    ConnectionTestStatus,
    ConnectorErrorKind,
};
pub use datasets::*;
pub use envelope::*;
pub use error::*;
pub use feature_access::*;
pub use ids::*;
pub use ordering::*;
pub use recording::*;
pub use replay::*;
pub use saas::*;
pub use sandbox_graph::*;
pub use stream::*;
pub use stream_manager::*;
pub use tenant::*;
pub use timeline::*;
