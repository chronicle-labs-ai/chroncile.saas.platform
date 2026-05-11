//! Streams Panel Types
//!
//! UI-specific types for the streams panel. Domain types (StreamId, Stream, etc.)
//! are imported from chronicle-backend-domain.

use chrono::{DateTime, Utc};
use egui::Color32;

use chronicle_domain::StreamId;

use crate::design::colors;

/// Default stream colors (Color32 versions for egui)
pub const STREAM_COLORS: &[Color32] = &[
    Color32::from_rgb(0x00, 0xD4, 0xAA), // Teal (primary)
    Color32::from_rgb(0xFF, 0x6B, 0x6B), // Coral
    Color32::from_rgb(0x4E, 0xCD, 0xC4), // Turquoise
    Color32::from_rgb(0xFF, 0xE6, 0x6D), // Yellow
    Color32::from_rgb(0x95, 0xE1, 0xD3), // Mint
    Color32::from_rgb(0xF3, 0x81, 0x81), // Salmon
    Color32::from_rgb(0xAA, 0x96, 0xDA), // Lavender
    Color32::from_rgb(0xFC, 0xBA, 0xD3), // Pink
];

/// Get a color for a stream by index
pub fn stream_color(index: usize) -> Color32 {
    STREAM_COLORS[index % STREAM_COLORS.len()]
}

/// Parse a hex color string to Color32
pub fn parse_hex_color(hex: &str) -> Option<Color32> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some(Color32::from_rgb(r, g, b))
}

/// Get Color32 for a StreamStatus color key
pub fn status_color(color_key: &str) -> Color32 {
    match color_key {
        "status_online" => colors::STATUS_ONLINE,
        "status_offline" => colors::STATUS_OFFLINE,
        "text_muted" => colors::TEXT_MUTED,
        "signal_amber" => colors::SIGNAL_AMBER,
        "signal_red" => colors::SIGNAL_RED,
        "accent_teal" => colors::ACCENT_TEAL,
        _ => colors::TEXT_MUTED,
    }
}

/// Recording state for the streams panel
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum RecordingState {
    /// Not recording - showing stream selection
    #[default]
    Idle,
    /// Selecting which streams to record
    SelectingStreams,
    /// Recording events to buffer
    Recording {
        /// When recording started
        started_at: DateTime<Utc>,
        /// Number of events recorded
        event_count: usize,
        /// Streams being recorded
        recording_streams: Vec<StreamId>,
    },
    /// Recording finished, waiting for user to save
    PendingSave {
        /// Number of events recorded
        event_count: usize,
        /// Duration of recording
        duration_secs: i64,
        /// Streams that were recorded
        recorded_streams: Vec<StreamId>,
    },
}

impl RecordingState {
    pub fn is_recording(&self) -> bool {
        matches!(self, Self::Recording { .. })
    }

    pub fn is_pending_save(&self) -> bool {
        matches!(self, Self::PendingSave { .. })
    }

    pub fn is_selecting(&self) -> bool {
        matches!(self, Self::SelectingStreams)
    }

    pub fn event_count(&self) -> usize {
        match self {
            Self::Idle | Self::SelectingStreams => 0,
            Self::Recording { event_count, .. } => *event_count,
            Self::PendingSave { event_count, .. } => *event_count,
        }
    }

    pub fn recording_streams(&self) -> &[StreamId] {
        match self {
            Self::Recording {
                recording_streams, ..
            } => recording_streams,
            Self::PendingSave {
                recorded_streams, ..
            } => recorded_streams,
            _ => &[],
        }
    }
}

/// Response from the streams panel
#[derive(Default)]
pub struct StreamsPanelResponse {
    /// Stream was toggled (enabled/disabled)
    pub toggled_stream: Option<StreamId>,
    /// Request to add a new stream (e.g., load MCAP file)
    pub add_stream_requested: bool,
    /// Request to remove a stream
    pub remove_stream: Option<StreamId>,
    /// View mode was changed
    pub view_mode_changed: bool,
    /// Selected stream changed (for isolated view)
    pub selected_stream_changed: Option<StreamId>,
    /// Recording was started (includes which streams are being recorded)
    pub recording_started: Option<Vec<StreamId>>,
    /// Recording was stopped and is pending save
    pub recording_stopped: bool,
    /// User requested to save the recording
    pub save_recording_requested: bool,
    /// User cancelled saving (discard recording)
    pub discard_recording_requested: bool,
}

/// Response from rendering a stream row
#[derive(Default)]
pub struct StreamRowResponse {
    pub toggled: bool,
    pub selected: bool,
    pub remove_requested: bool,
}
