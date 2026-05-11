//! Stream Row Rendering
//!
//! Individual stream row UI component.

use egui::{Color32, RichText, Ui};

use chronicle_domain::{Stream, StreamId, StreamViewMode};

use crate::design::{colors, rounding, spacing, typography};

use super::types::{parse_hex_color, status_color, stream_color, StreamRowResponse};

/// Render a single stream row
pub fn render_stream_row(
    ui: &mut Ui,
    stream: &Stream,
    view_mode: StreamViewMode,
    is_selected: bool,
) -> StreamRowResponse {
    let mut response = StreamRowResponse::default();

    let row_bg = if is_selected && view_mode == StreamViewMode::Isolated {
        colors::BG_HOVER
    } else {
        Color32::TRANSPARENT
    };

    // Get stream color
    let stream_color_val = stream
        .color
        .as_ref()
        .and_then(|c| parse_hex_color(c))
        .unwrap_or_else(|| stream_color(0));

    // Get status color
    let status_color_val = status_color(stream.status.color_key());

    egui::Frame::none()
        .fill(row_bg)
        .rounding(rounding::SM)
        .inner_margin(egui::Margin::symmetric(spacing::XS, spacing::XS))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                // Enable/disable checkbox (color indicator)
                let checkbox_size = egui::vec2(12.0, 12.0);
                let (rect, checkbox_response) =
                    ui.allocate_exact_size(checkbox_size, egui::Sense::click());

                let fill_color = if stream.enabled {
                    stream_color_val
                } else {
                    colors::BG_SURFACE
                };
                let stroke_color = if stream.enabled {
                    stream_color_val
                } else {
                    colors::BORDER_SUBTLE
                };

                ui.painter().rect_filled(rect, rounding::SM, fill_color);
                ui.painter()
                    .rect_stroke(rect, rounding::SM, egui::Stroke::new(1.0, stroke_color));

                if checkbox_response.clicked() {
                    response.toggled = true;
                }

                // Status indicator
                ui.label(
                    RichText::new(stream.status.short_label())
                        .font(typography::mono_small())
                        .color(status_color_val),
                );

                // Stream name (clickable for selection in isolated mode)
                let name_text = RichText::new(&stream.name).font(typography::small()).color(
                    if stream.enabled {
                        colors::TEXT_PRIMARY
                    } else {
                        colors::TEXT_MUTED
                    },
                );

                let name_response = ui.add(egui::Label::new(name_text).sense(egui::Sense::click()));
                if name_response.clicked() && view_mode == StreamViewMode::Isolated {
                    response.selected = true;
                }

                // Kind icon
                ui.label(
                    RichText::new(stream.kind.icon())
                        .font(typography::caption())
                        .color(colors::TEXT_MUTED),
                );

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    // Event count
                    ui.label(
                        RichText::new(format!("{}", stream.event_count))
                            .font(typography::mono_small())
                            .color(colors::TEXT_MUTED),
                    );

                    // Remove button (not for live API)
                    if stream.id != StreamId::live_api()
                        && ui
                            .add(
                                egui::Button::new(
                                    RichText::new("×").color(colors::TEXT_MUTED).size(12.0),
                                )
                                .frame(false),
                            )
                            .clicked()
                    {
                        response.remove_requested = true;
                    }
                });
            });
        });

    response
}
