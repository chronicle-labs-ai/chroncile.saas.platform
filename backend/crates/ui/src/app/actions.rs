//! Connection Actions
//!
//! Handles user actions from the connections view.

use std::sync::Arc;

use crate::views::ConnectionAction;

#[cfg(feature = "native")]
use super::toast::Toast;
use super::EventsManagerApp;

impl EventsManagerApp {
    pub(super) fn handle_connection_actions(&mut self) {
        let actions = self.connections_view.take_actions();
        let client = Arc::clone(&self.client);

        #[cfg(not(target_arch = "wasm32"))]
        let rt = Arc::clone(&self.runtime);

        for action in actions {
            match action {
                ConnectionAction::CreateConnection(service, name) => {
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        let result = rt
                            .block_on(async { client.create_connection(&service, Some(&name)).await });
                        match result {
                            Ok(_) => {
                                self.load_connections();
                                self.add_toast(Toast::success(format!(
                                    "Created connection: {}",
                                    name
                                )));
                            }
                            Err(e) => {
                                tracing::warn!("Failed to create connection: {}", e);
                                self.add_toast(Toast::error(format!("Failed: {}", e)));
                            }
                        }
                    }
                    #[cfg(target_arch = "wasm32")]
                    {
                        let client = Arc::clone(&client);
                        wasm_bindgen_futures::spawn_local(async move {
                            match client.create_connection(&service, Some(&name)).await {
                                Ok(_) => tracing::info!("Created connection"),
                                Err(e) => tracing::warn!("Failed to create connection: {}", e),
                            }
                        });
                    }
                }
                ConnectionAction::DeleteConnection(id) => {
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        let result = rt.block_on(async { client.delete_connection(&id).await });
                        match result {
                            Ok(_) => {
                                self.load_connections();
                                self.add_toast(Toast::info("Connection deleted"));
                            }
                            Err(e) => {
                                tracing::warn!("Failed to delete connection: {}", e);
                                self.add_toast(Toast::error(format!("Failed: {}", e)));
                            }
                        }
                    }
                    #[cfg(target_arch = "wasm32")]
                    {
                        let client = Arc::clone(&client);
                        wasm_bindgen_futures::spawn_local(async move {
                            match client.delete_connection(&id).await {
                                Ok(_) => tracing::info!("Deleted connection"),
                                Err(e) => tracing::warn!("Failed: {}", e),
                            }
                        });
                    }
                }
                ConnectionAction::GenerateEvents(id, count) => {
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        let result =
                            rt.block_on(async { client.generate_events(&id, count).await });
                        match result {
                            Ok(resp) => {
                                self.add_toast(Toast::success(resp.message));
                            }
                            Err(e) => {
                                tracing::warn!("Failed to generate events: {}", e);
                                self.add_toast(Toast::error(format!("Failed: {}", e)));
                            }
                        }
                    }
                    #[cfg(target_arch = "wasm32")]
                    {
                        let client = Arc::clone(&client);
                        wasm_bindgen_futures::spawn_local(async move {
                            match client.generate_events(&id, count).await {
                                Ok(_) => tracing::info!("Generated events"),
                                Err(e) => tracing::warn!("Failed: {}", e),
                            }
                        });
                    }
                }
                ConnectionAction::LoadScenario(name) => {
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        let result = rt.block_on(async { client.load_scenario(&name).await });
                        match result {
                            Ok(resp) => {
                                self.add_toast(Toast::success(resp.message));
                            }
                            Err(e) => {
                                tracing::warn!("Failed to load scenario: {}", e);
                                self.add_toast(Toast::error(format!("Failed: {}", e)));
                            }
                        }
                    }
                    #[cfg(target_arch = "wasm32")]
                    {
                        let client = Arc::clone(&client);
                        wasm_bindgen_futures::spawn_local(async move {
                            match client.load_scenario(&name).await {
                                Ok(_) => tracing::info!("Loaded scenario"),
                                Err(e) => tracing::warn!("Failed: {}", e),
                            }
                        });
                    }
                }
                ConnectionAction::RefreshConnections => {
                    self.load_connections();
                }
                ConnectionAction::RefreshScenarios => {
                    self.load_scenarios();
                }
            }
        }
    }

    /// Process incoming SSE events and add to timeline
    pub(super) fn process_incoming_events(&mut self) {
        // Collect events first to avoid borrow conflicts
        let mut incoming_events = Vec::new();
        if let Some(ref mut rx) = self.event_receiver {
            while let Ok(event) = rx.try_recv() {
                incoming_events.push(event);
            }
        }

        // Now process each event
        for event in incoming_events {
            // Record event if recording is active (native only)
            #[cfg(feature = "native")]
            self.maybe_record_event(&event);
            // Feed live events directly to the timeline view
            self.timeline_view.add_event(event);
        }
    }
}

