//! Main Application
//!
//! Cross-platform egui application with Anduril design system.
//! Unified live timeline view combining SSE streaming with event visualization.

mod actions;
mod async_results;
mod data_loading;
#[cfg(feature = "native")]
mod playback;
#[cfg(feature = "native")]
mod recording;
mod render;
mod toast;

use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::mpsc;

#[cfg(not(target_arch = "wasm32"))]
use tokio::runtime::Runtime;

use crate::client::{ApiClient, SseStream};
use crate::sources_cache::SourcesCache;
use crate::types::EventDto;
#[cfg(target_arch = "wasm32")]
use crate::types::{EventTypeMeta, SourceSummary};
use crate::views::{ConnectionsView, TimelineView};

pub use toast::{Toast, ToastKind};

use crate::types::{ConnectionDto, EventsQueryResponse, ScenarioDto, TimelineDto};

/// Anduril-inspired color palette - re-export from design system for compatibility
pub mod colors {
    pub use crate::design::compat::*;
}

/// Application state
pub struct EventsManagerApp {
    // Runtime for async operations (native only)
    #[cfg(not(target_arch = "wasm32"))]
    pub(crate) runtime: Arc<Runtime>,
    // API client
    pub(crate) client: Arc<ApiClient>,
    // Sources metadata cache (loaded once on startup)
    pub sources_cache: SourcesCache,
    // Views
    pub(crate) connections_view: ConnectionsView,
    pub(crate) timeline_view: TimelineView,
    // Current tab
    current_tab: Tab,
    // Server URL
    server_url: String,
    // Connection status
    connected: bool,
    #[allow(dead_code)]
    status_message: String,
    // SSE stream
    pub(crate) _sse_stream: Option<SseStream>,
    pub(crate) event_receiver: Option<mpsc::UnboundedReceiver<EventDto>>,
    // Notifications
    pub(crate) toasts: VecDeque<Toast>,
    // Async result receivers (for web)
    pub(crate) connections_rx: Option<mpsc::UnboundedReceiver<Result<Vec<ConnectionDto>, String>>>,
    pub(crate) scenarios_rx: Option<mpsc::UnboundedReceiver<Result<Vec<ScenarioDto>, String>>>,
    pub(crate) timeline_rx: Option<mpsc::UnboundedReceiver<Result<TimelineDto, String>>>,
    /// Query events result (new tenant-based model)
    pub(crate) query_events_rx:
        Option<mpsc::UnboundedReceiver<Result<EventsQueryResponse, String>>>,
    /// Sources metadata result (from Source Abstraction Layer)
    #[cfg(target_arch = "wasm32")]
    pub(crate) sources_rx: Option<mpsc::UnboundedReceiver<Result<Vec<SourceSummary>, String>>>,
    /// Source catalog results (event type metadata)
    #[cfg(target_arch = "wasm32")]
    pub(crate) catalog_rx:
        Option<mpsc::UnboundedReceiver<Result<(String, Vec<EventTypeMeta>), String>>>,
    /// Recording buffer - stores events while recording is active (native only)
    #[cfg(feature = "native")]
    pub(crate) recording_buffer: Vec<EventDto>,
}

#[derive(Clone, Copy, PartialEq)]
enum Tab {
    Events,
    Connections,
}

impl EventsManagerApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        // Configure dark theme
        Self::configure_style(&cc.egui_ctx);

        // Get server URL - on web, check URL params or use default API port; on native, use env or default
        #[cfg(target_arch = "wasm32")]
        let server_url = {
            // First check for ?api_url= query param
            let param_url = web_sys::window()
                .and_then(|w| w.location().search().ok())
                .and_then(|search| {
                    search
                        .trim_start_matches('?')
                        .split('&')
                        .find(|p| p.starts_with("api_url="))
                        .map(|p| p.trim_start_matches("api_url=").to_string())
                });

            param_url.unwrap_or_else(|| {
                // Default: use same hostname but port 3000 (API server)
                web_sys::window()
                    .and_then(|w| w.location().hostname().ok())
                    .map(|host| format!("http://{}:3000", host))
                    .unwrap_or_else(|| "http://127.0.0.1:3000".to_string())
            })
        };
        #[cfg(not(target_arch = "wasm32"))]
        let server_url =
            std::env::var("API_URL").unwrap_or_else(|_| "http://127.0.0.1:3000".to_string());

        let client = Arc::new(ApiClient::new(&server_url));

        #[cfg(not(target_arch = "wasm32"))]
        let runtime = Arc::new(Runtime::new().expect("Failed to create tokio runtime"));

        let mut app = Self {
            #[cfg(not(target_arch = "wasm32"))]
            runtime,
            client,
            sources_cache: SourcesCache::new(),
            connections_view: ConnectionsView::new(),
            timeline_view: TimelineView::new(),
            current_tab: Tab::Events,
            server_url,
            connected: false,
            status_message: "Connecting...".to_string(),
            _sse_stream: None,
            event_receiver: None,
            toasts: VecDeque::new(),
            connections_rx: None,
            scenarios_rx: None,
            timeline_rx: None,
            query_events_rx: None,
            #[cfg(target_arch = "wasm32")]
            sources_rx: None,
            #[cfg(target_arch = "wasm32")]
            catalog_rx: None,
            #[cfg(feature = "native")]
            recording_buffer: Vec::new(),
        };

        // Initial data load
        app.check_connection();
        app.start_sse_stream();
        app.load_scenarios();
        // Load sources metadata (once, on startup)
        app.load_sources();
        // Load initial events for timeline
        app.load_events();

        app
    }

    fn configure_style(ctx: &egui::Context) {
        // Use the Anduril design system for mission-critical command interface styling
        crate::design::configure_style(ctx);
    }
}

impl eframe::App for EventsManagerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        use crate::design::{colors as ds_colors, rounding, spacing, typography};

        // Process incoming SSE events - feed to timeline
        self.process_incoming_events();

        // Process async results (web only, but harmless on native)
        self.process_async_results();

        // Handle any pending connection actions
        self.handle_connection_actions();

        // Handle recording save requests (native only)
        #[cfg(feature = "native")]
        self.handle_recording();

        // Handle playback requests (load MCAP files, native only)
        #[cfg(feature = "native")]
        self.handle_playback();

        // Check if timeline needs data reload (filter time window changed)
        if self.timeline_view.needs_reload {
            self.load_events();
            self.timeline_view.needs_reload = false;
        }

        // Request continuous repaints for live updates
        ctx.request_repaint();

        // Top panel - mission-critical header
        egui::TopBottomPanel::top("header")
            .frame(
                egui::Frame::none()
                    .fill(ds_colors::BG_SURFACE)
                    .stroke(egui::Stroke::new(1.0, ds_colors::BORDER_SUBTLE))
                    .inner_margin(egui::Margin::symmetric(spacing::LG, spacing::SM)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    // Logo - hard geometric indicator
                    ui.label(
                        egui::RichText::new("▣")
                            .color(ds_colors::ACCENT_TEAL)
                            .size(18.0),
                    );
                    ui.label(
                        egui::RichText::new("EVENTS MANAGER")
                            .color(ds_colors::TEXT_PRIMARY)
                            .font(typography::heading())
                            .strong(),
                    );

                    ui.add_space(spacing::XL);

                    // Navigation tabs - simplified to two tabs
                    let events_count = self.timeline_view.events.len();
                    let events_text = if events_count > 0 {
                        format!("EVENTS [{}]", events_count)
                    } else {
                        "EVENTS".to_string()
                    };

                    let tab_button =
                        |ui: &mut egui::Ui, selected: bool, text: &str| -> egui::Response {
                            let label = egui::RichText::new(text).font(typography::small()).color(
                                if selected {
                                    ds_colors::ACCENT_TEAL
                                } else {
                                    ds_colors::TEXT_SECONDARY
                                },
                            );
                            ui.selectable_label(selected, label)
                        };

                    if tab_button(ui, self.current_tab == Tab::Events, &events_text).clicked() {
                        self.current_tab = Tab::Events;
                    }

                    if tab_button(ui, self.current_tab == Tab::Connections, "CONNECTIONS").clicked()
                    {
                        self.current_tab = Tab::Connections;
                        self.load_connections();
                    }

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        // Status indicator - functional, not decorative
                        let (status_color, status_text) = if self.connected {
                            (ds_colors::STATUS_ONLINE, "ONLINE")
                        } else {
                            (ds_colors::STATUS_OFFLINE, "OFFLINE")
                        };

                        ui.horizontal(|ui| {
                            // Status dot - square for industrial feel
                            let (rect, _) =
                                ui.allocate_exact_size(egui::vec2(6.0, 6.0), egui::Sense::hover());
                            ui.painter().rect_filled(rect, rounding::NONE, status_color);

                            ui.label(
                                egui::RichText::new(status_text)
                                    .color(status_color)
                                    .font(typography::caption())
                                    .strong(),
                            );
                        });
                    });
                });
            });

        // Bottom panel - status bar (minimal, functional)
        egui::TopBottomPanel::bottom("footer")
            .frame(
                egui::Frame::none()
                    .fill(ds_colors::BG_SURFACE)
                    .stroke(egui::Stroke::new(1.0, ds_colors::BORDER_SUBTLE))
                    .inner_margin(egui::Margin::symmetric(spacing::LG, spacing::XS)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!("SRV {}", self.server_url))
                            .color(ds_colors::TEXT_MUTED)
                            .font(typography::caption()),
                    );

                    ui.add(egui::Separator::default().vertical().spacing(spacing::SM));

                    ui.label(
                        egui::RichText::new(format!("BUF {}", self.timeline_view.events.len()))
                            .color(ds_colors::TEXT_MUTED)
                            .font(typography::mono_small()),
                    );

                    if self.timeline_view.live_event_count > 0 {
                        ui.add(egui::Separator::default().vertical().spacing(spacing::SM));
                        ui.label(
                            egui::RichText::new(format!(
                                "+{} LIVE",
                                self.timeline_view.live_event_count
                            ))
                            .color(ds_colors::SIGNAL_GREEN)
                            .font(typography::mono_small()),
                        );
                    }

                    #[cfg(target_arch = "wasm32")]
                    {
                        ui.add(egui::Separator::default().vertical().spacing(spacing::SM));
                        ui.label(
                            egui::RichText::new("WASM")
                                .color(ds_colors::TEXT_DISABLED)
                                .font(typography::caption()),
                        );
                    }
                });
            });

        // Main content area
        egui::CentralPanel::default()
            .frame(
                egui::Frame::none()
                    .fill(ds_colors::BG_BASE)
                    .inner_margin(egui::Margin::same(spacing::MD)),
            )
            .show(ctx, |ui| {
                match self.current_tab {
                    Tab::Events => {
                        // Unified live timeline view
                        self.timeline_view.ui(ui);
                    }
                    Tab::Connections => {
                        // Pass sources from cache for API-driven dropdowns
                        self.connections_view
                            .ui_with_sources(ui, self.sources_cache.sources());
                    }
                }
            });

        // Render toasts on top
        self.render_toasts(ctx);
    }
}
