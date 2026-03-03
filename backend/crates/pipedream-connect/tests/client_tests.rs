use pipedream_connect::{
    types::{CreateTokenRequest, DeployTriggerRequest, UpdateDeploymentRequest},
    Environment, PipedreamClient,
};
use wiremock::matchers::{header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

async fn setup() -> (MockServer, PipedreamClient) {
    let server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "access_token": "test_token_123",
            "expires_in": 3600,
            "token_type": "Bearer"
        })))
        .mount(&server)
        .await;

    let client = PipedreamClient::new(
        "client_id",
        "client_secret",
        "proj_test",
        Environment::Development,
    )
    .with_base_url(server.uri());

    (server, client)
}

#[tokio::test]
async fn test_list_apps() {
    let (server, client) = setup().await;

    Mock::given(method("GET"))
        .and(path("/connect/apps"))
        .and(header("Authorization", "Bearer test_token_123"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": [
                { "name_slug": "slack", "name": "Slack", "auth_type": "oauth", "categories": ["communication"] },
                { "name_slug": "intercom", "name": "Intercom", "auth_type": "oauth", "categories": ["crm"] }
            ],
            "page_info": { "count": 2, "total_count": 200 }
        })))
        .mount(&server)
        .await;

    let result = client.list_apps(None::<&str>, None).await.unwrap();
    assert_eq!(result.data.len(), 2);
    assert_eq!(result.data[0].name, "Slack");
    assert_eq!(result.data[1].name_slug, "intercom");
}

#[tokio::test]
async fn test_list_apps_with_query() {
    let (server, client) = setup().await;

    Mock::given(method("GET"))
        .and(path("/connect/apps"))
        .and(query_param("q", "slack"))
        .and(query_param("limit", "10"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": [{ "name_slug": "slack", "name": "Slack", "auth_type": "oauth", "categories": [] }],
            "page_info": { "count": 1, "total_count": 1 }
        })))
        .mount(&server)
        .await;

    let result = client.list_apps(Some("slack"), Some(10)).await.unwrap();
    assert_eq!(result.data.len(), 1);
    assert_eq!(result.data[0].name, "Slack");
}

#[tokio::test]
async fn test_create_token() {
    let (server, client) = setup().await;

    Mock::given(method("POST"))
        .and(path("/connect/proj_test/tokens"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "token": "ctok_abc123",
            "connect_link_url": "https://pipedream.com/connect/abc",
            "expires_at": "2026-03-01T00:00:00Z"
        })))
        .mount(&server)
        .await;

    let token = client
        .create_token(CreateTokenRequest {
            external_user_id: "user_123".to_string(),
            app_id: Some("app_intercom".to_string()),
            webhook_uri: None,
            success_redirect_uri: None,
            error_redirect_uri: None,
        })
        .await
        .unwrap();

    assert_eq!(token.token, "ctok_abc123");
}

#[tokio::test]
async fn test_list_triggers() {
    let (server, client) = setup().await;

    Mock::given(method("GET"))
        .and(path("/connect/proj_test/triggers"))
        .and(header("x-pd-environment", "development"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": [{
                "key": "slack-new-message",
                "name": "New Message in Channel",
                "description": "Fires when a new message is posted",
                "configurable_props": []
            }],
            "page_info": { "count": 1, "total_count": 50 }
        })))
        .mount(&server)
        .await;

    let result = client.list_triggers(None, None, None).await.unwrap();
    assert_eq!(result.data.len(), 1);
    assert_eq!(result.data[0].key, "slack-new-message");
}

#[tokio::test]
async fn test_deploy_trigger() {
    let (server, client) = setup().await;

    Mock::given(method("POST"))
        .and(path("/connect/proj_test/triggers/deploy"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": {
                "id": "dc_abc123",
                "component_key": "slack-new-message",
                "active": true,
                "configured_props": { "channel": "#general" },
                "name": "Slack New Message"
            }
        })))
        .mount(&server)
        .await;

    let result = client
        .deploy_trigger(DeployTriggerRequest {
            id: "slack-new-message".to_string(),
            external_user_id: "user_123".to_string(),
            configured_props: Some(serde_json::json!({ "channel": "#general" })),
            webhook_url: Some("https://example.com/webhook".to_string()),
            workflow_id: None,
        })
        .await
        .unwrap();

    assert_eq!(result.data.id, "dc_abc123");
    assert_eq!(result.data.active, Some(true));
}

#[tokio::test]
async fn test_list_deployments() {
    let (server, client) = setup().await;

    Mock::given(method("GET"))
        .and(path("/connect/proj_test/deployed-triggers"))
        .and(query_param("external_user_id", "user_123"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": [{
                "id": "dc_abc123",
                "active": true,
                "name": "Slack Trigger"
            }]
        })))
        .mount(&server)
        .await;

    let result = client.list_deployments("user_123").await.unwrap();
    assert_eq!(result.data.len(), 1);
    assert_eq!(result.data[0].id, "dc_abc123");
}

#[tokio::test]
async fn test_update_deployment() {
    let (server, client) = setup().await;

    Mock::given(method("PATCH"))
        .and(path("/connect/proj_test/deployed-triggers/dc_abc123"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": { "id": "dc_abc123", "active": false }
        })))
        .mount(&server)
        .await;

    let result = client
        .update_deployment(
            "dc_abc123",
            UpdateDeploymentRequest {
                active: Some(false),
                configured_props: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(result.data.active, Some(false));
}

#[tokio::test]
async fn test_delete_deployment() {
    let (server, client) = setup().await;

    Mock::given(method("DELETE"))
        .and(path("/connect/proj_test/deployed-triggers/dc_abc123"))
        .respond_with(ResponseTemplate::new(204))
        .mount(&server)
        .await;

    client.delete_deployment("dc_abc123").await.unwrap();
}

#[tokio::test]
async fn test_list_accounts() {
    let (server, client) = setup().await;

    Mock::given(method("GET"))
        .and(path("/connect/proj_test/accounts"))
        .and(query_param("external_user_id", "user_123"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": [{
                "id": "apn_abc123",
                "name": "My Slack",
                "healthy": true,
                "dead": false,
                "app": { "name_slug": "slack", "name": "Slack", "auth_type": "oauth", "categories": [] }
            }]
        })))
        .mount(&server)
        .await;

    let result = client.list_accounts("user_123", None).await.unwrap();
    assert_eq!(result.data.len(), 1);
    assert_eq!(result.data[0].id, "apn_abc123");
    assert!(result.data[0].healthy.unwrap());
}

#[tokio::test]
async fn test_unauthorized() {
    let server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(401).set_body_json(serde_json::json!({
            "error": "invalid_client"
        })))
        .mount(&server)
        .await;

    let client = PipedreamClient::new(
        "bad_id",
        "bad_secret",
        "proj_test",
        Environment::Development,
    )
    .with_base_url(server.uri());

    let result = client.list_apps(None::<&str>, None).await;
    assert!(matches!(
        result,
        Err(pipedream_connect::PipedreamError::Unauthorized)
    ));
}

#[tokio::test]
async fn test_rate_limited() {
    let (server, client) = setup().await;

    Mock::given(method("GET"))
        .and(path("/connect/apps"))
        .respond_with(ResponseTemplate::new(429).insert_header("retry-after", "30"))
        .mount(&server)
        .await;

    let result = client.list_apps(None::<&str>, None).await;
    match result {
        Err(pipedream_connect::PipedreamError::RateLimited { retry_after }) => {
            assert_eq!(retry_after, Some(30));
        }
        other => panic!("expected RateLimited, got: {other:?}"),
    }
}

#[tokio::test]
async fn test_token_caching() {
    let server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "access_token": "cached_token",
            "expires_in": 3600
        })))
        .expect(1) // Should only be called once despite two API calls
        .mount(&server)
        .await;

    Mock::given(method("GET"))
        .and(path("/connect/apps"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": [], "page_info": { "count": 0, "total_count": 0 }
        })))
        .mount(&server)
        .await;

    let client = PipedreamClient::new("id", "secret", "proj", Environment::Development)
        .with_base_url(server.uri());

    client.list_apps(None::<&str>, None).await.unwrap();
    client.list_apps(None::<&str>, None).await.unwrap();
}
