//! Anduril-Inspired Design System
//!
//! A severe, grounded, operationally confident visual system.
//! Designed for mission-critical command interfaces with high information density.
//!
//! Key principles:
//! - Dark, low-key, restrained - no gloss, no playfulness
//! - Color is a signaling system, not decoration
//! - Motion only when it conveys causality
//! - Everything must feel deployed, decisive, and inevitable

mod buttons;
pub mod colors;
mod components;
mod frames;
pub mod rounding;
pub mod spacing;
pub mod strokes;
pub mod typography;

use std::collections::BTreeMap;

use egui::{Color32, FontId, Stroke, TextStyle, Visuals};

// Re-export all helpers at module root for convenience
pub use buttons::{danger_button, primary_button, secondary_button};
pub use components::{data_label, metric, section_header, status_badge, subsection_header};
pub use frames::{card_frame, inset_frame, panel_frame, status_frame};

// Re-export compat module for backwards compatibility
pub use colors::compat;

// ============================================================================
// EGUI STYLE CONFIGURATION
// ============================================================================

/// Configure egui with Anduril design system
pub fn configure_style(ctx: &egui::Context) {
    let mut style = (*ctx.style()).clone();

    // Text styles - tighter tracking would need custom font config
    style.text_styles = BTreeMap::from([
        (TextStyle::Small, FontId::proportional(10.0)),
        (TextStyle::Body, FontId::proportional(12.0)),
        (TextStyle::Button, FontId::proportional(12.0)),
        (TextStyle::Heading, FontId::proportional(14.0)),
        (TextStyle::Monospace, FontId::monospace(11.0)),
    ]);

    // Spacing - tight, grid-locked
    style.spacing.item_spacing = egui::vec2(spacing::SM, spacing::XS);
    style.spacing.window_margin = egui::Margin::same(spacing::PANEL);
    style.spacing.button_padding = egui::vec2(spacing::SM, spacing::XS);
    style.spacing.indent = spacing::LG;
    style.spacing.interact_size = egui::vec2(32.0, 20.0);
    style.spacing.slider_width = 100.0;
    style.spacing.combo_width = 120.0;
    style.spacing.text_edit_width = 200.0;
    style.spacing.icon_width = 14.0;
    style.spacing.icon_width_inner = 10.0;
    style.spacing.icon_spacing = spacing::XS;
    style.spacing.tooltip_width = 400.0;
    style.spacing.menu_margin = egui::Margin::same(spacing::XS);
    style.spacing.combo_height = 200.0;
    style.spacing.scroll = egui::style::ScrollStyle {
        bar_width: 8.0,
        handle_min_length: 24.0,
        bar_inner_margin: 2.0,
        bar_outer_margin: 0.0,
        floating: false,
        ..Default::default()
    };

    // Animation - minimal, fast, linear (not expressive)
    style.animation_time = 0.08; // Fast transitions

    // Visuals
    style.visuals = create_visuals();

    ctx.set_style(style);
}

/// Create Anduril-themed visuals
fn create_visuals() -> Visuals {
    let mut visuals = Visuals::dark();

    // Override dark theme defaults with Anduril palette
    visuals.dark_mode = true;
    visuals.override_text_color = None;

    // Panel and window backgrounds
    visuals.panel_fill = colors::BG_SURFACE;
    visuals.window_fill = colors::BG_SURFACE;
    visuals.extreme_bg_color = colors::BG_BASE;
    visuals.faint_bg_color = colors::BG_ELEVATED;
    visuals.code_bg_color = colors::BG_BASE;

    // Window styling
    visuals.window_rounding = rounding::MD;
    visuals.window_shadow = egui::epaint::Shadow {
        offset: egui::vec2(0.0, 4.0),
        blur: 16.0,
        spread: 0.0,
        color: Color32::from_rgba_unmultiplied(0, 0, 0, 100),
    };
    visuals.window_stroke = Stroke::new(1.0, colors::BORDER_SUBTLE);

    // Popup styling
    visuals.popup_shadow = egui::epaint::Shadow {
        offset: egui::vec2(0.0, 2.0),
        blur: 8.0,
        spread: 0.0,
        color: Color32::from_rgba_unmultiplied(0, 0, 0, 80),
    };

    // Menu styling
    visuals.menu_rounding = rounding::SM;

    // Hyperlink colors
    visuals.hyperlink_color = colors::ACCENT_TEAL;

    // Selection
    visuals.selection.bg_fill = colors::ACCENT_TEAL_DIM;
    visuals.selection.stroke = Stroke::new(1.0, colors::ACCENT_TEAL);

    // Widget visuals - inactive state
    visuals.widgets.inactive.weak_bg_fill = colors::BG_CONTROL;
    visuals.widgets.inactive.bg_fill = colors::BG_CONTROL;
    visuals.widgets.inactive.bg_stroke = Stroke::new(1.0, colors::BORDER_SUBTLE);
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, colors::TEXT_SECONDARY);
    visuals.widgets.inactive.rounding = rounding::SM;
    visuals.widgets.inactive.expansion = 0.0;

    // Widget visuals - hovered state
    visuals.widgets.hovered.weak_bg_fill = colors::BG_HOVER;
    visuals.widgets.hovered.bg_fill = colors::BG_HOVER;
    visuals.widgets.hovered.bg_stroke = Stroke::new(1.0, colors::BORDER_DEFAULT);
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0, colors::TEXT_PRIMARY);
    visuals.widgets.hovered.rounding = rounding::SM;
    visuals.widgets.hovered.expansion = 0.0;

    // Widget visuals - active state
    visuals.widgets.active.weak_bg_fill = colors::BG_ACTIVE;
    visuals.widgets.active.bg_fill = colors::BG_ACTIVE;
    visuals.widgets.active.bg_stroke = Stroke::new(1.0, colors::ACCENT_TEAL);
    visuals.widgets.active.fg_stroke = Stroke::new(1.0, colors::TEXT_PRIMARY);
    visuals.widgets.active.rounding = rounding::SM;
    visuals.widgets.active.expansion = 0.0;

    // Widget visuals - open (dropdown open, etc.)
    visuals.widgets.open.weak_bg_fill = colors::BG_ACTIVE;
    visuals.widgets.open.bg_fill = colors::BG_ACTIVE;
    visuals.widgets.open.bg_stroke = Stroke::new(1.0, colors::BORDER_STRONG);
    visuals.widgets.open.fg_stroke = Stroke::new(1.0, colors::TEXT_PRIMARY);
    visuals.widgets.open.rounding = rounding::SM;
    visuals.widgets.open.expansion = 0.0;

    // Widget visuals - noninteractive (labels, etc.)
    visuals.widgets.noninteractive.weak_bg_fill = Color32::TRANSPARENT;
    visuals.widgets.noninteractive.bg_fill = colors::BG_SURFACE;
    visuals.widgets.noninteractive.bg_stroke = Stroke::NONE;
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, colors::TEXT_PRIMARY);
    visuals.widgets.noninteractive.rounding = rounding::NONE;
    visuals.widgets.noninteractive.expansion = 0.0;

    // Striped table backgrounds
    visuals.striped = true;

    // Resize handle
    visuals.resize_corner_size = 10.0;

    // Text cursor
    visuals.text_cursor.stroke = Stroke::new(2.0, colors::ACCENT_TEAL);
    visuals.text_cursor.blink = true;

    // Clip rectangles
    visuals.clip_rect_margin = 2.0;

    // Image handling
    visuals.image_loading_spinners = false;

    // Warning/error colors
    visuals.error_fg_color = colors::SIGNAL_RED;
    visuals.warn_fg_color = colors::SIGNAL_AMBER;

    visuals
}
