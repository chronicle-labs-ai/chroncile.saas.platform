//! Data Loading
//!
//! Functions for loading data from the API.

use std::sync::Arc;
use tokio::sync::mpsc;

use crate::client::SseStream;

#[cfg(feature = "native")]
use super::toast::Toast;
use super::EventsManagerApp;

impl EventsManagerApp {
    pub(super) fn check_connection(&mut self) {
        let client = Arc::clone(&self.client);

        #[cfg(not(target_arch = "wasm32"))]
        {
            let rt = Arc::clone(&self.runtime);
            std::thread::spawn(move || {
                let result = rt.block_on(client.health());
                match result {
                    Ok(health) => {
                        tracing::info!(
                            "Connected to server: {} v{}",
                            health.status,
                            health.version
                        );
                    }
                    Err(e) => {
                        tracing::warn!("Failed to connect: {}", e);
                    }
                }
            });
        }

        #[cfg(target_arch = "wasm32")]
        {
            wasm_bindgen_futures::spawn_local(async move {
                match client.health().await {
                    Ok(health) => {
                        tracing::info!(
                            "Connected to server: {} v{}",
                            health.status,
                            health.version
                        );
                    }
                    Err(e) => {
                        tracing::warn!("Failed to connect: {}", e);
                    }
                }
            });
        }
    }

    pub(super) fn start_sse_stream(&mut self) {
        let (tx, rx) = mpsc::unbounded_channel();
        self._sse_stream = Some(SseStream::start(
            self.server_url.clone(),
            "/api/stream".to_string(),
            tx,
        ));
        self.event_receiver = Some(rx);
        self.connected = true;
        self.timeline_view.stream_connected = true;
        self.status_message = "Connected".to_string();
    }

    pub(super) fn load_connections(&mut self) {
        let client = Arc::clone(&self.client);

        #[cfg(not(target_arch = "wasm32"))]
        {
            let rt = Arc::clone(&self.runtime);
            let connections = rt.block_on(async { client.list_connections().await });
            match connections {
                Ok(conns) => self.connections_view.set_connections(conns),
                Err(e) => {
                    tracing::warn!("Failed to load connections: {}", e);
                    self.add_toast(Toast::error(format!("Failed to load connections: {}", e)));
                }
            }
        }

        #[cfg(target_arch = "wasm32")]
        {
            let (tx, rx) = mpsc::unbounded_channel();
            self.connections_rx = Some(rx);
            wasm_bindgen_futures::spawn_local(async move {
                let result = client.list_connections().await;
                let _ = tx.send(result);
            });
            tracing::info!("Loading connections (web)...");
        }
    }

    pub(super) fn load_scenarios(&mut self) {
        let client = Arc::clone(&self.client);

        #[cfg(not(target_arch = "wasm32"))]
        {
            let rt = Arc::clone(&self.runtime);
            let scenarios = rt.block_on(async { client.list_scenarios().await });
            match scenarios {
                Ok(s) => self.connections_view.set_scenarios(s),
                Err(e) => tracing::warn!("Failed to load scenarios: {}", e),
            }
        }

        #[cfg(target_arch = "wasm32")]
        {
            let (tx, rx) = mpsc::unbounded_channel();
            self.scenarios_rx = Some(rx);
            wasm_bindgen_futures::spawn_local(async move {
                let result = client.list_scenarios().await;
                let _ = tx.send(result);
            });
            tracing::info!("Loading scenarios (web)...");
        }
    }

    /// Load sources metadata from the Source Abstraction Layer (once on startup)
    pub(super) fn load_sources(&mut self) {
        let client = Arc::clone(&self.client);

        #[cfg(not(target_arch = "wasm32"))]
        {
            let rt = Arc::clone(&self.runtime);
            let sources = rt.block_on(async { client.list_sources().await });
            match sources {
                Ok(sources) => {
                    tracing::info!("Loaded {} sources from API", sources.len());
                    self.sources_cache.set_sources(sources.clone());

                    // Load catalogs for each source
                    for source in &sources {
                        let catalog =
                            rt.block_on(async { client.get_source_catalog(&source.id).await });
                        match catalog {
                            Ok(events) => {
                                tracing::info!(
                                    "Loaded {} event types for source '{}'",
                                    events.len(),
                                    source.id
                                );
                                self.sources_cache.add_catalog(&source.id, events);
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Failed to load catalog for source '{}': {}",
                                    source.id,
                                    e
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to load sources: {}", e);
                }
            }
        }

        #[cfg(target_arch = "wasm32")]
        {
            let (tx, rx) = mpsc::unbounded_channel();
            self.sources_rx = Some(rx);
            wasm_bindgen_futures::spawn_local(async move {
                let result = client.list_sources().await;
                let _ = tx.send(result);
            });
            tracing::info!("Loading sources (web)...");
        }
    }

    /// Load catalog for a specific source (web only - called after sources are loaded)
    #[cfg(target_arch = "wasm32")]
    pub(super) fn load_source_catalog(&mut self, source_id: String) {
        let client = Arc::clone(&self.client);
        let (tx, rx) = mpsc::unbounded_channel();
        self.catalog_rx = Some(rx);

        wasm_bindgen_futures::spawn_local(async move {
            let result = client.get_source_catalog(&source_id).await;
            let _ = tx.send(result.map(|events| (source_id, events)));
        });
    }

    #[allow(dead_code)]
    pub(super) fn load_timeline(&mut self, conversation_id: &str) {
        tracing::info!("load_timeline called with: {}", conversation_id);

        let client = Arc::clone(&self.client);
        let conv_id = conversation_id.to_string();

        #[cfg(not(target_arch = "wasm32"))]
        {
            let rt = Arc::clone(&self.runtime);
            let timeline = rt.block_on(async { client.get_timeline(&conv_id).await });

            match timeline {
                Ok(t) => {
                    let count = t.events.len();
                    self.timeline_view.set_events(t.events);
                    self.add_toast(Toast::success(format!("Loaded {} events", count)));
                }
                Err(e) => {
                    tracing::warn!("Failed to load timeline: {}", e);
                    self.add_toast(Toast::error(format!("Failed to load timeline: {}", e)));
                }
            }
        }

        #[cfg(target_arch = "wasm32")]
        {
            tracing::info!("Starting timeline fetch for: {}", conv_id);
            let (tx, rx) = mpsc::unbounded_channel();
            self.timeline_rx = Some(rx);
            let conv_id_clone = conv_id.clone();
            wasm_bindgen_futures::spawn_local(async move {
                tracing::info!("Fetching timeline for: {}", conv_id_clone);
                let result = client.get_timeline(&conv_id_clone).await;
                match &result {
                    Ok(t) => {
                        tracing::info!("Timeline fetch succeeded: {} events", t.events.len())
                    }
                    Err(e) => tracing::warn!("Timeline fetch failed: {}", e),
                }
                let _ = tx.send(result);
            });
        }
    }

    /// Load events using the new tenant+time based query model
    pub(super) fn load_events(&mut self) {
        let client = Arc::clone(&self.client);
        let query = self.timeline_view.get_query();

        #[cfg(not(target_arch = "wasm32"))]
        {
            let rt = Arc::clone(&self.runtime);
            let result = rt.block_on(async { client.query_events(&query).await });

            match result {
                Ok(response) => {
                    let count = response.events.len();
                    self.timeline_view.set_available_filters(
                        response.sources.clone(),
                        response.event_types.clone(),
                    );
                    self.timeline_view.set_events(response.events);
                    self.add_toast(Toast::success(format!("Loaded {} events", count)));
                }
                Err(e) => {
                    tracing::warn!("Failed to query events: {}", e);
                    self.add_toast(Toast::error(format!("Failed to load events: {}", e)));
                }
            }
        }

        #[cfg(target_arch = "wasm32")]
        {
            tracing::info!("Starting events query");
            let (tx, rx) = mpsc::unbounded_channel();
            self.query_events_rx = Some(rx);
            wasm_bindgen_futures::spawn_local(async move {
                tracing::info!("Querying events with filters");
                let result = client.query_events(&query).await;
                match &result {
                    Ok(r) => tracing::info!("Query succeeded: {} events", r.events.len()),
                    Err(e) => tracing::warn!("Query failed: {}", e),
                }
                let _ = tx.send(result);
            });
        }
    }
}

