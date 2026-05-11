pub const TENANT_CONTEXT_URI: &str = "chronicle://tenant/context";
pub const LATEST_ACTIVITY_URI: &str = "chronicle://activity/latest";
pub const SOURCES_CATALOG_URI: &str = "chronicle://sources/catalog";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChronicleResourceUri {
    TenantContext,
    LatestActivity,
    SourcesCatalog,
    RunDetail { run_id: String },
    EventDetail { event_id: String },
    Schema { source: String, event_type: String },
}

impl ChronicleResourceUri {
    pub fn parse(uri: &str) -> Option<Self> {
        if uri == TENANT_CONTEXT_URI {
            return Some(Self::TenantContext);
        }
        if uri == LATEST_ACTIVITY_URI {
            return Some(Self::LatestActivity);
        }
        if uri == SOURCES_CATALOG_URI {
            return Some(Self::SourcesCatalog);
        }

        let path = uri.strip_prefix("chronicle://")?;
        let segments: Vec<_> = path.split('/').collect();
        match segments.as_slice() {
            ["runs", run_id] => Some(Self::RunDetail {
                run_id: (*run_id).to_string(),
            }),
            ["events", event_id] => Some(Self::EventDetail {
                event_id: (*event_id).to_string(),
            }),
            ["schema", source, event_type] => Some(Self::Schema {
                source: (*source).to_string(),
                event_type: (*event_type).to_string(),
            }),
            _ => None,
        }
    }
}
