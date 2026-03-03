//! Filter Panel Sections
//!
//! Rendering functions for filter panel sections (sources, types, search).

use egui::{RichText, ScrollArea, Ui};

use crate::design::{colors, spacing, typography};

use super::types::{FilterPanel, FilterPanelResponse};

impl FilterPanel {
    /// Render the sources filter section
    pub(crate) fn render_sources_section(
        &mut self,
        ui: &mut Ui,
        response: &mut FilterPanelResponse,
        get_source_name: impl Fn(&str) -> String,
    ) {
        ui.set_min_width(160.0);

        ui.horizontal(|ui| {
            ui.label(
                RichText::new("SOURCES")
                    .color(colors::TEXT_SECONDARY)
                    .font(typography::caption())
                    .strong(),
            );

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui
                    .small_button(RichText::new("None").font(typography::caption()))
                    .clicked()
                {
                    self.selected_sources.clear();
                    response.changed = true;
                }
                if ui
                    .small_button(RichText::new("All").font(typography::caption()))
                    .clicked()
                {
                    self.selected_sources = self.available_sources.iter().cloned().collect();
                    response.changed = true;
                }
            });
        });

        ui.add_space(spacing::XS);

        ScrollArea::vertical()
            .max_height(120.0)
            .id_salt("sources_scroll")
            .show(ui, |ui| {
                for source in &self.available_sources.clone() {
                    let mut checked = self.selected_sources.contains(source);
                    // Use friendly name from cache, show ID on hover
                    let display_name = get_source_name(source);
                    let checkbox = egui::Checkbox::new(
                        &mut checked,
                        RichText::new(&display_name).font(typography::small()),
                    );
                    if ui.add(checkbox).on_hover_text(source).changed() {
                        if checked {
                            self.selected_sources.insert(source.clone());
                        } else {
                            self.selected_sources.remove(source);
                        }
                        response.changed = true;
                    }
                }
            });
    }

    /// Render the event types filter section
    pub(crate) fn render_types_section(
        &mut self,
        ui: &mut Ui,
        response: &mut FilterPanelResponse,
        get_event_description: impl Fn(&str) -> Option<String>,
    ) {
        ui.set_min_width(180.0);

        ui.horizontal(|ui| {
            ui.label(
                RichText::new("EVENT TYPES")
                    .color(colors::TEXT_SECONDARY)
                    .font(typography::caption())
                    .strong(),
            );

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui
                    .small_button(RichText::new("None").font(typography::caption()))
                    .clicked()
                {
                    self.selected_types.clear();
                    response.changed = true;
                }
                if ui
                    .small_button(RichText::new("All").font(typography::caption()))
                    .clicked()
                {
                    self.selected_types = self.available_types.iter().cloned().collect();
                    response.changed = true;
                }
            });
        });

        ui.add_space(spacing::XS);

        ScrollArea::vertical()
            .max_height(120.0)
            .id_salt("types_scroll")
            .show(ui, |ui| {
                for event_type in &self.available_types.clone() {
                    let mut checked = self.selected_types.contains(event_type);
                    let display_type = event_type.split('.').next_back().unwrap_or(event_type);
                    let checkbox = egui::Checkbox::new(
                        &mut checked,
                        RichText::new(display_type).font(typography::small()),
                    );
                    // Show description from catalog if available
                    let hover_text = get_event_description(event_type)
                        .map(|desc| format!("{}\n\n{}", event_type, desc))
                        .unwrap_or_else(|| event_type.clone());
                    if ui.add(checkbox).on_hover_text(&hover_text).changed() {
                        if checked {
                            self.selected_types.insert(event_type.clone());
                        } else {
                            self.selected_types.remove(event_type);
                        }
                        response.changed = true;
                    }
                }
            });
    }

    /// Render the search filters section
    pub(crate) fn render_search_section(
        &mut self,
        ui: &mut Ui,
        response: &mut FilterPanelResponse,
    ) {
        ui.set_min_width(200.0);

        ui.label(
            RichText::new("SEARCH")
                .color(colors::TEXT_SECONDARY)
                .font(typography::caption())
                .strong(),
        );

        ui.add_space(spacing::XS);

        // Actor search
        ui.horizontal(|ui| {
            ui.label(
                RichText::new("Actor:")
                    .color(colors::TEXT_MUTED)
                    .font(typography::caption()),
            );
            let text_edit = egui::TextEdit::singleline(&mut self.actor_search)
                .font(typography::small())
                .desired_width(140.0);
            if ui.add(text_edit).changed() {
                response.changed = true;
            }
        });

        ui.add_space(spacing::XS);

        // Subject search
        ui.horizontal(|ui| {
            ui.label(
                RichText::new("Subject:")
                    .color(colors::TEXT_MUTED)
                    .font(typography::caption()),
            );
            let text_edit = egui::TextEdit::singleline(&mut self.subject_search)
                .font(typography::small())
                .desired_width(140.0);
            if ui.add(text_edit).changed() {
                response.changed = true;
            }
        });
    }
}
