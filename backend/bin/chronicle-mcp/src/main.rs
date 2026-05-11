use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{bail, Result};
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use chronicle_auth::{types::AuthUser, workos_jwt::WorkosJwtVerifier};
use chronicle_backend::{config, runtime, telemetry};
use chronicle_interfaces::{TenantRepository, UserRepository};
use chronicle_mcp::{
    auth::validate_workos_token, ChronicleMcpAuthResolver, ChronicleMcpServer,
    ChronicleMcpServerOptions, InProcessChronicleMcpDataAccess,
};
use rmcp::{
    transport::{
        streamable_http_server::{
            session::local::LocalSessionManager, tower::StreamableHttpService,
        },
        StreamableHttpServerConfig,
    },
    ServiceExt,
};
use serde::Serialize;
use tokio::{
    io::{stdin, stdout},
    net::TcpListener,
};

const DEFAULT_HTTP_HOST: &str = "127.0.0.1";
const DEFAULT_HTTP_PORT: u16 = 8090;

fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let cli = McpCliArgs::parse()?;
    let config_path = config::LaunchConfig::config_path(cli.backend_config_path.clone());
    let launch_config = config::LaunchConfig::load(config_path.as_deref())?;

    if cli.print_config {
        println!(
            "{}",
            toml::to_string_pretty(&ResolvedMcpConfig {
                transport: cli.transport.as_str().to_string(),
                host: cli.host.clone(),
                port: cli.port,
                enable_replay: cli.enable_replay,
                backend_config_path: config_path.as_ref().map(|path| path.display().to_string()),
            })?
        );
        return Ok(());
    }

    let _sentry_guard = telemetry::init_sentry(&launch_config)?;
    telemetry::init_tracing(&launch_config);
    telemetry::log_sentry_configuration(&launch_config);

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(run(cli, launch_config, config_path))
}

async fn run(
    cli: McpCliArgs,
    launch_config: config::LaunchConfig,
    config_path: Option<PathBuf>,
) -> Result<()> {
    tracing::info!("Starting Chronicle MCP server");
    if let Some(path) = config_path.as_ref() {
        tracing::info!(path = %path.display(), "Loaded launch configuration file");
    } else {
        tracing::info!("Using env/default launch configuration");
    }

    let platform_runtime = runtime::build_platform_runtime(&launch_config).await?;
    let data_access = Arc::new(InProcessChronicleMcpDataAccess::new(
        platform_runtime.events_state.clone(),
        platform_runtime.saas_state.clone(),
        Arc::clone(&platform_runtime.stream_backend),
    ));
    let options = ChronicleMcpServerOptions {
        enable_replay: cli.enable_replay,
    };

    let workos_jwt = platform_runtime.saas_state.workos_jwt.clone();
    let users_repo = platform_runtime.saas_state.users.clone();
    let tenants_repo = platform_runtime.saas_state.tenants.clone();

    match cli.transport {
        TransportMode::Stdio => {
            let token = cli.token.as_deref().ok_or_else(|| {
                anyhow::anyhow!("--token or CHRONICLE_MCP_TOKEN is required for stdio mode")
            })?;
            let auth = ChronicleMcpAuthResolver::for_stdio(
                workos_jwt.clone(),
                users_repo.clone(),
                tenants_repo.clone(),
                token,
            )
            .await
            .map_err(|error| anyhow::anyhow!(error.to_mcp_error().message.to_string()))?;
            let server = ChronicleMcpServer::new(auth, data_access, options);
            let service = server.serve((stdin(), stdout())).await?;
            service.waiting().await?;
        }
        TransportMode::Http => {
            let auth = ChronicleMcpAuthResolver::for_http(
                workos_jwt.clone(),
                users_repo.clone(),
                tenants_repo.clone(),
            );
            let server = ChronicleMcpServer::new(auth, data_access, options);
            let mw_state = AuthMwState {
                workos_jwt,
                users: users_repo,
                tenants: tenants_repo,
            };
            serve_http(server, mw_state, &cli).await?;
        }
    }

    Ok(())
}

#[derive(Clone)]
struct AuthMwState {
    workos_jwt: Arc<WorkosJwtVerifier>,
    users: Arc<dyn UserRepository>,
    tenants: Arc<dyn TenantRepository>,
}

async fn serve_http(
    server: ChronicleMcpServer,
    mw_state: AuthMwState,
    cli: &McpCliArgs,
) -> Result<()> {
    let addr: SocketAddr = format!("{}:{}", cli.host, cli.port).parse()?;
    let mcp_service = StreamableHttpService::new(
        move || Ok(server.clone()),
        LocalSessionManager::default().into(),
        StreamableHttpServerConfig {
            stateful_mode: false,
            json_response: true,
            ..Default::default()
        },
    );

    let protected_mcp = Router::new()
        .nest_service("/mcp", mcp_service)
        .layer(middleware::from_fn_with_state(mw_state, auth_middleware));
    let app = Router::new()
        .route("/health", get(health_check))
        .merge(protected_mcp);

    let listener = TcpListener::bind(addr).await?;
    tracing::info!("Chronicle MCP HTTP listening on http://{}", addr);
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
        })
        .await?;
    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn auth_middleware(
    State(state): State<AuthMwState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = bearer_token(request.headers()).ok_or(StatusCode::UNAUTHORIZED)?;
    let user = validate_workos_token(&state.workos_jwt, &state.users, &state.tenants, token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    request.extensions_mut().insert::<AuthUser>(user);
    Ok(next.run(request).await)
}

fn bearer_token(headers: &axum::http::HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TransportMode {
    Stdio,
    Http,
}

impl TransportMode {
    fn parse(value: &str) -> Result<Self> {
        match value.trim().to_lowercase().as_str() {
            "stdio" => Ok(Self::Stdio),
            "http" | "streamable-http" | "streamable_http" => Ok(Self::Http),
            other => bail!("invalid MCP transport: {other}"),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Stdio => "stdio",
            Self::Http => "http",
        }
    }
}

#[derive(Debug, Clone)]
struct McpCliArgs {
    backend_config_path: Option<PathBuf>,
    print_config: bool,
    transport: TransportMode,
    host: String,
    port: u16,
    token: Option<String>,
    enable_replay: bool,
}

impl McpCliArgs {
    fn parse() -> Result<Self> {
        let mut backend_config_path = None;
        let mut print_config = false;
        let mut transport = None;
        let mut host = None;
        let mut port = None;
        let mut token = None;
        let mut enable_replay = None;
        let mut args = std::env::args().skip(1);

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--config" | "-c" => {
                    let Some(path) = args.next() else {
                        bail!("missing value for {arg}");
                    };
                    backend_config_path = Some(PathBuf::from(path));
                }
                "--print-config" => {
                    print_config = true;
                }
                "--transport" => {
                    let Some(value) = args.next() else {
                        bail!("missing value for --transport");
                    };
                    transport = Some(TransportMode::parse(&value)?);
                }
                "--host" => {
                    let Some(value) = args.next() else {
                        bail!("missing value for --host");
                    };
                    host = Some(value);
                }
                "--port" => {
                    let Some(value) = args.next() else {
                        bail!("missing value for --port");
                    };
                    port = Some(value.parse::<u16>()?);
                }
                "--token" => {
                    let Some(value) = args.next() else {
                        bail!("missing value for --token");
                    };
                    token = Some(value);
                }
                "--enable-replay" => {
                    enable_replay = Some(true);
                }
                _ if arg.starts_with("--config=") => {
                    backend_config_path = Some(PathBuf::from(extract_value(&arg)?));
                }
                _ if arg.starts_with("--transport=") => {
                    transport = Some(TransportMode::parse(extract_value(&arg)?)?);
                }
                _ if arg.starts_with("--host=") => {
                    host = Some(extract_value(&arg)?.to_string());
                }
                _ if arg.starts_with("--port=") => {
                    port = Some(extract_value(&arg)?.parse::<u16>()?);
                }
                _ if arg.starts_with("--token=") => {
                    token = Some(extract_value(&arg)?.to_string());
                }
                _ => bail!("unrecognized argument: {arg}"),
            }
        }

        Ok(Self {
            backend_config_path,
            print_config,
            transport: transport
                .or_else(|| {
                    non_empty_env("CHRONICLE_MCP_TRANSPORT")
                        .and_then(|value| TransportMode::parse(&value).ok())
                })
                .unwrap_or(TransportMode::Stdio),
            host: host
                .or_else(|| non_empty_env("CHRONICLE_MCP_HOST"))
                .unwrap_or_else(|| DEFAULT_HTTP_HOST.to_string()),
            port: port
                .or_else(|| parse_env("CHRONICLE_MCP_PORT").ok().flatten())
                .unwrap_or(DEFAULT_HTTP_PORT),
            token: token.or_else(|| non_empty_env("CHRONICLE_MCP_TOKEN")),
            enable_replay: enable_replay
                .or_else(|| parse_bool_env("CHRONICLE_MCP_ENABLE_REPLAY").ok().flatten())
                .unwrap_or(false),
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolvedMcpConfig {
    transport: String,
    host: String,
    port: u16,
    enable_replay: bool,
    backend_config_path: Option<String>,
}

fn extract_value(arg: &str) -> Result<&str> {
    arg.split_once('=')
        .map(|(_, value)| value)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow::anyhow!("missing value for {arg}"))
}

fn non_empty_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn parse_env<T>(key: &str) -> Result<Option<T>>
where
    T: std::str::FromStr,
    T::Err: std::error::Error + Send + Sync + 'static,
{
    match non_empty_env(key) {
        Some(value) => value
            .parse::<T>()
            .map(Some)
            .map_err(|error| anyhow::anyhow!("failed to parse {key}={value}: {error}")),
        None => Ok(None),
    }
}

fn parse_bool_env(key: &str) -> Result<Option<bool>> {
    match non_empty_env(key) {
        Some(value) => match value.trim().to_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Ok(Some(true)),
            "0" | "false" | "no" | "off" => Ok(Some(false)),
            _ => bail!("failed to parse {key}={value} as boolean"),
        },
        None => Ok(None),
    }
}

#[allow(dead_code)]
fn config_path_display(path: Option<&Path>) -> Option<String> {
    path.map(|value| value.display().to_string())
}
