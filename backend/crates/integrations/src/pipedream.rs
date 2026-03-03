use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PipedreamApp {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipedreamTriggerComponent {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[async_trait]
pub trait PipedreamClient: Send + Sync {
    async fn list_apps(&self) -> anyhow::Result<Vec<PipedreamApp>>;
    async fn list_triggers(&self, app_id: &str) -> anyhow::Result<Vec<PipedreamTriggerComponent>>;
    async fn deploy_trigger(
        &self,
        trigger_id: &str,
        webhook_url: &str,
        props: serde_json::Value,
    ) -> anyhow::Result<String>;
    async fn delete_deployment(&self, deployment_id: &str) -> anyhow::Result<()>;
    async fn exchange_token(
        &self,
        code: &str,
        redirect_uri: &str,
    ) -> anyhow::Result<TokenResponse>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
}

pub struct HttpPipedreamClient {
    client: reqwest::Client,
    base_url: String,
    client_id: String,
    client_secret: String,
    project_id: String,
}

impl HttpPipedreamClient {
    pub fn new(
        client_id: String,
        client_secret: String,
        project_id: String,
    ) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "https://api.pipedream.com/v1".to_string(),
            client_id,
            client_secret,
            project_id,
        }
    }

    #[cfg(test)]
    pub fn with_base_url(mut self, base_url: String) -> Self {
        self.base_url = base_url;
        self
    }
}

#[async_trait]
impl PipedreamClient for HttpPipedreamClient {
    async fn list_apps(&self) -> anyhow::Result<Vec<PipedreamApp>> {
        let resp = self
            .client
            .get(format!("{}/apps", self.base_url))
            .header("Authorization", format!("Bearer {}", self.client_secret))
            .send()
            .await?
            .error_for_status()?;

        let data: serde_json::Value = resp.json().await?;
        let apps: Vec<PipedreamApp> =
            serde_json::from_value(data.get("data").cloned().unwrap_or_default())?;
        Ok(apps)
    }

    async fn list_triggers(&self, _app_id: &str) -> anyhow::Result<Vec<PipedreamTriggerComponent>> {
        Ok(vec![])
    }

    async fn deploy_trigger(
        &self,
        _trigger_id: &str,
        _webhook_url: &str,
        _props: serde_json::Value,
    ) -> anyhow::Result<String> {
        Ok("deployment_placeholder".to_string())
    }

    async fn delete_deployment(&self, _deployment_id: &str) -> anyhow::Result<()> {
        Ok(())
    }

    async fn exchange_token(
        &self,
        code: &str,
        redirect_uri: &str,
    ) -> anyhow::Result<TokenResponse> {
        let resp = self
            .client
            .post(format!("{}/oauth/token", self.base_url))
            .json(&serde_json::json!({
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }))
            .send()
            .await?
            .error_for_status()?;

        let token: TokenResponse = resp.json().await?;
        Ok(token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_list_apps() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/apps"))
            .and(header("Authorization", "Bearer test-secret"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": [
                    { "id": "app_1", "name": "Slack", "description": "Slack integration" },
                    { "id": "app_2", "name": "Intercom", "description": null }
                ]
            })))
            .mount(&mock_server)
            .await;

        let client = HttpPipedreamClient::new(
            "client-id".to_string(),
            "test-secret".to_string(),
            "project-id".to_string(),
        )
        .with_base_url(mock_server.uri());

        let apps = client.list_apps().await.unwrap();
        assert_eq!(apps.len(), 2);
        assert_eq!(apps[0].name, "Slack");
        assert_eq!(apps[1].name, "Intercom");
    }

    #[tokio::test]
    async fn test_exchange_token() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/oauth/token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "at_live_123",
                "refresh_token": "rt_live_456",
                "expires_in": 3600
            })))
            .mount(&mock_server)
            .await;

        let client = HttpPipedreamClient::new(
            "client-id".to_string(),
            "client-secret".to_string(),
            "project-id".to_string(),
        )
        .with_base_url(mock_server.uri());

        let token = client
            .exchange_token("auth-code-123", "https://example.com/callback")
            .await
            .unwrap();

        assert_eq!(token.access_token, "at_live_123");
        assert_eq!(token.refresh_token.unwrap(), "rt_live_456");
    }
}
