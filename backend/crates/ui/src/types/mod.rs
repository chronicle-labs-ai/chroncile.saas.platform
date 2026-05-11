//! UI Types
//!
//! Local DTOs for the UI - no internal crate dependencies.
//! These mirror the API response types.

mod api_types;
mod event;
mod sources;
mod time_window;
mod timeline;

// Re-export all types for backwards compatibility
pub use api_types::{
    ConnectionDto, EventsQueryResponse, GenerateResponse, HealthDto, ReplaySessionDto,
    ReplayStatusDto, ScenarioDto, TimelineDto,
};
pub use event::{EventDto, EventFilter};
pub use sources::{
    EventTypeMeta, ListSourcesResponse, SourceCapabilities, SourceCatalogResponse, SourceSummary,
};
pub use time_window::{EventQuery, TimeWindow, TimeWindowPreset};
pub use timeline::{EventLane, LaneGrouping, TimeRangeMapper};

// Re-export timeline-core types for convenience
pub use chronicle_timeline_core::{
    event_path_color, format_duration, format_duration_precise, source_color, DisplayTimezone,
    PlaybackState, TimeView, TimelineEventData, TimelinePanel, TimelinePanelConfig,
    TimelinePanelResponse, TimelineTheme, TopicPath, TopicTree, TopicTreeNode,
};
