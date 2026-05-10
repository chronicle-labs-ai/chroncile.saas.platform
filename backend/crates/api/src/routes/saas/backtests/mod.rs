//! `/api/platform/backtests/*` HTTP surface.
//!
//! Wired into the protected SaaS router slice in `saas/mod.rs`.

pub mod availability;
pub mod mappers;
pub mod recipe_builder;
pub mod routes;
pub mod service;
pub mod sse;
pub mod trace_projector;

pub use availability::{dev_fixtures, get_availability};
pub use service::{
    build_default_service, ActiveJobInfo, BacktestService, BacktestsAvailabilityData,
    CreateJobParams, JobCaseInput,
};
