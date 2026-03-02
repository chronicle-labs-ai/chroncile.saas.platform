use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

use crate::error::AuthError;
use crate::types::{AuthUser, Claims};

const TOKEN_EXPIRY_HOURS: i64 = 24;

pub struct JwtService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl JwtService {
    pub fn new(secret: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
        }
    }

    pub fn issue(&self, user: &AuthUser) -> Result<String, AuthError> {
        let now = Utc::now();
        let claims = Claims {
            sub: user.id.clone(),
            email: user.email.clone(),
            name: user.name.clone(),
            role: user.role.clone(),
            tenant_id: user.tenant_id.clone(),
            tenant_name: user.tenant_name.clone(),
            tenant_slug: user.tenant_slug.clone(),
            iat: now.timestamp(),
            exp: (now + Duration::hours(TOKEN_EXPIRY_HOURS)).timestamp(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| AuthError::Internal(format!("JWT encoding failed: {e}")))
    }

    pub fn validate(&self, token: &str) -> Result<AuthUser, AuthError> {
        let token_data = decode::<Claims>(token, &self.decoding_key, &Validation::default())
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
                _ => AuthError::InvalidToken(e.to_string()),
            })?;

        let claims = token_data.claims;
        Ok(AuthUser {
            id: claims.sub,
            email: claims.email,
            name: claims.name,
            role: claims.role,
            tenant_id: claims.tenant_id,
            tenant_name: claims.tenant_name,
            tenant_slug: claims.tenant_slug,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_user() -> AuthUser {
        AuthUser {
            id: "user_123".to_string(),
            email: "test@example.com".to_string(),
            name: Some("Test User".to_string()),
            role: "owner".to_string(),
            tenant_id: "tenant_456".to_string(),
            tenant_name: "Test Org".to_string(),
            tenant_slug: "test-org".to_string(),
        }
    }

    #[test]
    fn test_jwt_roundtrip() {
        let service = JwtService::new("test-secret-key-at-least-32-chars!");
        let user = test_user();

        let token = service.issue(&user).unwrap();
        let decoded = service.validate(&token).unwrap();

        assert_eq!(decoded.id, user.id);
        assert_eq!(decoded.email, user.email);
        assert_eq!(decoded.name, user.name);
        assert_eq!(decoded.tenant_id, user.tenant_id);
        assert_eq!(decoded.tenant_name, user.tenant_name);
        assert_eq!(decoded.tenant_slug, user.tenant_slug);
    }

    #[test]
    fn test_jwt_expired() {
        let service = JwtService::new("test-secret-key-at-least-32-chars!");
        let user = test_user();

        let now = Utc::now();
        let claims = Claims {
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenant_id: user.tenant_id,
            tenant_name: user.tenant_name,
            tenant_slug: user.tenant_slug,
            iat: (now - Duration::hours(48)).timestamp(),
            exp: (now - Duration::hours(24)).timestamp(),
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(b"test-secret-key-at-least-32-chars!"),
        )
        .unwrap();

        let result = service.validate(&token);
        assert!(matches!(result, Err(AuthError::TokenExpired)));
    }

    #[test]
    fn test_jwt_invalid_signature() {
        let service1 = JwtService::new("secret-key-one-at-least-32-chars!!");
        let service2 = JwtService::new("secret-key-two-at-least-32-chars!!");
        let user = test_user();

        let token = service1.issue(&user).unwrap();
        let result = service2.validate(&token);
        assert!(matches!(result, Err(AuthError::InvalidToken(_))));
    }
}
