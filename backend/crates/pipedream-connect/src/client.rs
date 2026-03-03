use reqwest::Client;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::error::{PipedreamError, Result};
use crate::types::*;

const BASE_URL: &str = "https://api.pipedream.com/v1";
const TOKEN_REFRESH_BUFFER_SECS: i64 = 300;

struct CachedToken {
    access_token: String,
    expires_at: chrono::DateTime<chrono::Utc>,
}

pub struct PipedreamClient {
    http: Client,
    client_id: String,
    client_secret: String,
    project_id: String,
    environment: Environment,
    base_url: String,
    token: Arc<RwLock<Option<CachedToken>>>,
}

impl PipedreamClient {
    pub fn new(
        client_id: impl Into<String>,
        client_secret: impl Into<String>,
        project_id: impl Into<String>,
        environment: Environment,
    ) -> Self {
        Self {
            http: Client::new(),
            client_id: client_id.into(),
            client_secret: client_secret.into(),
            project_id: project_id.into(),
            environment,
            base_url: BASE_URL.to_string(),
            token: Arc::new(RwLock::new(None)),
        }
    }

    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self
    }

    async fn get_token(&self) -> Result<String> {
        {
            let cached = self.token.read().await;
            if let Some(ref t) = *cached {
                if t.expires_at > chrono::Utc::now() {
                    return Ok(t.access_token.clone());
                }
            }
        }

        let mut cached = self.token.write().await;
        if let Some(ref t) = *cached {
            if t.expires_at > chrono::Utc::now() {
                return Ok(t.access_token.clone());
            }
        }

        let resp = self
            .http
            .post(format!("{}/oauth/token", self.base_url))
            .form(&[
                ("grant_type", "client_credentials"),
                ("client_id", &self.client_id),
                ("client_secret", &self.client_secret),
            ])
            .send()
            .await?;

        if resp.status() == 401 {
            return Err(PipedreamError::Unauthorized);
        }

        let token_resp: OAuthTokenResponse = Self::parse_response(resp).await?;
        let expires_in = token_resp.expires_in.unwrap_or(3600);
        let expires_at =
            chrono::Utc::now() + chrono::Duration::seconds(expires_in - TOKEN_REFRESH_BUFFER_SECS);

        let access_token = token_resp.access_token.clone();
        *cached = Some(CachedToken {
            access_token: token_resp.access_token,
            expires_at,
        });

        Ok(access_token)
    }

    async fn request(&self, mut builder: reqwest::RequestBuilder) -> Result<reqwest::Response> {
        let token = self.get_token().await?;
        builder = builder
            .header("Authorization", format!("Bearer {token}"))
            .header("x-pd-environment", self.environment.as_str());

        let resp = builder.send().await?;

        match resp.status().as_u16() {
            401 => Err(PipedreamError::Unauthorized),
            404 => Err(PipedreamError::NotFound),
            429 => {
                let retry_after = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse().ok());
                Err(PipedreamError::RateLimited { retry_after })
            }
            s if s >= 400 => {
                let message = resp.text().await.unwrap_or_default();
                Err(PipedreamError::ApiError {
                    status: s,
                    message,
                })
            }
            _ => Ok(resp),
        }
    }

    async fn parse_response<T: serde::de::DeserializeOwned>(
        resp: reqwest::Response,
    ) -> Result<T> {
        let text = resp.text().await.map_err(PipedreamError::Network)?;
        serde_json::from_str(&text)
            .map_err(|e| PipedreamError::Deserialize(format!("{e}: {text}")))
    }

    fn project_url(&self, path: &str) -> String {
        format!("{}/connect/{}{}", self.base_url, self.project_id, path)
    }

    // === Apps ===

    pub async fn list_apps(
        &self,
        query: Option<&str>,
        limit: Option<u64>,
    ) -> Result<AppsResponse> {
        let mut url = format!("{}/connect/apps", self.base_url);
        let mut params = Vec::new();
        if let Some(q) = query {
            params.push(format!("q={}", urlencoding::encode(q)));
        }
        if let Some(l) = limit {
            params.push(format!("limit={l}"));
        }
        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        let resp = self.request(self.http.get(&url)).await?;
        Self::parse_response(resp).await
    }

    // === Connect Tokens ===

    pub async fn create_token(&self, req: CreateTokenRequest) -> Result<ConnectToken> {
        let url = self.project_url("/tokens");
        let resp = self.request(self.http.post(&url).json(&req)).await?;
        Self::parse_response(resp).await
    }

    // === Triggers ===

    pub async fn list_triggers(
        &self,
        app: Option<&str>,
        query: Option<&str>,
        limit: Option<u64>,
    ) -> Result<TriggersResponse> {
        let mut url = self.project_url("/triggers");
        let mut params = Vec::new();
        if let Some(a) = app {
            params.push(format!("app={}", urlencoding::encode(a)));
        }
        if let Some(q) = query {
            params.push(format!("q={}", urlencoding::encode(q)));
        }
        if let Some(l) = limit {
            params.push(format!("limit={l}"));
        }
        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        let resp = self.request(self.http.get(&url)).await?;
        Self::parse_response(resp).await
    }

    pub async fn get_trigger(&self, trigger_id: &str) -> Result<TriggerResponse> {
        let url = self.project_url(&format!("/triggers/{trigger_id}"));
        let resp = self.request(self.http.get(&url)).await?;
        Self::parse_response(resp).await
    }

    pub async fn configure_prop(
        &self,
        trigger_id: &str,
        prop_name: &str,
        external_user_id: &str,
        configured_props: Option<serde_json::Value>,
        query: Option<&str>,
    ) -> Result<PropOptionsResponse> {
        let url = self.project_url(&format!("/triggers/{trigger_id}/props/{prop_name}"));
        let mut body = serde_json::json!({ "external_user_id": external_user_id });
        if let Some(props) = configured_props {
            body["configured_props"] = props;
        }
        if let Some(q) = query {
            body["query"] = serde_json::Value::String(q.to_string());
        }
        let resp = self.request(self.http.post(&url).json(&body)).await?;
        Self::parse_response(resp).await
    }

    pub async fn deploy_trigger(&self, req: DeployTriggerRequest) -> Result<DeployedTriggerResponse> {
        let url = self.project_url("/triggers/deploy");
        let resp = self.request(self.http.post(&url).json(&req)).await?;
        Self::parse_response(resp).await
    }

    // === Deployed Triggers ===

    pub async fn list_deployments(
        &self,
        external_user_id: &str,
    ) -> Result<DeployedTriggersResponse> {
        let url = self.project_url(&format!(
            "/deployed-triggers?external_user_id={}",
            urlencoding::encode(external_user_id)
        ));
        let resp = self.request(self.http.get(&url)).await?;
        Self::parse_response(resp).await
    }

    pub async fn get_deployment(&self, deployment_id: &str) -> Result<DeployedTriggerResponse> {
        let url = self.project_url(&format!("/deployed-triggers/{deployment_id}"));
        let resp = self.request(self.http.get(&url)).await?;
        Self::parse_response(resp).await
    }

    pub async fn update_deployment(
        &self,
        deployment_id: &str,
        req: UpdateDeploymentRequest,
    ) -> Result<DeployedTriggerResponse> {
        let url = self.project_url(&format!("/deployed-triggers/{deployment_id}"));
        let resp = self.request(self.http.patch(&url).json(&req)).await?;
        Self::parse_response(resp).await
    }

    pub async fn delete_deployment(&self, deployment_id: &str) -> Result<()> {
        let url = self.project_url(&format!("/deployed-triggers/{deployment_id}"));
        self.request(self.http.delete(&url)).await?;
        Ok(())
    }

    // === Accounts ===

    pub async fn list_accounts(
        &self,
        external_user_id: &str,
        app: Option<&str>,
    ) -> Result<AccountsResponse> {
        let mut url = self.project_url(&format!(
            "/accounts?external_user_id={}",
            urlencoding::encode(external_user_id)
        ));
        if let Some(a) = app {
            url.push_str(&format!("&app={}", urlencoding::encode(a)));
        }
        let resp = self.request(self.http.get(&url)).await?;
        Self::parse_response(resp).await
    }

    pub async fn get_account(&self, account_id: &str) -> Result<AccountResponse> {
        let url = self.project_url(&format!("/accounts/{account_id}"));
        let resp = self.request(self.http.get(&url)).await?;
        Self::parse_response(resp).await
    }

    pub async fn delete_account(&self, account_id: &str) -> Result<()> {
        let url = self.project_url(&format!("/accounts/{account_id}"));
        self.request(self.http.delete(&url)).await?;
        Ok(())
    }
}
