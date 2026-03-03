//! MCAP Player
//!
//! Reads events from MCAP bag files with multi-stream support.

use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read, Seek};
use std::path::Path;

use chrono::{DateTime, Utc};

use crate::{EventEnvelope, StreamId};

use super::types::{RecordingError, RecordingMetadata, CHANNEL_PREFIX};

/// Reads events from an MCAP bag file with multi-stream support
pub struct BagPlayer {
    /// The events loaded from the bag, grouped by stream
    events_by_stream: HashMap<StreamId, Vec<EventEnvelope>>,
    /// Events without a stream ID (from default channel)
    default_events: Vec<EventEnvelope>,
    /// Recording metadata
    metadata: RecordingMetadata,
}

impl BagPlayer {
    /// Open an existing bag file and load all events
    pub fn open(path: impl AsRef<Path>) -> Result<Self, RecordingError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        Self::from_reader(reader)
    }

    /// Load events from a reader
    pub fn from_reader<R: Read + Seek>(mut reader: R) -> Result<Self, RecordingError> {
        // Read the entire contents into memory for parsing
        let mut data = Vec::new();
        reader.read_to_end(&mut data)?;
        Self::from_bytes(&data)
    }

    /// Load events directly from bytes
    pub fn from_bytes(data: &[u8]) -> Result<Self, RecordingError> {
        let mut events_by_stream: HashMap<StreamId, Vec<EventEnvelope>> = HashMap::new();
        let mut default_events: Vec<EventEnvelope> = Vec::new();

        for message in mcap::MessageStream::new(data)? {
            let message = message?;

            // Parse the topic to extract stream ID
            let topic = &message.channel.topic;
            let stream_id = if let Some(suffix) = topic.strip_prefix(CHANNEL_PREFIX) {
                if let Some(id) = suffix.strip_prefix('/') {
                    if id != "default" {
                        Some(StreamId::new(id))
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            // Parse the event
            let mut envelope: EventEnvelope = serde_json::from_slice(&message.data)?;

            // Set stream_id from channel topic if not already set
            if envelope.stream_id.is_none() && stream_id.is_some() {
                envelope.stream_id = stream_id.clone();
            }

            // Add to appropriate collection
            match &envelope.stream_id {
                Some(sid) => {
                    events_by_stream
                        .entry(sid.clone())
                        .or_default()
                        .push(envelope);
                }
                None => {
                    default_events.push(envelope);
                }
            }
        }

        // Sort all event collections by occurred_at
        for events in events_by_stream.values_mut() {
            events.sort_by_key(|e| e.occurred_at);
        }
        default_events.sort_by_key(|e| e.occurred_at);

        // Compute metadata
        let all_events: Vec<&EventEnvelope> = events_by_stream
            .values()
            .flat_map(|v| v.iter())
            .chain(default_events.iter())
            .collect();

        let metadata = Self::compute_metadata(&all_events, &events_by_stream);

        Ok(Self {
            events_by_stream,
            default_events,
            metadata,
        })
    }

    pub(crate) fn compute_metadata(
        all_events: &[&EventEnvelope],
        events_by_stream: &HashMap<StreamId, Vec<EventEnvelope>>,
    ) -> RecordingMetadata {
        if all_events.is_empty() {
            return RecordingMetadata::empty();
        }

        let mut sorted: Vec<_> = all_events.iter().collect();
        sorted.sort_by_key(|e| e.occurred_at);

        let start_time = sorted.first().map(|e| e.occurred_at);
        let end_time = sorted.last().map(|e| e.occurred_at);
        let duration = match (start_time, end_time) {
            (Some(start), Some(end)) => Some(end - start),
            _ => None,
        };
        let tenant_id = sorted.first().map(|e| e.tenant_id.clone());
        let streams: Vec<StreamId> = events_by_stream.keys().cloned().collect();
        let stream_event_counts: HashMap<StreamId, usize> = events_by_stream
            .iter()
            .map(|(k, v)| (k.clone(), v.len()))
            .collect();

        RecordingMetadata {
            event_count: all_events.len(),
            start_time,
            end_time,
            duration,
            tenant_id,
            streams,
            stream_event_counts,
        }
    }

    /// Get recording metadata
    pub fn metadata(&self) -> &RecordingMetadata {
        &self.metadata
    }

    /// Get all events from all streams, sorted by occurred_at
    pub fn all_events(&self) -> Vec<&EventEnvelope> {
        let mut events: Vec<&EventEnvelope> = self
            .events_by_stream
            .values()
            .flat_map(|v| v.iter())
            .chain(self.default_events.iter())
            .collect();
        events.sort_by_key(|e| e.occurred_at);
        events
    }

    /// Consume the player and return all events
    pub fn into_all_events(self) -> Vec<EventEnvelope> {
        let mut events: Vec<EventEnvelope> = self
            .events_by_stream
            .into_values()
            .flatten()
            .chain(self.default_events)
            .collect();
        events.sort_by_key(|e| e.occurred_at);
        events
    }

    /// Get events for a specific stream
    pub fn stream_events(&self, stream_id: &StreamId) -> &[EventEnvelope] {
        self.events_by_stream
            .get(stream_id)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Get events without a stream ID
    pub fn default_events(&self) -> &[EventEnvelope] {
        &self.default_events
    }

    /// Get list of streams in the recording
    pub fn streams(&self) -> Vec<&StreamId> {
        self.events_by_stream.keys().collect()
    }

    /// Get the number of events
    pub fn len(&self) -> usize {
        self.metadata.event_count
    }

    /// Check if the bag is empty
    pub fn is_empty(&self) -> bool {
        self.metadata.event_count == 0
    }

    /// Filter events by time range across all streams
    pub fn events_in_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> impl Iterator<Item = &EventEnvelope> {
        self.all_events()
            .into_iter()
            .filter(move |e| e.occurred_at >= start && e.occurred_at <= end)
    }

    /// Filter events by event type across all streams
    pub fn events_of_type<'a>(
        &'a self,
        event_type: &'a str,
    ) -> impl Iterator<Item = &'a EventEnvelope> + 'a {
        self.all_events()
            .into_iter()
            .filter(move |e| e.event_type == event_type)
    }
}

