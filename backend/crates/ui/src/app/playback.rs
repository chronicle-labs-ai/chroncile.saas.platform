//! MCAP Playback functionality
//!
//! Handles loading and playing back MCAP recording files.

use chronicle_domain::recording::BagPlayer;
use chronicle_domain::EventEnvelope;

use super::toast::Toast;
use super::EventsManagerApp;
use crate::types::EventDto;
use crate::views::widgets::{Stream, StreamStatus};

impl EventsManagerApp {
    /// Handle playback actions (called every frame in update)
    pub(crate) fn handle_playback(&mut self) {
        // Check if user requested to add a stream (load MCAP file)
        if self.timeline_view.add_stream_requested {
            self.timeline_view.add_stream_requested = false;
            self.open_mcap_file();
        }
    }

    /// Open file picker and load an MCAP file
    fn open_mcap_file(&mut self) {
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("MCAP Recording", &["mcap"])
                .pick_file()
            {
                let filename = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "recording.mcap".to_string());

                match BagPlayer::open(&path) {
                    Ok(player) => {
                        self.load_mcap_player(player, &filename);
                    }
                    Err(e) => {
                        self.add_toast(Toast::error(format!("Failed to open MCAP: {}", e)));
                    }
                }
            }
        }

        #[cfg(target_arch = "wasm32")]
        {
            self.add_toast(Toast::warning("MCAP file loading not yet supported on web"));
        }
    }

    /// Load events from a BagPlayer into the timeline
    fn load_mcap_player(&mut self, player: BagPlayer, filename: &str) {
        let metadata = player.metadata().clone();
        let event_count = metadata.event_count;

        // Generate a unique stream ID
        let stream_id = format!("mcap_{}", ulid::Ulid::new());

        // Convert events to DTOs
        let events: Vec<EventDto> = player
            .into_all_events()
            .into_iter()
            .map(|env| Self::envelope_to_dto(env, &stream_id))
            .collect();

        // Add the stream to the streams panel
        let mut stream = Stream::mcap_file(&stream_id, Some(filename.to_string()));
        stream.status = StreamStatus::Completed;
        stream.event_count = event_count;
        self.timeline_view.streams_panel.add_stream(stream);

        // Add events to the timeline (bypasses live filters)
        self.timeline_view.add_events_from_playback(events);

        // Show success message with metadata
        let duration_str = metadata
            .duration
            .map(|d| format!("{}s", d.num_seconds()))
            .unwrap_or_else(|| "unknown".to_string());

        self.add_toast(Toast::success(format!(
            "Loaded {} events from {} (duration: {})",
            event_count, filename, duration_str
        )));

        tracing::info!(
            "Loaded MCAP file: {} events, streams: {:?}",
            event_count,
            metadata.streams
        );
    }

    /// Convert EventEnvelope to EventDto for UI display
    fn envelope_to_dto(envelope: EventEnvelope, stream_id: &str) -> EventDto {
        // Extract actor info
        let (actor_type, actor_id, actor_name) = match &envelope.actor.actor_type {
            chronicle_domain::ActorType::Customer => (
                "customer".to_string(),
                envelope.actor.actor_id.clone(),
                envelope.actor.display_name.clone(),
            ),
            chronicle_domain::ActorType::Agent => (
                "agent".to_string(),
                envelope.actor.actor_id.clone(),
                envelope.actor.display_name.clone(),
            ),
            chronicle_domain::ActorType::System => (
                "system".to_string(),
                envelope.actor.actor_id.clone(),
                envelope.actor.display_name.clone(),
            ),
            chronicle_domain::ActorType::Bot => (
                "bot".to_string(),
                envelope.actor.actor_id.clone(),
                envelope.actor.display_name.clone(),
            ),
        };

        // Parse payload from RawValue to Value
        let payload: serde_json::Value = serde_json::from_str(envelope.payload.get())
            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

        EventDto {
            event_id: envelope.event_id.to_string(),
            tenant_id: envelope.tenant_id.as_str().to_string(),
            source: envelope.source,
            source_event_id: envelope.source_event_id,
            event_type: envelope.event_type,
            conversation_id: envelope.subject.conversation_id.as_str().to_string(),
            actor_type,
            actor_id,
            actor_name,
            occurred_at: envelope.occurred_at,
            ingested_at: envelope.ingested_at,
            payload,
            contains_pii: envelope.pii.contains_pii,
            stream_id: Some(stream_id.to_string()),
        }
    }
}
