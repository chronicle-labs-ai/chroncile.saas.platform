use async_trait::async_trait;
use axum::{extract::FromRequestParts, http::request::Parts};
use std::sync::Arc;

use crate::error::AuthError;
use crate::jwt::JwtService;
use crate::types::AuthUser;

pub fn extract_bearer_token(parts: &Parts) -> Result<&str, AuthError> {
    let auth_header = parts
        .headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(AuthError::MissingAuth)?;

    auth_header
        .strip_prefix("Bearer ")
        .ok_or(AuthError::InvalidToken(
            "expected 'Bearer <token>' format".to_string(),
        ))
}

/// Extractor for authenticated users. Requires `Arc<JwtService>` to be stored
/// in request extensions (typically added by a middleware layer).
#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let jwt = parts
            .extensions
            .get::<Arc<JwtService>>()
            .ok_or(AuthError::Internal("JwtService not configured".to_string()))?;

        let token = extract_bearer_token(parts)?;
        jwt.validate(token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        middleware as axum_mw,
        response::{IntoResponse, Response},
        routing::get,
        Router,
    };
    async fn protected_handler(user: AuthUser) -> impl IntoResponse {
        format!("hello {}", user.email)
    }

    async fn inject_jwt(mut req: axum::extract::Request, next: axum_mw::Next) -> Response {
        let jwt = Arc::new(JwtService::new("test-secret-key-at-least-32-chars!"));
        req.extensions_mut().insert(jwt);
        next.run(req).await
    }

    fn test_app() -> (Router, Arc<JwtService>) {
        let jwt = Arc::new(JwtService::new("test-secret-key-at-least-32-chars!"));
        let app = Router::new()
            .route("/protected", get(protected_handler))
            .layer(axum_mw::from_fn(inject_jwt));
        (app, jwt)
    }

    async fn send_request(app: Router, req: Request<Body>) -> Response {
        let mut svc = app.into_service();
        tower::Service::call(&mut svc, req).await.unwrap()
    }

    #[tokio::test]
    async fn test_protected_route_without_token() {
        let (app, _jwt) = test_app();

        let req = Request::builder()
            .uri("/protected")
            .body(Body::empty())
            .unwrap();

        let response = send_request(app, req).await;
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_protected_route_with_valid_token() {
        let (app, jwt) = test_app();

        let user = AuthUser {
            id: "user_1".to_string(),
            email: "test@example.com".to_string(),
            name: Some("Test".to_string()),
            tenant_id: "tenant_1".to_string(),
            tenant_name: "Test Org".to_string(),
            tenant_slug: "test-org".to_string(),
        };

        let token = jwt.issue(&user).unwrap();

        let req = Request::builder()
            .uri("/protected")
            .header("authorization", format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap();

        let response = send_request(app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_protected_route_with_invalid_token() {
        let (app, _jwt) = test_app();

        let req = Request::builder()
            .uri("/protected")
            .header("authorization", "Bearer invalid.token.here")
            .body(Body::empty())
            .unwrap();

        let response = send_request(app, req).await;
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}
