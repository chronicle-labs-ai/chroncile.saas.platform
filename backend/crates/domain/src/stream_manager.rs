//! Stream Manager
//!
//! Orchestrates multiple concurrent streams, providing unified access to events
//! from different sources (live API, MCAP files, external APIs).
//!
//! The manager supports two viewing modes:
//! - **Mixed**: All enabled streams merged into a single timeline (by timestamp)
//! - **Isolated**: View streams separately or one at a time

use std::collections::HashMap;

use crate::{stream_color, EventEnvelope, Stream, StreamId, StreamStatus, StreamViewMode};

/// Manages multiple concurrent event streams
#[derive(Debug, Default)]
pub struct StreamManager {
    /// Active streams by ID
    streams: HashMap<StreamId, Stream>,
    /// Events buffered from each stream
    buffers: HashMap<StreamId, Vec<EventEnvelope>>,
    /// Current view mode
    view_mode: StreamViewMode,
    /// Currently selected stream for isolated view (None = show all in split)
    selected_stream: Option<StreamId>,
    /// Counter for assigning colors
    color_index: usize,
}

impl StreamManager {
    /// Create a new stream manager
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a new stream
    pub fn add_stream(&mut self, mut stream: Stream) -> StreamId {
        let id = stream.id.clone();

        // Assign a color if not set
        if stream.color.is_none() {
            stream.color = Some(stream_color(self.color_index).to_string());
            self.color_index += 1;
        }

        self.streams.insert(id.clone(), stream);
        self.buffers.insert(id.clone(), Vec::new());

        id
    }

    /// Remove a stream
    pub fn remove_stream(&mut self, id: &StreamId) -> Option<Stream> {
        self.buffers.remove(id);
        if self.selected_stream.as_ref() == Some(id) {
            self.selected_stream = None;
        }
        self.streams.remove(id)
    }

    /// Get a stream by ID
    pub fn get_stream(&self, id: &StreamId) -> Option<&Stream> {
        self.streams.get(id)
    }

    /// Get a mutable reference to a stream
    pub fn get_stream_mut(&mut self, id: &StreamId) -> Option<&mut Stream> {
        self.streams.get_mut(id)
    }

    /// Get all streams
    pub fn streams(&self) -> impl Iterator<Item = &Stream> {
        self.streams.values()
    }

    /// Get all stream IDs
    pub fn stream_ids(&self) -> impl Iterator<Item = &StreamId> {
        self.streams.keys()
    }

    /// Get the number of streams
    pub fn stream_count(&self) -> usize {
        self.streams.len()
    }

    /// Check if a stream exists
    pub fn has_stream(&self, id: &StreamId) -> bool {
        self.streams.contains_key(id)
    }

    /// Update stream status
    pub fn set_stream_status(&mut self, id: &StreamId, status: StreamStatus) {
        if let Some(stream) = self.streams.get_mut(id) {
            stream.status = status;
        }
    }

    /// Enable or disable a stream
    pub fn set_stream_enabled(&mut self, id: &StreamId, enabled: bool) {
        if let Some(stream) = self.streams.get_mut(id) {
            stream.enabled = enabled;
        }
    }

    /// Toggle stream enabled state
    pub fn toggle_stream(&mut self, id: &StreamId) {
        if let Some(stream) = self.streams.get_mut(id) {
            stream.enabled = !stream.enabled;
        }
    }

    /// Get enabled streams
    pub fn enabled_streams(&self) -> impl Iterator<Item = &Stream> {
        self.streams.values().filter(|s| s.enabled)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Event Management
    // ─────────────────────────────────────────────────────────────────────────

    /// Push an event to a stream's buffer
    pub fn push_event(&mut self, stream_id: &StreamId, event: EventEnvelope) {
        if let Some(buffer) = self.buffers.get_mut(stream_id) {
            buffer.push(event);
        }
        if let Some(stream) = self.streams.get_mut(stream_id) {
            stream.record_event();
        }
    }

    /// Push multiple events to a stream's buffer
    pub fn push_events(
        &mut self,
        stream_id: &StreamId,
        events: impl IntoIterator<Item = EventEnvelope>,
    ) {
        if let Some(buffer) = self.buffers.get_mut(stream_id) {
            for event in events {
                buffer.push(event);
                if let Some(stream) = self.streams.get_mut(stream_id) {
                    stream.record_event();
                }
            }
        }
    }

    /// Get events from a specific stream
    pub fn stream_events(&self, id: &StreamId) -> &[EventEnvelope] {
        self.buffers.get(id).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Get all events from enabled streams, sorted by occurred_at
    pub fn mixed_events(&self) -> Vec<&EventEnvelope> {
        let mut events: Vec<&EventEnvelope> = self
            .streams
            .iter()
            .filter(|(_, stream)| stream.enabled)
            .flat_map(|(id, _)| {
                self.buffers
                    .get(id)
                    .map(|v| v.iter())
                    .unwrap_or_else(|| [].iter())
            })
            .collect();

        events.sort_by_key(|e| e.occurred_at);
        events
    }

    /// Get events based on current view mode
    pub fn visible_events(&self) -> Vec<&EventEnvelope> {
        match self.view_mode {
            StreamViewMode::Mixed => self.mixed_events(),
            StreamViewMode::Isolated => {
                if let Some(selected) = &self.selected_stream {
                    self.stream_events(selected).iter().collect()
                } else {
                    // No stream selected, return empty
                    Vec::new()
                }
            }
        }
    }

    /// Clear all events from a stream
    pub fn clear_stream(&mut self, id: &StreamId) {
        if let Some(buffer) = self.buffers.get_mut(id) {
            buffer.clear();
        }
    }

    /// Clear all events from all streams
    pub fn clear_all(&mut self) {
        for buffer in self.buffers.values_mut() {
            buffer.clear();
        }
    }

    /// Get total event count across all streams
    pub fn total_event_count(&self) -> usize {
        self.buffers.values().map(|b| b.len()).sum()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Mode
    // ─────────────────────────────────────────────────────────────────────────

    /// Get current view mode
    pub fn view_mode(&self) -> StreamViewMode {
        self.view_mode
    }

    /// Set view mode
    pub fn set_view_mode(&mut self, mode: StreamViewMode) {
        self.view_mode = mode;
    }

    /// Toggle between mixed and isolated view modes
    pub fn toggle_view_mode(&mut self) {
        self.view_mode.toggle();
    }

    /// Get the selected stream for isolated view
    pub fn selected_stream(&self) -> Option<&StreamId> {
        self.selected_stream.as_ref()
    }

    /// Set the selected stream for isolated view
    pub fn set_selected_stream(&mut self, id: Option<StreamId>) {
        self.selected_stream = id;
    }

    /// Select the first available stream
    pub fn select_first_stream(&mut self) {
        self.selected_stream = self.streams.keys().next().cloned();
    }
}

/// Result of iterating over streams with their events
pub struct StreamWithEvents<'a> {
    pub stream: &'a Stream,
    pub events: &'a [EventEnvelope],
}

impl StreamManager {
    /// Get all streams with their events (for isolated/split view)
    pub fn streams_with_events(&self) -> Vec<StreamWithEvents<'_>> {
        self.streams
            .iter()
            .filter(|(_, stream)| stream.enabled)
            .map(|(id, stream)| StreamWithEvents {
                stream,
                events: self.buffers.get(id).map(|v| v.as_slice()).unwrap_or(&[]),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Actor, StreamKind, Subject, TenantId};
    use chrono::Utc;
    use serde_json::value::RawValue;

    fn make_test_event(occurred_at: chrono::DateTime<Utc>) -> EventEnvelope {
        let payload = RawValue::from_string("{}".to_string()).unwrap();
        EventEnvelope {
            event_id: crate::new_event_id(),
            tenant_id: TenantId::new("test"),
            source: "test".to_string(),
            source_event_id: crate::new_event_id().to_string(),
            event_type: "test.event".to_string(),
            subject: Subject::new("conv_1"),
            actor: Actor::system(),
            occurred_at,
            ingested_at: Utc::now(),
            schema_version: 1,
            payload,
            pii: Default::default(),
            permissions: Default::default(),
            stream_id: None,
        }
    }

    #[test]
    fn test_add_remove_stream() {
        let mut manager = StreamManager::new();

        let stream = Stream::live_api("http://localhost:3000");
        let id = manager.add_stream(stream);

        assert!(manager.has_stream(&id));
        assert_eq!(manager.stream_count(), 1);

        manager.remove_stream(&id);
        assert!(!manager.has_stream(&id));
        assert_eq!(manager.stream_count(), 0);
    }

    #[test]
    fn test_auto_color_assignment() {
        let mut manager = StreamManager::new();

        let s1 = Stream::new("s1", "Stream 1", StreamKind::InMemory);
        let s2 = Stream::new("s2", "Stream 2", StreamKind::InMemory);

        manager.add_stream(s1);
        manager.add_stream(s2);

        let stream1 = manager.get_stream(&StreamId::new("s1")).unwrap();
        let stream2 = manager.get_stream(&StreamId::new("s2")).unwrap();

        assert!(stream1.color.is_some());
        assert!(stream2.color.is_some());
        assert_ne!(stream1.color, stream2.color);
    }

    #[test]
    fn test_mixed_events_ordering() {
        let mut manager = StreamManager::new();
        let now = Utc::now();

        let id1 = manager.add_stream(Stream::new("s1", "Stream 1", StreamKind::InMemory));
        let id2 = manager.add_stream(Stream::new("s2", "Stream 2", StreamKind::InMemory));

        // Add events out of order
        manager.push_event(&id1, make_test_event(now - chrono::Duration::seconds(3)));
        manager.push_event(&id2, make_test_event(now - chrono::Duration::seconds(2)));
        manager.push_event(&id1, make_test_event(now - chrono::Duration::seconds(1)));
        manager.push_event(&id2, make_test_event(now));

        let mixed = manager.mixed_events();
        assert_eq!(mixed.len(), 4);

        // Verify chronological order
        for i in 1..mixed.len() {
            assert!(mixed[i].occurred_at >= mixed[i - 1].occurred_at);
        }
    }

    #[test]
    fn test_stream_enable_disable() {
        let mut manager = StreamManager::new();

        let id = manager.add_stream(Stream::new("s1", "Stream 1", StreamKind::InMemory));
        manager.push_event(&id, make_test_event(Utc::now()));

        // Initially enabled
        assert_eq!(manager.mixed_events().len(), 1);

        // Disable stream
        manager.set_stream_enabled(&id, false);
        assert_eq!(manager.mixed_events().len(), 0);

        // Re-enable
        manager.toggle_stream(&id);
        assert_eq!(manager.mixed_events().len(), 1);
    }

    #[test]
    fn test_view_mode_toggle() {
        let mut manager = StreamManager::new();

        assert_eq!(manager.view_mode(), StreamViewMode::Mixed);

        manager.toggle_view_mode();
        assert_eq!(manager.view_mode(), StreamViewMode::Isolated);

        manager.toggle_view_mode();
        assert_eq!(manager.view_mode(), StreamViewMode::Mixed);
    }

    #[test]
    fn test_selected_stream_for_isolated_view() {
        let mut manager = StreamManager::new();
        let now = Utc::now();

        let id1 = manager.add_stream(Stream::new("s1", "Stream 1", StreamKind::InMemory));
        let id2 = manager.add_stream(Stream::new("s2", "Stream 2", StreamKind::InMemory));

        manager.push_event(&id1, make_test_event(now - chrono::Duration::seconds(1)));
        manager.push_event(&id2, make_test_event(now));

        manager.set_view_mode(StreamViewMode::Isolated);
        manager.set_selected_stream(Some(id1.clone()));

        let visible = manager.visible_events();
        assert_eq!(visible.len(), 1);
    }
}
