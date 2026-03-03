//! Anduril Button Helpers
//!
//! Pre-styled button variants for primary, secondary, and danger actions.

use egui::Stroke;

use super::{colors, rounding};

/// Style a button as primary action
pub fn primary_button(ui: &mut egui::Ui, text: &str) -> egui::Response {
    let button =
        egui::Button::new(egui::RichText::new(text).color(colors::BG_BASE))
            .fill(colors::ACCENT_TEAL)
            .rounding(rounding::SM);

    ui.add(button)
}

/// Style a button as secondary action
pub fn secondary_button(ui: &mut egui::Ui, text: &str) -> egui::Response {
    let button =
        egui::Button::new(egui::RichText::new(text).color(colors::TEXT_PRIMARY))
            .fill(colors::BG_CONTROL)
            .stroke(Stroke::new(1.0, colors::BORDER_DEFAULT))
            .rounding(rounding::SM);

    ui.add(button)
}

/// Style a button as danger action
pub fn danger_button(ui: &mut egui::Ui, text: &str) -> egui::Response {
    let button =
        egui::Button::new(egui::RichText::new(text).color(colors::TEXT_PRIMARY))
            .fill(egui::Color32::from_rgb(80, 30, 30))
            .stroke(Stroke::new(1.0, colors::SIGNAL_RED.gamma_multiply(0.5)))
            .rounding(rounding::SM);

    ui.add(button)
}

