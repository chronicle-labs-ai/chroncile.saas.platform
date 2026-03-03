//! Polling Fetcher
//!
//! Trait for sources that require polling APIs for events.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use chronicle_domain::EventEnvelope;

use crate::context::IngestContext;
use crate::error::PollingError;

/// Cursor for paginated polling
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PollCursor {
    /// Opaque cursor value (implementation-specific)
    pub value: String,
    /// Last successful poll timestamp
    pub last_poll: DateTime<Utc>,
    /// Number of events fetched in last poll
    pub last_count: usize,
}

impl PollCursor {
    pub fn new(value: impl Into<String>) -> Self {
        Self {
            value: value.into(),
            last_poll: Utc::now(),
            last_count: 0,
        }
    }

    pub fn initial() -> Self {
        Self {
            value: String::new(),
            last_poll: Utc::now(),
            last_count: 0,
        }
    }
}

/// Result of a polling operation
#[derive(Clone, Debug)]
pub struct PollResult {
    /// Events fetched in this poll
    pub events: Vec<EventEnvelope>,
    /// Next cursor for pagination (None if no more data)
    pub next_cursor: Option<PollCursor>,
    /// Whether there are more pages to fetch
    pub has_more: bool,
    /// Rate limit info if available
    pub rate_limit: Option<RateLimitInfo>,
}

/// Rate limiting information
#[derive(Clone, Debug)]
pub struct RateLimitInfo {
    /// Requests remaining in current window
    pub remaining: u32,
    /// Total requests allowed per window
    pub limit: u32,
    /// When the rate limit resets
    pub reset_at: DateTime<Utc>,
}

/// Trait for polling-based event sources
///
/// Implement this trait for sources that require periodic API polling
/// to fetch events (as opposed to receiving webhooks).
#[async_trait]
pub trait PollingFetcher: Send + Sync {
    /// Poll for new events starting from the given cursor
    ///
    /// If cursor is None, start from the beginning or a reasonable default.
    async fn poll(
        &self,
        cursor: Option<&PollCursor>,
        context: &IngestContext,
    ) -> Result<PollResult, PollingError>;

    /// Get the recommended polling interval
    ///
    /// This may vary based on rate limits or source recommendations.
    fn polling_interval(&self) -> std::time::Duration {
        std::time::Duration::from_secs(60)
    }

    /// Get the initial cursor for a new polling session
    ///
    /// Override to start from a specific point (e.g., last N days).
    fn initial_cursor(&self) -> PollCursor {
        PollCursor::initial()
    }

    /// Check if the source is healthy and accessible
    async fn health_check(&self, context: &IngestContext) -> Result<(), PollingError>;
}

