//! Timeline Core
//!
//! Shared timeline panel components for native and web applications.
//! This crate provides the core timeline widget that can be used with
//! any event type that implements the `TimelineEventData` trait.

pub mod event;
pub mod panel;
pub mod playback;
pub mod theme;
pub mod time_view;
pub mod timezone;
pub mod topic_tree;
pub mod utils;

pub use event::{TimelineEventData, SimpleEvent};
pub use panel::{TimelinePanel, TimelinePanelConfig, TimelinePanelResponse};
pub use playback::{PlaybackState, PlaybackSpeed, LoopSelection};
pub use theme::TimelineTheme;
pub use time_view::TimeView;
pub use timezone::DisplayTimezone;
pub use topic_tree::{TopicPath, TopicTree, TopicTreeNode, source_color, event_path_color};
pub use utils::{format_duration, format_duration_precise, format_relative_time};
