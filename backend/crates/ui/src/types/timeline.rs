//! Timeline Types (Ported from Rerun.io patterns)
//!
//! Types for timeline visualization including time-to-pixel mapping and event lanes.

use chrono::{DateTime, Duration, Utc};

/// How to group events in swim lanes
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum LaneGrouping {
    /// Group by event type category (Customer, Agent, Status, etc.)
    #[default]
    ByEventType,
    /// Group by source system (Intercom, Zendesk, Slack, etc.)
    BySource,
    /// Group by subject (each user/ticket gets a lane)
    BySubject,
    /// Group by actor
    ByActor,
}

impl LaneGrouping {
    pub fn label(&self) -> &'static str {
        match self {
            Self::ByEventType => "Event Type",
            Self::BySource => "Source",
            Self::BySubject => "Subject",
            Self::ByActor => "Actor",
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            Self::ByEventType,
            Self::BySource,
            Self::BySubject,
            Self::ByActor,
        ]
    }
}

/// Pixel-to-time mapping for timeline visualization.
/// Ported from Rerun's TimeRangesUi pattern.
#[derive(Clone, Debug)]
pub struct TimeRangeMapper {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub rect_width: f32,
}

impl TimeRangeMapper {
    /// Create a new time range mapper
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>, rect_width: f32) -> Self {
        Self {
            start,
            end,
            rect_width,
        }
    }

    /// Convert time to x pixel coordinate (Rerun pattern: x_from_time)
    pub fn x_from_time(&self, time: DateTime<Utc>) -> f32 {
        let total = (self.end - self.start).num_milliseconds() as f32;
        if total <= 0.0 {
            return 0.0;
        }
        let offset = (time - self.start).num_milliseconds() as f32;
        (offset / total) * self.rect_width
    }

    /// Convert x pixel coordinate to time (Rerun pattern: time_from_x)
    pub fn time_from_x(&self, x: f32) -> DateTime<Utc> {
        let t = (x / self.rect_width).clamp(0.0, 1.0);
        let duration_ms = (self.end - self.start).num_milliseconds();
        self.start + Duration::milliseconds((duration_ms as f32 * t) as i64)
    }

    /// Get the duration of the time range
    pub fn duration(&self) -> Duration {
        self.end - self.start
    }

    /// Check if a time falls within the range
    pub fn contains(&self, time: DateTime<Utc>) -> bool {
        time >= self.start && time <= self.end
    }
}

/// Event categorization for swim lanes.
/// Each lane represents a distinct event type category.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum EventLane {
    CustomerMessages,
    AgentMessages,
    InternalNotes,
    StatusChanges,
    Tickets,
    System,
}

impl EventLane {
    /// All lanes in display order
    pub fn all() -> Vec<Self> {
        vec![
            Self::CustomerMessages,
            Self::AgentMessages,
            Self::InternalNotes,
            Self::StatusChanges,
            Self::Tickets,
            Self::System,
        ]
    }

    /// Categorize an event type string into a lane
    pub fn from_event_type(event_type: &str) -> Self {
        let event_lower = event_type.to_lowercase();
        match event_lower.as_str() {
            // Customer messages
            t if t.contains("customer") && t.contains("message") => Self::CustomerMessages,
            t if t.contains("user") && t.contains("message") => Self::CustomerMessages,
            t if t.contains("message.customer") => Self::CustomerMessages,
            // Agent messages
            t if t.contains("admin") && t.contains("message") => Self::AgentMessages,
            t if t.contains("agent") && t.contains("message") => Self::AgentMessages,
            t if t.contains("message.agent") => Self::AgentMessages,
            t if t.contains("teammate") => Self::AgentMessages,
            // Internal notes
            t if t.contains("note") => Self::InternalNotes,
            t if t.contains("internal") => Self::InternalNotes,
            t if t.contains("comment") => Self::InternalNotes,
            // Status changes
            t if t.contains("status") => Self::StatusChanges,
            t if t.contains("state") => Self::StatusChanges,
            t if t.contains("assigned") => Self::StatusChanges,
            t if t.contains("closed") => Self::StatusChanges,
            t if t.contains("opened") => Self::StatusChanges,
            t if t.contains("snoozed") => Self::StatusChanges,
            // Tickets
            t if t.contains("ticket") => Self::Tickets,
            // Default to system
            _ => Self::System,
        }
    }

    /// Get the display label for this lane
    pub fn label(&self) -> &'static str {
        match self {
            Self::CustomerMessages => "Customer",
            Self::AgentMessages => "Agent",
            Self::InternalNotes => "Notes",
            Self::StatusChanges => "Status",
            Self::Tickets => "Tickets",
            Self::System => "System",
        }
    }

    /// Get the color for this lane
    pub fn color(&self) -> egui::Color32 {
        match self {
            Self::CustomerMessages => egui::Color32::from_rgb(52, 211, 153), // Emerald
            Self::AgentMessages => egui::Color32::from_rgb(96, 165, 250),    // Blue
            Self::InternalNotes => egui::Color32::from_rgb(251, 191, 36),    // Amber
            Self::StatusChanges => egui::Color32::from_rgb(167, 139, 250),   // Purple
            Self::Tickets => egui::Color32::from_rgb(236, 72, 153),          // Pink
            Self::System => egui::Color32::from_rgb(156, 163, 175),          // Gray
        }
    }
}
