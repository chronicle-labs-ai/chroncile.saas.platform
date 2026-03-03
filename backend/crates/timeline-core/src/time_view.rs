//! Time View
//!
//! Manages the visible time range with zoom and pan state.

use chrono::{DateTime, Duration, Utc};

/// Represents the visible time range with zoom and pan state
#[derive(Clone, Debug)]
pub struct TimeView {
    /// Center of the visible time range
    pub center: DateTime<Utc>,
    /// Half-width of visible range in milliseconds
    pub half_width_ms: i64,
    /// Minimum allowed half-width (max zoom in)
    min_half_width_ms: i64,
    /// Maximum allowed half-width (max zoom out)
    max_half_width_ms: i64,
}

impl TimeView {
    /// Create a new time view with the given start and end times
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        let duration_ms = (end - start).num_milliseconds();
        let center = start + Duration::milliseconds(duration_ms / 2);
        Self {
            center,
            half_width_ms: (duration_ms / 2).max(1000),
            min_half_width_ms: 1000,                      // 1 second minimum
            max_half_width_ms: 7 * 24 * 60 * 60 * 1000,  // 7 days maximum
        }
    }

    /// Create a view centered on now with the given duration
    pub fn now_centered(duration: Duration) -> Self {
        let now = Utc::now();
        let half = duration / 2;
        Self::new(now - half, now + half)
    }

    /// Get the start time of the visible range
    pub fn start(&self) -> DateTime<Utc> {
        self.center - Duration::milliseconds(self.half_width_ms)
    }

    /// Get the end time of the visible range
    pub fn end(&self) -> DateTime<Utc> {
        self.center + Duration::milliseconds(self.half_width_ms)
    }

    /// Get the duration of the visible range
    pub fn duration(&self) -> Duration {
        Duration::milliseconds(self.half_width_ms * 2)
    }

    /// Set the time range directly
    pub fn set_range(&mut self, start: DateTime<Utc>, end: DateTime<Utc>) {
        if end > start {
            let duration_ms = (end - start).num_milliseconds();
            self.center = start + Duration::milliseconds(duration_ms / 2);
            self.half_width_ms = (duration_ms / 2).clamp(self.min_half_width_ms, self.max_half_width_ms);
        }
    }

    /// Pan the view by a delta in milliseconds
    pub fn pan(&mut self, delta_ms: i64) {
        self.center += Duration::milliseconds(delta_ms);
    }

    /// Pan the view by a pixel delta given pixels per millisecond
    pub fn pan_by_pixels(&mut self, delta_x: f32, pixels_per_ms: f32) {
        let delta_ms = (-delta_x / pixels_per_ms) as i64;
        self.pan(delta_ms);
    }

    /// Zoom at a specific time point
    pub fn zoom_at(&mut self, anchor_time: DateTime<Utc>, zoom_factor: f32) {
        let new_half_width = (self.half_width_ms as f32 / zoom_factor) as i64;
        let clamped = new_half_width.clamp(self.min_half_width_ms, self.max_half_width_ms);

        // Adjust center to keep anchor point stationary
        let anchor_offset_ms = (anchor_time - self.center).num_milliseconds();
        let scale = clamped as f64 / self.half_width_ms as f64;
        let new_anchor_offset_ms = (anchor_offset_ms as f64 * scale) as i64;
        let center_adjustment = anchor_offset_ms - new_anchor_offset_ms;

        self.center += Duration::milliseconds(center_adjustment);
        self.half_width_ms = clamped;
    }

    /// Fit the view to contain all given times with padding
    pub fn fit_to_times(&mut self, times: &[DateTime<Utc>], padding_ratio: f32) {
        if times.is_empty() {
            return;
        }

        let min_time = times.iter().min().copied().unwrap();
        let max_time = times.iter().max().copied().unwrap();
        let duration_ms = (max_time - min_time).num_milliseconds().max(1000);

        let padding_ms = (duration_ms as f32 * padding_ratio) as i64;
        self.half_width_ms = ((duration_ms + padding_ms * 2) / 2).clamp(
            self.min_half_width_ms,
            self.max_half_width_ms,
        );
        self.center = min_time + Duration::milliseconds(duration_ms / 2);
    }

    /// Expand the view to include a new time if necessary
    pub fn expand_to_include(&mut self, time: DateTime<Utc>, margin_ratio: f32) {
        let margin_ms = (self.half_width_ms as f32 * margin_ratio) as i64;
        let start = self.start();
        let end = self.end();

        if time < start {
            let delta = (start - time).num_milliseconds() + margin_ms;
            self.center -= Duration::milliseconds(delta / 2);
            self.half_width_ms += delta / 2;
        } else if time > end {
            let delta = (time - end).num_milliseconds() + margin_ms;
            self.center += Duration::milliseconds(delta / 2);
            self.half_width_ms += delta / 2;
        }
    }

    /// Convert time to x position (0.0 to 1.0)
    pub fn time_to_fraction(&self, time: DateTime<Utc>) -> f64 {
        let duration = self.duration().num_milliseconds();
        if duration == 0 {
            return 0.5;
        }
        (time - self.start()).num_milliseconds() as f64 / duration as f64
    }

    /// Convert fraction to time
    pub fn fraction_to_time(&self, fraction: f64) -> DateTime<Utc> {
        let duration = self.duration();
        let offset = Duration::milliseconds((duration.num_milliseconds() as f64 * fraction) as i64);
        self.start() + offset
    }

    /// Convert time to pixel x coordinate
    pub fn time_to_x(&self, time: DateTime<Utc>, width: f32) -> f32 {
        self.time_to_fraction(time) as f32 * width
    }

    /// Convert pixel x to time
    pub fn x_to_time(&self, x: f32, width: f32) -> DateTime<Utc> {
        let fraction = (x / width) as f64;
        self.fraction_to_time(fraction)
    }
}

impl Default for TimeView {
    fn default() -> Self {
        Self::now_centered(Duration::hours(1))
    }
}
