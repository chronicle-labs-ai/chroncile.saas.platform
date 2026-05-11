//! Timeline State Management
//!
//! Event buffer management, live event handling, and time range calculations.

use chrono::{Duration, Utc};

use crate::types::EventDto;
use crate::views::widgets::PlaybackState;

use super::TimelineView;

impl TimelineView {
    /// Set events and update available filters (from initial query)
    pub fn set_events(&mut self, events: Vec<EventDto>) {
        // Collect available sources and types from events
        let sources: Vec<String> = events
            .iter()
            .map(|e| e.source.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        let types: Vec<String> = events
            .iter()
            .map(|e| e.event_type.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        self.filter_panel.set_available_sources(sources);
        self.filter_panel.set_available_types(types);

        self.events = events;
        self.selected_index = None;
        self.time_panel.set_selected(None);
        self.update_time_range();
        self.needs_reload = false;

        // Fit topics panel to events and set playhead to latest
        self.time_panel.fit_to_events(&self.events);
        if let Some((_, end)) = self.time_range {
            self.time_panel.set_playhead(end);
            self.scrubber.set_playhead(end);
        }
    }

    /// Set available filters from API metadata
    pub fn set_available_filters(&mut self, sources: Vec<String>, event_types: Vec<String>) {
        self.filter_panel.set_available_sources(sources);
        self.filter_panel.set_available_types(event_types);
    }

    /// Add a live event from SSE stream
    pub fn add_event(&mut self, event: EventDto) {
        // During historical playback (Playing), don't add new events to avoid confusion
        // In Paused or Following mode, accept new events
        if self.time_panel.playback_state == PlaybackState::Playing {
            tracing::trace!("Rejecting live event - in playback mode");
            return;
        }

        // Check if event passes current filters (excluding time window - live events always pass time filter)
        // Time window is only used for initial query, not for filtering live events
        if !self.matches_live_filter(&event) {
            tracing::trace!("Rejecting live event - filtered by source/type");
            return;
        }

        tracing::debug!(
            "Adding live event: {} / {} at {}",
            event.event_type,
            event.source,
            event.occurred_at.format("%H:%M:%S%.3f")
        );

        // Add the event (updates filters automatically)
        self.add_event_internal(event);
        self.live_event_count += 1;
    }

    /// Add events from a playback file (MCAP)
    /// Does NOT apply live filters - all events are added and their sources/types
    /// are automatically added to the available filters
    pub fn add_events_from_playback(&mut self, events: Vec<EventDto>) {
        tracing::info!("Adding {} events from playback file", events.len());

        for event in events {
            self.add_event_internal(event);
        }

        self.update_time_range();

        // Fit timeline to show all events
        self.time_panel.fit_to_events(&self.events);
        if let Some((_, end)) = self.time_range {
            self.time_panel.set_playhead(end);
            self.scrubber.set_playhead(end);
        }
    }

    /// Internal method to add an event and update available filters
    fn add_event_internal(&mut self, event: EventDto) {
        // Update available sources/types if new AND add to selected (so new types show up)
        if !self.filter_panel.available_sources.contains(&event.source) {
            let mut sources = self.filter_panel.available_sources.clone();
            sources.push(event.source.clone());
            sources.sort();
            self.filter_panel.set_available_sources(sources);
            // Also add to selected so it shows up
            self.filter_panel
                .selected_sources
                .insert(event.source.clone());
        }
        if !self
            .filter_panel
            .available_types
            .contains(&event.event_type)
        {
            let mut types = self.filter_panel.available_types.clone();
            types.push(event.event_type.clone());
            types.sort();
            self.filter_panel.set_available_types(types);
            // Also add to selected so it shows up
            self.filter_panel
                .selected_types
                .insert(event.event_type.clone());
        }

        self.events.push(event);

        // Keep only last N events
        while self.events.len() > self.max_events {
            self.events.remove(0);
            // Adjust selected index if needed
            if let Some(idx) = self.selected_index {
                if idx > 0 {
                    self.selected_index = Some(idx - 1);
                } else {
                    self.selected_index = None;
                    self.time_panel.set_selected(None);
                }
            }
        }

        self.update_time_range();
        // Note: In Following mode, the playhead is updated by time_panel
        // to track real-time (Utc::now()), not the event time
    }

    pub fn clear(&mut self) {
        self.events.clear();
        self.selected_index = None;
        self.time_panel.set_selected(None);
        self.time_range = None;
        self.needs_reload = false;
        self.live_event_count = 0;
    }

    /// Update the cached time range from events and sync with time_panel
    pub(super) fn update_time_range(&mut self) {
        if self.events.is_empty() {
            // Default to last hour when no events
            let now = Utc::now();
            self.time_range = Some((now - Duration::hours(1), now));
            return;
        }

        let min_time = self.events.iter().map(|e| e.occurred_at).min().unwrap();
        let max_time = self.events.iter().map(|e| e.occurred_at).max().unwrap();

        // Add padding
        let padding = Duration::seconds(5);
        let padded_min = min_time - padding;
        let now = Utc::now();
        // Extend to now if live streaming
        let padded_max = max_time.max(now) + padding;

        // Ensure minimum duration for visualization
        let duration = padded_max - padded_min;
        let final_max = if duration < Duration::seconds(30) {
            padded_min + Duration::seconds(30)
        } else {
            padded_max
        };

        self.time_range = Some((padded_min, final_max));

        // When in live/following mode, ensure the time_panel's view includes the new events
        // The time_panel handles its own view expansion, but we need
        // to make sure events outside the current view are still visible when first received
        if self.is_live() {
            let view_end = self.time_panel.time_view.end();
            if max_time > view_end {
                // Expand the view to include new events
                self.time_panel.time_view.fit_to_times(
                    &self
                        .events
                        .iter()
                        .map(|e| e.occurred_at)
                        .collect::<Vec<_>>(),
                    0.1,
                );
            }
        }
    }
}
