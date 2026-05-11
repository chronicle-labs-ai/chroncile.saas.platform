//! Types for the timeline widget
//!
//! These types are designed to be serialized/deserialized from JavaScript.

use chrono::{DateTime, Utc};
use egui::Color32;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use chronicle_timeline_core::TimelineEventData;

/// Event data as passed from JavaScript
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEvent {
    /// Unique identifier for the event
    pub id: String,
    /// Source system (e.g., "intercom", "stripe")
    pub source: String,
    /// Event type (e.g., "intercom.conversation.message")
    #[serde(rename = "type")]
    pub event_type: String,
    /// When the event occurred (ISO 8601 string)
    pub occurred_at: DateTime<Utc>,
    /// Actor/user who triggered the event
    #[serde(default)]
    pub actor: Option<String>,
    /// Brief message or description
    #[serde(default)]
    pub message: Option<String>,
    /// Full payload as JSON
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
    /// Optional stream/category
    #[serde(default)]
    pub stream: Option<String>,
    /// Optional color override (hex)
    #[serde(default)]
    pub color: Option<String>,
}

/// Configuration options for the timeline widget
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineOptions {
    /// Whether to show the controls bar
    #[serde(default = "default_true")]
    pub show_controls: bool,
    /// Whether to show the topic tree
    #[serde(default = "default_true")]
    pub show_tree: bool,
    /// Whether to follow live events
    #[serde(default)]
    pub follow_live: bool,
    /// Initial time range start (ISO 8601)
    #[serde(default)]
    pub time_start: Option<DateTime<Utc>>,
    /// Initial time range end (ISO 8601)
    #[serde(default)]
    pub time_end: Option<DateTime<Utc>>,
    /// Theme: "dark" or "light"
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Height of each row in pixels
    #[serde(default = "default_row_height")]
    pub row_height: f32,
    /// Width of the label column in pixels
    #[serde(default = "default_label_width")]
    pub label_width: f32,
}

fn default_true() -> bool {
    true
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_row_height() -> f32 {
    28.0
}

fn default_label_width() -> f32 {
    180.0
}

impl Default for TimelineOptions {
    fn default() -> Self {
        Self {
            show_controls: true,
            show_tree: true,
            follow_live: false,
            time_start: None,
            time_end: None,
            theme: default_theme(),
            row_height: default_row_height(),
            label_width: default_label_width(),
        }
    }
}

/// Event emitted when selection changes
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionEvent {
    /// Selected event ID (null if deselected)
    pub event_id: Option<String>,
    /// The full event data if selected
    pub event: Option<TimelineEvent>,
}

/// Event emitted when time range changes
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeRangeEvent {
    /// Start of visible range (ISO 8601)
    pub start: DateTime<Utc>,
    /// End of visible range (ISO 8601)
    pub end: DateTime<Utc>,
}

/// Event emitted when playhead moves
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayheadEvent {
    /// Current playhead time (ISO 8601)
    pub time: DateTime<Utc>,
}

/// Implement TimelineEventData for TimelineEvent to use with timeline-core
impl TimelineEventData for TimelineEvent {
    fn id(&self) -> &str {
        &self.id
    }

    fn source(&self) -> &str {
        &self.source
    }

    fn event_type(&self) -> &str {
        &self.event_type
    }

    fn occurred_at(&self) -> DateTime<Utc> {
        self.occurred_at
    }

    fn actor(&self) -> Option<&str> {
        self.actor.as_deref()
    }

    fn message(&self) -> Option<&str> {
        self.message.as_deref()
    }

    fn color(&self) -> Option<Color32> {
        self.color.as_ref().and_then(|hex| parse_hex_color(hex))
    }

    fn stream(&self) -> Option<&str> {
        self.stream.as_deref()
    }
}

/// Helper to parse hex color strings like "#FF5500" or "rgb(255, 85, 0)"
fn parse_hex_color(s: &str) -> Option<Color32> {
    let s = s.trim();
    if s.starts_with('#') {
        let hex = s.trim_start_matches('#');
        if hex.len() == 6 {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            return Some(Color32::from_rgb(r, g, b));
        }
    }
    None
}

/// Playback state (serializable version for JS interop)
/// Use PlaybackState from timeline-core internally
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum PlaybackStateJs {
    /// Following live events
    Live,
    /// Playing through history
    Playing,
    /// Paused
    #[default]
    Paused,
}

impl From<chronicle_timeline_core::PlaybackState> for PlaybackStateJs {
    fn from(state: chronicle_timeline_core::PlaybackState) -> Self {
        match state {
            chronicle_timeline_core::PlaybackState::Following => Self::Live,
            chronicle_timeline_core::PlaybackState::Playing => Self::Playing,
            chronicle_timeline_core::PlaybackState::Paused => Self::Paused,
        }
    }
}

impl From<PlaybackStateJs> for chronicle_timeline_core::PlaybackState {
    fn from(state: PlaybackStateJs) -> Self {
        match state {
            PlaybackStateJs::Live => Self::Following,
            PlaybackStateJs::Playing => Self::Playing,
            PlaybackStateJs::Paused => Self::Paused,
        }
    }
}

/// Convert a JsValue to TimelineEvent
pub fn parse_event(value: JsValue) -> Result<TimelineEvent, JsValue> {
    serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse event: {}", e)))
}

/// Convert a JsValue array to Vec<TimelineEvent>
pub fn parse_events(value: JsValue) -> Result<Vec<TimelineEvent>, JsValue> {
    serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse events: {}", e)))
}

/// Convert TimelineOptions from JsValue
pub fn parse_options(value: JsValue) -> Result<TimelineOptions, JsValue> {
    if value.is_undefined() || value.is_null() {
        return Ok(TimelineOptions::default());
    }
    serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse options: {}", e)))
}

/// Convert a Rust value to JsValue
pub fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
