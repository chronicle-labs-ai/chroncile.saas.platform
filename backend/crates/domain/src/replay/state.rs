//! Replay State Machine
//!
//! State machine states for replay sessions.

use std::time::Instant;

use chrono::{DateTime, Utc};
use ulid::Ulid;

use crate::EventEnvelope;

/// State machine states for replay sessions
#[derive(Debug)]
pub enum ReplayState {
    /// Initial state - loading events from store
    Loading { cursor: Option<Ulid> },
    /// Events loaded, ready to begin playback
    Ready {
        events: Vec<EventEnvelope>,
        index: usize,
    },
    /// Actively emitting events
    Playing {
        events: Vec<EventEnvelope>,
        index: usize,
        next_emit_at: Instant,
        last_occurred_at: DateTime<Utc>,
    },
    /// Paused mid-replay
    Paused {
        events: Vec<EventEnvelope>,
        index: usize,
    },
    /// All events have been emitted
    Completed,
    /// An error occurred
    Failed { reason: String },
}

impl ReplayState {
    /// Get the current index into the events list
    pub fn current_index(&self) -> Option<usize> {
        match self {
            Self::Ready { index, .. }
            | Self::Playing { index, .. }
            | Self::Paused { index, .. } => Some(*index),
            _ => None,
        }
    }

    /// Get the total number of events
    pub fn total_events(&self) -> Option<usize> {
        match self {
            Self::Ready { events, .. }
            | Self::Playing { events, .. }
            | Self::Paused { events, .. } => Some(events.len()),
            _ => None,
        }
    }

    /// Check if replay is complete
    pub fn is_completed(&self) -> bool {
        matches!(self, Self::Completed)
    }

    /// Check if replay failed
    pub fn is_failed(&self) -> bool {
        matches!(self, Self::Failed { .. })
    }

    /// Get state name for logging/display
    pub fn name(&self) -> &'static str {
        match self {
            Self::Loading { .. } => "loading",
            Self::Ready { .. } => "ready",
            Self::Playing { .. } => "playing",
            Self::Paused { .. } => "paused",
            Self::Completed => "completed",
            Self::Failed { .. } => "failed",
        }
    }
}
