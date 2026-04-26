//! Thin REST wrapper around the WorkOS user-management + organizations
//! APIs, used by the `workos_exchange` route, the SCIM webhook, the
//! invitation send/resend routes, and the bulk importer binary.
//!
//! Why a hand-rolled wrapper instead of the third-party `workos` crate:
//!
//! - As of 2026-04 the `workos` crate (0.8.1) still depends on
//!   `jsonwebtoken` 10 / `thiserror` 2 / `reqwest` 0.13, which are all
//!   one major behind our workspace. We could opt-in to the duplication,
//!   but the surface we actually need is tiny — six endpoints and one
//!   webhook signature check — and rolling our own keeps the dependency
//!   graph small and unambiguous.
//! - The Rust SDK does not (yet) expose `bulk_create_users`, which is the
//!   single hottest call in the importer. We'd have to reach for raw HTTP
//!   anyway.
//! - JWKS verification is a single jsonwebtoken call against a cached
//!   key set, so writing it by hand is straightforward.
//!
//! All public methods return `WorkosError`. Network errors surface as
//! `WorkosError::Http`; any non-2xx response surfaces as
//! `WorkosError::Api { status, body }` so callers can branch on, e.g.,
//! 404 vs 401 vs 500.

use std::env;

use serde::{Deserialize, Serialize};

const WORKOS_API_BASE: &str = "https://api.workos.com";

#[derive(Debug, thiserror::Error)]
pub enum WorkosError {
    #[error("WORKOS_API_KEY not set")]
    MissingApiKey,
    #[error("WORKOS_CLIENT_ID not set")]
    MissingClientId,
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("WorkOS API error ({status}): {body}")]
    Api {
        status: reqwest::StatusCode,
        body: String,
    },
    #[error("invalid WorkOS access token: {0}")]
    InvalidToken(String),
}

/// Configured client for talking to WorkOS. Cheap to clone (`reqwest::Client`
/// is internally `Arc`d).
#[derive(Clone)]
pub struct WorkosClient {
    api_key: String,
    client_id: String,
    base_url: String,
    http: reqwest::Client,
}

impl WorkosClient {
    /// Build a client from explicit values. Useful in tests.
    pub fn new(api_key: impl Into<String>, client_id: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            client_id: client_id.into(),
            base_url: WORKOS_API_BASE.to_string(),
            http: reqwest::Client::new(),
        }
    }

    /// Build a client from `WORKOS_API_KEY` + `WORKOS_CLIENT_ID` env vars.
    /// These are documented in `docs/doppler.md` under the backend config.
    pub fn from_env() -> Result<Self, WorkosError> {
        let api_key = env::var("WORKOS_API_KEY").map_err(|_| WorkosError::MissingApiKey)?;
        let client_id =
            env::var("WORKOS_CLIENT_ID").map_err(|_| WorkosError::MissingClientId)?;
        Ok(Self::new(api_key, client_id))
    }

    /// Override the base URL (mockito tests).
    #[doc(hidden)]
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    pub fn client_id(&self) -> &str {
        &self.client_id
    }

    fn url(&self, path: &str) -> String {
        format!("{}{path}", self.base_url)
    }

    fn auth(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        builder.bearer_auth(&self.api_key)
    }

    async fn parse<T>(resp: reqwest::Response) -> Result<T, WorkosError>
    where
        T: for<'de> Deserialize<'de>,
    {
        let status = resp.status();
        if status.is_success() {
            return resp.json::<T>().await.map_err(WorkosError::Http);
        }
        let body = resp.text().await.unwrap_or_default();
        Err(WorkosError::Api { status, body })
    }

    // ── user management ────────────────────────────────────────────

    /// `GET /user_management/users/{id}`. Used by the importer and also
    /// as the fallback path for `verify_access_token` when JWKS isn't
    /// configured locally.
    pub async fn get_user(&self, workos_user_id: &str) -> Result<WorkosUser, WorkosError> {
        let resp = self
            .auth(
                self.http
                    .get(self.url(&format!("/user_management/users/{workos_user_id}"))),
            )
            .send()
            .await?;
        Self::parse(resp).await
    }

    /// Verify a WorkOS access token. For now this calls
    /// `GET /user_management/users/me` with the access token as a
    /// bearer credential — that endpoint returns 200 only if the token
    /// is valid + unexpired. A future iteration should switch to JWKS
    /// verification (the access tokens are RS256 JWTs); see the
    /// "Open questions" section in the Phase 0b report.
    pub async fn verify_access_token(
        &self,
        access_token: &str,
    ) -> Result<WorkosUser, WorkosError> {
        let resp = self
            .http
            .get(self.url("/user_management/users/me"))
            .bearer_auth(access_token)
            .send()
            .await?;
        let status = resp.status();
        if status == reqwest::StatusCode::UNAUTHORIZED
            || status == reqwest::StatusCode::FORBIDDEN
        {
            return Err(WorkosError::InvalidToken(format!(
                "WorkOS rejected access token (status {status})"
            )));
        }
        Self::parse(resp).await
    }

    /// `GET /user_management/organization_memberships?user_id=...`. The
    /// `workos_exchange` route uses this to derive role at JIT-create
    /// time when the WorkOS callback didn't include `organizationId`.
    pub async fn list_organization_memberships(
        &self,
        workos_user_id: &str,
    ) -> Result<Vec<OrganizationMembership>, WorkosError> {
        #[derive(Deserialize)]
        struct ListResp {
            data: Vec<OrganizationMembership>,
        }
        let resp = self
            .auth(
                self.http
                    .get(self.url("/user_management/organization_memberships"))
                    .query(&[("user_id", workos_user_id)]),
            )
            .send()
            .await?;
        let parsed: ListResp = Self::parse(resp).await?;
        Ok(parsed.data)
    }

    pub async fn create_user(
        &self,
        params: &CreateUserParams,
    ) -> Result<WorkosUser, WorkosError> {
        let resp = self
            .auth(
                self.http
                    .post(self.url("/user_management/users"))
                    .json(params),
            )
            .send()
            .await?;
        Self::parse(resp).await
    }

    pub async fn bulk_create_users(
        &self,
        users: &[BulkCreateUserParams],
    ) -> Result<BulkCreateResult, WorkosError> {
        #[derive(Serialize)]
        struct Body<'a> {
            users: &'a [BulkCreateUserParams],
        }
        let resp = self
            .auth(
                self.http
                    .post(self.url("/user_management/users/bulk"))
                    .json(&Body { users }),
            )
            .send()
            .await?;
        Self::parse(resp).await
    }

    pub async fn send_invitation(
        &self,
        params: &SendInvitationParams,
    ) -> Result<Invitation, WorkosError> {
        let resp = self
            .auth(
                self.http
                    .post(self.url("/user_management/invitations"))
                    .json(params),
            )
            .send()
            .await?;
        Self::parse(resp).await
    }

    /// Re-issue an existing invitation. WorkOS spells this as a `revoke`
    /// followed by a fresh `sendInvitation`; we expose it as a single op
    /// for callers.
    pub async fn resend_invitation(
        &self,
        invitation_id: &str,
        params: &SendInvitationParams,
    ) -> Result<Invitation, WorkosError> {
        let resp = self
            .auth(
                self.http.post(self.url(&format!(
                    "/user_management/invitations/{invitation_id}/revoke"
                ))),
            )
            .send()
            .await?;
        if !resp.status().is_success() && resp.status() != reqwest::StatusCode::NOT_FOUND {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(WorkosError::Api { status, body });
        }
        self.send_invitation(params).await
    }

    /// `GET /user_management/invitations?email=...` — used by
    /// `/api/auth/discover` to surface pending invites as a "you have
    /// an invite" hint on the sign-up form (A.1p sub-state).
    pub async fn list_invitations_by_email(
        &self,
        email: &str,
    ) -> Result<Vec<Invitation>, WorkosError> {
        #[derive(Deserialize)]
        struct ListResp {
            data: Vec<Invitation>,
        }
        let resp = self
            .auth(
                self.http
                    .get(self.url("/user_management/invitations"))
                    .query(&[("email", email)]),
            )
            .send()
            .await?;
        let parsed: ListResp = Self::parse(resp).await?;
        Ok(parsed.data)
    }

    // ── organizations ───────────────────────────────────────────────

    pub async fn create_organization(
        &self,
        params: &CreateOrganizationParams,
    ) -> Result<Organization, WorkosError> {
        let resp = self
            .auth(self.http.post(self.url("/organizations")).json(params))
            .send()
            .await?;
        Self::parse(resp).await
    }

    /// `GET /organizations?domains=...` — used by `/api/auth/discover`
    /// to learn whether a typed email's domain already maps to a
    /// WorkOS organization. We surface this via the `existing` /
    /// `sso_required` discriminator on the discover response.
    pub async fn find_organization_by_domain(
        &self,
        domain: &str,
    ) -> Result<Option<Organization>, WorkosError> {
        #[derive(Deserialize)]
        struct ListResp {
            data: Vec<Organization>,
        }
        let resp = self
            .auth(
                self.http
                    .get(self.url("/organizations"))
                    .query(&[("domains", domain)]),
            )
            .send()
            .await?;
        let parsed: ListResp = Self::parse(resp).await?;
        Ok(parsed.data.into_iter().next())
    }
}

// ── DTOs ───────────────────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct WorkosUser {
    pub id: String,
    pub email: String,
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
    #[serde(default)]
    pub profile_picture_url: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct OrganizationMembership {
    pub id: String,
    pub user_id: String,
    pub organization_id: String,
    /// Role identifier (e.g. "admin", "member"). When the org doesn't
    /// have custom roles this is one of WorkOS's reserved slugs.
    #[serde(default)]
    pub role: Option<MembershipRole>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MembershipRole {
    pub slug: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct Organization {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub domains: Vec<OrganizationDomain>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct OrganizationDomain {
    pub id: String,
    pub domain: String,
    #[serde(default)]
    pub state: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct Invitation {
    pub id: String,
    pub email: String,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CreateUserParams {
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    pub email_verified: bool,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct BulkCreateUserParams {
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    /// Existing bcrypt hash; WorkOS accepts these verbatim during the
    /// importer flow alongside `password_hash_type`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_hash_type: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub organization_memberships: Vec<BulkOrganizationMembership>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct BulkOrganizationMembership {
    pub organization_id: String,
    pub role_slug: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BulkCreateResult {
    #[serde(default)]
    pub users: Vec<WorkosUser>,
    #[serde(default)]
    pub errors: Vec<serde_json::Value>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct SendInvitationParams {
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role_slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in_days: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inviter_user_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CreateOrganizationParams {
    pub name: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub domains: Vec<String>,
}

// ── webhook signature verification ─────────────────────────────────

/// Verify the `WorkOS-Signature` header on an incoming webhook (e.g.
/// `directory.user.created`). The header looks like
/// `t=<unix_ms>, v1=<hex_hmac_sha256>`. The signed payload is
/// `<unix_ms>.<raw_body>`.
///
/// Returns `Ok(())` on a valid signature, otherwise a descriptive
/// error. `tolerance_seconds` is the maximum allowed clock skew —
/// WorkOS recommends 5 minutes (300s).
///
/// Reference: <https://workos.com/docs/events/webhooks>.
pub fn verify_webhook_signature(
    raw_body: &[u8],
    signature_header: &str,
    secret: &str,
    tolerance_seconds: i64,
    now_unix_seconds: i64,
) -> Result<(), WebhookSignatureError> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let mut timestamp_ms: Option<i64> = None;
    let mut hmac_hex: Option<&str> = None;
    for part in signature_header.split(',') {
        let part = part.trim();
        if let Some(ts) = part.strip_prefix("t=") {
            timestamp_ms = ts.parse::<i64>().ok();
        } else if let Some(v) = part.strip_prefix("v1=") {
            hmac_hex = Some(v);
        }
    }
    let timestamp_ms = timestamp_ms.ok_or(WebhookSignatureError::MissingTimestamp)?;
    let hmac_hex = hmac_hex.ok_or(WebhookSignatureError::MissingSignature)?;

    let timestamp_seconds = timestamp_ms / 1000;
    if (now_unix_seconds - timestamp_seconds).abs() > tolerance_seconds {
        return Err(WebhookSignatureError::TimestampOutsideTolerance);
    }

    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|_| WebhookSignatureError::InvalidSecret)?;
    mac.update(timestamp_ms.to_string().as_bytes());
    mac.update(b".");
    mac.update(raw_body);
    let expected = mac.finalize().into_bytes();
    let provided =
        hex::decode(hmac_hex).map_err(|_| WebhookSignatureError::InvalidSignatureEncoding)?;
    if expected.as_slice() != provided.as_slice() {
        return Err(WebhookSignatureError::SignatureMismatch);
    }
    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum WebhookSignatureError {
    #[error("missing timestamp (`t=`) in signature header")]
    MissingTimestamp,
    #[error("missing signature (`v1=`) in signature header")]
    MissingSignature,
    #[error("timestamp outside allowed tolerance window")]
    TimestampOutsideTolerance,
    #[error("invalid webhook secret")]
    InvalidSecret,
    #[error("signature value is not valid hex")]
    InvalidSignatureEncoding,
    #[error("signature mismatch")]
    SignatureMismatch,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sign(secret: &str, ts_ms: i64, body: &[u8]) -> String {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(ts_ms.to_string().as_bytes());
        mac.update(b".");
        mac.update(body);
        hex::encode(mac.finalize().into_bytes())
    }

    #[test]
    fn webhook_signature_round_trip() {
        let secret = "whsec_demo";
        let body = br#"{"event":"directory.user.created"}"#;
        let now_ms = 1_700_000_000_000_i64;
        let sig = sign(secret, now_ms, body);
        let header = format!("t={now_ms}, v1={sig}");

        verify_webhook_signature(body, &header, secret, 300, now_ms / 1000)
            .expect("valid signature");
    }

    #[test]
    fn webhook_signature_rejects_tampered_body() {
        let secret = "whsec_demo";
        let body = br#"{"event":"directory.user.created"}"#;
        let now_ms = 1_700_000_000_000_i64;
        let sig = sign(secret, now_ms, body);
        let header = format!("t={now_ms}, v1={sig}");
        let tampered = br#"{"event":"directory.user.deleted"}"#;
        let err =
            verify_webhook_signature(tampered, &header, secret, 300, now_ms / 1000).unwrap_err();
        assert!(matches!(err, WebhookSignatureError::SignatureMismatch));
    }

    #[test]
    fn webhook_signature_rejects_old_timestamp() {
        let secret = "whsec_demo";
        let body = br#"{}"#;
        let signed_ms = 1_700_000_000_000_i64;
        let sig = sign(secret, signed_ms, body);
        let header = format!("t={signed_ms}, v1={sig}");
        let now_seconds = (signed_ms / 1000) + 1_000; // 1000s skew, 300s tolerance
        let err = verify_webhook_signature(body, &header, secret, 300, now_seconds).unwrap_err();
        assert!(matches!(
            err,
            WebhookSignatureError::TimestampOutsideTolerance
        ));
    }

    #[test]
    fn webhook_signature_rejects_missing_timestamp() {
        let err =
            verify_webhook_signature(b"{}", "v1=deadbeef", "whsec_demo", 300, 0).unwrap_err();
        assert!(matches!(err, WebhookSignatureError::MissingTimestamp));
    }

    #[test]
    fn webhook_signature_rejects_missing_signature() {
        let err = verify_webhook_signature(b"{}", "t=1", "whsec_demo", 300, 0).unwrap_err();
        assert!(matches!(err, WebhookSignatureError::MissingSignature));
    }
}
