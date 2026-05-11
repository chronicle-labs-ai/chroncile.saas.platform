//! Connection and Scenario List Rendering
//!
//! Renders individual connection and scenario items.

use egui::{RichText, Ui};

use crate::design::{colors, rounding, spacing, status_badge, strokes, typography};
use crate::types::{ConnectionDto, ScenarioDto};

use super::types::{ConnectionAction, ConnectionsView};

impl ConnectionsView {
    /// Render a single connection item
    pub(crate) fn render_connection(&mut self, ui: &mut Ui, conn: &ConnectionDto) {
        let status_color = if conn.status == "active" {
            colors::STATUS_ONLINE
        } else {
            colors::STATUS_OFFLINE
        };

        egui::Frame::none()
            .fill(colors::BG_BASE)
            .inner_margin(egui::Margin::symmetric(spacing::MD, spacing::SM))
            .stroke(strokes::border())
            .rounding(rounding::SM)
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    ui.horizontal(|ui| {
                        // Status indicator - square
                        let (rect, _) =
                            ui.allocate_exact_size(egui::vec2(6.0, 6.0), egui::Sense::hover());
                        ui.painter().rect_filled(rect, rounding::NONE, status_color);

                        // Connection info
                        ui.vertical(|ui| {
                            ui.label(
                                RichText::new(&conn.name)
                                    .color(colors::TEXT_PRIMARY)
                                    .font(typography::small())
                                    .strong(),
                            );
                            ui.label(
                                RichText::new(format!(
                                    "{} · {}",
                                    conn.service,
                                    &conn.connection_id[..8.min(conn.connection_id.len())]
                                ))
                                .font(typography::caption())
                                .color(colors::TEXT_MUTED),
                            );
                        });
                    });

                    ui.add_space(spacing::SM);

                    ui.horizontal(|ui| {
                        // Generate events button
                        let gen_btn = egui::Button::new(
                            RichText::new(format!("GEN {}", self.generate_count))
                                .color(colors::BG_BASE)
                                .font(typography::caption())
                                .strong(),
                        )
                        .fill(colors::ACCENT_TEAL)
                        .rounding(rounding::SM);

                        if ui.add(gen_btn).clicked() {
                            self.pending_actions.push(ConnectionAction::GenerateEvents(
                                conn.connection_id.clone(),
                                self.generate_count,
                            ));
                        }

                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            // Delete button
                            let del_btn = egui::Button::new(
                                RichText::new("×")
                                    .color(colors::SIGNAL_RED)
                                    .font(typography::body()),
                            )
                            .fill(egui::Color32::TRANSPARENT)
                            .stroke(egui::Stroke::new(
                                1.0,
                                colors::SIGNAL_RED.gamma_multiply(0.5),
                            ))
                            .rounding(rounding::SM);

                            if ui.add(del_btn).clicked() {
                                self.pending_actions
                                    .push(ConnectionAction::DeleteConnection(
                                        conn.connection_id.clone(),
                                    ));
                            }
                        });
                    });
                });
            });

        ui.add_space(spacing::XS);
    }

    /// Render a single scenario item
    pub(crate) fn render_scenario(&mut self, ui: &mut Ui, scenario: &ScenarioDto) {
        egui::Frame::none()
            .fill(colors::BG_BASE)
            .inner_margin(egui::Margin::symmetric(spacing::MD, spacing::SM))
            .stroke(strokes::border())
            .rounding(rounding::SM)
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(&scenario.name)
                            .color(colors::TEXT_PRIMARY)
                            .font(typography::small())
                            .strong(),
                    );
                    ui.label(
                        RichText::new(&scenario.description)
                            .font(typography::caption())
                            .color(colors::TEXT_MUTED),
                    );

                    ui.add_space(spacing::SM);

                    ui.horizontal(|ui| {
                        // Event count badge
                        status_badge(
                            ui,
                            &format!("{} EVENTS", scenario.event_count),
                            colors::ACCENT_SLATE,
                        );

                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            let load_btn = egui::Button::new(
                                RichText::new("LOAD")
                                    .color(colors::BG_BASE)
                                    .font(typography::caption())
                                    .strong(),
                            )
                            .fill(colors::SIGNAL_GREEN)
                            .rounding(rounding::SM);

                            if ui.add(load_btn).clicked() {
                                let name = scenario.name.to_lowercase().replace(' ', "_");
                                self.pending_actions
                                    .push(ConnectionAction::LoadScenario(name));
                            }
                        });
                    });
                });
            });

        ui.add_space(spacing::XS);
    }
}
