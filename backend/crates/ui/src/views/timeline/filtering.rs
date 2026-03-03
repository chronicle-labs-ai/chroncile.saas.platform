//! Timeline Filtering
//!
//! Event filtering based on source, type, stream, and other criteria.

use crate::types::EventDto;
use super::{TimelineView, StreamId};

impl TimelineView {
    /// Filter events based on current filter panel and stream settings
    /// Note: Time window is NOT applied for display - it's only used for initial API query
    /// This allows live events to be shown even if they're outside the originally selected time window
    pub(super) fn filter_events(&self) -> Vec<EventDto> {
        self.events
            .iter()
            .filter(|e| self.matches_display_filter(e))
            .cloned()
            .collect()
    }

    /// Check if an event matches display filters (excluding time window)
    /// Time window is only used for initial API query, not for filtering the local buffer
    pub(super) fn matches_display_filter(&self, event: &EventDto) -> bool {
        // Stream filter - check if event's stream is enabled
        if !self.is_stream_enabled_for_event(event) {
            return false;
        }

        // Source filter - if specific sources are selected, check membership
        let sources = &self.filter_panel.selected_sources;
        if !sources.is_empty() && sources.len() < self.filter_panel.available_sources.len()
            && !sources.contains(&event.source) {
                return false;
            }

        // Event type filter - if specific types are selected, check membership
        let types = &self.filter_panel.selected_types;
        if !types.is_empty() && types.len() < self.filter_panel.available_types.len()
            && !types.contains(&event.event_type) {
                return false;
            }

        true
    }

    /// Check if the stream for an event is enabled
    fn is_stream_enabled_for_event(&self, event: &EventDto) -> bool {
        // Get the stream ID for this event
        let stream_id = match &event.stream_id {
            Some(id) => StreamId::new(id.clone()),
            None => StreamId::live_api(), // Events without stream_id are from live API
        };

        // Check if this stream exists and is enabled
        self.streams_panel
            .streams
            .get(&stream_id)
            .map(|s| s.enabled)
            .unwrap_or(true) // If stream not found, show by default (backwards compat)
    }

    /// Check if a live event matches current filters (same as display filter)
    /// For live streaming, we don't filter by time - events are accepted as they arrive
    pub(super) fn matches_live_filter(&self, event: &EventDto) -> bool {
        self.matches_display_filter(event)
    }
}

