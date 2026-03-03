//! Server-Sent Events (SSE) Stream
//!
//! Cross-platform SSE streaming for receiving live events.

use tokio::sync::mpsc;

use crate::types::EventDto;

// ========== SSE Stream - Native ==========

#[cfg(not(target_arch = "wasm32"))]
pub struct SseStream {
    _handle: std::thread::JoinHandle<()>,
}

#[cfg(not(target_arch = "wasm32"))]
impl SseStream {
    /// Start streaming events from the API
    /// Uses a dedicated thread with its own tokio runtime for egui compatibility
    pub fn start(base_url: String, path: String, sender: mpsc::UnboundedSender<EventDto>) -> Self {
        let handle = std::thread::spawn(move || {
            // Create a new tokio runtime for this thread
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("Failed to create tokio runtime for SSE");

            rt.block_on(async move {
                let url = format!("{}{}", base_url, path);
                tracing::info!("Starting SSE stream from {}", url);

                match eventsource_client::ClientBuilder::for_url(&url) {
                    Ok(builder) => {
                        use eventsource_client::Client;
                        use futures::StreamExt;
                        let mut stream = builder.build().stream();

                        while let Some(event) = stream.next().await {
                            match event {
                                Ok(eventsource_client::SSE::Event(ev)) => {
                                    if ev.event_type == "event" {
                                        if let Ok(dto) = serde_json::from_str::<EventDto>(&ev.data)
                                        {
                                            if sender.send(dto).is_err() {
                                                break;
                                            }
                                        }
                                    }
                                }
                                Ok(eventsource_client::SSE::Comment(_)) => {}
                                Ok(eventsource_client::SSE::Connected(_)) => {
                                    tracing::info!("SSE connected");
                                }
                                Err(e) => {
                                    tracing::warn!("SSE error: {:?}", e);
                                    break;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to create SSE client: {}", e);
                    }
                }
            });
        });

        Self { _handle: handle }
    }
}

// ========== SSE Stream - Web ==========

#[cfg(target_arch = "wasm32")]
pub struct SseStream {
    _es: gloo_net::eventsource::futures::EventSource,
}

#[cfg(target_arch = "wasm32")]
impl SseStream {
    /// Start streaming events from the API (web version using EventSource)
    pub fn start(base_url: String, path: String, sender: mpsc::UnboundedSender<EventDto>) -> Self {
        use futures::StreamExt;
        use gloo_net::eventsource::futures::EventSource;

        let url = format!("{}{}", base_url, path);
        tracing::info!("Starting SSE stream from {}", url);

        let mut es = EventSource::new(&url).expect("Failed to create EventSource");
        let mut subscription = es.subscribe("event").expect("Failed to subscribe");

        // Spawn the event handler
        wasm_bindgen_futures::spawn_local(async move {
            while let Some(Ok((_, msg))) = subscription.next().await {
                if let Ok(dto) = serde_json::from_str::<EventDto>(
                    &msg.data().as_string().unwrap_or_default(),
                ) {
                    if sender.send(dto).is_err() {
                        break;
                    }
                }
            }
        });

        Self { _es: es }
    }
}

