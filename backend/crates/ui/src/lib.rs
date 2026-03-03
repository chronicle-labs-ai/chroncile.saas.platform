//! Events Manager UI
//!
//! Cross-platform egui application that runs on both native and web (via wasm).
//! Features an Anduril-inspired design system for mission-critical interfaces.

pub mod app;
pub mod client;
pub mod design;
pub mod sources_cache;
pub mod types;
pub mod views;

pub use app::EventsManagerApp;
pub use design::configure_style;
pub use sources_cache::SourcesCache;

// Web-specific entry point
#[cfg(target_arch = "wasm32")]
mod web {
    use wasm_bindgen::prelude::*;
    use wasm_bindgen::JsCast;
    use web_sys::HtmlCanvasElement;

    /// Called when the wasm module is instantiated
    #[wasm_bindgen(start)]
    pub fn main() -> Result<(), JsValue> {
        // Redirect panics to console.error
        console_error_panic_hook::set_once();

        // Initialize tracing for wasm
        tracing_wasm::set_as_global_default();

        Ok(())
    }

    /// Start the egui app - called from JavaScript
    #[wasm_bindgen]
    pub async fn start_app(canvas_id: &str) -> Result<(), JsValue> {
        let web_options = eframe::WebOptions::default();
        
        // Get the canvas element by ID
        let document = web_sys::window()
            .ok_or_else(|| JsValue::from_str("No window"))?
            .document()
            .ok_or_else(|| JsValue::from_str("No document"))?;
        
        let canvas: HtmlCanvasElement = document
            .get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str(&format!("Canvas '{}' not found", canvas_id)))?
            .dyn_into()
            .map_err(|_| JsValue::from_str("Element is not a canvas"))?;

        eframe::WebRunner::new()
            .start(
                canvas,
                web_options,
                Box::new(|cc| Ok(Box::new(crate::EventsManagerApp::new(cc)))),
            )
            .await
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        Ok(())
    }
}
