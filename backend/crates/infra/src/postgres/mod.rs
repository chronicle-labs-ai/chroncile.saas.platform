//! Postgres Backend Implementation
//!
//! Feature-gated Postgres storage backend using sqlx.

mod store;
pub mod repositories;

pub use store::PostgresStore;
pub use repositories::*;

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
