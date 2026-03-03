//! Filter Panel Widget - Anduril Design System
//!
//! Provides UI for filtering events by source, type, actor, and subject.
//! Utilitarian controls with high information density and clear hierarchy.

mod sections;
mod types;

use egui::{RichText, Ui};

use crate::design::{colors, rounding, spacing, strokes, typography, status_badge};
use crate::sources_cache::SourcesCache;
use crate::types::{LaneGrouping, TimeWindowPreset};

pub use types::{capitalize_source_id, FilterPanel, FilterPanelResponse};

impl FilterPanel {
    /// Render the filter panel (without source name lookup)
    pub fn ui(&mut self, ui: &mut Ui) -> FilterPanelResponse {
        self.ui_with_cache(ui, None)
    }

    /// Render the filter panel with API-driven source names from cache
    pub fn ui_with_cache(
        &mut self,
        ui: &mut Ui,
        sources_cache: Option<&SourcesCache>,
    ) -> FilterPanelResponse {
        let mut response = FilterPanelResponse {
            changed: false,
            time_window_changed: false,
        };

        // Helper closure for source name lookup
        let get_source_name = |source_id: &str| -> String {
            sources_cache
                .and_then(|cache| cache.get_source(source_id))
                .map(|s| s.name.clone())
                .unwrap_or_else(|| capitalize_source_id(source_id))
        };

        // Helper closure for event type description lookup
        let get_event_description = |event_type: &str| -> Option<String> {
            sources_cache
                .and_then(|cache| cache.get_description(event_type))
                .map(|s| s.to_string())
        };

        // Main filter bar - compact, utilitarian
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::symmetric(spacing::MD, spacing::SM))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    // TIME selector - primary control
                    self.render_time_selector(ui, &mut response);

                    ui.add_space(spacing::MD);
                    ui.add(egui::Separator::default().vertical().spacing(spacing::SM));

                    // GROUP BY selector
                    self.render_grouping_selector(ui, &mut response);

                    ui.add_space(spacing::MD);
                    ui.add(egui::Separator::default().vertical().spacing(spacing::SM));

                    // FILTERS toggle - industrial button
                    self.render_filters_toggle(ui);

                    // Filter status summary - right aligned
                    self.render_filter_status(ui);
                });

                // Expanded filter section - high density grid
                if self.expanded {
                    ui.add_space(spacing::SM);
                    ui.add(egui::Separator::default().spacing(spacing::XS));
                    ui.add_space(spacing::SM);

                    ui.horizontal(|ui| {
                        // Sources column
                        ui.vertical(|ui| {
                            self.render_sources_section(ui, &mut response, get_source_name);
                        });

                        ui.add(egui::Separator::default().vertical().spacing(spacing::MD));

                        // Event types column
                        ui.vertical(|ui| {
                            self.render_types_section(ui, &mut response, get_event_description);
                        });

                        ui.add(egui::Separator::default().vertical().spacing(spacing::MD));

                        // Search filters column
                        ui.vertical(|ui| {
                            self.render_search_section(ui, &mut response);
                        });
                    });
                }
            });

        response
    }

    /// Render the time window selector
    fn render_time_selector(&mut self, ui: &mut Ui, response: &mut FilterPanelResponse) {
        ui.label(
            RichText::new("TIME")
                .color(colors::TEXT_MUTED)
                .font(typography::caption())
                .strong(),
        );

        egui::ComboBox::from_id_salt("time_window")
            .selected_text(self.time_window_preset.label())
            .width(100.0)
            .show_ui(ui, |ui| {
                for preset in TimeWindowPreset::all() {
                    if ui
                        .selectable_label(self.time_window_preset == preset, preset.label())
                        .clicked()
                    {
                        self.time_window_preset = preset;
                        self.time_window = preset.to_time_window();
                        response.time_window_changed = true;
                        response.changed = true;
                    }
                }
            });
    }

    /// Render the grouping selector
    fn render_grouping_selector(&mut self, ui: &mut Ui, response: &mut FilterPanelResponse) {
        ui.label(
            RichText::new("GROUP")
                .color(colors::TEXT_MUTED)
                .font(typography::caption())
                .strong(),
        );

        egui::ComboBox::from_id_salt("lane_grouping")
            .selected_text(self.lane_grouping.label())
            .width(90.0)
            .show_ui(ui, |ui| {
                for grouping in LaneGrouping::all() {
                    if ui
                        .selectable_label(self.lane_grouping == grouping, grouping.label())
                        .clicked()
                    {
                        self.lane_grouping = grouping;
                        response.changed = true;
                    }
                }
            });
    }

    /// Render the filters toggle button
    fn render_filters_toggle(&mut self, ui: &mut Ui) {
        let filter_label = if self.expanded {
            "▼ FILTERS"
        } else {
            "▶ FILTERS"
        };
        let filter_btn = egui::Button::new(
            RichText::new(filter_label)
                .color(if self.expanded {
                    colors::ACCENT_TEAL
                } else {
                    colors::TEXT_SECONDARY
                })
                .font(typography::caption())
                .strong(),
        )
        .fill(if self.expanded {
            colors::BG_CONTROL
        } else {
            egui::Color32::TRANSPARENT
        })
        .stroke(strokes::border())
        .rounding(rounding::SM);

        if ui.add(filter_btn).clicked() {
            self.expanded = !self.expanded;
        }
    }

    /// Render the filter status summary
    fn render_filter_status(&self, ui: &mut Ui) {
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            let source_count = self.selected_sources.len();
            let type_count = self.selected_types.len();
            let total_sources = self.available_sources.len();
            let total_types = self.available_types.len();

            // Show active filter counts
            if total_sources > 0 || total_types > 0 {
                let filters_active = source_count < total_sources || type_count < total_types;

                if filters_active {
                    status_badge(ui, "FILTERED", colors::SIGNAL_AMBER);
                }

                ui.label(
                    RichText::new(format!(
                        "{}⁄{} src · {}⁄{} type",
                        source_count, total_sources, type_count, total_types
                    ))
                    .color(colors::TEXT_MUTED)
                    .font(typography::caption()),
                );
            }
        });
    }
}

