//! Timeline Text Log View
//!
//! Rerun-style text log table with multi-stream support.

use egui::{Color32, RichText, Stroke, Ui};
use egui_extras::{Column, TableBuilder};

use crate::design::{colors, rounding, spacing, strokes, typography};
use crate::types::EventDto;
#[cfg(feature = "native")]
use crate::views::widgets::{parse_hex_color, stream_color};

use super::details::render_event_details;
use super::TimelineView;

impl TimelineView {
    /// Render the text log view
    pub(super) fn render_list_view(&mut self, ui: &mut Ui) {
        let filtered_events = self.filter_events();

        // Build a map of stream_id -> color for badge rendering
        #[cfg(feature = "native")]
        let stream_colors: std::collections::HashMap<String, Color32> = self
            .streams_panel
            .streams
            .iter()
            .map(|(id, stream)| {
                let color = stream
                    .color
                    .as_ref()
                    .and_then(|c| parse_hex_color(c))
                    .unwrap_or_else(|| stream_color(0));
                (id.as_str().to_string(), color)
            })
            .collect();
        #[cfg(not(feature = "native"))]
        let stream_colors: std::collections::HashMap<String, Color32> =
            std::collections::HashMap::new();

        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .show(ui, |ui| {
                ui.columns(2, |columns| {
                    // Left: Text log table (Rerun-style)
                    columns[0].vertical(|ui| {
                        ui.add_space(spacing::SM);
                        ui.horizontal(|ui| {
                            ui.add_space(spacing::MD);
                            ui.label(
                                RichText::new("TEXT LOG")
                                    .color(colors::TEXT_SECONDARY)
                                    .font(typography::caption())
                                    .strong(),
                            );
                        });
                        ui.add_space(spacing::XS);

                        ui.push_id("text_log_table", |ui| {
                            // Capture context before table borrows ui
                            let ctx = ui.ctx().clone();

                            let mut table = TableBuilder::new(ui)
                                .resizable(true)
                                .vscroll(true)
                                .auto_shrink([false; 2])
                                .min_scrolled_height(0.0)
                                .max_scroll_height(f32::INFINITY)
                                .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                                .sense(egui::Sense::click()); // Enable row clicks

                            table = table
                                .column(Column::auto().clip(true).at_least(84.0)) // Time
                                .column(Column::auto().clip(true).at_least(90.0)) // Source
                                .column(Column::auto().clip(true).at_least(90.0)) // Type
                                .column(Column::auto().clip(true).at_least(120.0)) // Actor
                                .column(Column::remainder().clip(true).at_least(180.0)); // Message

                            let mut body_clip_rect = None;
                            let mut current_time_y = None;
                            let playhead = self.time_panel.playhead;

                            table
                                .header(24.0, |mut header| {
                                    header.col(|ui| {
                                        ui.label(
                                            RichText::new("TIME")
                                                .color(colors::TEXT_MUTED)
                                                .font(typography::caption()),
                                        );
                                    });
                                    header.col(|ui| {
                                        ui.label(
                                            RichText::new("SOURCE")
                                                .color(colors::TEXT_MUTED)
                                                .font(typography::caption()),
                                        );
                                    });
                                    header.col(|ui| {
                                        ui.label(
                                            RichText::new("TYPE")
                                                .color(colors::TEXT_MUTED)
                                                .font(typography::caption()),
                                        );
                                    });
                                    header.col(|ui| {
                                        ui.label(
                                            RichText::new("ACTOR")
                                                .color(colors::TEXT_MUTED)
                                                .font(typography::caption()),
                                        );
                                    });
                                    header.col(|ui| {
                                        ui.label(
                                            RichText::new("MESSAGE")
                                                .color(colors::TEXT_MUTED)
                                                .font(typography::caption()),
                                        );
                                    });
                                })
                                .body(|body| {
                                    body_clip_rect = Some(body.max_rect());

                                    let row_heights = filtered_events.iter().map(calc_row_height);

                                    body.heterogeneous_rows(row_heights, |mut row| {
                                        let event = &filtered_events[row.index()];
                                        let original_idx = self
                                            .events
                                            .iter()
                                            .position(|e| e.event_id == event.event_id);
                                        let is_selected = original_idx == self.selected_index;

                                        // Visual feedback for selection and hover
                                        row.set_selected(is_selected);

                                        row.col(|ui| {
                                            ui.label(
                                                RichText::new(
                                                    event
                                                        .occurred_at
                                                        .format("%H:%M:%S%.3f")
                                                        .to_string(),
                                                )
                                                .color(colors::TEXT_SECONDARY)
                                                .font(typography::mono_small()),
                                            );
                                        });
                                        row.col(|ui| {
                                            let stream_color = event
                                                .stream_id
                                                .as_ref()
                                                .and_then(|sid| stream_colors.get(sid).copied());
                                            if let Some(color) = stream_color {
                                                let (rect, _) = ui.allocate_exact_size(
                                                    egui::vec2(6.0, 6.0),
                                                    egui::Sense::hover(),
                                                );
                                                ui.painter().rect_filled(
                                                    rect,
                                                    rounding::NONE,
                                                    color,
                                                );
                                                ui.add_space(spacing::XS);
                                            }
                                            ui.label(
                                                RichText::new(&event.source)
                                                    .color(colors::TEXT_PRIMARY)
                                                    .font(typography::small()),
                                            );
                                        });
                                        row.col(|ui| {
                                            ui.label(
                                                RichText::new(event.type_label())
                                                    .color(colors::TEXT_SECONDARY)
                                                    .font(typography::small()),
                                            );
                                        });
                                        row.col(|ui| {
                                            ui.label(
                                                RichText::new(event.actor_display())
                                                    .color(colors::TEXT_SECONDARY)
                                                    .font(typography::small()),
                                            );
                                        });
                                        row.col(|ui| {
                                            let text =
                                                event.message_text().unwrap_or_else(|| "-".into());
                                            ui.label(
                                                RichText::new(text)
                                                    .color(colors::TEXT_MUTED)
                                                    .font(typography::small()),
                                            );
                                        });

                                        let row_response = row.response();

                                        // Track playhead position
                                        if playhead <= event.occurred_at && current_time_y.is_none()
                                        {
                                            current_time_y = Some(row_response.rect.top());
                                        } else if playhead == event.occurred_at {
                                            current_time_y = Some(row_response.rect.bottom());
                                        }

                                        // Cursor hint on hover
                                        if row_response.hovered() {
                                            ctx.set_cursor_icon(egui::CursorIcon::PointingHand);
                                        }

                                        // Handle row click - select event and move playhead
                                        if row_response.clicked() {
                                            self.selected_index = original_idx;
                                            self.time_panel
                                                .set_selected(Some(event.event_id.clone()));
                                            // Move playhead to selected event time
                                            self.time_panel.set_playhead(event.occurred_at);
                                        }
                                    });
                                });

                            if let (Some(body_clip_rect), Some(current_time_y)) =
                                (body_clip_rect, current_time_y)
                            {
                                ui.painter().with_clip_rect(body_clip_rect).hline(
                                    ui.max_rect().x_range(),
                                    current_time_y,
                                    Stroke::new(1.0, colors::PLAYHEAD),
                                );
                            }
                        });
                    });

                    // Right: Event details
                    columns[1].vertical(|ui| {
                        ui.add_space(spacing::SM);
                        ui.label(
                            RichText::new("DETAILS")
                                .color(colors::TEXT_SECONDARY)
                                .font(typography::caption())
                                .strong(),
                        );
                        ui.add(egui::Separator::default().spacing(spacing::XS));

                        if let Some(idx) = self.selected_index {
                            if let Some(event) = self.events.get(idx) {
                                let stream_info = self.get_stream_info_for_event(event);
                                ui.push_id("event_details_panel", |ui| {
                                    render_event_details(ui, event, stream_info);
                                });
                            }
                        } else {
                            ui.vertical_centered(|ui| {
                                ui.add_space(40.0);
                                ui.label(
                                    RichText::new("Select an event to view details")
                                        .color(colors::TEXT_MUTED)
                                        .font(typography::small()),
                                );
                            });
                        }
                    });
                });
            });
    }
}

fn calc_row_height(event: &EventDto) -> f32 {
    let num_newlines = event
        .message_text()
        .unwrap_or_default()
        .bytes()
        .filter(|&c| c == b'\n')
        .count();
    let num_rows = 1 + num_newlines;
    num_rows as f32 * 18.0
}
