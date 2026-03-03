//! Streams Panel Widget
//!
//! Panel for managing multiple concurrent event streams (live API, MCAP files, etc.)
//! with support for mix/isolate viewing modes and recording capabilities.
//!
//! Uses domain types from chronicle-backend-domain for stream representation.

mod recording;
mod stream_row;
mod types;

use std::collections::HashMap;

use chrono::Utc;
use egui::{RichText, Ui};

use chronicle_domain::{Stream, StreamId, StreamStatus, StreamViewMode};

use crate::design::{colors, spacing, typography};

pub use types::{
    parse_hex_color, status_color, stream_color, RecordingState, StreamRowResponse,
    StreamsPanelResponse, STREAM_COLORS,
};

use stream_row::render_stream_row;

/// Streams panel widget
pub struct StreamsPanel {
    /// Active streams (using domain Stream type)
    pub streams: HashMap<StreamId, Stream>,
    /// Stream order (for consistent display)
    pub stream_order: Vec<StreamId>,
    /// View mode (using domain type)
    pub view_mode: StreamViewMode,
    /// Selected stream for isolated view
    pub selected_stream: Option<StreamId>,
    /// Next color index for auto-assignment
    next_color_index: usize,
    /// Whether panel is collapsed
    pub collapsed: bool,
    /// Recording state
    pub recording_state: RecordingState,
    /// Streams selected for recording (used during SelectingStreams state)
    pub streams_to_record: Vec<StreamId>,
}

impl Default for StreamsPanel {
    fn default() -> Self {
        Self::new()
    }
}

impl StreamsPanel {
    pub fn new() -> Self {
        let mut panel = Self {
            streams: HashMap::new(),
            stream_order: Vec::new(),
            view_mode: StreamViewMode::Mixed,
            selected_stream: None,
            next_color_index: 0,
            collapsed: false,
            recording_state: RecordingState::Idle,
            streams_to_record: Vec::new(),
        };

        // Add default live API stream
        panel.add_stream(Stream::live_api(""));

        panel
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Recording State Management
    // ─────────────────────────────────────────────────────────────────────────

    /// Enter stream selection mode for recording
    pub fn begin_recording_setup(&mut self) {
        // Default: select all enabled streams
        self.streams_to_record = self
            .stream_order
            .iter()
            .filter(|id| self.streams.get(*id).map(|s| s.enabled).unwrap_or(false))
            .cloned()
            .collect();
        self.recording_state = RecordingState::SelectingStreams;
    }

    /// Cancel stream selection, return to idle
    pub fn cancel_recording_setup(&mut self) {
        self.streams_to_record.clear();
        self.recording_state = RecordingState::Idle;
    }

    /// Start recording events from selected streams
    pub fn start_recording(&mut self) {
        let streams = std::mem::take(&mut self.streams_to_record);
        if streams.is_empty() {
            // If no streams selected, record from all enabled
            let all_enabled: Vec<_> = self
                .stream_order
                .iter()
                .filter(|id| self.streams.get(*id).map(|s| s.enabled).unwrap_or(false))
                .cloned()
                .collect();
            self.recording_state = RecordingState::Recording {
                started_at: Utc::now(),
                event_count: 0,
                recording_streams: all_enabled,
            };
        } else {
            self.recording_state = RecordingState::Recording {
                started_at: Utc::now(),
                event_count: 0,
                recording_streams: streams,
            };
        }
    }

    /// Stop recording and enter pending save state
    pub fn stop_recording(&mut self) {
        if let RecordingState::Recording {
            started_at,
            event_count,
            recording_streams,
        } = &self.recording_state
        {
            let duration_secs = (Utc::now() - *started_at).num_seconds();
            self.recording_state = RecordingState::PendingSave {
                event_count: *event_count,
                duration_secs,
                recorded_streams: recording_streams.clone(),
            };
        }
    }

    /// Finish saving (return to idle)
    pub fn finish_save(&mut self) {
        self.recording_state = RecordingState::Idle;
    }

    /// Discard recording without saving
    pub fn discard_recording(&mut self) {
        self.recording_state = RecordingState::Idle;
    }

    /// Increment the recording event count (only if stream is being recorded)
    pub fn record_event(&mut self, stream_id: Option<&StreamId>) {
        if let RecordingState::Recording {
            event_count,
            recording_streams,
            ..
        } = &mut self.recording_state
        {
            // Check if this stream is being recorded
            let should_record = match stream_id {
                Some(id) => recording_streams.contains(id),
                None => true, // Events without stream_id are always recorded
            };
            if should_record {
                *event_count += 1;
            }
        }
    }

    /// Check if currently recording
    pub fn is_recording(&self) -> bool {
        self.recording_state.is_recording()
    }

    /// Check if a specific stream is being recorded
    pub fn is_stream_being_recorded(&self, stream_id: &StreamId) -> bool {
        self.recording_state.recording_streams().contains(stream_id)
    }

    /// Get recording event count
    pub fn recording_event_count(&self) -> usize {
        self.recording_state.event_count()
    }

    /// Toggle a stream for recording selection
    pub fn toggle_stream_for_recording(&mut self, stream_id: &StreamId) {
        if let Some(pos) = self.streams_to_record.iter().position(|id| id == stream_id) {
            self.streams_to_record.remove(pos);
        } else {
            self.streams_to_record.push(stream_id.clone());
        }
    }

    /// Check if a stream is selected for recording
    pub fn is_stream_selected_for_recording(&self, stream_id: &StreamId) -> bool {
        self.streams_to_record.contains(stream_id)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Stream Management
    // ─────────────────────────────────────────────────────────────────────────

    /// Add a stream
    pub fn add_stream(&mut self, mut stream: Stream) {
        // Assign color if not set
        if stream.color.is_none() {
            let hex = chronicle_domain::stream_color(self.next_color_index);
            stream.color = Some(hex.to_string());
            self.next_color_index += 1;
        }

        let id = stream.id.clone();
        self.streams.insert(id.clone(), stream);
        if !self.stream_order.contains(&id) {
            self.stream_order.push(id);
        }
    }

    /// Remove a stream
    pub fn remove_stream(&mut self, id: &StreamId) {
        self.streams.remove(id);
        self.stream_order.retain(|i| i != id);
        if self.selected_stream.as_ref() == Some(id) {
            self.selected_stream = None;
        }
    }

    /// Get a stream
    pub fn get_stream(&self, id: &StreamId) -> Option<&Stream> {
        self.streams.get(id)
    }

    /// Get mutable stream
    pub fn get_stream_mut(&mut self, id: &StreamId) -> Option<&mut Stream> {
        self.streams.get_mut(id)
    }

    /// Update stream status
    pub fn set_stream_status(&mut self, id: &StreamId, status: StreamStatus) {
        if let Some(stream) = self.streams.get_mut(id) {
            stream.status = status;
        }
    }

    /// Update stream event count
    pub fn set_stream_event_count(&mut self, id: &StreamId, count: usize) {
        if let Some(stream) = self.streams.get_mut(id) {
            stream.event_count = count;
        }
    }

    /// Increment stream event count
    pub fn increment_stream_events(&mut self, id: &StreamId) {
        if let Some(stream) = self.streams.get_mut(id) {
            stream.event_count += 1;
        }
    }

    /// Get enabled streams
    pub fn enabled_streams(&self) -> Vec<&Stream> {
        self.stream_order
            .iter()
            .filter_map(|id| self.streams.get(id))
            .filter(|s| s.enabled)
            .collect()
    }

    /// Get total event count across all enabled streams
    pub fn total_event_count(&self) -> usize {
        self.enabled_streams().iter().map(|s| s.event_count).sum()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI Rendering
    // ─────────────────────────────────────────────────────────────────────────

    /// Render the panel
    pub fn ui(&mut self, ui: &mut Ui) -> StreamsPanelResponse {
        let mut response = StreamsPanelResponse::default();

        // Header with collapse toggle
        ui.horizontal(|ui| {
            let collapse_icon = if self.collapsed { "▶" } else { "▼" };
            if ui
                .add(
                    egui::Button::new(
                        RichText::new(collapse_icon)
                            .color(colors::TEXT_MUTED)
                            .size(10.0),
                    )
                    .frame(false),
                )
                .clicked()
            {
                self.collapsed = !self.collapsed;
            }

            ui.label(
                RichText::new("STREAMS")
                    .font(typography::small())
                    .color(colors::TEXT_SECONDARY),
            );

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                // View mode toggle
                let mode_btn = egui::Button::new(
                    RichText::new(format!(
                        "{} {}",
                        self.view_mode.icon(),
                        self.view_mode.label()
                    ))
                    .font(typography::caption())
                    .color(colors::ACCENT_TEAL),
                )
                .frame(false);

                if ui.add(mode_btn).clicked() {
                    self.view_mode.toggle();
                    response.view_mode_changed = true;
                }

                // Add stream button
                if ui
                    .add(
                        egui::Button::new(
                            RichText::new("+").color(colors::TEXT_SECONDARY).size(14.0),
                        )
                        .frame(false),
                    )
                    .on_hover_text("Load recording or add stream")
                    .clicked()
                {
                    response.add_stream_requested = true;
                }
            });
        });

        if self.collapsed {
            return response;
        }

        ui.add_space(spacing::XS);

        // Recording controls
        self.render_recording_controls(ui, &mut response);

        ui.add_space(spacing::XS);

        // Stream list
        for id in self.stream_order.clone() {
            if let Some(stream) = self.streams.get(&id) {
                let stream_response = render_stream_row(
                    ui,
                    stream,
                    self.view_mode,
                    self.selected_stream.as_ref() == Some(&id),
                );

                if stream_response.toggled {
                    if let Some(s) = self.streams.get_mut(&id) {
                        s.enabled = !s.enabled;
                    }
                    response.toggled_stream = Some(id.clone());
                }
                if stream_response.selected {
                    self.selected_stream = Some(id.clone());
                    response.selected_stream_changed = Some(id.clone());
                }
                if stream_response.remove_requested {
                    response.remove_stream = Some(id.clone());
                }
            }
        }

        response
    }
}
