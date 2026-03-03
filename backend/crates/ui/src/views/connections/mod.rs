//! Connections View - Anduril Design System
//!
//! Manages OAuth connections and event generation with industrial utilitarian UI.

mod form;
mod list;
mod types;

use egui::{RichText, ScrollArea, Ui};

use crate::design::{colors, rounding, spacing, strokes, typography};
use crate::types::SourceSummary;

pub use types::{ConnectionAction, ConnectionsView};

impl ConnectionsView {
    /// Render the connections view
    pub fn ui(&mut self, ui: &mut Ui) {
        // Default render without sources cache (for backwards compatibility)
        self.ui_with_sources(ui, &[]);
    }

    /// Render the connections view with API-driven sources
    pub fn ui_with_sources(&mut self, ui: &mut Ui, sources: &[SourceSummary]) {
        ui.vertical(|ui| {
            ui.columns(2, |columns| {
                self.render_connections_column(&mut columns[0], sources);
                self.render_scenarios_column(&mut columns[1]);
            });
        });
    }

    fn render_connections_column(&mut self, ui: &mut Ui, sources: &[SourceSummary]) {
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::same(spacing::MD))
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    // Header
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("CONNECTIONS")
                                .color(colors::TEXT_SECONDARY)
                                .font(typography::caption())
                                .strong(),
                        );

                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            // Refresh button
                            let refresh_btn = egui::Button::new(
                                RichText::new("↻")
                                    .color(colors::TEXT_SECONDARY)
                                    .font(typography::body()),
                            )
                            .fill(colors::BG_CONTROL)
                            .rounding(rounding::SM);

                            if ui.add(refresh_btn).clicked() {
                                self.pending_actions
                                    .push(types::ConnectionAction::RefreshConnections);
                            }

                            // Add button
                            let add_text = if self.show_new_connection_form {
                                "×"
                            } else {
                                "+"
                            };
                            let add_btn = egui::Button::new(
                                RichText::new(add_text)
                                    .color(colors::ACCENT_TEAL)
                                    .font(typography::body())
                                    .strong(),
                            )
                            .fill(colors::BG_CONTROL)
                            .rounding(rounding::SM);

                            if ui.add(add_btn).clicked() {
                                self.show_new_connection_form = !self.show_new_connection_form;
                            }
                        });
                    });

                    ui.add(egui::Separator::default().spacing(spacing::XS));

                    // New connection form (collapsible)
                    if self.show_new_connection_form {
                        self.render_new_connection_form(ui, sources);
                        ui.add_space(spacing::SM);
                    }

                    // Generate count slider
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("BATCH SIZE")
                                .color(colors::TEXT_MUTED)
                                .font(typography::caption()),
                        );
                        ui.add(egui::Slider::new(&mut self.generate_count, 1..=100));
                        ui.label(
                            RichText::new(format!("{}", self.generate_count))
                                .color(colors::ACCENT_TEAL)
                                .font(typography::mono_small()),
                        );
                    });

                    ui.add_space(spacing::SM);

                    // Existing connections
                    ScrollArea::vertical()
                        .auto_shrink([false, false])
                        .show(ui, |ui| {
                            ui.vertical(|ui| {
                                if self.connections.is_empty() {
                                    egui::Frame::none()
                                        .fill(colors::BG_BASE)
                                        .rounding(rounding::SM)
                                        .inner_margin(egui::Margin::same(spacing::LG))
                                        .show(ui, |ui| {
                                            ui.vertical_centered(|ui| {
                                                ui.label(
                                                    RichText::new("NO CONNECTIONS")
                                                        .color(colors::TEXT_MUTED)
                                                        .font(typography::small()),
                                                );
                                                ui.label(
                                                    RichText::new("Click + to create one")
                                                        .color(colors::TEXT_DISABLED)
                                                        .font(typography::caption()),
                                                );
                                            });
                                        });
                                } else {
                                    let connections = self.connections.clone();
                                    for conn in &connections {
                                        self.render_connection(ui, conn);
                                    }
                                }
                            });
                        });
                });
            });
    }

    fn render_scenarios_column(&mut self, ui: &mut Ui) {
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::same(spacing::MD))
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    // Header
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("SCENARIOS")
                                .color(colors::TEXT_SECONDARY)
                                .font(typography::caption())
                                .strong(),
                        );

                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            let refresh_btn = egui::Button::new(
                                RichText::new("↻")
                                    .color(colors::TEXT_SECONDARY)
                                    .font(typography::body()),
                            )
                            .fill(colors::BG_CONTROL)
                            .rounding(rounding::SM);

                            if ui.add(refresh_btn).clicked() {
                                self.pending_actions
                                    .push(types::ConnectionAction::RefreshScenarios);
                            }
                        });
                    });

                    ui.add(egui::Separator::default().spacing(spacing::XS));

                    ui.label(
                        RichText::new("Load pre-built conversation scenarios")
                            .color(colors::TEXT_MUTED)
                            .font(typography::caption()),
                    );

                    ui.add_space(spacing::SM);

                    ScrollArea::vertical()
                        .auto_shrink([false, false])
                        .show(ui, |ui| {
                            ui.vertical(|ui| {
                                if self.scenarios.is_empty() {
                                    ui.vertical_centered(|ui| {
                                        ui.label(
                                            RichText::new("LOADING...")
                                                .color(colors::TEXT_MUTED)
                                                .font(typography::caption()),
                                        );
                                    });
                                } else {
                                    let scenarios = self.scenarios.clone();
                                    for scenario in &scenarios {
                                        self.render_scenario(ui, scenario);
                                    }
                                }
                            });
                        });
                });
            });
    }
}

