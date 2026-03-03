//! MCAP Recording
//!
//! Record and playback event streams using the MCAP format.
//! MCAP is a container format for heterogeneous timestamped data,
//! originally designed as a modern successor to ROS bags.
//!
//! ## Multi-Stream Support
//!
//! MCAP supports multiple channels, which we use to record events from
//! different streams separately. This allows:
//! - Recording multiple streams in a single bag file
//! - Preserving stream identity for playback
//! - Filtering by stream during playback
//!
//! Use cases:
//! - Recording event streams for AI agent evaluation
//! - Replay for debugging and testing
//! - Training data capture

mod player;
mod recorder;
mod types;

pub use player::BagPlayer;
pub use recorder::BagRecorder;
pub use types::{RecordingError, RecordingMetadata, CHANNEL_PREFIX, EVENT_ENVELOPE_SCHEMA};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{new_event_id, Actor, EventEnvelope, StreamId, Subject, TenantId};
    use chrono::Utc;
    use serde_json::value::RawValue;
    use std::collections::HashMap;
    use std::io::Cursor;

    fn make_test_event(
        occurred_at: chrono::DateTime<Utc>,
        event_type: &str,
        stream_id: Option<StreamId>,
    ) -> EventEnvelope {
        let payload = RawValue::from_string(r#"{"message": "test"}"#.to_string()).unwrap();
        EventEnvelope {
            event_id: new_event_id(),
            tenant_id: TenantId::new("test_tenant"),
            source: "test_source".to_string(),
            source_event_id: new_event_id().to_string(),
            event_type: event_type.to_string(),
            subject: Subject::new("conv_1"),
            actor: Actor::customer("cust_1"),
            occurred_at,
            ingested_at: Utc::now(),
            schema_version: 1,
            payload,
            pii: Default::default(),
            permissions: Default::default(),
            stream_id,
        }
    }

    #[test]
    fn test_record_and_playback() {
        let now = Utc::now();
        let events = vec![
            make_test_event(
                now - chrono::Duration::seconds(2),
                "support.message.customer",
                None,
            ),
            make_test_event(
                now - chrono::Duration::seconds(1),
                "support.message.agent",
                None,
            ),
            make_test_event(now, "ticket.status_changed", None),
        ];

        // Record to an in-memory buffer
        let buffer = Cursor::new(Vec::new());
        let mut recorder = BagRecorder::new(buffer).unwrap();

        for event in &events {
            recorder.record(event).unwrap();
        }

        let metadata = recorder.finish().unwrap();
        assert_eq!(metadata.event_count, 3);
        assert!(metadata.duration.is_some());
    }

    #[test]
    fn test_multi_stream_recording() {
        let now = Utc::now();
        let stream1 = StreamId::new("stream_1");
        let stream2 = StreamId::new("stream_2");

        let events = vec![
            make_test_event(
                now - chrono::Duration::seconds(3),
                "event.a",
                Some(stream1.clone()),
            ),
            make_test_event(
                now - chrono::Duration::seconds(2),
                "event.b",
                Some(stream2.clone()),
            ),
            make_test_event(
                now - chrono::Duration::seconds(1),
                "event.c",
                Some(stream1.clone()),
            ),
            make_test_event(now, "event.d", None), // No stream
        ];

        // Record
        let buffer = Cursor::new(Vec::new());
        let mut recorder = BagRecorder::new(buffer).unwrap();

        for event in &events {
            recorder.record(event).unwrap();
        }

        let metadata = recorder.finish().unwrap();
        assert_eq!(metadata.event_count, 4);
        assert_eq!(metadata.streams.len(), 2);
        assert_eq!(metadata.stream_event_counts.get(&stream1), Some(&2));
        assert_eq!(metadata.stream_event_counts.get(&stream2), Some(&1));
    }

    #[test]
    fn test_metadata() {
        let now = Utc::now();
        let start = now - chrono::Duration::minutes(5);
        let end = now;

        let events = vec![
            make_test_event(start, "event.a", None),
            make_test_event(end, "event.b", None),
        ];

        let refs: Vec<&EventEnvelope> = events.iter().collect();
        let metadata = BagPlayer::compute_metadata(&refs, &HashMap::new());

        assert_eq!(metadata.event_count, 2);
        assert_eq!(metadata.start_time, Some(start));
        assert_eq!(metadata.end_time, Some(end));
        assert!(metadata.duration.is_some());
    }

    #[test]
    fn test_empty_metadata() {
        let metadata = BagPlayer::compute_metadata(&[], &HashMap::new());
        assert_eq!(metadata.event_count, 0);
        assert!(metadata.start_time.is_none());
        assert!(metadata.end_time.is_none());
        assert!(metadata.duration.is_none());
    }
}

