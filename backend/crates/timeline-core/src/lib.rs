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

pub use event::{SimpleEvent, TimelineEventData};
pub use panel::{TimelinePanel, TimelinePanelConfig, TimelinePanelResponse};
pub use playback::{LoopSelection, PlaybackSpeed, PlaybackState};
pub use theme::TimelineTheme;
pub use time_view::TimeView;
pub use timezone::DisplayTimezone;
pub use topic_tree::{event_path_color, source_color, TopicPath, TopicTree, TopicTreeNode};
pub use utils::{format_duration, format_duration_precise, format_relative_time};
