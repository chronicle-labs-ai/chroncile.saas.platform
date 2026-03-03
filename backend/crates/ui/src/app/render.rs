//! Rendering Helpers
//!
//! Toast rendering and other UI helpers.

use crate::design::{colors, rounding, spacing, typography};

use super::toast::{Toast, ToastKind};
use super::EventsManagerApp;

impl EventsManagerApp {
    pub(super) fn render_toasts(&mut self, ctx: &egui::Context) {
        self.toasts.retain(|t| !t.is_expired());

        if self.toasts.is_empty() {
            return;
        }

        egui::Area::new(egui::Id::new("toast_area"))
            .anchor(egui::Align2::RIGHT_TOP, egui::vec2(-16.0, 52.0))
            .show(ctx, |ui| {
                for toast in &self.toasts {
                    let (status_color, icon) = match toast.kind {
                        ToastKind::Success => (colors::SIGNAL_GREEN, "✓"),
                        ToastKind::Info => (colors::SIGNAL_BLUE, "i"),
                        ToastKind::Warning => (colors::SIGNAL_AMBER, "!"),
                        ToastKind::Error => (colors::SIGNAL_RED, "×"),
                    };

                    egui::Frame::none()
                        .fill(colors::BG_ELEVATED)
                        .stroke(egui::Stroke::new(1.0, status_color.gamma_multiply(0.5)))
                        .rounding(rounding::SM)
                        .inner_margin(egui::Margin::symmetric(spacing::MD, spacing::SM))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                ui.label(
                                    egui::RichText::new(icon)
                                        .color(status_color)
                                        .font(typography::body())
                                        .strong(),
                                );
                                ui.label(
                                    egui::RichText::new(&toast.message)
                                        .color(colors::TEXT_PRIMARY)
                                        .font(typography::small()),
                                );
                            });
                        });
                    ui.add_space(spacing::XS);
                }
            });
    }

    pub fn add_toast(&mut self, toast: Toast) {
        self.toasts.push_back(toast);
        while self.toasts.len() > 5 {
            self.toasts.pop_front();
        }
    }
}

