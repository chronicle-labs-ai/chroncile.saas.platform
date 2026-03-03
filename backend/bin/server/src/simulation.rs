//! Simulation Mode
//!
//! Spawns a background Tokio task that generates and streams realistic events
//! through the existing store + stream pipeline. Controlled via SIM_* environment
//! variables. Orthogonal to the storage backend choice.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use chronicle_infra::{StoreBackend, StreamBackend};
use chronicle_mock_connector::{
    all_scenarios, generate_random_events, ConversationScenario,
};
use chronicle_source_mock_stripe::MockStripeGenerator;
use chronicle_sources_core::{EventGenerator, GeneratorConfig};
use chronicle_domain::EventEnvelope;
use tokio::task::JoinHandle;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Simulation timing mode.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SimMode {
    /// Play back pre-built scenarios with realistic inter-event timing.
    Scenario,
    /// Generate random events at a fixed rate.
    Random,
    /// Interleave scenario playback with random events from multiple sources.
    Mixed,
}

impl SimMode {
    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "random" => Self::Random,
            "mixed" => Self::Mixed,
            _ => Self::Scenario,
        }
    }
}

/// Configuration for the simulation mode, parsed from environment variables.
#[derive(Debug, Clone)]
pub struct SimulationConfig {
    /// Whether simulation is enabled (`SIM_MODE=true`).
    pub enabled: bool,
    /// Timing mode (`SIM_TIMING`): scenario | random | mixed.
    pub mode: SimMode,
    /// Events per second for random / mixed modes (`SIM_RATE`).
    pub events_per_second: f64,
    /// Which scenarios to play (`SIM_SCENARIOS`): comma-separated names or "all".
    pub scenarios: Vec<String>,
    /// Which mock sources to include (`SIM_SOURCES`): comma-separated.
    pub sources: Vec<String>,
    /// Whether to loop forever when scenarios are exhausted (`SIM_LOOP`).
    pub loop_forever: bool,
    /// Tenant ID for all generated events (`SIM_TENANT`).
    pub tenant_id: String,
}

impl SimulationConfig {
    /// Parse configuration from SIM_* environment variables.
    pub fn from_env() -> Self {
        let enabled = std::env::var("SIM_MODE")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(false);

        let mode = SimMode::from_str(
            &std::env::var("SIM_TIMING").unwrap_or_else(|_| "scenario".into()),
        );

        let events_per_second: f64 = std::env::var("SIM_RATE")
            .unwrap_or_else(|_| "2.0".into())
            .parse()
            .unwrap_or(2.0);

        let scenarios = std::env::var("SIM_SCENARIOS")
            .unwrap_or_else(|_| "all".into())
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect();

        let sources = std::env::var("SIM_SOURCES")
            .unwrap_or_else(|_| "mock-connector".into())
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect();

        let loop_forever = std::env::var("SIM_LOOP")
            .map(|v| !v.eq_ignore_ascii_case("false") && v != "0")
            .unwrap_or(true);

        let tenant_id = std::env::var("SIM_TENANT")
            .unwrap_or_else(|_| "demo_tenant".into());

        Self {
            enabled,
            mode,
            events_per_second,
            scenarios,
            sources,
            loop_forever,
            tenant_id,
        }
    }
}

// ---------------------------------------------------------------------------
// Simulation runner
// ---------------------------------------------------------------------------

/// Start the simulation in a background Tokio task.
///
/// Returns a `JoinHandle` that can be awaited or aborted for graceful shutdown.
pub fn start_simulation(
    store: Arc<StoreBackend>,
    stream: Arc<StreamBackend>,
    config: SimulationConfig,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        tracing::info!(
            mode = ?config.mode,
            rate = config.events_per_second,
            scenarios = ?config.scenarios,
            sources = ?config.sources,
            loop_forever = config.loop_forever,
            tenant = %config.tenant_id,
            "Simulation task started"
        );

        match config.mode {
            SimMode::Scenario => run_scenario_mode(&store, &stream, &config).await,
            SimMode::Random => run_random_mode(&store, &stream, &config).await,
            SimMode::Mixed => run_mixed_mode(&store, &stream, &config).await,
        }

        tracing::info!("Simulation task finished");
    })
}

// ---------------------------------------------------------------------------
// Scenario mode – replay pre-built conversation scenarios with realistic gaps
// ---------------------------------------------------------------------------

async fn run_scenario_mode(
    store: &Arc<StoreBackend>,
    stream: &Arc<StreamBackend>,
    config: &SimulationConfig,
) {
    loop {
        let scenarios = build_scenario_pool(config);
        if scenarios.is_empty() {
            tracing::warn!("No scenarios matched the configuration, nothing to simulate");
            return;
        }

        for scenario in &scenarios {
            tracing::info!(
                name = %scenario.name,
                events = scenario.events.len(),
                "Playing scenario"
            );

            let events = rebase_timestamps(&scenario.events);
            play_events(store, stream, &events).await;
        }

        if !config.loop_forever {
            break;
        }

        tracing::info!("All scenarios completed, looping...");
        // Small pause between loops to avoid busy-spin
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

// ---------------------------------------------------------------------------
// Random mode – generate events at a fixed rate
// ---------------------------------------------------------------------------

async fn run_random_mode(
    store: &Arc<StoreBackend>,
    stream: &Arc<StreamBackend>,
    config: &SimulationConfig,
) {
    let include_stripe = config.sources.contains(&"mock-stripe".to_string());
    let stripe_gen = if include_stripe {
        Some(MockStripeGenerator::new())
    } else {
        None
    };
    let stripe_config = GeneratorConfig::new()
        .with_rate(config.events_per_second)
        .with_tenant(&config.tenant_id);

    let interval = Duration::from_secs_f64(1.0 / config.events_per_second.max(0.01));
    let mut timer = tokio::time::interval(interval);
    let mut count: u64 = 0;

    // Pre-generate a batch of mock-connector events to cycle through
    let mock_events = generate_random_events(config.tenant_id.as_str(), 200);
    let mut mock_idx = 0;

    loop {
        timer.tick().await;

        // Alternate between mock-connector and stripe if both are enabled
        let event = if include_stripe && stripe_gen.is_some() && count % 3 == 0 {
            // Every 3rd event comes from Stripe
            match stripe_gen.as_ref().unwrap().generate_event(&stripe_config).await {
                Ok(e) => e,
                Err(err) => {
                    tracing::error!(error = %err, "Failed to generate Stripe event");
                    continue;
                }
            }
        } else {
            // Use pre-generated mock-connector events, cycling through them
            let mut e = mock_events[mock_idx % mock_events.len()].clone();
            // Give each event a fresh timestamp so it appears as a new event
            e = e.with_occurred_at(Utc::now());
            // Assign a unique source_event_id to avoid dedup collisions
            e.source_event_id = format!("sim_random_{}_{}", count, mock_idx);
            mock_idx += 1;
            e
        };

        publish_event(store, stream, event).await;
        count += 1;
    }
}

// ---------------------------------------------------------------------------
// Mixed mode – interleave scenario playback with random source events
// ---------------------------------------------------------------------------

async fn run_mixed_mode(
    store: &Arc<StoreBackend>,
    stream: &Arc<StreamBackend>,
    config: &SimulationConfig,
) {
    let include_stripe = config.sources.contains(&"mock-stripe".to_string());
    let stripe_gen = if include_stripe {
        Some(MockStripeGenerator::new())
    } else {
        None
    };
    let stripe_config = GeneratorConfig::new()
        .with_rate(config.events_per_second)
        .with_tenant(&config.tenant_id);

    loop {
        let scenarios = build_scenario_pool(config);
        if scenarios.is_empty() {
            tracing::warn!("No scenarios matched for mixed mode, falling back to random");
            run_random_mode(store, stream, config).await;
            return;
        }

        for scenario in &scenarios {
            tracing::info!(
                name = %scenario.name,
                events = scenario.events.len(),
                "Playing scenario (mixed mode)"
            );

            let events = rebase_timestamps(&scenario.events);

            for (i, event) in events.iter().enumerate() {
                // Compute sleep from inter-event delta
                if i > 0 {
                    let delta = event
                        .occurred_at
                        .signed_duration_since(events[i - 1].occurred_at);
                    let sleep_dur = delta.to_std().unwrap_or(Duration::from_millis(500));
                    // Cap to 5 seconds to keep the mixed mode lively
                    let capped = sleep_dur.min(Duration::from_secs(5));

                    // Inject a Stripe event in the gap if the source is enabled
                    if include_stripe && capped > Duration::from_secs(1) {
                        tokio::time::sleep(capped / 2).await;
                        if let Some(ref gen) = stripe_gen {
                            if let Ok(stripe_event) = gen.generate_event(&stripe_config).await {
                                publish_event(store, stream, stripe_event).await;
                            }
                        }
                        tokio::time::sleep(capped / 2).await;
                    } else {
                        tokio::time::sleep(capped).await;
                    }
                }

                publish_event(store, stream, event.clone()).await;
            }
        }

        if !config.loop_forever {
            break;
        }

        tracing::info!("Mixed-mode loop complete, restarting...");
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Build the list of scenarios based on the config's `scenarios` filter.
fn build_scenario_pool(config: &SimulationConfig) -> Vec<ConversationScenario> {
    let all = all_scenarios(&config.tenant_id);

    if config.scenarios.contains(&"all".to_string()) {
        return all;
    }

    all.into_iter()
        .filter(|s| {
            let lower = s.name.to_lowercase();
            config.scenarios.iter().any(|want| lower.contains(want))
        })
        .collect()
}

/// Rebase scenario event timestamps so they start from *now*, preserving the
/// relative deltas between events.
fn rebase_timestamps(events: &[EventEnvelope]) -> Vec<EventEnvelope> {
    if events.is_empty() {
        return vec![];
    }

    let base_original = events[0].occurred_at;
    let base_now = Utc::now();

    events
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let delta = e.occurred_at.signed_duration_since(base_original);
            let new_ts = base_now + delta;
            let mut cloned = e.clone();
            cloned = cloned.with_occurred_at(new_ts);
            // Ensure unique source_event_id to avoid deduplication
            cloned.source_event_id = format!("{}_sim_{}", cloned.source_event_id, i);
            cloned
        })
        .collect()
}

/// Play a sequence of events with realistic timing between them.
async fn play_events(
    store: &Arc<StoreBackend>,
    stream: &Arc<StreamBackend>,
    events: &[EventEnvelope],
) {
    for (i, event) in events.iter().enumerate() {
        if i > 0 {
            let delta = event
                .occurred_at
                .signed_duration_since(events[i - 1].occurred_at);
            if let Ok(d) = delta.to_std() {
                // Cap individual sleeps at 30 seconds to keep demos moving
                let capped = d.min(Duration::from_secs(30));
                tokio::time::sleep(capped).await;
            }
        }

        publish_event(store, stream, event.clone()).await;
    }
}

/// Publish a single event to both the store and the broadcast stream.
async fn publish_event(
    store: &Arc<StoreBackend>,
    stream: &Arc<StreamBackend>,
    event: EventEnvelope,
) {
    let event_type = event.event_type.clone();
    let source = event.source.clone();

    if let Err(e) = store.append(&[event.clone()]).await {
        tracing::error!(error = %e, "Simulation: failed to store event");
    }

    if let Err(e) = stream.publish(event).await {
        tracing::error!(error = %e, "Simulation: failed to publish event");
    }

    tracing::debug!(
        source = %source,
        event_type = %event_type,
        "Simulation: published event"
    );
}
