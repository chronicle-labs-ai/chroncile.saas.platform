//! Events Manager Timeline Widget
//!
//! An embeddable timeline viewer that can be used in React/web applications.
//! Built with egui and compiled to WebAssembly.
//! Uses the shared timeline-core for the panel implementation.

pub mod panel;
pub mod types;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::rc::Rc;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use web_sys::{CustomEvent, CustomEventInit};

#[cfg(target_arch = "wasm32")]
use chronicle_timeline_core::TimelineTheme;
#[cfg(target_arch = "wasm32")]
use panel::TimelinePanel;
#[cfg(target_arch = "wasm32")]
use types::{
    parse_event, parse_events, parse_options, to_js, PlaybackStateJs, PlayheadEvent,
    SelectionEvent, TimeRangeEvent,
};

/// Initialize panic hook and logging (call once on module load)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn init() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    tracing_wasm::set_as_global_default();
    Ok(())
}

/// The main timeline viewer handle exposed to JavaScript
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct TimelineViewer {
    canvas_id: String,
    panel: Rc<RefCell<TimelinePanel>>,
    runner: Option<eframe::WebRunner>,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl TimelineViewer {
    /// Create a new timeline viewer
    #[wasm_bindgen(constructor)]
    pub fn new(options: JsValue) -> Result<TimelineViewer, JsValue> {
        let opts = parse_options(options)?;

        Ok(TimelineViewer {
            canvas_id: String::new(),
            panel: Rc::new(RefCell::new(TimelinePanel::new(opts))),
            runner: None,
        })
    }

    /// Start the viewer, rendering to the given canvas element
    #[wasm_bindgen]
    pub async fn start(&mut self, canvas_id: &str) -> Result<(), JsValue> {
        self.canvas_id = canvas_id.to_string();

        // Get the canvas element from the DOM
        let window = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
        let document = window
            .document()
            .ok_or_else(|| JsValue::from_str("No document"))?;
        let canvas = document
            .get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str(&format!("Canvas '{}' not found", canvas_id)))?
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .map_err(|_| JsValue::from_str("Element is not a canvas"))?;

        let panel = self.panel.clone();
        let canvas_id_owned = canvas_id.to_string();

        let web_options = eframe::WebOptions::default();
        let runner = eframe::WebRunner::new();

        runner
            .start(
                canvas,
                web_options,
                Box::new(move |cc| {
                    configure_egui_style(&cc.egui_ctx, &TimelineTheme::dark());
                    Ok(Box::new(TimelineApp {
                        panel: panel.clone(),
                        canvas_id: canvas_id_owned.clone(),
                    }))
                }),
            )
            .await
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        self.runner = Some(runner);
        Ok(())
    }

    /// Stop the viewer and clean up
    #[wasm_bindgen]
    pub fn stop(&mut self) {
        self.runner = None;
    }

    /// Set events data (replaces all current events)
    #[wasm_bindgen(js_name = setEvents)]
    pub fn set_events(&mut self, events: JsValue) -> Result<(), JsValue> {
        let events = parse_events(events)?;
        self.panel.borrow_mut().set_events(events);
        Ok(())
    }

    /// Add a single event
    #[wasm_bindgen(js_name = addEvent)]
    pub fn add_event(&mut self, event: JsValue) -> Result<(), JsValue> {
        let event = parse_event(event)?;
        self.panel.borrow_mut().add_event(event);
        Ok(())
    }

    /// Clear all events
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.panel.borrow_mut().clear();
    }

    /// Set the visible time range
    #[wasm_bindgen(js_name = setTimeRange)]
    pub fn set_time_range(&mut self, start: &str, end: &str) -> Result<(), JsValue> {
        let start = chrono::DateTime::parse_from_rfc3339(start)
            .map_err(|e| JsValue::from_str(&format!("Invalid start time: {}", e)))?
            .with_timezone(&chrono::Utc);
        let end = chrono::DateTime::parse_from_rfc3339(end)
            .map_err(|e| JsValue::from_str(&format!("Invalid end time: {}", e)))?
            .with_timezone(&chrono::Utc);

        self.panel.borrow_mut().set_time_range(start, end);
        Ok(())
    }

    /// Get the current time range
    #[wasm_bindgen(js_name = getTimeRange)]
    pub fn get_time_range(&self) -> Result<JsValue, JsValue> {
        let (start, end) = self.panel.borrow().time_range();
        let event = TimeRangeEvent { start, end };
        to_js(&event)
    }

    /// Set the playhead position
    #[wasm_bindgen(js_name = setPlayhead)]
    pub fn set_playhead(&mut self, time: &str) -> Result<(), JsValue> {
        let time = chrono::DateTime::parse_from_rfc3339(time)
            .map_err(|e| JsValue::from_str(&format!("Invalid time: {}", e)))?
            .with_timezone(&chrono::Utc);

        self.panel.borrow_mut().set_playhead(time);
        Ok(())
    }

    /// Get the playhead position
    #[wasm_bindgen(js_name = getPlayhead)]
    pub fn get_playhead(&self) -> String {
        self.panel.borrow().playhead().to_rfc3339()
    }

    /// Set playback state: "live", "playing", or "paused"
    #[wasm_bindgen(js_name = setPlaybackState)]
    pub fn set_playback_state(&mut self, state: &str) -> Result<(), JsValue> {
        let _state = match state {
            "live" => PlaybackStateJs::Live,
            "playing" => PlaybackStateJs::Playing,
            "paused" => PlaybackStateJs::Paused,
            _ => {
                return Err(JsValue::from_str(
                    "Invalid playback state. Use 'live', 'playing', or 'paused'",
                ))
            }
        };
        // TODO: set on inner panel
        Ok(())
    }

    /// Get current playback state
    #[wasm_bindgen(js_name = getPlaybackState)]
    pub fn get_playback_state(&self) -> String {
        match self.panel.borrow().playback_state() {
            PlaybackStateJs::Live => "live".to_string(),
            PlaybackStateJs::Playing => "playing".to_string(),
            PlaybackStateJs::Paused => "paused".to_string(),
        }
    }

    /// Get the currently selected event (returns null if none)
    #[wasm_bindgen(js_name = getSelectedEvent)]
    pub fn get_selected_event(&self) -> Result<JsValue, JsValue> {
        let panel = self.panel.borrow();
        let event = SelectionEvent {
            event_id: panel.selected_event().cloned(),
            event: panel
                .selected_event()
                .and_then(|id| panel.events().iter().find(|e| &e.id == id).cloned()),
        };
        to_js(&event)
    }

    /// Select an event by ID
    #[wasm_bindgen(js_name = selectEvent)]
    pub fn select_event(&mut self, event_id: Option<String>) {
        self.panel.borrow_mut().set_selected(event_id);
    }

    /// Fit the view to show all events
    #[wasm_bindgen(js_name = fitToEvents)]
    pub fn fit_to_events(&mut self) {
        self.panel.borrow_mut().fit_to_events();
    }

    /// Get the number of events
    #[wasm_bindgen(js_name = getEventCount)]
    pub fn get_event_count(&self) -> usize {
        self.panel.borrow().events().len()
    }
}

/// Configure egui style from a TimelineTheme
#[cfg(target_arch = "wasm32")]
fn configure_egui_style(ctx: &egui::Context, theme: &TimelineTheme) {
    use egui::Stroke;

    let mut style = (*ctx.style()).clone();

    // Visuals
    style.visuals.dark_mode = true;
    style.visuals.panel_fill = theme.bg_surface;
    style.visuals.window_fill = theme.bg_elevated;
    style.visuals.extreme_bg_color = theme.bg_primary;

    style.visuals.widgets.noninteractive.bg_fill = theme.bg_surface;
    style.visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, theme.text_muted);

    style.visuals.widgets.inactive.bg_fill = theme.button_bg;
    style.visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, theme.text_secondary);

    style.visuals.widgets.hovered.bg_fill = theme.button_hover;
    style.visuals.widgets.hovered.fg_stroke = Stroke::new(1.0, theme.text_primary);

    style.visuals.widgets.active.bg_fill = theme.button_active;
    style.visuals.widgets.active.fg_stroke = Stroke::new(1.0, theme.accent);

    style.visuals.selection.bg_fill = theme.bg_row_selected;
    style.visuals.selection.stroke = Stroke::new(1.0, theme.accent);

    // Spacing
    style.spacing.item_spacing = egui::vec2(theme.spacing_sm, theme.spacing_sm);
    style.spacing.button_padding = egui::vec2(theme.spacing_md, theme.spacing_sm);

    ctx.set_style(style);
}

/// Internal eframe App wrapper
#[cfg(target_arch = "wasm32")]
struct TimelineApp {
    panel: Rc<RefCell<TimelinePanel>>,
    canvas_id: String,
}

#[cfg(target_arch = "wasm32")]
impl eframe::App for TimelineApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let theme = TimelineTheme::dark();
        egui::CentralPanel::default()
            .frame(egui::Frame::none().fill(theme.bg_primary))
            .show(ctx, |ui| {
                let response = self.panel.borrow_mut().ui(ui);

                // Emit custom events for React integration
                if let Some(event_id) = response.selected_event {
                    let panel = self.panel.borrow();
                    let _ = self.emit_event(
                        "timelineselect",
                        &SelectionEvent {
                            event_id: Some(event_id.clone()),
                            event: panel.events().iter().find(|e| e.id == event_id).cloned(),
                        },
                    );
                }

                if response.playhead_changed {
                    let _ = self.emit_event(
                        "timelineplayhead",
                        &PlayheadEvent {
                            time: self.panel.borrow().playhead(),
                        },
                    );
                }

                if response.range_changed {
                    let (start, end) = self.panel.borrow().time_range();
                    let _ = self.emit_event("timelinerangechange", &TimeRangeEvent { start, end });
                }
            });

        // Request continuous repaint for smooth animation
        ctx.request_repaint();
    }
}

#[cfg(target_arch = "wasm32")]
impl TimelineApp {
    fn emit_event<T: serde::Serialize>(&self, event_name: &str, data: &T) -> Result<(), JsValue> {
        let window = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
        let document = window
            .document()
            .ok_or_else(|| JsValue::from_str("No document"))?;

        let canvas = document
            .get_element_by_id(&self.canvas_id)
            .ok_or_else(|| JsValue::from_str("Canvas not found"))?;

        let detail = to_js(data)?;
        let init = CustomEventInit::new();
        init.set_detail(&detail);
        init.set_bubbles(true);

        let event = CustomEvent::new_with_event_init_dict(event_name, &init)?;
        canvas.dispatch_event(&event)?;

        Ok(())
    }
}
