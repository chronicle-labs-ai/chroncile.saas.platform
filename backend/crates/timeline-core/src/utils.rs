//! Utilities
//!
//! Duration formatting and other utility functions.

use chrono::Duration;

/// Format a duration for display
pub fn format_duration(duration: Duration) -> String {
    let total_secs = duration.num_seconds();
    if total_secs < 60 {
        format!("{}s", total_secs)
    } else if total_secs < 3600 {
        format!("{}m {}s", total_secs / 60, total_secs % 60)
    } else {
        format!("{}h {}m", total_secs / 3600, (total_secs % 3600) / 60)
    }
}

/// Format a duration with millisecond precision for short durations
pub fn format_duration_precise(duration: Duration) -> String {
    let total_ms = duration.num_milliseconds();
    if total_ms < 1000 {
        format!("{}ms", total_ms)
    } else if total_ms < 60_000 {
        format!("{:.2}s", total_ms as f64 / 1000.0)
    } else {
        format_duration(duration)
    }
}

/// Format a time delta relative to now
pub fn format_relative_time(duration: Duration) -> String {
    let total_secs = duration.num_seconds().abs();
    let prefix = if duration.num_seconds() < 0 {
        ""
    } else {
        "in "
    };
    let suffix = if duration.num_seconds() < 0 {
        " ago"
    } else {
        ""
    };

    let formatted = if total_secs < 60 {
        format!("{}s", total_secs)
    } else if total_secs < 3600 {
        format!("{}m", total_secs / 60)
    } else if total_secs < 86400 {
        format!("{}h", total_secs / 3600)
    } else {
        format!("{}d", total_secs / 86400)
    };

    format!("{}{}{}", prefix, formatted, suffix)
}
