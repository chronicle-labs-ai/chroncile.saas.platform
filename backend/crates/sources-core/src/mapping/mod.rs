//! Field Mapping
//!
//! Declarative JSON-to-EventEnvelope transformation system.

mod extractors;
pub mod field_mapper;

pub use extractors::*;
pub use field_mapper::*;
