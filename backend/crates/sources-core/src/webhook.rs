//! Webhook Handler
//!
//! Trait for sources that receive events via webhooks.

use async_trait::async_trait;
use bytes::Bytes;
use http::HeaderMap;

use chronicle_domain::EventEnvelope;

use crate::context::IngestContext;
use crate::error::WebhookError;

/// Trait for webhook-based event sources
///
/// Implement this trait for sources that push events via webhooks.
#[async_trait]
pub trait WebhookHandler: Send + Sync {
    /// Verify webhook signature/authenticity
    ///
    /// Most webhook providers include a signature header that should be
    /// verified against the request body using a shared secret.
    async fn verify_signature(
        &self,
        headers: &HeaderMap,
        body: &[u8],
        secret: &str,
    ) -> Result<(), WebhookError>;

    /// Parse and transform webhook payload to EventEnvelope(s)
    ///
    /// A single webhook may produce multiple events (e.g., batch webhooks).
    async fn handle_webhook(
        &self,
        headers: &HeaderMap,
        body: Bytes,
        context: &IngestContext,
    ) -> Result<Vec<EventEnvelope>, WebhookError>;

    /// Get expected webhook topics/event types
    ///
    /// Returns the list of topics this handler can process.
    fn supported_topics(&self) -> &[&str];

    /// Check if this handler supports a given topic
    fn supports_topic(&self, topic: &str) -> bool {
        self.supported_topics().contains(&topic)
    }

    /// Extract the topic from the webhook payload or headers
    ///
    /// Override this if the topic is in a non-standard location.
    fn extract_topic(&self, headers: &HeaderMap, body: &[u8]) -> Option<String> {
        // Default: try to extract from body JSON
        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(body) {
            if let Some(topic) = json.get("topic").and_then(|v| v.as_str()) {
                return Some(topic.to_string());
            }
            if let Some(event_type) = json.get("event_type").and_then(|v| v.as_str()) {
                return Some(event_type.to_string());
            }
            if let Some(event) = json.get("event").and_then(|v| v.as_str()) {
                return Some(event.to_string());
            }
        }

        // Try common header names
        for header_name in &[
            "x-webhook-topic",
            "x-event-type",
            "x-github-event",
            "x-gitlab-event",
        ] {
            if let Some(value) = headers.get(*header_name) {
                if let Ok(topic) = value.to_str() {
                    return Some(topic.to_string());
                }
            }
        }

        None
    }
}

/// Helper trait for common webhook signature verification methods
pub trait SignatureVerifier {
    /// Verify HMAC-SHA1 signature (used by Intercom, etc.)
    fn verify_hmac_sha1(secret: &str, body: &[u8], signature: &str) -> Result<(), WebhookError>;

    /// Verify HMAC-SHA256 signature (used by Stripe, GitHub, etc.)
    fn verify_hmac_sha256(secret: &str, body: &[u8], signature: &str) -> Result<(), WebhookError>;
}

/// Default implementation of signature verification
pub struct DefaultSignatureVerifier;

impl SignatureVerifier for DefaultSignatureVerifier {
    fn verify_hmac_sha1(secret: &str, body: &[u8], signature: &str) -> Result<(), WebhookError> {
        use hmac::{Hmac, Mac};
        use sha1::Sha1;

        type HmacSha1 = Hmac<Sha1>;

        let mut mac = HmacSha1::new_from_slice(secret.as_bytes())
            .map_err(|_| WebhookError::InvalidSignature)?;

        mac.update(body);

        // Handle hex-encoded signature (with or without "sha1=" prefix)
        let sig_hex = signature.strip_prefix("sha1=").unwrap_or(signature);
        let expected = hex::decode(sig_hex).map_err(|_| WebhookError::InvalidSignature)?;

        mac.verify_slice(&expected)
            .map_err(|_| WebhookError::InvalidSignature)
    }

    fn verify_hmac_sha256(secret: &str, body: &[u8], signature: &str) -> Result<(), WebhookError> {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        type HmacSha256 = Hmac<Sha256>;

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .map_err(|_| WebhookError::InvalidSignature)?;

        mac.update(body);

        // Handle hex-encoded signature (with or without "sha256=" prefix)
        let sig_hex = signature.strip_prefix("sha256=").unwrap_or(signature);
        let expected = hex::decode(sig_hex).map_err(|_| WebhookError::InvalidSignature)?;

        mac.verify_slice(&expected)
            .map_err(|_| WebhookError::InvalidSignature)
    }
}
