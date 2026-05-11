use std::fmt;
use std::sync::Arc;

use futures::{future::BoxFuture, stream::BoxStream, StreamExt, TryStreamExt};
use sqlx::{ConnectOptions, Postgres};
use tracing::{Instrument, Span};

#[derive(Debug, Default)]
struct QuerySpanAttributes {
    database: Option<String>,
    host: Option<String>,
    port: Option<u16>,
}

#[derive(Clone)]
pub struct TracedPgPool {
    inner: sqlx::PgPool,
    attributes: Arc<QuerySpanAttributes>,
}

pub struct TracedPgPoolConnection {
    inner: sqlx::pool::PoolConnection<Postgres>,
    attributes: Arc<QuerySpanAttributes>,
}

pub struct TracedPgTransaction<'c> {
    inner: sqlx::Transaction<'c, Postgres>,
    attributes: Arc<QuerySpanAttributes>,
}

impl fmt::Debug for TracedPgPool {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TracedPgPool").finish_non_exhaustive()
    }
}

impl fmt::Debug for TracedPgPoolConnection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TracedPgPoolConnection")
            .finish_non_exhaustive()
    }
}

impl fmt::Debug for TracedPgTransaction<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TracedPgTransaction")
            .finish_non_exhaustive()
    }
}

impl From<sqlx::PgPool> for TracedPgPool {
    fn from(inner: sqlx::PgPool) -> Self {
        let options = inner.connect_options();
        let url = options.to_url_lossy();
        let attributes = QuerySpanAttributes {
            host: url.host_str().map(String::from),
            port: url.port(),
            database: url
                .path_segments()
                .and_then(|mut segments| segments.next().map(String::from)),
        };
        Self {
            inner,
            attributes: Arc::new(attributes),
        }
    }
}

impl TracedPgPool {
    pub fn inner(&self) -> &sqlx::PgPool {
        &self.inner
    }

    pub async fn begin<'c>(&'c self) -> Result<TracedPgTransaction<'c>, sqlx::Error> {
        self.inner.begin().await.map(|inner| TracedPgTransaction {
            inner,
            attributes: Arc::clone(&self.attributes),
        })
    }

    pub async fn acquire(&self) -> Result<TracedPgPoolConnection, sqlx::Error> {
        self.inner
            .acquire()
            .await
            .map(|inner| TracedPgPoolConnection {
                inner,
                attributes: Arc::clone(&self.attributes),
            })
    }
}

impl TracedPgTransaction<'_> {
    pub async fn commit(self) -> Result<(), sqlx::Error> {
        self.inner.commit().await
    }

    pub async fn rollback(self) -> Result<(), sqlx::Error> {
        self.inner.rollback().await
    }
}

fn extract_db_operation(sql: &str) -> String {
    sql.trim_start()
        .split_whitespace()
        .next()
        .map(|token| {
            token
                .trim_matches(|character: char| !character.is_ascii_alphabetic())
                .to_ascii_uppercase()
        })
        .filter(|token| !token.is_empty())
        .unwrap_or_else(|| "QUERY".to_string())
}

fn query_span(sentry_op: &'static str, sql: &str, attributes: &QuerySpanAttributes) -> Span {
    let span = tracing::info_span!(
        "db.query",
        "sentry.name" = sql,
        "sentry.op" = sentry_op,
        "db.system" = "postgresql",
        "db.operation" = tracing::field::Empty,
        "db.name" = tracing::field::Empty,
        "db.query.text" = sql,
        "server.address" = tracing::field::Empty,
        "server.port" = tracing::field::Empty,
        "db.response.affected_rows" = tracing::field::Empty,
        "db.response.returned_rows" = tracing::field::Empty,
        "error.type" = tracing::field::Empty,
        "error.message" = tracing::field::Empty,
        "otel.kind" = "client",
    );

    let operation = extract_db_operation(sql);
    span.record("db.operation", operation.as_str());

    if let Some(database) = attributes.database.as_deref() {
        span.record("db.name", database);
    }
    if let Some(host) = attributes.host.as_deref() {
        span.record("server.address", host);
    }
    if let Some(port) = attributes.port {
        span.record("server.port", port);
    }

    span
}

fn record_affected_rows(result: &sqlx::postgres::PgQueryResult) {
    tracing::Span::current().record("db.response.affected_rows", result.rows_affected());
}

fn record_one<T>(_row: &T) {
    tracing::Span::current().record("db.response.returned_rows", 1);
}

fn record_optional<T>(row: &Option<T>) {
    tracing::Span::current().record(
        "db.response.returned_rows",
        if row.is_some() { 1 } else { 0 },
    );
}

fn record_error(error: &sqlx::Error) {
    let span = tracing::Span::current();
    let error_type = match error {
        sqlx::Error::ColumnIndexOutOfBounds { .. }
        | sqlx::Error::ColumnDecode { .. }
        | sqlx::Error::ColumnNotFound(_)
        | sqlx::Error::Decode(_)
        | sqlx::Error::Encode(_)
        | sqlx::Error::RowNotFound
        | sqlx::Error::TypeNotFound { .. } => "client",
        _ => "server",
    };
    span.record("error.type", error_type);
    span.record("error.message", error.to_string());
}

impl<'p> sqlx::Executor<'p> for &TracedPgPool {
    type Database = Postgres;

    fn fetch_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<
        'e,
        Result<
            sqlx::Either<
                <Self::Database as sqlx::Database>::QueryResult,
                <Self::Database as sqlx::Database>::Row,
            >,
            sqlx::Error,
        >,
    >
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = self.inner.fetch_many(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch_optional<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<Option<<Self::Database as sqlx::Database>::Row>, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.fetch_optional(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(record_optional)
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn prepare_with<'e, 'q: 'e>(
        self,
        sql: &'q str,
        parameters: &'e [<Self::Database as sqlx::Database>::TypeInfo],
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Statement<'q>, sqlx::Error>> {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = self.inner.prepare_with(sql, parameters);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }

    fn describe<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, Result<sqlx::Describe<Self::Database>, sqlx::Error>> {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = self.inner.describe(sql);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }

    fn execute<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::QueryResult, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.execute(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(record_affected_rows)
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn execute_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, Result<<Self::Database as sqlx::Database>::QueryResult, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = self.inner.execute_many(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, Result<<Self::Database as sqlx::Database>::Row, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = self.inner.fetch(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch_all<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<Vec<<Self::Database as sqlx::Database>::Row>, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.fetch_all(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(|rows| {
                        tracing::Span::current().record("db.response.returned_rows", rows.len());
                    })
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn fetch_one<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Row, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.fetch_one(query);
        Box::pin(
            async move { future.await.inspect(record_one).inspect_err(record_error) }
                .instrument(span),
        )
    }

    fn prepare<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Statement<'q>, sqlx::Error>> {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = self.inner.prepare(sql);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }
}

impl<'t> sqlx::Executor<'t> for &'t mut TracedPgPoolConnection {
    type Database = Postgres;

    fn fetch_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<
        'e,
        Result<
            sqlx::Either<
                <Self::Database as sqlx::Database>::QueryResult,
                <Self::Database as sqlx::Database>::Row,
            >,
            sqlx::Error,
        >,
    >
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = self.inner.fetch_many(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch_optional<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<Option<<Self::Database as sqlx::Database>::Row>, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.fetch_optional(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(record_optional)
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn prepare_with<'e, 'q: 'e>(
        self,
        sql: &'q str,
        parameters: &'e [<Self::Database as sqlx::Database>::TypeInfo],
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Statement<'q>, sqlx::Error>>
    where
        't: 'e,
    {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = self.inner.as_mut().prepare_with(sql, parameters);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }

    fn describe<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, Result<sqlx::Describe<Self::Database>, sqlx::Error>>
    where
        't: 'e,
    {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = self.inner.as_mut().describe(sql);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }

    fn execute<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::QueryResult, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.execute(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(record_affected_rows)
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn execute_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, Result<<Self::Database as sqlx::Database>::QueryResult, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = self.inner.execute_many(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, Result<<Self::Database as sqlx::Database>::Row, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = self.inner.fetch(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch_all<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<Vec<<Self::Database as sqlx::Database>::Row>, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.fetch_all(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(|rows| {
                        tracing::Span::current().record("db.response.returned_rows", rows.len());
                    })
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn fetch_one<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Row, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = self.inner.fetch_one(query);
        Box::pin(
            async move { future.await.inspect(record_one).inspect_err(record_error) }
                .instrument(span),
        )
    }

    fn prepare<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Statement<'q>, sqlx::Error>>
    where
        't: 'e,
    {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = self.inner.as_mut().prepare(sql);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }
}

impl<'t, 'c> sqlx::Executor<'t> for &'t mut TracedPgTransaction<'c>
where
    'c: 't,
{
    type Database = Postgres;

    fn fetch_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<
        'e,
        Result<
            sqlx::Either<
                <Self::Database as sqlx::Database>::QueryResult,
                <Self::Database as sqlx::Database>::Row,
            >,
            sqlx::Error,
        >,
    >
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = (&mut self.inner).fetch_many(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch_optional<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<Option<<Self::Database as sqlx::Database>::Row>, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = (&mut self.inner).fetch_optional(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(record_optional)
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn prepare_with<'e, 'q: 'e>(
        self,
        sql: &'q str,
        parameters: &'e [<Self::Database as sqlx::Database>::TypeInfo],
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Statement<'q>, sqlx::Error>>
    where
        't: 'e,
    {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = (&mut self.inner).prepare_with(sql, parameters);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }

    fn describe<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, Result<sqlx::Describe<Self::Database>, sqlx::Error>>
    where
        't: 'e,
    {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = (&mut self.inner).describe(sql);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }

    fn execute<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::QueryResult, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = (&mut self.inner).execute(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(record_affected_rows)
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn execute_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, Result<<Self::Database as sqlx::Database>::QueryResult, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = (&mut self.inner).execute_many(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, Result<<Self::Database as sqlx::Database>::Row, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let stream = (&mut self.inner).fetch(query);
        Box::pin(
            stream
                .inspect(move |_| {
                    let _enter = span.enter();
                })
                .inspect_err(record_error),
        )
    }

    fn fetch_all<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<Vec<<Self::Database as sqlx::Database>::Row>, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = (&mut self.inner).fetch_all(query);
        Box::pin(
            async move {
                future
                    .await
                    .inspect(|rows| {
                        tracing::Span::current().record("db.response.returned_rows", rows.len());
                    })
                    .inspect_err(record_error)
            }
            .instrument(span),
        )
    }

    fn fetch_one<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Row, sqlx::Error>>
    where
        E: 'q + sqlx::Execute<'q, Self::Database>,
        't: 'e,
    {
        let sql = query.sql();
        let span = query_span("db.query", sql, &self.attributes);
        let future = (&mut self.inner).fetch_one(query);
        Box::pin(
            async move { future.await.inspect(record_one).inspect_err(record_error) }
                .instrument(span),
        )
    }

    fn prepare<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, Result<<Self::Database as sqlx::Database>::Statement<'q>, sqlx::Error>>
    where
        't: 'e,
    {
        let span = query_span("db.prepare", sql, &self.attributes);
        let future = (&mut self.inner).prepare(sql);
        Box::pin(async move { future.await.inspect_err(record_error) }.instrument(span))
    }
}
