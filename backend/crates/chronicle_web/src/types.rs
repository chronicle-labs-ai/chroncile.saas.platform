//! Web event tracking types.
//!
//! These types model the JSON payloads sent by browser or server-side
//! SDKs. They follow a Segment-like model (track / page / identify /
//! group) and carry device/browser context alongside each event.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Context sub-types
// ---------------------------------------------------------------------------

/// Screen dimensions and pixel density.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub width: u32,
    pub height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub density: Option<f32>,
}

/// Page-level metadata captured by the browser SDK.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referrer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
}

/// UTM campaign parameters.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub medium: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub term: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

/// Metadata about the client library that produced this event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryInfo {
    pub name: String,
    pub version: String,
}

// ---------------------------------------------------------------------------
// WebContext
// ---------------------------------------------------------------------------

/// Device, browser, and campaign context attached to every web event.
///
/// Client SDKs auto-collect most of these fields. Server-side SDKs
/// typically only set `ip` and `library`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WebContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screen: Option<ScreenInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<PageInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub campaign: Option<CampaignInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub library: Option<LibraryInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// Catch-all for SDK-specific context fields.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Incoming event types
// ---------------------------------------------------------------------------

/// The kind of web event and its associated data.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum WebEventKind {
    Track {
        event: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        properties: Option<serde_json::Value>,
    },
    Page {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        properties: Option<serde_json::Value>,
    },
    Identify {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        traits: Option<serde_json::Value>,
    },
    Group {
        group_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        traits: Option<serde_json::Value>,
    },
}

/// A single incoming web event as received from a client SDK.
///
/// The `message_id` field serves as an idempotency key, making this
/// compatible with event gateways like Hookdeck that deduplicate on it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingWebEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<WebContext>,

    #[serde(flatten)]
    pub kind: WebEventKind,
}

/// Batch envelope for sending multiple events in one request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchPayload {
    pub batch: Vec<IncomingWebEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Typed request bodies for single-endpoint ingestion
// ---------------------------------------------------------------------------

/// `POST /v1/web/track` request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    pub event: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<WebContext>,
}

/// `POST /v1/web/page` request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<WebContext>,
}

/// `POST /v1/web/identify` request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentifyRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    pub user_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub traits: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<WebContext>,
}

/// `POST /v1/web/group` request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    pub group_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub traits: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<WebContext>,
}

// ---------------------------------------------------------------------------
// Conversions: typed requests → IncomingWebEvent
// ---------------------------------------------------------------------------

impl From<TrackRequest> for IncomingWebEvent {
    fn from(r: TrackRequest) -> Self {
        Self {
            message_id: r.message_id,
            anonymous_id: r.anonymous_id,
            user_id: r.user_id,
            timestamp: r.timestamp,
            context: r.context,
            kind: WebEventKind::Track {
                event: r.event,
                properties: r.properties,
            },
        }
    }
}

impl From<PageRequest> for IncomingWebEvent {
    fn from(r: PageRequest) -> Self {
        Self {
            message_id: r.message_id,
            anonymous_id: r.anonymous_id,
            user_id: r.user_id,
            timestamp: r.timestamp,
            context: r.context,
            kind: WebEventKind::Page {
                name: r.name,
                properties: r.properties,
            },
        }
    }
}

impl From<IdentifyRequest> for IncomingWebEvent {
    fn from(r: IdentifyRequest) -> Self {
        Self {
            message_id: r.message_id,
            anonymous_id: r.anonymous_id,
            user_id: Some(r.user_id),
            timestamp: r.timestamp,
            context: r.context,
            kind: WebEventKind::Identify { traits: r.traits },
        }
    }
}

impl From<GroupRequest> for IncomingWebEvent {
    fn from(r: GroupRequest) -> Self {
        Self {
            message_id: r.message_id,
            anonymous_id: r.anonymous_id,
            user_id: r.user_id,
            timestamp: r.timestamp,
            context: r.context,
            kind: WebEventKind::Group {
                group_id: r.group_id,
                traits: r.traits,
            },
        }
    }
}
