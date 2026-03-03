//! Stripe Event Templates
//!
//! Realistic templates for Stripe webhook events. These templates
//! generate events that closely match the structure of real Stripe webhooks.

use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Supported Stripe event types
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StripeEventType {
    PaymentIntentSucceeded,
    PaymentIntentFailed,
    CustomerCreated,
    CustomerUpdated,
    InvoicePaid,
    InvoicePaymentFailed,
    SubscriptionCreated,
    SubscriptionUpdated,
    SubscriptionDeleted,
    ChargeSucceeded,
    ChargeFailed,
}

impl StripeEventType {
    /// Get all available event types
    pub fn all() -> Vec<Self> {
        vec![
            Self::PaymentIntentSucceeded,
            Self::PaymentIntentFailed,
            Self::CustomerCreated,
            Self::CustomerUpdated,
            Self::InvoicePaid,
            Self::InvoicePaymentFailed,
            Self::SubscriptionCreated,
            Self::SubscriptionUpdated,
            Self::SubscriptionDeleted,
            Self::ChargeSucceeded,
            Self::ChargeFailed,
        ]
    }

    /// Get the Stripe event type string
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PaymentIntentSucceeded => "payment_intent.succeeded",
            Self::PaymentIntentFailed => "payment_intent.failed",
            Self::CustomerCreated => "customer.created",
            Self::CustomerUpdated => "customer.updated",
            Self::InvoicePaid => "invoice.paid",
            Self::InvoicePaymentFailed => "invoice.payment_failed",
            Self::SubscriptionCreated => "customer.subscription.created",
            Self::SubscriptionUpdated => "customer.subscription.updated",
            Self::SubscriptionDeleted => "customer.subscription.deleted",
            Self::ChargeSucceeded => "charge.succeeded",
            Self::ChargeFailed => "charge.failed",
        }
    }

    /// Parse from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "payment_intent.succeeded" => Some(Self::PaymentIntentSucceeded),
            "payment_intent.failed" => Some(Self::PaymentIntentFailed),
            "customer.created" => Some(Self::CustomerCreated),
            "customer.updated" => Some(Self::CustomerUpdated),
            "invoice.paid" => Some(Self::InvoicePaid),
            "invoice.payment_failed" => Some(Self::InvoicePaymentFailed),
            "customer.subscription.created" => Some(Self::SubscriptionCreated),
            "customer.subscription.updated" => Some(Self::SubscriptionUpdated),
            "customer.subscription.deleted" => Some(Self::SubscriptionDeleted),
            "charge.succeeded" => Some(Self::ChargeSucceeded),
            "charge.failed" => Some(Self::ChargeFailed),
            _ => None,
        }
    }

    /// Get event category for swim lanes
    pub fn category(&self) -> &'static str {
        match self {
            Self::PaymentIntentSucceeded | Self::PaymentIntentFailed => "payment",
            Self::CustomerCreated | Self::CustomerUpdated => "customer",
            Self::InvoicePaid | Self::InvoicePaymentFailed => "invoice",
            Self::SubscriptionCreated | Self::SubscriptionUpdated | Self::SubscriptionDeleted => {
                "subscription"
            }
            Self::ChargeSucceeded | Self::ChargeFailed => "charge",
        }
    }

    /// Get a random event type
    pub fn random() -> Self {
        let all = Self::all();
        let idx = rand::thread_rng().gen_range(0..all.len());
        all[idx]
    }

    /// Get a random "success" event type (more likely in demos)
    pub fn random_success() -> Self {
        let success_types = [
            Self::PaymentIntentSucceeded,
            Self::CustomerCreated,
            Self::CustomerUpdated,
            Self::InvoicePaid,
            Self::SubscriptionCreated,
            Self::ChargeSucceeded,
        ];
        let idx = rand::thread_rng().gen_range(0..success_types.len());
        success_types[idx]
    }
}

impl std::fmt::Display for StripeEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Template for generating Stripe events
pub struct StripeEventTemplate;

impl StripeEventTemplate {
    /// Generate a complete Stripe webhook event
    pub fn generate(event_type: StripeEventType, timestamp: DateTime<Utc>) -> serde_json::Value {
        let event_id = format!("evt_{}", generate_stripe_id());
        let customer_id = format!("cus_{}", generate_stripe_id());
        let created = timestamp.timestamp();

        let data_object = match event_type {
            StripeEventType::PaymentIntentSucceeded | StripeEventType::PaymentIntentFailed => {
                Self::payment_intent_object(&customer_id, event_type, created)
            }
            StripeEventType::CustomerCreated | StripeEventType::CustomerUpdated => {
                Self::customer_object(&customer_id, created)
            }
            StripeEventType::InvoicePaid | StripeEventType::InvoicePaymentFailed => {
                Self::invoice_object(&customer_id, event_type, created)
            }
            StripeEventType::SubscriptionCreated
            | StripeEventType::SubscriptionUpdated
            | StripeEventType::SubscriptionDeleted => {
                Self::subscription_object(&customer_id, event_type, created)
            }
            StripeEventType::ChargeSucceeded | StripeEventType::ChargeFailed => {
                Self::charge_object(&customer_id, event_type, created)
            }
        };

        json!({
            "id": event_id,
            "object": "event",
            "api_version": "2023-10-16",
            "created": created,
            "type": event_type.as_str(),
            "livemode": false,
            "pending_webhooks": 1,
            "request": {
                "id": format!("req_{}", generate_stripe_id()),
                "idempotency_key": null
            },
            "data": {
                "object": data_object
            }
        })
    }

    fn payment_intent_object(
        customer_id: &str,
        event_type: StripeEventType,
        created: i64,
    ) -> serde_json::Value {
        let pi_id = format!("pi_{}", generate_stripe_id());
        let amount = random_amount();
        let status = if event_type == StripeEventType::PaymentIntentSucceeded {
            "succeeded"
        } else {
            "requires_payment_method"
        };

        json!({
            "id": pi_id,
            "object": "payment_intent",
            "amount": amount,
            "amount_capturable": 0,
            "amount_received": if status == "succeeded" { amount } else { 0 },
            "currency": "usd",
            "customer": customer_id,
            "description": format!("Payment for order #{}", rand::thread_rng().gen_range(1000..9999)),
            "created": created,
            "status": status,
            "payment_method": format!("pm_{}", generate_stripe_id()),
            "payment_method_types": ["card"],
            "metadata": {
                "order_id": format!("ord_{}", generate_stripe_id()),
                "product_name": random_product_name()
            },
            "last_payment_error": if status != "succeeded" {
                Some(json!({
                    "code": "card_declined",
                    "message": "Your card was declined.",
                    "type": "card_error"
                }))
            } else {
                None
            }
        })
    }

    fn customer_object(customer_id: &str, created: i64) -> serde_json::Value {
        let (first_name, last_name) = random_name();
        let email = format!(
            "{}.{}@example.com",
            first_name.to_lowercase(),
            last_name.to_lowercase()
        );

        json!({
            "id": customer_id,
            "object": "customer",
            "created": created,
            "email": email,
            "name": format!("{} {}", first_name, last_name),
            "phone": random_phone(),
            "description": null,
            "balance": 0,
            "currency": "usd",
            "default_source": null,
            "delinquent": false,
            "livemode": false,
            "metadata": {},
            "address": {
                "city": random_city(),
                "country": "US",
                "line1": format!("{} {} St", rand::thread_rng().gen_range(100..999), random_street_name()),
                "line2": null,
                "postal_code": format!("{:05}", rand::thread_rng().gen_range(10000..99999)),
                "state": random_state()
            }
        })
    }

    fn invoice_object(
        customer_id: &str,
        event_type: StripeEventType,
        created: i64,
    ) -> serde_json::Value {
        let inv_id = format!("in_{}", generate_stripe_id());
        let amount = random_amount();
        let paid = event_type == StripeEventType::InvoicePaid;

        json!({
            "id": inv_id,
            "object": "invoice",
            "account_country": "US",
            "amount_due": amount,
            "amount_paid": if paid { amount } else { 0 },
            "amount_remaining": if paid { 0 } else { amount },
            "currency": "usd",
            "customer": customer_id,
            "customer_email": format!("customer-{}@example.com", &customer_id[4..12]),
            "created": created,
            "paid": paid,
            "status": if paid { "paid" } else { "open" },
            "subscription": format!("sub_{}", generate_stripe_id()),
            "total": amount,
            "number": format!("INV-{:06}", rand::thread_rng().gen_range(100000..999999)),
            "lines": {
                "object": "list",
                "data": [{
                    "id": format!("il_{}", generate_stripe_id()),
                    "amount": amount,
                    "description": "Monthly subscription",
                    "quantity": 1
                }]
            }
        })
    }

    fn subscription_object(
        customer_id: &str,
        event_type: StripeEventType,
        created: i64,
    ) -> serde_json::Value {
        let sub_id = format!("sub_{}", generate_stripe_id());
        let status = match event_type {
            StripeEventType::SubscriptionCreated => "active",
            StripeEventType::SubscriptionUpdated => "active",
            StripeEventType::SubscriptionDeleted => "canceled",
            _ => "active",
        };

        let plan_names = ["Basic", "Pro", "Enterprise", "Starter", "Business"];
        let plan_name = plan_names[rand::thread_rng().gen_range(0..plan_names.len())];
        let amount = match plan_name {
            "Starter" => 999,
            "Basic" => 1999,
            "Pro" => 4999,
            "Business" => 9999,
            "Enterprise" => 24999,
            _ => 1999,
        };

        json!({
            "id": sub_id,
            "object": "subscription",
            "customer": customer_id,
            "created": created,
            "current_period_start": created,
            "current_period_end": created + 30 * 24 * 60 * 60,
            "status": status,
            "cancel_at_period_end": status == "canceled",
            "canceled_at": if status == "canceled" { Some(created) } else { None },
            "currency": "usd",
            "items": {
                "object": "list",
                "data": [{
                    "id": format!("si_{}", generate_stripe_id()),
                    "object": "subscription_item",
                    "price": {
                        "id": format!("price_{}", generate_stripe_id()),
                        "object": "price",
                        "currency": "usd",
                        "unit_amount": amount,
                        "recurring": {
                            "interval": "month",
                            "interval_count": 1
                        }
                    },
                    "quantity": 1
                }]
            },
            "plan": {
                "id": format!("plan_{}", generate_stripe_id()),
                "object": "plan",
                "amount": amount,
                "currency": "usd",
                "interval": "month",
                "nickname": format!("{} Plan", plan_name),
                "product": format!("prod_{}", generate_stripe_id())
            },
            "metadata": {
                "plan_tier": plan_name.to_lowercase()
            }
        })
    }

    fn charge_object(
        customer_id: &str,
        event_type: StripeEventType,
        created: i64,
    ) -> serde_json::Value {
        let charge_id = format!("ch_{}", generate_stripe_id());
        let amount = random_amount();
        let paid = event_type == StripeEventType::ChargeSucceeded;
        let status = if paid { "succeeded" } else { "failed" };

        json!({
            "id": charge_id,
            "object": "charge",
            "amount": amount,
            "amount_captured": if paid { amount } else { 0 },
            "amount_refunded": 0,
            "currency": "usd",
            "customer": customer_id,
            "created": created,
            "paid": paid,
            "status": status,
            "payment_method": format!("pm_{}", generate_stripe_id()),
            "receipt_email": format!("receipt-{}@example.com", &customer_id[4..12]),
            "receipt_url": format!("https://pay.stripe.com/receipts/{}", generate_stripe_id()),
            "description": random_product_name(),
            "failure_code": if !paid { Some("card_declined") } else { None },
            "failure_message": if !paid { Some("Your card was declined.") } else { None },
            "billing_details": {
                "name": "John Doe",
                "email": format!("customer-{}@example.com", &customer_id[4..12])
            },
            "metadata": {
                "order_id": format!("ord_{}", generate_stripe_id())
            }
        })
    }
}

// Helper functions for generating random data

fn generate_stripe_id() -> String {
    use rand::distributions::Alphanumeric;
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(24)
        .map(char::from)
        .collect::<String>()
        .to_lowercase()
}

fn random_amount() -> i64 {
    // Random amounts between $5 and $500
    let amounts = [
        500, 999, 1499, 1999, 2499, 2999, 4999, 9999, 14999, 19999, 24999, 49999,
    ];
    amounts[rand::thread_rng().gen_range(0..amounts.len())]
}

fn random_name() -> (&'static str, &'static str) {
    let first_names = [
        "James",
        "Mary",
        "John",
        "Patricia",
        "Robert",
        "Jennifer",
        "Michael",
        "Linda",
        "David",
        "Elizabeth",
        "William",
        "Barbara",
        "Richard",
        "Susan",
        "Joseph",
        "Jessica",
        "Thomas",
        "Sarah",
        "Christopher",
        "Karen",
    ];
    let last_names = [
        "Smith",
        "Johnson",
        "Williams",
        "Brown",
        "Jones",
        "Garcia",
        "Miller",
        "Davis",
        "Rodriguez",
        "Martinez",
        "Hernandez",
        "Lopez",
        "Gonzalez",
        "Wilson",
        "Anderson",
        "Thomas",
        "Taylor",
        "Moore",
        "Jackson",
        "Martin",
    ];
    let first = first_names[rand::thread_rng().gen_range(0..first_names.len())];
    let last = last_names[rand::thread_rng().gen_range(0..last_names.len())];
    (first, last)
}

fn random_phone() -> String {
    let area_code = rand::thread_rng().gen_range(200..999);
    let exchange = rand::thread_rng().gen_range(200..999);
    let subscriber = rand::thread_rng().gen_range(1000..9999);
    format!("+1{}{}{}", area_code, exchange, subscriber)
}

fn random_city() -> &'static str {
    let cities = [
        "New York",
        "Los Angeles",
        "Chicago",
        "Houston",
        "Phoenix",
        "Philadelphia",
        "San Antonio",
        "San Diego",
        "Dallas",
        "San Jose",
        "Austin",
        "Jacksonville",
        "Fort Worth",
        "Columbus",
        "San Francisco",
        "Seattle",
        "Denver",
        "Boston",
        "Portland",
        "Miami",
    ];
    cities[rand::thread_rng().gen_range(0..cities.len())]
}

fn random_state() -> &'static str {
    let states = [
        "CA", "TX", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI", "NJ", "VA", "WA", "AZ", "MA",
        "TN", "IN", "MO", "MD", "WI",
    ];
    states[rand::thread_rng().gen_range(0..states.len())]
}

fn random_street_name() -> &'static str {
    let streets = [
        "Main",
        "Oak",
        "Maple",
        "Cedar",
        "Pine",
        "Elm",
        "Washington",
        "Lake",
        "Hill",
        "Park",
        "Forest",
        "River",
        "Church",
        "Market",
        "Union",
        "Spring",
        "High",
        "Center",
        "School",
        "Mill",
    ];
    streets[rand::thread_rng().gen_range(0..streets.len())]
}

fn random_product_name() -> &'static str {
    let products = [
        "Premium Subscription",
        "Enterprise License",
        "API Access",
        "Cloud Storage",
        "Support Package",
        "Analytics Dashboard",
        "Team Collaboration",
        "Custom Integration",
        "White Label Solution",
        "Advanced Features",
    ];
    products[rand::thread_rng().gen_range(0..products.len())]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_payment_intent() {
        let event =
            StripeEventTemplate::generate(StripeEventType::PaymentIntentSucceeded, Utc::now());

        assert!(event["id"].as_str().unwrap().starts_with("evt_"));
        assert_eq!(event["type"], "payment_intent.succeeded");
        assert!(event["data"]["object"]["id"]
            .as_str()
            .unwrap()
            .starts_with("pi_"));
    }

    #[test]
    fn test_generate_customer() {
        let event = StripeEventTemplate::generate(StripeEventType::CustomerCreated, Utc::now());

        assert!(event["id"].as_str().unwrap().starts_with("evt_"));
        assert_eq!(event["type"], "customer.created");
        assert!(event["data"]["object"]["id"]
            .as_str()
            .unwrap()
            .starts_with("cus_"));
        assert!(event["data"]["object"]["email"].as_str().is_some());
    }

    #[test]
    fn test_event_type_roundtrip() {
        for event_type in StripeEventType::all() {
            let str_repr = event_type.as_str();
            let parsed = StripeEventType::from_str(str_repr);
            assert_eq!(parsed, Some(event_type));
        }
    }
}
