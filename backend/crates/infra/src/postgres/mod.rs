//! Postgres Backend Implementation
//!
//! Feature-gated Postgres storage backend using sqlx.

pub mod feature_flag_repositories;
pub mod repositories;
mod store;

pub use feature_flag_repositories::*;
pub use repositories::*;
pub use store::PostgresStore;

/// Postgres-specific errors
#[derive(Debug, thiserror::Error)]
pub enum PostgresError {
    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Query error: {0}")]
    Query(String),

    #[error("Migration error: {0}")]
    Migration(String),
}
