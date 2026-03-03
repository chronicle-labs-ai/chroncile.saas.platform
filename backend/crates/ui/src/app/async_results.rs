//! Async Result Processing
//!
//! Handles receiving and processing async results from web API calls.

use super::toast::Toast;
use super::EventsManagerApp;

impl EventsManagerApp {
    /// Process async results from web requests
    pub(super) fn process_async_results(&mut self) {
        // Process connections result
        if let Some(ref mut rx) = self.connections_rx {
            if let Ok(result) = rx.try_recv() {
                match result {
                    Ok(conns) => {
                        tracing::info!("Loaded {} connections", conns.len());
                        self.connections_view.set_connections(conns);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load connections: {}", e);
                        self.add_toast(Toast::error(format!("Failed to load connections: {}", e)));
                    }
                }
                self.connections_rx = None;
            }
        }

        // Process scenarios result
        if let Some(ref mut rx) = self.scenarios_rx {
            if let Ok(result) = rx.try_recv() {
                match result {
                    Ok(scenarios) => {
                        tracing::info!("Loaded {} scenarios", scenarios.len());
                        self.connections_view.set_scenarios(scenarios);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load scenarios: {}", e);
                    }
                }
                self.scenarios_rx = None;
            }
        }

        // Process timeline result (legacy conversation-based)
        if let Some(ref mut rx) = self.timeline_rx {
            if let Ok(result) = rx.try_recv() {
                match result {
                    Ok(timeline) => {
                        let count = timeline.events.len();
                        self.timeline_view.set_events(timeline.events);
                        self.add_toast(Toast::success(format!("Loaded {} events", count)));
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load timeline: {}", e);
                        self.add_toast(Toast::error(format!("Failed to load timeline: {}", e)));
                    }
                }
                self.timeline_rx = None;
            }
        }

        // Process query events result (new tenant+time model)
        if let Some(ref mut rx) = self.query_events_rx {
            if let Ok(result) = rx.try_recv() {
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
                self.query_events_rx = None;
            }
        }

        // Process sources result (from Source Abstraction Layer)
        #[cfg(target_arch = "wasm32")]
        if let Some(ref mut rx) = self.sources_rx {
            if let Ok(result) = rx.try_recv() {
                match result {
                    Ok(sources) => {
                        tracing::info!("Loaded {} sources from API", sources.len());
                        self.sources_cache.set_sources(sources.clone());

                        // Queue catalog loads for each source
                        for source in sources {
                            self.load_source_catalog(source.id);
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load sources: {}", e);
                    }
                }
                self.sources_rx = None;
            }
        }

        // Process source catalog result
        #[cfg(target_arch = "wasm32")]
        if let Some(ref mut rx) = self.catalog_rx {
            if let Ok(result) = rx.try_recv() {
                match result {
                    Ok((source_id, events)) => {
                        tracing::info!(
                            "Loaded {} event types for source '{}'",
                            events.len(),
                            source_id
                        );
                        self.sources_cache.add_catalog(&source_id, events);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load source catalog: {}", e);
                    }
                }
                self.catalog_rx = None;
            }
        }
    }
}

