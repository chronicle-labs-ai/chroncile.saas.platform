//! MCAP Recorder
//!
//! Records EventEnvelope messages to MCAP files with multi-stream support.

use std::borrow::Cow;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufWriter, Seek, Write};
use std::path::Path;

use chrono::{DateTime, Utc};
use mcap::records::MessageHeader;
use mcap::{Channel, Schema};

use crate::{EventEnvelope, StreamId, TenantId};

use super::types::{RecordingError, RecordingMetadata, CHANNEL_PREFIX, EVENT_ENVELOPE_SCHEMA};

/// Records EventEnvelope messages to an MCAP file with multi-stream support
///
/// Each stream gets its own MCAP channel, allowing events to be grouped
/// and filtered by stream during playback.
pub struct BagRecorder<'a, W: Write + Seek> {
    writer: mcap::Writer<'a, W>,
    /// Channel IDs by stream ID
    channels: HashMap<StreamId, u16>,
    /// Default channel for events without stream_id
    default_channel_id: u16,
    /// Next channel ID to assign
    next_channel_id: u16,
    /// Event counts per stream
    stream_event_counts: HashMap<StreamId, usize>,
    /// Total event count
    event_count: usize,
    start_time: Option<DateTime<Utc>>,
    end_time: Option<DateTime<Utc>>,
    tenant_id: Option<TenantId>,
}

impl BagRecorder<'static, BufWriter<File>> {
    /// Create a new recorder that writes to a file
    pub fn create(path: impl AsRef<Path>) -> Result<Self, RecordingError> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        Self::new(writer)
    }
}

impl<'a, W: Write + Seek> BagRecorder<'a, W> {
    /// Create a new recorder with a custom writer
    pub fn new(writer: W) -> Result<Self, RecordingError> {
        let mut mcap_writer = mcap::Writer::new(writer)?;

        // Register the JSON schema for EventEnvelope
        let schema = Schema {
            name: "EventEnvelope".into(),
            encoding: "jsonschema".into(),
            data: Cow::Borrowed(EVENT_ENVELOPE_SCHEMA.as_bytes()),
        };

        // Create default channel for events without stream_id
        let default_channel = Channel {
            topic: format!("{}/default", CHANNEL_PREFIX),
            schema: Some(schema.into()),
            message_encoding: "json".into(),
            metadata: Default::default(),
        };

        let default_channel_id = mcap_writer.add_channel(&default_channel)?;

        Ok(Self {
            writer: mcap_writer,
            channels: HashMap::new(),
            default_channel_id,
            next_channel_id: default_channel_id + 1,
            stream_event_counts: HashMap::new(),
            event_count: 0,
            start_time: None,
            end_time: None,
            tenant_id: None,
        })
    }

    /// Pre-register a stream channel (optional - channels are auto-created on first event)
    pub fn register_stream(&mut self, stream_id: &StreamId) -> Result<(), RecordingError> {
        if self.channels.contains_key(stream_id) {
            return Ok(());
        }

        let schema = Schema {
            name: "EventEnvelope".into(),
            encoding: "jsonschema".into(),
            data: Cow::Borrowed(EVENT_ENVELOPE_SCHEMA.as_bytes()),
        };

        let channel = Channel {
            topic: format!("{}/{}", CHANNEL_PREFIX, stream_id.as_str()),
            schema: Some(schema.into()),
            message_encoding: "json".into(),
            metadata: Default::default(),
        };

        let channel_id = self.writer.add_channel(&channel)?;
        self.channels.insert(stream_id.clone(), channel_id);
        self.next_channel_id = channel_id + 1;

        Ok(())
    }

    /// Get or create a channel for a stream
    fn get_or_create_channel(&mut self, stream_id: &StreamId) -> Result<u16, RecordingError> {
        if let Some(&channel_id) = self.channels.get(stream_id) {
            return Ok(channel_id);
        }

        self.register_stream(stream_id)?;
        Ok(*self.channels.get(stream_id).unwrap())
    }

    /// Record an event to the bag file
    pub fn record(&mut self, event: &EventEnvelope) -> Result<(), RecordingError> {
        // Determine which channel to use
        let channel_id = match &event.stream_id {
            Some(stream_id) => self.get_or_create_channel(stream_id)?,
            None => self.default_channel_id,
        };

        // Serialize the event to JSON
        let json = serde_json::to_vec(event)?;

        // Convert occurred_at to nanoseconds since Unix epoch
        let log_time = event.occurred_at.timestamp_nanos_opt().unwrap_or(0) as u64;
        let publish_time = event.ingested_at.timestamp_nanos_opt().unwrap_or(0) as u64;

        // Write the message
        self.writer.write_to_known_channel(
            &MessageHeader {
                channel_id,
                sequence: self.event_count as u32,
                log_time,
                publish_time,
            },
            &json,
        )?;

        // Update metadata
        self.event_count += 1;

        if let Some(stream_id) = &event.stream_id {
            *self
                .stream_event_counts
                .entry(stream_id.clone())
                .or_insert(0) += 1;
        }

        if self.start_time.is_none() {
            self.start_time = Some(event.occurred_at);
            self.tenant_id = Some(event.tenant_id.clone());
        }
        self.end_time = Some(event.occurred_at);

        Ok(())
    }

    /// Finish writing and close the bag file
    pub fn finish(mut self) -> Result<RecordingMetadata, RecordingError> {
        self.writer.finish()?;

        let duration = match (self.start_time, self.end_time) {
            (Some(start), Some(end)) => Some(end - start),
            _ => None,
        };

        let streams: Vec<StreamId> = self.channels.keys().cloned().collect();

        Ok(RecordingMetadata {
            event_count: self.event_count,
            start_time: self.start_time,
            end_time: self.end_time,
            duration,
            tenant_id: self.tenant_id,
            streams,
            stream_event_counts: self.stream_event_counts,
        })
    }

    /// Get the current event count
    pub fn event_count(&self) -> usize {
        self.event_count
    }
}
