//! Anduril Typography System
//!
//! Clear, authoritative text hierarchy.

use egui::FontId;

/// Display size - headers, titles
pub fn display() -> FontId {
    FontId::proportional(18.0)
}

/// Heading size - section titles
pub fn heading() -> FontId {
    FontId::proportional(14.0)
}

/// Body size - main content
pub fn body() -> FontId {
    FontId::proportional(12.0)
}

/// Small size - labels, metadata
pub fn small() -> FontId {
    FontId::proportional(11.0)
}

/// Caption size - hints, timestamps
pub fn caption() -> FontId {
    FontId::proportional(10.0)
}

/// Monospace - data, codes, technical values
pub fn mono() -> FontId {
    FontId::monospace(11.0)
}

/// Mono small - dense data displays
pub fn mono_small() -> FontId {
    FontId::monospace(10.0)
}
