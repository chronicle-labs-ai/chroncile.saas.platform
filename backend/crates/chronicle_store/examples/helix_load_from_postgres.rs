use std::env;
use std::path::PathBuf;
use std::sync::Arc;

use sqlx::Row;

use chronicle_core::entity_ref::EntityRef;
use chronicle_core::error::StoreError;
use chronicle_core::event::{Event, PendingEntityRef};
use chronicle_core::ids::{Confidence, EntityId, EntityType, EventId, EventType, LinkId, OrgId, Source, Topic};
use chronicle_core::link::EventLink;
use chronicle_core::media::MediaAttachment;
use chronicle_store::helix::{DEFAULT_HELIX_PROJECT_DIR, HelixConnectionConfig, HelixGraphBackend};
use chronicle_store::postgres::PostgresBackend;
use chronicle_store::traits::EventEmbedding;

const DEFAULT_DATABASE_URL: &str = "postgres://chronicle:chronicle_dev@127.0.0.1:5432/chronicle";
const DEFAULT_HELIX_ENDPOINT: &str = "http://localhost";
const DEFAULT_HELIX_PORT: u16 = 6969;
const DEFAULT_EVENT_LIMIT: i64 = 1_000;

#[derive(Debug, Clone)]
struct CliConfig {
    database_url: String,
    org_id: Option<String>,
    limit: i64,
    helix_endpoint: String,
    helix_port: u16,
    helix_api_key: Option<String>,
    run_migrations: bool,
}

impl CliConfig {
    fn parse() -> Result<Self, StoreError> {
        let mut database_url = env::var("EVENTS_DATABASE_URL")
            .or_else(|_| env::var("DATABASE_URL"))
            .unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
        let mut org_id = env::var("HELIX_BACKFILL_ORG_ID").ok();
        let mut limit = env::var("HELIX_BACKFILL_LIMIT")
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(DEFAULT_EVENT_LIMIT);
        let mut helix_endpoint =
            env::var("HELIX_BASE_URL").unwrap_or_else(|_| DEFAULT_HELIX_ENDPOINT.to_string());
        let mut helix_port = env::var("HELIX_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(DEFAULT_HELIX_PORT);
        let mut helix_api_key = env::var("HELIX_API_KEY").ok();
        let mut run_migrations = false;

        let mut args = env::args().skip(1);
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--help" | "-h" => {
                    print_usage();
                    std::process::exit(0);
                }
                "--database-url" => {
                    database_url = next_arg(&mut args, "--database-url")?;
                }
                "--org-id" => {
                    org_id = Some(next_arg(&mut args, "--org-id")?);
                }
                "--limit" => {
                    let raw = next_arg(&mut args, "--limit")?;
                    limit = raw.parse::<i64>().map_err(|error| {
                        StoreError::Query(format!("invalid --limit value '{raw}': {error}"))
                    })?;
                }
                "--helix-endpoint" => {
                    helix_endpoint = next_arg(&mut args, "--helix-endpoint")?;
                }
                "--helix-port" => {
                    let raw = next_arg(&mut args, "--helix-port")?;
                    helix_port = raw.parse::<u16>().map_err(|error| {
                        StoreError::Query(format!("invalid --helix-port value '{raw}': {error}"))
                    })?;
                }
                "--helix-api-key" => {
                    helix_api_key = Some(next_arg(&mut args, "--helix-api-key")?);
                }
                "--run-migrations" => {
                    run_migrations = true;
                }
                other => {
                    return Err(StoreError::Query(format!(
                        "unrecognized argument '{other}'"
                    )));
                }
            }
        }

        Ok(Self {
            database_url,
            org_id,
            limit,
            helix_endpoint,
            helix_port,
            helix_api_key,
            run_migrations,
        })
    }
}

#[tokio::main]
async fn main() -> Result<(), StoreError> {
    let config = CliConfig::parse()?;
    let canonical = Arc::new(PostgresBackend::new(&config.database_url).await?);
    if config.run_migrations {
        canonical.run_migrations().await?;
    }

    let org_id = resolve_org_id(&canonical, config.org_id.as_deref()).await?;
    let helix = HelixGraphBackend::new(
        HelixConnectionConfig {
            endpoint: config.helix_endpoint,
            port: config.helix_port,
            api_key: config.helix_api_key,
            project_dir: PathBuf::from(DEFAULT_HELIX_PROJECT_DIR),
        },
        canonical.clone(),
        canonical.clone(),
        canonical.clone(),
        canonical.clone(),
    );

    let events = load_events(&canonical, &org_id, config.limit).await?;
    if events.is_empty() {
        println!("No events found for org {}", org_id.as_str());
        return Ok(());
    }

    let event_id_strings = events
        .iter()
        .map(|event| event.event_id.to_string())
        .collect::<Vec<_>>();
    let refs = load_entity_refs(&canonical, &org_id, &event_id_strings).await?;
    let links = load_links(&canonical, &org_id, &event_id_strings).await?;
    let embeddings = load_embeddings(&canonical, &org_id, &event_id_strings).await?;

    helix.sync_events(&events).await?;
    helix.sync_existing_entity_refs(&org_id, &refs).await?;
    helix.sync_existing_links(&org_id, &links).await?;
    for embedding in &embeddings {
        helix.sync_event_embedding(embedding).await?;
    }

    println!(
        "Mirrored {} events, {} entity refs, {} links, and {} embeddings for org {} into Helix.",
        events.len(),
        refs.len(),
        links.len(),
        embeddings.len(),
        org_id.as_str()
    );

    Ok(())
}

fn next_arg(args: &mut impl Iterator<Item = String>, flag: &str) -> Result<String, StoreError> {
    args.next()
        .ok_or_else(|| StoreError::Query(format!("missing value for {flag}")))
}

fn print_usage() {
    println!(
        "Usage: helix_load_from_postgres [options]

Options:
  --database-url <url>      Postgres connection string
  --org-id <org_id>         Specific org to mirror; defaults to the largest org in Postgres
  --limit <count>           Max events to mirror (default: 1000)
  --helix-endpoint <url>    Helix base URL (default: http://localhost)
  --helix-port <port>       Helix port (default: 6969)
  --helix-api-key <key>     Optional Helix API key
  --run-migrations          Run Chronicle Postgres migrations before export
  --help, -h                Show this help"
    );
}

async fn resolve_org_id(
    backend: &PostgresBackend,
    requested_org_id: Option<&str>,
) -> Result<OrgId, StoreError> {
    if let Some(org_id) = requested_org_id {
        return Ok(OrgId::new(org_id));
    }

    let row = sqlx::query(
        "SELECT org_id
         FROM events
         GROUP BY org_id
         ORDER BY COUNT(*) DESC, org_id ASC
         LIMIT 1",
    )
    .fetch_optional(backend.pg_pool())
    .await
    .map_err(|error| StoreError::Query(error.to_string()))?
    .ok_or_else(|| StoreError::NotFound {
        entity: "org_id",
        id: "events".to_string(),
    })?;

    Ok(OrgId::new(row.get::<String, _>("org_id").as_str()))
}

async fn load_events(
    backend: &PostgresBackend,
    org_id: &OrgId,
    limit: i64,
) -> Result<Vec<Event>, StoreError> {
    let rows = sqlx::query(
        "SELECT event_id, org_id, source, topic, event_type, event_time, ingestion_time,
                payload, media_type, media_ref, media_blob, media_size_bytes, raw_body
         FROM events
         WHERE org_id = $1
         ORDER BY event_time DESC
         LIMIT $2",
    )
    .bind(org_id.as_str())
    .bind(limit)
    .fetch_all(backend.pg_pool())
    .await
    .map_err(|error| StoreError::Query(error.to_string()))?;

    Ok(rows.iter().map(row_to_event).collect())
}

async fn load_entity_refs(
    backend: &PostgresBackend,
    org_id: &OrgId,
    event_id_strings: &[String],
) -> Result<Vec<EntityRef>, StoreError> {
    if event_id_strings.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query(
        "SELECT event_id, entity_type, entity_id, created_by, created_at
         FROM entity_refs
         WHERE org_id = $1 AND event_id = ANY($2::text[])
         ORDER BY created_at ASC",
    )
    .bind(org_id.as_str())
    .bind(event_id_strings)
    .fetch_all(backend.pg_pool())
    .await
    .map_err(|error| StoreError::Query(error.to_string()))?;

    rows.iter()
        .map(|row| {
            Ok(EntityRef {
                event_id: row
                    .get::<String, _>("event_id")
                    .parse::<EventId>()
                    .map_err(|error| StoreError::Internal(error.to_string()))?,
                entity_type: EntityType::new(&row.get::<String, _>("entity_type")),
                entity_id: EntityId::new(&row.get::<String, _>("entity_id")),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
            })
        })
        .collect()
}

async fn load_links(
    backend: &PostgresBackend,
    org_id: &OrgId,
    event_id_strings: &[String],
) -> Result<Vec<EventLink>, StoreError> {
    if event_id_strings.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query(
        "SELECT link_id, source_event_id, target_event_id, link_type, confidence, reasoning, created_by, created_at
         FROM event_links
         WHERE org_id = $1
           AND source_event_id = ANY($2::text[])
           AND target_event_id = ANY($2::text[])
         ORDER BY created_at ASC",
    )
    .bind(org_id.as_str())
    .bind(event_id_strings)
    .fetch_all(backend.pg_pool())
    .await
    .map_err(|error| StoreError::Query(error.to_string()))?;

    rows.iter()
        .map(|row| {
            Ok(EventLink {
                link_id: row
                    .get::<String, _>("link_id")
                    .parse::<LinkId>()
                    .map_err(|error| StoreError::Internal(error.to_string()))?,
                source_event_id: row
                    .get::<String, _>("source_event_id")
                    .parse::<EventId>()
                    .map_err(|error| StoreError::Internal(error.to_string()))?,
                target_event_id: row
                    .get::<String, _>("target_event_id")
                    .parse::<EventId>()
                    .map_err(|error| StoreError::Internal(error.to_string()))?,
                link_type: row.get("link_type"),
                confidence: Confidence::new(row.get("confidence"))
                    .map_err(|error| StoreError::Internal(error.to_string()))?,
                reasoning: row.get("reasoning"),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
            })
        })
        .collect()
}

async fn load_embeddings(
    backend: &PostgresBackend,
    org_id: &OrgId,
    event_id_strings: &[String],
) -> Result<Vec<EventEmbedding>, StoreError> {
    if event_id_strings.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query(
        "SELECT event_id, embedding, embedded_text, model_version
         FROM event_embeddings
         WHERE org_id = $1 AND event_id = ANY($2::text[])
         ORDER BY created_at ASC",
    )
    .bind(org_id.as_str())
    .bind(event_id_strings)
    .fetch_all(backend.pg_pool())
    .await
    .map_err(|error| StoreError::Query(error.to_string()))?;

    rows.iter()
        .map(|row| {
            Ok(EventEmbedding {
                event_id: row
                    .get::<String, _>("event_id")
                    .parse::<EventId>()
                    .map_err(|error| StoreError::Internal(error.to_string()))?,
                org_id: org_id.clone(),
                embedding: row.get::<Vec<f32>, _>("embedding"),
                embedded_text: row.get::<Option<String>, _>("embedded_text").unwrap_or_default(),
                model_version: row.get("model_version"),
            })
        })
        .collect()
}

fn row_to_event(row: &sqlx::postgres::PgRow) -> Event {
    let payload: Option<serde_json::Value> = row.get("payload");
    let media_type: Option<String> = row.get("media_type");
    let media_ref: Option<String> = row.get("media_ref");
    let media_blob: Option<Vec<u8>> = row.get("media_blob");
    let media_size: Option<i64> = row.get("media_size_bytes");

    let media = media_type.map(|media_type| MediaAttachment {
        media_type,
        inline_blob: media_blob,
        external_ref: media_ref,
        size_bytes: media_size.unwrap_or_default() as u64,
    });

    Event {
        event_id: row
            .get::<String, _>("event_id")
            .parse()
            .unwrap_or_else(|_| EventId::new()),
        org_id: OrgId::new(row.get::<String, _>("org_id").as_str()),
        source: Source::new(row.get::<String, _>("source").as_str()),
        topic: Topic::new(row.get::<String, _>("topic").as_str()),
        event_type: EventType::new(row.get::<String, _>("event_type").as_str()),
        event_time: row.get("event_time"),
        ingestion_time: row.get("ingestion_time"),
        entity_refs: extract_pending_entity_refs(payload.as_ref()),
        payload,
        media,
        raw_body: row.get("raw_body"),
    }
}

fn extract_pending_entity_refs(payload: Option<&serde_json::Value>) -> Vec<PendingEntityRef> {
    let Some(serde_json::Value::Object(payload)) = payload else {
        return Vec::new();
    };
    let Some(serde_json::Value::Array(entity_refs)) = payload.get("_entity_refs") else {
        return Vec::new();
    };

    entity_refs
        .iter()
        .filter_map(|entity_ref| {
            let serde_json::Value::Object(entity_ref) = entity_ref else {
                return None;
            };
            let entity_type = entity_ref.get("type")?.as_str()?;
            let entity_id = entity_ref.get("id")?.as_str()?;
            Some(PendingEntityRef {
                entity_type: EntityType::new(entity_type),
                entity_id: EntityId::new(entity_id),
            })
        })
        .collect()
}
