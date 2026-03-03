//! Time Scrubber Widget - Anduril Design System
//!
//! A mission-critical timeline scrubber with playhead, time labels, and event density.
//! Industrial aesthetic with hard geometry and functional color signaling.

use chrono::{DateTime, Duration, Utc};
use egui::{Pos2, Rect, Sense, Shape, Stroke, Ui};

use crate::design::{colors, rounding, spacing, strokes, typography};
use crate::types::{EventDto, TimeRangeMapper};

/// Response from the time scrubber widget
pub struct TimeScrubberResponse {
    /// Whether the playhead position changed
    pub playhead_changed: bool,
    /// The new playhead time (if changed)
    pub new_playhead: Option<DateTime<Utc>>,
}

/// Time scrubber widget with draggable playhead
pub struct TimeScrubber {
    /// Current playhead position
    pub playhead: DateTime<Utc>,
    /// Whether currently dragging
    is_dragging: bool,
}

impl TimeScrubber {
    /// Create a new time scrubber
    pub fn new(initial_time: DateTime<Utc>) -> Self {
        Self {
            playhead: initial_time,
            is_dragging: false,
        }
    }

    /// Set the playhead position
    pub fn set_playhead(&mut self, time: DateTime<Utc>) {
        self.playhead = time;
    }

    /// Render the time scrubber
    pub fn ui(
        &mut self,
        ui: &mut Ui,
        mapper: &TimeRangeMapper,
        events: &[EventDto],
    ) -> TimeScrubberResponse {
        let height = 52.0;
        let (rect, response) = ui.allocate_exact_size(
            egui::vec2(ui.available_width(), height),
            Sense::click_and_drag(),
        );

        let painter = ui.painter_at(rect);

        // Draw background - industrial dark
        painter.rect_filled(rect, rounding::SM, colors::BG_BASE);
        
        // Draw subtle border
        painter.rect_stroke(rect, rounding::SM, strokes::border());

        // Draw time axis line
        let axis_y = rect.bottom() - 16.0;
        painter.hline(
            rect.x_range(),
            axis_y,
            Stroke::new(1.0, colors::BORDER_SUBTLE),
        );

        // Draw time labels and tick marks
        self.paint_time_labels(&painter, &rect, mapper, axis_y);

        // Draw event density visualization
        self.paint_event_density(&painter, &rect, mapper, events, axis_y);

        // Handle drag interaction
        let mut response_out = TimeScrubberResponse {
            playhead_changed: false,
            new_playhead: None,
        };

        if response.drag_started() {
            self.is_dragging = true;
        }
        if response.drag_stopped() {
            self.is_dragging = false;
        }

        if response.dragged() || response.clicked() {
            if let Some(pos) = response.interact_pointer_pos() {
                let x = (pos.x - rect.left()).max(0.0).min(rect.width());
                let new_time = mapper.time_from_x(x);
                self.playhead = new_time;
                response_out.playhead_changed = true;
                response_out.new_playhead = Some(new_time);
            }
        }

        // Draw playhead (vertical line with hard-edge handle)
        let playhead_x = rect.left() + mapper.x_from_time(self.playhead);
        if rect.x_range().contains(playhead_x) {
            self.paint_playhead(&painter, &rect, playhead_x);
        }

        // Show time tooltip on hover
        if response.hovered() {
            if let Some(pos) = ui.ctx().pointer_hover_pos() {
                let x = (pos.x - rect.left()).max(0.0).min(rect.width());
                let hover_time = mapper.time_from_x(x);

                // Draw hover line - subtle, dashed feel
                painter.vline(
                    rect.left() + x,
                    rect.top()..=axis_y,
                    Stroke::new(1.0, colors::TEXT_MUTED),
                );

                // Show tooltip
                response.clone().on_hover_text(hover_time.format("%H:%M:%S%.3f").to_string());
            }
        }

        response_out
    }

    /// Paint time labels and tick marks - industrial, functional
    fn paint_time_labels(
        &self,
        painter: &egui::Painter,
        rect: &Rect,
        mapper: &TimeRangeMapper,
        axis_y: f32,
    ) {
        let duration = mapper.duration();
        let duration_secs = duration.num_seconds() as f64;

        // Determine tick interval based on duration
        let (major_interval, minor_count) = if duration_secs <= 60.0 {
            (Duration::seconds(10), 2)
        } else if duration_secs <= 300.0 {
            (Duration::seconds(30), 3)
        } else if duration_secs <= 3600.0 {
            (Duration::minutes(1), 4)
        } else if duration_secs <= 14400.0 {
            (Duration::minutes(10), 5)
        } else {
            (Duration::hours(1), 6)
        };

        let major_ms = major_interval.num_milliseconds();
        let start_ms = mapper.start.timestamp_millis();
        let end_ms = mapper.end.timestamp_millis();

        // Align to interval boundary
        let first_tick_ms = ((start_ms / major_ms) * major_ms) + major_ms;

        let text_color = colors::TEXT_MUTED;
        let tick_color = colors::BORDER_DEFAULT;
        let minor_tick_color = colors::BORDER_SUBTLE;

        // Draw major ticks
        let mut tick_ms = first_tick_ms;
        while tick_ms <= end_ms {
            let tick_time = DateTime::from_timestamp_millis(tick_ms).unwrap_or(mapper.start);
            let x = rect.left() + mapper.x_from_time(tick_time);

            if rect.x_range().contains(x) {
                // Major tick line - hard edge
                painter.vline(x, (axis_y - 8.0)..=axis_y, Stroke::new(1.0, tick_color));

                // Time label - monospace for precision
                let label = if duration_secs <= 60.0 {
                    tick_time.format("%S").to_string()
                } else if duration_secs <= 3600.0 {
                    tick_time.format("%M:%S").to_string()
                } else {
                    tick_time.format("%H:%M").to_string()
                };

                painter.text(
                    Pos2::new(x, axis_y + 2.0),
                    egui::Align2::CENTER_TOP,
                    label,
                    typography::mono_small(),
                    text_color,
                );
            }

            // Draw minor ticks
            if minor_count > 0 {
                let minor_interval = major_ms / minor_count as i64;
                for i in 1..minor_count {
                    let minor_ms = tick_ms - major_ms + (minor_interval * i as i64);
                    if minor_ms > start_ms && minor_ms < end_ms {
                        let minor_time =
                            DateTime::from_timestamp_millis(minor_ms).unwrap_or(mapper.start);
                        let minor_x = rect.left() + mapper.x_from_time(minor_time);
                        if rect.x_range().contains(minor_x) {
                            painter.vline(
                                minor_x,
                                (axis_y - 4.0)..=axis_y,
                                Stroke::new(1.0, minor_tick_color),
                            );
                        }
                    }
                }
            }

            tick_ms += major_ms;
        }

        // Draw start and end time labels - authoritative
        let start_label = mapper.start.format("%H:%M:%S").to_string();
        let end_label = mapper.end.format("%H:%M:%S").to_string();

        painter.text(
            Pos2::new(rect.left() + spacing::XS, rect.top() + spacing::XS),
            egui::Align2::LEFT_TOP,
            start_label,
            typography::mono_small(),
            colors::TEXT_SECONDARY,
        );

        painter.text(
            Pos2::new(rect.right() - spacing::XS, rect.top() + spacing::XS),
            egui::Align2::RIGHT_TOP,
            end_label,
            typography::mono_small(),
            colors::TEXT_SECONDARY,
        );
    }

    /// Paint event density visualization - functional bars
    fn paint_event_density(
        &self,
        painter: &egui::Painter,
        rect: &Rect,
        mapper: &TimeRangeMapper,
        events: &[EventDto],
        axis_y: f32,
    ) {
        if events.is_empty() {
            return;
        }

        // Bucket events into bins for density visualization
        let num_bins = (rect.width() / 4.0).max(10.0) as usize;
        let mut bins = vec![0usize; num_bins];

        for event in events {
            let x = mapper.x_from_time(event.occurred_at);
            if x >= 0.0 && x <= rect.width() {
                let bin_idx = ((x / rect.width()) * (num_bins - 1) as f32) as usize;
                if bin_idx < num_bins {
                    bins[bin_idx] += 1;
                }
            }
        }

        let max_count = bins.iter().copied().max().unwrap_or(1).max(1);
        let bar_width = rect.width() / num_bins as f32;
        let max_bar_height = axis_y - rect.top() - 24.0;

        // Draw density bars - desaturated signal color
        for (i, &count) in bins.iter().enumerate() {
            if count > 0 {
                let height = (count as f32 / max_count as f32) * max_bar_height;
                let x = rect.left() + (i as f32 * bar_width);

                // Color intensity based on density
                let intensity = 0.2 + 0.4 * (count as f32 / max_count as f32);
                let color = colors::ACCENT_TEAL.gamma_multiply(intensity);

                painter.rect_filled(
                    Rect::from_min_size(
                        Pos2::new(x, axis_y - height - 4.0),
                        egui::vec2(bar_width - 1.0, height),
                    ),
                    rounding::NONE, // Hard edges
                    color,
                );
            }
        }
    }

    /// Paint the playhead - hard geometric shape
    fn paint_playhead(&self, painter: &egui::Painter, rect: &Rect, x: f32) {
        let playhead_color = colors::ACCENT_TEAL;
        let axis_y = rect.bottom() - 16.0;

        // Hard-edge triangle handle at top (inverted)
        let handle_width = 8.0;
        let handle_height = 10.0;
        let handle_y = rect.top() + 14.0;

        painter.add(Shape::convex_polygon(
            vec![
                Pos2::new(x, handle_y + handle_height),
                Pos2::new(x - handle_width / 2.0, handle_y),
                Pos2::new(x + handle_width / 2.0, handle_y),
            ],
            playhead_color,
            Stroke::NONE,
        ));

        // Vertical line from handle to axis - strong, visible
        painter.vline(
            x,
            (handle_y + handle_height)..=axis_y,
            Stroke::new(2.0, playhead_color),
        );

        // Small square indicator at axis (hard geometry, not circle)
        let indicator_size = 4.0;
        painter.rect_filled(
            Rect::from_center_size(
                Pos2::new(x, axis_y),
                egui::vec2(indicator_size, indicator_size),
            ),
            rounding::NONE,
            playhead_color,
        );
    }
}

impl Default for TimeScrubber {
    fn default() -> Self {
        Self::new(Utc::now())
    }
}
