//! Anduril Frame Helpers
//!
//! Pre-styled egui frames for panels, cards, and insets.

use egui::{Color32, Stroke};

use super::{colors, rounding, spacing};

/// Create a panel frame with Anduril styling
pub fn panel_frame() -> egui::Frame {
    egui::Frame::none()
        .fill(colors::BG_SURFACE)
        .inner_margin(egui::Margin::same(spacing::PANEL))
        .stroke(Stroke::new(1.0, colors::BORDER_SUBTLE))
}

/// Create a card frame with Anduril styling
pub fn card_frame() -> egui::Frame {
    egui::Frame::none()
        .fill(colors::BG_ELEVATED)
        .rounding(rounding::MD)
        .inner_margin(egui::Margin::same(spacing::MD))
        .stroke(Stroke::new(1.0, colors::BORDER_SUBTLE))
}

/// Create an inset frame (for code, data displays)
pub fn inset_frame() -> egui::Frame {
    egui::Frame::none()
        .fill(colors::BG_BASE)
        .rounding(rounding::SM)
        .inner_margin(egui::Margin::same(spacing::SM))
        .stroke(Stroke::new(1.0, colors::BORDER_SUBTLE))
}

/// Create a status indicator frame
pub fn status_frame(status_color: Color32) -> egui::Frame {
    egui::Frame::none()
        .fill(Color32::TRANSPARENT)
        .rounding(rounding::SM)
        .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::XS))
        .stroke(Stroke::new(1.0, status_color.gamma_multiply(0.5)))
}
