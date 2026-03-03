//! Timeline Widgets
//!
//! Reusable widgets for the Rerun-inspired timeline visualization.
//! Ported from Rerun.io's re_time_panel patterns.

mod filter_panel;
mod playback;
mod rerun_time_panel;
#[cfg(feature = "native")]
mod streams_panel;
mod time_scrubber;
mod time_utils;

pub use filter_panel::{FilterPanel, FilterPanelResponse};
pub use playback::{LoopSelection, PlaybackSpeed};
pub use rerun_time_panel::{RerunTimePanel, RerunTimePanelConfig, RerunTimePanelResponse};
#[cfg(feature = "native")]
pub use streams_panel::{
    parse_hex_color, status_color, stream_color, RecordingState, StreamRowResponse, StreamsPanel,
    StreamsPanelResponse, STREAM_COLORS,
};
pub use time_scrubber::{TimeScrubber, TimeScrubberResponse};
pub use time_utils::TimeViewExt;

// Re-export domain stream types for convenience (native only)
#[cfg(feature = "native")]
pub use chronicle_domain::{Stream, StreamId, StreamKind, StreamStatus, StreamViewMode};

// Re-export timeline-core types
pub use chronicle_timeline_core::{
    format_duration, format_duration_precise, DisplayTimezone, PlaybackState, TimeView, TimelineTheme,
};
