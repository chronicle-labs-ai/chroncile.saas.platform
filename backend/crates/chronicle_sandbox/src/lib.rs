//! Sandbox abstraction + driver implementations for the Chronicle
//! backtest orchestrator.
//!
//! The crate's only purpose is to give the orchestrator (and the CLI)
//! a single contract — `Sandbox` — that hides the difference between:
//!
//! * `MockSandbox` — in-process echo, used for unit tests + CLI smoke.
//! * `DaytonaSandbox` — Daytona Cloud sandboxes (default for prod).
//! * (Future) `DockerSandbox`, `ModalSandbox`, etc.
//!
//! Modeled after Harbor's `BaseEnvironment` (see Harbor's
//! `src/harbor/environments/base.py`), recast in idiomatic
//! async-trait Rust. The trait is deliberately narrow — every
//! interaction between the orchestrator and the runtime flows through
//! `start`/`stop`/`exec`/upload/download, no escape hatches. New
//! drivers slot in by implementing the trait and adding a branch to
//! `factory::build`.

pub mod capabilities;
pub mod drivers;
pub mod error;
pub mod factory;
pub mod traits;
pub mod types;

pub use capabilities::SandboxCapabilities;
pub use drivers::{DaytonaConfig, DaytonaSandbox, ExecStub, MockSandbox};
pub use error::{SandboxError, SandboxErrorKind, SandboxResult};
pub use factory::{build, preflight};
pub use traits::Sandbox;
pub use types::{ExecRequest, ExecResult, ImageSource, ResourceLimits, SandboxId, StartOpts};
