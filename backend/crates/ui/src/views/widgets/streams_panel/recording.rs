//! Recording UI Components
//!
//! UI rendering for recording controls and state visualization.

use chrono::{DateTime, Utc};
use egui::{Color32, RichText, Ui};

use chronicle_domain::StreamId;

use crate::design::{colors, rounding, spacing, typography};

use super::types::{parse_hex_color, stream_color, RecordingState, StreamsPanelResponse};
use super::StreamsPanel;

impl StreamsPanel {
    /// Render recording controls based on current state
    pub(crate) fn render_recording_controls(
        &mut self,
        ui: &mut Ui,
        response: &mut StreamsPanelResponse,
    ) {
        match self.recording_state.clone() {
            RecordingState::Idle => {
                self.render_recording_idle(ui, response);
            }
            RecordingState::SelectingStreams => {
                self.render_stream_selection(ui, response);
            }
            RecordingState::Recording {
                started_at,
                event_count,
                recording_streams,
            } => {
                self.render_recording_active(
                    ui,
                    response,
                    started_at,
                    event_count,
                    &recording_streams,
                );
            }
            RecordingState::PendingSave {
                event_count,
                duration_secs,
                recorded_streams,
            } => {
                self.render_save_prompt(
                    ui,
                    response,
                    event_count,
                    duration_secs,
                    &recorded_streams,
                );
            }
        }
    }

    /// Render idle state - just the REC button
    fn render_recording_idle(&mut self, ui: &mut Ui, _response: &mut StreamsPanelResponse) {
        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::XS))
            .stroke(egui::Stroke::new(1.0, colors::BORDER_SUBTLE))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    let record_btn = egui::Button::new(
                        RichText::new("⏺ REC")
                            .font(typography::caption())
                            .color(colors::TEXT_SECONDARY)
                            .strong(),
                    )
                    .fill(colors::BG_CONTROL)
                    .rounding(rounding::SM);

                    if ui
                        .add(record_btn)
                        .on_hover_text("Start recording to MCAP")
                        .clicked()
                    {
                        self.begin_recording_setup();
                    }

                    ui.label(
                        RichText::new("Record events to MCAP file")
                            .font(typography::caption())
                            .color(colors::TEXT_MUTED),
                    );
                });
            });
    }

    /// Render stream selection state
    fn render_stream_selection(&mut self, ui: &mut Ui, response: &mut StreamsPanelResponse) {
        // Collect stream data before rendering to avoid borrow conflicts
        let stream_data: Vec<_> = self
            .stream_order
            .iter()
            .filter_map(|id| {
                self.streams.get(id).map(|s| {
                    let color = s
                        .color
                        .as_ref()
                        .and_then(|c| parse_hex_color(c))
                        .unwrap_or_else(|| stream_color(0));
                    (
                        id.clone(),
                        s.name.clone(),
                        color,
                        s.kind.icon().to_string(),
                        self.streams_to_record.contains(id),
                    )
                })
            })
            .collect();

        let mut toggled_stream: Option<StreamId> = None;

        egui::Frame::none()
            .fill(colors::ACCENT_TEAL.gamma_multiply(0.1))
            .rounding(rounding::SM)
            .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::SM))
            .stroke(egui::Stroke::new(
                1.0,
                colors::ACCENT_TEAL.gamma_multiply(0.5),
            ))
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    // Header
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("📼 Select streams to record")
                                .font(typography::caption())
                                .color(colors::ACCENT_TEAL)
                                .strong(),
                        );
                    });

                    ui.add_space(spacing::XS);

                    // Stream checkboxes
                    for (id, name, color, kind_icon, is_selected) in &stream_data {
                        ui.horizontal(|ui| {
                            // Checkbox
                            let checkbox_size = egui::vec2(14.0, 14.0);
                            let (rect, checkbox_response) =
                                ui.allocate_exact_size(checkbox_size, egui::Sense::click());

                            let fill_color = if *is_selected {
                                *color
                            } else {
                                colors::BG_SURFACE
                            };
                            let stroke_color = *color;

                            ui.painter().rect_filled(rect, rounding::SM, fill_color);
                            ui.painter().rect_stroke(
                                rect,
                                rounding::SM,
                                egui::Stroke::new(1.5, stroke_color),
                            );

                            // Checkmark
                            if *is_selected {
                                ui.painter().text(
                                    rect.center(),
                                    egui::Align2::CENTER_CENTER,
                                    "✓",
                                    egui::FontId::proportional(10.0),
                                    colors::BG_BASE,
                                );
                            }

                            if checkbox_response.clicked() {
                                toggled_stream = Some(id.clone());
                            }

                            // Stream name
                            ui.label(RichText::new(name).font(typography::small()).color(
                                if *is_selected {
                                    colors::TEXT_PRIMARY
                                } else {
                                    colors::TEXT_MUTED
                                },
                            ));

                            // Kind badge
                            ui.label(
                                RichText::new(kind_icon)
                                    .font(typography::caption())
                                    .color(colors::TEXT_MUTED),
                            );
                        });
                    }
                });
            });

        // Handle toggled stream after the frame to avoid borrow conflicts
        if let Some(id) = toggled_stream {
            self.toggle_stream_for_recording(&id);
        }

        // Action buttons (outside the frame to avoid borrow conflicts)
        ui.add_space(spacing::XS);

        ui.horizontal(|ui| {
            let start_btn = egui::Button::new(
                RichText::new("⏺ Start Recording")
                    .font(typography::caption())
                    .color(Color32::WHITE)
                    .strong(),
            )
            .fill(colors::SIGNAL_RED.gamma_multiply(0.8))
            .rounding(rounding::SM);

            let can_start = !self.streams_to_record.is_empty();
            if ui
                .add_enabled(can_start, start_btn)
                .on_disabled_hover_text("Select at least one stream")
                .clicked()
            {
                let streams = self.streams_to_record.clone();
                self.start_recording();
                response.recording_started = Some(streams);
            }

            let cancel_btn = egui::Button::new(
                RichText::new("Cancel")
                    .font(typography::caption())
                    .color(colors::TEXT_SECONDARY),
            )
            .fill(colors::BG_CONTROL)
            .rounding(rounding::SM);

            if ui.add(cancel_btn).clicked() {
                self.cancel_recording_setup();
            }

            // Selection count
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    RichText::new(format!(
                        "{} of {} selected",
                        self.streams_to_record.len(),
                        self.stream_order.len()
                    ))
                    .font(typography::caption())
                    .color(colors::TEXT_MUTED),
                );
            });
        });
    }

    /// Render active recording state
    fn render_recording_active(
        &mut self,
        ui: &mut Ui,
        response: &mut StreamsPanelResponse,
        started_at: DateTime<Utc>,
        event_count: usize,
        recording_streams: &[StreamId],
    ) {
        egui::Frame::none()
            .fill(colors::SIGNAL_RED.gamma_multiply(0.15))
            .rounding(rounding::SM)
            .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::XS))
            .stroke(egui::Stroke::new(
                1.0,
                colors::SIGNAL_RED.gamma_multiply(0.5),
            ))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    // Stop button
                    let stop_btn = egui::Button::new(
                        RichText::new("⏹ STOP")
                            .font(typography::caption())
                            .color(colors::SIGNAL_RED)
                            .strong(),
                    )
                    .fill(colors::SIGNAL_RED.gamma_multiply(0.2))
                    .rounding(rounding::SM);

                    if ui.add(stop_btn).clicked() {
                        self.stop_recording();
                        response.recording_stopped = true;
                    }

                    // Pulsing indicator
                    let time = ui.ctx().input(|i| i.time);
                    let alpha = (0.5 + 0.5 * (time * 3.0).sin()) as f32;

                    let (rect, _) =
                        ui.allocate_exact_size(egui::vec2(8.0, 8.0), egui::Sense::hover());
                    ui.painter().circle_filled(
                        rect.center(),
                        4.0,
                        colors::SIGNAL_RED.gamma_multiply(alpha),
                    );

                    ui.label(
                        RichText::new("RECORDING")
                            .font(typography::caption())
                            .color(colors::SIGNAL_RED)
                            .strong(),
                    );

                    // Stream count being recorded
                    ui.label(
                        RichText::new(format!("({} streams)", recording_streams.len()))
                            .font(typography::caption())
                            .color(colors::TEXT_MUTED),
                    );

                    // Event count and duration
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            RichText::new(format!("{} events", event_count))
                                .font(typography::mono_small())
                                .color(colors::TEXT_MUTED),
                        );

                        let duration = Utc::now() - started_at;
                        let secs = duration.num_seconds();
                        let mins = secs / 60;
                        let secs = secs % 60;
                        ui.label(
                            RichText::new(format!("{:02}:{:02}", mins, secs))
                                .font(typography::mono_small())
                                .color(colors::SIGNAL_RED),
                        );
                    });
                });

                // Request repaint to update timer
                ui.ctx().request_repaint();
            });
    }

    /// Render save prompt after recording
    fn render_save_prompt(
        &mut self,
        ui: &mut Ui,
        response: &mut StreamsPanelResponse,
        event_count: usize,
        duration_secs: i64,
        recorded_streams: &[StreamId],
    ) {
        egui::Frame::none()
            .fill(colors::SIGNAL_GREEN.gamma_multiply(0.1))
            .rounding(rounding::SM)
            .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::SM))
            .stroke(egui::Stroke::new(
                1.0,
                colors::SIGNAL_GREEN.gamma_multiply(0.5),
            ))
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    // Header
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("✓ Recording Complete")
                                .font(typography::small())
                                .color(colors::SIGNAL_GREEN)
                                .strong(),
                        );
                    });

                    ui.add_space(spacing::XS);

                    // Summary
                    ui.horizontal(|ui| {
                        let mins = duration_secs / 60;
                        let secs = duration_secs % 60;

                        ui.label(
                            RichText::new(format!(
                                "{} events • {:02}:{:02} duration • {} streams",
                                event_count,
                                mins,
                                secs,
                                recorded_streams.len()
                            ))
                            .font(typography::caption())
                            .color(colors::TEXT_SECONDARY),
                        );
                    });

                    // Stream colors
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("Streams: ")
                                .font(typography::caption())
                                .color(colors::TEXT_MUTED),
                        );
                        for stream_id in recorded_streams {
                            if let Some(stream) = self.streams.get(stream_id) {
                                let color = stream
                                    .color
                                    .as_ref()
                                    .and_then(|c| parse_hex_color(c))
                                    .unwrap_or_else(|| stream_color(0));
                                let (rect, _) = ui.allocate_exact_size(
                                    egui::vec2(10.0, 10.0),
                                    egui::Sense::hover(),
                                );
                                ui.painter().rect_filled(rect, 2.0, color);
                            }
                        }
                    });

                    ui.add_space(spacing::SM);

                    // Action buttons
                    ui.horizontal(|ui| {
                        let save_btn = egui::Button::new(
                            RichText::new("💾 Save to File")
                                .font(typography::caption())
                                .color(Color32::WHITE)
                                .strong(),
                        )
                        .fill(colors::SIGNAL_GREEN.gamma_multiply(0.8))
                        .rounding(rounding::SM);

                        if ui.add(save_btn).clicked() {
                            response.save_recording_requested = true;
                        }

                        let discard_btn = egui::Button::new(
                            RichText::new("🗑 Discard")
                                .font(typography::caption())
                                .color(colors::SIGNAL_RED),
                        )
                        .fill(colors::BG_CONTROL)
                        .rounding(rounding::SM);

                        if ui.add(discard_btn).clicked() {
                            response.discard_recording_requested = true;
                            self.discard_recording();
                        }
                    });
                });
            });
    }
}
