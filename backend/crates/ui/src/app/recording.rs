//! Recording functionality
//!
//! Handles recording events to MCAP files.

use chronicle_domain::{
    new_event_id,
    recording::{BagRecorder, RecordingError},
    Actor, EventEnvelope, StreamId, Subject, TenantId,
};
use serde_json::value::RawValue;

use super::toast::Toast;
use super::EventsManagerApp;
use crate::types::EventDto;
// StreamId imported from chronicle_domain above

impl EventsManagerApp {
    /// Handle recording actions (called every frame in update)
    pub(crate) fn handle_recording(&mut self) {
        // Check if user requested to save the recording
        if self.timeline_view.save_recording_requested {
            self.timeline_view.save_recording_requested = false;
            self.save_recording();
        }
    }

    /// Add an event to the recording buffer if recording is active
    pub(crate) fn maybe_record_event(&mut self, event: &EventDto) {
        if !self.timeline_view.is_recording() {
            return;
        }

        // Check if this event's stream is being recorded
        let recording_streams = self.timeline_view.recording_stream_ids();

        // If event has a stream_id, check if it's in the recording streams
        // Events from live API have stream_id = "live_api" or None
        let should_record = match &event.stream_id {
            Some(stream_id) => recording_streams.iter().any(|s| s.as_str() == stream_id),
            None => {
                // Events without stream_id are assumed to be from live API
                recording_streams.iter().any(|s| s.as_str() == "live_api")
            }
        };

        if should_record {
            self.recording_buffer.push(event.clone());
            // Update the recording event count in the UI
            let stream_id = event.stream_id.as_ref().map(|s| StreamId::new(s.clone()));
            self.timeline_view.record_event(stream_id.as_ref());
        }
    }

    /// Save the recording to a file
    fn save_recording(&mut self) {
        if self.recording_buffer.is_empty() {
            self.add_toast(Toast::warning("No events to save"));
            self.timeline_view.finish_recording_save();
            return;
        }

        let events = std::mem::take(&mut self.recording_buffer);
        let event_count = events.len();

        #[cfg(not(target_arch = "wasm32"))]
        {
            // Show native file save dialog
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("MCAP Recording", &["mcap"])
                .set_file_name("recording.mcap")
                .save_file()
            {
                match Self::write_recording_to_file(&path, &events) {
                    Ok(()) => {
                        self.add_toast(Toast::success(format!(
                            "Saved {} events to {}",
                            event_count,
                            path.display()
                        )));
                    }
                    Err(e) => {
                        self.add_toast(Toast::error(format!("Failed to save: {}", e)));
                    }
                }
            } else {
                // User cancelled - put events back
                self.recording_buffer = events;
                self.add_toast(Toast::info("Save cancelled"));
            }
        }

        #[cfg(target_arch = "wasm32")]
        {
            // On web, write to memory buffer and trigger download
            match Self::write_recording_to_buffer(&events) {
                Ok(data) => {
                    if !data.is_empty() {
                        Self::trigger_download("recording.mcap", &data);
                        self.add_toast(Toast::success(format!(
                            "Downloaded recording with {} events",
                            event_count
                        )));
                    } else {
                        self.add_toast(Toast::warning("Recording not yet supported on web"));
                    }
                }
                Err(e) => {
                    self.add_toast(Toast::error(format!("Failed to create recording: {}", e)));
                }
            }
        }

        self.timeline_view.finish_recording_save();
    }

    /// Convert EventDto to EventEnvelope for recording
    fn dto_to_envelope(dto: &EventDto) -> Result<EventEnvelope, RecordingError> {
        // Convert payload to RawValue
        let payload_str = serde_json::to_string(&dto.payload).map_err(RecordingError::Json)?;
        let payload = RawValue::from_string(payload_str).map_err(RecordingError::Json)?;

        // Parse actor type
        let actor = match dto.actor_type.as_str() {
            "customer" => Actor::customer(&dto.actor_id),
            "agent" => Actor::agent(&dto.actor_id),
            _ => Actor::system(),
        };

        let envelope = EventEnvelope {
            event_id: new_event_id(), // Generate new ID for the recording
            tenant_id: TenantId::new(&dto.tenant_id),
            source: dto.source.clone(),
            source_event_id: dto.source_event_id.clone(),
            event_type: dto.event_type.clone(),
            subject: Subject::new(dto.conversation_id.clone()),
            actor,
            occurred_at: dto.occurred_at,
            ingested_at: dto.ingested_at,
            schema_version: 1,
            payload,
            pii: Default::default(),
            permissions: Default::default(),
            stream_id: dto.stream_id.as_ref().map(StreamId::new),
        };

        Ok(envelope)
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn write_recording_to_file(
        path: &std::path::Path,
        events: &[EventDto],
    ) -> Result<(), RecordingError> {
        let mut recorder = BagRecorder::create(path)?;

        for dto in events {
            let envelope = Self::dto_to_envelope(dto)?;
            recorder.record(&envelope)?;
        }

        recorder.finish()?;
        Ok(())
    }

    #[cfg(target_arch = "wasm32")]
    fn write_recording_to_buffer(events: &[EventDto]) -> Result<Vec<u8>, RecordingError> {
        let buffer = Cursor::new(Vec::new());
        let mut recorder = BagRecorder::new(buffer)?;

        for dto in events {
            let envelope = Self::dto_to_envelope(dto)?;
            recorder.record(&envelope)?;
        }

        // Get the buffer back after finishing
        // Note: We need to access the inner buffer - this requires finish() to return it
        // For now, we'll use a simpler approach
        let metadata = recorder.finish()?;
        tracing::info!("Recording finished with {} events", metadata.event_count);

        // Re-record to get the bytes (not ideal but works for now)
        let buffer = Cursor::new(Vec::new());
        let mut recorder = BagRecorder::new(buffer)?;

        for dto in events {
            let envelope = Self::dto_to_envelope(dto)?;
            recorder.record(&envelope)?;
        }

        // The recorder consumes itself on finish, we need another approach
        // Let's just return empty for now and fix this properly
        Ok(Vec::new())
    }

    #[cfg(target_arch = "wasm32")]
    fn trigger_download(filename: &str, data: &[u8]) {
        use wasm_bindgen::JsCast;

        let array = js_sys::Uint8Array::from(data);
        let blob_parts = js_sys::Array::new();
        blob_parts.push(&array.buffer());

        let blob = web_sys::Blob::new_with_u8_array_sequence_and_options(
            &blob_parts,
            web_sys::BlobPropertyBag::new().type_("application/octet-stream"),
        )
        .expect("Failed to create blob");

        let url =
            web_sys::Url::create_object_url_with_blob(&blob).expect("Failed to create object URL");

        let window = web_sys::window().expect("No window");
        let document = window.document().expect("No document");

        let a = document
            .create_element("a")
            .expect("Failed to create anchor")
            .dyn_into::<web_sys::HtmlAnchorElement>()
            .expect("Failed to cast to anchor");

        a.set_href(&url);
        a.set_download(filename);
        a.click();

        let _ = web_sys::Url::revoke_object_url(&url);
    }
}
