//! Live Timeline View - Rerun-Inspired Design
//!
//! Unified view combining live SSE streaming with timeline visualization.
//! Features hierarchical topic-based navigation (source/event_type paths).
//! Inspired by Rerun.io's time panel with tight playhead integration.

mod details;
mod filtering;
mod list_view;
mod state;

use chrono::{DateTime, Utc};
use egui::{RichText, Ui};

use crate::design::{colors, rounding, spacing, strokes, typography, status_badge};
use crate::types::{EventDto, EventFilter, EventQuery, LaneGrouping, TimeRangeMapper, TimeWindow};
use crate::views::widgets::{
    FilterPanel, PlaybackState, RerunTimePanel, TimeScrubber,
};
#[cfg(feature = "native")]
use crate::views::widgets::{StreamsPanel, StreamsPanelResponse, StreamId, StreamStatus, StreamViewMode};

// Stub types for web builds (recording/streams not supported)
#[cfg(not(feature = "native"))]
mod web_stubs {
    use egui::Ui;
    
    #[derive(Clone, PartialEq, Eq, Hash, Default)]
    pub struct StreamId(pub String);
    impl StreamId {
        pub fn new(id: String) -> Self { Self(id) }
        pub fn live_api() -> Self { Self("live-api".to_string()) }
        pub fn as_str(&self) -> &str { &self.0 }
    }
    
    #[derive(Clone, Copy, PartialEq, Default, Debug)]
    pub enum StreamStatus { #[default] Disconnected, Connected }
    
    #[derive(Clone, Copy, PartialEq, Default, Debug)]
    pub enum StreamViewMode { #[default] Timeline }
    
    #[derive(Clone, Default)]
    pub struct Stream {
        pub name: String,
        pub color: Option<String>,
        pub enabled: bool,
    }
    
    #[derive(Default)]
    pub struct RecordingState;
    impl RecordingState {
        pub fn is_pending_save(&self) -> bool { false }
    }
    
    pub struct StreamsPanel {
        pub streams: std::collections::HashMap<StreamId, Stream>,
        pub recording_state: RecordingState,
        pub view_mode: StreamViewMode,
    }
    impl StreamsPanel {
        pub fn new() -> Self { 
            Self { 
                streams: std::collections::HashMap::new(), 
                recording_state: RecordingState,
                view_mode: StreamViewMode::Timeline,
            } 
        }
        pub fn set_stream_status(&mut self, _id: &StreamId, _status: StreamStatus) {}
        pub fn set_stream_events(&mut self, _id: &StreamId, _count: usize) {}
        pub fn request_recording_for(&mut self, _streams: &[StreamId]) {}
        pub fn stop_recording(&mut self) {}
        pub fn is_recording(&self) -> bool { false }
        pub fn record_event(&mut self, _id: Option<&StreamId>) {}
        pub fn recording_event_count(&self) -> usize { 0 }
        pub fn finish_save(&mut self) {}
        pub fn remove_stream(&mut self, _id: &StreamId) {}
        pub fn ui(&mut self, _ui: &mut Ui) -> StreamsPanelResponse { StreamsPanelResponse::default() }
    }
    
    #[derive(Default)]
    pub struct StreamsPanelResponse {
        pub start_recording: Option<Vec<StreamId>>,
        pub stop_recording: bool,
        pub add_stream: bool,
        pub add_stream_requested: bool,
        pub remove_stream: Option<StreamId>,
        pub recording_stopped: bool,
        pub recording_started: Option<Vec<StreamId>>,
        pub save_recording_requested: bool,
        pub discard_recording_requested: bool,
        pub view_mode_changed: bool,
    }
}
#[cfg(not(feature = "native"))]
use web_stubs::*;

/// View mode for the timeline
#[derive(Clone, Copy, PartialEq)]
pub enum TimelineMode {
    /// Topics visualization (Rerun-style)
    Topics,
    /// Text log view (Rerun-style)
    List,
}

/// Live timeline view combining SSE streaming with timeline visualization
/// Model: Timeline = Tenant + Time Range + Filters + Live Stream
///
/// Inspired by Rerun.io's time panel with tight playhead/timeline integration.
/// Supports multiple concurrent streams (live API, MCAP playback, etc.)
pub struct TimelineView {
    /// All events (loaded from query + live stream)
    pub events: Vec<EventDto>,
    /// Maximum events to keep in buffer
    pub max_events: usize,
    /// Selected event index
    pub selected_index: Option<usize>,
    /// Legacy filter (for backwards compatibility)
    pub filter: EventFilter,

    /// Current view mode
    mode: TimelineMode,

    /// Filter panel widget
    pub filter_panel: FilterPanel,

    /// Streams panel widget - multi-stream management
    pub streams_panel: StreamsPanel,

    /// Rerun-style time panel (streams tree + time axis)
    pub(crate) time_panel: RerunTimePanel,

    /// Legacy time scrubber (kept for list view compatibility)
    pub(crate) scrubber: TimeScrubber,

    /// Cached time range from events
    pub(crate) time_range: Option<(DateTime<Utc>, DateTime<Utc>)>,

    /// Flag indicating filters changed and need reload
    pub needs_reload: bool,

    // === Live Streaming State ===
    /// Whether SSE is connected
    pub stream_connected: bool,
    /// Count of live events received this session
    pub live_event_count: usize,

    /// Flag indicating stream panel requested to add a stream (load MCAP)
    pub add_stream_requested: bool,
    /// Flag indicating recording was stopped and is pending save
    pub recording_stopped: bool,
    /// Flag indicating user wants to save the recording
    pub save_recording_requested: bool,
    /// Streams that are currently being recorded
    pub recording_streams: Vec<StreamId>,
}

impl TimelineView {
    pub fn new() -> Self {
        let mut time_panel = RerunTimePanel::new();
        // Start in live/following mode by default for real-time streaming
        time_panel.playback_state = PlaybackState::Following;

        Self {
            events: Vec::new(),
            max_events: 500,
            selected_index: None,
            filter: EventFilter::all(),
            mode: TimelineMode::Topics,
            filter_panel: FilterPanel::new(),
            streams_panel: StreamsPanel::new(),
            time_panel,
            scrubber: TimeScrubber::default(),
            time_range: None,
            needs_reload: false,
            stream_connected: false,
            live_event_count: 0,
            add_stream_requested: false,
            recording_stopped: false,
            save_recording_requested: false,
            recording_streams: Vec::new(),
        }
    }

    /// Update the live API stream status
    pub fn set_stream_connected(&mut self, connected: bool) {
        self.stream_connected = connected;
        let status = if connected {
            StreamStatus::Connected
        } else {
            StreamStatus::Disconnected
        };
        self.streams_panel
            .set_stream_status(&StreamId::live_api(), status);
    }

    /// Get the current stream view mode
    pub fn stream_view_mode(&self) -> StreamViewMode {
        self.streams_panel.view_mode
    }

    /// Check if stream is paused (delegates to time_panel)
    pub fn paused(&self) -> bool {
        self.time_panel.playback_state == PlaybackState::Paused
    }

    /// Check if in live/following mode
    pub fn is_live(&self) -> bool {
        self.time_panel.playback_state == PlaybackState::Following
    }

    /// Check if auto-scroll/follow is enabled
    pub fn auto_scroll(&self) -> bool {
        self.time_panel.playback_state == PlaybackState::Following
    }

    /// Get current query from filter panel
    pub fn get_query(&self) -> EventQuery {
        self.filter_panel.to_event_query()
    }

    /// Get current time window
    pub fn get_time_window(&self) -> TimeWindow {
        self.filter_panel.time_window.clone()
    }

    /// Get current lane grouping
    pub fn get_lane_grouping(&self) -> LaneGrouping {
        self.filter_panel.lane_grouping
    }

    /// Calculate time mapper for current view (legacy, kept for list view)
    #[allow(dead_code)]
    fn calculate_time_mapper(&self, width: f32) -> Option<TimeRangeMapper> {
        self.time_range
            .map(|(start, end)| TimeRangeMapper::new(start, end, width))
    }

    /// Render the timeline view
    pub fn ui(&mut self, ui: &mut Ui) {
        // Reset flags each frame
        self.add_stream_requested = false;
        self.recording_stopped = false;

        ui.vertical(|ui| {
            // Streams panel (multi-stream management)
            let streams_response = self.streams_panel.ui(ui);
            self.handle_streams_response(streams_response);

            ui.add_space(spacing::SM);

            // Stream controls bar
            self.render_stream_controls(ui);

            ui.add_space(spacing::SM);

            // Filter panel
            let filter_response = self.filter_panel.ui(ui);
            if filter_response.changed {
                self.needs_reload = filter_response.time_window_changed;
            }

            ui.add_space(spacing::SM);

            // View mode selector
            self.render_view_selector(ui);

            ui.add_space(spacing::SM);

            if self.events.is_empty() {
                self.render_empty_state(ui);
                return;
            }

            // Render based on mode
            match self.mode {
                TimelineMode::Topics => self.render_topics_view(ui),
                TimelineMode::List => self.render_list_view(ui),
            }
        });
    }

    /// Handle streams panel response
    fn handle_streams_response(&mut self, response: StreamsPanelResponse) {
        if response.add_stream_requested {
            self.add_stream_requested = true;
        }

        if let Some(id) = response.remove_stream {
            self.streams_panel.remove_stream(&id);
        }

        // View mode change might require re-filtering events
        if response.view_mode_changed {
            tracing::debug!("Stream view mode changed to {:?}", self.streams_panel.view_mode);
        }

        // Handle recording start - store which streams are being recorded
        if let Some(streams) = response.recording_started {
            tracing::info!("Recording started for {} streams", streams.len());
            self.recording_streams = streams;
        }

        // Handle recording stop - enters pending save state in streams_panel
        if response.recording_stopped {
            tracing::info!(
                "Recording stopped with {} events, waiting for save",
                self.streams_panel.recording_event_count()
            );
            self.recording_stopped = true;
        }

        // Handle save request - user clicked "Save to File"
        if response.save_recording_requested {
            tracing::info!("User requested to save recording");
            self.save_recording_requested = true;
        }

        // Handle discard - user clicked "Discard" (already handled in streams_panel)
        if response.discard_recording_requested {
            tracing::info!("Recording discarded");
            self.recording_stopped = false;
            self.recording_streams.clear();
        }
    }

    /// Check if currently recording
    pub fn is_recording(&self) -> bool {
        self.streams_panel.is_recording()
    }

    /// Record an event (call when receiving events while recording is active)
    /// Only records if the event's stream is being recorded
    pub fn record_event(&mut self, stream_id: Option<&StreamId>) {
        if self.is_recording() {
            self.streams_panel.record_event(stream_id);
        }
    }

    /// Check if recording is pending save (user needs to save or discard)
    pub fn is_pending_save(&self) -> bool {
        self.streams_panel.recording_state.is_pending_save()
    }

    /// Clear the recording state after save is complete
    pub fn finish_recording_save(&mut self) {
        self.streams_panel.finish_save();
        self.recording_stopped = false;
        self.save_recording_requested = false;
        self.recording_streams.clear();
    }

    /// Get the stream IDs being recorded
    pub fn recording_stream_ids(&self) -> &[StreamId] {
        &self.recording_streams
    }

    /// Render stream status bar (simplified - controls are in TopicsPanel)
    fn render_stream_controls(&mut self, ui: &mut Ui) {
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::symmetric(spacing::MD, spacing::SM))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    // Stream connection status indicator
                    let is_live = self.is_live();
                    let (status_color, status_text) = if self.stream_connected {
                        if is_live {
                            (colors::STATUS_ONLINE, "● STREAMING")
                        } else {
                            (colors::SIGNAL_AMBER, "◉ CONNECTED")
                        }
                    } else {
                        (colors::STATUS_OFFLINE, "○ DISCONNECTED")
                    };

                    ui.horizontal(|ui| {
                        // Animated pulse for live status
                        if self.stream_connected && is_live {
                            let (rect, _) =
                                ui.allocate_exact_size(egui::vec2(8.0, 8.0), egui::Sense::hover());
                            let time = ui.ctx().input(|i| i.time);
                            let alpha = (0.5 + 0.5 * (time * 2.0).sin()) as f32;
                            ui.painter()
                                .rect_filled(rect, rounding::NONE, status_color.gamma_multiply(alpha));
                        }

                        ui.label(
                            RichText::new(status_text)
                                .color(status_color)
                                .font(typography::caption())
                                .strong(),
                        );
                    });

                    ui.add_space(spacing::MD);

                    // Mode indicator
                    let mode_text = match self.time_panel.playback_state {
                        PlaybackState::Following => "LIVE MODE",
                        PlaybackState::Playing => "PLAYBACK MODE",
                        PlaybackState::Paused => "PAUSED",
                    };
                    ui.label(
                        RichText::new(mode_text)
                            .color(colors::TEXT_MUTED)
                            .font(typography::caption()),
                    );

                    ui.add_space(spacing::MD);

                    // Clear button
                    let clear_btn = egui::Button::new(
                        RichText::new("✕ CLEAR")
                            .color(colors::TEXT_SECONDARY)
                            .font(typography::caption()),
                    )
                    .fill(colors::BG_CONTROL)
                    .rounding(rounding::SM);

                    if ui.add(clear_btn).clicked() {
                        self.clear();
                    }

                    // Right side - event counts
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        // Live count badge
                        if self.live_event_count > 0 && is_live {
                            status_badge(
                                ui,
                                &format!("+{} NEW", self.live_event_count),
                                colors::SIGNAL_GREEN,
                            );
                            ui.add_space(spacing::SM);
                        }

                        // Total count
                        ui.label(
                            RichText::new(format!("{}", self.events.len()))
                                .color(colors::ACCENT_TEAL)
                                .font(typography::mono())
                                .strong(),
                        );
                        ui.label(
                            RichText::new("EVENTS")
                                .color(colors::TEXT_MUTED)
                                .font(typography::caption()),
                        );
                    });
                });
            });
    }

    /// Render view mode selector
    fn render_view_selector(&mut self, ui: &mut Ui) {
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::symmetric(spacing::MD, spacing::SM))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new("VIEW")
                            .color(colors::TEXT_MUTED)
                            .font(typography::caption())
                            .strong(),
                    );

                    if ui
                        .selectable_label(
                            self.mode == TimelineMode::Topics,
                            RichText::new("▤ TOPICS").font(typography::small()),
                        )
                        .clicked()
                    {
                        self.mode = TimelineMode::Topics;
                    }
                    if ui
                        .selectable_label(
                            self.mode == TimelineMode::List,
                            RichText::new("☰ LIST").font(typography::small()),
                        )
                        .clicked()
                    {
                        self.mode = TimelineMode::List;
                    }

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let filtered = self.filter_events();
                        ui.label(
                            RichText::new(format!("{}/{}", filtered.len(), self.events.len()))
                                .color(colors::ACCENT_TEAL)
                                .font(typography::mono_small()),
                        );
                        ui.label(
                            RichText::new("FILTERED")
                                .color(colors::TEXT_MUTED)
                                .font(typography::caption()),
                        );
                    });
                });
            });
    }

    /// Render the integrated topics view (Rerun-style - timeline + topics combined)
    fn render_topics_view(&mut self, ui: &mut Ui) {
        let filtered_events = self.filter_events();

        // Integrated Topics Panel (time axis + topic tree + timeline)
        let panel_response = self.time_panel.ui(ui, &filtered_events);

        // Handle responses
        if panel_response.playhead_changed {
            self.scrubber.set_playhead(self.time_panel.playhead);
        }

        if let Some(clicked_id) = panel_response.clicked_event_id {
            if let Some(idx) = self.events.iter().position(|e| e.event_id == clicked_id) {
                self.selected_index = Some(idx);
                self.time_panel.set_selected(Some(clicked_id.clone()));

                // Move playhead to clicked event
                if let Some(event) = self.events.get(idx) {
                    self.time_panel.set_playhead(event.occurred_at);
                    self.scrubber.set_playhead(event.occurred_at);
                }
            }
        }

        ui.add_space(spacing::SM);

        // Event details panel
        self.render_details_panel(ui);
    }

    /// Render empty state
    fn render_empty_state(&mut self, ui: &mut Ui) {
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::same(spacing::XL))
            .show(ui, |ui| {
                ui.vertical_centered(|ui| {
                    let status_text = if self.stream_connected {
                        "AWAITING EVENTS"
                    } else {
                        "CONNECTING..."
                    };

                    ui.label(
                        RichText::new(status_text)
                            .color(colors::TEXT_MUTED)
                            .font(typography::heading())
                            .strong(),
                    );
                    ui.add_space(spacing::SM);
                    ui.label(
                        RichText::new("Events will appear here as they are received")
                            .color(colors::TEXT_DISABLED)
                            .font(typography::small()),
                    );
                });
            });
    }
}

impl Default for TimelineView {
    fn default() -> Self {
        Self::new()
    }
}

