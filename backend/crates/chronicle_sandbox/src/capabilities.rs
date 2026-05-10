//! Capability flags describing what a sandbox driver can do.
//!
//! One `SandboxCapabilities` instance per driver, returned from
//! `Sandbox::capabilities()`. The orchestrator's pre-flight validators
//! read from this instead of asking the driver to fail mid-trial.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SandboxCapabilities {
    /// Whether the driver can allocate GPUs to sandboxes.
    pub gpus: bool,

    /// Whether the driver can run with internet disabled
    /// (`network_block_all` on Daytona, `--network none` on Docker).
    pub disable_internet: bool,

    /// Whether the driver supports running Windows containers.
    pub windows: bool,

    /// Whether sandbox log directories are mounted into the host
    /// filesystem (true for local Docker, false for cloud drivers).
    /// Affects whether the orchestrator downloads logs after the
    /// trial or reads them directly.
    pub mounted: bool,

    /// Whether the driver supports interactive shell attach
    /// (used by the CLI's `chronicle sandbox attach <id>`).
    pub attach: bool,
}

impl SandboxCapabilities {
    /// Conservative defaults: nothing supported. Drivers override with
    /// `Self { gpus: true, ... }` patterns.
    pub const fn none() -> Self {
        Self {
            gpus: false,
            disable_internet: false,
            windows: false,
            mounted: false,
            attach: false,
        }
    }
}

impl Default for SandboxCapabilities {
    fn default() -> Self {
        Self::none()
    }
}
