//! Cross-platform HTTP Request Helpers
//!
//! Unified HTTP methods that abstract over reqwest (native) and gloo-net (wasm).

use serde::de::DeserializeOwned;

/// HTTP client for making requests
pub struct HttpClient {
    base_url: String,
    #[cfg(not(target_arch = "wasm32"))]
    inner: reqwest::Client,
}

impl HttpClient {
    /// Create a new HTTP client
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            #[cfg(not(target_arch = "wasm32"))]
            inner: reqwest::Client::new(),
        }
    }

    /// Get the base URL
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Build a full URL from a path
    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    // ========== Native HTTP methods ==========

    /// GET request returning JSON
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        self.inner
            .get(self.url(path))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// GET request with query parameters returning JSON
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn get_with_params<T: DeserializeOwned>(
        &self,
        path: &str,
        params: &[(String, String)],
    ) -> Result<T, String> {
        let url = if params.is_empty() {
            self.url(path)
        } else {
            let query_string = params
                .iter()
                .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&");
            format!("{}?{}", self.url(path), query_string)
        };

        self.inner
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// POST request with JSON body returning JSON
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn post<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &serde_json::Value,
    ) -> Result<T, String> {
        self.inner
            .post(self.url(path))
            .json(body)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// POST request without body returning JSON
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn post_empty<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        self.inner
            .post(self.url(path))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// DELETE request
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn delete(&self, path: &str) -> Result<(), String> {
        self.inner
            .delete(self.url(path))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ========== Web HTTP methods ==========

    /// GET request returning JSON
    #[cfg(target_arch = "wasm32")]
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        use gloo_net::http::Request;

        Request::get(&self.url(path))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// GET request with query parameters returning JSON
    #[cfg(target_arch = "wasm32")]
    pub async fn get_with_params<T: DeserializeOwned>(
        &self,
        path: &str,
        params: &[(String, String)],
    ) -> Result<T, String> {
        use gloo_net::http::Request;

        let url = if params.is_empty() {
            self.url(path)
        } else {
            let query_string = params
                .iter()
                .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&");
            format!("{}?{}", self.url(path), query_string)
        };

        Request::get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// POST request with JSON body returning JSON
    #[cfg(target_arch = "wasm32")]
    pub async fn post<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &serde_json::Value,
    ) -> Result<T, String> {
        use gloo_net::http::Request;

        Request::post(&self.url(path))
            .json(body)
            .map_err(|e| e.to_string())?
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// POST request without body returning JSON
    #[cfg(target_arch = "wasm32")]
    pub async fn post_empty<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        use gloo_net::http::Request;

        Request::post(&self.url(path))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    /// DELETE request
    #[cfg(target_arch = "wasm32")]
    pub async fn delete(&self, path: &str) -> Result<(), String> {
        use gloo_net::http::Request;

        Request::delete(&self.url(path))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

