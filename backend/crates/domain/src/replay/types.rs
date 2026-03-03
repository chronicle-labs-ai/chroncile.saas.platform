//! Replay Types
//!
//! Configuration types for replay sessions.

use std::path::PathBuf;

/// Replay playback modes
#[derive(Clone, Debug, PartialEq)]
#[derive(Default)]
pub enum ReplayMode {
    /// Emit events as fast as possible
    #[default]
    Instant,
    /// Match original timing between events
    Realtime,
    /// Speed up/slow down playback (e.g., 10x)
    Accelerated { speed: f32 },
    /// Manual advancement - one event per step
    Step,
}


/// Source of events for replay
#[derive(Clone, Debug)]
#[derive(Default)]
pub enum ReplaySource {
    /// Events loaded from memory store (default)
    #[default]
    Memory,
    /// Events loaded from an MCAP bag file
    Bag(PathBuf),
}


impl ReplaySource {
    /// Create a bag source from a path
    pub fn bag(path: impl Into<PathBuf>) -> Self {
        Self::Bag(path.into())
    }

    /// Check if this is a bag source
    pub fn is_bag(&self) -> bool {
        matches!(self, Self::Bag(_))
    }

    /// Get the bag path if this is a bag source
    pub fn bag_path(&self) -> Option<&PathBuf> {
        match self {
            Self::Bag(path) => Some(path),
            _ => None,
        }
    }
}

