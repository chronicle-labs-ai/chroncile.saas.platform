//! Filter Panel Types
//!
//! Response types and helper functions for the filter panel.

use std::collections::HashSet;

use crate::types::{EventQuery, LaneGrouping, TimeWindow, TimeWindowPreset};

/// Response from filter panel indicating changes
pub struct FilterPanelResponse {
    /// Whether filters changed
    pub changed: bool,
    /// New time window if changed
    pub time_window_changed: bool,
}

/// Filter panel state
pub struct FilterPanel {
    // Available options (populated from API)
    pub available_sources: Vec<String>,
    pub available_types: Vec<String>,

    // Selected filters
    pub selected_sources: HashSet<String>,
    pub selected_types: HashSet<String>,

    // Time window
    pub time_window_preset: TimeWindowPreset,
    pub time_window: TimeWindow,

    // Grouping mode
    pub lane_grouping: LaneGrouping,

    // Search filters
    pub actor_search: String,
    pub subject_search: String,

    // UI state
    pub(crate) expanded: bool,
}

impl FilterPanel {
    pub fn new() -> Self {
        Self {
            available_sources: Vec::new(),
            available_types: Vec::new(),
            selected_sources: HashSet::new(),
            selected_types: HashSet::new(),
            time_window_preset: TimeWindowPreset::default(),
            time_window: TimeWindow::default(),
            lane_grouping: LaneGrouping::default(),
            actor_search: String::new(),
            subject_search: String::new(),
            expanded: false,
        }
    }

    /// Set available sources (from API)
    pub fn set_available_sources(&mut self, sources: Vec<String>) {
        self.available_sources = sources;
        // Auto-select all if none selected
        if self.selected_sources.is_empty() {
            self.selected_sources = self.available_sources.iter().cloned().collect();
        }
    }

    /// Set available event types (from API)
    pub fn set_available_types(&mut self, types: Vec<String>) {
        self.available_types = types;
        // Auto-select all if none selected
        if self.selected_types.is_empty() {
            self.selected_types = self.available_types.iter().cloned().collect();
        }
    }

    /// Get current query from filter settings
    pub fn to_event_query(&self) -> EventQuery {
        let mut query = EventQuery::new().with_time_window(self.time_window.clone());

        if !self.selected_sources.is_empty()
            && self.selected_sources.len() < self.available_sources.len()
        {
            query = query.with_sources(self.selected_sources.iter().cloned());
        }

        if !self.selected_types.is_empty() && self.selected_types.len() < self.available_types.len()
        {
            query = query.with_event_types(self.selected_types.iter().cloned());
        }

        query
    }

    /// Get query without time window filter (for live event filtering)
    pub fn to_event_query_without_time(&self) -> EventQuery {
        let mut query = EventQuery::new();

        if !self.selected_sources.is_empty()
            && self.selected_sources.len() < self.available_sources.len()
        {
            query = query.with_sources(self.selected_sources.iter().cloned());
        }

        if !self.selected_types.is_empty() && self.selected_types.len() < self.available_types.len()
        {
            query = query.with_event_types(self.selected_types.iter().cloned());
        }

        // Actor and subject search are always applied
        if !self.actor_search.is_empty() {
            query.actors.insert(self.actor_search.clone());
        }
        if !self.subject_search.is_empty() {
            query.subjects.insert(self.subject_search.clone());
        }

        query
    }
}

impl Default for FilterPanel {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper to capitalize a source ID for display
/// e.g., "intercom" -> "Intercom", "mock-zendesk" -> "Mock Zendesk"
pub fn capitalize_source_id(source_id: &str) -> String {
    source_id
        .split('-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().chain(chars).collect(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
