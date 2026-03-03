//! Field Mapper Helper Functions
//!
//! Utility functions for JSON value conversion.

use chrono::{DateTime, Utc};

/// Helper: Convert JSON value to string
pub fn value_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Null => String::new(),
        _ => value.to_string().trim_matches('"').to_string(),
    }
}

/// Helper: Convert JSON value to timestamp
pub fn value_to_timestamp(value: &serde_json::Value) -> Option<DateTime<Utc>> {
    match value {
        serde_json::Value::Number(n) => {
            let num = n.as_i64()?;
            // Detect if seconds or milliseconds based on magnitude
            if num > 1_000_000_000_000 {
                DateTime::from_timestamp_millis(num)
            } else {
                DateTime::from_timestamp(num, 0)
            }
        }
        serde_json::Value::String(s) => {
            // Try RFC3339 first
            DateTime::parse_from_rfc3339(s)
                .ok()
                .map(|dt| dt.to_utc())
                .or_else(|| {
                    // Try parsing as number
                    s.parse::<i64>().ok().and_then(|num| {
                        if num > 1_000_000_000_000 {
                            DateTime::from_timestamp_millis(num)
                        } else {
                            DateTime::from_timestamp(num, 0)
                        }
                    })
                })
        }
        _ => None,
    }
}
