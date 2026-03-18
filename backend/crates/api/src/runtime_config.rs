use std::collections::HashMap;

#[derive(Clone, Debug, Default)]
pub struct HealthMetadata {
    pub environment: Option<String>,
    pub git_sha: Option<String>,
    pub git_tag: Option<String>,
}

#[derive(Clone, Debug)]
pub struct EventsRuntimeConfig {
    pub default_tenant_id: String,
    pub health: HealthMetadata,
    pub webhook_secrets: HashMap<String, String>,
}

impl Default for EventsRuntimeConfig {
    fn default() -> Self {
        Self {
            default_tenant_id: "demo_tenant".to_string(),
            health: HealthMetadata::default(),
            webhook_secrets: HashMap::new(),
        }
    }
}

impl EventsRuntimeConfig {
    pub fn webhook_secret(&self, source_id: &str) -> Option<&str> {
        self.webhook_secrets
            .get(&source_id.to_lowercase())
            .map(String::as_str)
    }
}

#[derive(Clone, Debug)]
pub struct FeatureAccessRuntimeConfig {
    pub plan_price_ids: HashMap<String, Vec<String>>,
}

impl Default for FeatureAccessRuntimeConfig {
    fn default() -> Self {
        Self {
            plan_price_ids: HashMap::new(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct SaasRuntimeConfig {
    pub app_url: String,
    pub service_secret: Option<String>,
    pub stripe_webhook_secret: Option<String>,
    pub feature_access: FeatureAccessRuntimeConfig,
    pub nango: NangoRuntimeConfig,
}

impl Default for SaasRuntimeConfig {
    fn default() -> Self {
        Self {
            app_url: "https://app.chronicle-labs.com".to_string(),
            service_secret: None,
            stripe_webhook_secret: None,
            feature_access: FeatureAccessRuntimeConfig::default(),
            nango: NangoRuntimeConfig::default(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct NangoRuntimeConfig {
    pub intercom_integration_id: String,
    pub front_integration_id: String,
    pub webhook_secret: Option<String>,
}

impl Default for NangoRuntimeConfig {
    fn default() -> Self {
        Self {
            intercom_integration_id: "intercom".to_string(),
            front_integration_id: "front".to_string(),
            webhook_secret: None,
        }
    }
}
