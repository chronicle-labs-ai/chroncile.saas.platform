use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use chronicle_auth::types::AuthUser;
use chronicle_domain::{Connection, ConnectionListResponse, CreateConnectionInput};

use super::error::{ApiError, ApiResult};
use crate::{runtime_config::SaasRuntimeConfig, saas_state::SaasAppState};

#[derive(Debug, Clone)]
pub(crate) struct NangoProviderDescriptor {
    pub provider: &'static str,
    pub display_name: &'static str,
    pub description: &'static str,
    pub integration_id: String,
    pub sync_name: &'static str,
    pub model: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NangoProviderSummary {
    pub provider: String,
    pub display_name: String,
    pub description: String,
    pub integration_id: String,
    pub sync_name: String,
    pub model: String,
    pub connection: Option<Connection>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NangoProvidersResponse {
    pub providers: Vec<NangoProviderSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConnectSessionBody {
    pub provider: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConnectSessionResponse {
    pub provider: String,
    pub integration_id: String,
    pub session_token: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConnectionBody {
    pub provider: String,
    pub connection_id: String,
    pub provider_config_key: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerSyncBody {
    pub provider: String,
    pub sync_mode: Option<String>,
    pub requested_sync_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisconnectBody {
    pub provider: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NangoConnectionActionResponse {
    pub success: bool,
    pub message: String,
    pub connection: Option<Connection>,
}

pub(crate) fn nango_provider_catalog(config: &SaasRuntimeConfig) -> Vec<NangoProviderDescriptor> {
    vec![
        NangoProviderDescriptor {
            provider: "slack",
            display_name: "Slack",
            description: "Sync channel messages, thread replies, and reactions.",
            integration_id: config.nango.slack_integration_id.clone(),
            sync_name: "slack-messages",
            model: "SlackMessage",
        },
        NangoProviderDescriptor {
            provider: "front",
            display_name: "Front",
            description: "Sync conversations, messages, comments, inboxes, and assignees.",
            integration_id: config.nango.front_integration_id.clone(),
            sync_name: "conversations",
            model: "FrontConversation",
        },
    ]
}

pub(crate) fn nango_provider_by_name<'a>(
    config: &'a SaasRuntimeConfig,
    provider: &str,
) -> Option<NangoProviderDescriptor> {
    nango_provider_catalog(config)
        .into_iter()
        .find(|item| item.provider == provider)
}

pub(crate) fn nango_provider_by_integration_id(
    config: &SaasRuntimeConfig,
    integration_id: &str,
) -> Option<NangoProviderDescriptor> {
    nango_provider_catalog(config)
        .into_iter()
        .find(|item| item.integration_id == integration_id)
}

fn require_nango(state: &SaasAppState) -> ApiResult<&std::sync::Arc<chronicle_nango::NangoClient>> {
    state
        .nango
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Nango is not configured"))
}

fn merge_metadata(
    existing: Option<serde_json::Value>,
    patch: serde_json::Value,
) -> serde_json::Value {
    let mut map = match existing {
        Some(serde_json::Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    };

    if let serde_json::Value::Object(patch_map) = patch {
        for (key, value) in patch_map {
            map.insert(key, value);
        }
    }

    serde_json::Value::Object(map)
}

fn nango_integrations_config_defaults(
    provider: &NangoProviderDescriptor,
) -> Option<serde_json::Value> {
    match provider.provider {
        "slack" => {
            let user_scopes = "channels:history,groups:history";
            let mut defaults = serde_json::Map::new();
            defaults.insert(
                provider.integration_id.clone(),
                serde_json::json!({
                    "user_scopes": user_scopes,
                    "connection_config": {
                        "user_scopes": user_scopes,
                    }
                }),
            );
            Some(serde_json::Value::Object(defaults))
        }
        _ => None,
    }
}

pub(crate) fn clear_nango_sync_bookmarks(
    existing: Option<serde_json::Value>,
    provider_config_key: &str,
) -> serde_json::Value {
    let mut metadata = match existing {
        Some(serde_json::Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    };

    if let Some(serde_json::Value::Object(bookmarks)) = metadata.get_mut("nango_sync_bookmarks") {
        bookmarks.remove(provider_config_key);
    }

    serde_json::Value::Object(metadata)
}

pub(crate) async fn persist_connection_metadata(
    state: &SaasAppState,
    connection: &Connection,
    metadata: serde_json::Value,
) -> ApiResult<Connection> {
    state
        .connections
        .upsert_by_tenant_provider(
            CreateConnectionInput {
                tenant_id: connection.tenant_id.clone(),
                provider: connection.provider.clone(),
                access_token: connection.access_token.clone(),
                refresh_token: connection.refresh_token.clone(),
                expires_at: connection.expires_at,
                nango_connection_id: connection.nango_connection_id.clone(),
                metadata: Some(metadata),
            },
            &connection.status,
        )
        .await
        .map_err(Into::into)
}

fn parse_timestamp(value: Option<&str>) -> Option<chrono::DateTime<chrono::Utc>> {
    value
        .and_then(|raw| chrono::DateTime::parse_from_rfc3339(raw).ok())
        .map(|timestamp| timestamp.with_timezone(&chrono::Utc))
}

async fn resolve_nango_connection_for_user(
    state: &SaasAppState,
    user: &AuthUser,
    provider: &NangoProviderDescriptor,
    requested_connection_id: Option<&str>,
    provider_config_key: &str,
) -> ApiResult<chronicle_nango::NangoConnection> {
    let nango = require_nango(state)?;
    let canonical_tags = vec![
        ("end_user_id".to_string(), user.id.clone()),
        ("end_user_email".to_string(), user.email.clone()),
        ("organization_id".to_string(), user.tenant_id.clone()),
        ("tenant_id".to_string(), user.tenant_id.clone()),
    ];

    if let Some(connection_id) = requested_connection_id {
        match nango
            .get_connection(connection_id, provider_config_key)
            .await
        {
            Ok(connection) => {
                tracing::info!(
                    provider = provider.provider,
                    provider_config_key,
                    requested_connection_id = connection_id,
                    resolved_connection_id = connection.connection_id,
                    "Resolved Nango connection directly from get_connection"
                );
                return Ok(connection);
            }
            Err(chronicle_nango::NangoError::NotFound) => {
                tracing::warn!(
                    provider = provider.provider,
                    provider_config_key,
                    requested_connection_id = connection_id,
                    "Requested Nango connection was not found, falling back to list_connections"
                );
            }
            Err(error) => {
                tracing::warn!(
                    provider = provider.provider,
                    provider_config_key,
                    requested_connection_id = connection_id,
                    %error,
                    "Failed to fetch Nango connection directly, falling back to list_connections"
                );
            }
        }
    }

    let resolution_queries = vec![
        chronicle_nango::ListConnectionsQuery {
            end_user_id: Some(user.id.clone()),
            end_user_organization_id: Some(user.tenant_id.clone()),
            search: None,
            tags: canonical_tags.clone(),
        },
        chronicle_nango::ListConnectionsQuery {
            end_user_id: None,
            end_user_organization_id: None,
            search: Some(user.email.clone()),
            tags: vec![
                ("organization_id".to_string(), user.tenant_id.clone()),
                ("tenant_id".to_string(), user.tenant_id.clone()),
            ],
        },
        chronicle_nango::ListConnectionsQuery {
            end_user_id: None,
            end_user_organization_id: None,
            search: Some(user.email.clone()),
            tags: Vec::new(),
        },
    ];

    let mut resolved_connection = None;
    for query in resolution_queries {
        let connections = nango.list_connections(&query).await.map_err(|error| {
            tracing::error!(
                provider = provider.provider,
                provider_config_key,
                user_id = user.id,
                tenant_id = user.tenant_id,
                %error,
                "Failed to list Nango connections for resolution"
            );
            ApiError::bad_request(format!("Failed to resolve Nango connection: {error}"))
        })?;

        let matching = connections
            .connections
            .into_iter()
            .filter(|connection| {
                connection.provider_config_key == provider_config_key
                    || connection.provider == provider.provider
            })
            .max_by_key(|connection| {
                parse_timestamp(connection.updated_at.as_deref())
                    .or_else(|| parse_timestamp(connection.created_at.as_deref()))
            });

        if matching.is_some() {
            resolved_connection = matching;
            break;
        }
    }

    let connection = resolved_connection.ok_or_else(|| {
        ApiError::bad_request(format!(
            "No Nango connection found for provider `{}` in the current environment for this user. Connect the account from Chronicle or enable the Nango auth webhook so Chronicle can store the canonical connection id.",
            provider_config_key
        ))
    })?;

    tracing::info!(
        provider = provider.provider,
        provider_config_key,
        requested_connection_id,
        resolved_connection_id = connection.connection_id,
        "Resolved canonical Nango connection from list_connections"
    );

    Ok(connection)
}

async fn sync_materialized_connection_for_user(
    state: &SaasAppState,
    user: &AuthUser,
    provider: &NangoProviderDescriptor,
    requested_connection_id: Option<&str>,
    provider_config_key: &str,
) -> ApiResult<Connection> {
    let resolved = resolve_nango_connection_for_user(
        state,
        user,
        provider,
        requested_connection_id,
        provider_config_key,
    )
    .await?;

    materialize_nango_connection(
        state,
        &user.tenant_id,
        provider.provider,
        &resolved.connection_id,
        &resolved.provider_config_key,
        Some(user),
    )
    .await
}

pub(crate) async fn materialize_nango_connection(
    state: &SaasAppState,
    tenant_id: &str,
    provider: &str,
    connection_id: &str,
    provider_config_key: &str,
    user: Option<&AuthUser>,
) -> ApiResult<Connection> {
    let existing = state
        .connections
        .find_by_tenant_provider(tenant_id, provider)
        .await?;

    let metadata = merge_metadata(
        existing
            .as_ref()
            .and_then(|connection| connection.metadata.clone()),
        serde_json::json!({
            "connected_via": "nango",
            "provider_config_key": provider_config_key,
            "connection_id": connection_id,
            "connected_at": chrono::Utc::now().to_rfc3339(),
            "end_user": user.map(|auth_user| serde_json::json!({
                "id": auth_user.id,
                "email": auth_user.email,
                "name": auth_user.name,
            })),
        }),
    );

    state
        .connections
        .upsert_by_tenant_provider(
            CreateConnectionInput {
                tenant_id: tenant_id.to_string(),
                provider: provider.to_string(),
                access_token: existing
                    .as_ref()
                    .and_then(|connection| connection.access_token.clone()),
                refresh_token: existing
                    .as_ref()
                    .and_then(|connection| connection.refresh_token.clone()),
                expires_at: existing
                    .as_ref()
                    .and_then(|connection| connection.expires_at.clone()),
                nango_connection_id: Some(connection_id.to_string()),
                metadata: Some(metadata),
            },
            "active",
        )
        .await
        .map_err(Into::into)
}

pub(crate) async fn trigger_provider_sync(
    state: &SaasAppState,
    provider: &NangoProviderDescriptor,
    connection: &Connection,
    sync_mode: Option<&str>,
    requested_sync_name: Option<&str>,
) -> ApiResult<()> {
    let nango = require_nango(state)?;
    let connection_id = connection
        .nango_connection_id
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Connection is missing a Nango connection ID"))?;
    let scripts_config = nango
        .get_scripts_config(&provider.integration_id)
        .await
        .map_err(|error| {
            tracing::error!(provider = provider.provider, %error, "Failed to load Nango scripts config");
            ApiError::bad_request(format!("Failed to load sync config from Nango: {error}"))
        })?;

    let available_syncs = scripts_config
        .syncs
        .iter()
        .map(|script| format!("{}:{}", script.name, script.enabled.unwrap_or(true)))
        .collect::<Vec<_>>();

    let sync_name = if let Some(requested) = requested_sync_name {
        scripts_config
            .syncs
            .iter()
            .find(|script| script.enabled.unwrap_or(true) && script.name == requested)
            .map(|script| script.name.clone())
            .ok_or_else(|| {
                ApiError::bad_request(format!(
                    "Requested Nango sync `{requested}` is not enabled for integration `{}`. Available syncs: {}",
                    provider.integration_id,
                    available_syncs.join(", ")
                ))
            })?
    } else {
        scripts_config
            .syncs
            .iter()
            .find(|script| script.enabled.unwrap_or(true) && script.name == "conversations")
            .or_else(|| {
                scripts_config.syncs.iter().find(|script| {
                    script.enabled.unwrap_or(true) && script.name == provider.sync_name
                })
            })
            .map(|script| script.name.clone())
            .unwrap_or_else(|| provider.sync_name.to_string())
    };

    tracing::info!(
        provider = provider.provider,
        integration_id = provider.integration_id,
        connection_id,
        requested_sync_name,
        requested_sync = provider.sync_name,
        resolved_sync = sync_name,
        available_syncs = ?available_syncs,
        "Triggering Nango sync"
    );

    let trigger_request = chronicle_nango::TriggerSyncRequest {
        provider_config_key: provider.integration_id.clone(),
        connection_id: connection_id.to_string(),
        syncs: vec![sync_name.clone()],
        sync_mode: sync_mode.map(str::to_string),
    };

    match nango.trigger_sync(&trigger_request).await {
        Ok(_) => {}
        Err(chronicle_nango::NangoError::NotFound) => {
            tracing::warn!(
                provider = provider.provider,
                integration_id = provider.integration_id,
                connection_id,
                sync_name,
                "Nango trigger_sync returned not found, retrying with sync/start"
            );

            nango
                .start_sync(&chronicle_nango::StartSyncRequest {
                    provider_config_key: provider.integration_id.clone(),
                    connection_id: connection_id.to_string(),
                    syncs: vec![sync_name.clone()],
                })
                .await
                .map_err(|error| {
                    tracing::error!(
                        provider = provider.provider,
                        %error,
                        "Failed to start Nango sync after trigger fallback"
                    );
                    match error {
                        chronicle_nango::NangoError::NotFound => ApiError::bad_request(format!(
                            "Failed to trigger sync: Nango could not find integration `{}` or sync `{}` in the current environment.",
                            provider.integration_id, sync_name
                        )),
                        other => ApiError::bad_request(format!("Failed to start sync: {other}")),
                    }
                })?;
        }
        Err(error) => {
            tracing::error!(provider = provider.provider, %error, "Failed to trigger Nango sync");
            return Err(ApiError::bad_request(format!(
                "Failed to trigger sync: {error}"
            )));
        }
    }

    Ok(())
}

pub async fn list_providers(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<NangoProvidersResponse>> {
    let connections = state.connections.list_by_tenant(&user.tenant_id).await?;

    let providers = nango_provider_catalog(&state.config)
        .into_iter()
        .map(|provider| NangoProviderSummary {
            provider: provider.provider.to_string(),
            display_name: provider.display_name.to_string(),
            description: provider.description.to_string(),
            integration_id: provider.integration_id.clone(),
            sync_name: provider.sync_name.to_string(),
            model: provider.model.to_string(),
            connection: connections
                .iter()
                .find(|connection| connection.provider == provider.provider)
                .cloned(),
        })
        .collect();

    Ok(Json(NangoProvidersResponse { providers }))
}

pub async fn list_nango_connections(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<ConnectionListResponse>> {
    let providers = nango_provider_catalog(&state.config);
    let allowed: std::collections::HashSet<_> =
        providers.into_iter().map(|item| item.provider).collect();
    let connections = state
        .connections
        .list_by_tenant(&user.tenant_id)
        .await?
        .into_iter()
        .filter(|connection| allowed.contains(connection.provider.as_str()))
        .collect();

    Ok(Json(ConnectionListResponse { connections }))
}

pub async fn create_connect_session(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(body): Json<CreateConnectSessionBody>,
) -> ApiResult<Json<CreateConnectSessionResponse>> {
    let provider = nango_provider_by_name(&state.config, &body.provider)
        .ok_or_else(|| ApiError::bad_request("Unsupported Nango provider"))?;
    let nango = require_nango(&state)?;

    let existing = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, provider.provider)
        .await?;

    let resolved_existing = if let Some(connection) = existing.as_ref() {
        if let Some(connection_id) = connection.nango_connection_id.as_deref() {
            resolve_nango_connection_for_user(
                &state,
                &user,
                &provider,
                Some(connection_id),
                provider.integration_id.as_str(),
            )
            .await
            .ok()
        } else {
            None
        }
    } else {
        None
    };

    let end_user = chronicle_nango::ConnectEndUser {
        id: user.id.clone(),
        email: Some(user.email.clone()),
        display_name: user.name.clone(),
        tags: Some(serde_json::json!({
            "organizationId": user.tenant_id,
            "tenantId": user.tenant_id,
            "tenantSlug": user.tenant_slug,
        })),
    };
    let tags = Some(serde_json::json!({
        "end_user_id": user.id,
        "end_user_email": user.email,
        "organization_id": user.tenant_id,
        "tenant_id": user.tenant_id,
        "tenant_slug": user.tenant_slug,
    }));
    let organization = Some(chronicle_nango::ConnectOrganization {
        id: user.tenant_id.clone(),
        display_name: Some(user.tenant_name.clone()),
    });
    let integrations_config_defaults = nango_integrations_config_defaults(&provider);

    let session = if existing.is_some() {
        if let Some(connection_id) = resolved_existing
            .as_ref()
            .map(|connection| connection.connection_id.clone())
        {
            nango
                .create_reconnect_session(&chronicle_nango::CreateReconnectSessionRequest {
                    connection_id,
                    integration_id: provider.integration_id.clone(),
                    tags: tags.clone(),
                    end_user,
                    organization,
                    integrations_config_defaults: integrations_config_defaults.clone(),
                    overrides: None,
                })
                .await
        } else {
            nango
                .create_connect_session(&chronicle_nango::CreateConnectSessionRequest {
                    tags: tags.clone(),
                    end_user,
                    organization,
                    allowed_integrations: vec![provider.integration_id.clone()],
                    integrations_config_defaults: integrations_config_defaults.clone(),
                })
                .await
        }
    } else {
        nango
            .create_connect_session(&chronicle_nango::CreateConnectSessionRequest {
                tags,
                end_user,
                organization,
                allowed_integrations: vec![provider.integration_id.clone()],
                integrations_config_defaults,
            })
            .await
    }
    .map_err(|error| {
        tracing::error!(provider = provider.provider, %error, "Failed to create Nango connect session");
        ApiError::bad_request(format!("Failed to create Nango session: {error}"))
    })?;

    Ok(Json(CreateConnectSessionResponse {
        provider: provider.provider.to_string(),
        integration_id: provider.integration_id,
        session_token: session.data.token,
        expires_at: session.data.expires_at,
    }))
}

pub async fn sync_connection(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(body): Json<SyncConnectionBody>,
) -> ApiResult<Json<NangoConnectionActionResponse>> {
    let provider = nango_provider_by_name(&state.config, &body.provider)
        .ok_or_else(|| ApiError::bad_request("Unsupported Nango provider"))?;
    let provider_config_key = body
        .provider_config_key
        .as_deref()
        .unwrap_or(provider.integration_id.as_str());

    let connection = sync_materialized_connection_for_user(
        &state,
        &user,
        &provider,
        Some(&body.connection_id),
        provider_config_key,
    )
    .await?;

    Ok(Json(NangoConnectionActionResponse {
        success: true,
        message: "Connection saved".to_string(),
        connection: Some(connection),
    }))
}

pub async fn trigger_sync(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(body): Json<TriggerSyncBody>,
) -> ApiResult<Json<NangoConnectionActionResponse>> {
    let provider = nango_provider_by_name(&state.config, &body.provider)
        .ok_or_else(|| ApiError::bad_request("Unsupported Nango provider"))?;
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, provider.provider)
        .await?
        .ok_or_else(|| ApiError::not_found("Connection"))?;

    let provider_config_key = connection
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("provider_config_key"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or(provider.integration_id.as_str());

    let mut connection = sync_materialized_connection_for_user(
        &state,
        &user,
        &provider,
        connection.nango_connection_id.as_deref(),
        provider_config_key,
    )
    .await?;

    if matches!(
        body.sync_mode.as_deref(),
        Some("full_refresh_and_clear_cache")
    ) {
        let metadata = clear_nango_sync_bookmarks(connection.metadata.clone(), provider_config_key);
        connection = persist_connection_metadata(&state, &connection, metadata).await?;
    }

    trigger_provider_sync(
        &state,
        &provider,
        &connection,
        body.sync_mode.as_deref(),
        body.requested_sync_name.as_deref(),
    )
    .await?;

    Ok(Json(NangoConnectionActionResponse {
        success: true,
        message: "Sync triggered".to_string(),
        connection: Some(connection),
    }))
}

pub async fn disconnect(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(body): Json<DisconnectBody>,
) -> ApiResult<Json<NangoConnectionActionResponse>> {
    let provider = nango_provider_by_name(&state.config, &body.provider)
        .ok_or_else(|| ApiError::bad_request("Unsupported Nango provider"))?;
    let connection = state
        .connections
        .find_by_tenant_provider(&user.tenant_id, provider.provider)
        .await?
        .ok_or_else(|| ApiError::not_found("Connection"))?;

    let connection_id = connection
        .nango_connection_id
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("Connection is missing a Nango connection ID"))?;

    let provider_config_key = connection
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("provider_config_key"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or(provider.integration_id.as_str());

    require_nango(&state)?
        .delete_connection(connection_id, provider_config_key)
        .await
        .map_err(|error| {
            tracing::error!(provider = provider.provider, %error, "Failed to delete Nango connection");
            ApiError::bad_request(format!("Failed to disconnect provider: {error}"))
        })?;

    state.connections.delete(&connection.id).await?;

    Ok(Json(NangoConnectionActionResponse {
        success: true,
        message: "Connection disconnected".to_string(),
        connection: None,
    }))
}
