//! Anduril Rounding System
//!
//! Hard industrial edges with minimal rounding.

use egui::Rounding;

/// No rounding - hard industrial edges
pub const NONE: Rounding = Rounding::ZERO;
/// Minimal rounding - buttons, inputs
pub const SM: Rounding = Rounding::same(2.0);
/// Standard rounding - cards, panels
pub const MD: Rounding = Rounding::same(4.0);
/// Larger rounding (rare use)
pub const LG: Rounding = Rounding::same(6.0);

