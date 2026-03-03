//! Field Mapper Transform Logic
//!
//! Functions for applying transformations to extracted values.

use chrono::{DateTime, Utc};

use crate::error::MappingError;

use super::config::{TimestampFormat, Transform};
use super::helpers::value_to_string;

/// Apply transformation to a value
pub fn apply_transform(
    value: serde_json::Value,
    transform: &Transform,
    extract_fn: &impl Fn(&str, &serde_json::Value) -> Option<serde_json::Value>,
) -> Result<serde_json::Value, MappingError> {
    match transform {
        Transform::Prefix { prefix } => {
            let s = value_to_string(&value);
            Ok(serde_json::Value::String(format!("{}{}", prefix, s)))
        }
        Transform::Suffix { suffix } => {
            let s = value_to_string(&value);
            Ok(serde_json::Value::String(format!("{}{}", s, suffix)))
        }
        Transform::Timestamp { format } => {
            let ts = match format {
                TimestampFormat::UnixSeconds => {
                    let secs = value.as_i64().unwrap_or(0);
                    DateTime::from_timestamp(secs, 0)
                }
                TimestampFormat::UnixMillis => {
                    let millis = value.as_i64().unwrap_or(0);
                    DateTime::from_timestamp_millis(millis)
                }
                TimestampFormat::Iso8601 => {
                    let s = value_to_string(&value);
                    DateTime::parse_from_rfc3339(&s).ok().map(|dt| dt.to_utc())
                }
                TimestampFormat::Custom(fmt) => {
                    let s = value_to_string(&value);
                    chrono::NaiveDateTime::parse_from_str(&s, fmt)
                        .ok()
                        .map(|dt| dt.and_utc())
                }
            };
            Ok(serde_json::Value::String(
                ts.unwrap_or_else(Utc::now).to_rfc3339(),
            ))
        }
        Transform::Map { mappings, default } => {
            let key = value_to_string(&value);
            let mapped = mappings
                .get(&key)
                .cloned()
                .or_else(|| default.clone())
                .unwrap_or(key);
            Ok(serde_json::Value::String(mapped))
        }
        Transform::Template { template } => {
            // Simple template substitution for {{field}} patterns
            let mut result = template.clone();
            if let Some(obj) = value.as_object() {
                for (key, val) in obj {
                    let placeholder = format!("{{{{{}}}}}", key);
                    result = result.replace(&placeholder, &value_to_string(val));
                }
            }
            Ok(serde_json::Value::String(result))
        }
        Transform::Extract { path } => {
            extract_fn(path, &value).ok_or_else(|| MappingError::ExtractionFailed {
                path: path.clone(),
                message: "Nested extraction failed".to_string(),
            })
        }
        Transform::Chain { transforms } => {
            let mut current = value;
            for t in transforms {
                current = apply_transform(current, t, extract_fn)?;
            }
            Ok(current)
        }
        Transform::Lowercase => Ok(serde_json::Value::String(
            value_to_string(&value).to_lowercase(),
        )),
        Transform::Uppercase => Ok(serde_json::Value::String(
            value_to_string(&value).to_uppercase(),
        )),
        Transform::Replace { from, to } => {
            let s = value_to_string(&value).replace(from, to);
            Ok(serde_json::Value::String(s))
        }
    }
}
