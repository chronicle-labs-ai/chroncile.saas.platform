//! Anduril Component Helpers
//!
//! Pre-styled UI components like headers, badges, and metrics.

use egui::Stroke;

use super::{colors, rounding, spacing, typography};

/// Create a section header
pub fn section_header(ui: &mut egui::Ui, text: &str) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(text)
                .color(colors::TEXT_PRIMARY)
                .font(typography::heading())
                .strong(),
        );
        ui.add_space(spacing::SM);
        // Horizontal rule extending to the right
        ui.separator();
    });
}

/// Create a subsection header
pub fn subsection_header(ui: &mut egui::Ui, text: &str) {
    ui.label(
        egui::RichText::new(text)
            .color(colors::TEXT_SECONDARY)
            .font(typography::small())
            .strong(),
    );
}

/// Create a data label (key-value pair)
pub fn data_label(ui: &mut egui::Ui, key: &str, value: &str) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(key)
                .color(colors::TEXT_MUTED)
                .font(typography::small()),
        );
        ui.label(
            egui::RichText::new(value)
                .color(colors::TEXT_PRIMARY)
                .font(typography::mono_small()),
        );
    });
}

/// Create a status badge
pub fn status_badge(ui: &mut egui::Ui, text: &str, color: egui::Color32) {
    egui::Frame::none()
        .fill(color.gamma_multiply(0.15))
        .rounding(rounding::SM)
        .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::MICRO))
        .stroke(Stroke::new(1.0, color.gamma_multiply(0.4)))
        .show(ui, |ui| {
            ui.label(
                egui::RichText::new(text)
                    .color(color)
                    .font(typography::caption())
                    .strong(),
            );
        });
}

/// Create a metric display (large number with label)
pub fn metric(ui: &mut egui::Ui, value: &str, label: &str) {
    ui.vertical(|ui| {
        ui.label(
            egui::RichText::new(value)
                .color(colors::TEXT_PRIMARY)
                .font(typography::display())
                .strong(),
        );
        ui.label(
            egui::RichText::new(label)
                .color(colors::TEXT_MUTED)
                .font(typography::caption()),
        );
    });
}
