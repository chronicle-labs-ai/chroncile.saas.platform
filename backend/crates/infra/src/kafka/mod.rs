//! Kafka Backend Implementation
//!
//! Feature-gated Kafka streaming backend using rdkafka.
//! This is a placeholder that will be fully implemented when needed.

mod consumer;
mod producer;

pub use consumer::KafkaConsumer;
pub use producer::KafkaProducer;

/// Kafka stream combining producer and consumer
#[derive(Clone)]
pub struct KafkaStream {
    producer: KafkaProducer,
    consumer: KafkaConsumer,
}

impl KafkaStream {
    /// Create a new Kafka stream
    ///
    /// # Arguments
    /// - `brokers`: Comma-separated list of broker addresses
    /// - `topic`: Topic to produce/consume from
    /// - `group_id`: Consumer group ID
    pub async fn new(brokers: &str, topic: &str, group_id: &str) -> Result<Self, KafkaError> {
        let producer = KafkaProducer::new(brokers, topic)?;
        let consumer = KafkaConsumer::new(brokers, topic, group_id)?;

        Ok(Self { producer, consumer })
    }

    pub fn producer(&self) -> &KafkaProducer {
        &self.producer
    }

    pub fn consumer(&self) -> &KafkaConsumer {
        &self.consumer
    }
}

/// Kafka-specific errors
#[derive(Debug, thiserror::Error)]
pub enum KafkaError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Produce error: {0}")]
    Produce(String),

    #[error("Consume error: {0}")]
    Consume(String),
}
