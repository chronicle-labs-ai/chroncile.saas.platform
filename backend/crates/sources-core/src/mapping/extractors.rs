//! Value Extractors
//!
//! Utilities for extracting values from JSON payloads.

use jsonpath_rust::JsonPathQuery;
use serde_json::Value;

/// Extract a value from JSON using JSONPath
pub fn extract_jsonpath(payload: &Value, path: &str) -> Option<Value> {
    // Normalize path to start with $
    let normalized_path = if path.starts_with('$') {
        path.to_string()
    } else {
        format!("$.{}", path)
    };

    payload.clone().path(&normalized_path).ok().and_then(|results| {
        // Handle null results
        if results.is_null() {
            return None;
        }
        
        if results.is_array() {
            let arr = results.as_array().unwrap();
            // Filter out null values
            let non_null: Vec<_> = arr.iter().filter(|v| !v.is_null()).cloned().collect();
            if non_null.len() == 1 {
                Some(non_null[0].clone())
            } else if non_null.is_empty() {
                None
            } else {
                Some(Value::Array(non_null))
            }
        } else {
            Some(results)
        }
    })
}

/// Extract a string value from JSON
pub fn extract_string(payload: &Value, path: &str) -> Option<String> {
    extract_jsonpath(payload, path).map(|v| match v {
        Value::String(s) => s,
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => v.to_string(),
    })
}

/// Extract an i64 value from JSON
pub fn extract_i64(payload: &Value, path: &str) -> Option<i64> {
    extract_jsonpath(payload, path).and_then(|v| match v {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    })
}

/// Extract a boolean value from JSON
pub fn extract_bool(payload: &Value, path: &str) -> Option<bool> {
    extract_jsonpath(payload, path).and_then(|v| match v {
        Value::Bool(b) => Some(b),
        Value::String(s) => match s.to_lowercase().as_str() {
            "true" | "1" | "yes" => Some(true),
            "false" | "0" | "no" => Some(false),
            _ => None,
        },
        Value::Number(n) => n.as_i64().map(|i| i != 0),
        _ => None,
    })
}

/// Extract an array value from JSON
pub fn extract_array(payload: &Value, path: &str) -> Option<Vec<Value>> {
    extract_jsonpath(payload, path).and_then(|v| v.as_array().cloned())
}

/// Check if a path exists in the JSON
pub fn path_exists(payload: &Value, path: &str) -> bool {
    extract_jsonpath(payload, path).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_string() {
        let payload = json!({
            "name": "John",
            "nested": {
                "value": "deep"
            }
        });

        assert_eq!(extract_string(&payload, "$.name"), Some("John".to_string()));
        assert_eq!(
            extract_string(&payload, "$.nested.value"),
            Some("deep".to_string())
        );
        assert_eq!(extract_string(&payload, "$.missing"), None);
    }

    #[test]
    fn test_extract_i64() {
        let payload = json!({
            "count": 42,
            "string_num": "123"
        });

        assert_eq!(extract_i64(&payload, "$.count"), Some(42));
        assert_eq!(extract_i64(&payload, "$.string_num"), Some(123));
    }

    #[test]
    fn test_extract_array() {
        let payload = json!({
            "items": [1, 2, 3]
        });

        let items = extract_array(&payload, "$.items");
        assert!(items.is_some());
        assert_eq!(items.unwrap().len(), 3);
    }
}

