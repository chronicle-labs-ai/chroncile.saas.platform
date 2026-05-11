//! Stream Types
//!
//! A Stream represents an input channel that delivers events. Multiple streams
//! can be active simultaneously (e.g., live API + MCAP playback), and events
//! from different streams can be mixed or viewed in isolation.
//!
//! This is similar to Rerun's recording concept - streams are the transport
//! layer, while sources (Intercom, Stripe, etc.) describe where events originated.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::path::PathBuf;

/// Unique identifier for a stream
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct StreamId(String);

impl StreamId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Generate a unique stream ID
    pub fn generate() -> Self {
        Self(format!("stream_{}", ulid::Ulid::new()))
    }

    /// Well-known ID for the default live API stream
    pub fn live_api() -> Self {
        Self::new("live_api")
    }
}

impl fmt::Display for StreamId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for StreamId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for StreamId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

/// Type of stream - determines how events are delivered
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum StreamKind {
    /// Live SSE stream from the chronicle-backend API server
    LiveApi {
        /// API server URL
        url: String,
    },
    /// Playback from an MCAP bag file
    McapFile {
        /// Path to the MCAP file
        path: PathBuf,
        /// Original filename (for display, especially on web where path may be temp)
        filename: Option<String>,
    },
    /// Direct connection to an external API
    ExternalApi {
        /// API endpoint URL
        url: String,
        /// Optional authentication token
        #[serde(skip_serializing_if = "Option::is_none")]
        auth: Option<String>,
    },
    /// In-memory stream (for testing or synthetic data)
    InMemory,
}

impl StreamKind {
    /// Get a human-readable type name
    pub fn type_name(&self) -> &'static str {
        match self {
            Self::LiveApi { .. } => "Live API",
            Self::McapFile { .. } => "MCAP File",
            Self::ExternalApi { .. } => "External API",
            Self::InMemory => "In-Memory",
        }
    }

    /// Get a short identifier for the stream type
    pub fn type_id(&self) -> &'static str {
        match self {
            Self::LiveApi { .. } => "live",
            Self::McapFile { .. } => "mcap",
            Self::ExternalApi { .. } => "api",
            Self::InMemory => "mem",
        }
    }

    /// Get an icon (emoji) for the stream type
    pub fn icon(&self) -> &'static str {
        match self {
            Self::LiveApi { .. } => "⚡",
            Self::McapFile { .. } => "📁",
            Self::ExternalApi { .. } => "🔗",
            Self::InMemory => "💾",
        }
    }

    /// Get a short label for UI display
    pub fn label(&self) -> &'static str {
        match self {
            Self::LiveApi { .. } => "Live",
            Self::McapFile { .. } => "Recording",
            Self::ExternalApi { .. } => "External",
            Self::InMemory => "Memory",
        }
    }
}

/// Connection/playback status of a stream
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum StreamStatus {
    /// Stream is connected and receiving events
    Connected,
    /// Stream is disconnected (will attempt reconnect for live streams)
    #[default]
    Disconnected,
    /// Stream is paused (user-initiated, no reconnect)
    Paused,
    /// Stream is currently connecting/loading
    Connecting,
    /// Stream encountered an error
    Error { message: String },
    /// Playback stream has completed (for MCAP files)
    Completed,
}

impl StreamStatus {
    pub fn is_active(&self) -> bool {
        matches!(self, Self::Connected | Self::Connecting)
    }

    pub fn is_error(&self) -> bool {
        matches!(self, Self::Error { .. })
    }

    /// Get a short status label for UI display
    pub fn label(&self) -> &str {
        match self {
            Self::Connected => "CONNECTED",
            Self::Disconnected => "DISCONNECTED",
            Self::Paused => "PAUSED",
            Self::Connecting => "CONNECTING",
            Self::Error { .. } => "ERROR",
            Self::Completed => "COMPLETED",
        }
    }

    /// Get a compact status label for tight UI spaces
    pub fn short_label(&self) -> &str {
        match self {
            Self::Connected => "LIVE",
            Self::Disconnected => "OFF",
            Self::Paused => "PAUSED",
            Self::Connecting => "...",
            Self::Error { .. } => "ERR",
            Self::Completed => "DONE",
        }
    }

    /// Get a color key for UI styling (maps to design system colors)
    pub fn color_key(&self) -> &'static str {
        match self {
            Self::Connected => "status_online",
            Self::Disconnected => "status_offline",
            Self::Paused => "text_muted",
            Self::Connecting => "signal_amber",
            Self::Error { .. } => "signal_red",
            Self::Completed => "accent_teal",
        }
    }
}

/// A stream delivers events from one or more sources
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Stream {
    /// Unique stream identifier
    pub id: StreamId,
    /// Human-readable name
    pub name: String,
    /// Type of stream (determines delivery mechanism)
    pub kind: StreamKind,
    /// Current connection/playback status
    pub status: StreamStatus,
    /// Color for UI differentiation (hex color like "#FF5733")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Whether this stream is enabled (events flow to timeline)
    pub enabled: bool,
    /// Event count received from this stream
    pub event_count: usize,
}

impl Stream {
    /// Create a new stream
    pub fn new(id: impl Into<StreamId>, name: impl Into<String>, kind: StreamKind) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            kind,
            status: StreamStatus::Disconnected,
            color: None,
            enabled: true,
            event_count: 0,
        }
    }

    /// Create a live API stream
    pub fn live_api(url: impl Into<String>) -> Self {
        let url = url.into();
        Self::new(
            StreamId::live_api(),
            "Live API",
            StreamKind::LiveApi { url },
        )
    }

    /// Create an MCAP file stream
    pub fn mcap_file(path: impl Into<PathBuf>, filename: Option<String>) -> Self {
        let path = path.into();
        let name = filename.clone().unwrap_or_else(|| {
            path.file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "MCAP Recording".to_string())
        });
        Self::new(
            StreamId::generate(),
            name,
            StreamKind::McapFile { path, filename },
        )
    }

    /// Create an external API stream
    pub fn external_api(url: impl Into<String>, name: impl Into<String>) -> Self {
        Self::new(
            StreamId::generate(),
            name,
            StreamKind::ExternalApi {
                url: url.into(),
                auth: None,
            },
        )
    }

    /// Set the stream color
    pub fn with_color(mut self, color: impl Into<String>) -> Self {
        self.color = Some(color.into());
        self
    }

    /// Set the stream status
    pub fn with_status(mut self, status: StreamStatus) -> Self {
        self.status = status;
        self
    }

    /// Increment event count
    pub fn record_event(&mut self) {
        self.event_count += 1;
    }
}

/// Default colors for streams (for UI differentiation)
pub const STREAM_COLORS: &[&str] = &[
    "#00D4AA", // Teal (primary)
    "#FF6B6B", // Coral
    "#4ECDC4", // Turquoise
    "#FFE66D", // Yellow
    "#95E1D3", // Mint
    "#F38181", // Salmon
    "#AA96DA", // Lavender
    "#FCBAD3", // Pink
];

/// Get a color for a stream by index
pub fn stream_color(index: usize) -> &'static str {
    STREAM_COLORS[index % STREAM_COLORS.len()]
}

/// View mode for multiple streams
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum StreamViewMode {
    /// Mix all enabled streams on a single timeline
    #[default]
    Mixed,
    /// View streams in isolation (one at a time or side-by-side)
    Isolated,
}

impl StreamViewMode {
    pub fn toggle(&mut self) {
        *self = match self {
            Self::Mixed => Self::Isolated,
            Self::Isolated => Self::Mixed,
        };
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Mixed => "MIXED",
            Self::Isolated => "ISOLATED",
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            Self::Mixed => "⊕",
            Self::Isolated => "⊖",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stream_id_generation() {
        let id1 = StreamId::generate();
        let id2 = StreamId::generate();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_live_api_stream() {
        let stream = Stream::live_api("http://localhost:3000");
        assert_eq!(stream.id, StreamId::live_api());
        assert_eq!(stream.name, "Live API");
        assert!(matches!(stream.kind, StreamKind::LiveApi { .. }));
    }

    #[test]
    fn test_mcap_file_stream() {
        let stream = Stream::mcap_file("/path/to/recording.mcap", Some("recording.mcap".into()));
        assert!(matches!(stream.kind, StreamKind::McapFile { .. }));
        assert_eq!(stream.name, "recording.mcap");
    }

    #[test]
    fn test_stream_status() {
        assert!(StreamStatus::Connected.is_active());
        assert!(StreamStatus::Connecting.is_active());
        assert!(!StreamStatus::Paused.is_active());
        assert!(StreamStatus::Error {
            message: "test".into()
        }
        .is_error());
    }

    #[test]
    fn test_view_mode_toggle() {
        let mut mode = StreamViewMode::Mixed;
        mode.toggle();
        assert_eq!(mode, StreamViewMode::Isolated);
        mode.toggle();
        assert_eq!(mode, StreamViewMode::Mixed);
    }

    #[test]
    fn test_stream_colors() {
        // Should cycle through colors
        assert_eq!(stream_color(0), STREAM_COLORS[0]);
        assert_eq!(stream_color(STREAM_COLORS.len()), STREAM_COLORS[0]);
    }
}
