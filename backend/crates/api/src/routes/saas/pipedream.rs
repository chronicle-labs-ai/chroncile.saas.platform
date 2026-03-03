use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};

use chronicle_auth::types::AuthUser;
use chronicle_domain::{
    DeployTriggerRequest, DeployedTriggersResponse, ListAppsParams,
    ListTriggersParams, PipedreamTokenRequest,
};
use pipedream_connect::types::UpdateDeploymentRequest;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

fn get_pipedream(state: &SaasAppState) -> ApiResult<&pipedream_connect::PipedreamClient> {
    state
        .pipedream
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Pipedream integration is not configured"))
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

pub async fn deploy_trigger(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<DeployTriggerRequest>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let pd = get_pipedream(&state)?;

    let result = pd
        .deploy_trigger(pipedream_connect::types::DeployTriggerRequest {
            id: input.trigger_id,
            external_user_id: user.tenant_id.clone(),
            configured_props: input.configured_props,
            webhook_url: input.webhook_url,
            workflow_id: None,
        })
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "data": result.data }))))
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

    let triggers = state.pipedream_triggers.list_by_tenant(&user.tenant_id).await?;

    Ok(Json(DeployedTriggersResponse {
        data: serde_json::to_value(result.data).unwrap_or_default(),
        triggers,
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

    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_token(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<PipedreamTokenRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let pd = get_pipedream(&state)?;
    let token = pd
        .create_token(pipedream_connect::types::CreateTokenRequest {
            external_user_id: user.tenant_id,
            app_id: input.app_id,
            webhook_uri: None,
            success_redirect_uri: None,
            error_redirect_uri: None,
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
