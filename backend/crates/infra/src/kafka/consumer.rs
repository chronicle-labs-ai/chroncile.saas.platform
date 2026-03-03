//! Kafka Consumer
//!
//! Consumes events from Kafka topics.

use async_trait::async_trait;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::Message;
use std::sync::Arc;
use tokio::sync::Mutex;

use chronicle_domain::{EventEnvelope, StreamError, StreamResult};
use chronicle_interfaces::{EventStreamConsumer, StreamReceiver};

use super::KafkaError;

/// Kafka event consumer
#[derive(Clone)]
pub struct KafkaConsumer {
    consumer: Arc<StreamConsumer>,
    topic: String,
}

impl KafkaConsumer {
    /// Create a new Kafka consumer
    pub fn new(brokers: &str, topic: &str, group_id: &str) -> Result<Self, KafkaError> {
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("group.id", group_id)
            .set("enable.auto.commit", "false")
            .set("auto.offset.reset", "earliest")
            .create()
            .map_err(|e| KafkaError::Config(e.to_string()))?;

        consumer
            .subscribe(&[topic])
            .map_err(|e| KafkaError::Connection(e.to_string()))?;

        Ok(Self {
            consumer: Arc::new(consumer),
            topic: topic.to_string(),
        })
    }

    /// Create a stream receiver
    pub fn subscribe(&self) -> KafkaStreamReceiver {
        KafkaStreamReceiver {
            consumer: Arc::clone(&self.consumer),
        }
    }
}

#[async_trait]
impl EventStreamConsumer for KafkaConsumer {
    async fn poll(&self) -> StreamResult<Vec<EventEnvelope>> {
        use futures::StreamExt;

        let mut events = Vec::new();
        let mut stream = self.consumer.stream();

        // Poll for messages with a timeout
        while let Ok(Some(result)) =
            tokio::time::timeout(std::time::Duration::from_millis(100), stream.next()).await
        {
            match result {
                Ok(msg) => {
                    if let Some(payload) = msg.payload() {
                        if let Ok(event) = serde_json::from_slice::<EventEnvelope>(payload) {
                            events.push(event);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Kafka consume error: {}", e);
                }
            }
        }

        Ok(events)
    }

    async fn commit(&self) -> StreamResult<()> {
        self.consumer
            .commit_consumer_state(rdkafka::consumer::CommitMode::Async)
            .map_err(|e| StreamError::PublishFailed(e.to_string()))?;
        Ok(())
    }
}

/// Kafka stream receiver for SSE
pub struct KafkaStreamReceiver {
    consumer: Arc<StreamConsumer>,
}

#[async_trait]
impl StreamReceiver for KafkaStreamReceiver {
    async fn recv(&mut self) -> StreamResult<EventEnvelope> {
        use futures::StreamExt;

        let mut stream = self.consumer.stream();

        loop {
            match stream.next().await {
                Some(Ok(msg)) => {
                    if let Some(payload) = msg.payload() {
                        if let Ok(event) = serde_json::from_slice::<EventEnvelope>(payload) {
                            return Ok(event);
                        }
                    }
                }
                Some(Err(e)) => {
                    return Err(StreamError::PublishFailed(e.to_string()));
                }
                None => {
                    return Err(StreamError::ChannelClosed);
                }
            }
        }
    }

    fn try_recv(&mut self) -> StreamResult<Option<EventEnvelope>> {
        // Kafka doesn't have a good try_recv - would need to poll with zero timeout
        Ok(None)
    }
}
