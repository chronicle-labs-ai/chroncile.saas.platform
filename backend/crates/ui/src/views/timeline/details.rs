//! Event Details Panel
//!
//! Renders detailed information about a selected event.

use egui::{Align2, Color32, RichText, ScrollArea, Sense, Ui};

use super::{StreamId, TimelineView};
use crate::design::{colors, rounding, spacing, status_badge, strokes, typography};
use crate::types::EventDto;
#[cfg(feature = "native")]
use crate::views::widgets::{parse_hex_color, stream_color};

// Fallback color functions for web
#[cfg(not(feature = "native"))]
fn parse_hex_color(_: &str) -> Option<Color32> {
    None
}
#[cfg(not(feature = "native"))]
fn stream_color(_: usize) -> Color32 {
    Color32::from_rgb(100, 100, 100)
}

impl TimelineView {
    /// Render the event details panel
    pub(super) fn render_details_panel(&self, ui: &mut Ui) {
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(strokes::border())
            .inner_margin(egui::Margin::symmetric(spacing::MD, spacing::SM))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new("EVENT DETAILS")
                            .color(colors::TEXT_SECONDARY)
                            .font(typography::caption())
                            .strong(),
                    );
                });

                ui.add_space(spacing::XS);
                ui.add(egui::Separator::default().spacing(spacing::XS));
                ui.add_space(spacing::XS);

                if let Some(idx) = self.selected_index {
                    if let Some(event) = self.events.get(idx) {
                        // Get stream info for the event
                        let stream_info = self.get_stream_info_for_event(event);
                        render_event_details(ui, event, stream_info);
                    }
                } else {
                    ui.vertical_centered(|ui| {
                        ui.add_space(spacing::LG);
                        ui.label(
                            RichText::new("Click an event to view details")
                                .color(colors::TEXT_MUTED)
                                .font(typography::small()),
                        );
                        ui.add_space(spacing::LG);
                    });
                }
            });
    }

    /// Get stream name and color for an event
    pub(super) fn get_stream_info_for_event(&self, event: &EventDto) -> (String, Color32) {
        let stream_id = match &event.stream_id {
            Some(id) => StreamId::new(id.clone()),
            None => StreamId::live_api(),
        };

        self.streams_panel
            .streams
            .get(&stream_id)
            .map(|s| {
                let color = s
                    .color
                    .as_ref()
                    .and_then(|c| parse_hex_color(c))
                    .unwrap_or_else(|| stream_color(0));
                (s.name.clone(), color)
            })
            .unwrap_or_else(|| {
                // Fallback for unknown streams
                let name = event
                    .stream_id
                    .clone()
                    .unwrap_or_else(|| "Live API".to_string());
                (name, colors::TEXT_MUTED)
            })
    }
}

/// Get event type color - Anduril palette
fn event_type_color(label: &str) -> egui::Color32 {
    match label {
        "Customer" => colors::EVENT_CUSTOMER,
        "Agent" => colors::EVENT_AGENT,
        "Note" => colors::EVENT_NOTE,
        "AI" => colors::EVENT_AI,
        "Escalation" => colors::EVENT_ESCALATION,
        _ => colors::EVENT_SYSTEM,
    }
}

pub(super) fn render_event_details(ui: &mut Ui, event: &EventDto, stream_info: (String, Color32)) {
    let (stream_name, stream_color) = stream_info;

    ScrollArea::vertical().show(ui, |ui| {
        ui.vertical(|ui| {
            // Type badge at top
            let type_label = event.type_label();
            let type_color = event_type_color(type_label);

            ui.horizontal(|ui| {
                egui::Frame::none()
                    .fill(type_color.gamma_multiply(0.15))
                    .rounding(rounding::SM)
                    .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::XS))
                    .stroke(egui::Stroke::new(1.0, type_color.gamma_multiply(0.4)))
                    .show(ui, |ui| {
                        ui.label(
                            RichText::new(type_label)
                                .color(type_color)
                                .font(typography::small())
                                .strong(),
                        );
                    });

                if event.contains_pii {
                    status_badge(ui, "⚠ PII", colors::SIGNAL_AMBER);
                }
            });

            ui.add_space(spacing::MD);

            // Details grid
            egui::Grid::new("event_details")
                .num_columns(2)
                .spacing([spacing::MD, spacing::XS])
                .show(ui, |ui| {
                    detail_row(ui, "EVENT ID", &event.event_id);
                    detail_row(ui, "TYPE", &event.event_type);
                    detail_row(ui, "SOURCE", &event.source);

                    // Stream row with color indicator
                    ui.label(
                        RichText::new("STREAM")
                            .color(colors::TEXT_MUTED)
                            .font(typography::caption()),
                    );
                    ui.horizontal(|ui| {
                        // Color indicator
                        let (rect, _) =
                            ui.allocate_exact_size(egui::vec2(8.0, 8.0), egui::Sense::hover());
                        ui.painter().rect_filled(rect, 2.0, stream_color);
                        ui.add_space(spacing::XS);
                        let response = ui.add(
                            egui::Label::new(
                                RichText::new(&stream_name)
                                    .color(colors::TEXT_PRIMARY)
                                    .font(typography::mono_small()),
                            )
                            .sense(Sense::click()),
                        );
                        response.clone().on_hover_text("Click to copy");
                        if response.clicked() {
                            ui.ctx().copy_text(stream_name.clone());
                            set_copy_feedback(ui, copy_feedback_id("stream"));
                        }
                        paint_copy_feedback(ui, copy_feedback_id("stream"), &response);
                    });
                    ui.end_row();

                    detail_row(ui, "SUBJECT", &event.conversation_id);
                    detail_row(
                        ui,
                        "ACTOR",
                        &format!("{} ({})", event.actor_display(), event.actor_type),
                    );
                    detail_row(
                        ui,
                        "TIMESTAMP",
                        &event
                            .occurred_at
                            .format("%Y-%m-%d %H:%M:%S%.3f")
                            .to_string(),
                    );
                });

            ui.add_space(spacing::MD);
            ui.label(
                RichText::new("PAYLOAD")
                    .color(colors::TEXT_SECONDARY)
                    .font(typography::caption())
                    .strong(),
            );
            ui.add_space(spacing::XS);

            // Payload
            let payload_response = egui::Frame::none()
                .fill(colors::BG_BASE)
                .rounding(rounding::SM)
                .inner_margin(egui::Margin::same(spacing::SM))
                .stroke(strokes::border())
                .show(ui, |ui| {
                    let mut payload_str =
                        serde_json::to_string_pretty(&event.payload).unwrap_or_default();
                    let response = ui.add(
                        egui::TextEdit::multiline(&mut payload_str)
                            .font(typography::mono_small())
                            .desired_width(f32::INFINITY)
                            .desired_rows(8)
                            .interactive(false),
                    );
                    response.clone().on_hover_text("Click to copy");
                    if response.clicked() {
                        ui.ctx().copy_text(payload_str);
                        set_copy_feedback(ui, copy_feedback_id("payload"));
                    }
                    paint_copy_feedback(ui, copy_feedback_id("payload"), &response);
                });
            if payload_response.response.clicked() {
                let payload_str = serde_json::to_string_pretty(&event.payload).unwrap_or_default();
                ui.ctx().copy_text(payload_str);
                set_copy_feedback(ui, copy_feedback_id("payload"));
            }
        });
    });
}

fn detail_row(ui: &mut Ui, label: &str, value: &str) {
    ui.label(
        RichText::new(label)
            .color(colors::TEXT_MUTED)
            .font(typography::caption()),
    );
    let response = ui.add(
        egui::Label::new(
            RichText::new(value)
                .color(colors::TEXT_PRIMARY)
                .font(typography::mono_small()),
        )
        .sense(Sense::click()),
    );
    response.clone().on_hover_text("Click to copy");
    if response.clicked() {
        ui.ctx().copy_text(value.to_string());
        set_copy_feedback(ui, copy_feedback_id(label));
    }
    paint_copy_feedback(ui, copy_feedback_id(label), &response);
    ui.end_row();
}

fn copy_feedback_id(label: &str) -> egui::Id {
    egui::Id::new("copy_feedback").with(label)
}

fn set_copy_feedback(ui: &Ui, id: egui::Id) {
    let now = ui.input(|i| i.time);
    ui.ctx().data_mut(|data| {
        data.insert_temp(id, now);
    });
}

fn paint_copy_feedback(ui: &Ui, id: egui::Id, response: &egui::Response) {
    let now = ui.input(|i| i.time);
    let start = ui.ctx().data(|data| data.get_temp::<f64>(id));
    if let Some(start) = start {
        let age = now - start;
        let duration = 0.9;
        if age >= 0.0 && age < duration {
            let alpha = (1.0 - (age / duration)).clamp(0.0, 1.0) as f32;
            let color = colors::SIGNAL_GREEN.gamma_multiply(0.2 + 0.8 * alpha);
            let pos = egui::pos2(
                response.rect.right() - spacing::XS,
                response.rect.center().y,
            );
            ui.painter().text(
                pos,
                Align2::RIGHT_CENTER,
                "Copied",
                typography::caption(),
                color,
            );
            ui.ctx().request_repaint();
        }
    }
}
