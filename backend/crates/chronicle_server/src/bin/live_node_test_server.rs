use std::net::SocketAddr;
use std::sync::Arc;

use chronicle_server::rest::build_router;
use chronicle_server::ServerState;
use chronicle_store::memory::InMemoryBackend;
use chronicle_store::StorageEngine;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let host =
        std::env::var("CHRONICLE_TEST_SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("CHRONICLE_TEST_SERVER_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(18080);
    let addr: SocketAddr = format!("{host}:{port}").parse()?;

    let backend = Arc::new(InMemoryBackend::new());
    let engine = StorageEngine {
        events: backend.clone(),
        entity_refs: backend.clone(),
        links: backend.clone(),
        embeddings: backend.clone(),
        schemas: backend.clone(),
        subscriptions: Some(backend),
    };
    let state = ServerState::new(engine);
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("chronicle_server live node test server listening on http://{addr}");
    axum::serve(listener, build_router(state)).await?;
    Ok(())
}
