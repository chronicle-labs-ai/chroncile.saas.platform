use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;

use chronicle_auth::types::AuthUser;
use chronicle_domain::{
    CreateConnectionInput, DeployTriggerRequest, DeployedTriggersResponse, ListAppsParams,
    ListTriggersParams, PipedreamTokenRequest, PipedreamTrigger,
};
use chronicle_interfaces::RepoError;
use chronicle_pipedream_connect::types::UpdateDeploymentRequest;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

fn get_pipedream(state: &SaasAppState) -> ApiResult<&chronicle_pipedream_connect::PipedreamClient> {
    state
        .pipedream
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Pipedream integration is not configured"))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAccountsResponse {
    synced: usize,
    connections: Vec<chronicle_domain::Connection>,
}

fn connections_page_url(state: &SaasAppState) -> String {
    format!(
        "{}/dashboard/connections",
        state.config.app_url.trim_end_matches('/')
    )
}

fn build_success_redirect_uri(state: &SaasAppState, app_id: Option<&str>) -> String {
    let base = connections_page_url(state);
    match app_id {
        Some(app) if !app.trim().is_empty() => {
            format!("{base}?pipedream_success=true&app={}", app.trim())
        }
        _ => format!("{base}?pipedream_success=true"),
    }
}

fn build_error_redirect_uri(state: &SaasAppState) -> String {
    format!("{}?pipedream_error=true", connections_page_url(state))
}

fn slugify_provider(name: &str) -> Option<String> {
    let mut out = String::with_capacity(name.len());
    let mut previous_dash = false;

    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash && !out.is_empty() {
            out.push('-');
            previous_dash = true;
        }
    }

    let normalized = out.trim_matches('-').to_string();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn resolve_provider_slug(account: &chronicle_pipedream_connect::types::Account) -> Option<String> {
    if let Some(slug) = account
        .app
        .as_ref()
        .and_then(|app| app.name_slug.as_ref())
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())
    {
        return Some(slug);
    }

    account
        .app
        .as_ref()
        .and_then(|app| app.name.as_deref())
        .and_then(slugify_provider)
}

fn connection_status(account: &chronicle_pipedream_connect::types::Account) -> &'static str {
    if account.dead.unwrap_or(false) {
        "error"
    } else if account.healthy.unwrap_or(false) {
        "active"
    } else {
        "inactive"
    }
}

fn build_connection_metadata(
    account: &chronicle_pipedream_connect::types::Account,
    provider: &str,
) -> serde_json::Value {
    let mut metadata = serde_json::Map::new();
    metadata.insert("provider".to_string(), serde_json::json!(provider));
    metadata.insert("account_id".to_string(), serde_json::json!(account.id));
    metadata.insert("healthy".to_string(), serde_json::json!(account.healthy));
    metadata.insert("dead".to_string(), serde_json::json!(account.dead));
    metadata.insert(
        "connected_at".to_string(),
        serde_json::json!(Utc::now().to_rfc3339()),
    );

    if let Some(name) = &account.name {
        metadata.insert("account_name".to_string(), serde_json::json!(name));
    }
    if let Some(external_id) = &account.external_id {
        metadata.insert("workspace_id".to_string(), serde_json::json!(external_id));
    }
    if let Some(app) = &account.app {
        metadata.insert(
            "app".to_string(),
            serde_json::to_value(app).unwrap_or_default(),
        );
    }
    if let Some(data) = &account.data {
        metadata.insert("data".to_string(), data.clone());
        if let Some(obj) = data.as_object() {
            for key in [
                "workspace_id",
                "workspace_name",
                "account_name",
                "admin_email",
                "region",
            ] {
                if let Some(value) = obj.get(key) {
                    metadata.insert(key.to_string(), value.clone());
                }
            }
        }
    }

    serde_json::Value::Object(metadata)
}

pub async fn list_apps(
    _user: AuthUser,
    State(state): State<SaasAppState>,
    Query(params): Query<ListAppsParams>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .list_apps(params.q.as_deref(), params.limit)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "data": result.data,
        "pageInfo": result.page_info,
    })))
}

pub async fn list_triggers(
    _user: AuthUser,
    State(state): State<SaasAppState>,
    Query(params): Query<ListTriggersParams>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .list_triggers(params.app.as_deref(), params.q.as_deref(), params.limit)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "data": result.data,
        "pageInfo": result.page_info,
    })))
}

#[derive(serde::Deserialize)]
pub struct ConfigurePropRequest {
    pub trigger_id: String,
    pub prop_name: String,
    pub configured_props: Option<serde_json::Value>,
    pub query: Option<String>,
}

pub async fn configure_prop(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<ConfigurePropRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .configure_prop(
            &input.trigger_id,
            &input.prop_name,
            &user.tenant_id,
            input.configured_props,
            input.query.as_deref(),
        )
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok(Json(serde_json::to_value(result).unwrap_or_default()))
}

pub async fn deploy_trigger(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<DeployTriggerRequest>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let pd = get_pipedream(&state)?;
    let connection_id = input
        .connection_id
        .clone()
        .ok_or_else(|| ApiError::bad_request("connectionId is required"))?;
    let connection = state
        .connections
        .find_by_id(&connection_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Connection"))?;
    if connection.tenant_id != user.tenant_id {
        return Err(ApiError::forbidden(
            "Connection does not belong to the current tenant",
        ));
    }
    let trigger_id = input.trigger_id.clone();
    let configured_props = input.configured_props.clone();

    let result = pd
        .deploy_trigger(chronicle_pipedream_connect::types::DeployTriggerRequest {
            id: input.trigger_id,
            external_user_id: user.tenant_id.clone(),
            configured_props: configured_props.clone(),
            webhook_url: input.webhook_url,
            workflow_id: None,
        })
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    state
        .integration_syncs
        .create(
            &user.tenant_id,
            &connection_id,
            &trigger_id,
            &result.data.id,
            configured_props,
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": result.data })),
    ))
}

pub async fn list_deployed(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<DeployedTriggersResponse>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .list_deployments(&user.tenant_id)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    let triggers = match state.integration_syncs.list_by_tenant(&user.tenant_id).await {
        Ok(triggers) => triggers,
        Err(RepoError::Internal(detail))
            if (detail.contains("PipedreamTrigger") || detail.contains("IntegrationSync"))
                && detail.contains("does not exist") =>
        {
            // Backward compatibility for older SaaS schemas where this table may not exist yet.
            Vec::new()
        }
        Err(error) => return Err(error.into()),
    };

    Ok(Json(DeployedTriggersResponse {
        data: serde_json::to_value(result.data).unwrap_or_default(),
        triggers: triggers
            .into_iter()
            .map(|trigger| PipedreamTrigger {
                id: trigger.id,
                tenant_id: trigger.tenant_id,
                connection_id: trigger.connection_id,
                trigger_id: trigger.sync_name,
                deployment_id: trigger.nango_sync_id,
                configured_props: trigger.configured_props,
                status: trigger.status,
                created_at: trigger.created_at,
                updated_at: trigger.updated_at,
            })
            .collect(),
    }))
}

pub async fn get_deployed(
    _user: AuthUser,
    State(state): State<SaasAppState>,
    Path(deployment_id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .get_deployment(&deployment_id)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok(Json(serde_json::json!({ "data": result.data })))
}

pub async fn update_deployed(
    _user: AuthUser,
    State(state): State<SaasAppState>,
    Path(deployment_id): Path<String>,
    Json(input): Json<UpdateDeploymentRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .update_deployment(&deployment_id, input)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok(Json(serde_json::json!({ "data": result.data })))
}

pub async fn delete_deployed(
    _user: AuthUser,
    State(state): State<SaasAppState>,
    Path(deployment_id): Path<String>,
) -> ApiResult<StatusCode> {
    let pd = get_pipedream(&state)?;
    pd.delete_deployment(&deployment_id)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    if let Ok(Some(trigger)) = state
        .integration_syncs
        .find_by_nango_sync_id(&deployment_id)
        .await
    {
        let _ = state.integration_syncs.delete(&trigger.id).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_token(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<PipedreamTokenRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let success_redirect_uri = build_success_redirect_uri(&state, input.app_id.as_deref());
    let error_redirect_uri = build_error_redirect_uri(&state);

    let token = pd
        .create_token(chronicle_pipedream_connect::types::CreateTokenRequest {
            external_user_id: user.tenant_id,
            app_id: input.app_id,
            webhook_uri: None,
            success_redirect_uri: Some(success_redirect_uri),
            error_redirect_uri: Some(error_redirect_uri),
        })
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok(Json(serde_json::json!(token)))
}

pub async fn list_accounts(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .list_accounts(&user.tenant_id, None::<&str>)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok(Json(serde_json::json!({ "data": result.data })))
}

pub async fn sync_accounts(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<SyncAccountsResponse>> {
    let pd = get_pipedream(&state)?;
    let result = pd
        .list_accounts(&user.tenant_id, None::<&str>)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    let mut connections = Vec::new();
    for account in result.data {
        let Some(provider) = resolve_provider_slug(&account) else {
            continue;
        };

        let status = connection_status(&account);
        let metadata = build_connection_metadata(&account, &provider);

        let connection = state
            .connections
            .upsert_by_tenant_provider(
                CreateConnectionInput {
                    tenant_id: user.tenant_id.clone(),
                    provider,
                    access_token: None,
                    refresh_token: None,
                    expires_at: None,
                    nango_connection_id: Some(account.id.clone()),
                    metadata: Some(metadata),
                },
                status,
            )
            .await?;

        connections.push(connection);
    }

    let synced = connections.len();
    Ok(Json(SyncAccountsResponse {
        synced,
        connections,
    }))
}
