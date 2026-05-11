//! OAuth Provider
//!
//! Trait for sources that use OAuth for authentication.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::context::IngestContext;
use crate::error::OAuthError;

/// OAuth token response
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OAuthTokens {
    /// Access token for API requests
    pub access_token: String,
    /// Refresh token for getting new access tokens
    pub refresh_token: Option<String>,
    /// Token type (usually "Bearer")
    pub token_type: String,
    /// Expiration time
    pub expires_at: Option<DateTime<Utc>>,
    /// Granted scopes
    pub scopes: Vec<String>,
}

impl OAuthTokens {
    /// Check if the access token is expired
    pub fn is_expired(&self) -> bool {
        match self.expires_at {
            Some(expires) => Utc::now() >= expires,
            None => false,
        }
    }

    /// Check if token will expire within the given duration
    pub fn expires_within(&self, duration: chrono::Duration) -> bool {
        match self.expires_at {
            Some(expires) => Utc::now() + duration >= expires,
            None => false,
        }
    }
}

/// OAuth authorization URL parameters
#[derive(Clone, Debug)]
pub struct AuthorizationParams {
    /// Authorization URL to redirect user to
    pub url: String,
    /// State parameter for CSRF protection
    pub state: String,
    /// Code verifier for PKCE (if supported)
    pub code_verifier: Option<String>,
}

/// Trait for OAuth-enabled sources
///
/// Implement this trait for sources that require OAuth authentication.
#[async_trait]
pub trait OAuthProvider: Send + Sync {
    /// Get the OAuth authorization URL
    ///
    /// Returns the URL to redirect the user to for authorization.
    fn authorization_url(&self, context: &IngestContext)
        -> Result<AuthorizationParams, OAuthError>;

    /// Exchange authorization code for tokens
    ///
    /// Called after user completes OAuth flow and is redirected back.
    async fn exchange_code(
        &self,
        code: &str,
        state: &str,
        code_verifier: Option<&str>,
        context: &IngestContext,
    ) -> Result<OAuthTokens, OAuthError>;

    /// Refresh an expired access token
    async fn refresh_token(
        &self,
        refresh_token: &str,
        context: &IngestContext,
    ) -> Result<OAuthTokens, OAuthError>;

    /// Revoke tokens (disconnect integration)
    async fn revoke_token(&self, token: &str, context: &IngestContext) -> Result<(), OAuthError>;

    /// Get required OAuth scopes for this source
    fn required_scopes(&self) -> &[&str];

    /// Check if PKCE is supported/required
    fn supports_pkce(&self) -> bool {
        false
    }
}
