use std::borrow::Cow;

use anyhow::Result;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config;

pub fn init_sentry(launch_config: &config::LaunchConfig) -> Result<sentry::ClientInitGuard> {
    let dsn = launch_config
        .integrations
        .sentry
        .dsn
        .as_deref()
        .map(|dsn| dsn.parse::<sentry::types::Dsn>())
        .transpose()?;

    Ok(sentry::init(sentry::ClientOptions {
        dsn,
        release: sentry::release_name!(),
        environment: launch_config
            .integrations
            .sentry
            .environment
            .clone()
            .map(Cow::Owned),
        traces_sample_rate: launch_config.integrations.sentry.traces_sample_rate,
        enable_logs: true,
        send_default_pii: false,
        ..Default::default()
    }))
}

pub fn init_tracing(launch_config: &config::LaunchConfig) {
    let sentry_layer = sentry::integrations::tracing::layer().event_filter(|metadata| {
        use sentry::integrations::tracing::EventFilter;
        use tracing::Level;

        match *metadata.level() {
            Level::ERROR => EventFilter::Event | EventFilter::Log,
            Level::WARN | Level::INFO => EventFilter::Breadcrumb | EventFilter::Log,
            Level::DEBUG => EventFilter::Log,
            Level::TRACE => EventFilter::Ignore,
        }
    });

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            launch_config.server.rust_log.clone(),
        ))
        .with(tracing_subscriber::fmt::layer())
        .with(sentry_layer)
        .init();
}

pub fn log_sentry_configuration(launch_config: &config::LaunchConfig) {
    tracing::info!(
        enabled = launch_config.integrations.sentry.dsn.is_some(),
        environment = ?launch_config.integrations.sentry.environment,
        traces_sample_rate = launch_config.integrations.sentry.traces_sample_rate,
        "Sentry configuration resolved"
    );
}
