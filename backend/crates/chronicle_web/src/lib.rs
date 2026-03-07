//! First-party web event tracking for Chronicle.
//!
//! This crate provides types and conversion logic for ingesting web
//! analytics events (track, page, identify, group) into the Chronicle
//! event store. It follows a Segment-like model, making it easy to
//! integrate with browser SDKs, server-side SDKs, or event gateways
//! like Hookdeck.
//!
//! # Event kinds
//!
//! | Kind       | Purpose                                |
//! |------------|----------------------------------------|
//! | **Track**  | Custom user actions (`button_clicked`)  |
//! | **Page**   | Page views with URL/title metadata     |
//! | **Identify** | Associate a user ID with traits       |
//! | **Group**  | Associate a user with an organization  |
//!
//! # Conversion
//!
//! [`WebEventConverter`] validates incoming payloads and converts them
//! into Chronicle [`Event`](chronicle_core::event::Event) objects with:
//!
//! - `source = "web"`
//! - Auto-derived topic and `event_type`
//! - Entity refs for user, `anonymous_user`, session, and group
//! - Properties/traits + context merged into the payload

pub mod convert;
pub mod error;
pub mod types;

pub use convert::WebEventConverter;
pub use error::WebError;
pub use types::{
    BatchPayload, GroupRequest, IdentifyRequest, IncomingWebEvent, PageRequest, TrackRequest,
    WebContext, WebEventKind,
};
