//! WorkOS access token verification via JWKS.
//!
//! WorkOS signs every access token with one of its rotating RS256 keys. The
//! public side of those keys is published as a JSON Web Key Set (JWKS) at
//! `https://api.workos.com/sso/jwks/<client_id>`.
//!
//! This module:
//!   1. Fetches that JWKS the first time it's needed.
//!   2. Caches it in memory for [`Self::cache_ttl`] (default 1h) — JWKS only
//!      change when WorkOS rotates a key, which is rare.
//!   3. Validates a Bearer JWT against it: signature (RS256), issuer
//!      (`https://api.workos.com/`), and expiry.
//!
//! Returns the typed [`WorkosClaims`] on success.
//!
//! Per the WorkOS Sessions doc, the access token claims are:
//!   sub          WorkOS user id
//!   sid          session ID (used for sign-out)
//!   iss          https://api.workos.com/  (or your custom auth domain)
//!   org_id       organization selected at sign-in (optional)
//!   role         role of the selected org membership (optional)
//!   permissions  permissions assigned to the role (optional)
//!   exp / iat    standard timestamps
//!
//! Docs: <https://workos.com/docs/authkit/sessions#access-token>

use std::sync::Arc;
use std::time::{Duration, Instant};

use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkosClaims {
    /// WorkOS user id (e.g. `user_01ABC...`).
    pub sub: String,
    /// WorkOS session id, used to terminate the session via the logout API.
    pub sid: String,
    /// Issuer — `https://api.workos.com/` unless a custom auth domain is configured.
    pub iss: String,
    /// Organization selected at sign-in time. Absent for users who haven't
    /// picked / been provisioned into an org yet (the workspace-setup state).
    #[serde(default)]
    pub org_id: Option<String>,
    /// Role of the user's membership in `org_id`, if applicable.
    #[serde(default)]
    pub role: Option<String>,
    /// Permissions assigned to that role.
    #[serde(default)]
    pub permissions: Option<Vec<String>>,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Error)]
pub enum WorkosJwtError {
    #[error("missing `kid` in JWT header")]
    MissingKid,
    #[error("no key in JWKS matched kid `{0}`")]
    UnknownKid(String),
    #[error("JWKS fetch failed: {0}")]
    Fetch(#[from] reqwest::Error),
    #[error("token validation failed: {0}")]
    Validation(#[from] jsonwebtoken::errors::Error),
}

/// Cached snapshot of the WorkOS JWKS.
struct CachedJwks {
    keys: JwkSet,
    fetched_at: Instant,
}

/// Validates WorkOS access tokens. Cheap to clone — the cache and HTTP client
/// live behind `Arc`s.
#[derive(Clone)]
pub struct WorkosJwtVerifier {
    inner: Arc<Inner>,
}

struct Inner {
    client_id: String,
    jwks_url: String,
    issuer: String,
    http: reqwest::Client,
    cache: RwLock<Option<CachedJwks>>,
    cache_ttl: Duration,
}

impl WorkosJwtVerifier {
    /// Build a verifier scoped to a WorkOS client id.
    ///
    /// The JWKS URL is derived from the client id:
    ///   `https://api.workos.com/sso/jwks/<client_id>`
    ///
    /// The expected `iss` claim is also derived:
    ///   `https://api.workos.com/user_management/<client_id>`
    ///
    /// Despite the WorkOS Sessions doc showing `iss: https://api.workos.com/`
    /// in its examples, real-world tokens carry the `/user_management/<client_id>`
    /// suffix. Use [`Self::new_with_issuer`] for envs that have a custom auth
    /// domain.
    pub fn new(client_id: impl Into<String>) -> Self {
        let client_id = client_id.into();
        let issuer = format!("https://api.workos.com/user_management/{client_id}");
        Self::new_with_issuer(client_id, issuer)
    }

    /// Build a verifier with an explicit `iss` claim — used when a custom
    /// auth domain is configured (e.g. `https://auth.chronicle-labs.com/...`).
    pub fn new_with_issuer(
        client_id: impl Into<String>,
        issuer: impl Into<String>,
    ) -> Self {
        let client_id = client_id.into();
        let jwks_url = format!("https://api.workos.com/sso/jwks/{client_id}");
        Self {
            inner: Arc::new(Inner {
                client_id,
                jwks_url,
                issuer: issuer.into(),
                http: reqwest::Client::new(),
                cache: RwLock::new(None),
                cache_ttl: Duration::from_secs(60 * 60),
            }),
        }
    }

    pub fn client_id(&self) -> &str {
        &self.inner.client_id
    }

    /// Fetch JWKS, using the cache if it's still fresh.
    async fn jwks(&self) -> Result<JwkSet, WorkosJwtError> {
        {
            let read = self.inner.cache.read().await;
            if let Some(cached) = read.as_ref() {
                if cached.fetched_at.elapsed() < self.inner.cache_ttl {
                    return Ok(cached.keys.clone());
                }
            }
        }

        let resp = self.inner.http.get(&self.inner.jwks_url).send().await?;
        let keys: JwkSet = resp.error_for_status()?.json().await?;

        let mut write = self.inner.cache.write().await;
        *write = Some(CachedJwks {
            keys: keys.clone(),
            fetched_at: Instant::now(),
        });
        Ok(keys)
    }

    /// Verify a WorkOS access token. Returns typed claims on success.
    ///
    /// On a key-rotation race (token signed by a key we haven't seen yet), the
    /// first call refetches JWKS and retries once.
    pub async fn verify(&self, token: &str) -> Result<WorkosClaims, WorkosJwtError> {
        let header = decode_header(token)?;
        let kid = header.kid.clone().ok_or(WorkosJwtError::MissingKid)?;

        let mut keys = self.jwks().await?;
        let jwk = match keys.find(&kid) {
            Some(jwk) => jwk,
            None => {
                // Bust the cache and refetch — could be a key we haven't seen.
                {
                    let mut write = self.inner.cache.write().await;
                    *write = None;
                }
                keys = self.jwks().await?;
                keys.find(&kid)
                    .ok_or_else(|| WorkosJwtError::UnknownKid(kid.clone()))?
            }
        };

        let decoding_key = DecodingKey::from_jwk(jwk)?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[self.inner.issuer.as_str()]);
        // `exp` is validated by default.

        let token_data = decode::<WorkosClaims>(token, &decoding_key, &validation)?;
        Ok(token_data.claims)
    }
}
