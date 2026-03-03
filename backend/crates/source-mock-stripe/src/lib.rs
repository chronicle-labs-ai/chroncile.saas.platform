//! Mock Stripe Source
//!
//! Generates synthetic Stripe webhook events for testing and demos.
//! This source implements the EventGenerator trait to produce realistic
//! Stripe events at a configurable rate.
//!
//! ## Supported Event Types
//!
//! - `payment_intent.succeeded` - Successful payment
//! - `payment_intent.failed` - Failed payment
//! - `customer.created` - New customer
//! - `customer.updated` - Customer updated
//! - `invoice.paid` - Invoice paid
//! - `invoice.payment_failed` - Invoice payment failed
//! - `subscription.created` - New subscription
//! - `subscription.updated` - Subscription updated
//! - `subscription.deleted` - Subscription cancelled
//! - `charge.succeeded` - Successful charge
//! - `charge.failed` - Failed charge
//!
//! ## Usage
//!
//! ```ignore
//! use chronicle_source_mock_stripe::MockStripeAdapter;
//! use chronicle_sources_core::{GeneratorConfig, EventGenerator};
//!
//! let adapter = MockStripeAdapter::new();
//! let config = GeneratorConfig::default().with_rate(2.0); // 2 events/sec
//!
//! // Start generating events
//! let handle = adapter.as_event_generator().unwrap()
//!     .start(config, event_tx).await?;
//!
//! // Later, stop the generator
//! handle.stop().await?;
//! ```

mod adapter;
mod generator;
mod templates;

pub use adapter::MockStripeAdapter;
pub use generator::MockStripeGenerator;
pub use templates::{StripeEventTemplate, StripeEventType};

// Register with the sources registry
use chronicle_sources_registry::SourceRegistration;

inventory::submit! {
    SourceRegistration {
        factory: || Box::new(MockStripeAdapter::new())
    }
}
