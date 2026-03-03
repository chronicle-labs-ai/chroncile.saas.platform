//! Replay Session
//!
//! Manages playback of events with timing control.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};

use crate::{EventEnvelope, SubjectId, TenantId};

use super::state::ReplayState;
use super::types::{ReplayMode, ReplaySource};

/// A replay session manages playback of events
pub struct ReplaySession {
    /// Unique session identifier
    pub session_id: String,
    /// Tenant this replay belongs to
    pub tenant_id: TenantId,
    /// Subject being replayed
    pub subject: SubjectId,
    /// Playback mode
    pub mode: ReplayMode,
    /// Source of events (memory or bag file)
    pub source: ReplaySource,
    /// Current state
    pub state: ReplayState,
    /// When the session was created
    pub created_at: Instant,
}

impl ReplaySession {
    /// Create a new replay session in loading state
    pub fn new(
        session_id: impl Into<String>,
        tenant_id: impl Into<TenantId>,
        subject: impl Into<SubjectId>,
        mode: ReplayMode,
    ) -> Self {
        Self {
            session_id: session_id.into(),
            tenant_id: tenant_id.into(),
            subject: subject.into(),
            mode,
            source: ReplaySource::Memory,
            state: ReplayState::Loading { cursor: None },
            created_at: Instant::now(),
        }
    }

    /// Create a replay session that loads events from an MCAP bag file
    pub fn from_bag(
        session_id: impl Into<String>,
        tenant_id: impl Into<TenantId>,
        subject: impl Into<SubjectId>,
        mode: ReplayMode,
        bag_path: impl Into<PathBuf>,
    ) -> Self {
        Self {
            session_id: session_id.into(),
            tenant_id: tenant_id.into(),
            subject: subject.into(),
            mode,
            source: ReplaySource::Bag(bag_path.into()),
            state: ReplayState::Loading { cursor: None },
            created_at: Instant::now(),
        }
    }

    /// Load events into the session
    pub fn load_events(&mut self, events: Vec<EventEnvelope>) {
        if events.is_empty() {
            self.state = ReplayState::Completed;
        } else {
            self.state = ReplayState::Ready { events, index: 0 };
        }
    }

    /// Start playback
    pub fn start(&mut self) -> bool {
        match std::mem::replace(&mut self.state, ReplayState::Completed) {
            ReplayState::Ready { events, index } | ReplayState::Paused { events, index } => {
                if index >= events.len() {
                    self.state = ReplayState::Completed;
                    return false;
                }

                let last_occurred_at = events[index].occurred_at;
                self.state = ReplayState::Playing {
                    events,
                    index,
                    next_emit_at: Instant::now(),
                    last_occurred_at,
                };
                true
            }
            other => {
                self.state = other;
                false
            }
        }
    }

    /// Pause playback
    pub fn pause(&mut self) -> bool {
        match std::mem::replace(&mut self.state, ReplayState::Completed) {
            ReplayState::Playing { events, index, .. } => {
                self.state = ReplayState::Paused { events, index };
                true
            }
            other => {
                self.state = other;
                false
            }
        }
    }

    /// Get the next event without advancing (peek)
    pub fn peek(&self) -> Option<&EventEnvelope> {
        match &self.state {
            ReplayState::Ready { events, index }
            | ReplayState::Playing { events, index, .. }
            | ReplayState::Paused { events, index } => events.get(*index),
            _ => None,
        }
    }

    /// Check if it's time to emit the next event
    pub fn is_ready_to_emit(&self) -> bool {
        match &self.state {
            ReplayState::Playing { next_emit_at, .. } => Instant::now() >= *next_emit_at,
            _ => false,
        }
    }

    /// Get the duration until the next event should be emitted
    pub fn time_until_next(&self) -> Option<Duration> {
        match &self.state {
            ReplayState::Playing { next_emit_at, .. } => {
                let now = Instant::now();
                if now >= *next_emit_at {
                    Some(Duration::ZERO)
                } else {
                    Some(*next_emit_at - now)
                }
            }
            _ => None,
        }
    }

    /// Advance to the next event and return it
    ///
    /// In Step mode, this advances one event at a time.
    /// In other modes, call this after waiting for `time_until_next()`.
    pub fn advance(&mut self) -> Option<EventEnvelope> {
        match std::mem::replace(&mut self.state, ReplayState::Completed) {
            ReplayState::Playing {
                events,
                mut index,
                last_occurred_at,
                ..
            } => {
                if index >= events.len() {
                    self.state = ReplayState::Completed;
                    return None;
                }

                let event = events[index].clone();
                index += 1;

                if index >= events.len() {
                    self.state = ReplayState::Completed;
                } else {
                    let next_emit_at =
                        self.calculate_next_emit_time(last_occurred_at, events[index].occurred_at);
                    self.state = ReplayState::Playing {
                        events,
                        index,
                        next_emit_at,
                        last_occurred_at: event.occurred_at,
                    };
                }

                Some(event)
            }
            ReplayState::Ready { events, mut index } if self.mode == ReplayMode::Step => {
                if index >= events.len() {
                    self.state = ReplayState::Completed;
                    return None;
                }

                let event = events[index].clone();
                index += 1;

                if index >= events.len() {
                    self.state = ReplayState::Completed;
                } else {
                    self.state = ReplayState::Ready { events, index };
                }

                Some(event)
            }
            other => {
                self.state = other;
                None
            }
        }
    }

    /// Step forward one event (for Step mode)
    pub fn step(&mut self) -> Option<EventEnvelope> {
        if self.mode != ReplayMode::Step {
            return None;
        }
        self.advance()
    }

    /// Calculate when the next event should be emitted
    fn calculate_next_emit_time(
        &self,
        prev_occurred: DateTime<Utc>,
        next_occurred: DateTime<Utc>,
    ) -> Instant {
        match &self.mode {
            ReplayMode::Instant => Instant::now(),
            ReplayMode::Realtime => {
                let delta = next_occurred - prev_occurred;
                let duration = delta.to_std().unwrap_or(Duration::ZERO);
                Instant::now() + duration
            }
            ReplayMode::Accelerated { speed } => {
                let delta = next_occurred - prev_occurred;
                let duration = delta.to_std().unwrap_or(Duration::ZERO);
                let adjusted = duration.div_f32(*speed);
                Instant::now() + adjusted
            }
            ReplayMode::Step => Instant::now(), // Step mode doesn't use timing
        }
    }

    /// Set the replay to failed state
    pub fn fail(&mut self, reason: impl Into<String>) {
        self.state = ReplayState::Failed {
            reason: reason.into(),
        };
    }

    /// Get progress as a percentage (0.0 to 1.0)
    pub fn progress(&self) -> f32 {
        match &self.state {
            ReplayState::Ready { events, index }
            | ReplayState::Playing { events, index, .. }
            | ReplayState::Paused { events, index } => {
                if events.is_empty() {
                    1.0
                } else {
                    *index as f32 / events.len() as f32
                }
            }
            ReplayState::Completed => 1.0,
            _ => 0.0,
        }
    }
}

