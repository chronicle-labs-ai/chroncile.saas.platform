//! Schema Version Registry
//!
//! Detect and migrate between different payload schema versions.

use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::error::MigrationError;
use crate::mapping::extract_jsonpath;

/// Schema migration trait
pub trait SchemaMigration: Send + Sync {
    /// Migrate payload from one version to another
    fn migrate(&self, payload: serde_json::Value) -> Result<serde_json::Value, MigrationError>;

    /// Source version
    fn source_version(&self) -> u32;

    /// Target version
    fn to_version(&self) -> u32;
}

/// Schema version definition
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SchemaVersion {
    /// Version number
    pub version: u32,
    /// JSONPath to detect this version
    pub detector_path: String,
    /// Expected value at detector path (if any)
    #[serde(default)]
    pub expected_value: Option<serde_json::Value>,
    /// Description of this version
    #[serde(default)]
    pub description: String,
}

impl SchemaVersion {
    /// Create a new schema version
    pub fn new(version: u32, detector_path: impl Into<String>) -> Self {
        Self {
            version,
            detector_path: detector_path.into(),
            expected_value: None,
            description: String::new(),
        }
    }

    /// Set expected value for detection
    pub fn with_expected_value(mut self, value: serde_json::Value) -> Self {
        self.expected_value = Some(value);
        self
    }

    /// Set description
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = desc.into();
        self
    }

    /// Check if payload matches this version
    pub fn matches(&self, payload: &serde_json::Value) -> bool {
        if let Some(extracted) = extract_jsonpath(payload, &self.detector_path) {
            match &self.expected_value {
                Some(expected) => &extracted == expected,
                None => true, // Just checking path exists
            }
        } else {
            false
        }
    }
}

/// Registry of schema versions and migrations
#[derive(Clone, Default)]
pub struct SchemaVersionRegistry {
    /// Known schema versions (ordered from oldest to newest)
    versions: Vec<SchemaVersion>,
    /// Migrations between versions
    migrations: Vec<Arc<dyn SchemaMigration>>,
    /// Latest/current version
    current_version: u32,
}

impl SchemaVersionRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        Self::default()
    }

    /// Create with initial current version
    pub fn with_current_version(version: u32) -> Self {
        Self {
            current_version: version,
            ..Default::default()
        }
    }

    /// Register a schema version
    pub fn register_version(&mut self, version: SchemaVersion) {
        if version.version > self.current_version {
            self.current_version = version.version;
        }
        self.versions.push(version);
        self.versions.sort_by_key(|v| v.version);
    }

    /// Register a migration
    pub fn register_migration(&mut self, migration: Arc<dyn SchemaMigration>) {
        self.migrations.push(migration);
    }

    /// Get the current/latest version
    pub fn current_version(&self) -> u32 {
        self.current_version
    }

    /// Detect schema version from payload
    pub fn detect_version(&self, payload: &serde_json::Value) -> u32 {
        // Try versions from newest to oldest
        for version in self.versions.iter().rev() {
            if version.matches(payload) {
                return version.version;
            }
        }

        // Default to current version if no match
        self.current_version
    }

    /// Migrate payload to latest version
    pub fn migrate_to_latest(
        &self,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value, MigrationError> {
        let current = self.detect_version(&payload);
        self.migrate_to_version(payload, current, self.current_version)
    }

    /// Migrate payload from one version to another
    pub fn migrate_to_version(
        &self,
        mut payload: serde_json::Value,
        from: u32,
        to: u32,
    ) -> Result<serde_json::Value, MigrationError> {
        if from == to {
            return Ok(payload);
        }

        if from > to {
            return Err(MigrationError::MigrationFailed {
                from,
                to,
                message: "Cannot migrate to older version".to_string(),
            });
        }

        // Find and apply migrations in order
        let mut current_version = from;
        while current_version < to {
            let migration = self
                .migrations
                .iter()
                .find(|m| m.source_version() == current_version)
                .ok_or_else(|| MigrationError::MigrationFailed {
                    from: current_version,
                    to: current_version + 1,
                    message: "No migration found".to_string(),
                })?;

            payload = migration.migrate(payload)?;
            current_version = migration.to_version();
        }

        Ok(payload)
    }

    /// Check if a version is known
    pub fn is_known_version(&self, version: u32) -> bool {
        self.versions.iter().any(|v| v.version == version)
    }

    /// Get all registered versions
    pub fn versions(&self) -> &[SchemaVersion] {
        &self.versions
    }
}

impl std::fmt::Debug for SchemaVersionRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SchemaVersionRegistry")
            .field("versions", &self.versions)
            .field("current_version", &self.current_version)
            .field("migration_count", &self.migrations.len())
            .finish()
    }
}

/// Simple field rename migration
pub struct FieldRenameMigration {
    from_version: u32,
    to_version: u32,
    renames: Vec<(String, String)>,
}

impl FieldRenameMigration {
    pub fn new(from_version: u32, to_version: u32) -> Self {
        Self {
            from_version,
            to_version,
            renames: Vec::new(),
        }
    }

    pub fn rename(mut self, from: impl Into<String>, to: impl Into<String>) -> Self {
        self.renames.push((from.into(), to.into()));
        self
    }
}

impl SchemaMigration for FieldRenameMigration {
    fn source_version(&self) -> u32 {
        self.from_version
    }

    fn to_version(&self) -> u32 {
        self.to_version
    }

    fn migrate(&self, mut payload: serde_json::Value) -> Result<serde_json::Value, MigrationError> {
        if let Some(obj) = payload.as_object_mut() {
            for (from, to) in &self.renames {
                if let Some(value) = obj.remove(from) {
                    obj.insert(to.clone(), value);
                }
            }
        }
        Ok(payload)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_version_detection() {
        let mut registry = SchemaVersionRegistry::with_current_version(2);

        registry.register_version(
            SchemaVersion::new(1, "$.version")
                .with_expected_value(json!(1))
                .with_description("Initial version"),
        );

        registry.register_version(
            SchemaVersion::new(2, "$.version")
                .with_expected_value(json!(2))
                .with_description("Current version"),
        );

        let v1_payload = json!({ "version": 1, "data": "old" });
        let v2_payload = json!({ "version": 2, "data": "new" });

        assert_eq!(registry.detect_version(&v1_payload), 1);
        assert_eq!(registry.detect_version(&v2_payload), 2);
    }

    #[test]
    fn test_field_rename_migration() {
        let migration = FieldRenameMigration::new(1, 2)
            .rename("old_field", "new_field")
            .rename("deprecated", "current");

        let payload = json!({
            "old_field": "value1",
            "deprecated": "value2",
            "unchanged": "value3"
        });

        let migrated = migration.migrate(payload).unwrap();

        assert_eq!(migrated.get("new_field").unwrap(), "value1");
        assert_eq!(migrated.get("current").unwrap(), "value2");
        assert_eq!(migrated.get("unchanged").unwrap(), "value3");
        assert!(migrated.get("old_field").is_none());
    }
}
