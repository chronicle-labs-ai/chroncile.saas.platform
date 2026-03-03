//! Kafka Producer
//!
//! Produces events to Kafka topics.

use async_trait::async_trait;
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::time::Duration;

use chronicle_domain::{EventEnvelope, StreamError, StreamResult};
use chronicle_interfaces::EventStreamProducer;

use super::KafkaError;

/// Kafka event producer
#[derive(Clone)]
pub struct KafkaProducer {
    producer: FutureProducer,
    topic: String,
}

impl KafkaProducer {
    /// Create a new Kafka producer
    pub fn new(brokers: &str, topic: &str) -> Result<Self, KafkaError> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .set("enable.idempotence", "true")
            .create()
            .map_err(|e| KafkaError::Config(e.to_string()))?;

        Ok(Self {
            producer,
            topic: topic.to_string(),
        })
    }
}

#[async_trait]
impl EventStreamProducer for KafkaProducer {
    async fn publish(&self, event: EventEnvelope) -> StreamResult<()> {
        // Serialize the event
        let payload = serde_json::to_string(&event)
            .map_err(|e| StreamError::PublishFailed(e.to_string()))?;

        // Use conversation_id as partition key for ordering
        let key = event.subject.conversation_id.as_str();

        let record = FutureRecord::to(&self.topic)
            .key(key)
            .payload(&payload);

        self.producer
            .send(record, Duration::from_secs(5))
            .await
            .map_err(|(e, _)| StreamError::PublishFailed(e.to_string()))?;

        Ok(())
    }

    async fn publish_batch(&self, events: Vec<EventEnvelope>) -> StreamResult<()> {
        // For Kafka, we can send in parallel since librdkafka handles batching internally
        for event in events {
            self.publish(event).await?;
        }
        Ok(())
    }
}
