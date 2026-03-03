//! Source Registry
//!
//! Compile-time source registration using the inventory crate.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use thiserror::Error;

use chronicle_sources_core::{SourceAdapter, SourceId, SourceManifest};

/// Errors related to source registry operations
#[derive(Debug, Error)]
pub enum RegistryError {
    #[error("Source not found: {0}")]
    NotFound(String),

    #[error("Source already registered: {0}")]
    AlreadyRegistered(String),

    #[error("Source initialization failed: {0}")]
    InitializationFailed(String),
}

/// Factory function type for creating source adapters
pub type SourceFactory = fn() -> Box<dyn SourceAdapter>;

/// Registration entry for a source adapter
pub struct SourceRegistration {
    /// Factory function to create the adapter
    pub factory: SourceFactory,
}

impl SourceRegistration {
    /// Create a new source registration
    pub const fn new(factory: SourceFactory) -> Self {
        Self { factory }
    }
}

// Collect all source registrations at compile time
inventory::collect!(SourceRegistration);

/// Get all registered sources
///
/// Returns an iterator over newly-created source adapter instances.
pub fn all_sources() -> impl Iterator<Item = Box<dyn SourceAdapter>> {
    inventory::iter::<SourceRegistration>
        .into_iter()
        .map(|reg| (reg.factory)())
}

/// Get a source by ID
///
/// Creates a new instance of the source adapter if found.
pub fn get_source(id: &str) -> Option<Box<dyn SourceAdapter>> {
    all_sources().find(|s| s.manifest().id.as_str() == id)
}

/// Get all source manifests
///
/// Returns metadata for all registered sources without creating full instances.
pub fn all_manifests() -> Vec<SourceManifest> {
    all_sources().map(|s| s.manifest().clone()).collect()
}

/// Check if a source is registered
pub fn has_source(id: &str) -> bool {
    all_sources().any(|s| s.manifest().id.as_str() == id)
}

/// Get source count
pub fn source_count() -> usize {
    inventory::iter::<SourceRegistration>.into_iter().count()
}

// =============================================================================
// RUNTIME REGISTRY (for additional runtime-registered sources)
// =============================================================================

/// Runtime source registry for dynamic source registration
///
/// This is used in addition to compile-time registration for sources
/// that need to be added at runtime (e.g., loaded from plugins).
pub struct SourceRegistry {
    /// Runtime-registered sources
    sources: RwLock<HashMap<SourceId, Arc<dyn SourceAdapter>>>,
}

impl SourceRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        Self {
            sources: RwLock::new(HashMap::new()),
        }
    }

    /// Create a registry with all compile-time registered sources
    pub fn with_compile_time_sources() -> Self {
        let registry = Self::new();
        for source in all_sources() {
            let id = source.manifest().id.clone();
            registry.sources.write().insert(id, Arc::from(source));
        }
        registry
    }

    /// Register a source at runtime
    pub fn register(&self, source: Box<dyn SourceAdapter>) -> Result<(), RegistryError> {
        let id = source.manifest().id.clone();
        let mut sources = self.sources.write();

        if sources.contains_key(&id) {
            return Err(RegistryError::AlreadyRegistered(id.to_string()));
        }

        sources.insert(id, Arc::from(source));
        Ok(())
    }

    /// Unregister a source
    pub fn unregister(&self, id: &SourceId) -> Result<(), RegistryError> {
        let mut sources = self.sources.write();

        if sources.remove(id).is_none() {
            return Err(RegistryError::NotFound(id.to_string()));
        }

        Ok(())
    }

    /// Get a source by ID
    pub fn get(&self, id: &str) -> Option<Arc<dyn SourceAdapter>> {
        // First check runtime registry
        if let Some(source) = self.sources.read().get(&SourceId::new(id)) {
            return Some(Arc::clone(source));
        }

        // Fall back to compile-time registry
        get_source(id).map(Arc::from)
    }

    /// Get all source manifests
    pub fn manifests(&self) -> Vec<SourceManifest> {
        let runtime_manifests: Vec<_> = self
            .sources
            .read()
            .values()
            .map(|s| s.manifest().clone())
            .collect();

        // Combine compile-time and runtime manifests, deduplicating by ID
        let mut seen = std::collections::HashSet::new();
        let mut manifests = Vec::new();

        for manifest in runtime_manifests {
            if seen.insert(manifest.id.clone()) {
                manifests.push(manifest);
            }
        }

        for manifest in all_manifests() {
            if seen.insert(manifest.id.clone()) {
                manifests.push(manifest);
            }
        }

        manifests
    }

    /// Check if a source is available
    pub fn has(&self, id: &str) -> bool {
        self.sources.read().contains_key(&SourceId::new(id)) || has_source(id)
    }

    /// Get source count
    pub fn count(&self) -> usize {
        // Count unique IDs from both runtime and compile-time sources
        let runtime_ids: std::collections::HashSet<_> =
            self.sources.read().keys().cloned().collect();

        let compile_time_ids: std::collections::HashSet<_> =
            all_sources().map(|s| s.manifest().id.clone()).collect();

        runtime_ids.union(&compile_time_ids).count()
    }

    /// List all source IDs
    pub fn source_ids(&self) -> Vec<SourceId> {
        let mut ids: std::collections::HashSet<_> = self.sources.read().keys().cloned().collect();

        for source in all_sources() {
            ids.insert(source.manifest().id.clone());
        }

        ids.into_iter().collect()
    }
}

impl Default for SourceRegistry {
    fn default() -> Self {
        Self::with_compile_time_sources()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Tests require actual source implementations to be registered
    // These tests verify the registry mechanics work correctly

    #[test]
    fn test_empty_registry() {
        let registry = SourceRegistry::new();
        assert_eq!(registry.sources.read().len(), 0);
    }

    #[test]
    fn test_compile_time_count() {
        // This will be 0 unless sources are linked in
        let count = source_count();
        // Just verify it returns a valid count (always >= 0 for usize)
        let _ = count;
    }

    #[test]
    fn test_all_sources_iterator() {
        // Just verify the iterator works
        let sources: Vec<_> = all_sources().collect();
        // Number depends on what's compiled in
        let _ = sources.len();
    }
}

