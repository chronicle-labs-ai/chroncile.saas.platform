//! Time Window Types
//!
//! Types for time-based filtering and querying of events.

use chrono::{DateTime, Duration, Utc};
use std::collections::HashSet;

use super::event::EventDto;

/// Time window for timeline queries
#[derive(Clone, Debug)]
pub struct TimeWindow {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl TimeWindow {
    /// Create a custom time window
    pub fn custom(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    /// Last hour from now
    pub fn last_hour() -> Self {
        let now = Utc::now();
        Self {
            start: now - Duration::hours(1),
            end: now,
        }
    }

    /// Last 24 hours from now
    pub fn last_24_hours() -> Self {
        let now = Utc::now();
        Self {
            start: now - Duration::hours(24),
            end: now,
        }
    }

    /// Today (from midnight UTC)
    pub fn today() -> Self {
        let now = Utc::now();
        let start = now.date_naive().and_hms_opt(0, 0, 0).unwrap();
        Self {
            start: DateTime::from_naive_utc_and_offset(start, Utc),
            end: now,
        }
    }

    /// Duration of this time window
    pub fn duration(&self) -> Duration {
        self.end - self.start
    }

    /// Check if a time falls within this window
    pub fn contains(&self, time: DateTime<Utc>) -> bool {
        time >= self.start && time <= self.end
    }
}

impl Default for TimeWindow {
    fn default() -> Self {
        Self::last_hour()
    }
}

/// Preset time window options for UI
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum TimeWindowPreset {
    #[default]
    LastHour,
    Last6Hours,
    Last24Hours,
    Today,
    Custom,
}

impl TimeWindowPreset {
    pub fn label(&self) -> &'static str {
        match self {
            Self::LastHour => "Last Hour",
            Self::Last6Hours => "Last 6 Hours",
            Self::Last24Hours => "Last 24 Hours",
            Self::Today => "Today",
            Self::Custom => "Custom",
        }
    }

    pub fn to_time_window(&self) -> TimeWindow {
        match self {
            Self::LastHour => TimeWindow::last_hour(),
            Self::Last6Hours => {
                let now = Utc::now();
                TimeWindow::custom(now - Duration::hours(6), now)
            }
            Self::Last24Hours => TimeWindow::last_24_hours(),
            Self::Today => TimeWindow::today(),
            Self::Custom => TimeWindow::last_hour(), // Default fallback
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            Self::LastHour,
            Self::Last6Hours,
            Self::Last24Hours,
            Self::Today,
        ]
    }
}

/// Advanced event query with multiple filters
#[derive(Clone, Debug, Default)]
pub struct EventQuery {
    /// Time window filter
    pub time_window: Option<TimeWindow>,
    /// Filter by sources (e.g., "intercom", "zendesk")
    pub sources: HashSet<String>,
    /// Filter by event types (e.g., "ticket.created", "message.sent")
    pub event_types: HashSet<String>,
    /// Filter by actor IDs
    pub actors: HashSet<String>,
    /// Filter by subject IDs (user ID, ticket ID, etc.)
    pub subjects: HashSet<String>,
    /// Maximum number of events to return
    pub limit: Option<usize>,
}

impl EventQuery {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_time_window(mut self, window: TimeWindow) -> Self {
        self.time_window = Some(window);
        self
    }

    pub fn with_sources(mut self, sources: impl IntoIterator<Item = String>) -> Self {
        self.sources = sources.into_iter().collect();
        self
    }

    pub fn with_event_types(mut self, types: impl IntoIterator<Item = String>) -> Self {
        self.event_types = types.into_iter().collect();
        self
    }

    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Check if an event matches this query
    pub fn matches(&self, event: &EventDto) -> bool {
        // Time window filter
        if let Some(ref window) = self.time_window {
            if !window.contains(event.occurred_at) {
                return false;
            }
        }

        // Source filter
        if !self.sources.is_empty() && !self.sources.contains(&event.source) {
            return false;
        }

        // Event type filter
        if !self.event_types.is_empty() && !self.event_types.contains(&event.event_type) {
            return false;
        }

        // Actor filter
        if !self.actors.is_empty() && !self.actors.contains(&event.actor_id) {
            return false;
        }

        // Subject filter (conversation_id serves as subject)
        if !self.subjects.is_empty() && !self.subjects.contains(&event.conversation_id) {
            return false;
        }

        true
    }

    /// Build query string parameters for API request
    pub fn to_query_params(&self) -> Vec<(String, String)> {
        let mut params = Vec::new();

        if let Some(ref window) = self.time_window {
            params.push(("start".to_string(), window.start.to_rfc3339()));
            params.push(("end".to_string(), window.end.to_rfc3339()));
        }

        for source in &self.sources {
            params.push(("source".to_string(), source.clone()));
        }

        for event_type in &self.event_types {
            params.push(("event_type".to_string(), event_type.clone()));
        }

        for actor in &self.actors {
            params.push(("actor".to_string(), actor.clone()));
        }

        for subject in &self.subjects {
            params.push(("subject".to_string(), subject.clone()));
        }

        if let Some(limit) = self.limit {
            params.push(("limit".to_string(), limit.to_string()));
        }

        params
    }
}

