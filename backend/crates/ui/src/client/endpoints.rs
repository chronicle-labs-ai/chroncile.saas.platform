//! API Endpoints
//!
//! Typed endpoint methods for the Events Manager API.

use crate::types::{
    ConnectionDto, EventQuery, EventTypeMeta, EventsQueryResponse, GenerateResponse, HealthDto,
    ScenarioDto, SourceCatalogResponse, SourceSummary, TimelineDto,
};

use super::http::HttpClient;

/// API client for Events Manager
pub struct ApiClient {
    http: HttpClient,
}

impl ApiClient {
    /// Create a new API client
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            http: HttpClient::new(base_url),
        }
    }

    /// Get the base URL
    pub fn base_url(&self) -> &str {
        self.http.base_url()
    }

    // ========== Health ==========

    /// Check API health
    pub async fn health(&self) -> Result<HealthDto, String> {
        self.http.get("/health").await
    }

    // ========== Connections ==========

    /// List all connections
    pub async fn list_connections(&self) -> Result<Vec<ConnectionDto>, String> {
        #[derive(serde::Deserialize)]
        struct Response {
            connections: Vec<ConnectionDto>,
        }

        let resp: Response = self.http.get("/api/connections").await?;
        Ok(resp.connections)
    }

    /// Create a new connection
    pub async fn create_connection(
        &self,
        service: &str,
        name: Option<&str>,
    ) -> Result<ConnectionDto, String> {
        let body = serde_json::json!({
            "service": service,
            "name": name,
        });

        self.http.post("/api/connections", &body).await
    }

    /// Delete a connection
    pub async fn delete_connection(&self, connection_id: &str) -> Result<(), String> {
        self.http
            .delete(&format!("/api/connections/{}", connection_id))
            .await
    }

    /// Generate events for a connection
    pub async fn generate_events(
        &self,
        connection_id: &str,
        count: usize,
    ) -> Result<GenerateResponse, String> {
        let body = serde_json::json!({ "count": count });

        self.http
            .post(
                &format!("/api/connections/{}/generate", connection_id),
                &body,
            )
            .await
    }

    // ========== Scenarios ==========

    /// List available scenarios
    pub async fn list_scenarios(&self) -> Result<Vec<ScenarioDto>, String> {
        #[derive(serde::Deserialize)]
        struct Response {
            scenarios: Vec<ScenarioDto>,
        }

        let resp: Response = self.http.get("/api/scenarios").await?;
        Ok(resp.scenarios)
    }

    /// Load a scenario
    pub async fn load_scenario(&self, name: &str) -> Result<GenerateResponse, String> {
        self.http
            .post_empty(&format!("/api/scenarios/{}/load", name))
            .await
    }

    // ========== Timeline & Events ==========

    /// Get timeline for a conversation (legacy)
    pub async fn get_timeline(&self, conversation_id: &str) -> Result<TimelineDto, String> {
        self.http
            .get(&format!("/api/conversations/{}/timeline", conversation_id))
            .await
    }

    /// Query events with advanced filtering (tenant-based)
    pub async fn query_events(&self, query: &EventQuery) -> Result<EventsQueryResponse, String> {
        let params = query.to_query_params();
        self.http
            .get_with_params("/api/events/query", &params)
            .await
    }

    /// Get available sources for filtering (legacy - returns just source IDs)
    pub async fn list_source_ids(&self) -> Result<Vec<String>, String> {
        self.http.get("/api/events/sources").await
    }

    /// Get available event types for filtering
    pub async fn list_event_types(&self) -> Result<Vec<String>, String> {
        self.http.get("/api/events/types").await
    }

    // ========== Sources ==========

    /// Fetch all registered sources with metadata (from Source Abstraction Layer)
    pub async fn list_sources(&self) -> Result<Vec<SourceSummary>, String> {
        self.http.get("/api/sources").await
    }

    /// Fetch event catalog for a source
    pub async fn get_source_catalog(&self, source_id: &str) -> Result<Vec<EventTypeMeta>, String> {
        let resp: SourceCatalogResponse = self
            .http
            .get(&format!("/api/sources/{}/catalog", source_id))
            .await?;
        Ok(resp.events)
    }
}
