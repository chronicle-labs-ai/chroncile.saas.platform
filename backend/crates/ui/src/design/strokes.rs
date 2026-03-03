//! Anduril Stroke System
//!
//! Subtle structural lines and borders.

use egui::{Color32, Stroke};

use super::colors;

/// Subtle divider stroke
pub fn divider() -> Stroke {
    Stroke::new(1.0, colors::BORDER_SUBTLE)
}

/// Default border stroke
pub fn border() -> Stroke {
    Stroke::new(1.0, colors::BORDER_DEFAULT)
}

/// Strong border stroke
pub fn border_strong() -> Stroke {
    Stroke::new(1.0, colors::BORDER_STRONG)
}

/// Focus ring stroke
pub fn focus() -> Stroke {
    Stroke::new(1.5, colors::BORDER_FOCUS)
}

/// Selection stroke
pub fn selection() -> Stroke {
    Stroke::new(1.0, colors::ACCENT_TEAL)
}

/// Grid line stroke
pub fn grid() -> Stroke {
    Stroke::new(1.0, Color32::from_rgba_unmultiplied(255, 255, 255, 8))
}

