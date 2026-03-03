//! Replay State Machine
//!
//! Provides deterministic replay of events with multiple playback modes.
//! Implemented as an explicit state machine for correctness and clarity.

mod session;
mod state;
mod types;

pub use session::ReplaySession;
pub use state::ReplayState;
pub use types::{ReplayMode, ReplaySource};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{new_event_id, Actor, EventEnvelope, Subject, TenantId};
    use chrono::{DateTime, Utc};
    use serde_json::value::RawValue;

    fn make_test_event(occurred_at: DateTime<Utc>) -> EventEnvelope {
        let payload = RawValue::from_string("{}".to_string()).unwrap();
        EventEnvelope {
            event_id: new_event_id(),
            tenant_id: TenantId::new("test"),
            source: "test".to_string(),
            source_event_id: new_event_id().to_string(),
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
    fn test_replay_session_lifecycle() {
        let now = Utc::now();
        let events = vec![
            make_test_event(now - chrono::Duration::seconds(2)),
            make_test_event(now - chrono::Duration::seconds(1)),
            make_test_event(now),
        ];

        let mut session = ReplaySession::new("sess_1", "tenant_1", "conv_1", ReplayMode::Instant);

        assert!(matches!(session.state, ReplayState::Loading { .. }));

        session.load_events(events);
        assert!(matches!(session.state, ReplayState::Ready { .. }));

        session.start();
        assert!(matches!(session.state, ReplayState::Playing { .. }));

        // Advance through all events
        assert!(session.advance().is_some());
        assert!(session.advance().is_some());
        assert!(session.advance().is_some());
        assert!(session.advance().is_none());

        assert!(session.state.is_completed());
    }

    #[test]
    fn test_step_mode() {
        let now = Utc::now();
        let events = vec![
            make_test_event(now - chrono::Duration::seconds(1)),
            make_test_event(now),
        ];

        let mut session = ReplaySession::new("sess_1", "tenant_1", "conv_1", ReplayMode::Step);
        session.load_events(events);

        // Step mode advances one at a time from Ready state
        let e1 = session.step();
        assert!(e1.is_some());

        let e2 = session.step();
        assert!(e2.is_some());

        let e3 = session.step();
        assert!(e3.is_none());
        assert!(session.state.is_completed());
    }

    #[test]
    fn test_pause_resume() {
        let now = Utc::now();
        let events = vec![
            make_test_event(now - chrono::Duration::seconds(1)),
            make_test_event(now),
        ];

        let mut session = ReplaySession::new("sess_1", "tenant_1", "conv_1", ReplayMode::Instant);
        session.load_events(events);
        session.start();

        session.advance(); // Advance one

        session.pause();
        assert!(matches!(session.state, ReplayState::Paused { index: 1, .. }));

        session.start();
        assert!(matches!(session.state, ReplayState::Playing { index: 1, .. }));
    }

    #[test]
    fn test_progress() {
        let now = Utc::now();
        let events = vec![
            make_test_event(now - chrono::Duration::seconds(2)),
            make_test_event(now - chrono::Duration::seconds(1)),
            make_test_event(now),
        ];

        let mut session = ReplaySession::new("sess_1", "tenant_1", "conv_1", ReplayMode::Instant);
        session.load_events(events);

        assert_eq!(session.progress(), 0.0);

        session.start();
        session.advance();
        assert!((session.progress() - 0.333).abs() < 0.01);

        session.advance();
        assert!((session.progress() - 0.666).abs() < 0.01);

        session.advance();
        assert_eq!(session.progress(), 1.0);
    }

    #[test]
    fn test_empty_events() {
        let mut session = ReplaySession::new("sess_1", "tenant_1", "conv_1", ReplayMode::Instant);
        session.load_events(vec![]);

        assert!(session.state.is_completed());
    }
}

