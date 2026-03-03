//! New Connection Form
//!
//! Form for creating new connections.

use egui::{RichText, Ui};

use crate::design::{colors, primary_button, rounding, spacing, strokes, typography};
use crate::types::SourceSummary;

use super::types::{ConnectionAction, ConnectionsView};

impl ConnectionsView {
    /// Render the new connection form
    pub(crate) fn render_new_connection_form(
        &mut self,
        ui: &mut Ui,
        sources: &[SourceSummary],
    ) {
        egui::Frame::none()
            .fill(colors::BG_ELEVATED)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::same(spacing::MD))
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new("NEW CONNECTION")
                            .color(colors::TEXT_SECONDARY)
                            .font(typography::caption())
                            .strong(),
                    );
                    ui.add_space(spacing::SM);

                    egui::Grid::new("new_connection_form")
                        .num_columns(2)
                        .spacing([spacing::SM, spacing::XS])
                        .show(ui, |ui| {
                            ui.label(
                                RichText::new("SERVICE")
                                    .color(colors::TEXT_MUTED)
                                    .font(typography::caption()),
                            );

                            // Get display text for selected service
                            let selected_text = sources
                                .iter()
                                .find(|s| s.id == self.new_service)
                                .map(|s| s.name.as_str())
                                .unwrap_or(&self.new_service);

                            egui::ComboBox::from_id_salt("service_select")
                                .selected_text(selected_text)
                                .width(150.0)
                                .show_ui(ui, |ui| {
                                    if sources.is_empty() {
                                        // Fallback to hardcoded values if API not loaded
                                        ui.selectable_value(
                                            &mut self.new_service,
                                            "mock-zendesk".to_string(),
                                            "Mock Zendesk",
                                        );
                                        ui.selectable_value(
                                            &mut self.new_service,
                                            "mock-slack".to_string(),
                                            "Mock Slack",
                                        );
                                        ui.selectable_value(
                                            &mut self.new_service,
                                            "mock-intercom".to_string(),
                                            "Mock Intercom",
                                        );
                                    } else {
                                        // API-driven sources
                                        for source in sources {
                                            ui.selectable_value(
                                                &mut self.new_service,
                                                source.id.clone(),
                                                &source.name,
                                            );
                                        }
                                    }
                                });
                            ui.end_row();

                            ui.label(
                                RichText::new("NAME")
                                    .color(colors::TEXT_MUTED)
                                    .font(typography::caption()),
                            );
                            ui.add(
                                egui::TextEdit::singleline(&mut self.new_name)
                                    .font(typography::small())
                                    .hint_text("Connection name"),
                            );
                            ui.end_row();
                        });

                    ui.add_space(spacing::SM);

                    if primary_button(ui, "CREATE").clicked() {
                        let name = if self.new_name.is_empty() {
                            format!("My {}", self.new_service)
                        } else {
                            self.new_name.clone()
                        };
                        self.pending_actions.push(ConnectionAction::CreateConnection(
                            self.new_service.clone(),
                            name,
                        ));
                        self.new_name.clear();
                        self.show_new_connection_form = false;
                    }
                });
            });
    }
}

