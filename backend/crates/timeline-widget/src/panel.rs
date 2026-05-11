//! Timeline Panel Wrapper
//!
//! Wraps the timeline-core panel for use in the WASM widget.

use chrono::{DateTime, Utc};
use egui::Ui;

use chronicle_timeline_core::{
    PlaybackState, TimeView, TimelinePanel as CorePanel, TimelinePanelConfig,
    TimelinePanelResponse, TimelineTheme,
};

use crate::types::{PlaybackStateJs, TimelineEvent, TimelineOptions};

/// The main timeline panel widget (wraps timeline-core)
pub struct TimelinePanel {
    /// The underlying timeline-core panel
    inner: CorePanel<TimelineEvent>,
    /// Configuration from JavaScript (stored for potential future use)
    #[allow(dead_code)]
    options: TimelineOptions,
    /// Events (owned, since we need to pass them by reference)
    events: Vec<TimelineEvent>,
}

impl TimelinePanel {
    pub fn new(options: TimelineOptions) -> Self {
        let config = TimelinePanelConfig {
            row_height: options.row_height,
            header_height: 32.0,
            label_width: options.label_width,
            indent_size: 16.0,
            show_controls: options.show_controls,
            show_tree: options.show_tree,
        };

        let theme = if options.theme == "light" {
            TimelineTheme::light()
        } else {
            TimelineTheme::dark()
        };

        let mut inner = CorePanel::with_config(config, theme);

        // Set initial time range if provided
        if let (Some(start), Some(end)) = (options.time_start, options.time_end) {
            inner.time_view = TimeView::new(start, end);
        }

        // Set initial playback state
        if options.follow_live {
            inner.playback_state = PlaybackState::Following;
        }

        Self {
            inner,
            options,
            events: Vec::new(),
        }
    }

    /// Set all events
    pub fn set_events(&mut self, events: Vec<TimelineEvent>) {
        self.events = events;
        self.inner.fit_to_events(&self.events);
    }

    /// Add a single event
    pub fn add_event(&mut self, event: TimelineEvent) {
        let time = event.occurred_at;
        self.events.push(event);

        if self.inner.playback_state == PlaybackState::Following {
            self.inner.set_playhead(time);
            self.inner.expand_to_include(time);
        }
    }

    /// Clear all events
    pub fn clear(&mut self) {
        self.events.clear();
        self.inner.set_selected(None);
    }

    /// Set the playhead position
    pub fn set_playhead(&mut self, time: DateTime<Utc>) {
        self.inner.set_playhead(time);
    }

    /// Get the current playhead position
    pub fn playhead(&self) -> DateTime<Utc> {
        self.inner.playhead
    }

    /// Set the selected event
    pub fn set_selected(&mut self, event_id: Option<String>) {
        self.inner.set_selected(event_id);
    }

    /// Get the selected event ID
    pub fn selected_event(&self) -> Option<&String> {
        self.inner.selected_event.as_ref()
    }

    /// Toggle collapse state of a path
    pub fn toggle_collapsed(&mut self, _path: &str) {
        // The core panel handles this internally via the topic tree
        // TODO: Expose this through the inner panel's topic tree
    }

    /// Fit the view to all events
    pub fn fit_to_events(&mut self) {
        self.inner.fit_to_events(&self.events);
    }

    /// Set the time range
    pub fn set_time_range(&mut self, start: DateTime<Utc>, end: DateTime<Utc>) {
        self.inner.time_view = TimeView::new(start, end);
    }

    /// Get the current time range
    pub fn time_range(&self) -> (DateTime<Utc>, DateTime<Utc>) {
        (self.inner.time_view.start(), self.inner.time_view.end())
    }

    /// Get the playback state (for JS interop)
    pub fn playback_state(&self) -> PlaybackStateJs {
        self.inner.playback_state.into()
    }

    /// Get a reference to the events
    pub fn events(&self) -> &[TimelineEvent] {
        &self.events
    }

    /// Render the panel
    pub fn ui(&mut self, ui: &mut Ui) -> TimelinePanelResponse {
        self.inner.ui(ui, &self.events)
    }
}

impl Default for TimelinePanel {
    fn default() -> Self {
        Self::new(TimelineOptions::default())
    }
}
